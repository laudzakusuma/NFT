'use client';

import { 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery 
} from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState, useEffect } from 'react';
import { PET_TYPE, PACKAGE_ID, SHOP_ID, FOOD_TYPE } from '../utils/contracts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Heart,
  Utensils,
  X,
  Map as MapIcon,
  RefreshCw,
  Camera,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Gift,
  Sparkles,
  Zap,
  Crosshair
} from 'lucide-react';
import Webcam from 'react-webcam';
import dynamic from 'next/dynamic';

const GameMap = dynamic(() => import('../components/GameMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a2e] text-green-500 font-mono animate-pulse">
      <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="tracking-widest text-xs font-bold">MENGHUBUNGKAN SATELIT...</p>
    </div>
  ),
});

const CONFIG = {
  SPAWN_MIN_DIST: 30,
  SPAWN_MAX_DIST: 150,
  CLAIM_RADIUS: 20,
  GPS_TIMEOUT: 15000,
  GPS_MAX_AGE: 5000,
  GACHA_COST: 100000000,
};

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98, filter: 'blur(4px)' },
  in: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  out: { opacity: 0, y: -20, scale: 0.98, filter: 'blur(4px)' },
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5,
} as const;

type ViewMode = 'dashboard' | 'map' | 'ar' | 'gacha';
type PetAction = 'idle' | 'happy' | 'eating' | 'sad';
type GachaState = 'ready' | 'processing' | 'shaking' | 'preview' | 'claiming';

interface Coords {
  lat: number;
  lng: number;
}

interface Target extends Coords {
  id: number;
  type?: 'common' | 'rare';
}

interface PetFields {
  name: string;
  level: number;
  hunger: number;
  happiness: number;
}

interface GachaReward {
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic';
}

/**
 * @returns Jarak dalam meter
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function generateTarget(lat: number, lng: number): Target {
  const angle = Math.random() * Math.PI * 2;
  const dist = CONFIG.SPAWN_MIN_DIST + Math.random() * (CONFIG.SPAWN_MAX_DIST - CONFIG.SPAWN_MIN_DIST);
  const dLat = (dist * Math.cos(angle)) / 111000;
  const dLng = (dist * Math.sin(angle)) / (111000 * Math.cos((lat * Math.PI) / 180));

  return {
    lat: lat + dLat,
    lng: lng + dLng,
    id: Date.now(),
    type: Math.random() > 0.8 ? 'rare' : 'common',
  };
}

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showInventory, setShowInventory] = useState(false);
  const [petAction, setPetAction] = useState<PetAction>('idle');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [gps, setGps] = useState<Coords | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gachaState, setGachaState] = useState<GachaState>('ready');
  const [gachaReward, setGachaReward] = useState<GachaReward | null>(null);
  const {
    data: petData,
    isPending: isPetLoading,
    refetch: refetchPet,
  } = useSuiClientQuery(
    'getOwnedObjects',
    { 
      owner: account?.address as string, 
      filter: { StructType: PET_TYPE }, 
      options: { showContent: true, showDisplay: true } 
    },
    { enabled: !!account, refetchInterval: 5000 },
  );

  const { 
    data: foodData, 
    refetch: refetchFood 
  } = useSuiClientQuery(
    'getOwnedObjects',
    { 
      owner: account?.address as string, 
      filter: { StructType: FOOD_TYPE },
      options: { showContent: true }
    },
    { enabled: !!account },
  );

  const hasPet = petData?.data && petData.data.length > 0;
  const petObject = hasPet ? petData.data[0] : null;
  // @ts-ignore
  const petFields = (petObject?.data?.content?.fields as PetFields) || { name: 'UNKNOWN', level: 1, hunger: 0, happiness: 0 };
  const foodList = foodData?.data || [];

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (viewMode === 'map' || viewMode === 'ar') {
      if (!navigator.geolocation) {
        setGpsError('Browser tidak mendukung GPS');
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGps(current);
          setGpsError(null);
          if (!target) {
            setTarget(generateTarget(current.lat, current.lng));
            showToast('Sinyal Monster Terdeteksi!', 'info');
          }

          if (target) {
            const d = getDistance(current.lat, current.lng, target.lat, target.lng);
            setDistance(d);
            setCanClaim(d < CONFIG.CLAIM_RADIUS);
          }
        },
        (err) => {
          console.error('GPS Error:', err);
          setGpsError('Sinyal GPS Hilang! Cek Lokasi.');
        },
        { enableHighAccuracy: true, maximumAge: CONFIG.GPS_MAX_AGE, timeout: CONFIG.GPS_TIMEOUT },
      );

      return () => navigator.geolocation.clearWatch(id);
    }
  }, [viewMode, target]);

  const executeTransaction = (
    buildTx: (tx: Transaction) => void,
    onSuccess: () => void,
    onError: () => void = () => {}
  ) => {
    const tx = new Transaction();
    buildTx(tx);
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => onSuccess(),
        onError: (e) => {
          console.error(e);
          showToast('Transaksi Gagal: ' + e.message, 'error');
          onError();
        },
      },
    );
  };

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

      executeTransaction(
        (tx) => {
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
        },
        () => {
          showToast('BERHASIL! Pet ditangkap.', 'success');
          setTarget(null); 
          setCanClaim(false); 
          setDistance(null); 
          setViewMode('dashboard'); 
          refetchPet();
          setIsMinting(false);
        },
        () => setIsMinting(false)
      );

    } catch (e: any) {
      showToast(e.message || 'Server Error', 'error');
      setIsMinting(false);
    }
  };

  const handlePlay = () => {
    if (!petObject?.data?.objectId) return;
    setPetAction('happy');
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::core::play_pet`,
          arguments: [tx.object(petObject.data!.objectId), tx.object('0x6')],
        });
      },
      () => {
        setPetAction('idle');
        refetchPet();
        showToast('Pet kamu senang! (+EXP)', 'success');
      }
    );
  };

  const handleFeed = (foodId: string) => {
    if (!petObject?.data?.objectId) return;
    setPetAction('eating');
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${PACKAGE_ID}::core::feed_pet`,
          arguments: [tx.object(petObject.data!.objectId), tx.object(foodId), tx.object('0x6')],
        });
      },
      () => {
        refetchFood();
        refetchPet();
        setPetAction('idle');
        showToast('Nyam nyam! Kenyang.', 'success');
      }
    );
  };

  const rerollTarget = () => {
    if (gps) {
      setTarget(generateTarget(gps.lat, gps.lng));
      showToast('Target baru ditetapkan!', 'info');
    }
  };

  const startGachaAnimation = () => {
    setGachaState('shaking');
    setTimeout(() => {
      const rewards: GachaReward[] = [
        { name: 'Golden Nugget', icon: '🍗', rarity: 'common' },
        { name: 'Energy Drink', icon: '🥤', rarity: 'common' },
        { name: 'Burger Deluxe', icon: '🍔', rarity: 'rare' },
      ];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      setGachaReward(reward);
      setGachaState('preview');
    }, 2500);
  };

  const confirmGacha = () => {
    setGachaState('claiming');
    
    executeTransaction(
      (tx) => {
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(CONFIG.GACHA_COST)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::shop::buy_food`,
          arguments: [tx.object(SHOP_ID), coin],
        });
      },
      () => {
        refetchFood();
        showToast(`${gachaReward?.name} ditambahkan!`, 'success');
        setGachaState('ready');
        setGachaReward(null);
      },
      () => {
        setGachaState('preview');
      }
    );
  };

  const cancelGacha = () => {
    setGachaState('ready');
    setGachaReward(null);
  };

  return (
    <main className="relative h-[100dvh] w-full bg-[#1a1a2e] animated-grid-bg overflow-hidden text-white font-mono select-none flex flex-col">
      <div className="absolute inset-0 crt-overlay z-[1] pointer-events-none" />
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none"
          >
            <div className={`px-5 py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.5)] flex items-center gap-3 font-bold text-sm md:text-base font-['VT323'] tracking-wider uppercase
              ${notification.type === 'success' ? 'bg-[#2ecc71] text-black' : notification.type === 'error' ? 'bg-[#ff4757] text-white' : 'bg-[#feca57] text-black'}
            `}>
              {notification.type === 'success' ? <CheckCircle size={20} /> : notification.type === 'error' ? <AlertTriangle size={20} /> : <Navigation size={20} />}
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {gpsError && viewMode !== 'dashboard' && (
        <div className="fixed top-24 left-0 right-0 z-[9990] flex justify-center pointer-events-none">
          <div className="bg-red-600 border-2 border-white text-white px-4 py-2 rounded shadow-lg animate-pulse text-xs font-bold font-['Press_Start_2P'] flex items-center gap-2">
            <AlertTriangle size={14} /> {gpsError}
          </div>
        </div>
      )}
      {account && (
        <div className="absolute top-0 left-0 right-0 p-4 z-[100] flex justify-between items-start pointer-events-none">
          <div className="bg-[#feca57] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_black] -rotate-2 rounded-md pointer-events-auto hover:rotate-0 transition-transform cursor-pointer" onClick={() => setViewMode('dashboard')}>
            <h1 className="font-['Press_Start_2P'] text-black text-[10px] md:text-xs tracking-tighter">
              SUI<span className="text-white text-stroke-sm">GO</span>
            </h1>
          </div>
          <div className="pointer-events-auto scale-90 origin-top-right btn-pixel bg-white text-black shadow-none border-2 border-black rounded-lg">
             <ConnectButton className="!bg-transparent !text-black !font-['VT323'] !font-bold" />
          </div>
        </div>
      )}
      <div className="flex-1 relative w-full h-full z-10">
        <AnimatePresence mode="wait">
          {(!account || (account && !hasPet)) && viewMode === 'dashboard' && (
             <motion.div key="intro" className="absolute inset-0 z-50">
                <IntroScene account={account} isPending={isPetLoading} refetch={refetchPet} />
             </motion.div>
          )}

          {account && hasPet && viewMode === 'dashboard' && (
            <DashboardView 
               key="dashboard"
               petFields={petFields}
               petAction={petAction}
               setPetAction={setPetAction}
               handlePlay={handlePlay}
               setViewMode={setViewMode}
               setShowInventory={setShowInventory}
            />
          )}

          {viewMode === 'gacha' && (
            <GachaView
               key="gacha"
               state={gachaState}
               reward={gachaReward}
               onPlay={startGachaAnimation}
               onConfirm={confirmGacha}
               onCancel={cancelGacha}
               onBack={() => setViewMode('dashboard')}
            />
          )}
          {viewMode === 'map' && (
             <MapView 
               key="map"
               gps={gps}
               target={target}
               distance={distance}
               canClaim={canClaim}
               rerollTarget={rerollTarget}
               setViewMode={setViewMode}
             />
          )}
          {viewMode === 'ar' && (
            <ARView 
               key="ar"
               onCatch={handleCatch}
               isMinting={isMinting}
               onClose={() => setViewMode('map')}
            />
          )}

        </AnimatePresence>
      </div>
      <InventoryModal 
        isOpen={showInventory} 
        onClose={() => setShowInventory(false)} 
        items={foodList} 
        onUse={handleFeed} 
      />

    </main>
  );
}

function DashboardView({ petFields, petAction, setPetAction, handlePlay, setViewMode, setShowInventory, petId }: any) {
  
  const monsterTypeIndex = petId ? parseInt(petId.slice(-1), 16) % 4 : 0;
  
  const getMonsterClass = () => {
    switch (monsterTypeIndex) {
      case 0: return 'monster-bunnyo';
      case 1: return 'monster-sproutle';
      case 2: return 'monster-toasty';
      case 3: return 'monster-nimbus';
      default: return 'monster-bunnyo';
    }
  };

  const getBgColor = () => {
    switch (monsterTypeIndex) {
      case 0: return 'bg-pink-100 border-pink-300';
      case 1: return 'bg-green-100 border-green-300';
      case 2: return 'bg-orange-100 border-orange-300';
      case 3: return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="relative h-full flex flex-col items-center justify-center p-4">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="w-full max-w-md pixel-card p-5 h-[80vh] flex flex-col justify-between relative z-20">
        <div className="flex justify-between items-end border-b-2 border-dashed border-gray-300 pb-2 text-black">
          <div>
            <h1 className="text-6xl font-bold uppercase font-['VT323'] leading-none text-white text-stroke-md tracking-widest drop-shadow-sm">{petFields.name}</h1>
            <span className="text-xs font-bold text-gray-500 font-['Press_Start_2P'] mt-1 block">LVL {petFields.level} • {['JELLY', 'PLANT', 'MECH', 'CLOUD'][monsterTypeIndex]} TYPE</span>
          </div>
          <div className={`px-2 py-1 border-2 border-black text-[10px] font-bold ${petFields.hunger < 30 ? 'bg-red-500 text-white animate-pulse' : 'bg-green-400 text-black'}`}>{petFields.hunger < 30 ? '! LAPAR' : 'KENYANG'}</div>
        </div>
        <div className={`flex-1 flex items-center justify-center relative my-4 ${getBgColor()} rounded-lg border-4 border-black inner-shadow overflow-hidden group cursor-pointer`} onClick={() => setPetAction('happy')}>
            <div className="absolute inset-0 opacity-20 animated-grid-bg bg-black/5"></div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4 bg-white border-2 border-black px-3 py-1 rounded-lg rounded-bl-none animate-bounce shadow-sm z-10 text-black">
              <p className="text-[10px] font-bold font-['Press_Start_2P']">{petAction === 'eating' ? 'NYAM!' : petFields.hunger < 30 ? 'LAPAR..' : petFields.happiness < 30 ? 'BOSAN.' : 'HAI!'}</p>
            </motion.div>
            <motion.div animate={petAction === 'happy' ? { y: [0, -40, 0], rotate: [0, 10, -10, 5, -5, 0], scale: 1.1 } : petAction === 'eating' ? { scale: [1, 1.3, 0.9, 1.1, 1], rotate: [0, -5, 5, 0] } : {} } transition={{ duration: 0.6, ease: "easeInOut" }} className={`scale-[3] filter drop-shadow-lg relative z-10`}>
              <div className={getMonsterClass()}></div>
            </motion.div>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-100 p-3 rounded-lg border-2 border-gray-300"><StatusBar label="HP" value={petFields.hunger || 0} color="bg-orange-500" icon={<Utensils size={12} />} /><StatusBar label="JOY" value={petFields.happiness || 0} color="bg-pink-500" icon={<Heart size={12} />} /></div>
          <div className="grid grid-cols-4 gap-2">
              <PixelButtonSmall color="bg-blue-400" icon={<Gamepad2 size={20} />} onClick={handlePlay} />
              <PixelButtonSmall color="bg-yellow-400" icon={<Gift size={20} />} onClick={() => setViewMode('gacha')} /> 
              <PixelButtonSmall color="bg-purple-400" icon={<Utensils size={20} />} onClick={() => setShowInventory(true)} />
              <PixelButtonSmall color="bg-green-500" icon={<MapIcon size={20} />} onClick={() => setViewMode('map')} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GachaView({ state, reward, onPlay, onConfirm, onCancel, onBack }: any) {
  return (
    <motion.div
        initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
    >
        <motion.div 
            initial={{ scale: 0.5, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm flex flex-col items-center gap-8 relative z-50"
        >
            <div className="bg-[#ff4757] px-8 py-3 border-4 border-black shadow-[6px_6px_0_black] -rotate-1">
                <h2 className="font-['Press_Start_2P'] text-2xl text-white text-stroke-md">MYSTERY BOX</h2>
            </div>
            <div className="relative w-64 h-64 flex items-center justify-center">
                <div className={`rays-container ${(state === 'preview' || state === 'claiming') ? 'opacity-100 scale-150' : 'opacity-0 scale-0'} transition-all duration-1000 bg-[conic-gradient(from_0deg_at_50%_50%,#feca57_0deg,transparent_60deg,transparent_300deg,#feca57_360deg)] w-full h-full rounded-full blur-xl`}></div>
                <AnimatePresence mode="wait">
                    {(state === 'preview' || state === 'claiming') ? (
                        <motion.div 
                            key="reward"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1.5, rotate: 0 }}
                            className="relative z-10 flex flex-col items-center gap-4"
                        >
                            <div className="text-7xl filter drop-shadow-[0_10px_0_rgba(0,0,0,0.5)] animate-bounce">
                                {reward?.icon || '❓'}
                            </div>
                            <div className="bg-white border-2 border-black px-4 py-2 rounded font-bold text-black text-xs font-['Press_Start_2P'] text-center shadow-lg">
                                {reward?.name || 'Unknown'}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chest"
                            className={`pixel-chest-container ${state === 'shaking' ? 'shake-hard' : 'animate-float'}`}
                        >
                            <div className="pixel-chest-art scale-[3.5]"></div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="w-full px-8 flex flex-col gap-3">
                {(state === 'preview' || state === 'claiming') ? (
                     <div className="flex w-full gap-3">
                        <motion.button 
                            whileTap={{ scale: 0.95 }} 
                            onClick={onCancel} 
                            disabled={state === 'claiming'}
                            className="flex-1 bg-white text-black py-4 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_#ccc] disabled:opacity-50"
                        >
                            BUANG
                        </motion.button>
                        <motion.button 
                            whileTap={{ scale: 0.95 }} 
                            onClick={onConfirm}
                            disabled={state === 'claiming'}
                            className="flex-[2] bg-[#2ecc71] text-white py-4 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_black] flex flex-col items-center justify-center leading-tight disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {state === 'claiming' ? 'MEMPROSES...' : 'KLAIM (0.1 SUI)'}
                        </motion.button>
                    </div>
                ) : (
                    <motion.button
                        onClick={onPlay}
                        disabled={state === 'shaking'}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className={`w-full py-4 border-4 border-black font-['Press_Start_2P'] text-xs shadow-[4px_4px_0_black] flex items-center justify-center gap-2
                            ${state === 'shaking' ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-[#feca57] text-black hover:bg-yellow-400'}`}
                    >
                        {state === 'shaking' ? 'MEMBUKA...' : <><Sparkles size={16} /> BUKA PETI (0.1 SUI)</>}
                    </motion.button>
                )}
                
                <button 
                    onClick={onBack}
                    disabled={state === 'claiming' || state === 'shaking'}
                    className="text-gray-400 font-['VT323'] text-xl hover:text-white underline decoration-dashed mt-4 disabled:opacity-0 transition-opacity"
                >
                    KEMBALI KE DASHBOARD
                </button>
            </div>
        </motion.div>
    </motion.div>
  );
}

function MapView({ gps, target, distance, canClaim, rerollTarget, setViewMode }: any) {
  return (
    <motion.div
        key="map"
        initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
        className="absolute inset-0 z-40 flex flex-col bg-black/50 backdrop-blur-sm"
    >
      <div className="flex-1 relative border-b-4 border-black">
        {gps ? (
          <GameMap userPos={gps} targetPos={target} distance={distance} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-green-500 font-mono">
            <div className="animate-spin text-4xl mb-4">🌍</div>
            <p className="animate-pulse">MENCARI SINYAL GPS...</p>
          </div>
        )}
        <motion.div 
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full max-w-[220px]"
        >
          <div className="bg-black/90 backdrop-blur-md border-2 border-[#feca57] px-4 py-2 rounded-full shadow-lg flex flex-col items-center">
            <span className="text-[10px] text-[#feca57] font-bold tracking-widest uppercase mb-[-2px] flex items-center gap-1">
                <Crosshair size={10}/> JARAK TARGET
            </span>
            <div className="font-['VT323'] text-4xl text-white leading-none">
              {distance ? distance.toFixed(0) : '--'}<span className="text-sm text-gray-400 ml-1">m</span>
            </div>
          </div>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }}
          onClick={rerollTarget}
          className="absolute top-24 right-4 z-[1000] bg-white text-black p-3 rounded-xl border-2 border-black shadow-[4px_4px_0_black] active:shadow-none"
          title="Cari Target Baru"
        >
          <RefreshCw size={20} />
        </motion.button>
      </div>
      <motion.div 
         initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 20 }}
         className="bg-[#f5f6fa] border-t-4 border-black p-6 z-50 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-t-3xl"
      >
        <div className="flex justify-between items-center mb-6 px-1">
          <div>
              <h3 className="font-['VT323'] text-3xl text-black font-bold leading-none">RADAR</h3>
              <p className="text-xs text-gray-500 font-sans font-bold">Cari Monster & Item Langka</p>
          </div>
          <div className={`px-4 py-1 rounded-full border-2 border-black text-xs font-bold uppercase tracking-wider ${canClaim ? 'bg-green-400 text-black animate-pulse' : 'bg-gray-300 text-gray-500'}`}>
              {canClaim ? 'SIAP TANGKAP!' : 'TARGET JAUH'}
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode('dashboard')}
            className="flex-1 bg-white text-black py-4 rounded-xl border-2 border-black font-bold text-sm shadow-[0_4px_0_#ccc] active:translate-y-1 active:shadow-none transition-all"
          >
            BATAL
          </motion.button>
          <motion.button
            disabled={!canClaim}
            whileHover={canClaim ? { scale: 1.02 } : {}} whileTap={canClaim ? { scale: 0.95 } : {}}
            onClick={() => setViewMode('ar')}
            className={`flex-[2] py-4 rounded-xl border-2 border-black font-bold text-sm shadow-[0_4px_0_black] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2
              ${canClaim ? 'bg-[#ff4757] text-white hover:bg-red-500' : 'bg-gray-400 text-gray-700 cursor-not-allowed grayscale'}`}
          >
            <Camera size={20} /> MODE AR
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ARView({ onCatch, isMinting, onClose }: any) {
  return (
    <motion.div
        key="ar"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
        className="absolute inset-0 z-50 bg-black"
    >
        <Webcam
            audio={false}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            videoConstraints={{ facingMode: 'environment' }}
            onUserMediaError={(e) => alert('Kamera Error: ' + e)}
        />
        <div className="absolute inset-0 p-6 flex flex-col justify-between z-50 safe-area-inset-top">
            <div className="flex justify-between pointer-events-auto mt-4">
                <motion.button 
                    whileTap={{ scale: 0.9 }} onClick={onClose} 
                    className="bg-black/60 p-3 rounded-full text-white border-2 border-white backdrop-blur-md hover:bg-red-600 transition-colors"
                >
                    <X />
                </motion.button>
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
                    onClick={onCatch}
                >
                    <div className="ghost-body scale-[3.5] filter drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] border-4 border-white">
                    <div className="ghost-face" />
                    <div className="ghost-skirt" />
                    </div>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/90 text-black px-4 py-1 rounded-full border-2 border-black text-xs font-bold tracking-widest whitespace-nowrap animate-bounce">
                    TAP !!!
                    </div>
                </motion.div>
            </div>

            <div className="flex justify-center w-full pointer-events-auto pb-8">
                <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    disabled={isMinting}
                    onClick={onCatch}
                    className="bg-green-500 w-full max-w-xs py-4 rounded-xl border-4 border-white font-bold text-xl shadow-lg active:scale-95 disabled:opacity-50 font-['VT323'] hover:bg-green-400 text-white"
                >
                    {isMinting ? 'MENANGKAP...' : 'TANGKAP PET INI!'}
                </motion.button>
            </div>
        </div>
    </motion.div>
  );
}

function IntroScene({ account, isPending, refetch }: any) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [petName, setPetName] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const handleMint = () => {
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
            setShowConfirm(false); 
            refetch(); 
        },
        onError: () => setIsMinting(false),
      },
    );
  };

  if (!showConfirm) {
    if (!account) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[size:40px_40px] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] pointer-events-none" />
            <div className="absolute inset-0 crt-overlay z-10" />
            <div className="relative z-20 flex flex-col items-center w-full px-6">
                <div className="pixel-egg-container mb-8 scale-150"><div className="pixel-egg-bg"></div><div className="pixel-egg-art"></div></div>
                <div className="mb-8 transform -rotate-2">
                    <h1 className="font-['Press_Start_2P'] text-3xl text-white text-stroke-md text-center leading-relaxed">SUI PET GO</h1>
                </div>
                
                <div className="animate-pulse text-sm font-bold tracking-widest text-blue-300 bg-black/60 px-4 py-2 rounded font-['VT323'] border border-blue-500/30 uppercase">
                    Menunggu Koneksi Wallet...
                </div>
            </div>
          </motion.div>
        );
    }

    if (isPending) return <div className="text-white animate-pulse font-['VT323'] text-2xl">MEMUAT DATA...</div>;

    return (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pixel-card p-8 w-full max-w-sm flex flex-col gap-6 items-center relative z-20">
            <div className="pixel-egg-container scale-75 h-20"><div className="pixel-egg-bg"></div><div className="pixel-egg-art"></div></div>
            <div className="text-center">
                <h2 className="text-3xl font-['VT323'] tracking-widest leading-none text-black">PARTNER BARU</h2>
                <p className="text-xs text-gray-500 font-mono mt-1">Siapa nama teman barumu?</p>
            </div>
            <input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="NAMA PET..."
                maxLength={12}
                className="w-full border-4 border-black p-3 font-['Press_Start_2P'] text-sm text-center outline-none focus:bg-yellow-50 text-black uppercase placeholder:text-gray-300"
            />
            <motion.button
                onClick={() => setShowConfirm(true)}
                disabled={!petName}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className="w-full bg-[#2ecc71] text-white py-4 border-4 border-black font-['Press_Start_2P'] text-xs shadow-[4px_4px_0_black] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover-shake relative"
            >
                LANJUT
            </motion.button>
        </motion.div>
    );
  }

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
        <div className="pixel-card w-full max-w-sm p-6 flex flex-col items-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#feca57] border-4 border-black px-4 py-1 text-xs font-bold font-['Press_Start_2P'] text-black shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
                KONFIRMASI
            </div>

            <div className="mt-8 mb-6 pixel-egg-container scale-125">
                <div className="pixel-egg-bg"></div>
                <div className="pixel-egg-art"></div>
            </div>

            <div className="text-center mb-8">
                <p className="text-gray-500 text-xs font-mono mb-2">KAMU AKAN MENGADOPSI:</p>
                <h2 className="text-4xl font-['VT323'] text-black font-bold uppercase tracking-widest leading-none">
                    {petName}
                </h2>
            </div>

            <div className="w-full flex gap-3">
                <motion.button 
                    onClick={() => setShowConfirm(false)}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white text-black py-3 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_#ccc]"
                >
                    BATAL
                </motion.button>
                <motion.button 
                    onClick={handleMint}
                    disabled={isMinting}
                    whileTap={{ scale: 0.95 }}
                    className="flex-[2] bg-[#ff4757] text-white py-3 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_black] flex flex-col items-center justify-center leading-tight"
                >
                    {isMinting ? 'MINTING...' : 'CLAIM (GAS FEE)'}
                </motion.button>
            </div>
        </div>
    </motion.div>
  );
}

function InventoryModal({ isOpen, onClose, items, onUse }: any) {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} className="pixel-card p-0 w-full max-w-sm overflow-hidden">
            <div className="bg-[#ff4757] p-4 border-b-4 border-black flex justify-between items-center text-white">
                <h2 className="font-['VT323'] text-3xl tracking-widest">TAS BEKAL</h2>
                <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={24}/></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-[#f5f6fa] text-black">
                {items.length === 0 ? (
                    <div className="text-center py-10 opacity-50 font-mono text-sm text-gray-500">
                        <div className="text-4xl mb-2">🕸️</div>
                        Tas kosong melompong.<br/>Mainkan Gacha untuk dapat item!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((f: any) => (
                            <div key={f.data?.objectId} className="flex items-center justify-between bg-white border-2 border-black p-2 rounded-lg shadow-[2px_2px_0_#ccc]">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl bg-yellow-100 p-2 rounded border border-black">🍗</div>
                                    <div>
                                        <p className="font-bold font-['VT323'] text-xl leading-none">Nugget</p>
                                        <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1"><Zap size={10}/> ENERGI +50</p>
                                    </div>
                                </div>
                                <motion.button whileTap={{ scale: 0.95 }} className="bg-green-500 text-white px-3 py-1 rounded border-2 border-black text-sm font-bold hover:bg-green-400 active:translate-y-1 shadow-[0_2px_0_#14532d]" onClick={() => onUse(f.data?.objectId)}>MAKAN</motion.button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    </motion.div>
  );
}

function PixelButtonSmall({ color, icon, onClick }: any) {
    return (
        <motion.button 
            onClick={onClick}
            whileHover={{ scale: 1.05, filter: "brightness(1.1)" }}
            whileTap={{ scale: 0.9, y: 4, boxShadow: "0px 0px 0px rgba(0,0,0,0)" }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className={`w-full aspect-square ${color} border-2 border-black rounded-xl flex items-center justify-center shadow-[0px_4px_0px_black] text-black relative overflow-hidden`}
        >
            <motion.div className="absolute inset-0 bg-white opacity-0" whileHover={{ opacity: 0.2, x: [-100, 100], transition: { duration: 0.5 } }} style={{ skewX: -20 }} />
            <div className="relative z-10">{icon}</div>
        </motion.button>
    )
}

function StatusBar({ label, value, color, icon }: any) {
    const percentage = Math.min(100, Math.max(0, value));
    return (
      <div className="flex items-center gap-2 mb-1">
        <div className="w-12 text-xs font-bold text-gray-500 flex items-center gap-1">{icon} {label}</div>
        <div className="flex-1 h-3 bg-gray-300 rounded-full border border-black overflow-hidden relative">
          <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full ${color} absolute left-0 top-0`} />
          <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhZWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-20 pointer-events-none" />
        </div>
        <div className="w-8 text-right font-mono text-xs font-bold text-black">{value}</div>
      </div>
    );
}