// In-memory stand-in for the parts of the GitHub REST API that sync uses
// (repo info, git refs/commits/trees/blobs, contents PUT on an empty repo).
// Hook it into a Playwright browser context with fake.attach(context).
const crypto = require('crypto');

class FakeGitHub {
  constructor({ owner = 'me', repo = 'trade-journal-data', token = 'good-token', isPrivate = true } = {}) {
    Object.assign(this, { owner, repo, token, isPrivate });
    this.blobs = new Map();   // sha -> Buffer
    this.trees = new Map();   // sha -> Map(path -> blobSha)
    this.commits = new Map(); // sha -> {tree, parents, message}
    this.head = null;         // empty repo until first commit
    this.requests = [];
    this.beforePatch = null;  // test hook: runs once before a ref update
    this.offline = false;
  }
  sha(x) { return crypto.createHash('sha1').update(x).digest('hex'); }
  putBlob(buf) { const s = this.sha(Buffer.concat([Buffer.from('blob'), buf])); this.blobs.set(s, buf); return s; }
  putTree(map) { const s = this.sha('tree' + JSON.stringify([...map].sort())); this.trees.set(s, new Map(map)); return s; }
  putCommit(tree, parents, message) { const s = this.sha('commit' + tree + parents.join() + message + Math.random()); this.commits.set(s, { tree, parents, message }); return s; }
  files() { return this.head ? this.trees.get(this.commits.get(this.head).tree) : new Map(); }
  read(path) { const f = this.files(); return f.has(path) ? this.blobs.get(f.get(path)) : null; }
  journal() { const b = this.read('journal.json'); return b ? JSON.parse(b.toString('utf8')) : null; }
  // Make a commit as if another device pushed (used to test retries).
  commitFiles(changes, message = 'other device') {
    const map = new Map(this.files());
    for (const [p, content] of Object.entries(changes)) content == null ? map.delete(p) : map.set(p, this.putBlob(Buffer.from(content)));
    this.head = this.putCommit(this.putTree(map), this.head ? [this.head] : [], message);
  }

  async attach(context) {
    await context.route('https://api.github.com/**', route => this.handle(route));
  }
  async handle(route) {
    const req = route.request();
    if (this.offline) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    this.requests.push(`${method} ${url.pathname}`);
    const send = (status, json) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(json) });
    if (req.headers()['authorization'] !== 'Bearer ' + this.token) return send(401, { message: 'Bad credentials' });
    const base = `/repos/${this.owner}/${this.repo}`;
    if (!url.pathname.startsWith(base)) return send(404, { message: 'Not Found' });
    const p = url.pathname.slice(base.length);
    let m;
    if (method === 'GET' && p === '') return send(200, { name: this.repo, private: this.isPrivate, default_branch: 'main', permissions: { push: true } });
    if (method === 'GET' && (m = /^\/git\/ref\/heads\/(.+)$/.exec(p))) {
      if (!this.head) return send(409, { message: 'Git Repository is empty.' });
      return send(200, { ref: 'refs/heads/main', object: { sha: this.head, type: 'commit' } });
    }
    if (method === 'PUT' && (m = /^\/contents\/(.+)$/.exec(p))) {
      if (this.head) return send(422, { message: 'sha wasn\'t supplied' });
      const map = new Map([[m[1], this.putBlob(Buffer.from(body.content, 'base64'))]]);
      this.head = this.putCommit(this.putTree(map), [], body.message);
      return send(201, { commit: { sha: this.head } });
    }
    if (method === 'GET' && (m = /^\/git\/commits\/(\w+)$/.exec(p))) {
      const c = this.commits.get(m[1]); if (!c) return send(404, { message: 'Not Found' });
      return send(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map(sha => ({ sha })) });
    }
    if (method === 'GET' && (m = /^\/git\/trees\/(\w+)$/.exec(p))) {
      const t = this.trees.get(m[1]); if (!t) return send(404, { message: 'Not Found' });
      return send(200, { sha: m[1], truncated: false, tree: [...t].map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha, size: this.blobs.get(sha).length })) });
    }
    if (method === 'GET' && (m = /^\/git\/blobs\/(\w+)$/.exec(p))) {
      const b = this.blobs.get(m[1]); if (!b) return send(404, { message: 'Not Found' });
      return send(200, { sha: m[1], size: b.length, encoding: 'base64', content: b.toString('base64').replace(/(.{60})/g, '$1\n') });
    }
    if (method === 'POST' && p === '/git/blobs') {
      const buf = body.encoding === 'base64' ? Buffer.from(body.content, 'base64') : Buffer.from(body.content, 'utf8');
      return send(201, { sha: this.putBlob(buf) });
    }
    if (method === 'POST' && p === '/git/trees') {
      const map = new Map(body.base_tree ? this.trees.get(body.base_tree) : []);
      for (const e of body.tree) e.sha === null ? map.delete(e.path) : map.set(e.path, e.sha || this.putBlob(Buffer.from(e.content)));
      return send(201, { sha: this.putTree(map) });
    }
    if (method === 'POST' && p === '/git/commits') return send(201, { sha: this.putCommit(body.tree, body.parents || [], body.message) });
    if (method === 'PATCH' && (m = /^\/git\/refs\/heads\/(.+)$/.exec(p))) {
      if (this.beforePatch) { const f = this.beforePatch; this.beforePatch = null; f(); }
      const c = this.commits.get(body.sha);
      if (!c) return send(422, { message: 'Object does not exist' });
      if (!body.force && this.head && !c.parents.includes(this.head)) return send(422, { message: 'Update is not a fast forward' });
      this.head = body.sha;
      return send(200, { object: { sha: this.head } });
    }
    return send(404, { message: `Fake GitHub: no route for ${method} ${p}` });
  }
}
module.exports = { FakeGitHub };
