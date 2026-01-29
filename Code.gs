/**
 * ==========================================
 * 1. KONFIGURASI GLOBAL
 * ==========================================
 */
const CONFIG = {
  SHEET_NAME: {
    PRODUK: "DataProduk",
    MASUK: "ProdukMasuk",
    KELUAR: "ProdukKeluar",
    OPNAME: "StokOpname",
    GUDANG: "DataGudang"
  },
  COL_PRODUK: { KODE: 0, NAMA: 1, JENIS: 2, SATUAN: 3, STOK_MIN: 4, STATUS: 5, STOK: 6 },
  COL_MASUK: { TANGGAL: 0, KODE: 1, NAMA: 2, JENIS: 3, SATUAN: 4, JUMLAH: 5, GUDANG: 6 },
  COL_KELUAR: { TANGGAL: 0, KODE: 1, NAMA: 2, JENIS: 3, SATUAN: 4, GUDANG: 5, PJ: 6, JUMLAH: 7 },
  COL_OPNAME: { ID: 0, TANGGAL: 1, KODE: 2, NAMA: 3, SISTEM: 4, FISIK: 5, SELISIH: 6, STATUS: 7, PETUGAS: 8, CATATAN: 9 }
};

/**
 * ==========================================
 * 2. ROUTING & NAVIGASI
 * ==========================================
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Main')
    .evaluate().setTitle("Inventory System Pro")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loadPageContent(pageName) {
  const pageMap = {
    'dashboard': 'Dashboard', 'produk': 'Produk',
    'barang-masuk': 'BarangMasuk', 'barang-keluar': 'BarangKeluar',
    'stok-opname': 'StokOpname', 'laporan-opname': 'LaporanOpname',
    'laporan-barang': 'LaporanPerBarang'
  };
  try { return HtmlService.createHtmlOutputFromFile(pageMap[pageName] || 'Dashboard').getContent(); } 
  catch (e) { return `<div class="p-4 text-danger">Halaman '${pageName}' belum dibuat.</div>`; }
}
function getAppUrl() { return ScriptApp.getService().getUrl(); }

/**
 * ==========================================
 * 3. TRANSAKSI (MASUK & KELUAR)
 * ==========================================
 */
function addBarangMasuk(tgl, kode, jml, gdg) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { success: false, message: "Busy" }; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pSheet = ss.getSheetByName(CONFIG.SHEET_NAME.PRODUK);
    const mSheet = ss.getSheetByName(CONFIG.SHEET_NAME.MASUK);
    
    const produk = findProduct(pSheet, kode);
    if (!produk) throw new Error("Produk tidak ditemukan");

    mSheet.appendRow([tgl, produk.val[CONFIG.COL_PRODUK.KODE], produk.val[CONFIG.COL_PRODUK.NAMA], 
      produk.val[CONFIG.COL_PRODUK.JENIS], produk.val[CONFIG.COL_PRODUK.SATUAN], jml, gdg]);

    updateStock(pSheet, produk.row, Number(produk.val[CONFIG.COL_PRODUK.STOK]) + Number(jml));
    return { success: true, message: "Stok berhasil ditambahkan" };
  } catch (e) { return { success: false, message: e.message }; } finally { lock.releaseLock(); }
}

function addBarangKeluar(tgl, kode, jml, gdg, pj) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { success: false, message: "Busy" }; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pSheet = ss.getSheetByName(CONFIG.SHEET_NAME.PRODUK);
    const kSheet = ss.getSheetByName(CONFIG.SHEET_NAME.KELUAR);
    
    const produk = findProduct(pSheet, kode);
    if (!produk) throw new Error("Produk tidak ditemukan");
    
    const stokLama = Number(produk.val[CONFIG.COL_PRODUK.STOK]);
    if (stokLama < Number(jml)) return { success: false, message: `Stok kurang (Sisa: ${stokLama})` };

    kSheet.appendRow([tgl, produk.val[CONFIG.COL_PRODUK.KODE], produk.val[CONFIG.COL_PRODUK.NAMA], 
      produk.val[CONFIG.COL_PRODUK.JENIS], produk.val[CONFIG.COL_PRODUK.SATUAN], gdg, pj, jml]);

    updateStock(pSheet, produk.row, stokLama - Number(jml));
    return { success: true, message: "Barang berhasil dikeluarkan" };
  } catch (e) { return { success: false, message: e.message }; } finally { lock.releaseLock(); }
}

/**
 * ==========================================
 * 4. STOK OPNAME
 * ==========================================
 */
function simpanOpname(data) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { success: false, message: "Busy" }; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const oSheet = ss.getSheetByName(CONFIG.SHEET_NAME.OPNAME);
    const pSheet = ss.getSheetByName(CONFIG.SHEET_NAME.PRODUK);
    
    const produk = findProduct(pSheet, data.kode);
    const stokSistem = produk ? produk.val[CONFIG.COL_PRODUK.STOK] : 0;
    const selisih = Number(data.fisik) - Number(stokSistem);
    const idOpname = 'OPN-' + new Date().getTime();
    
    oSheet.appendRow([
      idOpname, data.tgl, data.kode, data.nama, stokSistem, data.fisik,
      selisih, data.sesuaikan ? "Disesuaikan" : "Hanya Cek", data.petugas, data.catatan
    ]);

    if (data.sesuaikan && produk) {
      updateStock(pSheet, produk.row, Number(data.fisik));
    }
    return { success: true, message: "Opname tersimpan" };
  } catch (e) { return { success: false, message: e.message }; } finally { lock.releaseLock(); }
}

function getDataOpname(page, limit) {
  return getPaginatedData(CONFIG.SHEET_NAME.OPNAME, null, null, page, limit, '');
}

/**
 * ==========================================
 * 5. LAPORAN & READ DATA
 * ==========================================
 */
function getProdukByBarcode(kode) {
  const pSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME.PRODUK);
  const p = findProduct(pSheet, kode);
  if (!p) return null;
  return {
    kode: p.val[CONFIG.COL_PRODUK.KODE], nama: p.val[CONFIG.COL_PRODUK.NAMA],
    jenis: p.val[CONFIG.COL_PRODUK.JENIS], satuan: p.val[CONFIG.COL_PRODUK.SATUAN],
    stok: Number(p.val[CONFIG.COL_PRODUK.STOK]) || 0
  };
}

function getLaporanKartuStok(kode, tglMulai, tglAkhir) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mSheet = ss.getSheetByName(CONFIG.SHEET_NAME.MASUK);
  const kSheet = ss.getSheetByName(CONFIG.SHEET_NAME.KELUAR);
  
  const mData = mSheet.getRange(2, 1, Math.max(1, mSheet.getLastRow()-1), 7).getValues();
  const kData = kSheet.getRange(2, 1, Math.max(1, kSheet.getLastRow()-1), 8).getValues();
  
  let trans = [];
  const start = new Date(tglMulai); start.setHours(0,0,0,0);
  const end = new Date(tglAkhir); end.setHours(23,59,59,999);
  const search = String(kode).toLowerCase();

  // Stok Awal Logic
  let stokAwal = 0;
  
  // Helper Filter & Calculate
  const process = (rows, isMasuk) => {
    rows.forEach(r => {
      if(String(r[1]).toLowerCase() === search) {
        const tgl = new Date(r[0]);
        const qty = Number(r[isMasuk ? 5 : 7]);
        if (tgl < start) {
          stokAwal += isMasuk ? qty : -qty;
        } else if (tgl <= end) {
          trans.push({
            tgl: Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            tipe: isMasuk ? 'Masuk' : 'Keluar',
            ket: isMasuk ? r[6] : (r[5] + ' (' + r[6] + ')'),
            masuk: isMasuk ? qty : 0,
            keluar: isMasuk ? 0 : qty
          });
        }
      }
    });
  };
  
  process(mData, true);
  process(kData, false);
  trans.sort((a, b) => new Date(a.tgl) - new Date(b.tgl));
  
  // Hitung saldo berjalan
  let saldo = stokAwal;
  const finalData = trans.map(t => {
    saldo += t.masuk - t.keluar;
    t.saldo = saldo;
    return t;
  });
  
  return { stokAwal: stokAwal, data: finalData };
}

/**
 * ==========================================
 * 6. UTILITIES (HELPER)
 * ==========================================
 */
function findProduct(sheet, kode) {
  const data = sheet.getDataRange().getValues();
  const s = String(kode).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][CONFIG.COL_PRODUK.KODE]).trim().toLowerCase() === s) {
      return { row: i + 1, val: data[i] };
    }
  }
  return null;
}

function updateStock(sheet, row, newQty) {
  sheet.getRange(row, CONFIG.COL_PRODUK.STOK + 1).setValue(newQty);
  // Update Status
  const min = Number(sheet.getRange(row, CONFIG.COL_PRODUK.STOK_MIN + 1).getValue());
  sheet.getRange(row, CONFIG.COL_PRODUK.STATUS + 1).setValue(newQty <= min ? "Barang Kosong" : "Tersedia");
}

function getPaginatedData(sName, fVal, fCol, page, limit, search) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sName);
  if (!sheet || sheet.getLastRow() <= 1) return { data: [], currentPage: 1, totalPages: 0 };
  
  const raw = sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).getValues();
  let data = raw.map((r, i) => ({ d: r, idx: i+2 }));
  
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(r => String(r.d[1]).toLowerCase().includes(s) || String(r.d[2]).toLowerCase().includes(s));
  }
  
  data.sort((a, b) => new Date(b.d[0]) - new Date(a.d[0])); // Sort Date Desc
  
  const total = data.length;
  const paged = data.slice((page-1)*limit, page*limit).map(r => {
    if(r.d[0] instanceof Date) r.d[0] = Utilities.formatDate(r.d[0], Session.getScriptTimeZone(), "yyyy-MM-dd");
    r.d.push(r.idx);
    return r.d;
  });
  
  return { data: paged, currentPage: page, totalPages: Math.ceil(total/limit) };
}

function getDataBarangMasuk(f, p, l, s) { return getPaginatedData(CONFIG.SHEET_NAME.MASUK, f, CONFIG.COL_MASUK.GUDANG, p, l, s); }
function getDataBarangKeluar(f, p, l, s) { return getPaginatedData(CONFIG.SHEET_NAME.KELUAR, f, CONFIG.COL_KELUAR.GUDANG, p, l, s); }
function getDashboardData() { return { success: true, data: { greeting: "Selamat Datang", userEmail: Session.getActiveUser().getEmail() }}; } // Placeholder for dashboard
function hapusBarangMasuk(idx) { return "Fitur hapus dinonaktifkan sementara demi keamanan."; } // Simplified
function hapusBarangKeluar(idx) { return "Fitur hapus dinonaktifkan sementara demi keamanan."; } // Simplified
