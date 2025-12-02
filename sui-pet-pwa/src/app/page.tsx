'use client';

import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useState } from 'react'; 
import { PET_TYPE, PACKAGE_ID } from '../utils/contracts';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Crosshair } from 'lucide-react';

export default function Home() {
  const account = useCurrentAccount();
  const { data: petData, isPending, refetch } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address as string,
      filter: { StructType: PET_TYPE },
      options: { showContent: true },
    },
    { enabled: !!account }
  );

  const hasPet = petData?.data && petData.data.length > 0;
  const petObject = hasPet ? petData.data[0] : null;

  return (
    <main className="relative h-screen w-full overflow-hidden select-none bg-[#222f3e]">
      <div className="absolute inset-0 z-0 map-layer">
        <div className="absolute inset-0 map-grid-overlay" />
        <FloatingCloud duration={25} top="15%" size="text-8xl" />
        <FloatingCloud duration={18} top="40%" size="text-6xl" />
      </div>
      <div className="absolute top-6 left-6 z-20">
        <motion.div 
          initial={{ y: -100 }} animate={{ y: 0 }}
          className="bg-yellow-400 border-4 border-black px-4 py-2 shadow-[4px_4px_0px_black] -rotate-2 rounded-xl"
        >
          <h1 className="font-['Press_Start_2P'] text-black text-sm md:text-base">
            SUI<span className="text-white text-stroke-sm">GO</span>
          </h1>
        </motion.div>
      </div>
      <div className="absolute top-6 right-6 z-20">
         <div className="bg-white border-4 border-black p-1 shadow-[4px_4px_0px_black] hover:translate-y-1 transition-all rounded-lg">
            <ConnectButton className="!font-['VT323'] !text-xl !bg-blue-500 !text-white !border-none !rounded-md" />
         </div>
      </div>
      <div className="relative z-10 h-full flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {!account && (
            <motion.div
              key="welcome"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="pop-card p-8 pb-12 max-w-sm w-full text-center relative bg-white rounded-3xl"
            >
              <div className="bg-blue-50 border-4 border-black h-48 mb-6 flex items-center justify-center rounded-2xl overflow-hidden relative shadow-inner">
                 <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
                 <div className="scale-150 mt-8">
                    <div className="dino-body">
                       <div className="dino-head">
                          <div className="dino-eye"></div>
                       </div>
                       <div className="dino-spikes"></div>
                       <div className="dino-leg left"></div>
                       <div className="dino-leg right"></div>
                    </div>
                 </div>
              </div>
              <h2 className="text-4xl font-bold mb-3 uppercase text-stroke-sm text-yellow-400 font-['Press_Start_2P'] drop-shadow-md leading-relaxed">
                READY?
              </h2>
              <p className="text-xl text-black font-bold mb-8 font-['VT323']">
                Connect wallet to hunt!
              </p>
              <div className="w-full h-6 border-4 border-black rounded-full p-1 bg-gray-200 shadow-inner">
                <motion.div 
                  initial={{ width: "10%" }}
                  animate={{ width: ["10%", "100%", "10%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="h-full bg-green-500 rounded-full"
                />
              </div>
            </motion.div>
          )}
          {account && !isPending && !hasPet && (
            <JuicyMintUI onSuccess={refetch} />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {account && !isPending && hasPet && petObject && (
          <motion.footer 
            initial={{ y: 200 }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 120 } }}
            className="absolute bottom-0 w-full z-30 p-4"
          >
            <div className="flex justify-center gap-6 mb-6">
               <PushButton icon={<MapPin size={24} />} color="#ff9f43" label="MAP" />
               <PushButton icon={<Crosshair size={24} />} color="#ee5253" label="AR" />
            </div>
            <div className="bg-white border-4 border-black rounded-t-3xl p-4 shadow-[0px_-4px_20px_rgba(0,0,0,0.4)] max-w-lg mx-auto relative">
              <div className="relative z-10 flex gap-4 items-center">
                 <div className="w-20 h-20 bg-[#a29bfe] border-4 border-black rounded-full flex items-center justify-center shrink-0 shadow-[2px_2px_0px_black] overflow-hidden relative">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="scale-50 mt-4">
                       <div className="ghost-body">
                          <div className="ghost-face"></div>
                          <div className="ghost-blush"></div>
                          <div className="ghost-skirt"></div>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                       <h3 className="text-2xl font-bold uppercase font-['VT323']">GHOSTY</h3>
                       <div className="bg-black text-white px-2 rounded-lg font-bold text-sm">LVL 1</div>
                    </div>
                    <div className="w-full bg-gray-200 h-6 border-2 border-black rounded-full overflow-hidden relative">
                       <div className="h-full bg-green-500 w-[80%] border-r-2 border-black" />
                       <div className="absolute inset-0 flex items-center justify-center text-xs font-bold pt-1 text-black">
                         HP 80/100
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </main>
  );
}

function PushButton({ icon, color, label }: { icon: any, color: string, label?: string }) {
  return (
    <button className="btn-pushable group">
      <span className="btn-shadow rounded-2xl"></span>
      <span className="btn-edge rounded-2xl" style={{ background: 'black' }}></span>
      <span className="btn-front rounded-2xl flex items-center justify-center gap-2" style={{ background: color }}>
        {icon}
        {label && <span className="font-['VT323'] text-xl font-bold">{label}</span>}
      </span>
    </button>
  );
}

function JuicyMintUI({ onSuccess }: { onSuccess: () => void }) {
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
    signAndExecute({ transaction: tx }, {
        onSuccess: () => { setIsMinting(false); onSuccess(); },
        onError: (err) => { console.error(err); setIsMinting(false); }
    });
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: 2 }}
      className="pop-card p-6 w-full max-w-sm bg-white rotate-2 transition-transform duration-300 rounded-3xl"
    >
      <div className="text-center mb-6 mt-4">
         <div className="inline-block relative">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                <div className="pixel-egg"></div>
            </div>
            <h2 className="text-3xl font-bold uppercase font-['Press_Start_2P'] text-blue-500 leading-tight drop-shadow-md text-stroke-sm mt-8">
              NEW EGG<br />FOUND!
            </h2>
         </div>
         <p className="text-xl font-bold text-gray-600 mt-4 font-['VT323']">What will you name it?</p>
      </div>
      <div className="space-y-6 relative z-10">
        <div className="relative">
           <input
             type="text"
             placeholder="NAME ME!"
             maxLength={10}
             className="w-full border-4 border-black p-4 text-4xl text-center font-bold uppercase outline-none focus:bg-yellow-50 focus:border-blue-500 transition-colors rounded-2xl shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)] font-['VT323'] text-black placeholder:text-gray-300"
             value={petName}
             onChange={(e) => setPetName(e.target.value)}
           />
        </div>
        <button 
           onClick={handleMint}
           disabled={!petName || isMinting}
           className="btn-pushable w-full"
        >
          <span className="btn-shadow rounded-2xl"></span>
          <span className="btn-edge rounded-2xl"></span>
          <span className="btn-front rounded-2xl w-full text-center py-4">
            {isMinting ? 'HATCHING...' : 'HATCH IT!'}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

function FloatingCloud({ duration, top, size }: { duration: number, top: string, size: string }) {
   return (
      <motion.div
        animate={{ x: ["-20vw", "120vw"] }}
        transition={{ duration: duration, repeat: Infinity, ease: "linear" }}
        className={`absolute left-0 opacity-80 select-none pointer-events-none ${size} text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,0.2)]`}
        style={{ top: top }}
      >
         ☁️
      </motion.div>
   )
}