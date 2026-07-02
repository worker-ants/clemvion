# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 점검 대상

- target spec: `spec/5-system/4-execution-engine.md`
- 구현 변경: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 신설 (zod 스키마 3종 — `resumeCheckpointSchema`/`retryStateSchema`/`resumeStateSchema`) + `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`retry-turn.service.ts`/`handler-output.adapter.ts` 의 구조 단언(`as Record<string, unknown>`) → `z.infer` 타입(`ResumeState`/`ResumeCheckpoint`/`RetryState`) 전환. plan 상 refactor-03 M-7 "RESUME-STATE 클러스터".

## 발견사항

검토 관점 1~4 (기각 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회) 전부에서 CRITICAL·WARNING 급 문제를 발견하지 못했습니다. 근거는 아래와 같습니다.

- **[INFO] "런타임 경계 미검증" 원칙이 실제 코드에서도 지켜지는지 확인 완료 — 명시만 보강 권고**
  - target 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 파일 헤더 주석(신규 diff 라인 366-374)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.5`(rehydration graceful-reset semantics) + `spec/conventions/node-output.md §4.2.1`("재구성은 핵심 필드 누락 시 기본값으로 보강")
  - 상세: §7.5 은 `_resumeCheckpoint` 가 부재/손상/미래버전이어도 즉시 거부(reject)하지 않고 `buildRetryReentryState` 가 "핵심 필드 누락 시 기본값 보강" 하는 graceful 정책을 규정한다. 신규 스키마 파일은 자신의 헤더 주석에서 "런타임 경계에서 parse/safeParse 하지 않는다"고 명시적으로 선언하고, 실제로 `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`retry-turn.service.ts` 런타임 경로에서 `resumeCheckpointSchema.parse`/`.safeParse` 호출이 전무함을 확인했다(코드 재확인: `grep -n "\.strict()\|\.safeParse(\|\.parse(" ai-turn-orchestrator.service.ts execution-engine.service.ts retry-turn.service.ts handler-output.adapter.ts` → 매치 0건, `.strict().safeParse` 사용은 `execution-engine.service.spec.ts`/`resume-state.schema.spec.ts` 테스트 파일에만 존재). 즉 코드는 spec §7.5 의 permissive 재구성 semantics 를 실제로 보존하고 있어 invariant 우회가 없다.
  - 제안: 문제가 아니라 확인 결과이므로 조치 불요. 다만 향후 이 스키마에 실수로 런타임 `.parse()` 호출이 추가되면 §7.5 semantics 를 조용히 깨뜨릴 수 있으므로, lint rule 또는 코드 리뷰 체크리스트에 "resume-state.schema.ts 의 parse/safeParse 는 `*.spec.ts` 파일에서만 허용" 항목을 추가하는 것을 권장한다(선택 사항, INFO).

- **[INFO] credential/context-binding 제외 목록이 spec §1.3 명시 목록보다 넓음 — 방향 일치, 문서 갱신 권고**
  - target 위치: `resume-state.schema.ts` `CREDENTIAL_CONTEXT_FIELDS` (diff 라인 496-508)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.3` "credential / context-binding 필드(`llmConfigId`/`workspaceId` 등)는 미동봉"
  - 상세: spec §1.3 은 예시로 `llmConfigId`/`workspaceId`/`presentationTools`/`conditions`/`maxTurns` 만 나열하지만, 코드의 `CREDENTIAL_CONTEXT_FIELDS` 는 여기에 `executionId`/`nodeId`/`workflowId`/`maxToolCalls`/`conversationThreadRef`/`rawConfig` 를 추가로 포함한다. 이 확장은 spec §6.1 이 `executionId`/`workflowId`/`rawConfig` 를 `ExecutionContext` 표준 필드(=checkpoint 에 있으면 안 되는 context-binding 값)로 이미 규정한 것과 정합하며, "제외 대상을 넓히는" 방향이라 credential 누출 방지라는 원칙에 반하지 않는다 — 기각된 대안의 재도입이나 원칙 위반이 아니다.
  - 제안: spec §1.3 의 "credential / context-binding 필드(`llmConfigId`/`workspaceId` 등)" 서술을 "…등 (전체 목록은 `CREDENTIAL_CONTEXT_FIELDS`, executable SoT)" 로 링크 보강하면 향후 drift 를 줄일 수 있다. 필수는 아님(INFO).

- **conditions 3(무근거 번복) 관련 — 번복 아님을 확인**: `_resumeCheckpoint` 보존 정책 자체(§Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존 (옛 'WARN #6 미영속' 번복)")는 이미 과거에 명시적 Rationale 로 번복이 기록되어 있고, 본 diff 는 그 기존 정책을 zod 스키마로 executable 하게 재인코딩하는 것뿐 — 새로운 정책 번복이 없다. plan(`refactor/03-maintainability.md` M-7 RESUME-STATE 클러스터)도 "behavior-preserving (assertion-only)" 를 사용자 결정(2026-07-02)으로 명시하고 있어 절차적으로도 문제가 없다.

- **conditions 4(암묵적 가정 충돌) 관련 — 충돌 없음을 확인**: `resumeCheckpointSchema.strict()` 를 테스트에서만 사용해 "credential 유입 시 실패" 를 검증하는 것은 spec/conventions 양쪽이 요구하는 "credential-strip 부분집합" invariant 를 강화하는 방향이며, `resumeStateSchema`(in-memory superset)에 credential/context-binding 필드를 포함시키고 `.partial().catchall()` 로 permissive 하게 둔 것도 §1.3 "`_resumeState` 는 credential 을 담을 수 있는 in-memory-only 전체 상태" 정의와 일치한다. `retryStateSchema` 가 `.partial().catchall(z.unknown())` 인 것도 spec/conventions 의 "DB 에서 읽어들이는 값이라 방어적으로 모든 필드 optional + 알 수 없는 키 보존" 요구와 부합.

## 요약

target 코드 변경(`resume-state.schema.ts` 신설 + 4개 파일의 타입 단언 치환)은 refactor-03 M-7 RESUME-STATE 클러스터로, `spec/5-system/4-execution-engine.md §1.3/§7.5` 및 `spec/conventions/node-output.md §4.2.1` 이 규정한 credential-strip allow-list·라이프사이클 3분류(`ResumeState`/`ResumeCheckpoint`/`RetryState`) invariant 를 **executable하게 문서화**하는 작업이다. 과거 Rationale 이 기각한 대안(예: 암호화 영속, `waiting_for_retry` 신규 상태, `_continuationCheckpoint` 컬럼 신설, per-node task queue)을 재도입하는 부분은 없으며, §7.5 의 "런타임 경계에서 parse 하지 않는 graceful-reset semantics" 원칙도 코드 재확인 결과 실제로 준수되고 있다(런타임 경로에 zod parse/safeParse 호출 없음, 테스트 파일에만 존재). `_resumeCheckpoint` 보존이라는 상위 결정 자체는 이미 spec 에 "옛 WARN #6 미영속 번복"으로 명시적 Rationale 이 기록돼 있고, 본 변경은 그 기존 결정의 표현 방식(타입 단언 → zod 스키마)만 바꾼 behavior-preserving 리팩터링이라 새로운 번복이 아니다. Credential/context-binding 제외 필드 목록이 spec 예시 나열보다 넓은 점은 방향이 일치하는 보강이라 문제로 보지 않으며, 문서 상호 링크 보강 정도의 INFO 만 남긴다.

## 위험도

NONE
