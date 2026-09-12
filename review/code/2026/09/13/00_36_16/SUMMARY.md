# Code Review 통합 보고서

## 전체 위험도
**LOW** — keyset 커서(`login-history`, `background-runs`)의 id 성분에 `isUuidShaped` 형태 검증을 추가해 Postgres SQLSTATE 22P02(→500 마스킹)를 막는 방어적 수정. Critical 없음, SQL 인젝션·인가 우회·신규 의존성 위험 없음. WARNING 5건은 전부 CHANGELOG 문서 보강·테스트 보일러플레이트 정리 수준이며 코드 로직 변경은 불요. 강제(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 누락된 forced reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `login-history`(무시→200)와 `background-runs`(400 `INVALID_CURSOR`)가 같은 결함 클래스(id 성분 uuid-shape 아님)에 대해 서로 다른 실패 계약을 유지하며, 이번 diff가 각자의 기존 계약에 검증을 추가해 비대칭을 굳힌다. `spec/5-system/2-api-convention.md §8.2` 단일 표준과 어긋나지만 예외 각주 없음. | `codebase/backend/src/modules/auth/login-history.service.ts:61` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` | 코드 변경 불요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목(§8.2 예외 각주 또는 계약 통일)으로 등재됨. 이 PR을 막을 사유 아님. |
| 2 | 문서화 / 부작용 | `background-runs.service.ts`에서 커서 검증이 소유권 검사보다 먼저 돌아, "타 워크스페이스 + 형태 오류 커서" 조합의 응답이 404→400으로 바뀌는 관측 가능한 동작 변화가 CHANGELOG의 "⚠️ 배포 시 확인" 절에서 빠짐(500→200/500→400 전환만 기재). | `CHANGELOG.md:17-20` / 근거: `background-runs.service.spec.ts:657-679` (신규 순서 테스트) | CHANGELOG에 "타 워크스페이스 요청이 형태 오류 커서를 함께 보내면 404 대신 400이 될 수 있다(정보 누설 아님)" 한 줄 추가. |
| 3 | 문서화 | CHANGELOG 같은 항목 안에서 spec 경로 표기가 `spec/data-flow/12-workspace.md §"..."` (전체 경로)와 `3-error-handling.md §1` (파일명만)으로 섞여 있음 — 기존 CHANGELOG 관행(항상 `spec/5-system/...` 전체 경로)과 불일치. | `CHANGELOG.md:23` | `3-error-handling.md §1` → `spec/5-system/3-error-handling.md §1`로 통일. |
| 4 | 유지보수성 | 신규 테스트 5곳(`background-runs.service.spec.ts` 3곳, `background-monitoring.e2e-spec.ts` 2곳)이 커서 base64/JSON 인코딩 보일러플레이트를 헬퍼 없이 각자 인라인 반복. 프로덕션 쪽엔 이미 `encodeCursor`가 있으나 private이라 테스트가 재사용 못 함. | `background-runs.service.spec.ts:643-646,666-669,715-718` / `background-monitoring.e2e-spec.ts:291-294,307-313` | 작은 테스트 헬퍼(`makeCursor(s, i)`)를 추출해 5곳 교체. 순수 보일러플레이트 추출이라 위험 낮음. |
| 5 | 유지보수성 | `isUuidShaped` JSDoc(43줄)이 함수의 "기술 계약"과 날짜·리뷰 세션 폴더명·라운드 번호를 인용하는 "감사 로그성 산문"을 한 곳에 누적시켜, 다음 사람이 계약을 파악하려면 리뷰 아카이브 인용을 먼저 헤쳐야 함. 라운드가 늘 때마다 문단이 계속 늘어나는 구조. | `codebase/backend/src/common/utils/uuid.ts:16-58` | 함수 계약만 JSDoc에 남기고 정정 이력·리뷰 지적 이력은 `plan/in-progress/keyset-cursor-uuid-validation.md`로 옮겨 링크만 남기는 것을 고려(강제는 아님 — 저장소 전반의 기존 관행과 정도 차이 문제). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | SQLSTATE 22P02 마스킹 결함 클래스에 대한 전역/정적 가드가 없어, 향후 감사되지 않은 제3의 커서 디코더가 같은 실수를 반복해도 컴파일/린트가 못 잡음. 의도적으로 만들지 않기로 한 트레이드오프(plan 문서에 근거 기록). | `codebase/backend/src/common/utils/uuid.ts` JSDoc / `plan/in-progress/keyset-cursor-uuid-validation.md` §"가드는 만들지 않는다" | 조치 불요. 소비처가 4곳 이상으로 늘면 정적 스캐너 재고. |
| 2 | 아키텍처 | `isUuidShaped` 소비처-회귀캐너리 1:1 불변식이 CI 도구가 아니라 산문(JSDoc + grep 안내)으로만 유지됨. population(현재 3)이 늘수록 stale해질 구조적 소지. | `uuid.ts:16-58`, `uuid.spec.ts:49-77` | 이미 인지·트레이드오프로 기록됨(population 2~3에서는 비용 대비 낮음). 지금 라운드 조치 불요. |
| 3 | 아키텍처/유지보수성 | `login-history`(파이프 구분 인코딩, 모듈 함수)와 `background-runs`(base64 JSON, private 클래스 메서드)의 `decodeCursor`가 손으로 각각 중복 구현되어 있음(검증 로직만 `isUuidShaped` 재사용으로 공유). | `login-history.service.ts:45-63` / `background-runs.service.ts:149-188` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3186-3189`에 등재. 계약 통일 결정 선행 필요 — 이번 diff 범위 밖. |
| 4 | 테스팅 | `login-history.service.ts`의 신규 가드에서 커서 id 성분이 빈 문자열인 경계는 상위 `!id` 체크에 가려 명시적으로 테스트되지 않음. | `login-history.service.ts` `decodeCursor` (61행) / `login-history.service.spec.ts:193-203` | 필수 아님. `cursor: '...|'(id 공백)` 케이스 한 줄 추가 시 두 가드의 경계가 테스트로도 명시됨. |
| 5 | 테스팅 | `background-runs.service.spec.ts`의 "커서 검증이 소유권 검사보다 먼저 돈다" 테스트는 순서가 뒤바뀌면 의도된 assertion 불일치가 아니라 `TypeError`(undefined.leftJoin)로 실패해 진단이 한 단계 간접적. | `background-runs.service.spec.ts:657-679` | 조치 불요. 주석에 "실패 시 TypeError면 순서 회귀" 참고 문구 추가 고려. |
| 6 | 요구사항/API계약 | Background Runs REST 에러 코드 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 미등재. 이 diff가 새로 만든 코드 아님, 기존 갭. | `background-runs.service.ts` catch 블록 전반 | 이미 `--impl-prep` consistency-check로 포착돼 planner 항목 등재됨. 조치 불요. |
| 7 | 부작용 | `isUuidShaped`가 원래 인가(워크스페이스 헤더 vs 경로 파라미터) 컨텍스트용 술어였는데, 이번 diff로 인가와 무관한 축(커서 id 성분)까지 소비처가 확장되어 공유 유틸의 신뢰 경계 폭이 넓어짐. 함수 동작 자체는 무변경. | `login-history.service.ts:61`, `background-runs.service.ts:178` | 이미 plan §B 각주로 다뤄짐. 향후 이 함수 판정 로직을 바꾸면 인가 경로와 커서 파싱 경로가 동시 영향받는다는 점만 인지. |

## 확인했으나 문제 없음 (전체 reviewer 공통 양성 확인)

- SQL 인젝션: 모든 바인딩이 TypeORM named parameter, 문자열 결합 없음(security, database).
- 검증이 DB 호출 전 순수 함수 단계에서 수행되어 불필요한 DB 라운드트립·드라이버 에러를 오히려 줄임(performance, database).
- `isUuidShaped`는 Postgres `uuid` 컬럼의 실제 파싱 규칙(버전/variant 무관)과 정확히 일치 — 과잉 제약으로 정상 값(nil UUID 등)을 걷어차지 않음(database, requirement, api_contract).
- 신규 외부 패키지·버전 변경 없음, 내부 의존 방향(feature module → common/utils)도 기존 계층 규약과 일치, 순환 없음(dependency).
- 동시성 표면 없음 — 전부 동기 함수, 신규 락/워커/큐 없음(concurrency).
- 커서 검증이 소유권 검사보다 먼저 걸려도 형태만으로 거부해 리소스 존재 여부를 구별하지 않으므로 IDOR/enumeration 관점 정보 누설 아님(security, side_effect, api_contract).
- 소비처·모집단·grep 재현 명령을 독립 재실측 — plan/JSDoc의 "정확히 3곳" 주장과 정확히 일치, 3라운드 전 지적된 grep 필터 결함도 해소 확인(requirement, documentation).
- 뮤테이션 검증: plan 문서 6/6 + 리뷰어 독립 재현 1/1(가드 제거 → 신규 테스트 1건만 RED) 전부 예측과 일치(testing).
- `codebase/frontend/**`, `spec/**` 변경 0건 — 유저 가이드/i18n 동반 갱신 대상 아님. semantic 매칭 후보 2건(`auth-session-flow-change`, `run-debug-flow-change`)도 문서 본문 grep 대조 결과 서술 자체가 없어 갱신 불필요(user_guide_sync).
- 스코프: 11개 변경 파일 전부 단일 결함 축(keyset 커서 22P02 마스킹)에 밀착, 무관한 수정·포맷팅·불필요한 리팩토링 없음(scope).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인젝션/인가 우회 없음. 정적 가드 부재는 의도된 트레이드오프(INFO) |
| performance | NONE | O(1) 정규식 검증, 오히려 불필요한 DB 왕복 감소 |
| architecture | LOW | 두 디코더 계약 비대칭 고착화·산문 기반 불변식(INFO) |
| requirement | NONE | 계약 비대칭·에러 카탈로그 갭은 이미 추적됨(INFO). 실측 전수 재검증 완료 |
| scope | NONE | 단일 결함 축에 밀착, 스코프 이탈 없음 |
| side_effect | LOW | background-runs 404→400 재분류가 CHANGELOG 미기재(WARNING) |
| maintainability | LOW | 테스트 보일러플레이트 반복(WARNING), JSDoc 계약/이력 혼재(WARNING) |
| testing | LOW | unit+e2e+뮤테이션 이중 검증 충실. 빈 id 경계 갭(INFO) |
| documentation | LOW | CHANGELOG 경로 표기 불일치·배포영향 누락(WARNING 2건) |
| dependency | NONE | 신규 의존성 없음, 계층 방향 정상 |
| database | NONE | 파라미터화 유지, keyset 페이지네이션 무변경 |
| concurrency | NONE | 동기 로직만, 검토 대상 없음 |
| api_contract | LOW | 두 엔드포인트 실패 계약 비대칭이 spec §8.2와 어긋남(WARNING, 이미 등재) |
| user_guide_sync | NONE | frontend/spec 변경 0건, 동반 갱신 불필요 |

## 발견 없는 에이전트

performance, dependency, database, concurrency, user_guide_sync — WARNING/CRITICAL 없음(NONE 위험도, INFO만 존재하거나 INFO도 없음).

## 권장 조치사항

1. CHANGELOG에 background-runs의 404→400 관측 가능한 우선순위 변화 한 줄 추가(WARNING #2) — 배포 확인 절 완결성.
2. CHANGELOG 내 `3-error-handling.md §1` 경로 표기를 `spec/5-system/3-error-handling.md §1`로 통일(WARNING #3).
3. 신규 테스트 5곳의 커서 인코딩 보일러플레이트를 헬퍼(`makeCursor`)로 추출(WARNING #4) — 선택 사항, 위험 낮음.
4. `isUuidShaped` JSDoc의 기술 계약과 리뷰 감사 이력을 분리해 `plan/in-progress/keyset-cursor-uuid-validation.md`로 이관 고려(WARNING #5) — 강제 아님.
5. (Planner 소관, 이미 등재됨) 두 keyset 커서 디코더의 실패 계약 비대칭(무시 vs 400)에 대해 `spec/5-system/2-api-convention.md §8.2` 예외 각주 또는 계약 통일 여부 결정(WARNING #1) — 이 PR을 막을 사유 아님.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14명 reviewer 실행(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 누락 없음.
- **제외**: 없음.