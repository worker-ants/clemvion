# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 6건(모두 비차단성: 기존 권한순서 부채 재확인, e2e 테스트 위생 3건, CHANGELOG 누락 재발, 극히 좁은 창의 에러코드 오보). `forced`(router_safety) 7개 reviewer 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `CHANGELOG.md`에 이번 owner TOCTOU 수정 항목이 없다 — **같은 함수**(`removeMember`, #1373)가 이미 한 번 CHANGELOG 누락으로 지적받아 backfill된 전례가 있고, 그 backfill 항목이 "이 PR이 닫지 않는다"고 명시했던 사안을 정확히 이번 PR이 닫았는데도 재발했다 | `CHANGELOG.md`(diff 없음); 관련 커밋 `7c7910504`, `235d03e2c` | plan 체크리스트("트래커 해소 + complete/ 이동")에 CHANGELOG 항목 추가를 포함시키고, `#1373` 항목의 "남는 것" 서술을 해소로 갱신 |
| 2 | 보안 (권한순서) | `removeMember()`의 owner 조기 가드가 `assertAdmin`/멤버십 검사보다 먼저 실행돼, **워크스페이스 비-멤버를 포함한** 임의 인증 사용자도 대상이 owner인지 여부를 오라클처럼 알아낼 수 있다(이번 diff가 만든 결함 아님, 리팩터 전부터 존재) | `workspaces.service.ts:815-827` | 기존 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md` §F)의 서술을 "비-admin 멤버"에서 "비-멤버 포함 임의 인증 사용자"로 넓혀 블라스트 반경을 정정하고, `assertAdmin`을 owner 조기 가드보다 먼저 두는 순서 반전을 처방으로 등재(`updateMemberRole`은 이미 이 순서) |
| 3 | 동시성 | `affected === 0` 이후 무락 재조회가 "존재+owner"/"부재" 두 갈래만 판별하고, 이중 연쇄 이양이라는 극히 좁은 창에서 발생하는 "존재+owner 아님"(제3 상태)을 다루지 않아 실재하는 멤버를 404로 잘못 보고할 수 있다 | `workspaces.service.ts:859-868` | 제3 분기를 명시적으로 처리(또는 최소 단위 테스트로 고정)하고, 현재 주석("어느 답이든 정당")에 이 분기가 언급되지 않은 점 보완 |
| 4 | 테스트 위생 / 부작용 | 신규 e2e 재진입 테스트가 raw SQL(`UPDATE ... SET role='owner'`)로 공유 workspace에 **owner 2명**이라는 애플리케이션 코드로는 도달 불가능한 상태를 영구 커밋하고, "파일 마지막이어야 한다"는 순서 불변식이 주석 하나로만 강제된다 — 향후 이 파일에 새 `it`이 추가되면 조용히 오염된 상태를 물려받는다 | `member-remove-concurrency.e2e-spec.ts:183-286`(특히 raw UPDATE `:254`) | 이 테스트만 전용 workspace를 새로 생성(`createTeamWorkspace`)해 공유 상태를 건드리지 않게 하거나, 종료 시 role 원상복구 cleanup 추가 |
| 5 | 유지보수성 / 테스트 | 공허성 가드 타임아웃 `1_500`이 "두 자리에 적으면 한쪽이 낡는다"고 스스로 선언한 중앙 상수 `VACUITY_GUARD_MS`(`test/helpers/concurrency.ts`)를 두고도 **세 번째로** 하드코딩됨(해당 상수가 `export`되지 않아 재사용 불가) — `assertGuardBelowKnownTimeouts`의 중앙 검증 범위 밖이라 락 타임아웃이 늘어도 조용히 안전 마진을 잃을 수 있다 | `member-remove-concurrency.e2e-spec.ts:247` (기존 중복: `integration-rotate-concurrency.e2e-spec.ts:118`) | `VACUITY_GUARD_MS`를 `concurrency.ts`에서 `export`하고 재진입 테스트 파일들이 import해 재사용 |
| 6 | 유지보수성 | 재진입 락 오케스트레이션(BEGIN→`FOR UPDATE`→발사→공허성가드→mutate→COMMIT→finally 드레인) 보일러플레이트가 `integration-rotate-concurrency.e2e-spec.ts`와 거의 동일하게 **두 번째로** 손으로 복제됨(plan이 선례를 스스로 인용) | `member-remove-concurrency.e2e-spec.ts:224-267` | 세 번째 유사 사례가 나오면 `reenterUnderHeldLock`류 헬퍼로 추출한다는 기준을 트래커에 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 / DB | `affected===0` 이후의 무락 재조회는 데이터 정합성(실삭제 여부)에 영향 없이 **에러 코드 선택**에만 관여 — plan에서 트랜잭션+비관적 락 대안을 실측 근거로 명시적으로 기각한 의도된 트레이드오프 | `workspaces.service.ts:862-868` | 조치 불요 |
| 2 | DB / 동시성 | TOCTOU 원자성 보장이 Postgres 고유 EvalPlanQual 재평가(표준 SQL 아님)에 의존 — 재진입 e2e가 실 DB로 결정론적으로 검증 | `workspaces.service.ts:844-858` | DB 엔진 교체 계획이 생기면 재검증 |
| 3 | 테스트 / DB | `criteria.role.type`/`.value`로 TypeORM `FindOperator` 내부 표현을 직접 검사 — 의도적 선택(주석에 근거 명시), e2e가 SQL 렌더링 오라클로 이중 고정 | `workspaces.service.spec.ts:1509-1515` | 조치 불요 |
| 4 | 동시성 | `transferOwnership()`의 기존(이번 diff 대상 아님) 독스트링이 "단일 IN 쿼리로 동시 락"이라 서술하지만 실제는 순차 개별 `pessimistic_write` — 이번 PR의 원자성 근거는 이 mismatch에 영향받지 않음 | `workspaces.service.ts:716-717` vs `745-767` | 별도로 독스트링 정정 고려(이번 PR 스코프 아님) |
| 5 | 문서화 | `CANNOT_REMOVE_OWNER`가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 미등재 — 기존 갭이며 이미 별도 planner 트래커 항목으로 등재됨 | `spec/5-system/3-error-handling.md` §1 | 중복 지적 아님, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 기존 권한검사 순서 오라클 재확인 — 트래커 서술의 블라스트 반경이 실제보다 좁게 적혀 있음 |
| requirement | NONE | 요구사항 충족, spec-drift 없음. INFO 2건(재조회 무락 창, 순서 오라클) 모두 별도 트래커 항목으로 이미 분리 |
| scope | NONE | 8개 관점 전수 확인, 문제 없음 — codebase 변경 3파일 전부 owner TOCTOU 의도에 직접 대응 |
| side_effect | LOW | e2e가 raw SQL로 owner 2명 상태를 영구 커밋, 순서 의존이 주석에만 의존 |
| maintainability | LOW | 상수 중복(3번째 자리), 재진입 보일러플레이트 중복(2번째 자리), 순서 불변식 주석 의존 |
| testing | LOW | `VACUITY_GUARD_MS` 중복 하드코딩, 공유 workspace 오염(테스트 관점 재확인) |
| documentation | LOW | CHANGELOG 누락 — 같은 함수에서 재발(1373 backfill 전례 있음) |
| database | LOW | 결함 없음, 설계 트레이드오프 3건만 INFO |
| concurrency | LOW | 재조회 제3분기(존재+owner 아님) 미처리로 극히 좁은 창에서 에러코드 오보 가능 |
| user_guide_sync | NONE | 매칭 trigger 없음(glob이 `modules/auth/**`로 국한, `modules/workspaces/**`와 불일치) — 유저 가이드/스펙 카탈로그 동반 갱신 불요 |

## 발견 없는 에이전트

- scope — 8개 점검 관점 전수 확인, 문제로 볼 항목 없음
- user_guide_sync — 매칭되는 doc-sync-matrix trigger 없음

## 권장 조치사항

1. `CHANGELOG.md`에 이번 owner-TOCTOU 수정 항목을 추가하고 `#1373` 항목의 "미해결" 서술을 해소로 정정한다(같은 함수에서 CHANGELOG 누락이 재발하지 않도록).
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` §F의 "권한 검사 순서 오라클" 항목 서술을 "비-admin 멤버"에서 "비-멤버 포함 임의 인증 사용자"로 넓혀 실제 블라스트 반경을 반영하고, 처방(assertAdmin을 owner 조기 가드보다 먼저)을 명확히 등재한다.
3. `affected===0` 재조회의 "존재+owner 아님" 제3 분기를 명시적으로 처리하거나 최소한 이를 고정하는 단위 테스트를 추가한다.
4. 신규 e2e 재진입 테스트가 공유 workspace를 영구 오염시키는 문제를 구조적으로 해결한다(전용 workspace 생성 또는 cleanup) — "파일 마지막이어야 한다"는 주석 의존 불변식을 없앤다.
5. `VACUITY_GUARD_MS`를 `export`하여 재진입 e2e 파일들이 재사용하도록 하고, 재진입 락 오케스트레이션 보일러플레이트가 세 번째로 반복되면 공용 헬퍼로 추출한다는 기준을 트래커에 남긴다.

이번 PR 자체(`removeMember()`의 조건부 원자 `DELETE ... WHERE role != 'owner'` + `affected` 재해석)는 실제 TOCTOU 데이터 무결성 취약점을 정당하게 닫았고, 모든 reviewer가 이 핵심 변경 자체에는 결함을 찾지 못했다. 위 WARNING들은 이번 diff가 새로 만든 결함(#3, #4, #5, #6)과 이미 알려진 채 재확인된 기존 부채(#1, #2)가 섞여 있으며, 어느 것도 병합을 막을 CRITICAL 사유는 아니다.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨**, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경 범위(단일 PK 조건부 DELETE, 신규 인프라·대량 데이터 처리 없음)와 무관 |
  | architecture | router 판단상 아키텍처 구조 변경 없음(기존 메서드 내부 로직 수정) |
  | dependency | router 판단상 신규 의존성 추가 없음(기존 TypeORM API `Not` 재사용) |
  | api_contract | router 판단상 API 응답 형태·엔드포인트·에러 코드 변경 없음 |