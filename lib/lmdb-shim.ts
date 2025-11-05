export function getLmdb(): any {
  try {
    // attempt to require the real native module
    // require is used at runtime so this module doesn't fail to import at load time
    // when native bindings are missing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node-lmdb')
  } catch (e) {
    console.warn('node-lmdb native module failed to load; falling back to in-memory shim. Set DISABLE_NODE_LMDB=true to silence this.')

    // provide a small in-memory shim implementing the minimal API used by the app
    class Txn {
      private store: Map<string, string>
      constructor(store: Map<string, string>) {
        this.store = store
      }
      putString(_dbi: any, key: string, value: string) {
        this.store.set(key, value)
      }
      getString(_dbi: any, key: string) {
        return this.store.get(key) ?? null
      }
      commit() {}
      abort() {}
    }

    class Cursor {
      private keys: string[]
      private idx: number
      private store: Map<string, string>
      constructor(_txn: any, dbi: any, _opts?: any) {
        this.store = dbi._store
        this.keys = Array.from(this.store.keys())
        this.keys.sort()
        this.idx = -1
      }
      goToKey(key: string) {
        const i = this.keys.indexOf(key)
        if (i === -1) return false
        this.idx = i
        return this.keys[this.idx]
      }
      goToFirst() {
        if (this.keys.length === 0) return false
        this.idx = 0
        return this.keys[this.idx]
      }
      goToNext() {
        if (this.idx + 1 >= this.keys.length) return false
        this.idx++
        return this.keys[this.idx]
      }
      getCurrentString() {
        if (this.idx < 0 || this.idx >= this.keys.length) return null
        const key = this.keys[this.idx]
        return this.store.get(key) ?? null
      }
      close() {}
    }

    class Env {
      constructor() {
        ;(this as any)._pathStores = (this as any)._pathStores || new Map()
      }
      open(opts: any) {
        const path = opts.path || 'default'
        if (!(this as any)._pathStores.has(path)) {
          ;(this as any)._pathStores.set(path, new Map())
        }
      }
      openDbi(opts: any) {
        const path = process.cwd()
        if (!(this as any)._pathStores.has(path)) {
          ;(this as any)._pathStores.set(path, new Map())
        }
        const stores = (this as any)._pathStores.get(path)
        const dbName = opts.name || 'default'
        if (!stores.has(dbName)) stores.set(dbName, new Map())
        const store = stores.get(dbName)
        const dbi: any = { name: dbName, _store: store }
        return dbi
      }
      beginTxn(opts?: any) {
        const path = process.cwd()
        const stores = (this as any)._pathStores.get(path)
        const store = stores && stores.size ? stores.values().next().value : new Map()
        return new Txn(store)
      }
    }

    return { Env, Cursor }
  }
}
