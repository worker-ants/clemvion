# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 범위 및 방법

- target 은 코드 diff 16파일/1041줄(bundle 기준) — 실제 `git diff origin/main...HEAD --stat` 로 재확인하니 `.claude/test-stages.sh`·`PROJECT.md`·`CHANGELOG.md` 등 harness/root 문서 3건이 더 있어 총 19개 소스 변경(+plan/review 산출물). `spec/5-system/**` 자체는 델타 0 — 정상(코드 전용 PR).
- 프롬프트 번들에 전문이 실린 plan: `spec-followups-batch-b.md`(이번 turn 이 실행 중인 바로 그 plan) · `spec-draft-nullable-notation-followups.md`(상위 planner 트랙, B-1~B-8 의 출처) · `ai-agent-tool-connection-rewrite.md`(무관 — TBD 5건은 EIA 도구 재설계 축, 이번 diff 와 접점 없음).
- 나머지 62개 in-progress plan 은 예산 절단 — 그중 B-1 전제와 접점 있는 `backend-lint-gate-broken-on-main.md`·`harness-review-gate-followups.md`, 그리고 target 인 `spec/2-navigation/2-trigger-list.md`(아래 발견사항 근거)는 디스크에서 직접 Read 로 보완.

## 발견사항

- **[WARNING]** `spec-followups-batch-b.md` 의 `spec_impact` 가 이번 배치의 실제 범위와 무관한 spec 을 가리킨다
  - target 위치: 해당 없음(target `spec/5-system/**` 자체는 이번 turn 미변경) — 문제는 **이 plan 자신의 frontmatter**
  - 관련 plan: `plan/in-progress/spec-followups-batch-b.md` frontmatter `spec_impact: [spec/2-navigation/2-trigger-list.md]`
  - 상세: 이번 배치가 실제로 구현한 B-1~B-8 은 전부 `spec/5-system`(auth·api-convention·error-handling 의 §1.10/§5.4 가 이미 문서화한 계약을 코드가 뒤늦게 따라잡는 것)이고, `spec/2-navigation/2-trigger-list.md` 는 본문 어디에도 등장하지 않으며 실제 diff 도 그 spec 의 `code:` glob(`triggers.controller.ts`·`triggers.service.ts`·`triggers.module.ts`·`dto/**`)를 하나도 건드리지 않았다(신규 파일은 `repo-guards/__tests__/**`·`test/webhook-trigger.e2e-spec.ts` 뿐). 반면 `2-trigger-list.md` 에는 **아직 미해결인 진짜 pending 항목**(`§3` "sort/order 반영은 미구현/Planned")이 있고, 그 항목의 SoT 는 `spec-draft-nullable-notation-followups.md`(같은 문서가 `spec_impact` 에 `spec/2-navigation/2-trigger-list.md` 를 정당하게 올려 두고 있다 — "GET /api/triggers 의 sort/order 를 whitelist orderBy 로 구현한다" 항목, 아직 `[ ]`)다. `spec-followups-batch-b.md` 의 값은 이 상위 문서의 spec_impact 목록에서 한 항목만 그대로 옮겨 붙인 것으로 보이며(같은 파일명이 상위 문서 frontmatter 에 그대로 존재), 실제로는 이번 배치가 그 항목을 전혀 처리하지 않았다.
  - 제안: `spec-followups-batch-b.md` 의 `spec_impact` 를 `none` 으로 정정(이번 배치는 spec 본문을 바꾸지 않았고, 앞선 `--impl-prep`/`--impl-done` 검토가 §1.10/§5.4 선행 조건이 이미 충족돼 있음을 확인했다). 아직 Gate C(`spec-plan-completion.test.ts`)는 `plan/complete/` 이동 시점에만 강제되므로 지금 당장 빌드를 막지는 않지만, 이 값을 그대로 두고 plan 을 완료 처리하면 "batch-b 가 `2-trigger-list.md` 의 spec 영향을 이미 다뤘다"는 잘못된 기록이 남아, 정작 미해결인 sort/order 항목(`spec-draft-nullable-notation-followups.md` 소유)의 `pending_plans` 포인터를 다음 사람이 실수로 조기 해소 처리할 위험이 있다.

## 요약

`spec-followups-batch-b.md`(B-1~B-8)와 그 출처인 `spec-draft-nullable-notation-followups.md`(developer/harness 로 라벨된 8개 후속) 사이의 대응은 정확하고, 두 plan 모두 "착수 전 재판정" 실측을 갖추고 있어 병렬 세션 충돌 흔적도 없다. 이번 diff(pg-error SoT 단일화·listMembers DB 투영·endpointPath save 래핑 래칫·트리거 409 e2e·타입체크 ratchet 봉인·`__test-utils__` dist 제외·`WorkflowVersionDetail` 개명)가 전제하는 spec 상태(§1.10 트리거 에러 코드, §5.4 검증 층, `user-entity-exposure-guard` 화이트리스트 규약)는 모두 이미 충족돼 있어 미해결 결정과의 충돌이나 선행 plan 미해소는 발견되지 않았다. 유일한 흠은 `spec-followups-batch-b.md` 자신의 `spec_impact` 프론트매터가 상위 planner 문서에서 잘못 옮겨진 것으로 보이는 `spec/2-navigation/2-trigger-list.md` 하나만 가리키고 있다는 점 — 이번 배치의 실제 diff·본문 어디에도 그 spec 과의 접점이 없고, 그 spec 이 실제로 기다리는 미해결 항목(sort/order whitelist)은 이번 배치가 다루지 않았다. Gate C 는 완료 시점 필드라 지금 당장 빌드를 막지는 않으나, plan 을 `complete/` 로 옮기기 전에 정정해야 후속 세션의 오판을 막을 수 있다.

## 위험도

LOW
