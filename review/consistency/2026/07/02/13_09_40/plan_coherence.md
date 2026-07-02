# Plan 정합성 검토 — spec/4-nodes/3-ai/1-ai-agent.md (impl-done)

## 검토 범위

- target spec: `spec/4-nodes/3-ai/1-ai-agent.md` (이번 PR 에서 target 문서 자체는 미변경 — `git diff origin/main...HEAD` 결과 diff 없음)
- 구현 diff: `to-record.ts`/`to-record.spec.ts` (isRecord JSDoc caveat 보강), `ai-turn-executor.ts` (`state as ResumeState` 좁히기, `buildRetryState` 파라미터/리턴 `RetryState`/`ResumeState` 타입화)
- 대조 대상: `plan/in-progress/**` 전체(discord/slack/webhook/spec-sync 등 무관 항목 포함해 스캔), 특히 `plan/in-progress/refactor/03-maintainability.md`(M-7), `plan/in-progress/exec-park-durable-resume.md`(D3/D4), `plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/in-progress/ai-context-memory-followup-v2.md`

## 발견사항

없음.

- `plan/in-progress/refactor/03-maintainability.md` M-7 항목이 본 diff 를 정확히 "RESUME-STATE 클러스터 (본 PR)"로 선기록해 두었고, 변경 파일(`ai-turn-executor.ts` 6곳 구조 단언 전환 중 일부), 검증 결과(lint/build/unit 7521/e2e 225), ai-review 산출물 경로까지 plan 서술과 diff 내용이 정확히 일치한다. `[~] 진행 중` 상태로 후속 클러스터(LOAD-BEARING/STORE-PRESERVE/`ai-turn-orchestrator.service.ts` 잔여/`ai-turn-executor.ts` 나머지 29곳)를 명시적으로 남겨 두었으므로 "후속 항목 누락"에 해당하지 않는다.
- M-7 plan 은 "**behavior-preserving (assertion-only)** — 런타임 경계에서 parse 하지 않는다"를 사용자 결정(2026-07-02)으로 명시했고, 실제 diff 도 `state as ResumeState` 단언 + 필드별 `?? 기본값`을 그대로 유지해 (parse/validate 미도입) 정확히 그 결정을 따른다. 결정 위반 없음.
- `exec-park-durable-resume.md` D3("park 중 편집은 fresh-per-turn 수용, `rawConfig` 는 checkpoint 영속 불요")와 대조 시, `resume-state.schema.ts` 의 `rawConfig: z.unknown()` 필드가 여전히 `unknown` 으로 남아 있어 이번 타입 좁히기가 D3 semantics 를 우회하거나 앞지르지 않는다.
- `_retryState`/`_resumeCheckpoint` 의 credential-strip 정책(spec §7.4/§7.9, plan M-7 의 I-5 invariant)도 diff 주석("credential / context-binding 필드는 의도적으로 미동봉")과 일치하며 신규 위반 없음.
- 코드/도구(`isRecord`) 의미론 변경이 아니라 JSDoc 문서화 강화 + 테스트 추가뿐이라 다른 plan(`ai-agent-tool-connection-rewrite.md`, `ai-context-memory-followup-v2.md` 등, 도구 연결/메모리 관련 미해결 결정)과 접점이 없다.

## 요약

이번 PR 은 `spec/4-nodes/3-ai/1-ai-agent.md` 자체를 변경하지 않는 순수 리팩토링(M-7 RESUME-STATE 클러스터)이며, 유일하게 관련된 진행 중 plan(`plan/in-progress/refactor/03-maintainability.md` M-7)이 이 작업을 "본 PR"로 정확히 예고·기록해 두었고 diff 내용·검증 결과·후속 항목 구분이 모두 plan 서술과 합치한다. `exec-park-durable-resume.md` 의 D3 확정 결정(fresh-per-turn, rawConfig 비영속)과도 충돌 없이 `rawConfig: z.unknown()` 을 유지했고, credential-strip 관련 invariant(I-5)도 diff 주석에서 그대로 보존됨을 확인했다. 다른 in-progress plan(도구 연결 재설계, 메모리 v2 후속, cafe24 등)은 이번 변경과 코드/개념적 접점이 없어 검토 대상에서 제외했다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 관점에서도 문제를 발견하지 못했다.

## 위험도

NONE
