# 동시성(Concurrency) 코드 리뷰

## 검토 범위

이번 diff 의 실제 코드 변경은 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 1개 파일뿐이다(e2e 테스트). 나머지 변경 파일(`plan/in-progress/column-guard-gaps.md`, `review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**`)은 plan 문서·이전 리뷰 라운드 산출물로, 동시성과 무관하다.

코드 변경분은 다음 세 가지다:
1. 기존 인라인 `readOnly` `DataSource` 옵션을 `readOnlyDataSourceOptions()` 헬퍼로 추출, 기존 컬럼 층 테스트와 신규 테스트가 공유.
2. 신규 테스트 `비교기 연결은 읽기 전용이다 — DDL 을 거부한다` — 별도 `DataSource` 를 생성·초기화해 쓰기 시도가 거부되는지 확인 후 `destroy()`.
3. 신규 테스트 `선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다` — 공유 `ds`(전역 `DataSource`)에서 `QueryRunner` 를 얻어 트랜잭션 안에서 insert/save 후 ROLLBACK.

## 발견사항

- **[INFO]** 리소스 정리 순서는 이미 안전하게 되어 있음 (참고 사항, 조치 불요)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다` it 블록 (라인 614~663), `비교기 연결은 읽기 전용이다` it 블록 (라인 595~607)
  - 상세: `qr.connect()`/`qr.startTransaction()` 이 `try` 블록 안에 있고, `finally` 는 `qr.isTransactionActive` 를 확인한 뒤에만 롤백을 시도하며, 롤백이 던지더라도 안쪽 `finally` 의 `qr.release()` 가 실행되어 커넥션이 풀에 반드시 반환된다. `readOnly` `DataSource` 쪽도 `initialize()` 를 `try` 안에 두고 `if (readOnly.isInitialized) await readOnly.destroy()` 로 대칭적으로 정리한다 — 두 패턴 모두 "연결 획득 실패/트랜잭션 시작 실패/롤백 실패" 각 경로에서 커넥션·트랜잭션 누수가 없다. (SUMMARY 1라운드 WARNING #2 가 이미 지적·조치됐고(`a71642fe0`) 현재 diff 는 그 조치가 반영된 최종 상태다.)
  - 제안: 없음 — 현재 형태 유지 권장.

- **[INFO]** 신규 트랜잭션 테스트는 공유 `ds` 풀에서 별도 커넥션을 빌려 쓴다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:615` (`ds.createQueryRunner()`)
  - 상세: 같은 파일의 다른 테스트들은 `beforeAll` 에서 만든 raw `pg.Client`(`db`) 로 `BEGIN`/`ROLLBACK`(`inRolledBackTx`) 하는 반면, 이 테스트만 TypeORM `ds` 풀에서 별도 `QueryRunner` 커넥션을 얻어 독립 트랜잭션을 연다. Jest 는 같은 파일 안의 `it` 블록을 기본적으로 순차 실행하고(diff 에 `test.concurrent` 사용 없음) `db` 와 `ds` 는 서로 다른 연결이므로, 이 테스트의 트랜잭션이 다른 테스트의 `db` 트랜잭션과 동시에 열려 상호 간섭할 여지는 없다. 다만 향후 이 스위트에 `test.concurrent` 를 도입하거나 테스트 병렬화를 시도하면, `ds` 풀의 기본 `poolSize` 한도 안에서 여러 `QueryRunner` 가 동시에 열릴 수 있어 별도 검토가 필요해진다 — 지금 diff 범위에서는 해당 없음.
  - 제안: 조치 불요. 향후 이 파일에 `test.concurrent` 를 도입할 경우에만 재검토.

- **[INFO]** 트랜잭션 안의 복합 연산(3개 raw INSERT + 2개 `save`)은 원자적으로 묶여 있음
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663`
  - 상세: `startTransaction()` 이후 모든 raw INSERT 와 `manager.save()` 호출이 같은 `QueryRunner` 트랜잭션 컨텍스트 안에서 실행되고 `finally` 에서 무조건 롤백되므로, 이 테스트가 만든 프로브 데이터가 공유 e2e DB 에 영구히 남을 가능성은 없다. 각 `await` 가 누락 없이 걸려 있어 insert 완료 전에 다음 문이 실행되는 순서 오류도 없다.
  - 제안: 없음.

## 요약

이번 diff 는 e2e 테스트 파일 하나에 한정되며, 실행 모델(Jest 순차 `it`, `test.concurrent` 미사용)상 실제 동시 접근이 발생하지 않는다. 새로 추가된 두 테스트 모두 `try`/`finally` 로 커넥션·트랜잭션 정리를 대칭적으로 수행하고 있고(직전 리뷰 라운드에서 지적된 커넥션 누수 소지는 이미 `a71642fe0` 커밋으로 조치됨), 트랜잭션 경계도 정확해 데이터 잔존이나 자원 누수 위험이 없다. 데드락·경쟁 조건·await 누락·이벤트 루프 블로킹에 해당하는 패턴은 발견되지 않았다.

## 위험도

NONE
