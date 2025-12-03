'use client';

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState } from 'react'; 
import { PET_TYPE, PACKAGE_ID, SHOP_ID, FOOD_TYPE } from '../utils/contracts';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Search, Zap, Heart, Utensils, ShoppingBag, X } from 'lucide-react';

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [petAction, setPetAction] = useState<'idle' | 'happy' | 'eating'>('idle');
  const [showInventory, setShowInventory] = useState(false);
  const { data: petData, isPending, refetch } = useSuiClientQuery(
    'getOwnedObjects',
    { owner: account?.address as string, filter: { StructType: PET_TYPE }, options: { showContent: true } },
    { enabled: !!account, refetchInterval: 5000 }
  );

  const { data: foodData, refetch: refetchFood } = useSuiClientQuery(
    'getOwnedObjects',
    { owner: account?.address as string, filter: { StructType: FOOD_TYPE } },
    { enabled: !!account }
  );

  const hasPet = petData?.data && petData.data.length > 0;
  const petObject = hasPet ? petData.data[0] : null;
  const foodList = foodData?.data || [];
  // @ts-ignore
  const fields = petObject?.data?.content?.fields || {};
  const petName = fields.name || 'UNKNOWN';
  const hunger = fields.hunger || 0;
  const happiness = fields.happiness || 0;
  const level = fields.level || 1;
  const handlePlay = () => {
    if (!petObject) return;
    setPetAction('happy'); 
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::core::play_pet`, arguments: [tx.object(petObject.data?.objectId as string), tx.object('0x6')] });
    executeTx(tx, () => { setPetAction('idle'); });
  };

  const handleScavenge = () => {
    if (!petObject) return;
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::core::scavenge`, arguments: [tx.object(petObject.data?.objectId as string), tx.object('0x6')] });
    executeTx(tx, () => { refetchFood(); });
  };

  const handleBuyFood = () => {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100000000)]); 
    tx.moveCall({ target: `${PACKAGE_ID}::shop::buy_food`, arguments: [tx.object(SHOP_ID), coin] });
    executeTx(tx, () => { refetchFood(); });
  };

  const handleFeed = (foodId: string) => {
    if (!petObject) return;
    setPetAction('eating');
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::core::feed_pet`, arguments: [tx.object(petObject.data?.objectId as string), tx.object(foodId), tx.object('0x6')] });
    executeTx(tx, () => { refetchFood(); setPetAction('idle'); });
  };

  const executeTx = (tx: Transaction, callback?: () => void) => {
    signAndExecute({ transaction: tx }, {
      onSuccess: () => { setTimeout(() => { refetch(); if(callback) callback(); }, 2000); },
      onError: (err) => { console.error(err); alert("Failed: " + err.message); setPetAction('idle'); }
    });
  };

  return (
    <main className="relative h-screen w-full overflow-hidden select-none bg-[#222f3e]">
      <div className="absolute inset-0 z-0 map-layer"><div className="absolute inset-0 map-grid-overlay" /></div>
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-yellow-400 border-4 border-black px-3 py-1 shadow-[4px_4px_0px_black] -rotate-2 rounded-lg">
          <h1 className="font-['Press_Start_2P'] text-black text-xs md:text-sm">SUI<span className="text-white text-stroke-sm">GO</span></h1>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 z-20">
         <div className="bg-white border-4 border-black p-1 shadow-[4px_4px_0px_black] rounded-lg">
            <ConnectButton className="!font-['VT323'] !text-lg !bg-blue-500 !text-white !border-none !rounded" />
         </div>
      </div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {(!account || (account && !hasPet)) && (
             <IntroScene account={account} isPending={isPending} refetch={refetch} />
          )}
          {account && hasPet && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md flex flex-col h-[85vh]">
                <div className="flex-1 relative flex items-center justify-center">
                    <div className="absolute top-10 right-4 bg-white border-4 border-black p-2 rounded-xl rounded-bl-none animate-bounce shadow-lg z-20 text-xs font-bold text-black">
                        {petAction === 'eating' ? "YUMMY! 🍗" : hunger < 30 ? "HUNGRY... 🍖" : happiness < 30 ? "PLAY! 😢" : "HAPPY! ❤️"}
                    </div>
                    <motion.div 
                        animate={
                            petAction === 'happy' ? { y: [0, -50, 0], rotate: [0, 10, -10, 0] } : 
                            petAction === 'eating' ? { scale: [1, 1.2, 1] } : {}
                        }
                        className="scale-[2]"
                    >
                       <div className="ghost-body">
                          <div className="ghost-face"></div>
                          {petAction === 'happy' && <div className="absolute top-6 left-3 w-8 h-4 bg-pink-300 rounded-full blur-sm" />}
                          <div className="ghost-blush"></div>
                          <div className="ghost-skirt"></div>
                       </div>
                    </motion.div>
                </div>
                <div className="bg-[#f5f6fa] border-4 border-black rounded-t-3xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative">
                    <div className="flex justify-between items-end mb-4 border-b-4 border-gray-200 pb-2">
                        <div>
                            <h2 className="text-3xl font-bold uppercase font-['VT323'] leading-none text-black">{petName}</h2>
                            <span className="bg-yellow-400 px-2 border-2 border-black font-bold text-xs text-black">LVL {level}</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600 font-bold text-lg">
                            <Zap size={16} fill="currentColor" /> {100 - hunger}%
                        </div>
                    </div>
                    <div className="space-y-3 mb-6 text-black">
                        <StatusBar label="HUNGER" value={hunger} color="bg-orange-500" max={100} icon={<Utensils size={14}/>} />
                        <StatusBar label="HAPPY" value={happiness} color="bg-pink-500" max={100} icon={<Heart size={14}/>} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <PixelButton label="PLAY" color="bg-blue-400" icon={<Gamepad2 size={20} />} onClick={handlePlay} />
                        <PixelButton label="HUNT" color="bg-green-400" icon={<Search size={20} />} onClick={handleScavenge} />
                        <PixelButton label="ITEMS" color="bg-purple-400" icon={<ShoppingBag size={20} />} onClick={() => setShowInventory(true)} />
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
            {showInventory && (
                <motion.div 
                    initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
                    className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
                >
                    <div className="w-full max-w-md bg-white border-t-4 border-l-4 border-r-4 border-black rounded-t-3xl p-6 h-[70vh] flex flex-col text-black">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold font-['VT323']">INVENTORY</h2>
                            <button onClick={() => setShowInventory(false)} className="bg-red-500 text-white p-2 border-2 border-black rounded hover:translate-y-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            <div className="bg-blue-100 border-4 border-black p-4 rounded-xl flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center text-white"><ShoppingBag /></div>
                                    <div><h3 className="font-bold text-xl">BUY FOOD</h3><p className="text-xs text-gray-500">0.1 SUI</p></div>
                                </div>
                                <button onClick={handleBuyFood} className="bg-green-500 text-white px-4 py-2 border-2 border-black font-bold shadow-[2px_2px_0px_black] active:translate-y-1 active:shadow-none">BUY</button>
                            </div>
                            {foodList.length === 0 ? (
                                <p className="text-center text-gray-400 mt-10">Tas Kosong. Beli makan dulu!</p>
                            ) : (
                                foodList.map((food: any) => (
                                    <div key={food.data?.objectId} className="bg-gray-100 border-4 border-gray-300 p-4 rounded-xl flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="text-4xl">🍖</div>
                                            <div><h3 className="font-bold text-xl">MEAT</h3><p className="text-xs text-gray-500">Restore Hunger</p></div>
                                        </div>
                                        <button onClick={() => handleFeed(food.data?.objectId)} className="bg-orange-500 text-white px-4 py-2 border-2 border-black font-bold shadow-[2px_2px_0px_black] active:translate-y-1 active:shadow-none">USE</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function StatusBar({ label, value, color, max, icon }: any) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="flex items-center gap-3 text-xs md:text-sm">
            <div className="w-16 font-bold flex items-center gap-1">{icon} {label}</div>
            <div className="flex-1 h-5 border-4 border-black rounded-full p-0.5 bg-white relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full ${color} rounded-l-sm border-r-2 border-black/20`} />
            </div>
            <div className="w-8 text-right font-bold">{value}</div>
        </div>
    )
}

function PixelButton({ label, color, icon, onClick }: any) {
    return (
        <button onClick={onClick} className={`btn-pushable w-full group`}>
            <span className="btn-shadow rounded-xl"></span>
            <span className="btn-edge rounded-xl bg-black"></span>
            <span className={`btn-front rounded-xl flex flex-col items-center justify-center gap-1 py-3 ${color} border-4 border-black`}>
                {icon}
                <span className="font-['VT323'] text-xl font-bold tracking-widest text-black">{label}</span>
            </span>
        </button>
    )
}

function IntroScene({ account, isPending, refetch }: any) {
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [petName, setPetName] = useState('');
    const [isMinting, setIsMinting] = useState(false);

    const handleMint = () => {
        if (!petName) return;
        setIsMinting(true);
        const tx = new Transaction();
        tx.moveCall({ target: `${PACKAGE_ID}::core::mint_pet`, arguments: [tx.pure.string(petName), tx.object('0x6')] });
        signAndExecute({ transaction: tx }, { onSuccess: () => { setIsMinting(false); refetch(); }, onError: () => setIsMinting(false) });
    };

    if (!account) return (
        <motion.div initial={{scale:0}} animate={{scale:1}} className="pop-card p-8 text-center bg-white rounded-3xl max-w-sm">
            <div className="bg-blue-100 border-4 border-black h-48 mb-6 flex items-center justify-center rounded-2xl relative shadow-inner overflow-hidden">
                <div className="scale-150 mt-8">
                   <div className="dino-body">
                      <div className="dino-head"><div className="dino-eye"></div></div>
                      <div className="dino-spikes"></div>
                      <div className="dino-leg left"></div><div className="dino-leg right"></div>
                   </div>
                </div>
            </div>
            <h2 className="text-3xl font-bold uppercase mb-4 text-black">SUI PET GO</h2>
            <p className="text-xl mb-6 text-black">Connect Wallet to Start</p>
        </motion.div>
    );

    if (isPending) return <div className="text-white text-2xl font-bold animate-pulse">LOADING...</div>;

    return (
        <motion.div initial={{scale:0}} animate={{scale:1}} className="pop-card p-6 w-full max-w-sm bg-white rounded-3xl">
            <div className="text-center mb-6 mt-4 relative">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                    <div className="pixel-egg"></div>
                </div>
                <h2 className="text-3xl font-bold mt-12 text-blue-500">EGG FOUND!</h2>
                <p className="text-gray-500">Name your companion:</p>
            </div>
            <input 
                type="text" 
                placeholder="NAME..." 
                maxLength={10} 
                className="w-full border-4 border-black p-3 text-3xl text-center font-bold uppercase rounded-xl mb-4 text-black bg-white" 
                value={petName} 
                onChange={(e) => setPetName(e.target.value)} 
            />
            <PixelButton label={isMinting ? "HATCHING..." : "HATCH"} color="bg-yellow-400" onClick={handleMint} />
        </motion.div>
    );
}