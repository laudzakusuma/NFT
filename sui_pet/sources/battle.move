module sui_pet::battle {
    use sui::event;
    use sui::random::{Self, Random};
    use sui_pet::core::{Self, Pet};
    
    const E_PET_NOT_READY: u64 = 1;

    public struct BattleResult has copy, drop {
        attacker: ID, 
        defender: ID, 
        winner: ID, 
        advantage: bool
    }

    #[allow(lint(public_random))]
    entry fun fight(
        attacker: &mut Pet,
        defender: &mut Pet,
        r: &Random,
        ctx: &mut TxContext
    ) {
        let (att_lvl, _, att_elm, _, att_happy, att_alive) = core::get_pet_info(attacker);
        let (def_lvl, _, def_elm, _, def_happy, def_alive) = core::get_pet_info(defender);

        assert!(att_alive && def_alive, E_PET_NOT_READY);
        assert!(att_happy > 20 && def_happy > 20, E_PET_NOT_READY);

        let mut generator = random::new_generator(r, ctx);
        let mut win_chance: u64 = 50; 

        if (att_lvl > def_lvl) {
            win_chance = win_chance + ((att_lvl - def_lvl) as u64 * 5);
        } else if (def_lvl > att_lvl) {
            let diff = (def_lvl - att_lvl) as u64 * 5;
            if (win_chance > diff) win_chance = win_chance - diff else win_chance = 10;
        };

        let mut advantage = false;
        
        if (
            (att_elm == 1 && def_elm == 3) || 
            (att_elm == 2 && def_elm == 1) || 
            (att_elm == 3 && def_elm == 2)    
        ) {
            win_chance = win_chance + 20; 
            advantage = true;
        } else if (
            (def_elm == 1 && att_elm == 3) || 
            (def_elm == 2 && att_elm == 1) || 
            (def_elm == 3 && att_elm == 2)
        ) {
            if (win_chance > 20) win_chance = win_chance - 20 else win_chance = 5;
        };

        if (win_chance > 95) win_chance = 95;
        if (win_chance < 5) win_chance = 5;

        let roll = random::generate_u8_in_range(&mut generator, 0, 100);
        let is_attacker_win = (roll as u64) < win_chance;

        if (is_attacker_win) {
            core::update_battle_stats(attacker, true); 
            core::update_battle_stats(defender, false);
        } else {
            core::update_battle_stats(attacker, false); 
            core::update_battle_stats(defender, true); 
        };

        event::emit(BattleResult {
            attacker: object::id(attacker),
            defender: object::id(defender),
            winner: if (is_attacker_win) object::id(attacker) else object::id(defender),
            advantage
        });
    }
}