// A small stand-in for the Supabase client, used in practice mode. It supports
// exactly the calls the admin console makes, against the practice database in
// this browser. Switching to the real backend needs no code change: once
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, the console uses Supabase.

import { loadPracticeDb, savePracticeDb } from '../lib/practiceStore.js';

const PK = { sections: 'slug', site_settings: 'key', staff: 'user_id' };
const USER = { id: 'practice-admin', email: 'practice@localhost' };

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

class Query {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.orders = [];
    this.max = Infinity;
    this.one = false;
    this.head = false;
  }

  select(_cols, opts = {}) {
    if (this.op === 'select') this.head = !!opts.head;
    return this;
  }
  eq(col, val) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col, vals) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  order(col, { ascending = true } = {}) {
    this.orders.push([col, ascending ? 1 : -1]);
    return this;
  }
  limit(n) {
    this.max = n;
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  upsert(payload, { onConflict } = {}) {
    this.op = 'upsert';
    this.payload = payload;
    this.conflict = (onConflict || PK[this.table] || 'id').split(',').map((s) => s.trim());
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }

  async run() {
    const db = await loadPracticeDb();
    const rows = (db[this.table] ||= []);
    const pk = PK[this.table] || 'id';
    const now = new Date().toISOString();
    const audit = (action, row) => (db.audit_log ||= []).unshift({ id: Date.now(), actor_email: USER.email, table_name: this.table, action, row_id: String(row?.[pk] ?? ''), at: now });
    const match = (r) => this.filters.every((f) => f(r));

    if (this.op === 'select') {
      let out = rows.filter(match);
      for (const [col, dir] of [...this.orders].reverse()) {
        out = [...out].sort((a, b) => ((a[col] ?? '') < (b[col] ?? '') ? -dir : (a[col] ?? '') > (b[col] ?? '') ? dir : 0));
      }
      out = out.slice(0, this.max);
      if (this.head) return { data: null, count: out.length, error: null };
      return { data: this.one ? out[0] ?? null : out, count: out.length, error: null };
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const item of list) {
        const keys = this.op === 'upsert' ? this.conflict : [pk];
        const existing = rows.find((r) => keys.every((k) => item[k] !== undefined && r[k] === item[k]));
        if (existing && this.op === 'insert') return { data: null, error: { message: 'duplicate key value' } };
        if (existing) {
          Object.assign(existing, item, { updated_at: now });
          audit('UPDATE', existing);
        } else {
          const row = { ...(pk === 'id' ? { id: uid() } : {}), created_at: now, updated_at: now, published: true, ...item };
          rows.push(row);
          audit('INSERT', row);
        }
      }
      savePracticeDb(db);
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      rows.filter(match).forEach((r) => {
        Object.assign(r, this.payload, { updated_at: now });
        audit('UPDATE', r);
      });
      savePracticeDb(db);
      return { data: null, error: null };
    }

    if (this.op === 'delete') {
      const keep = rows.filter((r) => !match(r));
      rows.filter(match).forEach((r) => audit('DELETE', r));
      db[this.table] = keep;
      savePracticeDb(db);
      return { data: null, error: null };
    }
    return { data: null, error: { message: 'Unsupported in practice mode' } };
  }
}

export function createPracticeClient() {
  const listeners = new Set();
  let signedIn = true;
  const session = () => (signedIn ? { access_token: 'practice', user: USER } : null);
  const emit = (event) => listeners.forEach((cb) => cb(event, session()));

  return {
    practice: true,
    from: (table) => new Query(table),
    auth: {
      getSession: async () => ({ data: { session: session() } }),
      onAuthStateChange: (cb) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: async () => {
        signedIn = true;
        setTimeout(() => emit('SIGNED_IN'), 0);
        return { data: { session: session() }, error: null };
      },
      signOut: async () => {
        signedIn = false;
        setTimeout(() => emit('SIGNED_OUT'), 0);
        return { error: null };
      },
      updateUser: async () => ({ data: {}, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: {}, error: null }),
        remove: async () => ({ data: {}, error: null }),
      }),
    },
  };
}
