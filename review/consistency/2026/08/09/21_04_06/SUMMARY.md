# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. `spec/5-system/` 은 이번 diff(`origin/main...HEAD`)로 전혀 수정되지 않았고(backend hygiene 테스트/주석 위생 정리만), 직전 라운드에서 이미 확인된 WARNING 1건이 이월됐을 뿐 새로운 위배는 없다.

## 전체 위험도
**LOW** — Cross-Spec WARNING 1건(직전 라운드 이월, 미해결) 외에는 전부 NONE/INFO. 즉시 차단 사유 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 라운드에 CRITICAL 발견 자체가 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Agent Memory 리소스가 §3.2 RBAC 매트릭스에서 여전히 누락 (직전 라운드 `20_02_21` 이월, 미해결) | `spec/5-system/17-agent-memory.md` §6 (라인 120-123) | `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (라인 364-389) | `1-auth.md` §3.2 표에 `Agent Memory` 행 추가 + `17-agent-memory.md` §6 에서 §3.2 역참조. project-planner 권한(`spec/` 쓰기) — 반복 보고만 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `X-Workspace-Id` 3분기 에러코드(#1112) 신규 콘텐츠 검증 완료, cross-spec 모순 없음 | `3-error-handling.md §1.3`, `15-chat-channel.md §5.4`, `1-auth.md`/`data-flow/12-workspace.md` Rationale, `secret-store.md §2.1` | 재보고 불요, 참고용 기록 |
| 2 | rationale_continuity | 73건(subset)/142건(superset) 관계 설명이 코드 주석에만 있고 spec Rationale 에는 없음 | `workspace-reflection-canary.ts` 상단 주석 vs `data-flow/12-workspace.md` Rationale | `1-auth.md` 또는 `12-workspace.md` 에 "142건은 73건의 상위집합" 한 줄 추가 (project-planner 소관, 비차단) |
| 3 | convention_compliance / plan_coherence | `spec/conventions/secret-store.md §2.1` 각주("아직 실행 가능한 테스트 부재")가 이번 diff 신설 `test/secret-store-like-prefix.e2e-spec.ts` 로 인해 stale 해짐 | `spec/conventions/secret-store.md` §2.1 (target 밖) | `backend-lint-gate-broken-on-main.md` 에 이미 정확한 위치·대체 문구 초안이 planner 권한 항목으로 등재돼 있음 — 프로세스 정상 작동, 추가 조치 불요 |
| 4 | convention_compliance | `## Overview` 섹션 유무 파일별 편차 (직전 라운드와 동일, 변경 없음) | `2-api-convention.md` 등 6개 파일 (Overview 없음) | 조치 불요, "권장" 수준 |
| 5 | convention_compliance | `spec/5-system/` 전용 `0-overview.md` 부재 (직전 라운드와 동일, 변경 없음) | 디렉토리 전체 | 조치 불요, 기존 설계 |
| 6 | naming_collision | 신규 식별자(테스트 fixture 상수 7개, `secret-store-like-prefix.e2e-spec.ts`) 전수 확인 — 기존 컨벤션 준수, 동명이의 충돌 없음. 오히려 파일마다 흩어져 있던 워크스페이스 UUID 상수를 통합해 충돌 감소 방향 | `common/__test-utils__/workspace-id-fixtures.ts`, `test/secret-store-like-prefix.e2e-spec.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Agent Memory RBAC 매트릭스 누락 WARNING 1건(이월, 미해결). `X-Workspace-Id` 3분기 신규 서술 전수 검증 완료, 모순 없음 |
| rationale_continuity | NONE | spec 변경 0건인 순수 코드/테스트 위생 diff. 전체가 이미 병합된 `#1112` Rationale 이 지시한 정정(캐너리 앵커, 73/142 구분)을 그대로 이행. 기각된 대안 재도입·invariant 우회 없음 |
| convention_compliance | NONE | target(`spec/5-system/**`) 무변경. 이번 diff 가 건드린 영역(부트 캐너리, UUID 검증 비대칭, secret-store LIKE)이 기존 spec 서술과 합치. INFO 3건(그중 1건은 target 밖 stale 각주) |
| plan_coherence | LOW | target 은 diff 와 정합. `secret-store.md §2.1` 각주 stale화는 `backend-lint-gate-broken-on-main.md` 에 이미 정확히 추적됨 — role 경계가 정상 작동한 사례 |
| naming_collision | NONE | spec/ 변경 0건. 코드가 도입한 소수 신규 식별자(fixture 상수·e2e 파일명) 모두 기존 컨벤션 준수, 저장소 전역 동명이의 충돌 없음 |

## 권장 조치사항

1. (비차단) project-planner 턴에서 `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스에 `Agent Memory` 행을 추가하고 `17-agent-memory.md` §6 에서 역참조 — 직전 라운드부터 이월된 유일한 WARNING.
2. (비차단) 같은 planner 턴에서 `spec/conventions/secret-store.md §2.1` 각주를 "2026-08-09, `test/secret-store-like-prefix.e2e-spec.ts` 로 해소됨" 으로 갱신 — `backend-lint-gate-broken-on-main.md` 가 이미 정확한 대체 문구를 준비해 둠.
3. (선택) `1-auth.md` 또는 `data-flow/12-workspace.md` Rationale 에 "142건은 73건의 상위집합" 한 줄을 추가해 코드 주석과 spec 간 숫자 설명을 미러링(INFO, 재발 방지 목적).
4. 이 세 항목 모두 developer 권한 밖(`spec/` read-only)이므로 이번 push/턴 종료를 막지 않음 — 다음 planner 세션에서 일괄 처리 가능.