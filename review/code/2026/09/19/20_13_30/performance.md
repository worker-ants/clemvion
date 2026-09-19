# 성능(Performance) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`(신규 테이블·DB 트리거·백필), `webhook-endpoint-reservation.entity.ts`(신규 엔티티), `triggers.service.ts`(제약 이름 판정을 단일 문자열 → `ReadonlySet<string>` 로 일반화), `triggers.controller.ts`(Swagger 문자열), `app.module.spec.ts`/`root-entities.ts`(엔티티 등록), 테스트 3종(`triggers.service.spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`, `webhook-endpoint-reservation.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts`)을 대상으로 했다. `plan/**`·`review/**`·`spec/**`·`CHANGELOG.md` 는 산문 문서라 알고리즘/자원 사용 관점이 적용되지 않아 제외했다.

## 발견사항

- **[INFO]** 예약 강제 트리거 함수가 매 쓰기마다 `INSERT ... ON CONFLICT DO NOTHING` 뒤 별도 `SELECT` 로 소유자를 재조회한다(2단계)
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:38-49` (`reserve_webhook_endpoint_path()` 함수 본문 — INSERT 38-40행, SELECT 47-49행)
  - 상세: `BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id` 마다(65-69행) 이 함수가 한 번 실행되며, 매번 INSERT 문 하나 + SELECT 문 하나로 왕복이 두 번이다. `INSERT ... ON CONFLICT (endpoint_path) DO UPDATE SET endpoint_path = EXCLUDED.endpoint_path RETURNING workspace_id INTO reserved_by` 형태로 합치면 한 문장으로 줄일 수 있다. 다만 이 트리거는 `trigger` 테이블에 대한 웹훅 경로 생성/변경(고빈도 hot path 인 웹훅 **수신** `/api/hooks/:endpointPath` 이 아니라 트리거 CRUD)에서만, 그것도 행 하나당 한 번만 도는 저빈도 경로라 초 단위 부하 상황에서 문제될 처리량이 아니다. 바로 위 주석(42-46행)이 두 단계로 나눈 이유(경합 시 커밋/롤백 결과를 SELECT 로 다시 관측해야 함)를 명시하고 있어 단순 성능 최적화로 합치면 오히려 42-46행이 설명하는 경합 판정 의미가 깨질 위험이 있다.
  - 제안: 결함 아님 — 참고 기록. 유지보수성 리뷰(`maintainability.md`)와 동일 지점을 다른 관점(정확성 우선)에서 재확인.

- **[INFO]** `CREATE TRIGGER ... ON trigger` 가 마이그레이션 트랜잭션 종료까지 기존 `trigger` 테이블에 `SHARE ROW EXCLUSIVE` 를 보유해, 배포 적용 중 해당 테이블에 대한 쓰기(웹훅 트리거 생성·수정·경로 변경 API)가 블로킹된다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:65-74` (`CREATE TRIGGER trg_trigger_reserve_endpoint_path ... ON trigger`, 뒤이은 백필 `INSERT ... SELECT`)
  - 상세: 이 파일에는 `.conf`(V132 와 달리 non-transactional 지정)가 없어 Flyway 가 전체를 한 트랜잭션으로 실행한다. `CREATE TRIGGER` 는 대상 테이블 락을 커밋까지 쥐므로, 락 보유 구간(트리거 생성 + 바로 뒤 백필 SELECT 스캔 시간)만큼 `trigger` 테이블 쓰기가 큐잉된다. 백필은 V132 의 partial UNIQUE 인덱스를 스캔할 수 있는 단순 `INSERT ... SELECT` 라 트리거 행수가 늘어도 대체로 짧게 끝날 것으로 보이지만, 정확한 지속 시간은 이번 diff 에 실측치가 없다(관련 있는 V121~V130 실측은 `deletion-cascade-indexes.e2e-spec.ts` 주석에 있으나 이 마이그레이션 자체의 실측은 아니다). SELECT(ACCESS SHARE, 웹훅 수신·목록 조회)는 이 락과 충돌하지 않아 영향은 트리거 쓰기 경로에 국한된다.
  - 제안: 결함 아님(설계 주석 17-19행이 이미 "순서가 뜻을 가진다" 며 의도를 밝힘) — 데이터베이스 리뷰(`database.md`)와 같은 지점을 성능 관점에서 재확인. 운영 배포 시 저트래픽 구간 적용을 권장한다는 점은 그쪽 리포트의 제안과 동일.

- **[INFO]** 새 e2e 테스트의 잠금-대기 폴링 루프가 최대 5초까지 대기할 수 있다(운영 코드 아님, 테스트 실행 시간에만 영향)
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` `waitUntilSecondBlocks`(약 260-270행, `for (let i = 0; i < 200; i++) { ... await new Promise((resolve) => setTimeout(resolve, 25)); }`)
  - 상세: 두 번째 연결이 실제로 락 대기 상태(`pg_stat_activity.wait_event_type = 'Lock'`)에 들어갔는지 25ms 간격으로 최대 200회(5초) 폴링한다. 정상 상황에서는 락 경합이 즉시 관측돼 몇 회 안에 끝나므로 평균 실행 시간에는 거의 영향이 없고, 상한을 두지 않으면 실패 시 무한 대기(hang)가 되는 것을 막는 안전장치로 타당하다.
  - 제안: 결함 아님 — e2e 스위트 실행 시간에 미치는 영향은 미미하다는 점만 기록.

## 확인된 양호한 설계 (참고, 오탐 방지)

- **배치 백필, N+1 없음**: 초기 데이터 이관이 앱 레벨 반복문이 아니라 단일 `INSERT ... SELECT FROM trigger WHERE endpoint_path IS NOT NULL`(74행)로 수행돼, 트리거 테이블 규모와 무관하게 라운드트립이 1회다.
- **강제 로직이 앱 레이어에 없음**: 소유권 검증이 DB 트리거(행 단위 BEFORE)로 구현돼 있어 서비스 코드에 반복문·재조회가 추가되지 않았다. `triggers.service.ts` 쪽 변경은 문자열 상수 하나를 `ReadonlySet<string>`(233-236행)으로 넓힌 것뿐이고, `isEndpointPathUniqueViolation`(245-249행)은 `Set.has()` 로 O(1) 판정이라 원소가 늘어도(현재 2개) 선형 비용이 생기지 않는다 — 목적에 맞는 자료구조 선택.
- **부분 인덱스로 인덱스 팽창 방지**: `idx_webhook_endpoint_reservation_workspace_id`(29-31행)가 `WHERE workspace_id IS NOT NULL` 로, 워크스페이스가 삭제돼 주인 없는(NULL) 예약이 쌓여도 이 인덱스 크기에는 반영되지 않는다 — 다시 찾을 일이 없는 데이터를 인덱싱하지 않는 합리적 선택.
- **불필요한 즉시 조회 없음**: `WebhookEndpointReservation` 엔티티(신규)에 eager 관계나 즉시 로딩 설정이 없고, 이번 diff 어디에도 이 테이블을 앱에서 직접 조회하는 새 리포지토리 코드가 없다(강제는 전적으로 DB 트리거) — 불필요한 선행 로딩 없음.
- **캐싱 해당 없음**: 제약 이름 판정은 상수 조회라 캐싱 대상이 아니고, 반복 계산도 없다.

## 요약

이번 diff(V133 웹훅 경로 영구 예약)는 성능 관점에서 위험한 패턴(N+1, 앱 레벨 반복 강제, 비효율적 자료구조, 불필요한 즉시 로딩)이 전혀 없다. 강제 로직을 DB 트리거로 옮기고 백필을 단일 set-based 문장으로 처리한 설계가 오히려 앱 레이어의 반복 호출을 원천 차단한다. 지적할 만한 지점은 모두 이미 설계 주석에서 트레이드오프로 인지·문서화된 것들이다 — (1) 트리거 함수의 INSERT+SELECT 2단계 왕복(정확성을 위한 의도적 선택, 고빈도 경로 아님), (2) `CREATE TRIGGER` 가 배포 적용 중 짧게 `trigger` 테이블 쓰기를 블로킹하는 것(마이그레이션 트랜잭션의 순서 보장을 위한 의도적 설계, database.md 리포트와 중복 확인). 두 지점 모두 CRITICAL/WARNING 급이 아니며 코드를 막을 이유가 없다.

## 위험도

LOW
