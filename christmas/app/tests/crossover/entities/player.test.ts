import {
    carryingCapacity,
    entityAbilities,
    entityActions,
    entityAttributes,
    entityLevel,
    entitySkills,
    entityStats,
    isOverweight,
} from "$lib/crossover/world/entity";
import { LOCATION_INSTANCE, MS_PER_TICK } from "$lib/crossover/world/settings";
import { actions } from "$lib/crossover/world/settings/actions";
import { compendium } from "$lib/crossover/world/settings/compendium";
import { move } from "$lib/server/crossover/actions";
import { equipItem, unequipItem } from "$lib/server/crossover/actions/item";
import { respawnPlayer } from "$lib/server/crossover/combat/utils";
import { spawnItemInInventory, spawnLocation } from "$lib/server/crossover/dm";
import { equipmentQuerySet } from "$lib/server/crossover/redis/queries";
import { fetchEntity, saveEntity } from "$lib/server/crossover/redis/utils";
import type { ItemEntity, PlayerEntity } from "$lib/server/crossover/types";
import { sleep } from "$lib/utils";
import { describe, expect, test } from "vitest";
import { createGandalfSarumanSauron, waitForEventData } from "../utils";

describe("Test Player Entity", async () => {
    let { region, geohash, playerOne, playerTwo, playerTwoStream } =
        await createGandalfSarumanSauron();

    test("Test Player Faction, Archetype, Demograpics", async () => {
        expect(playerOne).toMatchObject({
            fac: "historian",
        });
    });

    test("Test Player Abilities, Actions, Attributes, Level, Skills, Stats", async () => {
        // Check abilities
        const abilities = entityAbilities(playerOne);
        expect(abilities).toMatchObject(["bandage"]);

        // Check actions
        const actions = entityActions(playerOne);
        expect(actions).toMatchObject([
            "look",
            "say",
            "move",
            "inventory",
            "attack",
        ]);

        // Check attributes
        const attributes = entityAttributes(playerOne);
        expect(attributes).toMatchObject({
            str: 14,
            dex: 13,
            con: 13,
            mnd: 10,
            fth: 13,
            cha: 11,
        });

        // Check level
        const level = entityLevel(playerOne);
        expect(level).toEqual(1);

        // Check skills
        const skills = entitySkills(playerOne);
        expect(skills).toMatchObject({
            exploration: 1,
            firstaid: 1,
        });

        // Check stats
        const stats = entityStats(playerOne);
        expect(stats).toMatchObject({
            hp: 11,
            mnd: 1,
            cha: 1,
        });

        // Check faction
        expect(playerOne.fac).toBe("historian");
    });

    test("Test Player respawn at sanctuary monument", async () => {
        // Set player location (singapore)
        playerOne.loc = ["w21z3wys"];
        playerOne.locT = "geohash";
        playerOne = await saveEntity(playerOne);

        // Spawn location (control monument of sanctuary)
        await spawnLocation(playerOne.loc[0], "d1", LOCATION_INSTANCE, true); // force spawn in tests (as multiple running in parallel)

        // Check respawn player brings him to control monument at d1 sanctuary
        playerOne = await respawnPlayer(playerOne);

        expect(playerOne).toMatchObject({
            player: playerOne.player,
            loc: ["w21z9pum"],
            locT: "d1",
            locI: "@",
            fac: "historian",
        });
    });

    test("Test Overweight and Carrying Capacity", async () => {
        expect(carryingCapacity(playerTwo)).toBe(40);
        expect(playerTwo.wgt).toBe(0);
        expect(isOverweight(playerTwo)).toBeFalsy();

        // Equip steel plate
        let steelPlate = await spawnItemInInventory({
            entity: playerTwo,
            prop: compendium.steelplate.prop,
        });
        await equipItem(playerTwo, steelPlate.item);
        await sleep(MS_PER_TICK * actions.equip.ticks);

        // Equip steel leg
        let steelLeg = await spawnItemInInventory({
            entity: playerTwo,
            prop: compendium.steelleg.prop,
        });
        await equipItem(playerTwo, steelLeg.item);
        await sleep(MS_PER_TICK * actions.equip.ticks);

        // Equip steel boot
        let steelBoot = await spawnItemInInventory({
            entity: playerTwo,
            prop: compendium.steelboot.prop,
        });
        await equipItem(playerTwo, steelBoot.item);
        await sleep(MS_PER_TICK * actions.equip.ticks);

        // Check overweight
        playerTwo = (await fetchEntity(playerTwo.player)) as PlayerEntity;
        expect(playerTwo.wgt).toBe(
            compendium.steelplate.weight +
                compendium.steelleg.weight +
                compendium.steelboot.weight,
        );
        expect(isOverweight(playerTwo)).toBeTruthy();

        // Check can't move when overweight
        move(playerTwo, ["n"]);
        expect(await waitForEventData(playerTwoStream, "feed")).toMatchObject({
            type: "error",
            message: "You are overweight.",
            event: "feed",
        });
    });

    test("Test Player Equipment", async () => {
        // Check equipment before equipped
        var equipment = (await equipmentQuerySet(
            playerOne.player,
        ).returnAll()) as ItemEntity[];
        expect(equipment.length).toBe(0);

        // Check attributes before equipped
        expect(entityAttributes(playerOne).dex).toBe(13);

        // Check weight is 0
        expect(playerOne.wgt).toBe(0);

        // Equip steel plate
        let steelPlate = await spawnItemInInventory({
            entity: playerOne,
            prop: compendium.steelplate.prop,
        });
        await equipItem(playerOne, steelPlate.item);

        // Check weight after equip
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.wgt).toBe(compendium[steelPlate.prop].weight);

        // Check attributes after equipped
        expect(entityAttributes(playerOne).dex).toBe(11);

        // Check equipment after equipped
        equipment = (await equipmentQuerySet(
            playerOne.player,
        ).returnAll()) as ItemEntity[];

        // Check weight after unequip
        await unequipItem(playerOne, steelPlate.item);
        playerOne = (await fetchEntity(playerOne.player)) as PlayerEntity;
        expect(playerOne.wgt).toBe(0);

        // Check attributes after unequip
        expect(entityAttributes(playerOne).dex).toBe(13);
    });
});
