# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
대상 spec: `spec/5-system/4-execution-engine.md`
diff-base: `claude/engine-split-s2-aiturn`
검토 시점: 2026-06-17

---

## 발견사항

### [INFO] refactor/02-architecture.md C-1 체크박스 미갱신

- target 위치: diff 전체 (ButtonInteractionService + FormInteractionService 신설, execution-engine.service.spec.ts 갱신)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 항목 및 분할 로드맵
  - 현재 C-1 헤더: `- [ ] 미착수 — execution-engine.service.ts`
  - 로드맵 항목 3: `- [ ] 3. FormInteractionService / ButtonInteractionService — waitForX/processXResumeTurn 쌍 이동, registry 등록부만 엔진 잔류.`
- 상세: C-1 step3(FormInteractionService / ButtonInteractionService 추출)이 구현 완료(`158db86c`)됐으나 plan 의 체크박스는 여전히 `[ ]` 미착수 상태. step1(NodeBootstrapService), step2(AiTurnOrchestrator, `2d363e4b`)도 완료됐으나 plan 체크박스가 미갱신된 것과 동일한 패턴.
- 제안: plan 문서의 체크박스를 완료형(`[x]`)으로 갱신하고, 완료된 단계에 worktree/PR 참조를 추가. plan README.md 의 C-1 항목 현황도 동기화.

---

### [INFO] refactor/02-architecture.md C-1 — 후속 단계 4(RetryTurnService) 착수 조건 명시 필요

- target 위치: diff 전체 (step3 완료)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 항목 4
  - `- [ ] 4. RetryTurnService (applyRetryLastTurn / buildRetryReentryState / resumeGraphAfterRetry) — _retryState/_resumeCheckpoint 는 spec §1.3 공유 계약, allow-list 불변 유지.`
- 상세: step1·2·3 완료로 다음 단계(4: RetryTurnService)가 착수 가능 상태가 됐으나 plan 에 이를 명시하는 갱신이 없음. 후속 단계가 현재 plan 에 "미착수 — execution-engine.service.ts" 라는 상위 레이블 아래 묻혀 있어 진행 상태를 추적하기 어렵다. INFO 등급 — 미착수 결정을 우회하거나 충돌하는 사항이 아니고, 후속 단계 자체가 아직 미결정 항목이 없으므로 critical/warning 에 해당하지 않는다.
- 제안: plan 문서에 "step1/2/3 완료, step4 착수 가능" 진행 메모 추가. 착수 전 worktree 지정.

---

### [INFO] spec/5-system/4-execution-engine.md frontmatter `code:` 에 ButtonInteractionService 파일 포함 확인 불요

- target 위치: 신설 파일 `codebase/backend/src/modules/execution-engine/button-interaction.service.ts`
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 spec 갱신 항목 — "분할 후 엔진 spec frontmatter `code:` 글로브에 신규 서비스 파일 추가"
- 상세: spec frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/**` 글로브가 이미 등록되어 있으므로 신규 파일(`button-interaction.service.ts`, `form-interaction.service.ts`)은 자동 포함됨. C-1 로드맵의 "frontmatter code: 갱신" 항목은 글로브 커버리지로 이미 충족. 단 plan 문서에 이 확인이 기록되면 이후 단계(step4)에서 같은 검토를 생략할 수 있다.
- 제안: plan 에 "기존 `execution-engine/**` 글로브로 신규 파일 자동 포함 — 별도 frontmatter 갱신 불요" 메모 추가(선택).

---

## 요약

이번 diff(C-1 step3: ButtonInteractionService + FormInteractionService 추출)는 `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 로드맵의 항목 3을 구현한다. 해당 plan 이 이 분할을 "spec 변경 불요 + strangler-fig 단계별 진행" 으로 확정한 만큼, 구현이 plan 에서 미해결로 남겨둔 결정을 일방적으로 내리거나 선행 plan 을 우회하는 사안은 없다. 유일한 발견사항은 plan 체크박스 미갱신(진행 추적 정보 누락)과 후속 step4 착수 조건 명시 권장이며, 모두 INFO 등급이다. CRITICAL·WARNING 사항 없음.

## 위험도

NONE
