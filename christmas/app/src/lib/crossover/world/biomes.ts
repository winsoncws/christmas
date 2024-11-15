import { type CacheInterface } from "$lib/caches";
import { geohashToColRow } from "$lib/crossover/utils";
import { seededRandom, stringToRandomNumber } from "$lib/utils/random";
import { cloneDeep, memoize } from "lodash-es";
import { PNG, type PNGWithMetadata } from "pngjs";
import { GAME_TOPOLOGY_IMAGES } from "../defs";
import { dungeonBiomeAtGeohash } from "./dungeons";
import { worldSeed } from "./settings/world";
import {
    geohashLocationTypes,
    type AssetMetadata,
    type GeohashLocation,
    type NoiseType,
} from "./types";
import { type WorldSeed } from "./world";
export {
    biomeAtGeohash,
    biomeParametersAtCity,
    biomes,
    biomeTypes,
    elevationAtGeohash,
    topologyAtGeohash,
    topologyTile,
    type Biome,
    type BiomeParameters,
    type BiomeType,
    type LandGrading,
};

const biomeTypes: BiomeType[] = [
    "grassland",
    "forest",
    "desert",
    "tundra",
    "underground",
    "aquatic",
];
type BiomeType =
    | "grassland"
    | "forest"
    | "desert"
    | "tundra"
    | "underground"
    | "aquatic";

type BiomeParameters = {
    [s in BiomeType]?: number;
};

type LandGrading = Partial<
    Record<
        GeohashLocation,
        Record<
            string,
            {
                elevation?: number;
                decorations?: boolean;
            }
        >
    >
>;

interface Decoration {
    asset: AssetMetadata;
    minInstances: number;
    maxInstances: number;
    probability: number;
    noise: NoiseType;
    radius: number; // in cells
}

interface Biome {
    biome: BiomeType;
    name: string;
    traversableSpeed: number; // 0.0 - 1.0
    asset?: AssetMetadata;
    decorations?: Record<string, Decoration>;
}

/**
 * `biomes` is a collection of all the `Biome` available in the game.
 */
let biomes: Record<BiomeType, Biome> = {
    underground: {
        biome: "underground",
        name: "Rocks",
        traversableSpeed: 0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "rocks1",
            },
            probability: {
                default: 1,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    forest: {
        biome: "forest",
        name: "Forest",
        traversableSpeed: 0.8,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "grass1", // frames in the sprite sheet
                alt1: "grass2",
                alt2: "grass3",
            },
            probability: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        decorations: {
            grass: {
                probability: 0.5,
                noise: "simplex",
                minInstances: 1,
                maxInstances: 5,
                radius: 1,
                asset: {
                    path: "biomes/grass",
                    variants: {
                        default: "0053",
                        alt1: "0052",
                        alt2: "0054",
                    },
                    probability: {
                        default: 0.33,
                        alt1: 0.33,
                        alt2: 0.33,
                    },
                    width: 0.5,
                    height: 0.5,
                    precision: worldSeed.spatial.unit.precision,
                },
            },
        },
    },
    grassland: {
        biome: "grassland",
        name: "Grassland",
        traversableSpeed: 1.0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "grass1",
                alt1: "grass2",
                alt2: "grass3",
            },
            probability: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
        decorations: {
            grass: {
                probability: 0.5,
                noise: "simplex",
                minInstances: 1,
                maxInstances: 5,
                radius: 1,
                asset: {
                    path: "biomes/grass",
                    variants: {
                        default: "0053",
                        alt1: "0052",
                        alt2: "0054",
                    },
                    probability: {
                        default: 0.33,
                        alt1: 0.33,
                        alt2: 0.33,
                    },
                    width: 0.5,
                    height: 0.5,
                    precision: worldSeed.spatial.unit.precision,
                },
            },
        },
    },
    desert: {
        biome: "desert",
        name: "Desert",
        traversableSpeed: 1.0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "grass1",
                alt1: "grass2",
                alt2: "grass3",
            },
            probability: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    tundra: {
        biome: "tundra",
        name: "Tundra",
        traversableSpeed: 1.0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "grass1",
                alt1: "grass2",
                alt2: "grass3",
            },
            probability: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
    aquatic: {
        biome: "aquatic",
        name: "Water",
        traversableSpeed: 0,
        asset: {
            path: "biomes/terrain",
            variants: {
                default: "rocks1",
                alt1: "rocks2",
                alt2: "rocks3",
            },
            probability: {
                default: 0.33,
                alt1: 0.33,
                alt2: 0.33,
            },
            width: 1,
            height: 1,
            precision: worldSeed.spatial.unit.precision,
        },
    },
};

function topologyTile(geohash: string): {
    url: string;
    topLeft: string;
    rows: number;
    cols: number;
    row: number;
    col: number;
    tlCol: number;
    tlRow: number;
} {
    // The topology is stored as 2p tiles (4 rows, 8 cols)
    const tile = geohash.slice(0, 2);
    let rows = 4;
    let cols = 8;
    let topLeft = tile;
    for (let i = 0; i < geohash.length - 2 - 1; i++) {
        if (i % 2 === 0) {
            rows *= 8;
            cols *= 4;
            topLeft += "b";
        } else {
            rows *= 4;
            cols *= 8;
            topLeft += "p";
        }
    }

    if (topLeft.slice(-1) === "b") {
        topLeft += "p";
    } else {
        topLeft += "b";
    }

    const [tlCol, tlRow] = geohashToColRow(topLeft);
    const [col, row] = geohashToColRow(geohash);

    return {
        url: `${GAME_TOPOLOGY_IMAGES}/${tile}.png`,
        topLeft,
        rows,
        cols,
        col: col - tlCol,
        row: row - tlRow,
        tlCol,
        tlRow,
    };
}

async function topologyBuffer(
    url: string,
    options?: {
        responseCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<PNGWithMetadata> {
    // Return cached buffer
    const buffer = await options?.bufferCache?.get(url);
    if (buffer) {
        return buffer;
    }

    // Fetch response from cache or network
    let cachedResponse = await options?.responseCache?.get(url);
    const response = cachedResponse ?? (await fetch(url));

    if (cachedResponse == null && options?.responseCache != null) {
        options.responseCache.set(url, response.clone()); // Need to clone BrowserCache responses as it can only be used once
    }

    // Save buffer to cache
    var png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    if (options?.bufferCache != null) {
        await options.bufferCache.set(url, png);
    }

    return png;
}

type Pixel = { x: number; y: number; intensity: number };

function bilinearInterpolation({
    bl,
    tl,
    br,
    tr,
    x,
    y,
}: {
    bl: Pixel;
    tl: Pixel;
    br: Pixel;
    tr: Pixel;
    x: number;
    y: number;
}): number {
    const { x: x1, y: y1, intensity: I11 } = bl; // Bottom-left corner
    const { x: x1_b, y: y2, intensity: I12 } = tl; // Top-left corner
    const { x: x2, y: y1_b, intensity: I21 } = br; // Bottom-right corner
    const { x: x2_b, y: y2_b, intensity: I22 } = tr; // Top-right corner

    // Interpolate in the x-direction
    const I_x1 = (I11 * (x2 - x)) / (x2 - x1) + (I21 * (x - x1)) / (x2 - x1);
    const I_x2 = (I12 * (x2 - x)) / (x2 - x1) + (I22 * (x - x1)) / (x2 - x1);

    // Interpolate in the y-direction
    const I = (I_x1 * (y2 - y)) / (y2 - y1) + (I_x2 * (y - y1)) / (y2 - y1);

    return I;
}

async function topologyAtGeohash(
    geohash: string,
    options?: {
        responseCache?: CacheInterface;
        bufferCache?: CacheInterface;
    },
): Promise<{
    intensity: number;
    width: number; // of the image
    height: number;
    x: number; // pixel coordinate in the image
    y: number;
    png: PNGWithMetadata;
    url: string;
    tile: {
        origin: {
            // world coordinate of the top left corner of the tile
            col: number;
            row: number;
        };
        rows: number;
        cols: number;
    };
}> {
    const { rows, cols, url, row, col, tlCol, tlRow } = topologyTile(geohash);

    const png = await topologyBuffer(url, {
        responseCache: options?.responseCache,
        bufferCache: options?.bufferCache,
    });
    const { width, height, data } = png;

    const xRaw = (width - 1) * (col / (cols - 1)); // x, y is 0 indexed
    const yRaw = (height - 1) * (row / (rows - 1));
    const x = Math.floor(xRaw); // must use floor not round!!!
    const y = Math.floor(yRaw);

    let intensity = 0;

    // Tile dimensions are smaller than the png image dimensions (use average intensity)
    if (width > cols) {
        // It is too slow if we iterate over all the pixels, sample 16x16 grid
        const xPixels = Math.floor(width / cols);
        const yPixels = Math.floor(height / rows);
        let xStep = Math.max(Math.floor(xPixels / 16), 1);
        let yStep = Math.max(Math.floor(yPixels / 16), 1);
        const xStart = Math.floor((width * col) / cols);
        const yStart = Math.floor((height * row) / rows);
        let total = 0;
        for (let j = yStart; j < yStart + yPixels; j += yStep) {
            for (let i = xStart; i < xStart + xPixels; i += xStep) {
                intensity += data[(j * width + i) * 4];
                total += 1;
            }
        }
        intensity = intensity / total;
    }
    // Interpolate pixel value if tile dimensions are larger than the png image
    else {
        const xPixel = xRaw - Math.floor(xRaw);
        const yPixel = yRaw - Math.floor(yRaw);

        // Smooth out the intensity by averaging the surrounding pixels
        const index = y * width + x;
        const ym = Math.max(y - 1, 0);
        const yp = Math.min(y + 1, height - 1);
        const xm = Math.max(x - 1, 0);
        const xp = Math.min(x + 1, width - 1);
        const nwIdx = ym * width + xm;
        const nIdx = ym * width + x;
        const neIdx = ym * width + xp;
        const wIdx = y * width + xm;
        const eIdx = y * width + xp;
        const swIdx = yp * width + xm;
        const sIdx = yp * width + x;
        const seIdx = yp * width + xp;

        /*
        If we just take the pixel value at the 4 corners there will be high levels of symmetry
        resulting in straight edges because the values of the corners are either integers.
        For each of the corners, take the average value of its 9 neighbours.
        */
        const avgNeighbours = memoize((idx: number): number => {
            let total = 0;
            let cnt = 0;
            for (const i of [
                idx,
                idx - width, //n
                idx + width, // s
                idx - 1, // w
                idx + 1, // e
                idx - width + 1, // ne
                idx - width - 1, // nw
                idx + width + 1, // se
                idx + width - 1, // sw
            ]) {
                const intensity = data[i * 4]; // RGBA, need to skip 4 values
                if (intensity != null) {
                    total += intensity;
                    cnt += 1;
                }
            }
            return total / cnt;
        });

        if (xPixel < 0.5) {
            if (yPixel < 0.5) {
                // nw, n, w, current
                intensity = bilinearInterpolation({
                    tl: { x: -0.5, y: -0.5, intensity: avgNeighbours(nwIdx) }, // nw
                    tr: { x: 0.5, y: -0.5, intensity: avgNeighbours(nIdx) }, // n
                    bl: { x: -0.5, y: 0.5, intensity: avgNeighbours(wIdx) }, // w
                    br: { x: 0.5, y: 0.5, intensity: avgNeighbours(index) }, // current
                    x: xPixel,
                    y: yPixel,
                });
            } else {
                // w, current, sw, s
                intensity = bilinearInterpolation({
                    tl: { x: -0.5, y: 0.5, intensity: avgNeighbours(wIdx) }, // w
                    tr: { x: 0.5, y: 0.5, intensity: avgNeighbours(index) }, // current
                    bl: { x: -0.5, y: 1.5, intensity: avgNeighbours(swIdx) }, // sw
                    br: { x: 0.5, y: 1.5, intensity: avgNeighbours(sIdx) }, // s
                    x: xPixel,
                    y: yPixel,
                });
            }
        } else {
            if (yPixel < 0.5) {
                // n, ne, current, e
                intensity = bilinearInterpolation({
                    tl: { x: 0.5, y: -0.5, intensity: avgNeighbours(nIdx) }, // n
                    tr: { x: 1.5, y: -0.5, intensity: avgNeighbours(neIdx) }, // ne
                    bl: { x: 0.5, y: 0.5, intensity: avgNeighbours(index) }, // current
                    br: { x: 1.5, y: 0.5, intensity: avgNeighbours(eIdx) }, // e
                    x: xPixel,
                    y: yPixel,
                });
            } else {
                // current, e, s, se
                intensity = bilinearInterpolation({
                    tl: { x: 0.5, y: 0.5, intensity: avgNeighbours(index) }, // current
                    tr: { x: 1.5, y: 0.5, intensity: avgNeighbours(eIdx) }, // e
                    bl: { x: 0.5, y: 1.5, intensity: avgNeighbours(sIdx) }, // s
                    br: { x: 1.5, y: 1.5, intensity: avgNeighbours(seIdx) }, // se
                    x: xPixel,
                    y: yPixel,
                });
            }
        }
    }

    // TODO: Add perlion noise layers (use topological analysis)

    return {
        width,
        height,
        x,
        y,
        intensity,
        png,
        url,
        tile: {
            origin: {
                col: tlCol,
                row: tlRow,
            },
            rows,
            cols,
        },
    };
}

/**
 * Returns the elevation at the given geohash based on the topology.
 * The levels are from 0 - 255 (directly from the pixel value), not in meters
 *
 * @param geohash - The geohash coordinate string.
 * @returns The height at the given geohash.
 */
async function elevationAtGeohash(
    geohash: string,
    locationType: GeohashLocation,
    options?: {
        responseCache?: CacheInterface;
        resultsCache?: CacheInterface;
        bufferCache?: CacheInterface;
        landGrading?: LandGrading;
    },
): Promise<number> {
    // Check if land grading exists (overwrite calculation)
    const grading = options?.landGrading?.[locationType]?.[geohash];
    if (grading && grading.elevation != null) {
        return grading.elevation;
    }

    // Check cache (Note: land grading takes precedence over the cache)
    const cacheKey = `${locationType}-${geohash}`;
    const cached = await options?.resultsCache?.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Underground (d1, d2, d3, in ...)
    if (locationType !== "geohash") {
        return 0;
    }

    const elevation = Math.ceil(
        (
            await topologyAtGeohash(geohash, {
                responseCache: options?.responseCache,
                bufferCache: options?.bufferCache,
            })
        ).intensity,
    );

    if (options?.resultsCache) {
        options.resultsCache.set(cacheKey, elevation);
    }

    return elevation;
}

/**
 * Determines the biome name at the given geohash based on probabilities configured in the world seed.
 *
 * @param geohash - The geohash coordinate string
 * @param seed - Optional world seed to use. Defaults to globally set seed.
 * @returns The name of the biome and strength at that geohash.
 *
 * TODO: Replace with simplex noise etc..
 *
 * |----(bio)----|
 * |----(bio)----||----(water)----|
 * |---dice---|   // bio, strength is taken from mid point 1 - (dice - bio/2) / bio/2
 * |-----------dice-----------|   // water, 1 - ((dice - bio) - water/2) / water/2
 */
async function biomeAtGeohash(
    geohash: string,
    locationType: GeohashLocation,
    options?: {
        seed?: WorldSeed;
        topologyResultCache?: CacheInterface;
        topologyBufferCache?: CacheInterface;
        topologyResponseCache?: CacheInterface;
        biomeAtGeohashCache?: CacheInterface;
        biomeParametersAtCityCache?: CacheInterface;
        dungeonGraphCache?: CacheInterface;
        dungeonsAtTerritoryCache?: CacheInterface;
    },
): Promise<[BiomeType, number]> {
    // Get from cache
    const cacheKey = `${geohash}-${locationType}`;
    const cached = await options?.biomeAtGeohashCache?.get(cacheKey);
    if (cached) return cached;

    if (!geohashLocationTypes.has(locationType)) {
        throw new Error("Location is not a GeohashLocation");
    }

    const seed = options?.seed || worldSeed;
    let result: [BiomeType, number] = ["grassland", 1];

    // Underground / Dungeon
    if (locationType !== "geohash") {
        result = await dungeonBiomeAtGeohash(geohash, locationType, {
            dungeonGraphCache: options?.dungeonGraphCache,
            dungeonsAtTerritoryCache: options?.dungeonsAtTerritoryCache,
            topologyBufferCache: options?.topologyBufferCache,
            topologyResponseCache: options?.topologyResponseCache,
            topologyResultCache: options?.topologyResultCache,
        });
    }

    // Leave h9* for ice for testing (fully traversable)
    else if (geohash.startsWith("h9")) {
        result = [biomes.tundra.biome, 0]; // strength=0 no decorations
    } else {
        // Get elevation
        const elevation = await elevationAtGeohash(geohash, locationType, {
            responseCache: options?.topologyResponseCache,
            resultsCache: options?.topologyResultCache,
            bufferCache: options?.topologyBufferCache,
        });

        // Below sea level
        if (elevation < 1) {
            result = [biomes.aquatic.biome, 1];
        }
        // Biome parameters are determined at the `city` level similar to descriptions
        else {
            const city = geohash.slice(0, seed.spatial.city.precision);
            const biomeParameters = await biomeParametersAtCity(city, {
                seed,
                biomeParametersAtCityCache: options?.biomeParametersAtCityCache,
            });

            const biomeProbs = biomeTypes.map(
                (biome) => biomeParameters[biome] || 0,
            );
            const totalProb = biomeProbs.reduce((sum, prob) => sum + prob, 0);
            const rv = seededRandom(stringToRandomNumber(geohash)) * totalProb;

            let cumulativeProb = 0;
            for (let i = 0; i < biomeTypes.length; i++) {
                cumulativeProb += biomeProbs[i];
                if (rv < cumulativeProb) {
                    const biomeMid = cumulativeProb - biomeProbs[i] / 2;
                    const intensity =
                        1 - Math.abs(rv - biomeMid) / (biomeProbs[i] / 2);
                    result = [biomeTypes[i], intensity];
                    break;
                }
            }
        }
    }

    if (options?.biomeAtGeohashCache) {
        await options.biomeAtGeohashCache.set(cacheKey, result);
    }

    return result;
}

async function biomeParametersAtCity(
    city: string,
    options?: {
        seed?: WorldSeed;
        biomeParametersAtCityCache?: CacheInterface;
    },
): Promise<BiomeParameters> {
    // Get from cache
    const cachedResult = await options?.biomeParametersAtCityCache?.get(city);
    if (cachedResult) return cachedResult;

    const seed = options?.seed ?? worldSeed;
    const continent = city.charAt(0);
    const biomeParameters = cloneDeep(seed.seeds.continent[continent].biome); // don't change the original seed
    // Add noise/variation at the city level
    for (const [biome, prob] of Object.entries(biomeParameters)) {
        const rv = seededRandom(stringToRandomNumber(city + biome)) - 0.5;
        biomeParameters[biome as BiomeType] = Math.max(
            0.7 * prob + 0.3 * rv,
            0,
        );
    }
    // Re-normalize
    const totalNoise = Object.values(biomeParameters).reduce(
        (sum, value) => sum + value,
        0,
    );
    for (const [biome, prob] of Object.entries(biomeParameters)) {
        biomeParameters[biome as BiomeType] = prob / totalNoise;
    }

    // Set cache
    if (options?.biomeParametersAtCityCache) {
        await options?.biomeParametersAtCityCache.set(city, biomeParameters);
    }

    return biomeParameters;
}
