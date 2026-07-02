# Rationale 연속성 검토 결과

## 검토 대상
- target: `spec/4-nodes/3-ai/1-ai-agent.md` (구현 완료 후 검토, --impl-done)
- diff: `origin/main...HEAD` — `to-record.ts`/`to-record.spec.ts` (JSDoc·테스트 보강), `ai-turn-executor.ts` (`Record<string, unknown>` 구조 단언을 `ResumeState`/`RetryState` zod-derived 타입으로 치환), 관련 `resume-state.schema.ts`

## 확인 절차
1. target spec(`1-ai-agent.md`) 본문에서 diff 와 직접 관련된 `_resumeState` / `_resumeCheckpoint` / `_retryState` 조항(§7.4, §7.5, §7.9, §12)을 전수 확인.
2. `spec/conventions/node-output.md` §4.2.1 (보존 예외 — `_resumeCheckpoint`/`_retryState`) Rationale 확인.
3. 실제 구현 `resume-state.schema.ts`, `ai-turn-executor.ts` 의 `buildRetryState`/`buildMultiTurnFinalOutput` 를 절대경로로 직접 Read 하여 diff 내용과 credential-strip allow-list 정책 준수 여부 대조.
4. `to-record.ts`/`to-record.spec.ts` 는 기존 M-7 리팩터 클러스터(refactor-03)의 연장선으로, 사용자 메모리(`project_refactor_m1_done_next_order`)의 진행 순서와 상충 여부 확인.

## 발견사항

없음 — 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례를 발견하지 못했다.

### 대조 세부 근거

- **allow-list / credential 제외 원칙 (spec §7.9, node-output.md §4.2.1) 준수**: diff 의 `buildRetryState(source: ResumeState, ...)` 는 여전히 `llmConfigId`/`workspaceId`/`executionId`/`presentationTools`/`conditions`/`maxTurns`/`rawConfig` 등 credential/context-binding 필드를 **명시적으로 미동봉**하며, 그 사유를 코드 주석에 spec §7.9 참조와 함께 유지하고 있다(`ai-turn-executor.ts` L3158-3164). `resume-state.schema.ts` 의 `credentialStripSubsetShape` 도 동일 allow-list를 스키마로 명문화했을 뿐 필드 집합을 확장/축소하지 않았다(`CREDENTIAL_CONTEXT_FIELDS` 상수가 spec 이 규정한 "제외 목록"과 1:1 대응).
- **behavior-preserving 명시**: `resume-state.schema.ts` 의 JSDoc 은 "본 스키마는 런타임 경계에서 parse/safeParse 하지 않는다"고 스스로 선언하며, 그 이유로 §7.5 rehydration 의 graceful-reset semantics(malformed 허용)를 스키마 강제 검증으로 바꾸면 안 된다는 점을 든다 — 이는 spec §7.5 (`RESUME_INCOMPATIBLE_STATE`, 부재/손상/미래 버전 시 graceful reset, 핵심 필드 누락 시 기본값 보강) Rationale 과 완전히 정합하는 설계이며, 오히려 spec 이 규정한 invariant 를 코드 차원에서 재확인·보강한 사례다.
- **`_retryState` 는 `ResumeState` 전체를 spread 하지 않음**: `buildMultiTurnFinalOutput` 이 `retryStateSource?: ResumeState` 를 받아 `buildRetryState` 에 전달하지만, 실제 반환 객체(`RetryState`)는 함수 내부에서 필드별로 개별 매핑되며 spread 연산자로 source 전체를 복사하는 코드는 없다. spec 의 "allow-list 를 통째 spread 하지 않고 개별 나열" 원칙(§7.9 JSDoc: "We deliberately allow-list the carried keys rather than spread the whole state so no secret / oversized bookkeeping leaks in.")과 diff 이후에도 동일하게 유지된다.
- **`to-record.ts` 변경은 기존 클러스터의 연속**: JSDoc 에 `isRecord` 가 "순수 plain-object 가드가 아님" 을 명시하고 회귀 테스트를 추가한 것은 기존 유틸(refactor-03 M-7 클러스터)의 캐비어트를 문서화하는 보강이며, 새 결정을 도입하거나 과거 결정을 번복하지 않는다. 사용자 메모리 상의 리팩터 백로그 진행 순서(M-1 완료 → M-3 → M-8 → m-2 → C-2)와도 배치되지 않는 M-7 계열 후속 작업으로 보인다.
- **spec 본문 자체의 변경 없음**: 이번 diff 는 코드 전용 변경(spec 파일에 대한 diff 항목 없음)이며, target spec 문서(`1-ai-agent.md`)의 어떤 조항도 새로 개정되거나 재작성되지 않았다. 따라서 "결정을 뒤집으며 새 Rationale 미기재" 유형의 위반이 성립할 여지 자체가 없다 — 이번 변경은 spec 이 이미 규정한 계약(§7.4/§7.9 allow-list, node-output.md §4.2.1 보존 예외)을 타입 시스템으로 강제하는 순수 구현 보강이다.

## 요약

diff 는 AI Agent multi-turn 재개/재시도 상태(`_resumeState`/`_resumeCheckpoint`/`_retryState`)를 다루던 기존 `Record<string, unknown>` 구조 단언을, 이미 spec 이 규정해 온 credential-strip allow-list 를 그대로 반영한 zod-derived 타입(`ResumeState`/`RetryState`)으로 치환한 behavior-preserving 리팩터다. credential/context-binding 필드의 의도적 배제(spec §7.9, node-output.md §4.2.1), graceful-reset semantics(§7.5), allow-list spread 금지 원칙이 모두 diff 이후에도 코드·주석 양쪽에서 그대로 유지되고 있음을 확인했다. 과거 Rationale 에서 기각된 대안의 재도입, 합의 원칙의 위반, 무근거 결정 번복, invariant 우회 사례는 발견되지 않았다.

## 위험도

NONE
