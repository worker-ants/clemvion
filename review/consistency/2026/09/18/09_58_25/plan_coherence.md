# Plan 정합성 검토 — `spec-draft-deletion-release-current-tense.md`

## 발견사항

- **[WARNING]** `2-trigger-list.md` frontmatter `code:` 동시 편집 대상인 미해결 후속 항목이 반영되지 않음
  - target 위치: `plan/in-progress/spec-draft-deletion-release-current-tense.md` C3 (`spec/2-navigation/2-trigger-list.md` frontmatter `code:` — `trigger-config-lock.ts` 항목 뒤에 `trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·증거 e2e 추가)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3974` — **`- [ ]` 미해소** 항목 `"2-trigger-list.md 의 code: 가 §3 계약의 시행 파일 하나를 놓친다"` (planner, 2026-09-14 등재, `/ai-review review/code/2026/09/14/11_27_40` requirement WARNING#1). 처분: 같은 frontmatter `code:` 리스트에 `schedule-trigger.e2e-spec.ts` 추가.
  - 상세: target 의 C3 는 `2-trigger-list.md` frontmatter 의 바로 그 `code:` 리스트를 편집하는데, 같은 파일·같은 키를 겨냥한 다른 미해소 항목(스케줄 타입에 대한 §3 `TriggerDto.workflow` 계약 시행 파일 누락)을 참조하거나 함께 반영하지 않는다. 이 트래커 파일은 스스로 "항목을 추가할 때 frontmatter 를 함께 보지 않는 것" 이 재발 원인이라고 여러 차례 자백한 이력이 있다(같은 파일 곳곳의 유사 각주). target PR 이 이 frontmatter 블록을 먼저 손대고 커밋되면, 뒤이어 그 미해소 항목을 처리할 세션이 변경된 주변 컨텍스트(락 파일 위치·주석)를 다시 파악해야 하고, 두 편집이 별도 세션에서 이뤄지면 후속 세션이 이 사실을 놓칠 위험이 있다.
  - 제안: target PR 에 `schedule-trigger.e2e-spec.ts` 등재를 함께 묶거나(같은 파일·같은 필드이므로 비용이 낮다), 최소한 target 의 "비대상" 섹션 또는 트래커 반영 문단에 "같은 frontmatter 를 겨냥하는 미해소 항목 존재, 별도 처리" 라고 한 줄 남겨 다음 세션이 두 편집을 조율하게 한다.

- **[INFO]** `secret-store.md` 를 `status: implemented` 로 승격하는 시점에 같은 문서의 `code:` 등재 여부를 묻는 미해결 질문이 병존
  - target 위치: C7 (`spec/conventions/secret-store.md` frontmatter `status: partial` → `implemented`, `pending_plans` 삭제)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1921` — **`- [ ]` 미해소** 질문 항목 `"비밀-부재 헬퍼를 secret-store.md 의 code: 에도 등재해야 하나"` (planner 또는 developer, 2026-09-10 등재).
  - 상세: 이 질문은 "미구현 surface" 가 아니라 §5.4 이중-소유 등재 관례의 적용 범위를 묻는 문서 위생 질문이라 `status: partial` 유지 의무와는 결이 다르다. 다만 그 질문이 "예" 로 판정되면 같은 `secret-store.md` frontmatter `code:` 를 다시 편집해야 하므로, target 이 이 문서의 `pending_plans` 링크를 완전히 끊는 것이 "이 문서에 남은 미해결 사안 없음" 으로 과도하게 읽힐 여지가 있다. `pending_plans` 는 spec 쪽에서 "미구현 surface 를 책임지는 plan" 만을 의미하므로 형식상 오류는 아니다(`.claude/docs/plan-lifecycle.md` §pending_plans 정의).
  - 제안: 반영은 target 대로 진행하되, 그 질문 항목이 나중에 `secret-store.md` 를 다시 열 수 있다는 점을 트래커 쪽 각주에 유지(이미 트래커 안에 있으므로 target 은 그대로 두면 됨) — target 문서 자체를 고칠 필요는 낮다.

- **[INFO]** `1-workflow-list.md` frontmatter `pending_plans` 에 이미 `complete/` 로 이동한 plan 이 잔존
  - target 위치: C8 (`spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 에서 `spec-draft-nullable-notation-followups.md` 한 줄만 제거)
  - 관련 plan: 현재 `1-workflow-list.md` frontmatter `pending_plans` 목록에 `plan/complete/workflow-duplicate-nodes-edges.md`(status: complete, `plan/complete/` 소재) 가 남아 있다. `.claude/docs/plan-lifecycle.md` 는 "plan 레벨에는 가드가 없다 — 경로 오기·이동 후 stale 경로가 빌드에서 검출되지 않는다" 고 이미 이 형태의 drift 를 알려진 문제로 지목한다.
  - 상세: target C8 의 근거 문장 "`status: partial` 은 남은 두 항목 때문에 그대로" 는 그 "두 항목" 중 하나가 이미 완료된 plan 이라는 점을 반영하지 않는다. `marketplace-and-plugin-sdk.md`(in-progress) 하나만으로도 `status: partial` 유지는 정당하므로 결론에는 영향이 없으나, 서술이 실제보다 넓은 "미해결 항목 수" 를 암시한다.
  - 제안: target 이 어차피 이 frontmatter 블록을 여는 김에 `plan/complete/workflow-duplicate-nodes-edges.md` 줄도 함께 제거하면 stale pending_plans 를 하나 줄일 수 있다 — 선택 사항(이번 PR 범위 밖으로 남겨도 무방).

## 요약
target 의 핵심 주장("계약은 바꾸지 않는다", "row 1~5·7 은 구현 상태를 그대로 반영, row 6 은 표 scope 불일치로 비대상")은 `plan/complete/spec-draft-deletion-releases-trigger-resources.md`(#1345 D1~D7)·`plan/complete/trigger-deletion-release.md`(#1346)·트래커 항목(4552행)의 7행 표와 정합하며, 남는 창(D7-1~D7-3)이나 사후 정리(sweeper) 재판단처럼 여전히 열려 있는 결정들을 건드리거나 우회하지 않는다. row 6(execution-engine §4.4 순환 표) 비대상 판정도 트래커 반영 절차 안에서 사유를 남기므로 결정 우회가 아니라 정당한 planner 재량 행사로 본다. 다만 C3 가 편집하는 `2-trigger-list.md` frontmatter `code:` 는 같은 필드를 겨냥한 별도의 미해소 후속 항목(스케줄 e2e 파일 누락)과 겹치는데 target 이 이를 인지·반영하지 않아 조율 공백이 남는다(WARNING). 그 외 secret-store.md·1-workflow-list.md 의 frontmatter 정리는 사소한 정확도 이슈로 INFO 수준이다.

## 위험도
LOW
