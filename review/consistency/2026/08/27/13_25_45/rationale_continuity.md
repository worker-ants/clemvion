# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 검토 대상

- diff-base `origin/main` 대비 `spec/5-system/` 스코프에서 실제 변경된 파일은 **`spec/5-system/4-execution-engine.md` 1개**(4 hunks, 5 insertions / 3 deletions)뿐이었다. (프롬프트에 diff 본문이 컨텍스트 예산으로 생략되어 있어, worktree에서 `git diff origin/main...HEAD -- spec/5-system/` 로 직접 재확인함.)
- 4개 편집 모두 동일 주제 — `_resumeState`/`_retryState`/`_resumeCheckpoint` 의 credential 제거 메커니즘 서술을 "`maskSensitiveFields` boundary" 에서 "allow-list" 로 정정하고, `Engine Raw Config Exposure` 절에 "config 에는 storage-time 마스킹이 없다" 블록을 신설.

## 발견사항

없음 (CRITICAL/WARNING 없음). 아래는 검토 과정과 근거만 기록.

- **[INFO] 정정이 아니라 선례를 따르는 전파(propagation) 편집으로 판정**
  - target 위치: `spec/5-system/4-execution-engine.md` L193, L203, L1510, 그리고 `### Engine Raw Config Exposure` 절 신규 blockquote(L1558 부근)
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` R-5 의 "정정 (2026-08-24)" 블록 — "엔진 boundary(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 보편 마스킹" 결정이 **제거**되고 egress-only 마스킹(REST `redactStoredDataForResponse` / WS `maskWireEnvelope`)으로 대체된 것이 SoT. 동일 정정이 이미 `spec/conventions/node-output.md` Principle 7("마스킹은 egress 에서만 한다 — 표현식은 원문을 읽는다", 2026-08-24 신설)과 `spec/conventions/egress-masking.md`("`maskSensitiveFields` 는 이 좌표계 표에 행이 없다", 2026-08-24 명시)에도 동일한 취소선+정정 패턴으로 반영되어 있음을 확인.
  - 상세: target 의 4곳 편집은 이 이미 확정된 2026-08-24 정정을 `4-execution-engine.md` 에도 동기화한 것 — 새로운 결정 번복이 아니라 **기존 결정의 잔여 미러 드리프트(stale reference) 해소**다. 편집 각각이 `~~취소선~~` + **정정 문구** + 날짜(2026-08-24) + SoT 링크(`node-output.md`, `14-execution-history.md`) 를 동반해 "무근거 번복" 에 해당하지 않는다.
  - 코드 대조: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `buildRetryState()` 의 JSDoc 이 이미 동일 문구("Formerly cited the `maskSensitiveFields` boundary strip; that boundary was removed on 2026-08-24 — this exclusion never depended on it.")를 담고 있고, `execution-engine.service.ts` `buildResumeCheckpoint()` 주석도 "`AiAgentHandler.buildRetryState` 와 동일 allow-list 정책" 이라고 이미 서술 — target 의 spec 서술이 코드·타 spec 문서와 정확히 정합함을 실측으로 확인.
  - 제안: 조치 불필요. 참고로 credential-strip 메커니즘이 "boundary masker(deny/mask-by-key)" 에서 "allow-list(포함할 키만 열거)" 로 재서술된 것은 안전 방향으로 더 보수적인 서술이며(allow-list 는 mask 유틸의 존재/정확성에 의존하지 않음), 시스템 invariant("credential 은 `_resumeState`/`_retryState`/`_resumeCheckpoint` 에 담기지 않는다")를 약화시키지 않는다.

## 요약

이번 impl-done 스코프(`spec/5-system/`)에서 실제로 바뀐 것은 `4-execution-engine.md` 한 파일, 동일 주제(credential-strip 메커니즘 서술)의 4곳 편집뿐이다. 모두 2026-08-24 에 이미 확정·기록된 "boundary masking 제거 → egress-only 마스킹" 결정(SoT: `2-navigation/14-execution-history.md` R-5, `conventions/node-output.md` Principle 7, `conventions/egress-masking.md`)을 뒤늦게 `4-execution-engine.md` 에도 미러링한 것으로, 기각된 대안의 재도입도, 합의 원칙 위반도, 무근거 번복도 아니다. 오히려 취소선 표기·날짜·SoT 링크를 갖춘 모범적인 Rationale 연속성 유지 편집이며, 코드 주석(`ai-turn-executor.ts`, `execution-engine.service.ts`)과도 실측 대조로 정합함을 확인했다. Rationale 연속성 관점에서 문제 없음.

## 위험도

NONE
