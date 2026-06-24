/**
 * 공유 Trigger 도메인 타입.
 *
 * 트리거 목록 화면·상세 드로어·웹채팅 콘솔이 각자 로컬 인터페이스로 중복 정의하던
 * 트리거 응답 shape(특히 `config.interaction`)을 단일 출처로 모은다. 서버 응답
 * (`GET /api/triggers` items / backend TriggerDto)을 그대로 반영한다.
 */

export type TriggerType = "webhook" | "schedule" | "manual";

/** interaction 토큰 발급 전략 (backend InteractionConfigDto 와 정합). */
export type InteractionTokenStrategy = "per_execution" | "per_trigger";

/**
 * 웹채팅 운영 콘솔이 서버(`config.interaction.appearance`)에 저장하는 외형/콘텐츠.
 * 모든 필드 optional — 미저장 인스턴스도 수용한다. 콘솔 폼 상태(WebChatDraft)와 동일 키.
 */
export interface WebChatAppearanceConfig {
  locale?: "ko" | "en";
  primaryColor?: string;
  position?: "bottom-right" | "bottom-left";
  headerTitle?: string;
  welcomeText?: string;
  /** 줄바꿈으로 구분된 추천 질문(콘솔 textarea 원문). */
  suggestions?: string;
  disclaimer?: string;
}

/** 트리거 inbound interaction(REST+SSE) 설정 — `config.interaction`. */
export interface TriggerInteractionConfig {
  enabled?: boolean;
  tokenStrategy?: InteractionTokenStrategy;
  /** 웹채팅 콘솔 외형 설정(서버 영속화). */
  appearance?: WebChatAppearanceConfig;
}

/** 트리거 `config` JSONB — interaction 외 키는 화면별로 별도 typing. */
export interface TriggerConfig {
  interaction?: TriggerInteractionConfig;
  [key: string]: unknown;
}

/** `GET /api/triggers` 목록 행 공통 shape. */
export interface TriggerListItem {
  id: string;
  name: string;
  type: TriggerType;
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  /** 마지막 호출 시각(ISO 8601, UTC). 백엔드 `GET /api/triggers` 응답 포함(trigger-response.dto). 호출 이력 없으면 undefined. */
  lastTriggeredAt?: string;
  config?: TriggerConfig;
}
