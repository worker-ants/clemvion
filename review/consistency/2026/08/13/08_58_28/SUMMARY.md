# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — spec 문서 변경 없는 순수 내부 방어 로직 하드닝(`idempotency.interceptor.ts`). Critical/신규 위반 0건, 기존에 추적 중이던 WARNING 1건(fail-open 서술 stale)만 재확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `spec/data-flow/15-external-interaction.md` 의 "전 경로 fail-open (warn)" 단일 축 프레이밍이, 이번 diff 로 코드가 더 정밀해진(5-path 구분, "미가용" 과 "손상"을 별개 실패 축으로 실체화) 뒤에도 그대로 남아 코드-spec 간극이 더 벌어짐 | `spec/data-flow/15-external-interaction.md:308` (§4 외부 의존 표), `:374-387` (§Rationale "Fail-open 정책의 일관 표기") | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스 docstring 5-path 표 + `isHttpStatusCode`/`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 캐시 손상 가드 | 신규 결함 아님 — `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 이미 "착수 가능"으로 표시해 둔 planner 턴 대기 항목. planner 턴에서 (a) §4 표를 "경로 1(기동 시 미주입) 제외 나머지 warn" 으로 좁히고 (b) §Rationale 을 "미가용 또는 캐시 엔트리·payload 손상 시 fail-open" 으로 확장하고 (c) §2.2 Redis 표 비고에 손상 엔트리 처리 문구 추가 — 세 자리 한 턴에 동시 반영 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 신규 `isHttpStatusCode`(읽기 시점 손상 방어)는 `isErrorStatusCacheable`(§R8 쓰기 시점 닫힌 목록 게이트)와 별개 층 — R8 이 금지한 "단일 비교로 열거 축약"에 해당하지 않음 | `idempotency.interceptor.ts` `isHttpStatusCode`(L397-403), `isIdempotencyEntry`(L377-385) | 조치 불필요. 기존 doc-comment(L46, L344-346, L397)가 이미 두 층의 경계를 명시 — 유지만 하면 됨 |
| 2 | convention_compliance | 캐시 손상 방어 로직(`isHttpStatusCode` 범위 검증)이 §2.2 Redis 표에 아직 기재되지 않음 — 규약 위반은 아니고 선택적 완결성 제안 | `spec/data-flow/15-external-interaction.md` §2.2 표 (`interaction:idempotency:<executionId>:<route>:<key>` 행) | 필수 아님. 반영 시 §2.2 해당 행 비고에 "손상 엔트리(예: 범위 밖 `statusCode`)는 무시하고 신규 처리" 한 문구 추가 — WARNING #1 반영 시 함께 처리 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | diff 는 `spec/**` 를 전혀 건드리지 않는 순수 방어 로직 강화. `spec/5-system/14-external-interaction-api.md` §R8/EIA-IN-11/EIA-RL-02 캐시 키 스코프·닫힌 대상 목록 계약과 정확히 일치, 위반 없음 |
| rationale_continuity | NONE | §R8 연속 하드닝 라운드의 마지막 잔여 갭(캐시 엔트리 `statusCode` 형태 이상 시 500 방지). 기각된 대안 재도입·합의 원칙 위반·invariant 우회 없음. INFO 1건(별개 층 확인, 조치 불요) |
| convention_compliance | NONE | API 표면·DTO·wire 포맷·에러 코드 불변. 명명(`UPPER_SNAKE_CASE`/camelCase)·문서 3섹션 구조·`error-codes.md`/`swagger.md` 규약 모두 준수. INFO 1건(선택적 문서 보강 제안) |
| plan_coherence | LOW | diff 는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크리스트 항목과 커밋 단위 1:1 대응(이미 완료 처리됨). WARNING 1건은 신규 결함이 아니라 이미 추적 중인 fail-open 서술 stale 항목의 재확인 |
| naming_collision | NONE | 신규 식별자 3개(`MIN_HTTP_STATUS_CODE`, `MAX_HTTP_STATUS_CODE`, `isHttpStatusCode`) 전부 module-private, 저장소 전역 검색 결과 동명 충돌 없음. spec 문서·API·이벤트·설정키 신규 도입 없음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음)
2. planner 턴에서 `spec/data-flow/15-external-interaction.md` §4 표 + §Rationale + §2.2 비고 세 자리를 한 번에 정정해 WARNING #1 해소 (`plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미 상세 설계됨, developer 권한 밖이므로 이 PR 자체는 수정 불요)
3. (선택) 위 정정 시 §2.2 행 비고에 캐시 손상 처리 한 문구를 함께 추가해 INFO #2 도 같이 해소
