import { abilitiesActionsIR, entitiesIR, tokenize } from "$lib/crossover/ir";
import {
    resolveAbilityEntities,
    type Ability,
} from "$lib/crossover/world/abilities";
import type { PropAction } from "$lib/crossover/world/compendium";
import { abilities, compendium } from "$lib/crossover/world/settings";
import { spawnItem, spawnMonster } from "$lib/server/crossover";
import type { ItemEntity } from "$lib/server/crossover/redis/entities";
import { expect, test } from "vitest";
import { getRandomRegion } from "../utils";
import { createRandomPlayer, generateRandomGeohash } from "./utils";

test("Test Player", async () => {
    const region = String.fromCharCode(...getRandomRegion());

    // Player one
    const playerOneName = "Gandalf";
    const playerOneGeohash = generateRandomGeohash(6);
    let [playerOneWallet, playerOneCookies, playerOne] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerOneName,
        });

    // Player two
    const playerTwoName = "Saruman";
    const playerTwoGeohash = generateRandomGeohash(6);
    let [playerTwoWallet, playerTwoCookies, playerTwo] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerTwoName,
        });

    // Player three
    const playerThreeName = "Sauron";
    const playerThreeGeohash = playerOneGeohash;
    let [playerThreeWallet, playerThreeCookies, playerThree] =
        await createRandomPlayer({
            region,
            geohash: generateRandomGeohash(8, "h9"),
            name: playerThreeName,
        });

    // Wooden Door
    let woodenDoor = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenDoor.prop,
        variables: {
            [compendium.woodenDoor.variables.doorSign.variable]:
                "A custom door sign",
        },
    })) as ItemEntity;

    // Wooden club
    let woodenClub = (await spawnItem({
        geohash: generateRandomGeohash(8, "h9"),
        prop: compendium.woodenClub.prop,
    })) as ItemEntity;

    // Portal
    let portal = (await spawnItem({
        geohash: playerOne.location[0], // spawn at playerOne
        prop: compendium.portal.prop,
    })) as ItemEntity;

    // Dragon
    let dragon = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "dragon",
        level: 1,
    });

    // Goblin
    let goblin = await spawnMonster({
        geohash: generateRandomGeohash(8, "h9"),
        beast: "goblin",
        level: 1,
    });

    // Actions & Abilities
    const playerActions: PropAction[] = Object.values(compendium).flatMap(
        (prop) => Object.values(prop.actions),
    );
    const playerAbilities: Ability[] = Object.values(abilities);

    /**
     * Test query flow (player scratch goblin)
     */

    // Tokenize query
    let query = "scratch goblin";
    let queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var { monsters, players, items } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodenDoor, woodenClub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var { actions, abilities: abilitiesRetrieved } = abilitiesActionsIR({
        queryTokens,
        abilities: playerAbilities,
        actions: playerActions,
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    let abilityEntities = abilitiesRetrieved
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "scratch",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    monster: goblin.monster,
                },
            },
        ],
    ]);

    /**
     * Test query flow (dragon breathe fire on goblin)
     */

    // Tokenize query
    query = "breathFire on goblin";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var { monsters, players, items } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodenDoor, woodenClub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var { actions, abilities: abilitiesRetrieved } = abilitiesActionsIR({
        queryTokens,
        abilities: playerAbilities,
        actions: playerActions,
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesRetrieved
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                ability: ability.ability,
                self: dragon, // self is dragon
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "breathFire",
            },
            {
                self: {
                    monster: dragon.monster,
                },
                target: {
                    monster: goblin.monster,
                },
            },
        ],
    ]);

    /**
     * Test query flow (playerOne bandage self)
     */

    // Tokenize query
    query = "bandage gandalf";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var { monsters, players, items } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodenDoor, woodenClub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var { actions, abilities: abilitiesRetrieved } = abilitiesActionsIR({
        queryTokens,
        abilities: playerAbilities,
        actions: playerActions,
    });

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesRetrieved
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);
    expect(abilityEntities).to.toMatchObject([
        [
            {
                ability: "bandage",
            },
            {
                self: {
                    player: playerOne.player,
                },
                target: {
                    player: playerOne.player,
                },
            },
        ],
    ]);

    /**
     * Test query flow (playerOne scratch self) - should not resolve
     */

    // Tokenize query
    query = "scratch gandalf";
    queryTokens = tokenize(query);

    // Retrieve entities relevant to query from the environment
    var { monsters, players, items } = entitiesIR({
        queryTokens,
        monsters: [dragon, goblin],
        players: [playerOne, playerTwo, playerThree],
        items: [woodenDoor, woodenClub, portal],
    });

    // Retrieve actions and abilities relevant to query
    var { actions, abilities: abilitiesRetrieved } = abilitiesActionsIR({
        queryTokens,
        abilities: playerAbilities,
        actions: playerActions,
    });

    //  WHY BANDAGE AND SCRATCH RETURNED? should only be scratch
    // !! bandage and gandalf are matching - ensure token only used once make more strict
    console.log("abilitiesRetrieved", abilitiesRetrieved);

    // Resolve abilities relevant to retrieved entities (may have multiple resolutions - allow selection by user)
    abilityEntities = abilitiesRetrieved
        .map((ability) => [
            ability,
            resolveAbilityEntities({
                queryTokens,
                ability: ability.ability,
                self: playerOne,
                monsters,
                players,
                items,
            }),
        ])
        .filter(([ability, entities]) => entities != null);

    console.log(JSON.stringify(abilityEntities, null, 2));
});