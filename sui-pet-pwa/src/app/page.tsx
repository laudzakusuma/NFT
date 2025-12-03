'use client';

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { PET_TYPE, PACKAGE_ID, SHOP_ID, FOOD_TYPE } from '../utils/contracts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Heart,
  Utensils,
  ShoppingBag,
  X,
  Map as MapIcon,
  RefreshCw,
  Camera,
  Navigation,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import Webcam from 'react-webcam';
import dynamic from 'next/dynamic';

// — LOAD MAP (SSR SAFE)
const GameMap = dynamic(() => import('../components/GameMap'), { ssr: false });

// — GAME CONSTANTS
const CONFIG = {
  SPAWN_MIN_DIST: 30,
  SPAWN_MAX_DIST: 150,
  CLAIM_RADIUS: 15,
  GPS_TIMEOUT: 15000,
  GPS_MAX_AGE: 5000,
};

// — MATH: HAVERSINE
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// — RANDOM TARGET
function generateTarget(lat: number, lng: number) {
  const angle = Math.random() * Math.PI * 2;
  const dist = CONFIG.SPAWN_MIN_DIST + Math.random() * (CONFIG.SPAWN_MAX_DIST - CONFIG.SPAWN_MIN_DIST);

  const dLat = (dist * Math.cos(angle)) / 111000;
  const dLng = (dist * Math.sin(angle)) / (111000 * Math.cos(lat * Math.PI / 180));

  return {
    lat: lat + dLat,
    lng: lng + dLng,
    id: Date.now(),
  };
}

// — MAIN PAGE
export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // STATE
  const [viewMode, setViewMode] = useState<'dashboard' | 'map' | 'ar'>('dashboard');
  const [showInventory, setShowInventory] = useState(false);
  const [petAction, setPetAction] = useState<'idle' | 'happy' | 'eating'>('idle');

  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [canClaim, setCanClaim] = useState(false);

  const [isMinting, setIsMinting] = useState(false);
  const [notification, setNotification] = useState<{
    msg: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // — FETCH PET
  const { data: petData, isPending: isPetLoading, refetch: refetchPet } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address as string,
      filter: { StructType: PET_TYPE },
      options: { showContent: true },
    },
    { enabled: !!account, refetchInterval: 5000 },
  );

  // — FETCH FOOD
  const { data: foodData, refetch: refetchFood } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address as string,
      filter: { StructType: FOOD_TYPE },
      options: { showContent: true },
    },
    { enabled: !!account },
  );

  // PET PARSE
  const hasPet = petData?.data && petData.data.length > 0;
  const petObject = hasPet ? petData.data[0] : null;

  // @ts-ignore
  const fields = petObject?.data?.content?.fields || {
    name: 'UNKNOWN',
    level: 1,
    hunger: 0,
    happiness: 0,
  };

  const foodList = foodData?.data || [];

  // — TOAST
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // — GPS WATCH
  useEffect(() => {
    if (viewMode !== 'map' && viewMode !== 'ar') return;

    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung GPS.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > 80) {
          setGpsError("Akurasi GPS sangat rendah (Wi-Fi / IP). Coba pakai HP.");
        } else {
          setGpsError(null);
        }

        const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(current);

        if (!target) {
          const newT = generateTarget(current.lat, current.lng);
          setTarget(newT);
          showToast("🎯 Target Baru Muncul!", "info");
        }

        if (target) {
          const d = getDistance(current.lat, current.lng, target.lat, target.lng);
          setDistance(d);
          setCanClaim(d < CONFIG.CLAIM_RADIUS);
        }
      },
      (err) => {
        console.error(err);
        setGpsError("Tidak dapat mengambil lokasi. Aktifkan GPS.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [viewMode, target]);

  // — CLAIM PET
  const handleCatch = async () => {
    if (!account || !gps) return;

    setIsMinting(true);

    try {
      const res = await fetch('/api/hunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account.address, lat: gps.lat, lng: gps.lng }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::core::catch_pet`,
        arguments: [
          tx.pure.vector('u8', data.signature),
          tx.pure.vector('u8', data.msg),
          tx.pure.string(String(gps.lat)),
          tx.pure.string(String(gps.lng)),
          tx.pure.u8(data.rarity),
          tx.pure.vector('u8', new TextEncoder().encode('Wild Pet')),
          tx.object('0x6'),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            showToast("Berhasil ditangkap!", "success");
            setTarget(null);
            setCanClaim(false);
            setDistance(null);
            setViewMode('dashboard');
            refetchPet();
          },
          onError: (e) => showToast("Gagal: " + e.message, "error"),
        },
      );
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsMinting(false);
    }
  };

  // — SIMPLE TX
  const exec = (targetFunc: string, args: any[], cb?: () => void) => {
    const tx = new Transaction();
    tx.moveCall({ target: targetFunc, arguments: args });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => cb && cb(),
        onError: (e) => showToast("Error TX: " + e.message, "error"),
      },
    );
  };

  // — PLAY / FEED / BUY FOOD
  const handlePlay = () => {
    if (!petObject?.data?.objectId) return;
    setPetAction('happy');
    exec(`${PACKAGE_ID}::core::play_pet`,
      [new Transaction().object(petObject.data.objectId), new Transaction().object('0x6')],
      () => {
        setPetAction('idle');
        refetchPet();
        showToast("Senang!", "success");
      }
    );
  };

  const handleBuyFood = () => {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100000000)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::shop::buy_food`,
      arguments: [tx.object(SHOP_ID), coin],
    });

    signAndExecute({ transaction: tx }, {
      onSuccess: () => {
        refetchFood();
        showToast("Makanan dibeli!", "success");
      },
    });
  };

  const handleFeed = (foodId: string) => {
    if (!petObject?.data?.objectId) return;
    setPetAction('eating');
    exec(
      `${PACKAGE_ID}::core::feed_pet`,
      [
        new Transaction().object(petObject.data.objectId),
        new Transaction().object(foodId),
        new Transaction().object('0x6'),
      ],
      () => {
        refetchFood();
        refetchPet();
        setPetAction('idle');
        showToast("Nyam nyam!", "success");
      }
    );
  };

  // — RESET TARGET
  const rerollTarget = () => {
    if (gps) {
      const newT = generateTarget(gps.lat, gps.lng);
      setTarget(newT);
      showToast("🎯 Target Baru Ditentukan!", "info");
    }
  };

  // =====================================================================
  // ============================ RENDER =================================
  // =====================================================================

  return (
    <main className="relative h-screen w-full bg-[#1a1a2e] overflow-hidden text-white font-mono">

      {/* TOAST */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[999]"
          >
            <div
              className={`
                mx-auto w-max px-6 py-3 rounded-full border-2 shadow-lg backdrop-blur-md flex items-center gap-2
                ${notification.type === 'success'
                    ? 'bg-green-500/90 border-green-700'
                    : notification.type === 'error'
                      ? 'bg-red-500/90 border-red-700'
                      : 'bg-blue-500/90 border-blue-700'}
              `}
            >
              {notification.type === 'success' && <CheckCircle size={18} />}
              {notification.type === 'error' && <AlertTriangle size={18} />}
              {notification.type === 'info' && <Navigation size={18} />}
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BACKGROUND */}
      <div className="absolute inset-0 opacity-20 bg-[url('/noise.png')] bg-cover pointer-events-none" />

      {/* HEADER */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-yellow-400 border-4 border-black px-4 py-2 shadow-[4px_4px_0px_black] -rotate-2 rounded-xl">
          <h1 className="font-['Press_Start_2P'] text-black text-sm md:text-base tracking-tight">
            SUI<span className="text-white">GO</span>
          </h1>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ConnectButton />
      </div>

      {/* ===================== DASHBOARD ===================== */}
      {viewMode === 'dashboard' && (
        <div className="relative h-full flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {(!account || (account && !hasPet)) ? (
              <IntroScene account={account} isPending={isPetLoading} refetch={refetchPet} />
            ) : (
              <DashboardCard
                petObject={petObject}
                fields={fields}
                petAction={petAction}
                setPetAction={setPetAction}
                handlePlay={handlePlay}
                setViewMode={setViewMode}
                handleBuyFood={handleBuyFood}
                setShowInventory={setShowInventory}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ===================== MAP MODE ===================== */}
      {viewMode === 'map' && (
        <MapScene
          gps={gps}
          gpsError={gpsError}
          distance={distance}
          target={target}
          canClaim={canClaim}
          rerollTarget={rerollTarget}
          setViewMode={setViewMode}
          handleCatch={handleCatch}
        />
      )}

      {/* ===================== AR MODE ===================== */}
      {viewMode === 'ar' && (
        <ARScene
          setViewMode={setViewMode}
          isMinting={isMinting}
          handleCatch={handleCatch}
        />
      )}

      {/* ===================== INVENTORY ===================== */}
      <InventoryModal
        showInventory={showInventory}
        setShowInventory={setShowInventory}
        foodList={foodList}
        handleFeed={handleFeed}
      />

    </main>
  );
}


/* ===========================================================================
    COMPONENTS — FULL UI (DASHBOARD / INTRO / MAP / AR / INVENTORY)
   =========================================================================== */

/* INTRO */
function IntroScene({ account, isPending, refetch }: any) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [petName, setPetName] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  const mint = () => {
    if (!petName) return;
    setIsMinting(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::core::mint_pet`,
      arguments: [tx.pure.string(petName), tx.object('0x6')],
    });

    signAndExecute({ transaction: tx }, {
      onSuccess: () => {
        setIsMinting(false);
        refetch();
      },
      onError: () => setIsMinting(false),
    });
  };

  // Not connected
  if (!account) return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative p-10 bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_black] max-w-sm text-center"
    >
      {/* Dot pattern */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle,_#d0d0d0_1.2px,_transparent_1.2px)] bg-[length:10px_10px]" />

      {/* Egg animation */}
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [0, -4, 4, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-6xl relative z-10"
      >
        🥚
      </motion.div>

      <h2 className="text-4xl font-['VT323'] text-black tracking-wide mt-4 relative z-10">
        SUI PET GO
      </h2>

      <p className="text-gray-600 font-mono text-sm mt-3 relative z-10">
        Sambungkan wallet untuk memulai petualangan mencari monster di dunia nyata!
      </p>

      <div className="mt-6 text-xs text-blue-500 font-bold animate-pulse border-t border-gray-300 pt-3 relative z-10">
        WAITING FOR CONNECTION...
      </div>
    </motion.div>
  );

  // Loading pet data
  if (isPending) return (
    <div className="flex flex-col items-center gap-6 text-white">
      <div className="w-16 h-16 border-8 border-white border-t-transparent rounded-full animate-spin" />
      <div className="text-2xl font-mono animate-pulse">LOADING...</div>
    </div>
  );

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative p-8 bg-white border-4 border-black rounded-3xl shadow-[10px_10px_0px_black] max-w-sm w-full"
    >
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle,_#e5e7eb_1px,_transparent_1px)] bg-[length:10px_10px]" />

      <div className="relative z-10">
        <h2 className="font-['VT323'] text-3xl text-black mb-2">PET BARU</h2>
        <p className="text-xs text-gray-600 font-mono">Kasih nama dulu sebelum menetas!</p>

        <input
          placeholder="Nama Pet"
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          className="mt-4 w-full border-2 border-black rounded-xl px-4 py-2 font-mono text-sm outline-none"
        />

        <button
          onClick={mint}
          disabled={isMinting || !petName}
          className="mt-4 bg-green-500 text-white w-full px-6 py-3 rounded-xl border-4 border-black font-bold text-lg shadow-[0_6px_0_#166534] active:translate-y-1 active:shadow-none disabled:opacity-50"
        >
          {isMinting ? "MINTING..." : "TETASKAN PET"}
        </button>
      </div>
    </motion.div>
  );
}

/* DASHBOARD */
function DashboardCard({ petObject, fields, petAction, setPetAction, handlePlay, setViewMode, handleBuyFood, setShowInventory }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md bg-[#f5f6fa] text-black rounded-t-3xl p-6 h-[85vh] flex flex-col justify-between border-4 border-black shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-['VT323']">{fields.name}</h1>
        <div className="mt-2 flex justify-center gap-2 text-xs font-mono">
          <span className="px-3 py-1 border-2 border-black rounded bg-yellow-300">
            LVL {fields.level}
          </span>
          <span className={`px-3 py-1 border-2 border-black rounded text-white ${fields.hunger < 30 ? 'bg-red-500' : 'bg-green-500'}`}>
            {fields.hunger < 30 ? "LAPAR" : "KENYANG"}
          </span>
        </div>
      </div>

      {/* PET VIEW */}
      <div className="relative flex-1 flex items-center justify-center">
        <motion.div
          animate={
            petAction === 'eating'
              ? { scale: [1, 1.2, 1] }
              : petAction === 'happy'
                ? { y: [0, -20, 0], rotate: [0, 3, -3, 0] }
                : { y: [0, -8, 0] }
          }
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="scale-[3]"
        >
          <div className="ghost-body">
            <div className="ghost-face" />
            <div className="ghost-skirt" />
          </div>
        </motion.div>
      </div>

      {/* STATUS */}
      <div className="space-y-3 bg-white p-4 border-2 border-gray-300 rounded-xl">
        <StatusBar label="HUNGER" value={fields.hunger} color="bg-orange-500" icon={<Utensils size={14} />} />
        <StatusBar label="HAPPY" value={fields.happiness} color="bg-pink-500" icon={<Heart size={14} />} />
      </div>

      {/* BUTTONS */}
      <div className="grid grid-cols-2 gap-3">
        <PixelButton label="MAIN" color="bg-blue-400" icon={<Gamepad2 />} onClick={handlePlay} />
        <PixelButton label="HUNTING" color="bg-green-500" icon={<MapIcon />} onClick={() => setViewMode('map')} />
        <PixelButton label="BELI MAKAN" color="bg-yellow-400" icon={<ShoppingBag />} onClick={handleBuyFood} />
        <PixelButton label="TAS" color="bg-purple-400" icon={<Utensils />} onClick={() => setShowInventory(true)} />
      </div>
    </motion.div>
  );
}

/* MAP VIEW */
function MapScene({ gps, gpsError, distance, target, canClaim, rerollTarget, setViewMode, handleCatch }: any) {
  return (
    <div className="absolute inset-0 bg-black flex flex-col">
      <div className="relative flex-1 border-b-4 border-black">
        {gps ? (
          <GameMap userPos={gps} targetPos={target} distance={distance} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-green-400 animate-pulse">
            <div className="text-4xl">🛰️</div>
            Mendapatkan Lokasi...
          </div>
        )}

        {gpsError && (
          <div className="absolute top-16 left-4 right-4 z-[100] flex justify-center">
            <div className="bg-red-600/90 text-white px-4 py-2 rounded-full border-2 border-black shadow-xl flex items-center gap-2">
              <AlertTriangle size={16} />
              {gpsError}
            </div>
          </div>
        )}

        {/* DISTANCE CARD */}
        <div className="absolute top-28 left-0 right-0 flex justify-center">
          <div className="bg-black/90 backdrop-blur-md border-2 border-green-500 px-6 py-3 rounded-xl text-center shadow-lg">
            <p className="text-xs text-green-300">JARAK</p>
            <h2 className="text-3xl font-bold">
              {distance ? distance.toFixed(0) : "--"}m
            </h2>
          </div>
        </div>

        {/* REROLL BUTTON */}
        <button
          onClick={rerollTarget}
          className="absolute top-28 right-4 bg-white text-black p-3 rounded-full border-2 border-black shadow-lg"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* BOTTOM PANEL */}
      <div className="bg-white text-black p-6 rounded-t-3xl border-t-4 border-black h-[25vh] flex flex-col items-center justify-between">
        {!canClaim ? (
          <div className="text-center">
            <p className="text-yellow-600 font-bold text-lg">⚠️ TARGET JAUH</p>
            <p className="text-sm text-gray-600">Mendekatlah ke ikon 🎁 di peta</p>
          </div>
        ) : (
          <div className="w-full">
            <button
              onClick={() => setViewMode('ar')}
              className="bg-red-600 text-white w-full px-6 py-4 rounded-xl border-4 border-black font-bold text-xl shadow-lg"
            >
              <Camera className="inline-block mr-2" /> AR MODE
            </button>
          </div>
        )}

        <button
          onClick={() => setViewMode('dashboard')}
          className="text-gray-500 underline text-xs"
        >
          Kembali
        </button>
      </div>
    </div>
  );
}

/* AR SCENE */
function ARScene({ setViewMode, isMinting, handleCatch }: any) {
  return (
    <div className="absolute inset-0 bg-black">
      <Webcam
        audio={false}
        className="absolute inset-0 w-full h-full object-cover opacity-70"
        videoConstraints={{ facingMode: 'environment' }}
      />

      <div className="absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex justify-between">
          <button
            onClick={() => setViewMode('map')}
            className="bg-black/60 border-2 border-white p-3 rounded-full text-white"
          >
            <X />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, rotateY: 180 }}
            animate={{ scale: 1, rotateY: 0 }}
            className="cursor-pointer"
            onClick={handleCatch}
          >
            <div className="ghost-body scale-[3]">
              <div className="ghost-face" />
              <div className="ghost-skirt" />
            </div>
          </motion.div>
        </div>

        <button
          disabled={isMinting}
          onClick={handleCatch}
          className="bg-green-600 px-6 py-3 rounded-xl border-2 border-white text-white font-bold text-xl shadow-lg disabled:opacity-40"
        >
          {isMinting ? "MINTING..." : "TANGKAP"}
        </button>
      </div>
    </div>
  );
}

/* INVENTORY */
function InventoryModal({ showInventory, setShowInventory, foodList, handleFeed }: any) {
  return (
    <AnimatePresence>
      {showInventory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]"
        >
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            className="bg-white text-black rounded-3xl border-4 border-black p-6 w-full max-w-md"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-['VT323'] text-3xl">INVENTORY</h2>
              <button
                onClick={() => setShowInventory(false)}
                className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-black"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto space-y-3">
              {foodList.length === 0 ? (
                <p className="text-center text-gray-500 text-sm">Kosong.</p>
              ) : (
                foodList.map((f: any) => (
                  <div key={f.data.objectId} className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-4 flex justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 border-2 border-yellow-300 rounded-xl flex items-center justify-center text-xl">
                        🍗
                      </div>
                      <div>
                        <p className="font-bold text-sm">Chicken Nugget</p>
                        <p className="text-[10px] text-gray-500">STAMINA +50</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFeed(f.data.objectId)}
                      className="bg-green-500 text-white px-4 py-2 rounded-xl border-2 border-green-700"
                    >
                      PAKAI
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* STATUS BAR */
function StatusBar({ label, value, color, icon }: any) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3 text-xs font-bold">
      <div className="w-20 flex items-center gap-1 text-gray-600">{icon} {label}</div>
      <div className="flex-1 h-4 border-2 border-gray-300 rounded-full overflow-hidden bg-gray-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      <div className="w-8 text-right">{value}</div>
    </div>
  );
}

/* PIXEL BUTTON */
function PixelButton({ label, color, icon, onClick }: any) {
  return (
    <button onClick={onClick} className="relative group active:top-[4px] transition-all">
      <div className="absolute inset-0 bg-black rounded-xl translate-y-[6px]" />
      <div className={`relative ${color} border-4 border-black rounded-xl p-4 flex flex-col items-center shadow-inner`}>
        <div className="text-black">{icon}</div>
        <span className="font-['VT323'] font-bold text-lg">{label}</span>
      </div>
    </button>
  );
}