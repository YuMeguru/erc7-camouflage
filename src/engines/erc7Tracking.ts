import type { PersonInfo } from '../store/useGameStore';
import { POSE, landmarkBbox, type Landmark, type PoseResult } from '../types/mp';
import { adaptiveMargin, expandHull, landmarkBodyHull } from '../types/mpMask';
import type { Bbox } from '../utils/geometry';
import { bboxIoU, expandBbox } from '../utils/geometry';
import type { HandAssignmentCandidate } from './handAssignment';
import type { TrackedPerson } from './PersonTracker';

interface Snapshot {
  personId: number;
  bbox: Bbox;
  hull: { x: number; y: number }[];
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
  depth: number;
  /** 手腕像素坐标（用于手部指派） */
  wristPoint?: { x: number; y: number };
  /** 手肘像素坐标（用于手部指派） */
  elbowPoint?: { x: number; y: number };
}

export interface InvisibleSubjects {
  anyInvisible: boolean;
  erc7Intensity: number;
  invisibleBboxes: Bbox[];
  invisibleHulls: { x: number; y: number }[][];
}

export function depthToIntensity(worldLandmarks: { x: number; y: number; z: number }[]): number {
  if (!worldLandmarks || worldLandmarks.length === 0) return 0.5;
  const depth = avgDepth(worldLandmarks);
  return Math.min(1, Math.max(0.2, (depth - 0.2) / 0.6));
}

export function avgDepth(worldLandmarks: { x: number; y: number; z: number }[] | undefined): number {
  if (!worldLandmarks || worldLandmarks.length === 0) return 0.5;
  let sum = 0;
  let count = 0;
  for (const landmark of worldLandmarks) {
    if (!Number.isFinite(landmark.z)) continue;
    sum += landmark.z;
    count++;
  }
  return count === 0 ? 0.5 : sum / count;
}

/**
 * 把 pose 的 landmarks 中的某个关键点转成像素坐标
 */
function landmarkPoint(landmarks: Landmark[], idx: number, width: number, height: number): { x: number; y: number } | undefined {
  const lm = landmarks[idx];
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return undefined;
  return { x: lm.x * width, y: lm.y * height };
}

export function matchPoseSnapshots(
  pose: PoseResult | null,
  tracked: TrackedPerson[],
  width: number,
  height: number,
): Snapshot[] {
  if (!pose) return [];
  const snapshots: Snapshot[] = [];

  for (let index = 0; index < pose.landmarks.length; index++) {
    const landmarks = pose.landmarks[index];
    const bbox = landmarkBbox(landmarks, width, height);
    if (!bbox) continue;
    const match = findTrackedPerson(tracked, bbox);
    if (!match) continue;
    const worldLandmarks = pose.worldLandmarks?.[index];
    snapshots.push({
      personId: match.id,
      bbox,
      hull: landmarkBodyHull(landmarks, width, height) ?? [],
      landmarks,
      worldLandmarks,
      depth: avgDepth(worldLandmarks),
      wristPoint: landmarkPoint(landmarks, POSE.LEFT_WRIST, width, height) ?? landmarkPoint(landmarks, POSE.RIGHT_WRIST, width, height),
      elbowPoint: landmarkPoint(landmarks, POSE.LEFT_ELBOW, width, height) ?? landmarkPoint(landmarks, POSE.RIGHT_ELBOW, width, height),
    });
  }

  return snapshots;
}

export function buildHandAssignmentCandidates(
  tracked: TrackedPerson[],
  snapshots: Snapshot[],
): HandAssignmentCandidate[] {
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.personId, snapshot] as const));
  return tracked.map((person) => {
    const snapshot = snapshotMap.get(person.id);
    return {
      id: person.id,
      bbox: snapshot?.bbox ?? person.bbox,
      hull: snapshot?.hull ?? [],
      wristPoint: snapshot?.wristPoint,
      elbowPoint: snapshot?.elbowPoint,
    };
  });
}

export function collectInvisibleSubjects(
  persons: Map<number, PersonInfo>,
  tracked: TrackedPerson[],
  snapshots: Snapshot[],
  width: number,
  height: number,
): InvisibleSubjects {
  const trackedMap = new Map(tracked.map((person) => [person.id, person] as const));
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.personId, snapshot] as const));
  let anyInvisible = false;
  let erc7Intensity = 0.5;
  const invisibleBboxes: Bbox[] = [];
  const invisibleHulls: { x: number; y: number }[][] = [];

  for (const [personId, info] of persons) {
    if (info.state !== 'INVISIBLE') continue;
    const trackedPerson = trackedMap.get(personId);
    if (!trackedPerson) continue;

    const snapshot = snapshotMap.get(personId);
    const depth = snapshot?.depth ?? 0.5;
    const margin = adaptiveMargin(snapshot?.bbox ?? trackedPerson.bbox, depth, width, height);
    invisibleBboxes.push(expandBbox(snapshot?.bbox ?? trackedPerson.bbox, margin));
    invisibleHulls.push(snapshot?.hull?.length ? expandHull(snapshot.hull, margin) : []);
    anyInvisible = true;
    erc7Intensity = Math.max(erc7Intensity, snapshot?.worldLandmarks ? depthToIntensity(snapshot.worldLandmarks) : 0.5);
  }

  return {
    anyInvisible,
    erc7Intensity,
    invisibleBboxes,
    invisibleHulls,
  };
}

export function summarizeDebugPersons(
  persons: Map<number, PersonInfo>,
  snapshots: Snapshot[],
): { id: number; state: string; depth?: number }[] {
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.personId, snapshot] as const));
  return Array.from(persons.values()).map((person) => ({
    id: person.id,
    state: person.state,
    depth: snapshotMap.get(person.id)?.depth,
  }));
}

function findTrackedPerson(tracked: TrackedPerson[], bbox: Bbox): TrackedPerson | null {
  let best: TrackedPerson | null = null;
  let bestScore = -Infinity;
  const bboxCenter = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
  for (const person of tracked) {
    const personCenter = {
      x: person.bbox.x + person.bbox.w / 2,
      y: person.bbox.y + person.bbox.h / 2,
    };
    const overlap = bboxIoU(person.bbox, bbox);
    const distance = Math.hypot(bboxCenter.x - personCenter.x, bboxCenter.y - personCenter.y);
    const distanceScore = 1 - distance / Math.max(1, Math.max(person.bbox.w, person.bbox.h) * 2);
    const score = overlap * 3 + distanceScore;
    if (score > bestScore) {
      best = person;
      bestScore = score;
    }
  }
  return best;
}
