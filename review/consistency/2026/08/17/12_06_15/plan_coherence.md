# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 요약

이번 PR(`eia-masking-round2-53afc8`)은 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`
가 정의한 단일 작업 — "`formConfig.defaultValue` 로 마스킹된 값(`***`)이 폼에 프리필돼 그대로
재제출되는 왕복 오염을 프런트 마커 가드로 차단" — 을 집행한다. diff 는
`sanitize-error-message.ts`(마커 상수 JSDoc 재배치) · `dynamic-form-ui.tsx`(`isMaskedValue`
가드) · i18n 사전(KO/EN) · 회귀 테스트에 한정되고, spec 변경은
`spec/5-system/14-external-interaction-api.md`(§R17 "닫는 조건" 갱신 + "프리필 왕복" 신설
불릿) · `spec/5-system/15-chat-channel.md`(§R-CC-15 `nodeName`→`nodeLabel` 오기 정정) ·
`spec/4-nodes/1-logic/12-background.md`(§8.2 `outputData`/`inputData` 마스킹 명시)
세 파일 134줄로 작다(`git diff --stat origin/main...HEAD -- spec/ plan/` 실측).

정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 대조한 결과,
이 PR 이 종결시킨 3개 체크박스(마커 JSDoc 재배치 · 유저가이드 Error 탭 캐비엇 · "WS 대기-재개
점검")는 정확히 이 diff 의 산출물과 1:1 대응하며, 다른 항목들과의 충돌·전제 미해소는
발견하지 못했다.

## 발견사항

### [INFO] 신규 evidence 파일이 target spec frontmatter `code:` 목록에 없음
- target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록
- 관련 plan: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` (본 PR 자체)
- 상세: 이번 diff 가 새로 손댄 `codebase/backend/src/shared/utils/sanitize-error-message.ts`
  (마커 상수 3종의 SoT)와 `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`
  (`isMaskedValue` 가드) 둘 다 §R17 의 핵심 메커니즘을 구현하는 파일인데, frontmatter `code:`
  목록에는 `strip-external-only-fields.ts` · `terminal-duration.ts` · `terminal-error-payload.ts`
  · `redact-stored-error.ts` 등 인접 `shared/utils/*` 는 있으면서 이 둘은 빠져 있다(diff 가
  frontmatter 를 건드리지 않았음을 `git diff` 로 확인).
- 제안: 이 PR 의 마무리(`--impl-done` 이후 fix 단계) 때 frontmatter `code:` 에 두 경로를
  추가하거나, 그럴 계획이 없다면 왜 제외했는지(예: `sanitize-error-message.ts` 는 여러 spec 이
  공유하는 범용 유틸이라 특정 spec 에 귀속시키지 않는다는 규약이 있는지)를 Rationale 에 한 줄
  남기는 편이 spec-impl-evidence 추적성에 도움이 된다. 다른 in-progress plan 의 결정과
  충돌하거나 선행조건을 어기는 문제는 아니므로 INFO 로 남긴다.

## 그 외 확인했으나 문제 없음으로 판정한 항목 (참고용)

- **미해결 결정과의 충돌 없음**: 트래커에 남은 "결정 필요" 항목 — EIA-IN-02 `retry_last_turn`
  외부 노출 정책, §R17 "잔여 ③" workflow-assistant 마스킹 우선순위 — 둘 다 이번 diff 가
  건드리지 않는다.
- **선행 plan 미해소 없음**: 본 PR 이 가정하는 전제("#1180 이 `waiting_for_input` payload 를
  마스킹한다", "`Execution.inputData` 카브아웃은 Execution 레벨 한정") 는 모두 이미
  origin/main 에 머지된 선행 커밋(`89c3f3c53` #1180, 그 이전 `f5351e9c2`/`b5e4dbb9c` 등)에서
  충족돼 있다.
- **후속 항목 누락 없음**: R17 신설 불릿이 "Re-run 모달·에디터 히스토리 로드에 같은 가드를
  확장하면 `Execution.inputData` 카브아웃도 닫을 수 있다" 고 명시하는데, 그 후속은 트래커의
  기존 열린 항목("`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다")이 이미
  추적하고 있어 신규 항목 누락이 아니다.
- **`15-chat-channel.md` R-CC-15 정정**은 이 PR 의 diff(git 확인)이고, 유사해 보이는
  `3-error-handling.md` §2.2 의 `nodeName`→`nodeLabel` 예시 정정은 이미 origin/main 에 있는
  선행 PR(#1180, `89c3f3c53`)의 산출물이라 서로 다른 두 사실이며 충돌이 아니다(초기에
  같은 정정으로 오인했으나 `git diff`/`git log -S` 로 별개 위치임을 확인).
- 플랜 트래커가 인용하는 커밋 해시(`83436ed45`) 하나는 이 worktree 의 조상이 아닌 별도
  브랜치(`claude/eia-masking-followups-3cd512`)의 커밋이나, 그 내용(“카브아웃은
  `Execution` 레벨 한정”)은 이 브랜치에도 선행 커밋(`89c3f3c53`)으로 이미 독립적으로
  반영돼 있어 실질적 모순은 없다. 이는 다른 worktree/branch 간 동시 작업의 흔적이라
  검토 대상 밖(본 checker 지침)으로 판단해 findings 에서 제외했다.

## 요약

이 PR 의 target 변경은 범위가 좁고(spec 3파일·134줄), 그 근거가 되는 `plan/in-progress`
트래커(`spec-sync-external-interaction-api-gaps.md`)와 신규 작업 plan
(`eia-masked-prefill-roundtrip-guard.md`)이 매우 촘촘하게 상호 인용되어 있어, 미해결 결정을
우회하거나 선행 plan 의 전제를 건너뛰거나 다른 plan 의 후속 항목을 무효화하는 사례는
발견되지 않았다. 유일한 관찰(INFO)은 이번에 손댄 두 evidence 파일이 target spec 의 `code:`
frontmatter 목록에서 빠져 있다는 점으로, plan 정합성보다는 spec-impl-evidence 추적성 메모에
가깝다.

## 위험도

NONE
