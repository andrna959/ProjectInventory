var ss = SpreadsheetApp.getActiveSpreadsheet();
var produkSheet = ss.getSheetByName("DataProduk");
var masukSheet = ss.getSheetByName("ProdukMasuk");
var keluarSheet = ss.getSheetByName("ProdukKeluar");

// Ganti fungsi doGet(e) Anda dengan versi ini
function doGet(e) {
  var page = e.parameter.page || 'dashboard';
  var template;
  
  switch(page.toLowerCase()) {
    case 'produk':
      template = HtmlService.createTemplateFromFile('Produk');
      break;
    case 'barang-masuk':
      template = HtmlService.createTemplateFromFile('BarangMasuk');
      break;
    case 'barang-keluar':
      template = HtmlService.createTemplateFromFile('BarangKeluar');
      break;
    case 'stok-opname':
      template = HtmlService.createTemplateFromFile('StokOpname');
      break;
    case 'laporan-opname':
      template = HtmlService.createTemplateFromFile('LaporanOpname');
      break;
    case 'laporan-barang':
      template = HtmlService.createTemplateFromFile('LaporanPerBarang');
      break;

    default:
      page = 'dashboard';
      template = HtmlService.createTemplateFromFile('Dashboard');
      break;
  }
  
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.page = page; 
  
  var htmlOutput = template.evaluate();
  htmlOutput.setTitle("Aplikasi Inventory");
  htmlOutput.setFaviconUrl("https://cdn-icons-png.flaticon.com/128/3500/3500823.png");

  return htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Fungsi untuk mendapatkan URL aplikasi
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

// Fungsi untuk menampilkan halaman produk
function showProdukPage() {
  var html = HtmlService.createHtmlOutputFromFile('Produk')
      .setTitle('Manajemen Produk')
      .setWidth(800)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manajemen Produk');
}

// Fungsi untuk menampilkan halaman barang masuk
function showBarangMasukPage() {
  var html = HtmlService.createHtmlOutputFromFile('BarangMasuk')
      .setTitle('Barang Masuk')
      .setWidth(800)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Barang Masuk');
}

// Fungsi untuk menampilkan halaman barang keluar
function showBarangKeluarPage() {
  var html = HtmlService.createHtmlOutputFromFile('BarangKeluar')
      .setTitle('Barang Keluar')
      .setWidth(800)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Barang Keluar');
}

// FUNGSI getDataProduk 
function getDataProduk(filterStatus = '', page = 1, pageSize = 10, searchTerm = '') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DataProduk");
    
    if (!sheet) {
      throw new Error("Sheet DataProduk tidak ditemukan");
    }
    
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return { data: [], currentPage: 1, totalPages: 0, totalProduk: 0 };
    }
    
    // Ambil semua data terlebih dahulu
    let allData = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    
    // 1. Terapkan filter PENCARIAN terlebih dahulu
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      allData = allData.filter(row => {
        // Cari di Kode Barang (indeks 0) atau Nama Barang (indeks 1)
        const kodeBarang = String(row[0] || '').toLowerCase();
        const namaBarang = String(row[1] || '').toLowerCase();
        return kodeBarang.includes(lowerCaseSearchTerm) || namaBarang.includes(lowerCaseSearchTerm);
      });
    }

    // 2. Terapkan filter STATUS setelah pencarian
    if (filterStatus) {
      allData = allData.filter(row => row[5] === filterStatus);
    }
    
    const totalProduk = allData.length;
    const totalPages = Math.ceil(totalProduk / pageSize) || 1;
    
    // 3. Lakukan paginasi pada data yang sudah difilter
    const startIndex = (page - 1) * pageSize;
    const pagedData = allData.slice(startIndex, startIndex + pageSize);
    
    return { 
      data: pagedData,
      currentPage: Number(page),
      totalPages: totalPages,
      totalProduk: totalProduk
    };
    
  } catch (error) {
    console.error('Error in getDataProduk:', error);
    return { error: error.message };
  }
}

// Fungsi untuk menambahkan produk baru
function addProduk(kode, nama, jenis, satuan, stokMinimal) {
  var stok = 0;
  var reorderStatus = stok <= stokMinimal ? "Barang Kosong" : "Tersedia";
  
  produkSheet.appendRow([kode, nama, jenis, satuan, stokMinimal, reorderStatus, stok]);
  return "Produk berhasil ditambahkan";
}

// Fungsi untuk mencatat barang masuk
function addBarangMasuk(tglMasuk, kodeBarang, jumlah, gudang) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const produkSheet = ss.getSheetByName("DataProduk");
    const masukSheet = ss.getSheetByName("ProdukMasuk");
    
    // Debug: Log parameter yang diterima
    console.log(`Mencari kode: ${kodeBarang} | Tipe: ${typeof kodeBarang}`);
    
    // Cari data produk dengan case insensitive dan trim whitespace
    const produkData = produkSheet.getDataRange().getValues();
    let produk = null;
    let produkRow = 0;
    
    for (let i = 1; i < produkData.length; i++) {
      const currentKode = produkData[i][0] ? produkData[i][0].toString().trim() : '';
      const searchKode = kodeBarang.toString().trim();
      
      // Debug: Log perbandingan kode
      console.log(`Membandingkan: '${currentKode}' dengan '${searchKode}'`);
      
      if (currentKode.toLowerCase() === searchKode.toLowerCase()) {
        produk = produkData[i];
        produkRow = i + 1;
        break;
      }
    }
    
    if (!produk) {
      // Debug: Log semua kode yang ada untuk troubleshooting
      const allKodes = produkData.slice(1).map(row => row[0] ? row[0].toString().trim() : 'NULL');
      console.log('Semua kode yang ada:', allKodes);
      throw new Error(`Kode '${kodeBarang}' tidak ditemukan dalam database`);
    }
    
    // Debug: Log data produk yang ditemukan
    console.log('Produk ditemukan:', produk);
    
    // Tambahkan ke sheet ProdukMasuk
    masukSheet.appendRow([
      tglMasuk, 
      produk[0], // Gunakan kode dari data produk
      produk[1], // Nama Barang
      produk[2], // Jenis Barang
      produk[3], // Satuan
      jumlah, 
      gudang
    ]);
    
    // Update stok
    const newStok = Number(produk[6]) + Number(jumlah);
    produkSheet.getRange(produkRow, 7).setValue(newStok);
    
    // Update reorder status
    const newStatus = newStok <= produk[4] ? "Barang Kosong" : "Tersedia";
    produkSheet.getRange(produkRow, 6).setValue(newStatus);
    
    return {
      success: true,
      message: `Barang ${produk[1]} berhasil dicatat masuk ke ${gudang}`
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

function addBarangKeluar(tglKeluar, kodeBarang, jumlah, gudang, penanggungJawab) {
  try {
    var produkData = produkSheet.getDataRange().getValues();
    
    var produk = produkData.find(function(row) {
      return row[0] && row[0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase();
    });
    
    if (!produk) {
      return { success: false, message: "Kode barang tidak ditemukan di master data." };
    }
    
    const stokSaatIni = produk[6];
    
    if (Number(stokSaatIni) < Number(jumlah)) {
      return { success: false, message: `Stok tidak mencukupi. Stok saat ini hanya ada ${stokSaatIni}.` };
    }
    
    keluarSheet.appendRow([tglKeluar, kodeBarang, produk[1], produk[2], produk[3], gudang, penanggungJawab, jumlah]);
    
    var rowIndex = produkData.findIndex(function(row) {
      return row[0] && row[0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase();
    }) + 1;
    
    if (rowIndex === 0) throw new Error("Gagal menemukan indeks produk untuk diupdate.");

    var newStok = stokSaatIni - jumlah;
    produkSheet.getRange(rowIndex, 7).setValue(newStok);
    
    var stokMinimal = produk[4];
    var newStatus = newStok <= stokMinimal ? "Barang Kosong" : "Tersedia";
    produkSheet.getRange(rowIndex, 6).setValue(newStatus);
    
    return { success: true, message: "Barang keluar berhasil dicatat." };

  } catch (e) {
    console.error("Error di addBarangKeluar:", e);
    throw new Error("Terjadi kesalahan di server: " + e.message);
  }
}

function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const produkSheet = ss.getSheetByName("DataProduk");
    const masukSheet = ss.getSheetByName("ProdukMasuk");
    const keluarSheet = ss.getSheetByName("ProdukKeluar");
    
    // Validasi sheet
    if (!produkSheet || !masukSheet || !keluarSheet) {
      throw new Error("Sheet tidak ditemukan. Pastikan sheet 'DataProduk', 'ProdukMasuk', dan 'ProdukKeluar' ada.");
    }

    const userEmail = Session.getActiveUser().getEmail();
    const jam = new Date().getHours();
    let sapaan = "";
    if (jam >= 4 && jam < 11) {
      sapaan = "Selamat Pagi";
    } else if (jam >= 11 && jam < 15) {
      sapaan = "Selamat Siang";
    } else if (jam >= 15 && jam < 18) {
      sapaan = "Selamat Sore";
    } else {
      sapaan = "Selamat Malam";
    }


    // Hitung total data (handle kasus sheet kosong)
    const totalProduk = produkSheet.getLastRow() > 1 ? produkSheet.getLastRow() - 1 : 0;
    const totalMasuk = masukSheet.getLastRow() > 1 ? masukSheet.getLastRow() - 1 : 0;
    const totalKeluar = keluarSheet.getLastRow() > 1 ? keluarSheet.getLastRow() - 1 : 0;

    // Data untuk chart transaksi 6 bulan terakhir
    const now = new Date();
    const chartLabels = [];
    const chartMasukData = [];
    const chartKeluarData = [];
    
    // Default values untuk 6 bulan terakhir
    for (let i = 5; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      chartLabels.push(Utilities.formatDate(targetMonth, Session.getScriptTimeZone(), "MMM yyyy"));
      chartMasukData.push(0);
      chartKeluarData.push(0);
    }

    // Isi data aktual jika ada
    if (masukSheet.getLastRow() > 1 && keluarSheet.getLastRow() > 1) {
      const dataMasuk = masukSheet.getRange("A2:A" + masukSheet.getLastRow()).getValues().flat();
      const dataKeluar = keluarSheet.getRange("A2:A" + keluarSheet.getLastRow()).getValues().flat();
      
      for (let i = 5; i >= 0; i--) {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1);
        
        chartMasukData[5-i] = dataMasuk.filter(date => 
          date instanceof Date && date >= targetMonth && date < nextMonth
        ).length;
        
        chartKeluarData[5-i] = dataKeluar.filter(date => 
          date instanceof Date && date >= targetMonth && date < nextMonth
        ).length;
      }
    }

    // Data untuk chart harian bulan ini
    const dailyData = { labels: [], masuk: [], keluar: [] };
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysInMonth = (nextMonth - currentMonth) / (1000 * 60 * 60 * 24);
    
    // Siapkan array untuk setiap hari
    for (let day = 1; day <= daysInMonth; day++) {
      dailyData.labels.push(day.toString());
      dailyData.masuk.push(0);
      dailyData.keluar.push(0);
    }
    
    // Isi data aktual transaksi masuk harian
    if (masukSheet.getLastRow() > 1) {
      const dataMasuk = masukSheet.getRange("A2:A" + masukSheet.getLastRow()).getValues().flat();
      dataMasuk.forEach(date => {
        if (date instanceof Date && date >= currentMonth && date < nextMonth) {
          const day = date.getDate();
          dailyData.masuk[day-1]++;
        }
      });
    }
    
    // Isi data aktual transaksi keluar harian
    if (keluarSheet.getLastRow() > 1) {
      const dataKeluar = keluarSheet.getRange("A2:A" + keluarSheet.getLastRow()).getValues().flat();
      dataKeluar.forEach(date => {
        if (date instanceof Date && date >= currentMonth && date < nextMonth) {
          const day = date.getDate();
          dailyData.keluar[day-1]++;
        }
      });
    }

    // Data untuk chart gudang
    const gudangList = ["Gudang 1", "Gudang 2", "Gudang 3"];
    const gudangData = gudangList.map(() => 0);
    
    if (masukSheet.getLastRow() > 1) {
      const dataGudang = masukSheet.getRange("F2:G" + masukSheet.getLastRow()).getValues();
      dataGudang.forEach(row => {
        const jumlah = Number(row[0]) || 0;
        const gudang = row[1];
        const index = gudangList.indexOf(gudang);
        if (index !== -1) {
          gudangData[index] += jumlah;
        }
      });
    }

    // Data transaksi terakhir (10 terbaru)
    const lastTransactions = [];
    
    // Format tanggal untuk response
    const timeZone = ss.getSpreadsheetTimeZone();
    const formatDate = (date) => date instanceof Date ? 
      Utilities.formatDate(date, timeZone, "yyyy-MM-dd") : "";

    // Gabungkan transaksi masuk dan keluar
    if (masukSheet.getLastRow() > 1) {
      const lastMasuk = masukSheet.getRange(
        Math.max(2, masukSheet.getLastRow() - 9), 1, Math.min(10, masukSheet.getLastRow() - 1), 7
      ).getValues();
      
      lastMasuk.forEach(row => {
        lastTransactions.push({
          tanggal: formatDate(row[0]),
          tipe: 'Masuk',
          kodeBarang: row[1] || '',
          namaBarang: row[2] || '',
          jumlah: row[5] || 0,
          gudang: row[6] || ''
        });
      });
    }
    
    if (keluarSheet.getLastRow() > 1) {
      const lastKeluar = keluarSheet.getRange(
        Math.max(2, keluarSheet.getLastRow() - 9), 1, Math.min(10, keluarSheet.getLastRow() - 1), 8
      ).getValues();
      
      lastKeluar.forEach(row => {
        lastTransactions.push({
          tanggal: formatDate(row[0]),
          tipe: 'Keluar',
          kodeBarang: row[1] || '',
          namaBarang: row[2] || '',
          jumlah: row[7] || 0,
          gudang: row[5] || ''
        });
      });
    }
    
    // Urutkan berdasarkan tanggal (terbaru pertama)
    lastTransactions.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return {
      success: true,
      data: {
        totalProduk: totalProduk,
        totalMasuk: totalMasuk,
        totalKeluar: totalKeluar,
        chartLabels: chartLabels,
        chartMasukData: chartMasukData,
        chartKeluarData: chartKeluarData,
        dailyChartData: dailyData,
        gudangLabels: gudangList,
        gudangData: gudangData,
        lastTransactions: lastTransactions.slice(0, 10),
        greeting: sapaan,
        userEmail: userEmail
      }
    };

  } catch (e) {
    console.error('Error in getDashboardData:', e);
    return {
      success: false,
      error: e.message
    };
  }
}

function getGudangList() {
  return ["Gudang 1", "Gudang 2", "Gudang 3"];
}

// Fungsi untuk export data ke Excel
function exportToExcel(sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();
  
  // Buat file CSV
  var csv = data.map(row => row.join(",")).join("\n");
  
  // Buat blob
  var blob = Utilities.newBlob(csv, MimeType.CSV, sheetName + ".csv");
  
  return {
    url: "data:text/csv;charset=utf-8," + encodeURIComponent(csv),
    filename: sheetName + ".csv"
  };
}

function getGudangList() {
  return ["Gudang 1", "Gudang 2", "Gudang 3"];
}

// Fungsi barang masuk
function getDataBarangMasuk(filterGudang = '', page = 1, pageSize = 10, searchTerm = '') {
  try {
    const sheet = ss.getSheetByName("ProdukMasuk");
    if (!sheet) {
      throw new Error("Sheet ProdukMasuk tidak ditemukan");
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { data: [], currentPage: 1, totalPages: 0, totalData: 0 };
    }
    
    const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
    const rawData = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

    // **PERBAIKAN UTAMA: Simpan nomor baris asli SEBELUM filtering**
    // Kita buat array baru yang isinya [data_baris, nomor_baris_asli]
    let allData = rawData.map((row, index) => {
      return { data: row, originalIndex: index + 2 }; // index + 2 karena data mulai dari baris 2
    });

    // 1. Terapkan filter PENCARIAN terlebih dahulu
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      allData = allData.filter(item => { // filter pada object 'item'
        const row = item.data; // ambil data barisnya
        const kodeBarang = String(row[1] || '').toLowerCase(); // Kolom B: Kode Barang
        const namaBarang = String(row[2] || '').toLowerCase(); // Kolom C: Nama Barang
        return kodeBarang.includes(lowerCaseSearchTerm) || namaBarang.includes(lowerCaseSearchTerm);
      });
    }

    // 2. Terapkan filter GUDANG setelahnya
    if (filterGudang) {
      allData = allData.filter(item => item.data[6] === filterGudang); // Kolom G: Gudang
    }
    
    const totalData = allData.length;
    const totalPages = Math.ceil(totalData / pageSize) || 1;
    
    // 3. Lakukan paginasi pada data final
    const startIndex = (page - 1) * pageSize;
    const pagedDataObjects = allData.slice(startIndex, startIndex + pageSize);

    // 4. Format data untuk dikirim ke client
    // Ambil data baris dan tambahkan nomor baris asli di akhir
    const pagedData = pagedDataObjects.map(item => {
      const row = item.data;
      if (row[0] && row[0] instanceof Date) {
        row[0] = Utilities.formatDate(row[0], spreadsheetTimezone, "yyyy-MM-dd");
      }
      row.push(item.originalIndex); // Tambahkan nomor baris asli ke akhir array
      return row;
    });

    return { 
      data: pagedData,
      currentPage: Number(page),
      totalPages: totalPages,
      totalData: totalData
    };
  } catch (error) {
    console.error('Error in getDataBarangMasuk:', error.message);
    throw new Error(error.message);
  }
}



function updateBarangMasuk(rowIndex, newData) {
  try {
    const masukSheet = ss.getSheetByName("ProdukMasuk");
    const produkSheet = ss.getSheetByName("DataProduk");

    // 1. Ambil data lama dari baris yang akan diedit
    const dataLama = masukSheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
    const kodeBarang = dataLama[1];
    const jumlahLama = Number(dataLama[5]);
    const jumlahBaru = Number(newData.jumlah);

    // 2. Hitung selisih untuk koreksi stok
    const selisih = jumlahBaru - jumlahLama;

    // 3. Update baris di sheet 'ProdukMasuk'
    masukSheet.getRange(rowIndex, 1).setValue(newData.tglMasuk);
    masukSheet.getRange(rowIndex, 6).setValue(newData.jumlah);
    masukSheet.getRange(rowIndex, 7).setValue(newData.gudang);

    // 4. Update stok di sheet 'DataProduk'
    const dataProduk = produkSheet.getDataRange().getValues();
    let barisProdukUntukUpdate = -1;
    for (let i = 1; i < dataProduk.length; i++) {
      if (dataProduk[i][0] === kodeBarang) {
        barisProdukUntukUpdate = i + 1;
        break;
      }
    }

    if (barisProdukUntukUpdate === -1) {
      throw new Error("Produk terkait tidak ditemukan di database.");
    }
    
    const stokSaatIni = produkSheet.getRange(barisProdukUntukUpdate, 7).getValue();
    const stokTerkoreksi = stokSaatIni + selisih;
    produkSheet.getRange(barisProdukUntukUpdate, 7).setValue(stokTerkoreksi);
    
    // 5. Update status produk
    const stokMinimal = produkSheet.getRange(barisProdukUntukUpdate, 5).getValue();
    const statusBaru = stokTerkoreksi <= stokMinimal ? "Barang Kosong" : "Tersedia";
    produkSheet.getRange(barisProdukUntukUpdate, 6).setValue(statusBaru);

    return "Data barang masuk berhasil diperbarui.";

  } catch (error) {
    console.error("Gagal update barang masuk:", error);
    throw new Error(error.message);
  }
}

function getProdukByBarcode(kodeBarang) {
  try {
    const sheet = ss.getSheetByName("DataProduk");
    const data = sheet.getDataRange().getValues();
    
    // Normalisasi kodeBarang untuk pencarian case-insensitive
    const kodeDicari = kodeBarang.toString().trim().toLowerCase();
    
    for (let i = 1; i < data.length; i++) {
      // Periksa apakah kolom kode barang ada dan cocok
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === kodeDicari) {
        return {
          kode: data[i][0] || '',
          nama: data[i][1] || '',
          jenis: data[i][2] || '',
          satuan: data[i][3] || '',
          stokMinimal: Number(data[i][4]) || 0,
          stok: Number(data[i][6]) || 0
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error in getProdukByBarcode:', error);
    throw new Error('Gagal memproses pencarian produk: ' + error.message);
  }
}

function hapusProduk(kodeBarang) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DataProduk");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === kodeBarang) {
      sheet.deleteRow(i + 1);
      return "Produk berhasil dihapus";
    }
  }
  
  throw new Error("Produk tidak ditemukan");
}

function updateProduk(kode, nama, jenis, satuan, stokMinimal) {
  try {
    // Variabel produkSheet sudah didefinisikan di atas file Anda
    if (!produkSheet) {
      throw new Error("Sheet DataProduk tidak ditemukan.");
    }

    const data = produkSheet.getDataRange().getValues();
    let rowIndex = -1;

    // Cari baris produk berdasarkan kode (mulai dari i=1 untuk lewati header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === kode.toString().trim()) {
        rowIndex = i + 1; // getValues() berbasis 0, baris sheet berbasis 1
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error("Produk dengan kode " + kode + " tidak ditemukan untuk diperbarui.");
    }

    // Lakukan pembaruan pada kolom yang sesuai
    produkSheet.getRange(rowIndex, 2).setValue(nama);        // Kolom B: Nama Barang
    produkSheet.getRange(rowIndex, 3).setValue(jenis);       // Kolom C: Jenis Barang
    produkSheet.getRange(rowIndex, 4).setValue(satuan);      // Kolom D: Satuan
    produkSheet.getRange(rowIndex, 5).setValue(stokMinimal); // Kolom E: Stok Minimal

    // Perbarui juga status berdasarkan stok saat ini
    const stokSaatIni = produkSheet.getRange(rowIndex, 7).getValue();
    const newStatus = stokSaatIni <= stokMinimal ? "Barang Kosong" : "Tersedia";
    produkSheet.getRange(rowIndex, 6).setValue(newStatus);   // Kolom F: Status

    return "Produk berhasil diperbarui.";

  } catch (e) {
    console.error("Gagal update produk: " + e.toString());
    // Mengembalikan pesan error agar bisa ditampilkan di sisi klien
    throw new Error("Gagal memperbarui produk: " + e.message);
  }
}

function hapusBarangMasuk(rowIndex) {
  try {
    const masukSheet = ss.getSheetByName("ProdukMasuk");
    const produkSheet = ss.getSheetByName("DataProduk");

    // 1. Ambil data dari baris yang akan dihapus untuk mendapatkan jumlah & kode barang
    const dataDihapus = masukSheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
    const kodeBarang = dataDihapus[1];
    const jumlahDihapus = Number(dataDihapus[5]);

    if (!kodeBarang || isNaN(jumlahDihapus)) {
      throw new Error("Data pada baris yang akan dihapus tidak valid atau tidak lengkap.");
    }

    // 2. Hapus baris transaksi dari sheet "ProdukMasuk"
    masukSheet.deleteRow(rowIndex);

    // 3. Cari produk di "DataProduk" untuk mengoreksi stok
    const dataProduk = produkSheet.getDataRange().getValues();
    let barisProdukUpdate = -1;
    for (let i = 1; i < dataProduk.length; i++) {
      if (dataProduk[i][0] === kodeBarang) {
        barisProdukUpdate = i + 1;
        break;
      }
    }

    if (barisProdukUpdate === -1) {
      // Jika produknya tidak ada di master, setidaknya log transaksinya sudah terhapus.
      throw new Error(`Transaksi masuk telah dihapus, tetapi produk dengan kode ${kodeBarang} tidak ditemukan di master data untuk penyesuaian stok.`);
    }

    // 4. Koreksi stok (dikurangi)
    const stokSaatIni = produkSheet.getRange(barisProdukUpdate, 7).getValue();
    const stokBaru = stokSaatIni - jumlahDihapus;
    produkSheet.getRange(barisProdukUpdate, 7).setValue(stokBaru);

    // 5. Perbarui status jika perlu
    const stokMinimal = produkSheet.getRange(barisProdukUpdate, 5).getValue();
    const statusBaru = stokBaru <= stokMinimal ? "Barang Kosong" : "Tersedia";
    produkSheet.getRange(barisProdukUpdate, 6).setValue(statusBaru);

    return "Data barang masuk berhasil dihapus dan stok telah dikoreksi.";
    
  } catch (e) {
    console.error("Gagal hapus barang masuk:", e);
    throw new Error("Terjadi kesalahan di server: " + e.message);
  }
}



// Fungsi barang keluar
// Fungsi barang keluar
function getDataBarangKeluar(filterGudang = '', page = 1, pageSize = 10, searchTerm = '') {
  try {
    const sheet = ss.getSheetByName("ProdukKeluar");
    if (!sheet) {
      throw new Error("Sheet ProdukKeluar tidak ditemukan");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { data: [], currentPage: 1, totalPages: 0, totalData: 0 };
    }

    const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
    const rawData = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

    // **PERBAIKAN UTAMA: Simpan nomor baris asli SEBELUM filtering**
    // Buat array baru yang berisi objek dengan data baris dan nomor baris aslinya
    let allData = rawData.map((row, index) => {
      return { data: row, originalIndex: index + 2 }; // index + 2 karena data mulai dari baris 2
    });

    // 1. Terapkan filter PENCARIAN terlebih dahulu
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      allData = allData.filter(item => { // Filter pada objek 'item'
        const row = item.data; // Ambil data baris dari objek
        const kodeBarang = String(row[1] || '').toLowerCase(); // Kolom B: Kode Barang
        const namaBarang = String(row[2] || '').toLowerCase(); // Kolom C: Nama Barang
        return kodeBarang.includes(lowerCaseSearchTerm) || namaBarang.includes(lowerCaseSearchTerm);
      });
    }

    // 2. Terapkan filter GUDANG setelahnya
    if (filterGudang) {
      allData = allData.filter(item => item.data[5] === filterGudang); // Kolom F: Gudang
    }
    
    const totalData = allData.length;
    const totalPages = Math.ceil(totalData / pageSize) || 1;

    // 3. Lakukan paginasi pada data final yang sudah difilter
    const startIndex = (page - 1) * pageSize;
    const pagedDataObjects = allData.slice(startIndex, startIndex + pageSize);
    
    // 4. Format data untuk dikirim ke client
    // Ambil data baris dari objek dan tambahkan nomor baris asli di akhir
    const pagedData = pagedDataObjects.map(item => {
      const row = item.data;
      if (row[0] && row[0] instanceof Date) {
        row[0] = Utilities.formatDate(row[0], spreadsheetTimezone, "yyyy-MM-dd");
      }
      row.push(item.originalIndex); // Tambahkan nomor baris asli ke akhir array
      return row;
    });

    return { 
      data: pagedData,
      currentPage: Number(page),
      totalPages: totalPages,
      totalData: totalData
    };
  } catch (e) {
    console.error("Error in getDataBarangKeluar:", e);
    throw new Error(e.message);
  }
}



function hapusBarangKeluar(rowIndex) {
  try {
    const keluarSheet = ss.getSheetByName("ProdukKeluar"); [132]
    const produkSheet = ss.getSheetByName("DataProduk"); [132]

    const dataDihapus = keluarSheet.getRange(rowIndex, 1, 1, 8).getValues()[0]; [132]
    const kodeBarang = dataDihapus[1]; [133]
    const jumlahDikembalikan = Number(dataDihapus[7]); [133]

    if (!kodeBarang || isNaN(jumlahDikembalikan)) { [134]
      throw new Error("Data pada baris yang akan dihapus tidak valid."); [134]
    }

    keluarSheet.deleteRow(rowIndex); [135]

    const dataProduk = produkSheet.getDataRange().getValues(); [135]
    let barisProdukUpdate = -1; [135]
    
    // **FIX:** Perbandingan yang andal
    for (let i = 1; i < dataProduk.length; i++) {
      if (dataProduk[i][0] && dataProduk[i][0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase()) {
        barisProdukUpdate = i + 1;
        break;
      }
    }

    if (barisProdukUpdate === -1) { [137]
      throw new Error(`Transaksi keluar telah dihapus, tetapi produk ${kodeBarang} tidak ditemukan untuk penyesuaian stok.`); [137]
    }

    const stokSaatIni = produkSheet.getRange(barisProdukUpdate, 7).getValue(); [138]
    const stokBaru = stokSaatIni + jumlahDikembalikan; [138]
    produkSheet.getRange(barisProdukUpdate, 7).setValue(stokBaru); [138]

    const stokMinimal = produkSheet.getRange(barisProdukUpdate, 5).getValue(); [139]
    const statusBaru = stokBaru <= stokMinimal ? "Barang Kosong" : "Tersedia"; [139]
    produkSheet.getRange(barisProdukUpdate, 6).setValue(statusBaru); [140]

    return "Data barang keluar berhasil dihapus dan stok telah dikembalikan."; [141]
  } catch (e) {
    console.error("Gagal hapus barang keluar:", e); [142]
    throw new Error("Server error: " + e.message); [142]
  }
}



function updateBarangKeluar(rowIndex, newData) {
  try {
    const keluarSheet = ss.getSheetByName("ProdukKeluar"); [1]
    const produkSheet = ss.getSheetByName("DataProduk"); [1]

    const dataLama = keluarSheet.getRange(rowIndex, 1, 1, 8).getValues()[0]; [143]
    const kodeBarang = dataLama[1]; [144]
    const jumlahLama = Number(dataLama[7]); [144]
    const jumlahBaru = Number(newData.jumlah); [144]
    const selisih = jumlahBaru - jumlahLama; [145]

    keluarSheet.getRange(rowIndex, 1).setValue(newData.tglKeluar); [146]
    keluarSheet.getRange(rowIndex, 6).setValue(newData.gudang); [146]
    keluarSheet.getRange(rowIndex, 7).setValue(newData.penanggungJawab); [146]
    keluarSheet.getRange(rowIndex, 8).setValue(newData.jumlah); [146]

    const dataProduk = produkSheet.getDataRange().getValues(); [147]
    let barisProdukUpdate = -1; [147]
    
    for (let i = 1; i < dataProduk.length; i++) {
      if (dataProduk[i][0] && dataProduk[i][0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase()) {
        barisProdukUpdate = i + 1;
        break;
      }
    }

    if (barisProdukUpdate === -1) throw new Error("Produk terkait tidak ditemukan."); [149]

    const stokSaatIni = produkSheet.getRange(barisProdukUpdate, 7).getValue(); [149]
    const stokTerkoreksi = stokSaatIni - selisih; [150]
    produkSheet.getRange(barisProdukUpdate, 7).setValue(stokTerkoreksi); [150]

    const stokMinimal = produkSheet.getRange(barisProdukUpdate, 5).getValue(); [151]
    const statusBaru = stokTerkoreksi <= stokMinimal ? "Barang Kosong" : "Tersedia"; [151]
    produkSheet.getRange(barisProdukUpdate, 6).setValue(statusBaru); [151]

    return "Data barang keluar berhasil diperbarui."; [152]
  } catch (e) {
    console.error("Gagal update barang keluar:", e); [153]
    throw new Error("Server error: " + e.message); [153]
  }
}


function getGudangByProduk(kodeBarang) {
  try {
    const masukSheet = ss.getSheetByName("ProdukMasuk");
    const dataMasuk = masukSheet.getDataRange().getValues();
    const gudangSet = new Set(); // Menggunakan Set untuk otomatis menangani data unik

    // Loop dari baris kedua untuk melewati header
    for (let i = 1; i < dataMasuk.length; i++) {
      // PERUBAHAN UTAMA: Ubah kedua nilai menjadi String dan hapus spasi sebelum membandingkan
      // Ini memastikan perbandingan akurat meskipun tipe datanya berbeda (Number vs String)
      if (dataMasuk[i][1].toString().trim() === kodeBarang.toString().trim()) {
        gudangSet.add(dataMasuk[i][6]); // Tambahkan gudang (kolom G, indeks 6) ke Set
      }
    }
    
    // Kembalikan sebagai array
    return Array.from(gudangSet);

  } catch (e) {
    console.error("Error di getGudangByProduk: ", e);
    throw new Error("Gagal mengambil daftar gudang untuk produk ini.");
  }
}



// FUNGSI STOK OPNAME


function getProdukUntukOpname(kodeBarang) {
  try {
    const produkData = getProdukByBarcode(kodeBarang); // Kita gunakan lagi fungsi yang sudah ada
    if (!produkData) {
      return null;
    }
    return {
      nama: produkData.nama,
      stokSistem: produkData.stok
    };
  } catch (e) {
    console.error("Error di getProdukUntukOpname: ", e);
    return null;
  }
}

/**
 * Menyimpan hasil stok opname ke sheet dan menyesuaikan stok jika perlu.
 */
function simpanHasilOpname(opnameData) {
  try {
    const opnameSheet = ss.getSheetByName("StokOpname");
    const produkSheet = ss.getSheetByName("DataProduk");
    const {
      tanggal,
      kodeBarang,
      namaBarang,
      stokSistem,
      stokFisik,
      petugas,
      catatan,
      lakukanPenyesuaian
    } = opnameData;

    const selisih = Number(stokFisik) - Number(stokSistem);
    const statusPenyesuaian = lakukanPenyesuaian ? "Stok Disesuaikan" : "Tidak Disesuaikan";

    // 1. Catat aktivitas opname
    opnameSheet.appendRow([
      tanggal, kodeBarang, namaBarang, stokSistem, stokFisik,
      selisih, statusPenyesuaian, petugas, catatan
    ]);

    // 2. Jika checkbox penyesuaian dicentang, update stok di DataProduk
    if (lakukanPenyesuaian) {
      const dataProduk = produkSheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < dataProduk.length; i++) {
        if (dataProduk[i][0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase()) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        produkSheet.getRange(rowIndex, 7).setValue(stokFisik); // Update kolom Stok (G)
        
        // Update juga status ketersediaan
        const stokMinimal = produkSheet.getRange(rowIndex, 5).getValue();
        const statusBaru = Number(stokFisik) <= stokMinimal ? "Barang Kosong" : "Tersedia";
        produkSheet.getRange(rowIndex, 6).setValue(statusBaru); // Update kolom Status (F)
      } else {
        throw new Error("Gagal menemukan produk untuk disesuaikan.");
      }
    }
    
    return { success: true, message: "Hasil stok opname berhasil disimpan." };

  } catch (e) {
    console.error("Error di simpanHasilOpname: ", e);
    return { success: false, message: e.message };
  }
}


// FUngsi ambil data stok opname
function getDataStokOpname(page = 1, pageSize = 10, searchTerm = '', filterPenyesuaian = '') {
   try {
    const opnameSheet = ss.getSheetByName("StokOpname");
    const lastRow = opnameSheet.getLastRow();
    if (lastRow <= 1) {
      return { data: [], currentPage: 1, totalPages: 0, totalData: 0 };
    }
    
    let allData = opnameSheet.getRange(2, 1, lastRow - 1, 10).getValues();

    let needsUpdate = false;
    allData.forEach((row, index) => {
      if (!row[0]) {
        row[0] = 'OPN-' + new Date().getTime() + '-' + (index + 2);
        opnameSheet.getRange(index + 2, 1).setValue(row[0]);
        needsUpdate = true;
      }
    });
    if (needsUpdate) SpreadsheetApp.flush();

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      allData = allData.filter(row => {
        const kodeBarang = String(row[2] || '').toLowerCase();
        const namaBarang = String(row[3] || '').toLowerCase();
        return kodeBarang.includes(lowerCaseSearchTerm) || namaBarang.includes(lowerCaseSearchTerm);
      });
    }
    
    if (filterPenyesuaian) {
      allData = allData.filter(row => row[7] === filterPenyesuaian);
    }

    allData.sort((a, b) => new Date(b[1]) - new Date(a[1]));
    
    const totalData = allData.length;
    const totalPages = Math.ceil(totalData / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const pagedData = allData.slice(startIndex, startIndex + pageSize);

    const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
    const formattedData = pagedData.map(row => {
        if (row[1] && row[1] instanceof Date) {
            row[1] = Utilities.formatDate(row[1], spreadsheetTimezone, "yyyy-MM-dd");
        }
        return row;
    });

    return { 
      data: formattedData,
      currentPage: Number(page),
      totalPages: totalPages,
      totalData: totalData
    };
   } catch (e) {
    console.error("Error di getDataStokOpname:", e);
    throw new Error(e.message);
  }
}

// Fungsi simpan stokopname
function simpanHasilOpname(opnameData) {
  try {
    const opnameSheet = ss.getSheetByName("StokOpname");
    const produkSheet = ss.getSheetByName("DataProduk");
    const {
      tanggal, kodeBarang, namaBarang, stokSistem,
      stokFisik, petugas, catatan, lakukanPenyesuaian
    } = opnameData;

    const idOpname = 'OPN-' + new Date().getTime();
    const selisih = Number(stokFisik) - Number(stokSistem);
    const statusPenyesuaian = lakukanPenyesuaian ? "Stok Disesuaikan" : "Tidak Disesuaikan";
    
    opnameSheet.appendRow([
      idOpname, tanggal, kodeBarang, namaBarang, stokSistem, stokFisik,
      selisih, statusPenyesuaian, petugas, catatan
    ]);

    if (lakukanPenyesuaian) {
      const dataProduk = produkSheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < dataProduk.length; i++) {
        if (dataProduk[i][0] && dataProduk[i][0].toString().trim().toLowerCase() === kodeBarang.toString().trim().toLowerCase()) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex !== -1) {
        produkSheet.getRange(rowIndex, 7).setValue(stokFisik);
        const stokMinimal = produkSheet.getRange(rowIndex, 5).getValue();
        const statusBaru = Number(stokFisik) <= stokMinimal ? "Barang Kosong" : "Tersedia";
        produkSheet.getRange(rowIndex, 6).setValue(statusBaru);
      } else {
        throw new Error("Gagal menemukan produk untuk disesuaikan.");
      }
    }
    return { success: true, message: "Hasil stok opname berhasil disimpan." };
  } catch (e) {
    console.error("Error di simpanHasilOpname: ", e);
    return { success: false, message: e.message };
  }
}


function hapusRiwayatOpname(idOpname) {
  try {
    const opnameSheet = ss.getSheetByName("StokOpname");
    const data = opnameSheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === idOpname) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error("Riwayat opname tidak ditemukan.");
    }
    
    opnameSheet.deleteRow(rowIndex);
    
    return "Riwayat berhasil dihapus.";
  } catch(e) {
    console.error("Gagal Hapus Riwayat Opname: ", e);
    throw new Error("Gagal menghapus riwayat: " + e.message);
  }
}


function getLaporanOpname(tanggalMulai, tanggalSelesai) {
  try {
    const sheet = ss.getSheetByName("StokOpname");
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    // Membuat objek tanggal yang andal dari input
    const partsMulai = tanggalMulai.split('-');
    const startDate = new Date(partsMulai[0], partsMulai[1] - 1, partsMulai[2]);
    startDate.setHours(0, 0, 0, 0);

    const partsSelesai = tanggalSelesai.split('-');
    const endDate = new Date(partsSelesai[0], partsSelesai[1] - 1, partsSelesai[2]);
    endDate.setHours(23, 59, 59, 999);

    // Filter data berdasarkan rentang tanggal
    const filteredData = data.filter(function(row) {
      if (!row[1] || !(row[1] instanceof Date)) return false;
      const rowDate = new Date(row[1]);
      return rowDate >= startDate && rowDate <= endDate;
    });

    // Urutkan berdasarkan tanggal terbaru
    filteredData.sort((a, b) => new Date(b[1]) - new Date(a[1]));

    // Format tanggal sebelum dikirim, tanpa mengubah urutan kolom
    const spreadsheetTimezone = ss.getSpreadsheetTimeZone();
    return filteredData.map(row => {
      const newRow = [...row]; // Buat salinan agar data asli tidak termodifikasi
      if (newRow[1] instanceof Date) {
        newRow[1] = Utilities.formatDate(newRow[1], spreadsheetTimezone, "yyyy-MM-dd");
      }
      return newRow;
    });

  } catch (e) {
    console.error("Error in getLaporanOpname:\n" + e.stack);
    throw new Error("Terjadi kesalahan saat mengambil data: " + e.message);
  }
}


function exportLaporanToExcel(data, namaFile) {
  try {
    let csvContent = "ID Opname,Tanggal,Kode Barang,Nama Barang,Stok Sistem,Stok Fisik,Selisih,Status Penyesuaian,Petugas,Catatan\n";
    data.forEach(function(row) {
      let csvRow = row.map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(',');
      csvContent += csvRow + "\n";
    });

    const blob = Utilities.newBlob(csvContent, MimeType.CSV, namaFile + ".csv");
    return {
      url: "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent),
      filename: namaFile + ".csv"
    };
  } catch(e) {
    throw new Error("Gagal membuat file export: " + e.message);
  }
}



function getLaporanPerBarang(kodeBarang, tanggalMulai, tanggalSelesai) {
  try {
    const produkData = getProdukByBarcode(kodeBarang);
    if (!produkData) {
      throw new Error(`Produk dengan kode "${kodeBarang}" tidak ditemukan.`);
    }

    const masukSheet = ss.getSheetByName("ProdukMasuk");
    const keluarSheet = ss.getSheetByName("ProdukKeluar");
    const dataMasuk = masukSheet.getLastRow() > 1 ? masukSheet.getRange(2, 1, masukSheet.getLastRow() - 1, 7).getValues() : [];
    const dataKeluar = keluarSheet.getLastRow() > 1 ? keluarSheet.getRange(2, 1, keluarSheet.getLastRow() - 1, 8).getValues() : [];

    let semuaTransaksi = [];

    // Kumpulkan semua transaksi (masuk dan keluar) untuk barang ini
    dataMasuk.forEach(row => {
      if (row[1] && row[1].toString().trim().toLowerCase() === kodeBarang.toLowerCase()) {
        semuaTransaksi.push({ tanggal: new Date(row[0]), keterangan: 'Barang Masuk', masuk: row[5], keluar: 0 });
      }
    });
    dataKeluar.forEach(row => {
      if (row[1] && row[1].toString().trim().toLowerCase() === kodeBarang.toLowerCase()) {
        semuaTransaksi.push({ tanggal: new Date(row[0]), keterangan: 'Barang Keluar via ' + row[5], masuk: 0, keluar: row[7] });
      }
    });

    // Urutkan semua transaksi berdasarkan tanggal, dari yang paling lama ke terbaru
    semuaTransaksi.sort((a, b) => a.tanggal - b.tanggal);

    // Hitung Stok Awal sebelum rentang tanggal yang dipilih
    const startDate = new Date(tanggalMulai);
    startDate.setHours(0, 0, 0, 0);
    
    let stokAwal = 0;
    semuaTransaksi.forEach(t => {
      if (t.tanggal < startDate) {
        stokAwal += t.masuk - t.keluar;
      }
    });

    // Filter transaksi sesuai rentang tanggal yang dipilih
    const endDate = new Date(tanggalSelesai);
    endDate.setHours(23, 59, 59, 999);

    const transaksiTerfilter = semuaTransaksi.filter(t => t.tanggal >= startDate && t.tanggal <= endDate);

    // Hitung Sisa Stok berjalan untuk transaksi yang sudah difilter
    let sisaStokBerjalan = stokAwal;
    const hasilAkhir = transaksiTerfilter.map(t => {
      sisaStokBerjalan += t.masuk - t.keluar;
      return {
        tanggal: Utilities.formatDate(t.tanggal, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd"),
        keterangan: t.keterangan,
        masuk: t.masuk,
        keluar: t.keluar,
        sisaStok: sisaStokBerjalan
      };
    });

    return {
      success: true,
      data: {
        infoProduk: { kode: produkData.kode, nama: produkData.nama },
        stokAwal: stokAwal,
        transaksi: hasilAkhir
      }
    };

  } catch (e) {
    console.error("Error di getLaporanPerBarang: " + e.message);
    return { success: false, error: e.message };
  }
}