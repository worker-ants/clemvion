# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 문서화(CHANGELOG 누락)와 동시성(핵심 경쟁 조건 미검증) 두 건의 WARNING 존재. forced 화이트리스트(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 사용자 영향이 있는 보안성 동작 변경(지우거나 바꾼 웹훅 경로 영구 예약)인데 `CHANGELOG.md` 항목이 없다. 직전 V131/V132 커밋(`e29b2bb51`)이 CHANGELOG 에 명시적으로 남긴 "남는 창" 갭(묘비 부재)을 정확히 닫는 후속 변경인데도 Unreleased 항목이 빠졌다. 같은 시기 인접 커밋들은 예외 없이 Unreleased 항목을 추가했다. 3라운드 consistency check 는 스코프가 `spec/**` 로 한정돼 이 갭을 점검 대상으로 삼지 않았다. | `CHANGELOG.md` (이번 diff 미포함) | 선행 항목과 같은 형식으로 Unreleased 절 추가("고친 것"/"배포 뒤 보일 수 있는 것"), 선행 항목의 "남는 창" 단락에 역참조 |
| 2 | 동시성 | 이 기능이 존재하는 이유인 "두 워크스페이스가 동시에 같은 새 경로를 놓고 경합"하는 시나리오가 어떤 테스트에서도 실제 동시 실행으로 검증되지 않는다. 신규 e2e(`webhook-endpoint-reservation.e2e-spec.ts`)는 SAVEPOINT 로 한 트랜잭션 안에서 순차 검증하고, `webhook-trigger.e2e-spec.ts` B7~B9 도 `await` 로 직렬화된 순차 HTTP 호출이다. PostgreSQL 의 `INSERT ... ON CONFLICT DO NOTHING` 동시성 보장에만 의존하고 있고, 이 보장이 실제 트랜잭션 경계(격리 수준·커넥션 풀) 위에서 성립하는지 실측되지 않았다. | `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` (전체), `codebase/backend/test/webhook-trigger.e2e-spec.ts` B7~B9 | 두 개의 독립 `pg.Client`(또는 두 API 요청을 `Promise.all` 로 동시 발사)로 같은 브랜드-뉴 `endpointPath` 를 서로 다른 워크스페이스에서 동시에 생성해 "정확히 하나만 201, 나머지는 409 이고 예약 테이블에 승자 행 하나만 남는다"를 검증하는 테스트 추가. 또는 두 트랜잭션을 `BEGIN` 상태로 대기시켜 블록/해소를 SQL 레벨에서 직접 관찰 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스/보안 | 합성 제약 이름(`webhook_endpoint_reservation_owner`)이 실재 UNIQUE/CHECK 제약이 아니라 트리거 함수가 `RAISE EXCEPTION ... USING CONSTRAINT` 로 붙이는 논리적 라벨이다. 동작 자체는 정확(e2e 로 실측 검증됨)하나, `\d webhook_endpoint_reservation` 으로 조회하는 운영자가 이 이름을 찾지 못해 혼동할 수 있다. | `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:47-51`, `codebase/backend/src/modules/triggers/triggers.service.ts` (`isEndpointPathUniqueViolation` JSDoc) | 이미 인지·문서화된 사안(서비스 JSDoc). 트리거 함수 자체에도 "실재 제약 아님" 주석 추가하면 더 낫다 |
| 2 | 데이터베이스 | `CREATE TRIGGER ... ON trigger` 가 기존 `trigger` 테이블에 커밋까지 유지되는 `SHARE ROW EXCLUSIVE` 를 걸어, 배포 중 웹훅 트리거 생성·수정 API 호출이 마이그레이션 완료까지 짧게 블록될 수 있다(의도적 설계, 마이그레이션 헤더에 이미 문서화됨). SELECT/웹훅 수신은 영향 없음. | `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:58-67` | 배포 체크리스트에 저트래픽 구간 권장을 남겨두면 좋음 |
| 3 | 부작용 | 새 DB 트리거의 실제 발동 범위는 오늘은 "웹훅 경로 생성·실변경"으로 정확히 좁혀져 있으나, 이는 `TriggersService.update()` 가 TypeORM 의 diff 기반 `save()` 를 쓰기 때문이다. 트리거 정의(`UPDATE OF endpoint_path, workspace_id`) 자체는 이를 보장하지 않아, 향후 partial-update API/QueryBuilder 로 두 컬럼을 값 변경 없이 `SET` 하는 코드가 생기면 조용한 성능 부작용(추가 INSERT+SELECT 왕복) 표면이 될 수 있다. | `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:58-63` | 향후 그런 코드 추가 시 상기하도록 엔티티 JSDoc/서비스 주석에 한 줄 남기기 |
| 4 | 동시성 | 트리거 함수(`INSERT ... ON CONFLICT DO NOTHING` 뒤 `SELECT` 재조회)의 정합성이 암묵적으로 READ COMMITTED(기본 격리 수준) 전제에 의존한다. 더 높은 격리 수준으로 감싸는 코드가 생기면 직렬화 실패(`40001`)가 미처리 500 으로 샐 수 있다(현재는 명시적 isolation 지정이 없어 문제 없음). | `V133__webhook_endpoint_reservation.sql:33-55`, `triggers.service.ts:497-504,643-645` | 함수 주석에 "호출 트랜잭션이 READ COMMITTED 임을 전제" 명시 |
| 5 | 테스트 | `expectConflict`(B5, 기존)와 `expectPathConflict`(B7/B8, 신규)가 같은 파일 안에서 바이트 단위로 동일한 단언 블록(status/code/details/메시지 미포함)을 두 벌 유지한다. 응답 계약이 바뀌면 한쪽만 고치고 넘어갈 위험(DRY 위반). | `codebase/backend/test/webhook-trigger.e2e-spec.ts` | 공용 헬퍼로 통합하거나 이름을 하나로 통일 |
| 6 | 테스트 | `WebhookEndpointReservation` 엔티티가 저장소 어디에서도 `@InjectRepository` 로 주입되지 않아 ORM 경로(컬럼/인덱스 데코레이터)가 실제 Repository 왕복으로 검증되지 않는다(현재는 `entity-schema-declarations.e2e-spec.ts` 의 제네릭 diff 로만 커버, 의도된 설계). | `webhook-endpoint-reservation.entity.ts`, `root-entities.ts:11,66` | 향후 이 엔티티에 Repository 를 붙이는 PR 에서 최소 1개 실제 find/save 단위 테스트 추가 |
| 7 | 유지보수성 | 테스트 케이스 생성기가 3중 `flatMap`/`map` 중첩(메서드·표면·제약이름 3축)으로 `it.each` 인자를 만든다. 현재는 JSDoc 설명으로 의도 파악 가능하나 축이 더 늘면 가독성 저하 우려. | `triggers.service.spec.ts:3034-3039` | 축이 더 늘 경우 `cartesian(...)` 헬퍼로 추출 고려 |
| 8 | 유지보수성 | Swagger 설명 문자열의 두 조건("트리거가 이미 존재하거나" / "...예약한 경로")이 서술어 균형 없이 나열돼 문법적으로 다소 어색하게 읽힌다. | `triggers.controller.ts:51` | 서술어를 맞추는 정도의 문구 다듬기 (차단 사유 아님) |
| 9 | 유지보수성 | DB 트리거 함수가 `INSERT ... ON CONFLICT DO NOTHING` 후 별도 `SELECT` 로 소유자를 재조회(2회 왕복). `RETURNING` 으로 합치면 1회로 줄일 수 있으나 현재도 정확성 문제는 없음. | `V133__webhook_endpoint_reservation.sql:38-45` | 필수 아님, 참고용 |
| 10 | 부작용 | `isEndpointPathUniqueViolation()` 반환 의미가 넓어졌다(제약 이름 1개→2개 매칭). 현재 이 모듈 밖에서 import 하는 곳 없음(전수 확인), 향후 재사용 시 "예약 충돌"도 true 로 묶인다는 점 인지 필요. | `triggers.service.ts` (`export function isEndpointPathUniqueViolation`) | 시그니처 변경 아님, 향후 재사용 시 유의 |
| 11 | 요구사항/프로세스 | plan 체크리스트 마지막 3항목(`/ai-review`·`--impl-done`·트래커 해소/`plan/complete/` 이동)이 아직 미체크 — 이번 리뷰 자체가 그 첫 항목을 채우는 정상 진행 중 상태. | `plan/in-progress/spec-draft-webhook-endpoint-reservation.md:174-176` | draft 를 `plan/complete/` 로 옮기는 마무리 커밋에서 관련 트래커(`spec-draft-nullable-notation-followups.md`) 체크박스도 동시 갱신 |
| 12 | 문서화 | `spec/1-data-model.md` Rationale 과 신규 e2e 헤더가 아직 `plan/in-progress/` 에 있는 draft 의 `plan/complete/` 경로를 선인용한다 — 이미 선행 consistency check 가 "정상 시퀀싱"으로 판정한 사안. | `spec/1-data-model.md` Rationale, `webhook-endpoint-reservation.e2e-spec.ts` 헤더 | 조치 불요, draft 이동 시 자동 해소 |
| 13 | 스코프 | 신규 테스트 케이스(B7~B9) 삽입 위치가 기존 번호 비순차 구조(B3 가 B6 뒤에 위치)를 그대로 유지 — 이번 PR 이 만든 문제 아니라 선재 조건. | `webhook-trigger.e2e-spec.ts` (B7~B9 삽입 지점) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가·시크릿·암호화 관련 새 결함 없음. 방어 설계(DB 트리거 강제, 응답 비구분) 견고함 확인 |
| requirement | NONE | spec(§2.8.1 등)과 구현이 line-level 로 일치. 직전 라운드 WARNING(predicate 협소화) 해소 확인 |
| scope | NONE | diff 전부 "웹훅 경로 영구 예약" 단일 기능에 수렴, 무관 변경·포맷팅 잡음 없음 |
| side_effect | LOW | 트리거 발동 범위는 오늘은 안전하나 향후 partial-update 확장 시 조용한 성능 부작용 여지(INFO) |
| maintainability | NONE | 네이밍·부분 인덱스·리팩터링(Set 일반화) 양호. 3중 중첩·Swagger 문구 등 사소 INFO만 |
| testing | LOW | 핵심 경로 3계층 커버 양호하나 동시 실행 시나리오 미검증(concurrency WARNING 과 연계), 단언 헬퍼 중복 |
| documentation | LOW | 코드-spec 인라인 정합은 모범적이나 CHANGELOG.md 갱신 누락 (WARNING) |
| database | LOW | 트랜잭션 원자성·동시성 제어·인덱스 설계 견고. 배포 시 짧은 lock, 합성 제약이름은 INFO |
| concurrency | LOW | 앱 레벨 TOCTOU 없음, DB 강제 설계 안전. 다만 핵심 경쟁 조건이 동시 실행으로 검증되지 않음 (WARNING) |

## 발견 없는 에이전트

security, requirement, scope, maintainability — CRITICAL/WARNING 없음(INFO만 존재하거나 전무).

## 권장 조치사항

1. `CHANGELOG.md` 에 이번 변경(웹훅 경로 영구 예약)의 Unreleased 항목 추가 — 직전 V131/V132 항목의 "남는 창" 단락과 역참조로 연결 (WARNING #1)
2. 두 워크스페이스가 동시에 같은 새 `endpointPath` 를 놓고 경합하는 시나리오를 실제 동시 실행(`Promise.all` 또는 두 `pg.Client`)으로 검증하는 테스트 추가 (WARNING #2)
3. (선택) 트리거 함수·서비스 주석에 "합성 제약 이름은 실재 오브젝트 아님", "READ COMMITTED 전제", "partial-update 로 값 불변 SET 시에도 트리거 발동" 세 가지를 명시해 향후 회귀 방지 (INFO #1, #3, #4)
4. (선택) `expectConflict`/`expectPathConflict` 단언 헬퍼 통합으로 응답 계약 변경 시 드리프트 방지 (INFO #5)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경과 낮은 관련성 (제외 사유 상세는 `_routing_decision.json` 참고) |
  | architecture | 상동 |
  | dependency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |

---

(참고: `SUMMARY.md` Write 는 하네스가 basename 을 차단해 실패했다 — 9개 reviewer 파일은 이미 디스크에 존재해 별도 영속화가 불필요했다. 위 전문을 호출자가 `summary_output_file` 에 멱등 기록해야 한다.)
