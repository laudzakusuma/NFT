module sui_pet::shop {
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui_pet::core::{Self}; 

    const FOOD_PRICE: u64 = 100_000_000; 
    const E_PAYMENT_NOT_ENOUGH: u64 = 0;

    public struct Shop has key {
        id: UID,
        balance: Balance<SUI>,
    }

    public struct ShopOwnerCap has key, store { 
        id: UID 
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(Shop {
            id: object::new(ctx),
            balance: balance::zero(),
        });
        
        transfer::transfer(ShopOwnerCap {
            id: object::new(ctx)
        }, ctx.sender());
    }

    entry fun buy_food(shop: &mut Shop, payment: &mut Coin<SUI>, ctx: &mut TxContext) {
        assert!(coin::value(payment) >= FOOD_PRICE, E_PAYMENT_NOT_ENOUGH);

        let paid_coin = coin::split(payment, FOOD_PRICE, ctx);
        balance::join(&mut shop.balance, coin::into_balance(paid_coin));

        let food_item = core::mint_food(50, ctx);
        transfer::public_transfer(food_item, ctx.sender());
    }

    entry fun withdraw(shop: &mut Shop, _cap: &ShopOwnerCap, ctx: &mut TxContext) {
        let amount = balance::value(&shop.balance);
        let profits = coin::take(&mut shop.balance, amount, ctx);
        transfer::public_transfer(profits, ctx.sender());
    }
}