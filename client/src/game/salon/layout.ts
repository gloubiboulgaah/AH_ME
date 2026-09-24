/** @format */

// une case de deplacement
export const TILE = 12;

// grille grossiere pour le sol et les murs, 2 voxels par case
export const MAP_VOXEL = TILE / 2;

export const ROOM_TILES_X = 13;
export const ROOM_TILES_Z = 11;

export const WALL_TILES_HIGH = 2;

export interface DeskSlot {
	index: number;
	// centre du bureau en unites monde
	x: number;
	z: number;
	// rotation en radians, le bureau regarde vers l'interieur
	rotation: number;
}

export interface Decoration {
	model: 'plant';
	x: number;
	z: number;
}

export interface SalonLayout {
	tilesX: number;
	tilesZ: number;
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	deskSlots: DeskSlot[];
	decorations: Decoration[];
}

function tileToWorld(tile: number, tiles: number): number {
	// centre de la case, la piece est centree sur l'origine
	return (tile - (tiles - 1) / 2) * TILE;
}

// open space : bureaux le long des murs nord et sud, circulation au milieu
function buildLayout(): SalonLayout {
	const deskSlots: DeskSlot[] = [];
	const decorations: Decoration[] = [];

	const northZ = tileToWorld(1, ROOM_TILES_Z);
	const southZ = tileToWorld(ROOM_TILES_Z - 2, ROOM_TILES_Z);

	// on saute les cases 0 et 12 pour laisser de l'espace dans les coins
	const columns = [2, 4, 6, 8, 10];

	columns.forEach((tileX) => {
		const x = tileToWorld(tileX, ROOM_TILES_X);

		deskSlots.push({
			index: deskSlots.length,
			x,
			z: northZ,
			rotation: 0,
		});
	});

	columns.forEach((tileX) => {
		const x = tileToWorld(tileX, ROOM_TILES_X);

		deskSlots.push({
			index: deskSlots.length,
			x,
			z: southZ,
			rotation: Math.PI,
		});
	});

	// plantes dans les coins
	[
		[0, 0],
		[ROOM_TILES_X - 1, 0],
		[0, ROOM_TILES_Z - 1],
		[ROOM_TILES_X - 1, ROOM_TILES_Z - 1],
	].forEach(([tileX, tileZ]) => {
		decorations.push({
			model: 'plant',
			x: tileToWorld(tileX, ROOM_TILES_X),
			z: tileToWorld(tileZ, ROOM_TILES_Z),
		});
	});

	const halfX = (ROOM_TILES_X * TILE) / 2;
	const halfZ = (ROOM_TILES_Z * TILE) / 2;

	return {
		tilesX: ROOM_TILES_X,
		tilesZ: ROOM_TILES_Z,
		minX: -halfX,
		maxX: halfX,
		minZ: -halfZ,
		maxZ: halfZ,
		deskSlots,
		decorations,
	};
}

export const SALON_LAYOUT = buildLayout();

// les bureaux et les plantes bloquent leur case, les murs bornent la piece
const BLOCKED_RADIUS = TILE * 0.6;

export function isWalkable(x: number, z: number): boolean {
	const margin = TILE * 0.5;

	if (
		x < SALON_LAYOUT.minX + margin ||
		x > SALON_LAYOUT.maxX - margin ||
		z < SALON_LAYOUT.minZ + margin ||
		z > SALON_LAYOUT.maxZ - margin
	) {
		return false;
	}

	const obstacles = [
		...SALON_LAYOUT.deskSlots.map((slot) => ({ x: slot.x, z: slot.z })),
		...SALON_LAYOUT.decorations.map((item) => ({ x: item.x, z: item.z })),
	];

	return !obstacles.some(
		(obstacle) =>
			Math.abs(obstacle.x - x) < BLOCKED_RADIUS &&
			Math.abs(obstacle.z - z) < BLOCKED_RADIUS
	);
}

// case de depart libre, au centre de la piece
export function spawnPoint(): { x: number; z: number } {
	return { x: 0, z: 0 };
}
