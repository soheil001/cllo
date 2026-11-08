'use strict';
/* لایه ذخیره‌سازی. هر store معادل یک جدول MySQL است؛ در آینده فقط همین فایل با فراخوانی API/PHP جایگزین می‌شود. */
const DB = {
  db: null,
  stores: ['agencies', 'tours', 'bookings'],
  open() {
    return new Promise((ok, no) => {
      const r = indexedDB.open('agency_panel', 1);
      r.onupgradeneeded = () => DB.stores.forEach(s => r.result.createObjectStore(s, { keyPath: 'id' }));
      r.onsuccess = () => { DB.db = r.result; ok(); };
      r.onerror = () => no(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((ok, no) => {
      const t = DB.db.transaction(store, mode);
      const q = fn(t.objectStore(store));
      t.oncomplete = () => ok(q && q.result);
      t.onerror = t.onabort = () => no(t.error);
    });
  },
  all: s => DB.tx(s, 'readonly', st => st.getAll()),
  put: (s, o) => DB.tx(s, 'readwrite', st => st.put(o)),
  del: (s, id) => DB.tx(s, 'readwrite', st => st.delete(id)),
  clear: s => DB.tx(s, 'readwrite', st => st.clear())
};
