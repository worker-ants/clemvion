# Plan 정합성 검토 결과

Target: `spec/conventions/user-guide-evidence.md`

---

## 발견사항

### [INFO] refactor/02-architecture.md C-2 cluster 5 — ImplAnchor 경로 sync 완료 확인
- target 위치: §3.3 `kind="api-endpoint"` 예시 (`symbol="rotateBotToken"`, `file="...triggers.controller.ts"`)
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` §C-2 cluster 5 (`[x]` 완료 표기)
- 상세: cluster 5(chat-channel↔triggers 순환 해소, PR #676 `e827ed2a` 머지)가 `rotateBotToken` 엔드포인트를 `ChatChannelController` → `TriggersController` 로 이전하면서 `user-guide-evidence.md` ImplAnchor 경로 동기화를 "기계적 경로 sync" 로 명시했다. target 문서의 §3.3 예시가 `triggers.controller.ts` 를 가리키는 것은 이 동기화 결과와 정합한다.
- 제안: 확인 사항으로만 기록. 변경 불필요.

### [INFO] plan/complete/spec-sync-user-guide-evidence-gaps.md — 완료 ticket 이 complete/ 로 이동됨
- target 위치: 전체 문서 (frontmatter `status: implemented`)
- 관련 plan: `plan/complete/spec-sync-user-guide-evidence-gaps.md` (complete/ 이동 완료)
- 상세: user-guide-evidence 의 이전 미구현 항목 2건(§4 채널 2 user-guide-writer 체크리스트, §2 api-endpoint anchor NestJS 데코레이터 검증)이 모두 구현 완료되어 ticket 이 `plan/complete/` 로 이동됐다. target 문서의 `status: implemented` 및 §2/§4 본문 기술이 이와 정합한다.
- 제안: 확인 사항으로만 기록. 변경 불필요.

### [INFO] §5 (i18n-userguide.md §Principle 7 와의 관계) 후속 갱신 의무 — 진행 중 plan 미반영
- target 위치: §5 마지막 문장 — "후속으로 `i18n-userguide.md §Principle 7` 본문에 본 가드의 부분 커버 범위를 명시한다."
- 관련 plan: `plan/in-progress/**` 중 해당 항목을 추적하는 ticket 없음
- 상세: target §5 는 i18n-userguide.md §Principle 7 에 본 가드의 부분 커버(GUI 흐름 절은 anchor 가드가 커버, 개념 설명 절은 미커버) 범위를 명시하는 후속 작업을 약속하고 있다. 현재 `spec/conventions/i18n-userguide.md §Principle 7` 본문(line 170~173)을 보면 이미 `<ImplAnchor>` + 3개 가드 파일을 명시하고 있어 실질적으로 반영 완료된 것으로 보이나, in-progress plan 에 추적 ticket 이 없다. 완료 여부 확인 후 spec-sync-user-guide-evidence-gaps.md 완료 기록에 추가하거나, i18n-userguide.md 본문이 아직 불충분하다면 plan ticket 을 신설해야 한다.
- 제안: i18n-userguide.md §Principle 7 의 현행 본문이 target §5 의 약속을 이미 충족하는지 확인 후, 충족이면 별도 조치 불요. 미충족이면 plan ticket 신설.

---

## 요약

`spec/conventions/user-guide-evidence.md` 는 `plan/in-progress/` 의 어떤 미해결 결정과도 충돌하지 않는다. 관련 gaps ticket(`spec-sync-user-guide-evidence-gaps.md`)은 `plan/complete/` 로 이동 완료됐고, 이 spec 의 구현을 전제로 했던 refactor C-2 cluster 5 도 ImplAnchor 경로 sync 를 포함해 머지 완료됐다. 유일한 주의 사항은 target §5 의 "후속으로 i18n-userguide.md §Principle 7 에 본 가드 커버 범위를 명시" 약속인데, 현행 i18n-userguide.md §Principle 7(line 170~173)이 이미 3개 가드와 커버 범위를 서술하고 있어 실질 충족 가능성이 높다. 선행 조건 미해소나 후속 항목 무효화 문제는 없다.

## 위험도

NONE
