# Plan 정합성 검토 — spec/2-navigation/ (impl-done, diff-base=origin/main)

## 발견사항

### [WARNING] 완료 plan `workspace-slug-routing.md` 의 Gate C `spec_impact` 미선언 — 빌드 가드 현재 FAIL
- target 위치: `spec/2-navigation/*`(0-dashboard·1-workflow-list·10-auth-flow·11-error-empty-states·14-execution-history·15-system-status·16-agent-memory·2~7·9-user-profile·_layout) + 부수 `spec/data-flow/12-workspace.md`·`spec/data-flow/13-agent-memory.md`·`spec/3-workflow-editor/4-ai-assistant.md`·`spec/4-nodes/7-trigger/providers/{discord,slack}.md`·`spec/5-system/{1-auth,13-replay-rerun,15-chat-channel}.md`·`spec/7-channel-web-chat/{5-admin-console,_product-overview}.md`·`spec/conventions/{spec-impl-evidence,user-guide-evidence}.md`
- 관련 plan: `plan/complete/workspace-slug-routing.md`(commit `dc1b28d48` "mark complete" / `38380cb67` 체크박스 반영) — 본 target 변경 전체가 이 plan 의 구현 산출물
- 상세: `.claude/docs/plan-lifecycle.md` §4/§5 Gate C 는 `complete/` 이동 시 frontmatter 에 `spec_impact`(spec path 리스트 또는 `none`) 선언을 의무화하며, `started: 2026-07-08`(2026-06-04 이후)이라 grandfather 면제 대상도 아니다. 그러나 해당 plan frontmatter 에는 `spec_impact` 필드 자체가 없다. 실제로 `pnpm --filter frontend test -- spec-plan-completion` 실행 결과 **`plan/complete/workspace-slug-routing.md > declares spec_impact` 1건 FAIL**(나머지 5112 pass/1 skip)로 재현 확인함 — ai-review round4(commit `865e6b939`, 전량 pass 기록)**이후에** 만들어진 "mark complete" 커밋(`dc1b28d48`)에서 새로 생긴 회귀라 어떤 리뷰 라운드도 아직 못 잡았다.
- 제안: `plan/complete/workspace-slug-routing.md` frontmatter 에 `spec_impact:` 리스트로 위 target 변경 spec 경로 전체(bare string 금지, 반드시 YAML 리스트)를 추가하고 로컬에서 `spec-plan-completion` 테스트 재확인 후 커밋(같은 PR 내, 별도 plan-이동 PR 금지 원칙 §3).

### [WARNING] `spec-sync-user-profile-gaps.md` 의 `workspace-slug-routing.md` 경로 참조가 이동으로 인해 stale
- target 위치: (target 자체 변경은 아니며, target 구현 완료가 유발한 파생 stale)
- 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md:25` — `... **frontend 완료** (\`plan/in-progress/workspace-slug-routing.md\`, phase 1): ...`
- 상세: 참조하는 `workspace-slug-routing.md`는 이번 target 구현 완료로 `plan/in-progress/`에서 `plan/complete/`로 이동했다(`dc1b28d48`). in-progress 상태의 다른 plan(`spec-sync-user-profile-gaps.md`)이 옛 in-progress 경로를 그대로 인용해 dangling 경로가 됐다 — 과거에도 반복된 패턴("spec body plan 링크도 complete 경로 갱신 필수" 교훈)과 동일 유형.
- 제안: `spec-sync-user-profile-gaps.md:25`의 경로를 `plan/complete/workspace-slug-routing.md`로 갱신.

### [INFO] phase 2(에디터 slug화)·ai-review 하드닝 후속이 in-progress plan 으로 등록되지 않음
- target 위치: `spec/2-navigation/9-user-profile.md §3`("phase 1 범위 밖(slug 무관): 에디터(`/workflows/[id]`)... slug화는 phase 2"), `_layout.md §2.2/§3.1` 각주
- 관련 plan: `plan/complete/workspace-slug-routing.md`의 "잔여(후속, 본 PR 범위 밖)" 절 + `review/code/2026/07/09/08_39_36/RESOLUTION.md`의 "후속 트랙"(에디터 phase 2, `useWorkspaceRouter()`/ESLint 룰, `buildExecutionHref` 헬퍼 통합, `WORKSPACE_ROUTE_PREFIX` 상수화 등)
- 상세: 두 문서 모두 defer 항목을 텍스트로만 기록했고, 어느 `plan/in-progress/*.md` 에도 별도 추적 항목으로 등록돼 있지 않다. 프로젝트 관례상 완료 plan 의 "잔여" bullet 로 충분히 인정되는 선례가 다수 있어 즉시 조치가 필요한 수준은 아니나, 착수 시점이 오면 새 in-progress plan(예: `workspace-slug-routing-phase2.md`)으로 승격해야 유실을 막는다.
- 제안: 현재는 조치 불요(추적 메모로 인지). 실제 phase 2 착수 시 `plan/in-progress/` 신규 파일로 승격.

## 요약
target(`spec/2-navigation/`)이 반영한 워크스페이스 슬러그 라우팅 구현은 `plan/complete/workspace-slug-routing.md`(구 in-progress, 이번 세션에 완료·이동)의 산출물과 문서 내용상 정합하며, 확인한 다른 `plan/in-progress/**` 항목(`spec-sync-workflow-list-gaps.md`·`spec-sync-auth-gaps.md`·`spec-sync-websocket-protocol-gaps.md` 등)과 충돌하는 미해결 결정 우회는 발견되지 않았다. 다만 (1) 그 완료 plan 자체가 Gate C `spec_impact` 프론트매터 미선언으로 `spec-plan-completion.test.ts` 를 실제로 FAIL 시키고 있고(재현 확인, ai-review 라운드 이후 신규 회귀), (2) 자매 in-progress plan(`spec-sync-user-profile-gaps.md`)의 경로 참조가 plan 이동으로 stale 해졌다 — 둘 다 문서·frontmatter 갱신만으로 해소되는 경미한 갭이라 target 코드 자체의 재작업은 불요하다.

## 위험도
MEDIUM
