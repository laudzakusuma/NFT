Sui Pet PWA
Sui Pet PWA adalah aplikasi terdesentralisasi (dApp) yang menggabungkan mekanisme permainan simulasi hewan peliharaan (Pet Simulation) dengan teknologi Geolokasi dan Augmented Reality (AR) di atas jaringan Blockchain Sui. Sistem ini memanfaatkan validasi sisi server (Oracle) untuk memastikan keamanan lokasi pengguna saat melakukan interaksi dalam game.

Fitur Utama
Kepemilikan Aset On-Chain: Hewan peliharaan (Pet) dan item makanan direpresentasikan sebagai objek di jaringan Sui, memberikan kepemilikan penuh kepada pengguna.

Gameplay Berbasis Lokasi: Menggunakan GPS real-time untuk memunculkan target (monster/loot) di sekitar lokasi fisik pengguna.

Validasi Anti-Spoofing: Server backend memverifikasi koordinat dan kecepatan perpindahan pengguna sebelum menandatangani transaksi penangkapan hewan (minting).

Mode Augmented Reality (AR): Antarmuka kamera interaktif untuk pengalaman menangkap hewan peliharaan secara visual.

Sistem Evolusi & Pertarungan: Hewan peliharaan dapat berevolusi berdasarkan tingkat kebahagiaan dan hasil acak (randomness) yang diverifikasi on-chain.

Toko & Ekonomi In-Game: Pengguna dapat membeli makanan menggunakan token SUI untuk menjaga status kelaparan hewan peliharaan.

Arsitektur Sistem
Berikut adalah alur data dan interaksi antara Client, Server Oracle, dan Smart Contract di jaringan Sui:

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client (PWA)   │     │   Game Server   │     │  Sui Blockchain │
│ (Next.js + Map) │────▶│ (API /api/hunt) │────▶│ (Move Modules)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │    1. Kirim Lokasi    │                       │
         │   (Lat, Lng, User)    │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 2. Validasi Jarak     │
         │                       │    & Tanda Tangan     │
         │    3. Terima Sign     │    (Ed25519 Key)      │
         │◀──────────────────────│                       │
         │                       │                       │
         │    4. Eksekusi Tx     │                       │
         │     (Move Call)       │                       │
         │──────────────────────────────────────────────▶│
         │                       │                       │ 5. Verifikasi
         │                       │                       │    Signature &
         │                       │                       │    Mint Objek
Prasyarat
Sebelum memulai, pastikan lingkungan pengembangan Anda telah terinstal:

Node.js (v18 atau lebih baru)

pnpm (Package Manager)

Sui CLI (untuk manajemen smart contract)

Dompet SUI dengan saldo Testnet

Panduan Instalasi
1. Persiapan Repositori
Clone repositori proyek dan masuk ke direktori utama.

2. Konfigurasi Smart Contract
Masuk ke direktori contract dan publikasikan modul ke jaringan Sui.

Bash
cd sui_pet
sui client publish --gas-budget 100000000
Setelah publikasi berhasil, catat Package ID dan Shop ID dari output terminal. Anda akan membutuhkannya untuk konfigurasi frontend.

3. Konfigurasi Frontend & Server
Pindah ke direktori frontend sui-pet-pwa dan instal dependensi.

Bash
cd ../sui-pet-pwa
pnpm install
Buat kunci admin untuk server (Oracle) menggunakan skrip yang tersedia. Kunci ini digunakan untuk menandatangani lokasi valid.

Bash
node keygen.js
Buat file .env.local di root folder sui-pet-pwa dan isi konfigurasi berikut berdasarkan output keygen.js dan publikasi contract:

Cuplikan kode
# Kunci Rahasia Admin (dari output keygen.js)
ADMIN_SECRET_KEY=suiprivkey...

# ID Objek Toko (dari output publish sui_pet)
NEXT_PUBLIC_SHOP_ID=0x...
Catatan Penting: Pastikan Public Key yang dihasilkan dari keygen.js telah didaftarkan ke dalam konstanta ORACLE_PUBLIC_KEY di file sui_pet/sources/core.move sebelum melakukan publikasi contract.

4. Update Konstanta Aplikasi
Buka file src/utils/contracts.ts dan perbarui variabel PACKAGE_ID dan SHOP_ID sesuai dengan hasil deployment Anda.

TypeScript
export const PACKAGE_ID = "0x...";
export const SHOP_ID = "0x...";
5. Menjalankan Aplikasi
Jalankan server pengembangan lokal:

Bash
pnpm dev
Akses aplikasi melalui browser di http://localhost:3000.

Teknologi yang Digunakan
Smart Contracts (Move)
Core Module: Logika utama pet, atribut, dan status.

Shop Module: Manajemen pembelian item menggunakan SUI Coin.

Battle Module: Logika pertarungan PvE/PvP sederhana.

Frontend & Backend
Next.js 16: Framework React untuk UI dan API Routes.

Tailwind CSS: Styling antarmuka yang responsif.

Leaflet: Peta interaktif untuk fitur geolokasi.

Framer Motion: Animasi antarmuka.

Sui dApp Kit: Integrasi dompet dan manajemen transaksi blockchain.

Lisensi
Didistribusikan di bawah Lisensi MIT. Lihat file LICENSE untuk informasi lebih lanjut.

Pafingkaran: Proyek ini dibangun untuk tujuan edukasi dan demonstrasi integrasi antara dunia nyata dan blockchain menggunakan Sui Network.
