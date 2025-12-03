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

const GameMap = dynamic(() => import('../components/GameMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-green-500 font-mono animate-pulse">
      <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="tracking-widest text-xs">MENGHUBUNGKAN SATELIT...</p>
    </div>
  ),
});

const CONFIG = {
  SPAWN_MIN_DIST: 30,
  SPAWN_MAX_DIST: 150,
  CLAIM_RADIUS: 15,
  GPS_TIMEOUT: 15000,
  GPS_MAX_AGE: 5000,
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateTarget(lat: number, lng: number) {
  const angle = Math.random() * Math.PI * 2;
  const dist = CONFIG.SPAWN_MIN_DIST + Math.random() * (CONFIG.SPAWN_MAX_DIST - CONFIG.SPAWN_MIN_DIST);
  const dLat = (dist * Math.cos(angle)) / 111000;
  const dLng = (dist * Math.sin(angle)) / (111000 * Math.cos((lat * Math.PI) / 180));

  return {
    lat: lat + dLat,
    lng: lng + dLng,
    id: Date.now(),
  };
}

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [viewMode, setViewMode] = useState<'dashboard' | 'map' | 'ar'>('dashboard');
  const [showInventory, setShowInventory] = useState(false);
  const [petAction, setPetAction] = useState<'idle' | 'happy' | 'eating'>('idle');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    msg: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const {
    data: petData,
    isPending: isPetLoading,
    refetch: refetchPet,
  } = useSuiClientQuery(
    'getOwnedObjects',
    { owner: account?.address as string, filter: { StructType: PET_TYPE }, options: { showContent: true } },
    { enabled: !!account, refetchInterval: 5000 },
  );

  const { data: foodData, refetch: refetchFood } = useSuiClientQuery(
    'getOwnedObjects',
    { owner: account?.address as string, filter: { StructType: FOOD_TYPE } },
    { enabled: !!account },
  );

  const hasPet = petData?.data && petData.data.length > 0;
  const petObject = hasPet ? petData.data[0] : null;
  const foodList = foodData?.data || [];

  // @ts-ignore
  const fields = petObject?.data?.content?.fields || {
    name: 'UNKNOWN',
    level: 1,
    hunger: 0,
    happiness: 0,
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (viewMode === 'map' || viewMode === 'ar') {
      if (!navigator.geolocation) {
        setGpsError('Browser ini tidak mendukung GPS.');
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGps(current);
          setGpsError(null);

          if (!target) {
            const newT = generateTarget(current.lat, current.lng);
            setTarget(newT);
            showToast('🎯 Target Baru Terdeteksi!', 'info');
          }

          if (target) {
            const d = getDistance(current.lat, current.lng, target.lat, target.lng);
            setDistance(d);
            setCanClaim(d < CONFIG.CLAIM_RADIUS);
          }
        },
        (err) => {
          console.error('GPS Error:', err);
          setGpsError('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
        },
        { enableHighAccuracy: true, maximumAge: CONFIG.GPS_MAX_AGE, timeout: CONFIG.GPS_TIMEOUT },
      );

      return () => navigator.geolocation.clearWatch(id);
    }
  }, [viewMode, target]);

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
          tx.pure.string(gps.lat.toString()),
          tx.pure.string(gps.lng.toString()),
          tx.pure.u8(data.rarity),
          tx.pure.vector('u8', new TextEncoder().encode('Wild Pet')),
          tx.object('0x6'),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            showToast('BERHASIL! Pet ditangkap.', 'success');
            setTarget(null);
            setCanClaim(false);
            setDistance(null);
            setViewMode('dashboard');
            refetchPet();
          },
          onError: (e) => showToast('Gagal: ' + e.message, 'error'),
        },
      );
    } catch (e: any) {
      showToast(e.message || 'Terjadi Kesalahan', 'error');
    } finally {
      setIsMinting(false);
    }
  };

  const executeSimpleTx = (targetFunc: string, args: any[], onSuccessCb?: () => void) => {
    const tx = new Transaction();
    tx.moveCall({ target: targetFunc, arguments: args });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: onSuccessCb,
        onError: (e) => showToast('Transaksi Gagal: ' + e.message, 'error'),
      },
    );
  };

  const handlePlay = () => {
    if (!petObject?.data?.objectId) return;
    setPetAction('happy');
    executeSimpleTx(
      `${PACKAGE_ID}::core::play_pet`,
      [new Transaction().object(petObject.data.objectId), new Transaction().object('0x6')],
      () => {
        setPetAction('idle');
        refetchPet();
        showToast('Pet kamu senang!', 'success');
      },
    );
  };

  const handleBuyFood = () => {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100000000)]); // 0.1 SUI
    tx.moveCall({
      target: `${PACKAGE_ID}::shop::buy_food`,
      arguments: [tx.object(SHOP_ID), coin],
    });
    signAndExecute({ transaction: tx }, {
      onSuccess: () => {
        refetchFood();
        showToast('Berhasil membeli Makanan!', 'success');
      },
    });
  };

  const handleFeed = (foodId: string) => {
    if (!petObject?.data?.objectId) return;
    setPetAction('eating');
    executeSimpleTx(
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
        showToast('Nyam nyam! Kenyang.', 'success');
      },
    );
  };

  const rerollTarget = () => {
    if (gps) {
      setTarget(generateTarget(gps.lat, gps.lng));
      showToast('Target baru ditetapkan!', 'info');
    }
  };

  return (
    <main className="relative h-screen w-full bg-[#1a1a2e] overflow-hidden text-white font-mono select-none">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none"
          >
            <div
              className={`px-6 py-3 rounded-full shadow-2xl border-2 border-white/20 backdrop-blur-md flex items-center gap-3 font-bold
                ${
                  notification.type === 'success'
                    ? 'bg-green-500/90'
                    : notification.type === 'error'
                    ? 'bg-red-500/90'
                    : 'bg-blue-500/90'
                }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle size={20} />
              ) : notification.type === 'error' ? (
                <AlertTriangle size={20} />
              ) : (
                <Navigation size={20} />
              )}
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/b/bd/Google_Maps_Manhattan.png')] bg-cover filter grayscale pointer-events-none" />

      <div className="absolute top-4 left-4 z-50 pointer-events-none">
        <div className="bg-yellow-400 border-4 border-black px-4 py-2 shadow-[4px_4px_0px_black] -rotate-2 rounded-xl">
          <h1 className="font-['Press_Start_2P'] text-black text-sm md:text-base tracking-tighter">
            SUI<span className="text-white text-stroke-sm">GO</span>
          </h1>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ConnectButton />
      </div>

      {viewMode === 'dashboard' && (
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {!account || (account && !hasPet) ? (
              <IntroScene account={account} isPending={isPetLoading} refetch={refetchPet} />
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-[#f5f6fa] text-black rounded-t-3xl p-6 h-[85vh] flex flex-col justify-between border-4 border-black shadow-[0_-10px_50px_rgba(0,0,0,0.7)]"
              >
                <div className="text-center mt-2">
                  <h1 className="text-5xl font-bold uppercase font-['VT323'] tracking-widest text-gray-800 drop-shadow-sm">
                    {fields.name}
                  </h1>
                  <div className="flex justify-center gap-3 mt-2 font-mono text-xs font-bold tracking-widest">
                    <span className="bg-yellow-400 px-3 py-1 border-2 border-black rounded shadow-sm">
                      LVL {fields.level}
                    </span>
                    <span
                      className={`px-3 py-1 border-2 border-black rounded text-white shadow-sm ${
                        fields.hunger < 30 ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                      }`}
                    >
                      {fields.hunger < 30 ? 'STARVING' : 'FULL'}
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center relative">
                  <div className="absolute top-10 right-6 bg-white border-2 border-black px-4 py-2 rounded-xl rounded-bl-none animate-bounce shadow-md z-10">
                    <p className="text-xs font-bold">
                      {petAction === 'eating'
                        ? 'NYAM NYAM! 🍗'
                        : fields.hunger < 30
                        ? 'LAPAR...'
                        : fields.happiness < 30
                        ? 'BOSAN...'
                        : 'AYO JALAN!'}
                    </p>
                  </div>

                  <motion.div
                    animate={
                      petAction === 'happy'
                        ? { y: [0, -40, 0], rotate: [0, 5, -5, 0] }
                        : petAction === 'eating'
                        ? { scale: [1, 1.2, 1] }
                        : { y: [0, -10, 0] }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: petAction === 'idle' ? 2 : 0.5,
                    }}
                    className="scale-[3] filter drop-shadow-xl"
                  >
                    <div className="ghost-body">
                      <div className="ghost-face" />
                      <div className="ghost-skirt" />
                    </div>
                  </motion.div>
                </div>
                <div className="space-y-3 mb-6 bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-inner">
                  <StatusBar
                    label="HUNGER"
                    value={fields.hunger || 0}
                    color="bg-orange-500"
                    icon={<Utensils size={14} />}
                  />
                  <StatusBar
                    label="HAPPY"
                    value={fields.happiness || 0}
                    color="bg-pink-500"
                    icon={<Heart size={14} />}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PixelButton label="MAIN" color="bg-blue-400" icon={<Gamepad2 />} onClick={handlePlay} />
                  <PixelButton
                    label="HUNTING"
                    color="bg-green-500"
                    icon={<MapIcon />}
                    onClick={() => setViewMode('map')}
                  />
                  <PixelButton
                    label="BELI MAKAN"
                    color="bg-yellow-400"
                    icon={<ShoppingBag />}
                    onClick={handleBuyFood}
                  />
                  <PixelButton
                    label="TAS"
                    color="bg-purple-400"
                    icon={<Utensils />}
                    onClick={() => setShowInventory(true)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="absolute inset-0 bg-gray-900 z-40 flex flex-col">
          <div className="flex-1 relative border-b-4 border-black bg-black">
            {gps ? (
              <GameMap userPos={gps} targetPos={target} distance={distance} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-green-400 animate-pulse font-mono bg-black">
                <div className="text-4xl mb-2">🛰️</div>
                <div>MENCARI SINYAL GPS.</div>
                <div className="text-xs text-gray-500 mt-2">Pastikan Izin Lokasi Aktif</div>
              </div>
            )}
            {gpsError && (
              <div className="absolute top-16 left-4 right-4 z-[1001] flex justify-center pointer-events-none">
                <div className="bg-red-600/95 text-white text-xs md:text-sm px-4 py-2 rounded-full border-2 border-black shadow-lg flex items-center gap-2 pointer-events-auto">
                  <AlertTriangle size={14} />
                  <span>{gpsError}</span>
                </div>
              </div>
            )}
            <div className="absolute top-24 left-4 right-4 z-[1000] flex flex-col items-center pointer-events-none gap-2">
              <div className="bg-black/90 border-2 border-green-500 px-6 py-3 rounded-2xl text-center shadow-lg backdrop-blur-md w-full max-w-xs">
                <p className="text-[10px] text-green-400 font-bold tracking-widest mb-1">JARAK KE TARGET</p>
                {distance ? (
                  <h2 className="text-4xl font-mono font-bold text-white">
                    {distance.toFixed(0)}
                    <span className="text-sm text-gray-400">m</span>
                  </h2>
                ) : (
                  <h2 className="text-xl font-mono text-yellow-400">---</h2>
                )}
              </div>
            </div>
            <button
              onClick={rerollTarget}
              className="absolute top-24 right-4 z-[1000] bg-white text-black p-3 rounded-full border-2 border-black shadow-xl active:scale-90"
              title="Cari Target Lain"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          <div className="h-[25vh] bg-[#f5f6fa] p-6 flex flex-col justify-between items-center rounded-t-3xl border-t-4 border-black shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 relative text-black">
            <div className="text-center w-full">
              {!canClaim ? (
                <div className="space-y-2">
                  <p className="text-yellow-600 font-bold animate-pulse text-lg">⚠️ TARGET JAUH</p>
                  <p className="text-sm text-gray-500">Jalan mendekati ikon 🎁 di peta.</p>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  <p className="text-green-600 font-bold text-xl animate-bounce">TARGET DALAM JANGKAUAN!</p>
                  <button
                    onClick={() => setViewMode('ar')}
                    className="bg-red-600 text-white w-full px-8 py-4 rounded-xl border-4 border-black font-bold text-xl shadow-lg active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 hover:bg-red-700"
                  >
                    <Camera /> BUKA KAMERA
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setViewMode('dashboard')}
              className="text-gray-400 font-bold hover:text-red-500 underline decoration-2 text-sm"
            >
              KEMBALI KE DASHBOARD
            </button>
          </div>
        </div>
      )}

      {viewMode === 'ar' && (
        <div className="absolute inset-0 z-50 bg-black">
          <Webcam
            audio={false}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            videoConstraints={{ facingMode: 'environment' }}
            onUserMediaError={(e) => alert('Kamera Error: ' + e)}
          />
          <div className="absolute inset-0 p-6 flex flex-col justify-between z-50">
            <div className="flex justify-between pointer-events-auto">
              <button
                onClick={() => setViewMode('map')}
                className="bg-black/60 p-3 rounded-full text-white border-2 border-white backdrop-blur-md hover:bg-red-600 transition-colors"
              >
                <X />
              </button>
              <div className="bg-red-600/90 px-4 py-2 rounded-full text-xs font-bold animate-pulse border-2 border-white text-white shadow-lg backdrop-blur-md flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" /> LIVE FEED
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center pointer-events-auto perspective-1000">
              <motion.div
                initial={{ scale: 0, rotateY: 180, opacity: 0 }}
                animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.6, duration: 0.8 }}
                className="cursor-pointer relative group"
                onClick={handleCatch}
              >
                <div className="ghost-body scale-[3.5] filter drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] border-4 border-black">
                  <div className="ghost-face" />
                  <div className="ghost-skirt" />
                </div>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-1 rounded-full border-2 border-white text-xs font-bold tracking-widest">
                  TAP UNTUK MENANGKAP
                </div>
              </motion.div>
            </div>
            <div className="flex justify-between items-center text-xs text-white/80 pointer-events-auto">
              <span>Jaga jarak & pastikan aman saat bermain.</span>
              <button
                disabled={isMinting}
                onClick={handleCatch}
                className="bg-green-500 px-4 py-2 rounded-full border-2 border-white font-bold text-xs shadow-lg active:translate-y-1 active:shadow-none disabled:opacity-50"
              >
                {isMinting ? 'MINTING...' : 'TANGKAP SEKARANG'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showInventory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-[#f5f6fa] text-black rounded-3xl border-4 border-black p-6 w-full max-w-md shadow-[0_0_40px_rgba(0,0,0,0.7)]"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-['VT323'] text-3xl tracking-widest">INVENTORY</h2>
                <button
                  onClick={() => setShowInventory(false)}
                  className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center border-2 border-black"
                >
                  <X size={16} />
                </button>
              </div>

              {foodList.length === 0 ? (
                <div className="text-center text-gray-500 text-sm">Tas kamu kosong. Beli makanan dulu.</div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {foodList.map((f: any) => (
                    <div
                      key={f.data?.objectId}
                      className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-300 px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center text-2xl">
                          🍗
                        </div>
                        <div>
                          <p className="font-bold text-sm">Chicken Nugget</p>
                          <p className="text-[10px] text-gray-500 border border-dashed border-gray-300 px-2 py-0.5 rounded w-fit">
                            STAMINA +50
                          </p>
                        </div>
                      </div>
                      <button
                        className="bg-green-500 text-white px-5 py-2 rounded-xl font-bold shadow-[0_4px_0_#15803d] active:translate-y-1 active:shadow-none transition-all text-sm border-2 border-green-700 hover:bg-green-400"
                        onClick={() => handleFeed(f.data?.objectId)}
                      >
                        PAKAI
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StatusBar({ label, value, color, icon }: any) {
  const percentage = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3 text-xs md:text-sm font-bold text-gray-700">
      <div className="w-24 flex items-center gap-2 text-gray-500">
        {icon} {label}
      </div>
      <div className="flex-1 h-5 border-2 border-gray-300 rounded-full p-0.5 bg-gray-100 relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full ${color} rounded-full relative shadow-sm`}
        >
          <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/20 blur-sm" />
        </motion.div>
      </div>
      <div className="w-8 text-right font-mono text-black">{value}</div>
    </div>
  );
}

function PixelButton({ label, color, icon, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group w-full active:top-[4px] transition-all ${
        disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:-translate-y-1'
      }`}
    >
      <div className="absolute inset-0 bg-black rounded-xl translate-y-[6px] transition-transform" />
      <div
        className={`relative ${color} border-4 border-black rounded-xl p-4 flex flex-col items-center justify-center h-full shadow-inner`}
      >
        <div className="text-black mb-1 scale-110">{icon}</div>
        <span className="font-['VT323'] font-bold text-xl text-black tracking-widest">{label}</span>
      </div>
    </button>
  );
}

function IntroScene({ account, isPending, refetch }: any) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [petName, setPetName] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = () => {
    if (!petName) return;
    setIsMinting(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::core::mint_pet`,
      arguments: [tx.pure.string(petName), tx.object('0x6')],
    });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setIsMinting(false);
          refetch();
        },
        onError: () => setIsMinting(false),
      },
    );
  };

  if (!account)
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="pop-card p-10 text-center bg-white rounded-3xl max-w-sm border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,0.5)]"
      >
        <div className="text-6xl mb-4 animate-bounce">🥚</div>
        <h2 className="text-4xl font-bold uppercase mb-4 text-black font-['VT323']">SUI PET GO</h2>
        <p className="text-gray-600 font-mono text-sm mb-8 leading-relaxed">
          Sambungkan Wallet SUI Anda untuk memulai petualangan mencari monster di dunia nyata!
        </p>
        <div className="animate-pulse text-xs text-blue-500 font-bold border-t border-gray-200 pt-4">
          WAITING FOR CONNECTION.
        </div>
      </motion.div>
    );

  if (isPending)
    return (
      <div className="flex flex-col items-center gap-6 text-white">
        <div className="w-20 h-20 border-8 border-white border-t-transparent rounded-full animate-spin" />
        <div className="text-3xl font-bold animate-pulse font-mono tracking-widest">LOADING.</div>
      </div>
    );

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="pop-card p-8 w-full max-w-sm bg-white rounded-3xl border-4 border-black shadow-[10px_10px_0px_rgba(0,0,0,0.6)] flex flex-col gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-yellow-200 border-4 border-black flex items-center justify-center text-4xl">
          👻
        </div>
        <div>
          <h2 className="text-3xl font-['VT323'] text-black tracking-widest">PILIH PET MU</h2>
          <p className="text-xs text-gray-500 font-mono">Berikan nama untuk pet pertamamu.</p>
        </div>
      </div>

      <input
        value={petName}
        onChange={(e) => setPetName(e.target.value)}
        placeholder="Nama Pet"
        className="w-full border-2 border-black rounded-xl px-4 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        onClick={handleMint}
        disabled={isMinting || !petName}
        className="bg-green-500 text-white w-full px-6 py-3 rounded-xl border-4 border-black font-bold text-lg shadow-[0_6px_0_#166534] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isMinting ? 'MINTING...' : 'MULAI PETUALANGAN'}
      </button>
    </motion.div>
  );
}