import { NextResponse } from 'next/server';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createHash } from 'crypto';

const SECRET_KEY = process.env.ADMIN_SECRET_KEY;

let adminKeypair: Ed25519Keypair | null = null;

try {
    if (!SECRET_KEY) {
        console.error("CRITICAL: ADMIN_SECRET_KEY tidak ditemukan di .env.local!");
    } else {
        adminKeypair = Ed25519Keypair.fromSecretKey(SECRET_KEY);
        console.log("Server Key Loaded: Siap menandatangani transaksi.");
    }
} catch (e) {
    console.error("Key Error: Format Private Key salah.", e);
}

const userTracking = new Map<string, { lat: number, lng: number, time: number }>();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(req: Request) {
    try {
        if (!adminKeypair) {
            return NextResponse.json({ 
                error: "Server Configuration Error: Admin Key Missing. Check server logs." 
            }, { status: 500 });
        }

        const { address, lat, lng } = await req.json();
        const now = Date.now();

        if (userTracking.has(address)) {
            const last = userTracking.get(address)!;
            const dist = calculateDistance(last.lat, last.lng, lat, lng);
            const timeDiff = (now - last.time) / 1000;
            
            if (timeDiff > 0 && (dist / timeDiff) > 50) { 
                return NextResponse.json({ error: "Anda bergerak terlalu cepat! (Spoofing terdeteksi)" }, { status: 400 });
            }
        }
        userTracking.set(address, { lat, lng, time: now });

        const locationString = `${lat.toFixed(4)},${lng.toFixed(4)}`; 
        const hash = createHash('sha256').update(locationString).digest('hex');
        const hashVal = parseInt(hash.substring(0, 4), 16);
        
        let rarity = 1;
        if (hashVal % 100 < 5) { 
            rarity = 3;
        } else if (hashVal % 100 < 25) { 
            rarity = 2;
        }

        const elementVal = parseInt(hash.substring(8, 10), 16);
        const element = (elementVal % 3) + 1;

        const addressBytes = new TextEncoder().encode(address);
        const messageData = new Uint8Array(addressBytes.length + 2);
        messageData.set(addressBytes);
        messageData.set([rarity], addressBytes.length);

        const signature = await adminKeypair.sign(messageData);

        return NextResponse.json({
            signature: Array.from(signature),
            msg: Array.from(messageData), 
            rarity,
            element,
            debug_info: { rarity, element }
        });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
    }
}