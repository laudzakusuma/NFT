module sui_pet::core {
    use std::string::{Self, String};
    use sui::event;
    use sui::clock::{Clock};
    use sui::random::{Self, Random};
    use sui::ed25519;
    use sui::package;
    use sui::display;

    const MAX_VALUE: u64 = 100;
    const MAX_LEVEL: u8 = 30;
    const XP_TO_LEVEL_UP: u64 = 100;
    const DECAY_RATE_MS: u64 = 10000;
    const SCAVENGE_COOLDOWN_MS: u64 = 60000;
    const E_PET_DEAD: u64 = 0;
    const E_LEVEL_TOO_LOW: u64 = 2;
    const E_SCAVENGE_COOLDOWN: u64 = 3;
    const E_INVALID_SIGNATURE: u64 = 99;

    const ORACLE_PUBLIC_KEY: vector<u8> = x"e6f1f4595482cbaf214358579cd3a8fc135f7c36a63d4ce8fd89ced70d6a0171"; 
    public struct CORE has drop {}

    public struct Pet has key, store {
        id: UID,
        name: String,
        level: u8,
        xp: u64,
        hunger: u64,
        happiness: u64,
        rarity: u8,
        last_update: u64,
        last_scavenge: u64,
        is_alive: bool,
        birth_lat: String, 
        birth_lng: String,
    }

    public struct Food has key, store {
        id: UID,
        calories: u64,
    }

    public struct PetMinted has copy, drop { pet_id: ID, owner: address, rarity: u8 }
    public struct PetEvolved has copy, drop { pet_id: ID, new_rarity: u8, success: bool }
    public struct LootFound has copy, drop { pet_id: ID, food_amount: u64 }
    public struct PetStatus has copy, drop { pet_id: ID, hunger: u64, happiness: u64, alive: bool, level: u8, xp: u64 }
    public struct PetCaught has copy, drop { pet_id: ID, owner: address, lat: String, lng: String, rarity: u8 }

    fun init(otw: CORE, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        let mut keys = vector[];
        let mut values = vector[];

        keys.push_back(string::utf8(b"name"));
        keys.push_back(string::utf8(b"image_url"));
        keys.push_back(string::utf8(b"description"));
        keys.push_back(string::utf8(b"project_url"));

        values.push_back(string::utf8(b"{name} (Lvl {level})"));
        values.push_back(string::utf8(b"https://gateway.pinata.cloud/ipfs/bafybeidffrsi7sdjm3vpevxvnqnjpa23edz7o22el5ik7dgmjcae4lcdry/{rarity}.png"));
        values.push_back(string::utf8(b"A Mythical Pet from suiGo ! Rarity: {rarity}"));
        values.push_back(string::utf8(b"https://github.com/laudzakusuma/NFT"));

        let mut display = display::new_with_fields<Pet>(
            &publisher, keys, values, ctx
        );

        display::update_version(&mut display);

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(display, ctx.sender());
    }

    entry fun gacha_pet(
        name_bytes: vector<u8>,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let mut generator = random::new_generator(r, ctx);
        let rand = random::generate_u8_in_range(&mut generator, 0, 100);
        let rarity = if (rand < 60) {
            1
        } else if (rand < 90) {
            2
        } else if (rand < 99) {
            3
        } else {
            4
        };

        create_pet_internal(name_bytes, rarity, string::utf8(b"Gacha"), string::utf8(b"Gacha"), clock, ctx);
    }

    entry fun catch_pet(
        signature: vector<u8>,
        msg: vector<u8>,
        lat_str: vector<u8>,
        lng_str: vector<u8>,
        rarity: u8,
        name_bytes: vector<u8>,
        clock: &Clock, 
        ctx: &mut TxContext
    ) {
        let pk = ORACLE_PUBLIC_KEY;
        
        assert!(ed25519::ed25519_verify(&signature, &pk, &msg), E_INVALID_SIGNATURE);

        let pet = Pet {
            id: object::new(ctx),
            name: string::utf8(name_bytes),
            level: 1,
            xp: 0,
            hunger: MAX_VALUE,
            happiness: MAX_VALUE,
            rarity,
            last_update: clock.timestamp_ms(),
            last_scavenge: 0,
            is_alive: true,
            birth_lat: string::utf8(lat_str),
            birth_lng: string::utf8(lng_str),
        };

        event::emit(PetCaught {
            pet_id: object::uid_to_inner(&pet.id),
            owner: ctx.sender(),
            lat: string::utf8(lat_str),
            lng: string::utf8(lng_str),
            rarity: rarity
        });

        transfer::transfer(pet, ctx.sender());
    }

    entry fun mint_pet(name_bytes: vector<u8>, clock: &Clock, ctx: &mut TxContext) {
        let pet = Pet {
            id: object::new(ctx),
            name: string::utf8(name_bytes),
            level: 1,
            xp: 0,
            hunger: MAX_VALUE,
            happiness: MAX_VALUE,
            rarity: 1,
            last_update: clock.timestamp_ms(),
            last_scavenge: 0,
            is_alive: true,
            birth_lat: string::utf8(b"0"),
            birth_lng: string::utf8(b"0"),
        };
        event::emit(PetMinted { pet_id: object::uid_to_inner(&pet.id), owner: ctx.sender(), rarity: pet.rarity });
        transfer::transfer(pet, ctx.sender());
    }

    fun create_pet_internal(
        name_bytes: vector<u8>,
        rarity: u8,
        lat: String,
        lng: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let pet = Pet {
            id: object::new(ctx),
            name: string::utf8(name_bytes),
            level: 1,
            xp: 0,
            hunger: MAX_VALUE,
            happiness: MAX_VALUE,
            rarity,
            last_update: clock.timestamp_ms(),
            last_scavenge: 0,
            is_alive: true,
            birth_lat: lat,
            birth_lng: lng,
        };

        event::emit(PetMinted {
            pet_id: object::uid_to_inner(&pet.id),
            owner: ctx.sender(),
            rarity
        });

        transfer::transfer(pet, ctx.sender());
    }

    fun add_xp(pet: &mut Pet, amount: u64) {
        if (pet.level >= MAX_LEVEL) return;

        pet.xp = pet.xp + amount;

        if (pet.xp >= XP_TO_LEVEL_UP) {
            pet.level = pet.level + 1;
            pet.xp = pet.xp - XP_TO_LEVEL_UP;
            pet.hunger = MAX_VALUE;
            pet.happiness = MAX_VALUE;
        };
    }

    entry fun feed_pet(pet: &mut Pet, food: Food, clock: &Clock) {
        update_state(pet, clock);
        assert!(pet.is_alive, E_PET_DEAD);
        let Food { id, calories } = food;
        object::delete(id);
        let mut new_hunger = pet.hunger + calories;
        if (new_hunger > MAX_VALUE) { new_hunger = MAX_VALUE };
        pet.hunger = new_hunger;
        add_xp(pet, 10);
        emit_status(pet);
    }

    entry fun play_pet(pet: &mut Pet, clock: &Clock) {
        update_state(pet, clock);
        assert!(pet.is_alive, E_PET_DEAD);
        let mut new_happiness = pet.happiness + 10;
        if (new_happiness > MAX_VALUE) { new_happiness = MAX_VALUE };
        pet.happiness = new_happiness;
        if (pet.level < MAX_LEVEL) { pet.level = pet.level + 1; };
        add_xp(pet, 20);
        emit_status(pet);
    }

    entry fun scavenge(pet: &mut Pet, clock: &Clock, ctx: &mut TxContext) {
        assert!(pet.is_alive, E_PET_DEAD);
        let current_time = clock.timestamp_ms();
        assert!(current_time >= pet.last_scavenge + SCAVENGE_COOLDOWN_MS, E_SCAVENGE_COOLDOWN);
        pet.last_scavenge = current_time;
        let food = Food { id: object::new(ctx), calories: 20 };
        event::emit(LootFound { pet_id: object::uid_to_inner(&pet.id), food_amount: 20 });
        transfer::transfer(food, ctx.sender());
    }

    #[allow(lint(public_random))]
    entry fun evolve_pet(pet: &mut Pet, r: &Random, ctx: &mut TxContext) {
        assert!(pet.is_alive, E_PET_DEAD);
        assert!(pet.level >= MAX_LEVEL, E_LEVEL_TOO_LOW);
        let mut generator = random::new_generator(r, ctx);
        let is_success = random::generate_bool(&mut generator);
        if (is_success) {
            pet.rarity = pet.rarity + 1;
            pet.level = 1;
        } else {
            pet.happiness = 10;
        };
        event::emit(PetEvolved { pet_id: object::uid_to_inner(&pet.id), new_rarity: pet.rarity, success: is_success });
    }

    public(package) fun mint_food(calories: u64, ctx: &mut TxContext): Food {
        Food { id: object::new(ctx), calories }
    }

    public(package) fun update_battle_stats(pet: &mut Pet, win: bool) {
        if (win) {
            if (pet.level < MAX_LEVEL) { pet.level = pet.level + 1 };
        } else {
            if (pet.happiness > 20) { pet.happiness = pet.happiness - 20 } else { pet.happiness = 0 };
        };
    }

    public fun get_pet_info(pet: &Pet): (u8, u8, u64, u64, bool) {
        (pet.level, pet.rarity, pet.hunger, pet.happiness, pet.is_alive)
    }

    fun update_state(pet: &mut Pet, clock: &Clock) {
        if (!pet.is_alive) return;
        let current_time = clock.timestamp_ms();
        let time_diff = current_time - pet.last_update;
        let decay_amount = time_diff / DECAY_RATE_MS;
        if (decay_amount > 0) {
            if (pet.hunger > decay_amount) pet.hunger = pet.hunger - decay_amount else pet.hunger = 0;
            if (pet.happiness > decay_amount) pet.happiness = pet.happiness - decay_amount else pet.happiness = 0;
            if (pet.hunger == 0 && pet.happiness == 0) pet.is_alive = false;
            pet.last_update = current_time;
        };
    }

    fun emit_status(pet: &Pet) {
        event::emit(PetStatus { pet_id: object::uid_to_inner(&pet.id), hunger: pet.hunger, happiness: pet.happiness, alive: pet.is_alive, level: pet.level, xp: pet.xp });
    }
}