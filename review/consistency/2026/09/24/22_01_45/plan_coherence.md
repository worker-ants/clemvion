# Plan 정합성 검토 — remove-member-order-coverage

## 검토 대상

- target: `plan/in-progress/remove-member-order-coverage.md` (developer, `removeMember` 판정 순서 커버리지 두 칸을 테스트로 고정, `spec_impact: none`)
- 근거 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` (동일 파일 내 다른 open 항목들과 대조)
- 선행 완료 plan: `plan/complete/member-auth-order.md`, `plan/complete/member-dup-remove.md` (실제 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `removeMember` 소스로 재검증)

## 발견사항

검토 관점 1(미해결 결정과의 충돌)·2(선행 plan 미해소)·3(후속 항목 누락) 세 축 모두에서 target 과 상충하는 항목을 찾지 못했다. 근거:

- **선행 plan 미해소 없음** — target 이 전제하는 `removeMember` 판정 순서(멤버십 → 대상 존재 → self 위임 → admin → owner)는 `plan/complete/member-auth-order.md`(2026-09-24 completed)가 이미 확정했고, 동시성 원자성(`affected===0` 판정)은 `plan/complete/member-dup-remove.md` 가 이미 닫았다. 실제 `workspaces.service.ts:814-887` 소스를 직접 읽어 이 순서와 원자적 `DELETE … WHERE role != 'owner'` 메커니즘이 그대로 구현돼 있음을 확인했다 — target 의 §A 실측 표(대상 부재 테스트의 요청자 = owner, 비-admin 테스트의 대상 = 실존 등)와 어긋나지 않는다.
- **미해결 결정 우회 없음** — 같은 트래커의 열린 항목 `경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못 받는다`(developer + 설계 결정, in-progress)는 `removeMember` 를 명시적으로 "이미 닫혔다" 며 그 12개 잔여 라우트에서 **제외**한다(`spec-draft-nullable-notation-followups.md:4970-4972`). target 은 서비스 계층 테스트만 추가하고 가드 계층·13-라우트 결정에는 손대지 않으므로 이 미해결 설계 결정과 충돌하지 않는다.
- **후속 항목 누락 없음(경계선 확인)** — 같은 트래커에 `removeMember` 관련 열린 planner 항목이 둘 더 있다: (a) `removeMember 리팩터로 낡은 spec 서술 세 줄`(`3-error-handling.md:46/49`, `1-auth.md:551`) (b) `removeMember 의 owner 보호 메커니즘을 data-flow/12-workspace.md 에 명문화`(`:141` 인근). 둘 다 target 이 다루는 "테스트 커버리지 두 칸"과는 축이 달라(spec 문서 갱신 vs 테스트 추가) target 이 이를 무효화하거나 새로 만들지 않는다. 이미 별도 항목·소유자(planner)로 트래커에 등재돼 있어 target 이 이를 흡수하거나 누락시킬 필요가 없다.
- **spec 변경 없음 확인** — target 은 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 에만 테스트를 추가하는 순수 커버리지 작업이며 `spec/` 파일을 건드리지 않는다(`spec_impact: none`이 실제로 정확하다). 위 두 planner 항목이 여는 spec 갱신 범위와 겹치지 않는다.
- target §A 의 사실 확인(현재 테스트 스위트에 대상-부재×비-admin 조합, 요청자 조회 횟수 단언이 없다는 실측)도 `workspaces.service.spec.ts` 를 직접 grep 해 재확인했다 — 세 개의 기존 순서 테스트(`비-멤버는 대상을 조회하기 전에…`, `비-admin 도 자기 자신이면 위임된다…`, `비-admin 이 owner 를 지목하면…`)만 있고, target 이 채우려는 두 조합(대상 존재→admin, 요청자 role 1회 조회)은 실제로 없다.

## 요약

target(`remove-member-order-coverage.md`)은 이미 완료된 두 선행 plan(`member-auth-order.md`, `member-dup-remove.md`)이 확정한 `removeMember` 판정 순서·원자성 위에서 테스트 커버리지 두 칸만 채우는 좁은 범위의 작업이며, 실제 소스 코드로 그 전제를 재검증해도 어긋남이 없다. 같은 트래커에 남아 있는 `removeMember` 관련 다른 미해결 항목(가드 13-라우트 설계 결정, spec 서술 갱신 두 건)은 target 이 명시적으로 다루지 않는 별도 축이며, target 이 이들을 무효화·중복·차단하지도 않는다. Plan 정합성 관점에서 이 target 은 충돌·누락 없이 착수 가능하다.

## 위험도
NONE
