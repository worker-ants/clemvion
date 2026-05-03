import type { EntityType } from "@/lib/api/knowledge-bases";

/**
 * Entity type → 노드/legend 색상. graph-visualization (legend) 와
 * graph-3d-renderer (three.js material) 가 동일 매핑을 공유한다.
 * HSL CSS 변수는 three material 에서 동작 안 하므로 hex 고정.
 */
export const TYPE_COLOR: Record<EntityType, string> = {
  person: "#3b82f6",
  organization: "#a855f7",
  concept: "#f97316",
  location: "#22c55e",
  event: "#ef4444",
  other: "#6b7280",
};

/** 3D 캔버스 배경. 다크톤으로 노드/라벨 가독성 확보. */
export const GRAPH_BG_COLOR = "#0b0d12";

/** 3D 그래프 뷰포트 높이 — 디자인 결정 (UX 일관성). */
export const VIEWPORT_HEIGHT = 600;

/** force-directed 베이스 노드 반지름 단위 (mentionCount √ 비례 배율 기준). */
export const NODE_BASE_SIZE = 5;

/** 노드 라벨 sprite 의 베이스 Y 오프셋 — 노드 반지름 위에 살짝 띄움. */
export const LABEL_BASE_OFFSET = 6;

/** 카메라 줌 transition (노드 클릭 시 이동) ms. */
export const CAMERA_TRANSITION_MS = 1000;

/** 노드 클릭 시 카메라가 노드로부터 떨어질 거리 (force-graph 좌표계 단위). */
export const CAMERA_FOCUS_DISTANCE = 60;

/** zoomToFit 호출 시 fit padding (px). */
export const ZOOM_TO_FIT_PADDING = 60;

/** zoomToFit transition ms. */
export const ZOOM_TO_FIT_DURATION_MS = 400;
