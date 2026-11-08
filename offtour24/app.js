'use strict';
const S = { agencies: [], tours: [], bookings: [] };
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const en = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const nf = n => Number(n || 0).toLocaleString('fa-IR');
const df = d => d ? new Date(d).toLocaleDateString('fa-IR') : '—';
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const getAg = id => S.agencies.find(a => a.id === id);
const byNew = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
const empty = m => `<div class="empty">${m}</div>`;
const head = (t, s, a = '') => `<div class="head"><div><h1>${t}</h1><p>${s}</p></div><div>${a}</div></div>`;

async function load() { [S.agencies, S.tours, S.bookings] = await Promise.all(DB.stores.map(DB.all)); }
async function refresh() { await load(); route(); }
function toast(m, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 3200); }

/* ---------- Modal ---------- */
function closeModal() { document.querySelector('.overlay')?.remove(); }
function modal(title, body, onSave, wide) {
  closeModal();
  const m = document.createElement('div'); m.className = 'overlay';
  m.innerHTML = `<form class="modal${wide ? ' wide' : ''}"><header><h3>${title}</h3><button type="button" class="x" data-act="close">✕</button></header><div class="mbody">${body}</div><footer><button class="btn">ذخیره</button><button class="btn ghost" type="button" data-act="close">انصراف</button></footer></form>`;
  document.body.append(m);
  const f = $('form', m);
  f.onsubmit = async e => {
    e.preventDefault();
    try { if (await onSave(new FormData(f), f) !== false) closeModal(); }
    catch (x) { console.error(x); toast('خطا: ' + x.message, 1); }
  };
  return f;
}
const fld = (l, n, v = '', a = '', cls = '') => `<div class="${cls}"><label>${l}</label><input name="${n}" value="${esc(v)}" ${a}></div>`;

/* ---------- Agencies ---------- */
function openAgency(a) {
  a = a || {};
  modal(a.id ? 'ویرایش آژانس' : 'افزودن آژانس', `
    ${fld('نام آژانس *', 'name', a.name, 'required')}
    ${fld('شناسه اختصاصی * (مثال: AG101)', 'code', a.code, 'required class="ltr" maxlength="20" placeholder="AG101"')}
    ${fld('نام مالک / مسئول', 'owner', a.owner)}
    ${fld('کد مجوز / دروازه', 'license', a.license, 'class="ltr"')}
    ${fld('شماره تماس اول', 'phone1', a.phone1, 'inputmode="tel"')}
    ${fld('شماره تماس دوم', 'phone2', a.phone2, 'inputmode="tel"')}
    ${fld('شماره تماس سوم', 'phone3', a.phone3, 'inputmode="tel"')}
    ${fld('شماره بیمه', 'insurance', a.insurance)}
    <div class="full"><label>آدرس کامل</label><textarea name="address" rows="2">${esc(a.address)}</textarea></div>
    <div class="full"><label>توضیحات و مشخصات تکمیلی</label><textarea name="notes" rows="3">${esc(a.notes)}</textarea></div>`,
  async fd => {
    const o = Object.fromEntries(fd); const code = en(o.code).trim().toUpperCase();
    if (!o.name.trim()) { toast('نام آژانس الزامی است', 1); return false; }
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) { toast('شناسه فقط شامل حروف انگلیسی، عدد، - و _ باشد', 1); return false; }
    if (S.agencies.some(x => x.code === code && x.id !== a.id)) { toast('این شناسه قبلاً برای آژانس دیگری ثبت شده است', 1); return false; }
    const rec = { ...a, ...o, code, id: a.id || uid('ag_'), createdAt: a.createdAt || Date.now() };
    await DB.put('agencies', rec);
    if (a.id && a.code !== code) for (const t of S.tours.filter(t => t.agencyId === a.id)) await DB.put('tours', { ...t, agencyCode: code });
    toast(a.id ? 'آژانس ویرایش شد' : 'آژانس ثبت شد'); await refresh();
  });
}
async function delAgency(id) {
  const a = getAg(id), ts = S.tours.filter(t => t.agencyId === id);
  if (!confirm(`آژانس «${a.name}» ${ts.length ? 'و ' + nf(ts.length) + ' تور آن ' : ''}حذف شود؟`)) return;
  for (const t of ts) await DB.del('tours', t.id);
  await DB.del('agencies', id); toast('آژانس حذف شد');
  if (location.hash.startsWith('#/agency/')) location.hash = '#/agencies'; else await refresh();
}
const agencyCard = a => `<div class="card"><div class="in">
  <div><span class="code">${esc(a.code)}</span></div><h4>${esc(a.name)}</h4>
  <div class="mut">👤 ${esc(a.owner) || '—'}</div><div class="mut">📞 ${[a.phone1, a.phone2, a.phone3].filter(Boolean).map(esc).join(' ، ') || '—'}</div>
  <div class="mut">🧳 ${nf(S.tours.filter(t => t.agencyId === a.id).length)} تور</div>
  <div class="acts"><a class="btn sm" href="#/agency/${a.id}">مشاهده</a><button class="btn sm ghost" data-act="edit-agency" data-id="${a.id}">ویرایش</button><button class="btn sm red" data-act="del-agency" data-id="${a.id}">حذف</button></div></div></div>`;

function vAgencies() {
  $('#main').innerHTML = head('آژانس‌ها', 'مدیریت آژانس‌های ثبت‌شده', '<button class="btn" data-act="add-agency">+ آژانس جدید</button>') +
    `<div class="bar"><input id="q" placeholder="جست‌وجو: نام، شناسه یا شماره تماس..."></div><div id="list" class="grid"></div>`;
  const draw = () => {
    const q = en($('#q').value).trim().toLowerCase();
    const r = S.agencies.filter(a => en([a.name, a.code, a.phone1, a.phone2, a.phone3].join(' ')).toLowerCase().includes(q)).sort(byNew);
    $('#list').innerHTML = r.map(agencyCard).join('') || empty('آژانسی یافت نشد');
  };
  $('#q').oninput = draw; draw();
}
function vAgency(id) {
  const a = getAg(id); if (!a) { location.hash = '#/agencies'; return; }
  const i = (l, v) => `<div><small>${l}</small>${esc(v) || '—'}</div>`;
  $('#main').innerHTML = head(`${esc(a.name)} <span class="code">${esc(a.code)}</span>`, 'جزئیات آژانس و تورهای آن',
    `<button class="btn" data-act="add-tour" data-id="${a.id}">+ تور جدید برای این آژانس</button> <button class="btn ghost" data-act="edit-agency" data-id="${a.id}">ویرایش</button> <button class="btn red" data-act="del-agency" data-id="${a.id}">حذف</button>`) +
    `<div class="info">${i('مالک / مسئول', a.owner)}${i('تماس اول', a.phone1)}${i('تماس دوم', a.phone2)}${i('تماس سوم', a.phone3)}${i('کد مجوز', a.license)}${i('شماره بیمه', a.insurance)}${i('آدرس', a.address)}${i('توضیحات', a.notes)}</div>
    <h3 style="margin-bottom:12px">تورهای این آژانس (${nf(S.tours.filter(t => t.agencyId === id).length)})</h3><div class="grid">${S.tours.filter(t => t.agencyId === id).sort(byNew).map(t => tourCard(t, 0)).join('') || empty('هنوز توری برای این آژانس ثبت نشده')}</div>`;
}

/* ---------- Tours ---------- */
const imgFile = f => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => { const i = new Image(); i.onload = () => { const k = Math.min(1, 1200 / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * k; c.height = i.height * k; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .75)); }; i.onerror = () => no(new Error('تصویر معتبر نیست')); i.src = r.result; };
  r.onerror = no; r.readAsDataURL(f);
});
function openTour(t, pre) {
  if (!S.agencies.length) { toast('ابتدا یک آژانس ثبت کنید', 1); location.hash = '#/agencies'; return; }
  t = t || {}; const tmp = { image: t.image || '', gallery: [...(t.gallery || [])] }, sel = t.agencyId || pre || '';
  const f = modal(t.id ? 'ویرایش تور' : 'افزودن تور', `
    ${fld('نام تور *', 'name', t.name, 'required')}
    <div><label>آژانس * <span class="code" id="cs"></span></label><select name="agencyId" required><option value="">انتخاب کنید...</option>${S.agencies.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
    ${fld('مقصد *', 'destination', t.destination, 'required')}
    <div><label>وضعیت</label><select name="status"><option value="active">فعال</option><option value="inactive" ${t.status === 'inactive' ? 'selected' : ''}>غیرفعال</option></select></div>
    ${fld('تاریخ شروع', 'start', t.start, 'type="date"')}${fld('تاریخ پایان', 'end', t.end, 'type="date"')}
    ${fld('قیمت (تومان)', 'price', t.price, 'type="number" min="0"')}${fld('ظرفیت', 'capacity', t.capacity, 'type="number" min="0"')}
    ${fld('ظرفیت باقی‌مانده', 'remaining', t.remaining, 'type="number" min="0" placeholder="پیش‌فرض: برابر ظرفیت"')}
    ${fld('امکانات (با ویرایگول جدا کنید)', 'features', t.features, 'placeholder="هتل ۵ ستاره، ترانسفر، بیمه"')}
    <div class="full"><label>تصویر اصلی</label><div id="mi" class="thumbs"></div><input type="file" id="fm" accept="image/*" hidden><button type="button" class="btn sm ghost" id="bm">انتخاب / تغییر تصویر</button></div>
    <div class="full"><label>تصاویر بیشتر</label><div id="gl" class="thumbs"></div><input type="file" id="fg" accept="image/*" multiple hidden><button type="button" class="btn sm ghost" id="bg">افزودن تصاویر</button></div>
    <div class="full"><label>توضیحات کامل</label><textarea name="description" rows="4">${esc(t.description)}</textarea></div>`,
  async fd => {
    const o = Object.fromEntries(fd), a = getAg(o.agencyId);
    if (!a) { toast('آژانس را انتخاب کنید', 1); return false; }
    if (o.start && o.end && o.end < o.start) { toast('تاریخ پایان قبل از شروع است', 1); return false; }
    const cap = +o.capacity || 0, rem = o.remaining === '' ? cap : +o.remaining;
    if (rem > cap) { toast('ظرفیت باقی‌مانده بیشتر از ظرفیت کل است', 1); return false; }
    await DB.put('tours', { ...t, ...o, id: t.id || uid('tr_'), agencyCode: a.code, price: +o.price || 0, capacity: cap, remaining: rem, image: tmp.image, gallery: tmp.gallery, createdAt: t.createdAt || Date.now() });
    toast(t.id ? 'تور ویرایش شد' : 'تور ثبت شد'); await refresh();
  }, 1);
  const th = (s, k) => `<div class="th"><img src="${s}"><button type="button" data-rm="${k}">✕</button></div>`;
  const draw = () => { $('#mi', f).innerHTML = tmp.image ? th(tmp.image, 'main') : '<span class="mut">تصویری انتخاب نشده</span>'; $('#gl', f).innerHTML = tmp.gallery.map((s, i) => th(s, i)).join(''); };
  const code = () => { $('#cs', f).textContent = getAg(f.agencyId.value)?.code || ''; };
  draw(); code(); f.agencyId.onchange = code;
  $('#bm', f).onclick = () => $('#fm', f).click(); $('#bg', f).onclick = () => $('#fg', f).click();
  $('#fm', f).onchange = async e => { try { if (e.target.files[0]) tmp.image = await imgFile(e.target.files[0]); draw(); } catch (x) { toast(x.message, 1); } e.target.value = ''; };
  $('#fg', f).onchange = async e => { try { for (const x of e.target.files) tmp.gallery.push(await imgFile(x)); draw(); } catch (x) { toast(x.message, 1); } e.target.value = ''; };
  f.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; b.dataset.rm === 'main' ? tmp.image = '' : tmp.gallery.splice(+b.dataset.rm, 1); draw(); });
}
async function delTour(id) { const t = S.tours.find(x => x.id === id); if (!confirm(`تور «${t.name}» حذف شود؟`)) return; await DB.del('tours', id); toast('تور حذف شد'); await refresh(); }
async function toggleTour(id) { const t = S.tours.find(x => x.id === id); await DB.put('tours', { ...t, status: t.status === 'active' ? 'inactive' : 'active' }); await refresh(); }
const tourCard = (t, showAg = 1) => `<div class="card"><div class="img">${t.image ? `<img src="${t.image}" alt="">` : '🧳'}</div><div class="in">
  <div><span class="badge ${t.status === 'active' ? '' : 'off'}">${t.status === 'active' ? 'فعال' : 'غیرفعال'}</span> ${showAg ? `<a class="code" href="#/agency/${t.agencyId}" style="text-decoration:none">${esc(t.agencyCode)}</a>` : ''}</div>
  <h4>${esc(t.name)}</h4><div class="mut">📍 ${esc(t.destination)}</div><div class="mut">📅 ${df(t.start)} تا ${df(t.end)}</div>
  <div class="mut">💰 ${nf(t.price)} تومان · 👥 ${nf(t.remaining)} از ${nf(t.capacity)} نفر باقی‌مانده</div>
  ${t.features ? `<div class="mut">✔ ${esc(t.features)}</div>` : ''}
  <div class="acts"><button class="btn sm ghost" data-act="edit-tour" data-id="${t.id}">ویرایش</button><button class="btn sm ghost" data-act="toggle-tour" data-id="${t.id}">${t.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button><button class="btn sm red" data-act="del-tour" data-id="${t.id}">حذف</button></div></div></div>`;

function vTours() {
  const dests = [...new Set(S.tours.map(t => t.destination).filter(Boolean))];
  $('#main').innerHTML = head('تورها', 'مدیریت و فیلتر تورها', '<button class="btn" data-act="add-tour">+ تور جدید</button>') +
    `<div class="bar"><input id="q" placeholder="جست‌وجوی نام تور..."><select id="fa"><option value="">همه آژانس‌ها</option>${S.agencies.map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select>
    <select id="fd"><option value="">همه مقصدها</option>${dests.map(d => `<option>${esc(d)}</option>`).join('')}</select>
    <select id="fs"><option value="">همه وضعیت‌ها</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></div><div id="list" class="grid"></div>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), a = $('#fa').value, d = $('#fd').value, s = $('#fs').value;
    const r = S.tours.filter(t => t.name.toLowerCase().includes(q) && (!a || t.agencyId === a) && (!d || t.destination === d) && (!s || t.status === s)).sort(byNew);
    $('#list').innerHTML = r.map(t => tourCard(t)).join('') || empty('توری یافت نشد');
  };
  ['q', 'fa', 'fd', 'fs'].forEach(i => $('#' + i).oninput = draw); draw();
}

/* ---------- Dashboard ---------- */
function vDash() {
  const act = S.tours.filter(t => t.status === 'active').length;
  const st = (n, l) => `<div class="stat"><b>${nf(n)}</b><span>${l}</span></div>`;
  $('#main').innerHTML = head('داشبورد', 'خلاصه وضعیت آژانس‌ها و تورها') +
    `<div class="stats">${st(S.agencies.length, 'کل آژانس‌ها')}${st(S.tours.length, 'کل تورها')}${st(act, 'تورهای فعال')}${st(S.tours.length - act, 'تورهای غیرفعال')}</div>
    <div class="shortcuts"><button class="btn" data-act="add-agency">+ افزودن آژانس</button><button class="btn" data-act="add-tour">+ افزودن تور</button><a class="btn ghost" href="#/agencies">مشاهده آژانس‌ها</a><a class="btn ghost" href="#/tours">مشاهده تورها</a></div>
    <div class="cols"><div class="panel"><h3>آخرین آژانس‌ها</h3>${[...S.agencies].sort(byNew).slice(0, 5).map(a => `<div class="row"><div><b>${esc(a.name)}</b><small>${esc(a.owner) || ''}</small></div><a class="code" href="#/agency/${a.id}" style="text-decoration:none">${esc(a.code)}</a></div>`).join('') || '<p class="mut">موردی نیست</p>'}</div>
    <div class="panel"><h3>آخرین تورها</h3>${[...S.tours].sort(byNew).slice(0, 5).map(t => `<div class="row"><div><b>${esc(t.name)}</b><small>${esc(t.destination)}</small></div><span class="code">${esc(t.agencyCode)}</span></div>`).join('') || '<p class="mut">موردی نیست</p>'}</div></div>`;
}

/* ---------- Bookings (ساختار آماده برای آینده) ---------- */
function vBookings() {
  $('#main').innerHTML = head('رزروها', 'آماده‌سازی برای اتصال به سایت اصلی') +
    `<div class="panel"><p>این بخش فعلاً فقط ساختار اولیه است. در نسخه نهایی، هر رزرو با شناسه تور ثبت می‌شود، شناسه آژانس از روی تور استخراج می‌شود و رزرو به آژانس مربوطه متصل می‌گردد.</p>
    <table style="margin-top:14px"><thead><tr><th>شناسه رزرو</th><th>تور</th><th>شناسه آژانس</th><th>مسافر</th><th>تعداد</th><th>ارسال به بله</th></tr></thead>
    <tbody>${S.bookings.map(b => `<tr><td>${esc(b.id)}</td><td>${esc(b.tourId)}</td><td><span class="code">${esc(b.agencyCode)}</span></td><td>${esc(b.name)}</td><td>${nf(b.count)}</td><td>${b.botSent ? 'ارسال شده' : 'در انتظار'}</td></tr>`).join('') || '<tr><td colspan="6" class="mut" style="text-align:center">هنوز رزروی دریافت نشده است</td></tr>'}</tbody></table>
    <p class="mut" style="margin-top:14px">ساختار رکورد رزرو: id, tourId, agencyId, agencyCode, name, phone, count, status, botSent, createdAt</p></div>`;
}

/* ---------- Backup ---------- */
function vBackup() {
  $('#main').innerHTML = head('پشتیبان‌گیری', 'خروجی و بازیابی اطلاعات') +
    `<div class="cols"><div class="panel"><h3>خروجی JSON</h3><p class="mut" style="margin-bottom:12px">شامل آژانس‌ها، تورها و تصاویر</p><button class="btn" data-act="export">دانلود پشتیبان</button></div>
    <div class="panel"><h3>بازیابی از فایل</h3><p class="mut" style="margin-bottom:12px">اطلاعات فعلی با محتوای فایل جایگزین می‌شود</p><input type="file" id="imp" accept=".json,application/json"></div>
    <div class="panel"><h3>پاک‌سازی کامل</h3><p class="mut" style="margin-bottom:12px">حذف تمام داده‌های آزمایشی</p><button class="btn red" data-act="reset">حذف همه اطلاعات</button></div></div>`;
  $('#imp').onchange = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(d.agencies) || !Array.isArray(d.tours)) throw new Error('فایل پشتیبان معتبر نیست');
      if (!confirm('اطلاعات فعلی حذف و با فایل جایگزین شود؟')) return;
      for (const s of DB.stores) await DB.clear(s);
      for (const s of DB.stores) for (const o of d[s] || []) await DB.put(s, o);
      toast('اطلاعات بازیابی شد'); await refresh();
    } catch (x) { toast(x.message, 1); }
  };
}
function exportData() {
  const d = { version: 1, exportedAt: new Date().toISOString(), agencies: S.agencies, tours: S.tours, bookings: S.bookings };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
  a.download = 'panel-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(a.href); toast('فایل پشتیبان دانلود شد');
}

/* ---------- Router & events ---------- */
const routes = { dashboard: vDash, agencies: vAgencies, agency: vAgency, tours: vTours, bookings: vBookings, backup: vBackup };
function route() {
  const [p, id] = (location.hash.slice(2) || 'dashboard').split('/');
  (routes[p] || vDash)(id);
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (p === 'agency' ? 'agencies' : p)));
  $('#side').classList.remove('open');
}
document.addEventListener('click', async e => {
  if (e.target.classList.contains('overlay')) return closeModal();
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id } = b.dataset;
  try {
    if (act === 'close') closeModal();
    else if (act === 'menu') $('#side').classList.toggle('open');
    else if (act === 'add-agency') openAgency();
    else if (act === 'edit-agency') openAgency(getAg(id));
    else if (act === 'del-agency') await delAgency(id);
    else if (act === 'add-tour') openTour(null, id);
    else if (act === 'edit-tour') openTour(S.tours.find(t => t.id === id));
    else if (act === 'del-tour') await delTour(id);
    else if (act === 'toggle-tour') await toggleTour(id);
    else if (act === 'export') exportData();
    else if (act === 'reset') { if (confirm('همه آژانس‌ها و تورها برای همیشه حذف شوند؟')) { for (const s of DB.stores) await DB.clear(s); toast('همه اطلاعات حذف شد'); await refresh(); } }
  } catch (x) { console.error(x); toast('خطا: ' + x.message, 1); }
});
window.addEventListener('hashchange', route);
(async () => {
  try { await DB.open(); await load(); route(); }
  catch (x) { $('#main').innerHTML = empty('خطا در راه‌اندازی IndexedDB: ' + esc(x.message) + '<br>پنل را با مرورگر به‌روز (Chrome/Edge/Firefox) باز کنید.'); }
})();
