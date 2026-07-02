# 요구사항(Requirement) 리뷰 결과

## 개요

refactor-03 M-7 "첫 클러스터" — `execution-engine` 내 inline 타입 단언(`as Record<string, unknown>` 등)을
`utils/resume-state.schema.ts` (zod 기반 `ResumeState`/`ResumeCheckpoint`/`RetryState` 타입) 로 대체하는
behavior-preserving 리팩터. 대상: `ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`,
`handler-output.adapter.ts`(`isRecord` 재사용), `retry-turn.service.ts`, 신규
`utils/resume-state.schema.ts` + `resume-state.schema.spec.ts`, 그리고 `execution-engine.service.spec.ts`
의 builder↔schema drift 가드 추가.

plan 상 명시(`plan/in-progress/refactor/03-maintainability.md` M-7): "**behavior-preserving** —
스키마는 런타임 경계에서 parse/safeParse 하지 않는다"는 설계 의도가 코드 주석·구현과 정확히 일치.

## 발견사항

- **[INFO]** 스키마는 문서화 목적 전용이며 런타임 검증 미수행 — 의도된 설계
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:3008-3021`
  - 상세: `resumeCheckpointSchema`/`resumeStateSchema`/`retryStateSchema` 는 `adaptHandlerReturn`,
    `buildResumeCheckpoint`, `buildRetryReentryState` 등 실제 경계에서 `.parse()`/`.safeParse()` 로
    호출되지 않는다. 오직 (a) `z.infer` 타입 제공, (b) 단위테스트의 drift-guard oracle 로만 쓰인다.
    JSDoc 이 이를 명시적으로 정당화("§7.5 rehydration 의 graceful-reset semantics 를 zod 강제 검증이
    깨뜨림")하고 있어 의도와 구현이 일치한다. 별도 조치 불요 — 회색지대이나 문서화가 충분해 리스크
    낮음.
  - 제안: 없음 (설계 의도 확인됨). 실제로 `execution-engine.service.spec.ts` 에 추가된
    `resumeCheckpointSchema.safeParse(checkpoint).success` 단언 2건이 `npx jest -t "W5: information_extractor"`
    로 검증했을 때 실 `buildResumeCheckpoint` 산출물과 스키마가 정합함을 확인(PASS).

- **[INFO]** `resumeCheckpointSchema` 는 non-partial(필수 필드) 인데 `buildResumeCheckpoint` 는 `??` 로
  항상 기본값을 채우므로 실무상 항상 통과 — 다만 스키마 자체만 보면 향후 builder 변경 시 필드 누락을
  drift 로 잡아낼 수 있는 정확한 강도(closed object)로 설계됨
  - 위치: `utils/resume-state.schema.ts:3067-3071` (`resumeCheckpointSchema`) vs
    `execution-engine.service.ts:4144-4168` (`buildResumeCheckpoint`)
  - 상세: `pendingFormToolCall` 만 `.optional()`, 나머지 15개 필드는 필수. `buildResumeCheckpoint` 가
    `s.model`/`s.temperature`/`s.maxTokens`/`s.ragTopK`/`s.ragThreshold` 를 `??` 없이 그대로 대입해도
    (즉 `undefined` 가 들어가도) 해당 필드들이 스키마 상 `z.unknown()` 이라 `undefined` 도 유효값으로
    통과한다 — 필드 누락(키 자체 부재)과 값이 `undefined` 인 경우를 zod object 는 동일하게 취급하므로
    문제 없음.
  - 제안: 없음. 정합 확인됨(단위 테스트 실측 PASS).

- **[INFO]** spec §1.3 필드 목록과 `CREDENTIAL_CONTEXT_FIELDS`/`credentialStripSubsetShape` 라인레벨 일치
  - 위치: `spec/5-system/4-execution-engine.md:168, 1289` vs `utils/resume-state.schema.ts:3039-3059, 3136-3148`
  - 상세: spec 168행 "credential/context-binding 필드(`llmConfigId`/`workspaceId`/`presentationTools`/
    `conditions`/`maxTurns` 등)는 미동봉" 목록과 코드의 `CREDENTIAL_CONTEXT_FIELDS` 배열
    (`llmConfigId, workspaceId, executionId, nodeId, workflowId, maxTurns, maxToolCalls, conditions,
    presentationTools, conversationThreadRef, rawConfig`) 이 상위집합으로 정합. `credentialStripSubsetShape`
    의 allow-list(`messages/turnCount/.../model/temperature/maxTokens/knowledgeBases/rag*/mcpServers/
    partialResult/collectionRetryCount/pendingFormToolCall?`) 도 spec 168행의 "messages / turnCount /
    model / temperature / maxTokens / knowledgeBases / RAG / MCP / pendingFormToolCall? 등" 과 일치.
  - 제안: 없음 (spec fidelity 확인됨, CRITICAL 아님).

- **[INFO]** `retryStateSchema`/`resumeStateSchema` 는 permissive(`.partial().catchall(z.unknown())`)로
  설계돼 있어 실질적으로 타입 문서화 이상의 런타임 안전장치는 아님
  - 위치: `utils/resume-state.schema.ts:3079-3128`
  - 상세: `retry-turn.service.ts` 의 `retryState.expiresAt`/`retryState.retryAfterSec` 접근은 여전히
    `typeof` 가드로 방어(변경 전과 동일 패턴 유지 — 155, 171-172행). 타입 단언 대체가 실제 null/타입
    안정성을 높이기보다 "도메인 의미 명시" 목적이라는 점이 JSDoc 과 일치. 의도-구현 괴리 없음.
  - 제안: 없음.

- **[INFO]** M-7 클러스터 스코프가 plan 문서와 diff 범위 정확히 일치
  - 위치: `plan/in-progress/refactor/03-maintainability.md:224` ("첫 클러스터(본 PR): `utils/to-record.ts`
    + `execution-engine.service.ts:1478`(cachedMeta) 1건 전환")
  - 상세: 실제 diff 는 plan 서술보다 약간 넓다 — `ai-turn-orchestrator.service.ts` 2곳,
    `execution-engine.service.ts` 1곳(`resumeCheckpoint` 타입), `handler-output.adapter.ts`
    (`isRecord` 재사용 1곳), `retry-turn.service.ts` 2곳(`RetryState` 타입) 이 함께 포함됐다. 이는 plan
    서술 "RESUME-STATE(§7.4 zod schema)" 클러스터가 "후속 클러스터"로 명시돼 있었으나(225행), 본 PR 에서
    schema 파일 자체와 그 소비처(주로 타입 어노테이션 전환)까지 앞당겨 완료한 것으로 보인다. 실행 시맨틱
    변화 없음(전부 `as X` → `as Y` 타입 캐스트 치환, 런타임 분기 无변경)이 테스트로 확인되므로 회귀
    리스크는 낮으나, plan 진행 상태 서술(224-225행)이 실제 커밋 범위와 약간 어긋난다.
  - 제안: `developer` 가 plan 문서(`03-maintainability.md` M-7 체크박스/서술)를 실제 커밋 diff 범위에
    맞춰 갱신할 것을 권장(코드 문제 아님, 문서 동기화 사안). CRITICAL 아님.

## 기능 완전성 / 엣지 케이스 / TODO / 에러 시나리오 / 반환값 검토

- TODO/FIXME/HACK/XXX 주석: 리뷰 대상 7개 파일에서 미발견. 미완성 작업 시사 주석 없음.
- 엣지 케이스: `isRecord`(`to-record.ts`) 로 대체된 `_resumeState` 타입가드는 기존 인라인 조건
  (`!== null && typeof === 'object' && !Array.isArray`) 과 완전히 동일한 boolean 로직 — 배열/null/
  원시값 케이스 모두 동일하게 처리됨(단위테스트 35건 PASS).
- 반환값: `buildResumeCheckpoint`(변경 없음, 타입 캐스팅 대상 아님)와 `_resumeState`/`_resumeCheckpoint`/
  `_retryState` 캐스트 변경 지점 전부 실행 경로 분기 로직 무변경 확인.
- 비즈니스 로직: credential-strip allow-list 규칙이 코드(스키마 shape)·spec(§1.3)·테스트(drift guard)
  3중으로 일치. `resume-state.schema.spec.ts` 11건 신규 테스트 모두 PASS.

## 검증 수행 내역

- `npx jest src/modules/execution-engine/utils/resume-state.schema.spec.ts` — 11 passed
- `npx jest src/modules/execution-engine/execution-engine.service.spec.ts -t "W5: information_extractor"` — 2 passed (실 `buildResumeCheckpoint` 산출물 vs 스키마 drift-guard 정합 확인)
- `npx jest src/modules/execution-engine/handler-output.adapter` — 35 passed
- `npx jest src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts src/modules/execution-engine/retry-turn.service` — 84 passed
- `npx tsc --noEmit` — 리뷰 대상 파일발 신규 타입 에러 0건(기존 `ai-turn-orchestrator.service.spec.ts` 의 무관 pre-existing 에러 3건은 이번 diff 밖 파일이며 커밋 85a1020df 이전부터 존재)

## 요약

M-7 첫 클러스터는 `execution-engine` 의 inline 타입 단언을 `resume-state.schema.ts` 의 zod-파생 타입으로
치환하는 순수 리팩터로, plan(§03-maintainability M-7)·spec(§1.3 credential allow-list)·구현·테스트가
모두 정합한다. 스키마는 런타임 검증을 의도적으로 배제(§7.5 graceful-reset 시맨틱 보존)하고 타입/문서화
목적으로만 쓰이며, 이 설계 의도가 JSDoc 에 명확히 기술되고 실제 코드 동작과 일치한다. 신규 drift-guard
테스트(`resumeCheckpointSchema.safeParse` + `CREDENTIAL_CONTEXT_FIELDS` 부재 단언)를 실제로 실행해
`buildResumeCheckpoint` 산출물과 스키마의 line-level 정합을 확인했다. CRITICAL/WARNING 없음 — 전부 INFO
등급이며, plan 문서의 진행 서술이 실제 커밋 스코프보다 약간 좁게 기술된 점만 문서 동기화 권고 사항으로
남긴다.

## 위험도

NONE
