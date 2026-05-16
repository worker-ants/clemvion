# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: `backend/package.json`, `frontend/package.json`
  - 상세: 이번 변경 세트(13개 파일)에서 `package.json`에 대한 수정이 전혀 없다. 변경은 순수하게 기존 내부 인터페이스에 선택적(optional) 필드 `source?: 'live' | 'injected'`를 추가하고, 기존 모듈 내 로직을 수정하는 데에만 한정된다.
  - 제안: 현상 유지. 외부 의존성 변동이 없으므로 조치 불필요.

- **[INFO]** 내부 모듈 간 의존 관계 — 신규 필드의 흐름
  - 위치: `backend/src/modules/llm/interfaces/llm-client.interface.ts` → `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` → `backend/src/modules/execution-engine/execution-engine.service.ts` → `frontend/src/lib/websocket/use-execution-events.ts` → `frontend/src/lib/conversation/conversation-utils.ts` → `frontend/src/lib/stores/execution-store.ts`
  - 상세: `ChatMessage.source` 필드가 백엔드 인터페이스에서 정의되고, handler가 마킹(`injected`), `LlmService`가 provider 호출 직전 strip, emit 경로의 `withSourceMarker`가 `live` backfill, 프론트엔드가 소비하는 단방향 흐름이다. 각 계층의 역할이 명확히 분리되어 있으며 순환 의존이 발생하지 않는다.
  - 제안: 현상 유지. 의존 방향이 적절하다.

- **[INFO]** 기존 의존성으로 완전히 구현됨 — 불필요한 의존성 도입 없음
  - 위치: 전체 diff
  - 상세: `source` 필드는 TypeScript의 union literal type(`'live' | 'injected'`)으로 표현되었고, 별도 enum 라이브러리나 런타임 검증 라이브러리(`zod`, `io-ts` 등) 없이 언어 자체 기능만 사용한다. `LlmService`의 strip 로직도 구조 분해 할당(`{ source, ...rest }`)으로 표준 JS 문법만 활용한다.
  - 제안: 현상 유지.

- **[INFO]** `void source` 패턴 사용
  - 위치: `backend/src/modules/llm/llm.service.ts` 변경 내 `void source;`
  - 상세: 구조 분해 할당 후 `source` 변수를 명시적으로 무시하기 위해 `void source;`를 사용한다. 이는 외부 라이브러리 없이 TypeScript/ESLint의 `no-unused-vars` 경고를 억제하는 관용적 패턴이다. 의존성 관점에서는 문제없다.
  - 제안: 현상 유지. `_source`처럼 언더스코어 prefix로 대체할 수 있으나 동등한 대안이며 필수 변경은 아니다.

## 요약

이번 변경(13개 파일)은 새로운 외부 패키지를 전혀 추가하지 않는다. `package.json`에 대한 수정이 없으며, 도입된 `source?: 'live' | 'injected'` 필드는 기존 `ChatMessage` 인터페이스에 선택적 필드를 추가하는 것으로, TypeScript 언어 자체 기능만으로 구현된다. 내부 모듈 간 의존 관계는 `interface → handler → service → (strip) → provider` 방향으로 단방향이며 순환이 없다. 프론트엔드 역시 기존 `@/lib/stores/execution-store`, `@/lib/conversation/conversation-utils` 등 내부 모듈만 확장하는 방식으로 변경이 이루어졌다. 버전 고정, 라이선스, 취약점, 번들 크기, 호환성 측면에서 모두 영향이 없다.

## 위험도

NONE
