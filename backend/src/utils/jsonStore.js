const fs = require("fs");
const path = require("path");

/**
 * Minimal file-backed JSON store.
 * Good enough for MVP persistence without needing Postgres/Mongo setup.
 * Swap this out for a real DB later (see README "Scaling the DB" section).
 */
class JsonStore {
  constructor(fileName) {
    this.filePath = path.join(__dirname, "..", "..", "data", fileName);
    this._ensureFile();
    this._writeLock = Promise.resolve();
  }

  _ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ items: [] }, null, 2));
    }
  }

  _read() {
    const raw = fs.readFileSync(this.filePath, "utf-8");
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { items: [] };
    }
  }

  _write(data) {
    // naive queue so concurrent writes don't clobber each other
    this._writeLock = this._writeLock.then(
      () =>
        new Promise((resolve, reject) => {
          fs.writeFile(this.filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) reject(err);
            else resolve();
          });
        })
    );
    return this._writeLock;
  }

  getAll() {
    return this._read().items;
  }

  getById(id) {
    return this._read().items.find((i) => i.id === id) || null;
  }

  async insert(item) {
    const data = this._read();
    data.items.push(item);
    await this._write(data);
    return item;
  }

  async update(id, patch) {
    const data = this._read();
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    data.items[idx] = { ...data.items[idx], ...patch };
    await this._write(data);
    return data.items[idx];
  }

  async remove(id) {
    const data = this._read();
    const before = data.items.length;
    data.items = data.items.filter((i) => i.id !== id);
    await this._write(data);
    return data.items.length < before;
  }
}

module.exports = JsonStore;
