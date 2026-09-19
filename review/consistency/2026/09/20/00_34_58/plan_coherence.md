# Plan 정합성 검토 — target: `spec/2-navigation/` (1-workflow-list.md · 2-trigger-list.md · 3-schedule.md)

## 발견사항

- **[INFO]** 이 `--impl-prep` 호출의 target 스코프가 이 worktree 의 실제 진행 plan 과 무관하다
  - target 위치: 전체 (`spec/2-navigation/`)
  - 관련 plan: `plan/in-progress/column-guard-gaps.md` (이 worktree 유일의 in-progress 작업)
  - 상세: `column-guard-gaps.md` 의 스코프는 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (컬럼 층 가드의 예방 계층 회귀 테스트 · `default` RETURNING 왕복) 이고 `spec_impact: none` 이다. `spec/2-navigation/` 와는 코드·spec 어느 축으로도 접점이 없다. 이 worktree 안에 `spec/2-navigation/` 구현을 착수하려는 다른 in-progress plan 도 없다. `plan_coherence` 검토가 "곧 구현할 target" 을 전제로 하는 점검이라면, 이번 호출은 실제 착수 대상과 다른 문서를 겨냥했을 가능성이 있다.
  - 제안: orchestrator/호출자 쪽에서 이 `--impl-prep` 호출의 target 인자가 이번 세션의 실제 작업(column-guard-gaps)과 맞는지 확인. target 이 의도된 것이라면(예: 별 세션·별 목적의 배치성 스캔) 이 INFO 는 무시 가능 — 아래 본문 검토 결과에는 영향 없음.

- **[INFO]** `1-workflow-list.md` frontmatter `pending_plans` 가 이미 완료된 plan 을 계속 가리킨다
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` (두 번째 항목)
  - 관련 plan: `plan/complete/workflow-duplicate-nodes-edges.md` (status: complete) · 대조: `plan/in-progress/spec-draft-nullable-notation-followups.md:3942` "docs 가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다" (harness, open item)
  - 상세: 이 completed plan 이 추적하던 미구현 surface(복제가 노드·엣지 없이 빈 워크플로우를 만듦)는 이미 구현됐고, 그 결과가 같은 문서 §2.6 "노드·엣지를 포함한 **캔버스 전체**가 복사되고…" 에 현재형으로 반영돼 있다. `pending_plans` 는 "이 spec 의 미구현 surface 를 책임지는 **아직 열린** plan" 을 가리키는 필드인데(`plan-lifecycle.md §…`), 여기 남은 항목은 이미 닫힌 surface 를 가리키는 dangling 참조다. existence-only 가드(`spec-pending-plan-existence.test.ts`)는 경로가 `plan/complete/` 에 실재하므로 통과해 자동으로는 안 잡힌다 — 정확히 위에서 인용한 open item이 짚는 그 갭의 구체 사례다.
  - 제안: `1-workflow-list.md` frontmatter 의 `pending_plans` 에서 `plan/complete/workflow-duplicate-nodes-edges.md` 를 제거(남는 미구현 surface 는 §2.7 마켓플레이스 템플릿 링크 하나뿐이고, 이는 `marketplace-and-plugin-sdk.md` 가 이미 커버). 이 정정은 plan 쪽이 아니라 target(spec) 쪽 frontmatter 를 고치는 사안.

- **[INFO]** `2-trigger-list.md` §2.3.1 이 존재하지 않는 plan `eia-trigger-edit-ui` 를 인용 — 단 이미 조치-안-함으로 처분됨
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 "External Interaction (Notification)" 행 — "별 plan `eia-trigger-edit-ui` 가 구현"
  - 관련 plan: `plan/in-progress/**`·`plan/complete/**` 전체에 `eia-trigger-edit-ui` 라는 이름의 plan 파일이 없음(grep 0건) — 유일한 교차 참조는 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md:192` "`eia-trigger-edit-ui` dangling 참조 … 이 변경과 무관한 기존 상태, 조치 안 함"
  - 상세: 이 문구 자체는 새 결함이 아니라 과거 리뷰에서 이미 식별·처분(변경 없이 방치하기로 결정)된 상태다. 재지적은 오탐에 가깝다 — 다만 그 처분이 산문 한 줄로만 남아 있어 다음 checker 가 다시 지목할 가능성이 있다.
  - 제안: 새 조치는 불필요. 필요하다면 이 dangling 참조에 대한 처분을 `spec-draft-nullable-notation-followups.md` 의 열린 목록에 한 줄로 명시적으로 등재해 반복 지적을 줄이는 정도가 최선.

- 그 외 — `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 가 pending_plans 로 직접 지목하는 대형 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 4,900줄, planner 소유, status: in-progress) 를 열린 항목(`- [ ]`) 전수 대조했다. 2-navigation 스코프에 해당하는 열린 항목(예: `GET /api/triggers` sort/order whitelist 미구현, 트리거 자원 정리 사후 sweeper 필요 여부 재판단, `trigger-resource-releaser.service.spec.ts` code: 미등재, 부모 삭제 성능 후속)은 전부 target 문서가 이미 "미구현(Planned)" · "남는 창" 등으로 정확히 반영하고 있어 **target 이 그 미해결 결정을 선점하거나 무시하는 사례는 없었다**. `4-integration.md`·`4-nodes/**` 를 향한 열린 항목들은 이번 target 스코프(1/2/3번 파일) 밖이라 판단 대상에서 제외했다.

## 요약

target(`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)의 현재 서술은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 누적해 온 결정들과 대체로 잘 맞는다 — 열린 항목들은 target 이 이미 "미구현/Planned"·"결정 필요"로 정직하게 남겨 둔 지점과 일치하고, 어느 것도 일방적으로 재단되지 않았다. 발견한 것은 CRITICAL 급 충돌이 아니라 문서 위생 수준의 두 가지 dangling 참조(완료 plan 을 계속 가리키는 `pending_plans`, 존재하지 않는 plan 이름을 인용하는 각주 — 후자는 이미 조치-안-함으로 처분됨)와, 이번 호출 자체의 target 스코프가 이 worktree 의 실제 작업(column-guard-gaps, 무관한 백엔드 컬럼 가드 테스트)과 맞지 않는다는 절차적 관찰이다.

## 위험도

LOW
