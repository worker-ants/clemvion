# 보안(Security) Review — ai-turn-executor.ts (M-7 relay 통일)

## 대상
`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `narrowResumeState()` 신규 private 헬퍼 도입 및 `buildAiNodeRefFromState` / `threadHolderFromState` 시그니처를 `Record<string, unknown>` → `ResumeState` 로 변경. 3개 호출 지점의 `state as ResumeState` 를 `this.narrowResumeState(state)` 로 대체.

## 발견사항

- **[INFO]** 컴파일 타임 전용 리팩터 — 런타임 동작 변경 없음
  - 위치: `ai-turn-executor.ts:713-715` (`narrowResumeState`), `:722-731`, `:734-738`
  - 상세: `narrowResumeState` 는 `state as ResumeState` 를 그대로 감싼 타입 단언(type assertion)이며 런타임 검증(zod parse/safeParse 등)을 수행하지 않는다. 주석에도 "컴파일 타임 캐스트만 — 런타임 no-op" 이라 명시되어 있고, 기존에도 동일하게 unchecked cast 였으므로 이번 변경으로 신규 공격 표면이 추가되지는 않는다. `state` 는 in-memory `_resumeState` (엔진이 관리하는 노드 실행 컨텍스트)로 외부 요청 바디가 직접 주입되는 경로가 아니다.
  - 제안: 현행 리팩터 범위에서는 조치 불필요. 다만 향후 `_resumeState` 가 DB 영속 후 역직렬화되는 경로(리마인드: 다른 커밋에서 `_retryState` 는 DB 영속됨)와 합류할 가능성이 있다면, 그 지점에서는 unchecked cast 대신 zod `safeParse` 등 런타임 검증을 두는 것이 바람직하다 — 단, 이는 본 diff 의 스코프 밖.

- **[INFO]** `rawConfig` / `conversationThreadRef` 등 필드는 여전히 `unknown` 도메인 캐스트로 남음 (의도적)
  - 위치: `ai-turn-executor.ts:729` (`state.rawConfig as Record<string, unknown> | undefined`), `:736` (`state.conversationThreadRef as ConversationThread | undefined`)
  - 상세: 주석대로 스키마상 `unknown` 필드에 대한 domain cast 는 의도적으로 유지된다. 이 값들은 사용자가 정의한 노드 config(`rawConfig`)와 워크플로 내부 스레드 참조(`conversationThreadRef`) 로, 외부 미검증 입력이 직접 이 캐스트를 거쳐 코드 실행/쿼리 등 위험한 sink 로 흘러가는 패턴은 diff 범위 내에서 확인되지 않았다. `buildAiNodeRefFromState` 의 `config` 필드는 이후 `NodeRef.config` 로만 사용되며(표시/추적 용도), 본 diff 상으로는 인젝션 경로가 보이지 않는다.
  - 제안: 조치 불필요. 참고용으로만 기록.

- **[INFO]** 에러 처리·시크릿·인증 관련 변경 없음
  - 위치: 전체 diff
  - 상세: `sanitizeToolError`, `previewContent` 등 기존 민감정보 마스킹 로직은 diff 대상 밖이며 변경되지 않았다. 하드코딩된 시크릿, 신규 인증/인가 로직, SQL/커맨드 실행, 암호화 관련 코드는 diff 에 존재하지 않는다.

## 요약
이번 변경은 `_resumeState` 를 `ResumeState` 타입으로 좁히는 단일 진입점(`narrowResumeState`)을 도입하고, 두 헬퍼 메서드의 파라미터 타입을 `Record<string, unknown>` 에서 `ResumeState` 로 바꾼 순수 컴파일타임 리팩터다. 기존에 흩어져 있던 동일한 `as ResumeState` unchecked cast 를 한곳으로 모은 것뿐이며 런타임 동작·검증 로직·데이터 흐름은 전혀 바뀌지 않는다. 새로운 인젝션 경로, 하드코딩 시크릿, 인증/인가 변경, 암호화/에러 노출 이슈는 발견되지 않았다. `state` 는 외부 요청이 직접 채우는 값이 아니라 엔진이 관리하는 in-memory 노드 실행 상태이므로 unchecked cast 자체의 보안 리스크도 이번 diff 로 인해 증가하지 않았다.

## 위험도
NONE

STATUS: OK — review/code/2026/07/02/17_10_13/security.md written, 0 CRITICAL, 0 WARNING
