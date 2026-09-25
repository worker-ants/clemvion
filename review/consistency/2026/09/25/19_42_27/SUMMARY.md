# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 모두 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — Cross-Spec/Rationale/Convention/Naming 4개는 NONE, Plan Coherence 만 문서 동기화 지연으로 LOW.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 트래커(`spec-draft-nullable-notation-followups.md` line 5001-5002)가 "2026-09-25 — 닫힘. `plan/complete/workspace-guard-followups.md` — 다섯 건 모두 처리"라고 이미 완전 종결된 것처럼 서술하지만, 실제로는 `workspace-guard-followups.md` 가 아직 `plan/in-progress/`에 있고 자신의 체크리스트(`TEST WORKFLOW`·`/ai-review`·`--impl-done(...)`·`트래커 항목 닫기` 4개)가 전부 `[ ]` 미체크 상태 | `plan/in-progress/spec-draft-nullable-notation-followups.md` line 5001-5002 및 `plan/in-progress/workspace-guard-followups.md` 체크리스트 | 저장소 실제 상태(파일 위치·체크박스) | 이번 `--impl-done`(BLOCK: NO) 확인 후 같은 세션에서 (a) `workspace-guard-followups.md` 남은 4개 체크박스를 실제 수행 순서대로 체크, (b) 파일을 `plan/complete/workspace-guard-followups.md` 로 이동 — 체크와 이동을 동일 마무리 커밋 시퀀스에서 함께 처리해 트래커 서술과 저장소 상태를 일치시킬 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `5-system/1-auth.md` §Rationale 의 `ADMIN_ROLES = new Set(['owner', 'admin'])` 리터럴 인용이 현재 구현(서열 파생)과 문구만 다름(값은 동일, 결론 유효) | `spec/5-system/1-auth.md` §Rationale (2026-07-28 정정 근거 기록) | 다음에 이 절을 편집할 기회가 있으면 "(2026-09-25 이후 서열 파생으로 리팩터, 값 동일)" 각주 추가. 이번 PR 이 별도로 손댈 필요 없음(spec_impact: none 범위 밖) |
| 2 | Cross-Spec | plan `--impl-done` spec 연결 목록에 남은 `redis-keys` 항목이 이번 diff 스코프와 무관해 보임 (impl-prep 에서도 동일 지적) | `plan/in-progress/workspace-guard-followups.md` 체크리스트 spec 연결 목록 | `--impl-done` 실행 시 연결을 빼거나 의도를 명시. 차단 사유 아님 |
| 3 | Rationale Continuity | `throwOwnerTransferRequired` 커스텀 메시지가 가드의 `ROLE_REQUIRED.owner.message` 와 다름 — 결정 번복 아니라 기존 동작을 스프레드로 가시화한 것, plan 뮤턴트 U1·unit 주석이 근거를 명시 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `throwOwnerTransferRequired` | 조치 불필요. 다음 "가드 거부의 오류 코드" 절 갱신 시 "(도메인 고유 재검사 메시지는 예외)" 구절 추가 고려 |
| 4 | Rationale Continuity | reflection 골격 추출(`routeArgEntriesMatching`)이 부트 캐너리 불변식("판별 함수를 그대로 호출")을 우회하지 않음을 직접 확인 | `codebase/backend/src/common/decorators/workspace.decorator.ts` / `workspace-reflection-canary.ts` | 없음 — 확인 기록 |
| 5 | Convention Compliance | `transferOwnership` docstring 정정이 커밋 SHA(`eb009f99c`)로 실측 근거를 남긴 모범 사례 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` JSDoc | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | impl-prep W1(부트 캐너리 불변식) 해소 확인, `ADMIN_ROLES` 공용화 값 일치. INFO 2건(historical 리터럴 표류, redis-keys 연결 무관성) |
| Rationale Continuity | NONE | 6개 Rationale 불변식 모두 유지. INFO 2건(owner 이양 메시지 차이는 기존 동작 가시화, reflection 골격 안전 확인) |
| Convention Compliance | NONE | 명명·출력 포맷·문서 구조·Swagger·금지 패턴 5축 위반 없음. `ADMIN_ROLES` 동명이인 완전 해소. INFO 1건(docstring 실측 정정 모범 사례) |
| Plan Coherence | LOW | 구현 diff 는 plan 요구 5건 전부 반영, 선행 plan 불변식 유지. WARNING 1건(트래커 종결 서술이 실제 plan 상태보다 앞섬) |
| Naming Collision | NONE | 신규 식별자 2개(`RouteArgEntry`, `routeArgEntriesMatching`) 모두 파일-로컬, 전수 grep 충돌 없음. `ADMIN_ROLES` 통합은 오히려 기존 동명이인 충돌 해소 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — BLOCK: NO) 이번 `--impl-done` 통과 후 같은 세션에서 `plan/in-progress/workspace-guard-followups.md` 의 남은 체크박스 4개를 실제 순서대로 체크하고 `plan/complete/workspace-guard-followups.md` 로 이동 — 트래커의 "닫힘" 서술과 저장소 상태 불일치(WARNING 1) 해소.
2. 다음 spec 편집 기회에 `spec/5-system/1-auth.md` §Rationale 의 `ADMIN_ROLES` 리터럴 인용에 서열 파생 전환 각주 추가(INFO 1, 우선순위 낮음, 이번 PR 범위 밖).
3. `--impl-done` spec 연결 목록에서 `redis-keys` 항목의 관련성을 명시하거나 제거(INFO 2, 차단 사유 아님).
