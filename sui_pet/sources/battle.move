module sui_pet::battle {
    use sui::event;
    use sui::random::{Self, Random};
    use sui_pet::core::{Self, Pet};

    const E_PET_NOT_READY: u64 = 1;

    public struct BattleResult has copy, drop {
        attacker: ID,
        defender: ID,
        winner: ID,
    }

    #[allow(lint(public_random))]
    entry fun fight(
        attacker: &mut Pet,
        defender: &mut Pet,
        r: &Random,
        ctx: &mut TxContext
    ) {
        let (_, _, _, att_happy, att_alive) = core::get_pet_info(attacker);
        let (_, _, _, def_happy, def_alive) = core::get_pet_info(defender);

        assert!(att_alive && def_alive, E_PET_NOT_READY);
        assert!(att_happy > 20 && def_happy > 20, E_PET_NOT_READY);

        let mut generator = random::new_generator(r, ctx);
        let is_attacker_win = random::generate_bool(&mut generator);

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
        });
    }
}