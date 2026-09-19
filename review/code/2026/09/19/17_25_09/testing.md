# 테스트(Testing) 리뷰 2라운드 — 엔티티 컬럼 선언 정정 + 컬럼 층 가드

## 리뷰 범위

- 엔티티 8개 파일(`alert-rule`·`edge`·`integration-usage-log`·`llm-usage-log`·`model-config`·`node`·`workflow-assistant-session`·`workspace-invitation`)은 1라운드(`review/code/2026/09/19/17_04_28/testing.md`)와 동일 — 순수 데코레이터 메타데이터(`type`·`enumName`·`default`) 변경뿐이라 별도 unit 테스트 대상이 아니고, 검증은 e2e 가드로 수렴하는 설계가 여전히 적절하다.
- 이번 라운드의 실질 변경은 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 에 대한 보강 — 1라운드 WARNING 1·2 에 대한 대응으로 `COLUMN_LEVEL_SAMPLES`(73~95행) + 신규 `it('컬럼 층 패턴 …')`(507~518행) 추가, `it('컬럼 — TypeORM 스키마 비교기가 …')`(520~545행)에 `catalog()` 전후 비교(523~535행) 추가.
- `plan/in-progress/entity-column-declaration-drift.md` 는 위 두 보강에 대응하는 뮤테이션 표(P1~P4, S1)를 새로 기록 — 코드와 문서 서술이 대조해 봤을 때 어긋나지 않는다.

## 발견사항

- **[INFO]** 1라운드 WARNING 1(`ADD "..."`·`RENAME COLUMN` 두 분기가 뮤테이션 검증 밖)이 실질적으로 해소됨 — 잔여 관찰 하나
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:507-518` (`it('컬럼 층 패턴 …')`), `73-95` (`COLUMN_LEVEL_SAMPLES`)
  - 상세: 다섯 정규식 각각이 최소 한 표본을 잡는지(516행), caught 표본이 전부 `isColumnLevel`(509행), ignored 표본이 전부 아님(511행)을 단언해 다섯 분기 모두 판별력이 있음을 결정적으로 고정했다. `caught`/`ignored` 표본이 실제 TypeORM 0.3.31 이 낸 문장(plan 문서 "실측 — 가드 뮤턴트" 표의 P1~P4 로 재확인)이라 손으로 지어낸 값이 아니라 실측 기반 — 이 프로젝트가 겪은 "생성 입력 vs 큐레이션 코퍼스" 문제(회귀 형태를 이름으로 고정 못 하는 손큐레이션)에도 해당하지 않는다. 다만 이 테스트는 `db`/`ds` 를 전혀 쓰지 않는 순수 문자열 매칭 로직인데도 같은 `describe` 블록의 `beforeAll`(186~201행, 실제 Postgres 연결 + `DataSource.initialize()`)에 묶여 있어, DB/Docker 없이는 실행할 수 없다. 1라운드 제안("별도 unit 테스트로 분리")의 취지 — 빠르고 결정적인 회귀 방어선 — 은 로직상으로는 달성됐지만 실행 속도·격리 측면에서는 아직 e2e 인프라에 종속된 채다.
  - 제안: 정정 자체는 불필요(기능 결함 아님) — 다만 후속으로 `COLUMN_LEVEL`/`isColumnLevel`/`COLUMN_LEVEL_SAMPLES` 를 별도 모듈로 뽑아 순수 unit 테스트(`*.spec.ts`, DB 불요)로 옮기면 이 회귀 방어선이 e2e 인프라 가용성과 무관하게 항상 돈다.

- **[WARNING]** 1라운드 WARNING 2(비공식 내부 API `driver.createSchemaBuilder().log()` 호출에 트랜잭션/SAVEPOINT 보호 없음)는 **탐지**만 보강됐고 **예방**은 여전히 없다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:520-545`, 특히 `523-535` (`catalog()` 전후 비교)
  - 상세: 새로 추가된 `catalog()` 스냅샷 비교(호출 전후 `information_schema.columns` + `pg_type` enum 목록의 md5 해시 대조)는 "`log()` 가 DB 를 바꾸지 않는다"는 전제가 깨졌을 때 **사후에 알아채는** 안전장치이지, 애초에 실제 DDL 실행을 막는 안전장치가 아니다. 같은 파일의 앞 세 테스트(인덱스·유니크 `364행`, CHECK `426행`, FK `461행`)는 문제가 생겨도 `inRolledBackTx`(208~216행)가 무조건 ROLLBACK 해 공유 e2e DB 를 원상 복구하지만, 이 테스트는 `ds.driver.createSchemaBuilder().log()` 를 트랜잭션 밖에서 직접 호출한다(534행) — 만약 TypeORM 버전업으로 `log()` 의 "기록만 하고 실행 안 함" 계약이 깨지면, `catalog()` 비교로 테스트는 실패하지만 그 시점엔 이미 공유 e2e Postgres 에 실제 DDL 이 반영된 뒤다. 이 파일의 마지막 테스트라 같은 파일 내 후속 테스트로 전파되지는 않지만, 같은 컨테이너를 공유하는 다른 e2e 스펙 파일이 뒤이어 실행되면 그 오염을 물려받아 무관한 이유로 실패할 수 있다.
  - 제안: 가능하면 `log()` 호출 자체를 트랜잭션/SAVEPOINT 로 감싸(다른 세 테스트와 동일 패턴) 실제 실행되더라도 롤백되게 만들 것. TypeORM 의 `createSchemaBuilder()` 가 별도 커넥션을 열어 트랜잭션 경계를 공유하지 못한다면, 최소한 이 파일 자체를 별도 e2e job/DB 인스턴스로 격리해 오염 전파 범위를 그 파일 하나로 제한하는 것도 대안.

## 회귀 확인 (조치 불요)

- 기존 인덱스·유니크·CHECK·FK 4개 테스트(324~505행)는 이번 diff 로 로직 변경이 없고, 8개 엔티티의 메타데이터(테이블·컬럼명·관계) 자체도 그대로라 회귀 없이 유효하다.
- `UNDECLARED_COLUMNS`(44~53행)·기존 `COLUMN_LEVEL` 배열(60~66행) 자체의 내용은 1라운드에서 이미 뮤테이션(C1~C9, A1, A2)으로 왕복 검증됐고 이번 라운드에서 손대지 않았다.
- 새 두 테스트 모두 `beforeAll`/`afterAll` 자원(같은 `db`/`ds`)만 공유할 뿐 다른 `it` 블록의 실행 순서·상태에 의존하지 않아 격리 자체는 안전하다(단 위 WARNING 은 "격리"가 아니라 "부작용 원상복구" 문제).

## 요약

1라운드에서 지적한 두 WARNING 중 첫째(정규식 다섯 분기 중 둘이 뮤테이션 검증 밖)는 실측 DDL 표본 + 전용 판별력 테스트로 사실상 해소됐다 — 남은 것은 그 테스트가 DB 를 쓰지 않는데도 e2e `beforeAll` 에 묶여 실행 속도·격리 이점을 다 살리지 못한다는 INFO 수준 관찰뿐이다. 둘째(비공식 내부 API 호출의 트랜잭션 보호 부재)는 사후 탐지 장치(카탈로그 해시 비교)만 추가됐고 애초 요청한 예방 장치(트랜잭션/SAVEPOINT 롤백)는 여전히 없다 — TypeORM 이 "기록만 함" 전제를 깨는 미래 시나리오에서 공유 e2e DB 가 실제로 오염될 수 있는 잔여 리스크가 남아 WARNING 을 유지한다. 두 사안 모두 지금 당장 GREEN/RED 판정에 영향을 주는 결함은 아니다.

## 위험도

LOW
