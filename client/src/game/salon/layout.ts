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

export type DecorationModel =
	'plant' | 'bookshelf' | 'coffee' | 'cooler' | 'armchair' | 'lamp' | 'rug';

export interface Decoration {
	model: DecorationModel;
	x: number;
	z: number;
	// rotation en radians, le modele regarde vers +z a 0
	rotation: number;
	// un tapis se traverse, le reste bloque sa case
	blocking: boolean;
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

	const decorate = (
		model: DecorationModel,
		tileX: number,
		tileZ: number,
		options: Partial<Pick<Decoration, 'rotation' | 'blocking'>> & {
			// decalage en unites monde, pour coller un meuble au mur
			dx?: number;
			dz?: number;
		} = {}
	) => {
		decorations.push({
			model,
			x: tileToWorld(tileX, ROOM_TILES_X) + (options.dx ?? 0),
			z: tileToWorld(tileZ, ROOM_TILES_Z) + (options.dz ?? 0),
			rotation: options.rotation ?? 0,
			blocking: options.blocking ?? true,
		});
	};

	// les cases du bord sont a moitie dans le mur, on rentre un peu les
	// meubles pour qu'ils ne le traversent pas
	const INSET = 4;
	const lastX = ROOM_TILES_X - 1;
	const lastZ = ROOM_TILES_Z - 1;

	// plantes dans les coins
	decorate('plant', 0, 0, { dx: INSET, dz: INSET });
	decorate('plant', lastX, 0, { dx: -INSET, dz: INSET });
	decorate('plant', 0, lastZ, { dx: INSET, dz: -INSET });
	decorate('plant', lastX, lastZ, { dx: -INSET, dz: -INSET });

	// mur ouest : bibliotheques et lampadaire
	decorate('bookshelf', 0, 4, { dx: 3, rotation: Math.PI / 2 });
	decorate('lamp', 0, 5, { dx: INSET });
	decorate('bookshelf', 0, 6, { dx: 3, rotation: Math.PI / 2 });

	// mur est : coin cafe
	decorate('coffee', lastX, 4, { dx: -INSET, rotation: -Math.PI / 2 });
	decorate('cooler', lastX, 6, { dx: -INSET, rotation: -Math.PI / 2 });

	// coin detente au centre, le tapis passe sous le point d'apparition
	decorate('rug', 6, 5, { blocking: false });
	decorate('armchair', 3, 5, { rotation: Math.PI / 2 });
	decorate('armchair', 9, 5, { rotation: -Math.PI / 2 });

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

// les bureaux et le mobilier bloquent leur case, les murs bornent la piece
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
		...SALON_LAYOUT.decorations
			.filter((item) => item.blocking)
			.map((item) => ({ x: item.x, z: item.z })),
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
