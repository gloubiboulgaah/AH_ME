/** @format */

import * as THREE from 'three';
import { buildGeometry } from '../voxel/mesher';
import { voxelMaterial } from '../voxel/registry';
import {
	buildPaperStackModel,
	buildStickyNoteModel,
} from '../voxel/models/furniture';
import { TILE } from './layout';

// hauteur du plateau du bureau bouchon
const DESK_TOP_Y = 9;

const NOTE_COLORS = ['#ffe066', '#ff9f9f', '#9fd8ff', '#c0f0a8'];

export interface DeskOccupant {
	userId: number | null;
	username: string;
}

export interface DeskContent {
	files: number;
	notes: number;
}

export interface DeskInfo {
	slotIndex: number;
	occupant: DeskOccupant | null;
	content: DeskContent;
	position: THREE.Vector3;
	distance: number;
}

interface DeskState {
	slotIndex: number;
	anchor: THREE.Object3D;
	occupant: DeskOccupant | null;
	content: DeskContent;
	label: THREE.Sprite | null;
	stack: THREE.Mesh | null;
	notes: THREE.Group;
	highlight: THREE.Mesh;
}

function makeLabel(text: string): THREE.Sprite {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 64;

	const context = canvas.getContext('2d');

	if (context) {
		context.fillStyle = 'rgba(0, 0, 0, 0.65)';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.font = 'bold 26px Arial';
		context.fillStyle = '#ffffff';
		context.textAlign = 'center';
		context.fillText(text, 128, 42);
	}

	const texture = new THREE.CanvasTexture(canvas);
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({ map: texture, depthTest: false })
	);

	sprite.scale.set(22, 5.5, 1);
	sprite.position.set(0, DESK_TOP_Y + 12, 0);

	return sprite;
}

export class DeskManager {
	private desks: DeskState[] = [];
	private stackGeometries = new Map<number, THREE.BufferGeometry>();
	private highlighted: number | null = null;

	constructor(anchors: THREE.Object3D[]) {
		anchors.forEach((anchor, slotIndex) => {
			const notes = new THREE.Group();
			notes.position.set(0, DESK_TOP_Y, 0);
			anchor.add(notes);

			const highlight = new THREE.Mesh(
				new THREE.PlaneGeometry(TILE * 1.4, TILE * 1.1),
				new THREE.MeshBasicMaterial({
					color: 0xffdd55,
					transparent: true,
					opacity: 0.35,
					side: THREE.DoubleSide,
				})
			);

			highlight.rotation.x = -Math.PI / 2;
			highlight.position.y = 0.2;
			highlight.visible = false;
			anchor.add(highlight);

			this.desks.push({
				slotIndex,
				anchor,
				occupant: null,
				content: { files: 0, notes: 0 },
				label: null,
				stack: null,
				notes,
				highlight,
			});
		});
	}

	get count() {
		return this.desks.length;
	}

	occupiedCount() {
		return this.desks.filter((desk) => desk.occupant).length;
	}

	setOccupant(slotIndex: number, occupant: DeskOccupant) {
		const desk = this.desks[slotIndex];
		if (!desk) return;

		desk.occupant = occupant;

		if (desk.label) {
			desk.anchor.remove(desk.label);
			desk.label.material.map?.dispose();
			desk.label.material.dispose();
		}

		desk.label = makeLabel(occupant.username);
		desk.anchor.add(desk.label);
	}

	clearOccupant(slotIndex: number) {
		const desk = this.desks[slotIndex];
		if (!desk) return;

		desk.occupant = null;

		if (desk.label) {
			desk.anchor.remove(desk.label);
			desk.label.material.map?.dispose();
			desk.label.material.dispose();
			desk.label = null;
		}

		this.setContent(slotIndex, { files: 0, notes: 0 });
	}

	// un bureau charge se voit de loin, sans avoir a l'ouvrir
	setContent(slotIndex: number, content: DeskContent) {
		const desk = this.desks[slotIndex];
		if (!desk) return;

		desk.content = content;
		this.refreshStack(desk);
		this.refreshNotes(desk);
	}

	private refreshStack(desk: DeskState) {
		if (desk.stack) {
			desk.anchor.remove(desk.stack);
			desk.stack = null;
		}

		if (desk.content.files <= 0) return;

		const sheets = Math.max(1, Math.min(desk.content.files, 10));
		let geometry = this.stackGeometries.get(sheets);

		if (!geometry) {
			geometry = buildGeometry(buildPaperStackModel(sheets));
			this.stackGeometries.set(sheets, geometry);
		}

		const stack = new THREE.Mesh(geometry, voxelMaterial());
		stack.position.set(4, DESK_TOP_Y, 0);
		desk.anchor.add(stack);
		desk.stack = stack;
	}

	private refreshNotes(desk: DeskState) {
		desk.notes.clear();

		// on plafonne pour garder le plateau lisible
		const total = Math.max(0, Math.min(desk.content.notes, 6));

		for (let i = 0; i < total; i += 1) {
			const color = NOTE_COLORS[i % NOTE_COLORS.length];
			const geometry = buildGeometry(buildStickyNoteModel(color));
			const note = new THREE.Mesh(geometry, voxelMaterial());

			note.position.set(-6 + (i % 3) * 5, 0, -2 + Math.floor(i / 3) * 5);
			note.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.2;

			desk.notes.add(note);
		}
	}

	// bureau le plus proche dans le rayon donne
	nearest(position: THREE.Vector3, radius: number): DeskInfo | null {
		let best: DeskInfo | null = null;

		this.desks.forEach((desk) => {
			const deskPosition = new THREE.Vector3();
			desk.anchor.getWorldPosition(deskPosition);

			const distance = Math.hypot(
				deskPosition.x - position.x,
				deskPosition.z - position.z
			);

			if (distance > radius) return;
			if (best && best.distance <= distance) return;

			best = {
				slotIndex: desk.slotIndex,
				occupant: desk.occupant,
				content: desk.content,
				position: deskPosition,
				distance,
			};
		});

		return best;
	}

	highlight(slotIndex: number | null) {
		if (this.highlighted === slotIndex) return;

		if (this.highlighted !== null) {
			const previous = this.desks[this.highlighted];
			if (previous) previous.highlight.visible = false;
		}

		this.highlighted = slotIndex;

		if (slotIndex !== null) {
			const desk = this.desks[slotIndex];
			if (desk) desk.highlight.visible = true;
		}
	}

	dispose() {
		this.desks.forEach((desk) => {
			if (desk.label) {
				desk.label.material.map?.dispose();
				desk.label.material.dispose();
			}

			desk.notes.children.forEach((child) => {
				const mesh = child as THREE.Mesh;
				mesh.geometry.dispose();
			});

			desk.highlight.geometry.dispose();
			(desk.highlight.material as THREE.Material).dispose();
		});

		this.stackGeometries.forEach((geometry) => geometry.dispose());
		this.stackGeometries.clear();
		this.desks = [];
	}
}
