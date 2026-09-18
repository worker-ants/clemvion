# 부작용(Side Effect) 리뷰 — 삭제 연쇄 FK 인덱스 다섯 (V112~V116)

## 발견사항

- **[INFO]** DB 마이그레이션 PR 커밋이 무관한 cafe24 백로그 트래커 파일을 함께 수정한다
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` (파일 12, diff 게이트 `269`~`280`, `## 카탈로그 문서 위생 셋 …` 절 전체)
  - 상세: 커밋 `6e297175b`(`perf(db): 삭제 연쇄의 FK 인덱스 다섯…`)의 diff 안에 DB 인덱스 마이그레이션·e2e·spec 미러와 무관한 cafe24 API 카탈로그 문서 위생 항목 3건이 함께 커밋되어 있다. 저자 스스로 "그 PR 의 범위가 아니라 여기 적는다" 라고 명시했고, 이는 `--impl-prep` consistency-check 가 번들 스코프(`spec/conventions/`)에 딸려 우연히 발견한 내용을 적절한 트래커로 옮겨 적은 것으로, 프로젝트 관례(발견은 해당 트래커에 즉시 기록)에 부합한다. 코드 자체에 대한 부작용은 아니지만, 리뷰어·git blame 관점에서는 "DB 성능 PR" 이라는 커밋 메시지의 범위 밖 파일 변경이 같은 커밋에 섞여 있다는 점에서 기록해 둔다. 실질적 위험(되돌림·충돌·의도치 않은 상태 변경)은 없다.
  - 제안: 조치 불필요(관례에 부합). 다음에 유사 drive-by 발견이 생기면 가능하면 별도 커밋으로 분리해 `git blame`/리버트 단위를 깨끗하게 유지하는 것을 고려.

- **[INFO]** 비-트랜잭션 마이그레이션의 DROP-then-CREATE 반복 실행 시 성능 비용 재발생
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.sql` 등 5개 SQL 파일의 `DROP INDEX CONCURRENTLY IF EXISTS …; CREATE INDEX CONCURRENTLY IF NOT EXISTS …;` 패턴(각 파일 24~26줄 부근)
  - 상세: `executeInTransaction=false` + DROP-먼저 패턴은 실패한 이전 실행이 남긴 invalid 인덱스를 정리하기 위한 의도된 "repair" 관용구이며 문서(README §5, 선례 V111)에도 명시돼 있다. 다만 부작용 관점에서 명시적으로 짚을 점: 이 패턴은 **정상적으로 이미 유효한 인덱스가 존재하는 상태에서 Flyway 가 같은 마이그레이션을 재실행(예: `repair` 이후 재시도)하면 유효한 인덱스를 지웠다가 다시 만든다** — 정합성에는 문제없지만 큰 테이블에서는 두 번의 풀 테이블 스캔(테이블 잠금 없이도 I/O 비용)이 다시 발생한다. 문서화된 트레이드오프이고 논리적 결함은 아니므로 INFO로만 남긴다.
  - 제안: 조치 불필요. 이미 알려진 트레이드오프이며 코드/문서상 반영돼 있음.

- **[INFO]** 신규 인덱스 추가가 프로덕션 배포 시 일으키는 운영상 부작용(락 경합·I/O)은 코드 자체에는 드러나지 않음
  - 위치: 5개 `.sql` 파일 전체(`CREATE INDEX CONCURRENTLY`)
  - 상세: `CREATE INDEX CONCURRENTLY` 는 배타적 테이블 락을 피하지만 두 번의 순차 스캔과 `SHARE UPDATE EXCLUSIVE` 락을 오래 유지한다. 800k~ 규모 실측이 문서에 있고 인덱스 크기(0.6~6.4MB)도 작아 위험은 낮으나, 배포 타이밍(트래픽이 많은 시간대 회피 등) 관련 절차가 이 변경 세트 자체에는 없다. 이는 신규 인덱스 도입에 내재하는 일반적 특성이며 이 PR 고유의 결함은 아니다.
  - 제안: 특별한 조치 불필요 — 배포 절차(카나리아/저트래픽 시간대)는 harness/운영 문서의 몫.

그 외 검토 관점(전역 변수, 함수/메서드 시그니처, 공개 API, 환경 변수, 네트워크 호출, 이벤트/콜백)에서는 이번 변경(신규 마이그레이션 5쌍 `.conf`/`.sql`, 신규 e2e 스펙 `deletion-cascade-indexes.e2e-spec.ts`, `spec/1-data-model.md` 및 3개 data-flow 문서의 인덱스 테이블 미러, plan 문서 추가)에서 해당하는 부작용을 발견하지 못했다:

- 함수/클래스 시그니처 변경 없음 — 전부 신규 파일 추가이거나 문서 표 한 줄 추가.
- e2e 테스트(`deletion-cascade-indexes.e2e-spec.ts`)는 `pg_index`/`pg_class` 를 대상으로 한 순수 조회(`SELECT`)만 수행하며, 기존 `createDbClient()` 헬퍼를 재사용한다. DB 상태를 변경하지 않고 `beforeAll`/`afterAll` 에서 연결을 열고 닫는 것 외의 부작용 없음.
- 마이그레이션 버전 번호(V112~V116)가 기존 파일과 충돌하지 않음을 확인함(`ls codebase/backend/migrations/`로 실측, 중복 없음).
- 전역 변수·환경 변수 신규 도입/변경 없음.
- 네트워크 호출·이벤트/콜백 변경 없음.

## 요약

이번 변경은 5개의 신규 FK 인덱스 마이그레이션(및 대응 `.conf`), 검증용 e2e 스펙, spec 문서 미러링, plan 트래커 문서로 구성되며 전부 순수 추가(additive)다. 인덱스 생성은 `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` 조합으로 의도된 non-transactional repair 패턴을 따르고, 실패 시 재실행 절차까지 문서화돼 있어 구조적 부작용 위험은 낮다. 유일하게 짚을 만한 점은 DB 성능 마이그레이션 커밋에 무관한 cafe24 문서 백로그 항목이 함께 실려 있다는 것인데, 이는 저자가 명시적으로 범위 밖임을 인지하고 적절한 트래커에 기록한 것으로 프로젝트 관례에 부합하며 실질적 위험은 없다. 시그니처·공개 API·전역 상태·환경 변수·네트워크 호출 관점에서 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
