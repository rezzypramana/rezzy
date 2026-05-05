# 📚 Buku Panduan Instalasi & Publikasi Sinergi Assets

Panduan ini menjelaskan langkah demi langkah untuk memindahkan aplikasi **Sinergi Assets** dari lingkungan AI Studio ke hosting mandiri agar dapat digunakan secara profesional oleh lembaga Anda.

---

## Tahap 1: Mengambil Kode dari AI Studio

1.  Buka proyek Anda di **Google AI Studio**.
2.  Di pojok kanan atas, klik menu **Settings** (Ikon Gear) atau menu ekspor.
3.  Pilih **Export to GitHub** (Direkomendasikan) atau **Download ZIP**.
    *   **GitHub**: Akan membuat repositori di akun GitHub Anda.
    *   **ZIP**: Akan mengunduh seluruh file ke komputer Anda.

---

## Tahap 2: Persiapan Lingkungan Lokal

Sebelum menjalankan aplikasi, pastikan komputer/server Anda memiliki:
1.  **Node.js (Versi 18 atau terbaru)**: Unduh di [nodejs.org](https://nodejs.org/).
2.  **Code Editor**: Gunakan Visual Studio Code.
3.  **Terminal**: Command Prompt, PowerShell, atau Terminal Mac/Linux.

**Langkah Kerja:**
1.  Ekstrak file ZIP (jika menggunakan ZIP) ke folder kerja Anda.
2.  Buka terminal di folder tersebut.
3.  Jalankan perintah untuk menginstal library:
    ```bash
    npm install
    ```

---

## Tahap 3: Konfigurasi Firebase (Otak Aplikasi)

Aplikasi ini membutuhkan Firebase. Anda perlu membuat proyek Firebase sendiri:

1.  Buka [Firebase Console](https://console.firebase.google.com/).
2.  Klik **Add Project** dan beri nama proyek (misal: "Sinergi-Assets").
3.  **Aktivasi Authentication**:
    *   Masuk ke menu *Authentication* > *Get Started*.
    *   Pilih *Sign-in method* > **Google**.
    *   Aktifkan dan masukkan email dukungan Anda. Simpan.
4.  **Aktivasi Firestore Database**:
    *   Masuk ke menu *Firestore Database* > *Create Database*.
    *   Pilih lokasi server terdekat (misal: `asia-southeast2` untuk Jakarta).
    *   Pilih **Start in test mode** untuk awal (nanti akan kita timpa dengan Rules aman).
5.  **Aktivasi Firebase Storage (Penting untuk Foto)**:
    *   Masuk ke menu *Storage* > *Get Started*.
    *   Klik *Next* dan *Done*. Ini tempat foto aset dan surat akan disimpan.

---

## Tahap 4: Menghubungkan Kode dengan Firebase

1.  Di Firebase Console, klik ikon **Settings (Gear)** > **Project Settings**.
2.  Di bagian *Your apps*, klik ikon **Web (</>)**.
3.  Daftarkan aplikasi (misal: "Sinergi-Web").
4.  Anda akan mendapatkan objek `firebaseConfig`.
5.  Buka file `firebase-applet-config.json` di folder kodingan Anda.
6.  Ganti isi file tersebut dengan data yang Anda dapatkan dari Firebase Console.
    *   *Pastikan `apiKey`, `authDomain`, `projectId`, `storageBucket`, dll. sesuai.*

---

## Tahap 5: Memasang Keamanan (Security Rules)

Agar data tidak bisa dicuri orang lain:
1.  Buka file `firestore.rules` di folder kodingan Anda.
2.  Salin seluruh isinya.
3.  Kembali ke Firebase Console > **Firestore Database** > Tab **Rules**.
4.  Hapus aturan lama, tempel aturan dari file tadi, lalu klik **Publish**.
5.  Lakukan hal yang sama untuk **Storage** > Tab **Rules** (Gunakan aturan standar yang mengizinkan baca tulis hanya untuk user yang login).

---

## Tahap 6: Publish ke Hosting (Agar Online)

Kami merekomendasikan **Firebase Hosting** karena gratis dan cepat.

1.  Di terminal folder Anda, instal Firebase Tools:
    ```bash
    npm install -g firebase-tools
    ```
2.  Login ke Firebase:
    ```bash
    firebase login
    ```
3.  Inisialisasi Hosting:
    ```bash
    firebase init
    ```
    *   Pilih: `Hosting: Configure files for Firebase Hosting`.
    *   Pilih: `Use an existing project` (Pilih proyek yang Anda buat di Tahap 3).
    *   What do you want to use as your public directory? Ketik: `dist`.
    *   Configure as a single-page app? Ketik: `y`.
    *   Set up automatic builds with GitHub? Ketik: `n` (pilihan Anda).
4.  **Build Aplikasi**:
    ```bash
    npm run build
    ```
5.  **Deploy**:
    ```bash
    firebase deploy
    ```

---

## Tahap 7: Akses Aplikasi

Setelah deploy selesai, Anda akan diberikan sebuah URL (misal: `https://sinergi-assets.web.app`).

1.  Buka URL tersebut.
2.  Login menggunakan akun Google Anda (Gunakan email yang terdaftar sebagai admin di kodingan, misal: `lastbrilian@gmail.com`).
3.  Buka menu **Admin** (tombol gear di sidebar).
4.  Pilih tab **Branding Lembaga**.
5.  Upload Logo lembaga Anda dan ganti Nama Lembaga.
6.  Klik **Simpan Identitas**.

---

## 🚀 Fitur Unggulan & Cara Penggunaan

### 1. Sistem QR Code Otomatis
*   **Generate QR**: Pada daftar Aset atau Inventaris, arahkan kursor ke baris item, klik ikon **QR Code** (biru).
*   **Cetak**: Anda dapat mencetak label QR satu per satu atau secara massal dengan memilih beberapa item (checkbox) lalu klik "Cetak Label QR Terpilih".

### 2. Laporan Cerdas & Ekspor Excel
*   **Filter**: Gunakan menu Laporan untuk memfilter data berdasarkan tanggal, divisi, atau lokasi.
*   **Export Excel**: Klik tombol **Export Excel** (Hijau) untuk mengunduh data dalam format file Excel (.xlsx) yang siap diolah lebih lanjut.
*   **Cetak PDF**: Gunakan tombol **Ekspor PDF** untuk menghasilkan dokumen laporan fisik yang rapi.

### 3. Manajemen Divisi & Akses
*   Hanya **Super Admin** (`lastbrilian@gmail.com`) yang dapat mengubah peran (role) pengguna lain.
*   Pastikan divisi diisi dengan benar agar filter laporan akurat.

---

**Selamat!** Aplikasi Sinergi Assets kini resmi berjalan di lingkungan lembaga Anda sendiri.
