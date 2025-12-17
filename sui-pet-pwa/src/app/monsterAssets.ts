import dragonCommon from '../public/monsters/dragon_common.png';
import dragonRare from '../public/monsters/dragon_rare.png';
import dragonEpic from '../public/monsters/dragon_epic.png';
import dragonLegendary from '../public/monsters/dragon_legendary.png';

export const getPetImage = (rarity: number) => {
  if (rarity === 1) return dragonCommon;
  if (rarity === 2) return dragonRare;
  if (rarity === 3) return dragonEpic;
  if (rarity === 4) return dragonLegendary;
  
  return dragonCommon;
};

export const getRarityLabel = (rarity: number) => {
  if (rarity === 1) return "Common";
  if (rarity === 2) return "Rare";
  if (rarity === 3) return "Epic";
  if (rarity === 4) return "Legendary";
  return "Unknown";
};

export const getRarityColor = (rarity: number) => {
  if (rarity === 1) return "text-gray-400";      
  if (rarity === 2) return "text-yellow-400";    
  if (rarity === 3) return "text-purple-400";    
  if (rarity === 4) return "text-red-500 shadow-glow"; 
  return "text-white";
};