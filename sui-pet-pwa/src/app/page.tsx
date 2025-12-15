'use client';

import { 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery 
} from '@mysten/dapp-kit';
import dragonCommon from '../public/monsters/dragon_common.png';
import dragonRare from '../public/monsters/dragon_rare.png';
import dragonEpic from '../public/monsters/dragon_epic.png';
import dragonLegendary from '../public/monsters/dragon_legendary.png';
import { ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import pixelEggImage from '../public/pixel_egg.png';
import monsterLogo from '../public/monsterlogo.png';
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
  Crosshair
} from 'lucide-react';
import Webcam from 'react-webcam';
import dynamic from 'next/dynamic';

const pixelPattern = {
  backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAB5JREFUGFdjTIm//58BDJikmRgwAaZGpqR///8DABwTE/3U621XAAAAAElFTkSuQmCC")`,
  backgroundSize: '4px 4px',
  imageRendering: 'pixelated' as const
};

const cBase = "#4d1e1e";
const cMid  = "#8a4f4f";
const cHigh = "#dfb6a9";

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

const MONSTER_IMAGE_PATHS = [
  (dragonCommon as any).src,
  (dragonRare as any).src,
  (dragonEpic as any).src,
  (dragonLegendary as any).src,
];

const AnimatedMonsterImage = ({ type, action }: { type: number, action: string }) => {
  const imageSrc = MONSTER_IMAGE_PATHS[type % MONSTER_IMAGE_PATHS.length];
  const breatheAnim = {
    y: [0, -10, 0],
    scale: [1, 1.03, 1],
    transition: { 
        duration: 5, 
        repeat: Infinity, 
        ease: "easeInOut" as const
    }
  };

  const happyAnim = {
    y: [0, -30, 0, -15, 0], rotate: [0, -5, 5, -2, 0], scale: 1.15,
    transition: { duration: 0.8, ease: "easeInOut" as const }
  };
  
  const eatAnim = {
    scaleX: [1, 1.1, 0.95, 1], scaleY: [1, 0.95, 1.1, 1],
    transition: { duration: 0.4, repeat: 2 }
  };

  const activeAnim = action === 'happy' ? happyAnim : action === 'eating' ? eatAnim : breatheAnim;
    const auraAnim = {
    opacity: [0.25, 0.6, 0.25],
    scale: [0.9, 1.08, 0.9],
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full pointer-events-none">
       <motion.div
         className="absolute z-0 rounded-full"
         style={{
            width: '85%', height: '85%',
            background:
              'radial-gradient(circle, rgba(56,189,248,0.5) 0%, rgba(129,140,248,0.35) 35%, transparent 75%)',
            boxShadow: '0 0 22px rgba(56,189,248,0.5)',
            ...pixelPattern
         }}
         animate={action === 'idle' ? auraAnim : { opacity: 0 }}
         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" as const }}
       />
       <motion.img
          src={imageSrc}
          alt="Monster Pet"
          className="w-auto h-[90%] object-contain z-10 relative"
          style={{
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.55))',
          }}
          animate={activeAnim}
          onError={(e) => {
            e.currentTarget.src = 'https://img.icons8.com/color/512/dragon.png';
          }}
        />
    </div>
  );
};

const HatchingScene = ({ onComplete }: { onComplete: () => void }) => {
  const [stage, setStage] = useState<'egg' | 'crack' | 'hatch'>('egg');

  useEffect(() => {
    // Sequence animasi
    const sequence = async () => {
      // 1. Tunggu sebentar (Telur Diam)
      await new Promise(r => setTimeout(r, 1000));
      
      // 2. Telur Retak
      setStage('crack');
      await new Promise(r => setTimeout(r, 2000)); // Durasi retak & getar

      // 3. Menetas
      setStage('hatch');
      await new Promise(r => setTimeout(r, 2500)); // Durasi monster lompat

      // 4. Selesai
      onComplete();
    };
    sequence();
  }, [onComplete]);

  // Animasi Getar
  const shakeVariant = {
    egg: { rotate: 0 },
    crack: { 
      rotate: [-5, 5, -5, 5, 0],
      x: [-2, 2, -2, 2, 0],
      transition: { repeat: 3, duration: 0.5 } 
    },
    hatch: { scale: 0, opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black z-50 fixed inset-0">
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* CAHAYA LEDAKAN (Hanya muncul saat hatch) */}
        {stage === 'hatch' && (
           <motion.div 
             initial={{ scale: 0, opacity: 1 }}
             animate={{ scale: 15, opacity: 0 }}
             transition={{ duration: 0.8 }}
             className="absolute inset-0 bg-white rounded-full z-10"
           />
        )}

        {/* MONSTER YANG MUNCUL (Disembunyikan sampai stage hatch) */}
        <motion.div
           initial={{ scale: 0, y: 50 }}
           animate={stage === 'hatch' ? { scale: 1, y: 0 } : {}}
           transition={{ type: "spring", bounce: 0.6, delay: 0.1 }}
           className="absolute z-20"
        >
           {/* Simple CSS/SVG Pixel Monster */}
           <svg width="120" height="120" viewBox="0 0 12 12" shapeRendering="crispEdges">
             <path fill="#4ade80" d="M4 2h4v1h-4zM3 3h6v1h-6zM2 4h8v5h-8zM2 9h2v2h-2zM8 9h2v2h-2z" />
             <path fill="#000" d="M3 5h2v2h-2zM7 5h2v2h-2zM4 7h4v1h-4z" /> 
             {/* Tanduk */}
             <path fill="#fef08a" d="M2 2h1v2h-1zM9 2h1v2h-1z" />
           </svg>
        </motion.div>

        {/* TELUR */}
        <motion.div
          variants={shakeVariant}
          animate={stage}
          className="absolute z-30"
        >
           {/* Simple CSS/SVG Pixel Egg */}
           <svg width="140" height="160" viewBox="0 0 14 16" shapeRendering="crispEdges">
             {/* Cangkang Luar (Putih/Krem) */}
             <path fill="#fef3c7" d="M5 1h4v1h2v2h2v8h-2v2h-2v1h-4v-1h-2v-2h-2v-8h2v-2h2z" />
             {/* Garis Retakan (Hanya muncul saat crack) */}
             {stage !== 'egg' && (
                <path fill="#000" d="M6 3h1v1h1v1h-1v1h1v1h-1v1h-1v-1h-1v-1h1v-1h-1v-1h1z" />
             )}
             {/* Shadow Bawah */}
             <path fill="rgba(0,0,0,0.2)" d="M4 11h6v1h-6zM3 12h8v1h-8z" />
           </svg>
        </motion.div>

        {/* TEXT STATUS */}
        <div className="absolute -bottom-20 w-full text-center">
            <motion.p 
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-['Press_Start_2P'] text-yellow-400 text-xs animate-pulse"
            >
              {stage === 'egg' ? 'MENERIMA DATA...' : stage === 'crack' ? 'TELUR BERGETAR!' : 'MENETAS!!'}
            </motion.p>
        </div>
      </div>
    </div>
  );
};

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
            <div className={`px-5 py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px rgba(0,0,0,0.5)] flex items-center gap-3 font-bold text-sm md:text-base font-['VT323'] tracking-wider uppercase
              ${notification.type === 'success' ? 'bg-[#2ecc71] text-black' : notification.type === 'error' ? 'bg-[#ff4757] text-white' : 'bg-[#feca57] text-black'}`}
            >
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
          <div className="bg-[#feca57] border-2 border-black px-3 py-1 shadow-[2px_2px_0 black] -rotate-2 rounded-md pointer-events-auto hover:rotate-0 transition-transform cursor-pointer" onClick={() => setViewMode('dashboard')}>
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
               petId={petObject?.data?.objectId}
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

const PixelCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div 
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    // Background gelap, border putih tebal, dan shadow keras
    className={`relative bg-[#1a1a2e] border-[6px] border-white p-8 shadow-[8px_8px_0_rgba(0,0,0,0.5)] ${className}`}
  >
    {children}
  </motion.div>
);
const CloudPuff = ({ className, width, height, color, scale = 1, opacity = 1 }: any) => {
  return (
    <div 
      className={`absolute ${className}`} 
      style={{ width, height, transform: `scale(${scale})`, opacity }}
    >
       <div 
         className="absolute bottom-0 left-0 w-full h-[40%] rounded-full" 
         style={{ backgroundColor: color, ...pixelPattern }} 
       />
       <div 
         className="absolute bottom-[10%] left-[5%] w-[45%] h-[70%] rounded-full" 
         style={{ backgroundColor: color, ...pixelPattern }} 
       />
       <div 
         className="absolute bottom-[10%] right-[5%] w-[50%] h-[75%] rounded-full" 
         style={{ backgroundColor: color, ...pixelPattern }} 
       />
       <div 
         className="absolute bottom-[30%] left-[25%] w-[50%] h-[60%] rounded-full" 
         style={{ backgroundColor: color, ...pixelPattern }} 
       />
    </div>
  );
};

const CloudFloorSegment = () => (
  <div className="relative w-full h-full">
    <CloudBlob
      className="bottom-[-18%] left-[-10%] w-[120%] h-[55%]"
      color={cBase}
    />
    <CloudPuff
      className="bottom-[-20%] left-[-10%]"
      width="230px"
      height="90px"
      color={cMid}
      scale={1.1}
    />
    <CloudPuff
      className="bottom-[-22%] left-[30%]"
      width="230px"
      height="90px"
      color={cMid}
      scale={1.1}
    />
    <CloudPuff
      className="bottom-[-25%] left[-2%]"
      width="210px"
      height="80px"
      color={cHigh}
      scale={1.05}
    />
    <CloudPuff
      className="bottom-[-27%] left-[42%]"
      width="210px"
      height="80px"
      color={cHigh}
      scale={1.05}
    />
  </div>
);

const CloudBlob = ({ className, color, style }: any) => (
    <div 
        className={`absolute rounded-full ${className}`} 
        style={{ 
            backgroundColor: color, 
            ...pixelPattern,
            boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.25)',
            ...style
        }} 
    />
);

const PixelCloud = ({ className, duration, delay, zIndex, scale = 1, opacity }: any) => {
  return (
    <motion.div
      initial={{ x: "-150%" }}
      animate={{ x: "400%" }}
      transition={{ 
        repeat: Infinity, 
        duration: duration, 
        ease: "linear" as const,
        delay: delay 
      }}
      className={`absolute pointer-events-none flex items-end ${className} ${zIndex}`}
      style={{ scale, opacity }}
    >
      <div className="relative w-32 h-16">
         <CloudBlob className="bottom-0 left-0 w-24 h-12" color={cHigh} />
         <CloudBlob className="bottom-4 left-6 w-16 h-12" color={cHigh} />
         <CloudBlob className="bottom-2 left-14 w-14 h-10" color={cHigh} />
      </div>
    </motion.div>
  );
};

const FlyingPixelCloud = ({ duration, top, scale, opacity }: any) => {
    return (
        <motion.div
            initial={{ x: "-150%" }}
            animate={{ x: "400%" }}
            transition={{ 
                repeat: Infinity, 
                duration: duration, 
                ease: "linear" as const
            }}
            className="absolute z-0 pointer-events-none"
            style={{ top, scale, opacity }}
        >
            <CloudPuff className="" width="100px" height="60px" color={cHigh} />
        </motion.div>
    )
}

const CloudSegment = () => (
  <div className="relative w-full h-full">
      <CloudBlob className="bottom-[-20%] left-[-10%] w-[70%] h-[100%]" color={cBase} />
      <CloudBlob className="bottom-[-30%] right-[-10%] w-[80%] h-[110%]" color={cBase} />
      <CloudBlob className="bottom-[5%] left-[0%] w-[45%] h-[70%]" color={cMid} />
      <CloudBlob className="bottom-[0%] left-[35%] w-[40%] h-[60%]" color={cMid} />
      <CloudBlob className="bottom-[-10%] right-[0%] w-[50%] h-[80%]" color={cMid} />
      <CloudBlob className="bottom-[30%] left-[10%] w-[30%] h-[40%]" color={cHigh} />
      <CloudBlob className="bottom-[35%] left-[35%] w-[25%] h-[35%]" color={cHigh} />
      <CloudBlob className="bottom-[25%] right-[15%] w-[35%] h-[45%]" color={cHigh} />
      <CloudBlob className="bottom-[-20%] left-[20%] w-[60%] h-[60%]" color={cBase} />
  </div>
);

const MovingCloudFloor = ({ zIndex = "z-20" }: { zIndex?: string }) => {
  const scrollAnim = { x: ["-50%", "0%"] };
  const scrollTransition = { 
     duration: 40, 
     repeat: Infinity, 
     ease: "linear" as const
  };

  const verticalWave = { y: [0, 5, 0] };
  const verticalTransition = { 
     duration: 6, 
     repeat: Infinity, 
     ease: "easeInOut" as const
  };

  return (
      <div className={`absolute bottom-0 left-0 right-0 h-[35%] pointer-events-none ${zIndex} overflow-hidden`}>
          <motion.div animate={verticalWave} transition={verticalTransition} className="w-full h-full relative">
               <motion.div 
                animate={scrollAnim}
                transition={scrollTransition}
                className="flex w-[200%] h-full absolute left-0 bottom-0"
              >
                <div className="w-1/2 h-full relative"><CloudFloorSegment /></div>
                <div className="w-1/2 h-full relative"><CloudFloorSegment /></div>

              </motion.div>
          </motion.div>
      </div>
  );
};
const LightningFlash = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ 
      opacity: [0, 0.9, 0, 0.6, 0, 0, 0, 0.8, 0],
      backgroundColor: ["#fff", "#fff", "#fff", "#fdba74", "#fff", "#fff", "#fff", "#fff", "#fff"]
    }}
    transition={{ 
      duration: 6,
      times: [0, 0.02, 0.05, 0.07, 0.1, 0.5, 0.8, 0.82, 1],
      repeat: Infinity, 
      repeatDelay: Math.random() * 5
    }}
    className="absolute inset-0 z-[5] mix-blend-overlay pointer-events-none"
  />
);

function DashboardView({ petFields, petAction, setPetAction, handlePlay, setViewMode, setShowInventory, petId }: any) {
  const monsterTypeIndex = petId ? parseInt(petId.slice(-1), 16) % 4 : 0;
  
  const monsterName = [
    'FOREST DRAGON',
    'GLACIER DRAGON',
    'INFERNO DRAGON',
    'ROYAL DRAGON'
  ][monsterTypeIndex];

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} className="relative h-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gradient-to-br from-gray-900 to-black p-5 h-[80vh] flex flex-col justify-between relative z-20 border-4 border-white rounded-2xl shadow-[0_0_50px rgba(0,255,255,0.3)]">
            <div className="flex justify-between items-end border-b-2 border-white/30 pb-2 relative z-30">
                <div>
                    <h1 className="text-4xl font-bold font-['VT323'] tracking-widest text-white [text-shadow:_2px_2px_0_#000,_-2px_-2px_0_#000,_2px_-2px_0_#000,_-2px_2px_0_#000]">
                        {petFields.name}
                    </h1>
                    <span className="text-xs font-bold text-cyan-300 font-['Press_Start_2P'] mt-1 block uppercase [text-shadow:_1px_1px_0_#000]">
                        {monsterName} • LVL {petFields.level}
                    </span>
                </div>
                <div className={`px-3 py-1 border-2 border-black text-xs font-bold font-['Press_Start_2P'] ${petFields.hunger < 30 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'} [text-shadow:_1px_1px_0_#000]`}>
                    {petFields.hunger < 30 ? 'LAPAR!' : 'KENYANG'}
                </div>
            </div>
            <div 
               className={`flex-1 flex items-center justify-center relative my-4 rounded-xl border-4 border-white/50 overflow-hidden group cursor-pointer shadow-inner
                  bg-gradient-to-b from-[#b91c1c] via-[#7f1d1d] to-[#3b0b0b]`}
                onClick={() => setPetAction('happy')}
            >
                 <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-[1] pointer-events-none"></div>
                 <LightningFlash />
                 <FlyingPixelCloud duration={60} top="15%" scale={0.5} opacity={0.3} />
                 <FlyingPixelCloud duration={50} top="25%" scale={0.7} opacity={0.2} />
                 <PixelCloud
                   className="top-[8%] left-[-20%]"
                   duration={80}
                   delay={0}
                   zIndex="z-0"
                   scale={1.1}
                   opacity={0.7}
                 />
                 <PixelCloud
                   className="top-[22%] left-[-25%]"
                   duration={100}
                   delay={10}
                   zIndex="z-0"
                   scale={0.9}
                   opacity={0.6}
                 />
                <div className="absolute top-[18%] right-[8%] opacity-40 scale-[0.9] z-[3] pointer-events-none">
                  <CloudSegment />
                </div>

                 <div className="relative z-10 w-full h-full flex items-center justify-center translate-y-12 scale-[1.35] transition-transform duration-500">
                   <AnimatedMonsterImage type={monsterTypeIndex} action={petAction} />
                 </div>
                 <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={petAction} className="absolute top-4 right-4 bg-white border-2 border-black px-3 py-2 rounded-lg rounded-bl-none shadow-lg z-[30]">
                     <p className="text-xs font-bold font-['Press_Start_2P'] text-black">
                        {petAction === 'eating' ? 'NYAM!' : petAction === 'happy' ? 'ROAR!' : petFields.hunger < 30 ? '...' : 'GRRR.'}
                     </p>
                 </motion.div>
                 <MovingCloudFloor zIndex="z-20" />
            </div>
            <div className="space-y-4 relative z-30">
                <div className="bg-gray-900/80 p-4 rounded-xl border-2 border-white/30">
                    <StatusBar label="HP" value={petFields.hunger} color="bg-orange-500" icon={<Utensils size={14}/>} />
                    <StatusBar label="JOY" value={petFields.happiness} color="bg-pink-500" icon={<Heart size={14}/>} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <PixelButtonSmall color="bg-blue-600" icon={<Gamepad2 size={24}/>} onClick={handlePlay} />
                    <PixelButtonSmall color="bg-yellow-600" icon={<Gift size={24}/>} onClick={() => setViewMode('gacha')} />
                    <PixelButtonSmall color="bg-purple-600" icon={<Utensils size={24}/>} onClick={() => setShowInventory(true)} />
                    <PixelButtonSmall color="bg-green-700" icon={<MapIcon size={24}/>} onClick={() => setViewMode('map')} />
                </div>
            </div>
        </div>
    </motion.div>
  );
}

const PixelChest = ({ size = 220, state = 'ready', onClick }: any) => {
  const chestMap = [
    '000OOOO000',
    '00OWWWW000',
    '0OWWWWwW00',
    '0OWwwwWW00',
    '00HHHHH000',
    '0OGGGGGGO0',
    '0OGGGGGGO0',
    '0OGGLGGOO0',
    '00OOOOOO00',
  ];

  const palette: Record<string, string> = {
    O: '#000000',
    W: '#6f3a1d',
    w: '#c97b3e',
    G: '#ffd86a',
    H: '#d1c58f',
    '0': 'transparent',
  };

  const cols = chestMap[0].length;
  const rows = chestMap.length;
  const cell = Math.max(4, Math.floor(size / cols));

  const lidRows = chestMap.slice(0, 4);
  const hingeRow = chestMap[4];
  const bodyRows = chestMap.slice(5);

  const isShaking = state === 'shaking';
  const isOpen = state === 'preview' || state === 'claiming';

  const renderRows = (rowsArr: string[], rowOffset = 0) =>
    rowsArr.flatMap((row, rIdx) =>
      row.split('').map((ch, cIdx) => {
        const color = palette[ch] ?? 'transparent';
        return (
          <div
            key={`p-${rowOffset + rIdx}-${cIdx}`}
            style={{
              width: cell,
              height: cell,
              backgroundColor: color,
              boxSizing: 'border-box',
              border: color === 'transparent' ? 'none' : '1px solid rgba(0,0,0,0.95)',
            }}
          />
        );
      })
    );

  return (
    <motion.div
      onClick={onClick}
      className="relative flex items-center justify-center"
      style={{
        width: cols * cell + 12,
        height: rows * cell + 20,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        padding: 6,
        borderRadius: Math.max(8, Math.round(cell * 0.6)),
        background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25))'
      }}
      animate={
        isShaking
          ? { x: [0, -6, 6, -4, 4, 0], rotate: [0, -2, 2, -1, 1, 0] }
          : { x: 0, rotate: 0 }
      }
      transition={
        isShaking
          ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const }
          : { duration: 0.35 }
      }
    >
      <motion.div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: rows * cell * 0.06,
          width: cols * cell * 0.72,
          height: rows * cell * 0.44,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(255,230,120,0.95) 0%, rgba(255,160,60,0.14) 50%, transparent 80%)',
          pointerEvents: 'none',
        }}
        animate={isOpen ? { opacity: [0.6, 1, 0.9] } : { opacity: 0.36 }}
        transition={{ duration: 0.9, repeat: isOpen ? Infinity : 0, ease: 'easeInOut' as const }}
      />
      <div style={{ position: 'relative', width: cols * cell, height: rows * cell, lineHeight: 0 }}>
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
            zIndex: 60,
            borderRadius: 0,
            transformOrigin: '50% 100%',
            backfaceVisibility: 'hidden'
          }}
          animate={isOpen ? { y: -Math.round(cell * 1.6) } : { y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 320, damping: 26 }}
        >
          {renderRows(lidRows, 0)}
        </motion.div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: lidRows.length * cell,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
            zIndex: 55
          }}
        >
          {hingeRow.split('').map((ch, idx) => {
            const color = palette[ch] ?? 'transparent';
            return (
              <div
                key={`hinge-${idx}`}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: color,
                  boxSizing: 'border-box',
                  border: color === 'transparent' ? 'none' : '1px solid rgba(0,0,0,0.95)'
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: (lidRows.length + 1) * cell,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
            zIndex: 50,
          }}
        >
          {renderRows(bodyRows, lidRows.length + 1)}
        </div>
      </div>
    </motion.div>
  );
};

const RewardFloating = ({ icon, label, offsetBottom = 110 }: any) => {
  const [landed, setLanded] = useState(false);

  return (
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: offsetBottom }}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={landed ? { opacity: 1, y: -6, scale: 1 } : { opacity: 1, y: -36, scale: 1.02 }}
          transition={
            landed
              ? { duration: 0.6 }
              : { duration: 0.7, times: [0, 0.6, 1] }
          }
          onAnimationComplete={() => {
            if (!landed) setLanded(true);
          }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
        >
          <motion.div
            animate={landed ? { y: [ -6, -12, -6 ] } : {}}
            transition={landed ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const } : {}}
            className="z-40 flex flex-col items-center gap-2"
            style={{ transformOrigin: 'center' }}
          >
            <div style={{ fontSize: 32, filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.55))' }}>{icon || '❓'}</div>
            {label && (
              <div className="bg-white border-2 border-black px-3 py-1 rounded text-[10px] font-['Press_Start_2P'] text-black text-center shadow-[2px_2px_0_rgba(0,0,0,0.6)]">
                {label}
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function GachaView({ state, reward, onPlay, onConfirm, onCancel, onBack }: any) {
  const isOpenState = state === 'preview' || state === 'claiming';

  return (
    <motion.div
      key="gacha"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm flex flex-col items-center gap-8 relative z-50"
      >
        <div className="bg-[#ff4757] px-8 py-3 border-4 border-white shadow-[6px_6px_0_black] -rotate-1">
          <h2 className="font-['Press_Start_2P'] text-2xl text-white [text-shadow:_2px_2px_0_#000]">
            MYSTERY BOX
          </h2>
        </div>
        <div className="relative w-[320px] h-[260px] flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className={`w-64 h-64 rounded-full transition-all ${isOpenState ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
              style={{
                background: 'radial-gradient(circle, rgba(255,220,120,0.95) 0%, rgba(255,140,44,0.12) 45%, transparent 70%)',
                filter: isOpenState ? 'blur(20px)' : 'blur(8px)',
              }}
            />
          </div>
          <div className="relative z-20 w-full h-full flex items-center justify-center">
            <div className="chest-stage relative w-[260px] h-[160px] flex items-end justify-center">
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 18 }}>
                <PixelChest size={220} state={state} onClick={state === 'ready' ? onPlay : undefined} />
              </div>
              <AnimatePresence>
                {isOpenState && reward && (
                  <RewardFloating icon={reward.icon} label={reward.name} offsetBottom={120} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="w-full px-8 flex flex-col gap-3">
          {isOpenState ? (
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
              whileHover={state === 'shaking' ? {} : { scale: 1.05 }}
              whileTap={state === 'shaking' ? {} : { scale: 0.95 }}
              className={`w-full py-4 border-4 border-black font-['Press_Start_2P'] text-xs shadow-[4px_4px_0_black] flex items-center justify-center gap-2
                ${
                  state === 'shaking'
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-[#feca57] text-black hover:bg-yellow-400'
                }`}
            >
              {state === 'shaking' ? (
                'MEMBUKA...'
              ) : (
                <>
                  <Sparkles size={16} /> BUKA PETI (0.1 SUI)
                </>
              )}
            </motion.button>
          )}
          <button
            onClick={onBack}
            disabled={state === 'claiming' || state === 'shaking'}
            className="text-gray-400 font-['VT323'] text-xl hover:text-white underline decoration-dashed mt-4 disabled:opacity-0 transition-opacity [text-shadow:_1px_1px_0_#000]"
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
            <div className="font-['VT323'] text-4xl text-white leading-none [text-shadow:_2px_2px_0_#000]">
              {distance ? distance.toFixed(0) : '--'}<span className="text-sm text-gray-400 ml-1">m</span>
            </div>
          </div>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }}
          onClick={rerollTarget}
          className="absolute top-24 right-4 z-[1000] bg-white text-black p-3 rounded-xl border-2 border-black shadow-[4px_4px_0 black] active:shadow-none"
          title="Cari Target Baru"
        >
          <RefreshCw size={20} />
        </motion.button>
      </div>
      <motion.div 
         initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 20 }}
         className="bg-[#f5f6fa] border-t-4 border-black p-6 z-50 relative shadow-[0_-10px_40px rgba(0,0,0,0.5)] rounded-t-3xl"
      >
        <div className="flex justify-between items-center mb-6 px-1">
          <div>
              <h3 className="font-['VT323'] text-3xl text-black font-bold leading-none [text-shadow:_1px_1px_0_#ccc]">RADAR</h3>
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
                    <div className="ghost-body scale-[3.5] filter drop-shadow-[0_0_30px rgba(255,255,255,0.8)] border-4 border-white">
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
                    className="bg-green-500 w-full max-w-xs py-4 rounded-xl border-4 border-white font-bold text-xl shadow-lg active:scale-95 disabled:opacity-50 font-['VT323'] hover:bg-green-400 text-white [text-shadow:_2px_2px_0_#000]"
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
  
  // STATE BARU: Apakah animasi menetas sudah selesai?
  const [hatchComplete, setHatchComplete] = useState(false);

  const handleMint = () => {
    if (!petName.trim()) return;
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
        onError: (err) => {
            console.error(err);
            setIsMinting(false);
        },
      },
    );
  };

  // 1. Tampilan Belum Connect Wallet (Tampilan Awal)
  if (!account) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 opacity-20 bg-[size:40px_40px] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] pointer-events-none" />
        
        <div className="relative z-20 flex flex-col items-center w-full px-6 gap-8">
            <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                {/* Menggunakan pixel egg yg lama hanya untuk cover depan */}
                <img 
                    src={pixelEggImage.src} 
                    alt="Pixel Egg" 
                    className="w-full h-full object-contain scale-125"
                    style={{ imageRendering: 'pixelated' }}
                />
            </motion.div>
            
            <div className="transform -rotate-2">
                <h1 className="font-['Press_Start_2P'] text-4xl text-[#feca57] [text-shadow:_4px_4px_0_#000] text-center leading-relaxed stroke-black">
                    SUI PET GO
                </h1>
            </div>
            
            <div className="scale-110 hover:scale-115 transition-transform duration-200">
                <ConnectButton 
                    className="!bg-[#ff4757] !text-white !font-['Press_Start_2P'] !text-[10px] !py-4 !px-8 !border-4 !border-black !shadow-[4px_4px_0_black] !rounded-none hover:!bg-[#ff6b81] active:!translate-y-1 active:!shadow-none transition-all uppercase" 
                />
            </div>
        </div>
      </motion.div>
    );
  }

  // 2. LOGIKA BARU: Jika sudah connect TAPI belum menetas -> Jalankan Hatching Scene
  if (account && !hatchComplete) {
     return <HatchingScene onComplete={() => setHatchComplete(true)} />;
  }

  // 3. Loading State saat cek Pet (Hanya muncul kalau data pet sedang diambil di background)
  if (isPending && !showConfirm) return (
      <div className="flex flex-col items-center justify-center h-full bg-black/80 backdrop-blur-sm absolute inset-0 z-50">
          <div className="w-16 h-16 border-4 border-[#feca57] border-t-transparent rounded-full animate-spin mb-4"></div>
      </div>
  );

  // 4. Form Input Nama (PARTNER BARU) - Ini yang akan muncul SETELAH animasi menetas
  if (!showConfirm) {
    return (
        <div className="flex items-center justify-center h-full w-full p-4">
            <PixelCard className="w-full max-w-sm flex flex-col gap-6 items-center z-20">
                
                {/* Logo Monster (Hasil Hatching) */}
                <div>
                     <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>
                     <svg width="80" height="80" viewBox="0 0 12 12" shapeRendering="crispEdges" className="animate-bounce">
                        <path fill="#4ade80" d="M4 2h4v1h-4zM3 3h6v1h-6zM2 4h8v5h-8zM2 9h2v2h-2zM8 9h2v2h-2z" />
                        <path fill="#000" d="M3 5h2v2h-2zM7 5h2v2h-2zM4 7h4v1h-4z" /> 
                        <path fill="#fef08a" d="M2 2h1v2h-1zM9 2h1v2h-1z" />
                     </svg>
                </div>
                
                <div className="text-center w-full">
                    <h2 className="text-4xl font-['VT323'] tracking-widest leading-none text-white [text-shadow:_2px_2px_0_#000] mb-2">
                        PARTNER BARU
                    </h2>
                    <p className="text-sm text-gray-300 font-mono [text-shadow:_1px_1px_0_#000]">
                        Monster liar menetas! Beri dia nama.
                    </p>
                </div>

                <div className="w-full">
                    <input
                        autoFocus
                        value={petName}
                        onChange={(e) => setPetName(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && petName && setShowConfirm(true)}
                        placeholder="NAMA PET..."
                        maxLength={12}
                        className="w-full bg-[#fffbeb] border-4 border-black p-4 font-['Press_Start_2P'] text-sm text-center text-black placeholder:text-gray-400 shadow-[inset_4px_4px_0_rgba(0,0,0,0.1)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-yellow-400/50 transition-all"
                    />
                </div>

                <motion.button
                    onClick={() => setShowConfirm(true)}
                    disabled={!petName}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 border-4 border-black font-['Press_Start_2P'] text-xs shadow-[4px_4px_0_black] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed [text-shadow:_1px_1px_0_#000]"
                >
                    LANJUT
                </motion.button>
            </PixelCard>
        </div>
    );
  }

  // 5. Modal Konfirmasi (Tetap sama)
  return (
    <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
        <PixelCard className="w-full max-w-sm p-8 flex flex-col items-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#feca57] border-4 border-black px-6 py-2 text-xs font-bold font-['Press_Start_2P'] text-black shadow-[4px_4px_0 rgba(0,0,0,0.5)]">
                KONFIRMASI
            </div>

            <div className="mt-8 mb-6 scale-150 p-4">
                 <svg width="60" height="60" viewBox="0 0 12 12" shapeRendering="crispEdges">
                    <path fill="#4ade80" d="M4 2h4v1h-4zM3 3h6v1h-6zM2 4h8v5h-8zM2 9h2v2h-2zM8 9h2v2h-2z" />
                    <path fill="#000" d="M3 5h2v2h-2zM7 5h2v2h-2zM4 7h4v1h-4z" /> 
                    <path fill="#fef08a" d="M2 2h1v2h-1zM9 2h1v2h-1z" />
                 </svg>
            </div>

            <div className="text-center mb-8 w-full">
                <p className="text-gray-400 text-xs font-mono mb-2 uppercase tracking-widest">Kamu akan mengadopsi:</p>
                <h2 className="text-5xl font-['VT323'] text-[#feca57] font-bold uppercase tracking-widest leading-none [text-shadow:_2px_2px_0_#000] break-words">
                    {petName}
                </h2>
            </div>

            <div className="w-full flex gap-4">
                <motion.button 
                    onClick={() => setShowConfirm(false)}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white text-black py-4 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_#ccc] hover:bg-gray-100"
                >
                    BATAL
                </motion.button>
                <motion.button 
                    onClick={handleMint}
                    disabled={isMinting}
                    whileTap={{ scale: 0.95 }}
                    className="flex-[2] bg-[#ff4757] hover:bg-[#ff2e43] text-white py-4 border-4 border-black font-['Press_Start_2P'] text-[10px] shadow-[4px_4px_0_black] flex flex-col items-center justify-center leading-tight [text-shadow:_1px_1px_0_#000] disabled:grayscale"
                >
                    {isMinting ? 'MINTING...' : 'CLAIM (GAS FEE)'}
                </motion.button>
            </div>
        </PixelCard>
    </motion.div>
  );
}

function InventoryModal({ isOpen, onClose, items, onUse }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gradient-to-br from-gray-900 to-black p-6 border-4 border-white rounded-2xl shadow-[0_0_50px rgba(0,255,255,0.3)]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-['VT323'] text-2xl text-white [text-shadow:_2px_2px_0_#000]">INVENTORY</h2>
              <button onClick={onClose} className="text-white hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="font-['VT323'] text-sm">Tas kosong...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {items.map((item: any, idx: number) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onUse(item.data?.objectId)}
                    className="w-full bg-white/10 hover:bg-white/20 border-2 border-white/30 p-3 rounded-lg flex justify-between items-center transition-all text-left"
                  >
                    <span className="font-['VT323'] text-white text-sm">🍗 ITEM #{idx + 1}</span>
                    <span className="text-xs text-green-400 font-bold">GUNAKAN</span>
                  </motion.button>
                ))}
              </div>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="w-full mt-6 bg-gray-700 hover:bg-gray-600 border-2 border-white p-3 rounded-lg font-['VT323'] text-white transition-colors"
            >
              TUTUP
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PixelButtonSmall({ color, icon, onClick }: any) {
    return (
        <motion.button 
            onClick={onClick}
            whileHover={{ scale: 1.05, filter: "brightness(1.1)" }}
            whileTap={{ scale: 0.9, y: 4, boxShadow: "0px 0px 0px rgba(0,0,0,0)" }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className={`w-full aspect-square ${color} border-2 border-black rounded-xl flex items-center justify-center shadow-[0px_4px_0px_black] text-white relative overflow-hidden`}
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
        <div className="w-12 text-xs font-bold text-white flex items-center gap-1 [text-shadow:_1px_1px_0_#000]">{icon} {label}</div>
        <div className="flex-1 h-3 bg-gray-700 rounded-full border border-white overflow-hidden relative">
          <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full ${color} absolute left-0 top-0`} />
          <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhZWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-20 pointer-events-none" />
        </div>
        <div className="w-8 text-right font-mono text-xs font-bold text-white [text-shadow:_1px_1px_0_#000]">{value}</div>
      </div>
    );
}
