import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Ini membuat kunci Tetap
const keypair = new Ed25519Keypair(); 
const pkHex = Buffer.from(keypair.getPublicKey().toRawBytes()).toString('hex');
const sk = keypair.getSecretKey();

console.log("=== KUNCI RAHASIA (JANGAN HILANG) ===");
console.log("1. Copy ke core.move (ORACLE_PUBLIC_KEY):");
console.log(`x"${pkHex}"`);
console.log("\n2. Copy ke .env.local (ADMIN_SECRET_KEY):");
console.log(sk);