# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL/구조적 위반 없음. 유일한 발견은 plan_coherence 의 WARNING(사후 체크박스 미갱신) 1건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `backend-lint-gate-broken-on-main.md` L561 체크박스가 이번 구현 착지(3-세그먼트 캐시 키 스코프)를 반영 못 해 미완료로 오독될 수 있음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (redisKey 조립부) 및 동반 unit/e2e(`IDEM-4`/`IDEM-5`) | `plan/in-progress/backend-lint-gate-broken-on-main.md:561` | L561 체크박스를 `[x]` 로 전환하고 "구현 완료(`eia-r8-cache-scope-4ae434`) — 3-세그먼트 스코프(`executionId:route:rawKey`)로 착지, e2e `IDEM-4`/`IDEM-5` 로 관측" 메모 추가. L594/L602/L617 등 target 범위 밖 항목은 그대로 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | R8 Rationale 이 기각한 두 대안(전역 키 fallback, jti/토큰 단위 스코프)을 코드·테스트가 회귀 테스트로 캐너리화 — 모범 사례 | `idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`, `external-interaction.e2e-spec.ts` (IDEM-4/IDEM-5) | 조치 불필요 |
| 2 | rationale_continuity | data-flow 문서(`15-external-interaction.md`)와 5-system spec(`14-external-interaction-api.md`)의 R8 서술 상호 정합, 구 키 형식 잔존 참조 없음 | `spec/data-flow/15-external-interaction.md` §1.2/§2.2 | 조치 불필요 |
| 3 | naming_collision | 동일 캐시 키 포맷을 조립하는 테스트 헬퍼 이름이 unit(`scopedKey`)과 e2e(`idempotencyCacheKey`)에서 다름 — 충돌은 아니나 세 번째 소비처 등장 시 포맷 drift 위험 | `idempotency.interceptor.spec.ts:81-89`, `test/external-interaction.e2e-spec.ts:129-136` | 지금은 병합 불요. 세 번째 소비처가 생기면 공용 test-util 로 승격하거나 양쪽 docstring 의 상호 참조 주석 유지 |
| 4 | naming_collision | 이전 라운드(19_56_51) WARNING — `<endpoint>` vs `endpointPath` 혼동 — 최종 구현이 `<route>` 채택하며 해소 확인 | `spec/data-flow/15-external-interaction.md:258`, `idempotency.interceptor.ts:121` | 조치 불필요(해소 확인만) |
| 5 | cross_spec | `spec/5-system/14-external-interaction-api.md` 는 orchestrator 번들에서 예산 초과로 생략되었으나 직접 Read/grep 으로 별도 확인 완료 | 세션 접근 제약 메모 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 교차 지점 모두 spec(§R8·EIA-IN-11·EIA-RL-02)과 정합. spec 파일 변경 없는 code-only PR |
| rationale_continuity | NONE | 선행 PR 에서 이미 확정된 R8 Rationale 의 기각 대안 2건을 코드가 재도입하지 않고 오히려 회귀 테스트로 고정 |
| convention_compliance | NONE | 명명(Redis 키·에러 코드)·문서 구조·frontmatter 면제·swagger 규약 5개 관점 위반 없음 |
| plan_coherence | LOW | `spec-draft-eia-idempotency-key-scope.md` 결정과 완전 정합 구현. 다만 원 지적 등재처(`backend-lint-gate-broken-on-main.md`)의 체크박스가 미갱신 |
| naming_collision | NONE | 신규 요구사항 ID/엔티티/API/이벤트명 없음. 테스트 헬퍼 이명(異名) 1건은 INFO 수준. 이전 라운드 WARNING(`<endpoint>`)은 해소 확인 |

## 권장 조치사항
1. `plan/in-progress/backend-lint-gate-broken-on-main.md` L561 체크박스를 `[x]` 로 전환하고 이번 구현(3-세그먼트 캐시 키 스코프, PR/브랜치 `eia-r8-cache-scope-4ae434`)을 완료 메모로 남길 것. (BLOCK 사유 아님 — merge 전 정리 권장)
2. (선택) 테스트 헬퍼 `scopedKey`/`idempotencyCacheKey` 이명은 지금 통일할 필요 없음. 세 번째 소비처가 생기는 시점에 공용 test-util 승격 검토.
