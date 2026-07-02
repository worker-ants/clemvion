# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 신규 `resume-state.schema.ts` 가 3종 상태(`ResumeState`/`ResumeCheckpoint`/`RetryState`)에 대한 단일 형태 SoT 로 잘 분리됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`
  - 상세: 이전에 엔진 전반에 흩어져 있던 `as Record<string, unknown>` / `as Record & {...}` 구조 단언을 하나의 스키마 모듈로 응집시켰다. 도메인 개념(재개 상태의 3단계 라이프사이클 — in-memory superset / DB checkpoint / DB+TTL retry state)이 코드 레벨 타입으로 명시되어 응집도가 높아졌고, JSDoc 이 "왜 런타임 parse 를 하지 않는가"까지 근거를 남겨 향후 오용(실수로 parse 삽입)을 방지하는 설계 의도가 명확하다. utils 계층에 위치해 기존 모듈 경계(도메인 서비스 vs 유틸)와도 정합.
  - 제안: 없음 (긍정적 발견으로 기록).

- **[INFO]** 타입 강화가 함수 "입구"에만 국지적으로 적용되고 relay 시그니처는 여전히 `Record<string, unknown>`
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (`processAiResumeTurn`/`handleAiMessageTurn`/`handleAiTurnError`/`finalizeAiNode` 등), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 상세: `nodeOutput._resumeState as ResumeState`, `outputData._retryState as RetryState` 등 값을 꺼내는 지점에서만 신규 타입을 사용하고, 이를 전달받는 내부 relay 함수들의 파라미터/리턴 타입은 그대로 `Record<string, unknown>` 이다. 타입 안전성이 함수 경계를 넘어 전파되지 않아 SoT 도입 효과가 제한적이다. 다만 이는 이번 클러스터(M-7 첫 클러스터)의 의도된 범위 제한이며, RESOLUTION.md 에도 후속 클러스터로 defer 하기로 명시되어 있다.
  - 제안: 후속 클러스터에서 relay 시그니처도 `ResumeState`/`RetryState` 로 통일 — 이미 계획에 반영됨, 추가 조치 불필요.

- **[INFO]** `credentialStripSubsetShape` 15개 필드가 스키마 파일과 별도의 빌더 구현(`buildResumeCheckpoint`/`buildRetryReentryState`) 두 곳에 물리적으로 분리되어 있음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (빌더 파일은 diff 범위 밖)
  - 상세: 스키마가 필드 목록의 "형태"를 선언하지만, 실제 값을 구성하는 빌더 로직은 별도 파일에 있어 두 곳의 손 동기화가 필요한 구조다(개방-폐쇄 원칙 관점에서 필드 추가 시 두 곳을 동시에 수정해야 함). 다만 이번 클러스터에서 추가된 `.strict()` 기반 drift-guard 단위 테스트(`resume-state.schema.spec.ts`, `execution-engine.service.spec.ts`)가 이 리스크를 실행 가능한 형태로 상당 부분 완화한다 — 이는 "테스트로 아키텍처적 결합을 보완"하는 실용적 절충으로 평가된다.
  - 제안: 필드 수가 더 늘어나면 빌더가 `Object.keys(credentialStripSubsetShape)` 를 역참조하는 방향도 고려 가능하나, 현 시점에는 과설계이므로 별도 조치 불필요.

- **[INFO]** 스키마가 런타임 경계에서 `parse`/`safeParse` 되지 않고 타입 도출 + 테스트 오라클 전용으로만 쓰임 — 계층 책임 분리 관점에서 의도적 설계
  - 위치: `resume-state.schema.ts` 상단 docstring
  - 상세: 일반적으로 zod 스키마는 "검증 계층"의 책임을 지지만, 여기서는 §7.5 rehydration 의 graceful-reset semantics(부재/부분/미래-버전 checkpoint 를 거부하지 않고 기본값으로 복원)를 깨지 않기 위해 의도적으로 검증 계층 책임을 배제했다. 이는 아키텍처적으로 드문 선택이지만 문서화가 충실해(behavior-preserving 명시) 향후 리뷰어나 유지보수자가 "왜 zod인데 안 쓰는가"를 오인하지 않도록 방어되어 있다.
  - 제안: 현행 유지. 스키마의 "타입 SoT" 역할과 "검증 계층" 역할이 섞이지 않도록 이 경계가 앞으로도 지켜지는지(다른 개발자가 무심코 `.parse()` 를 끼워 넣지 않는지) 후속 PR 리뷰에서 지속 확인 권장.

- **[INFO]** `isRecord` 타입 가드 추출로 `handler-output.adapter.ts` 의 반복 로직이 `to-record.ts` 유틸로 위임됨
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`, `codebase/backend/src/modules/execution-engine/utils/to-record.ts`
  - 상세: 기존 인라인 3중 조건(`!== null && typeof === 'object' && !Array.isArray`)이 `isRecord()` 단일 함수 호출로 대체되어 응집도가 개선되고 중복이 제거됐다. `to-record.ts` 는 단일 책임(런타임 형태 가드)에 충실한 순수 유틸이며 다른 모듈에 대한 의존이 없어 순환 참조 위험이 없다.
  - 제안: 없음.

- **[INFO]** 모듈 경계와 의존 방향은 기존 구조를 그대로 따름 — 순환 의존성 신규 유입 없음
  - 위치: 전체 diff (`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`, `retry-turn.service.ts`, `handler-output.adapter.ts` → `utils/resume-state.schema.ts`, `utils/to-record.ts`)
  - 상세: 신규 `utils/resume-state.schema.ts` 는 zod 외 외부 의존이 없는 리프(leaf) 모듈이며, 상위 서비스들이 `import type`(런타임 footprint 0) 또는 값 import(`resumeCheckpointSchema` 등, 테스트 전용)로 단방향 의존한다. 기존 `execution-engine` 모듈 내부 계층 구조(서비스 → utils)를 위반하지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 refactor-03 M-7 클러스터의 첫 단계로, `execution-engine` 전반에 흩어져 있던 구조적 타입 단언(`as Record<string, unknown>` 계열)을 zod 기반의 단일 SoT 스키마(`ResumeState`/`ResumeCheckpoint`/`RetryState`)로 치환하는 순수 리팩토링이다. 아키텍처 관점에서는 도메인 개념의 명시화(재개 상태의 3단계 라이프사이클 구분)로 응집도가 개선되었고, 신규 모듈은 단일 책임과 리프 의존 구조를 유지해 순환 의존성이나 레이어 위반이 없다. 다만 타입 강화가 함수 경계를 완전히 넘지 못한 점과 스키마-빌더 간 물리적 분리는 이번 클러스터의 의도된 범위 제한이며 이미 drift-guard 테스트와 후속 클러스터 계획으로 완화·추적되고 있어 구조적 리스크로 보지 않는다. 전반적으로 behavior-preserving 원칙을 지키면서 아키텍처 품질을 점진적으로 개선하는 건전한 리팩토링이다.

## 위험도
NONE
