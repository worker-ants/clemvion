# 데이터베이스(Database) 리뷰

## 리뷰한 변경 요약

이번 diff(`origin/main` 대비 누적)의 유일한 DB 관련 프로덕션 코드는
`ExecutionEngineService.updateExecutionStatus` else 분기(`linkedNodeExec` 없이 RUNNING/
COMPLETED/FAILED/CANCELLED 로 직접 마감하는 경로)의 guarded raw UPDATE
(`WHERE id=$1 AND status IN (비-terminal[,'failed'])... RETURNING id`)를 트랜잭션 밖 단발
`executionRepository.query(...)` 에서 `this.dataSource.transaction(async (manager) => {
manager.query(...) })` 안으로 옮긴 것이다 (`execution-engine.service.ts` — 함수
`public async updateExecutionStatus`, else 분기 `let persisted = false; await
this.dataSource.transaction(...)` 블록). 목적은 `updateReturningRows` 가 튜플 shape 위반에
throw 할 때 그 throw 가 이미 실행된 UPDATE 자체를 롤백하게 만드는 것이다.

이 변경은 **이미 두 차례(`17_36_15`, `18_10_28`) database reviewer 가 각각 리뷰해 위험도
NONE 으로 판정**했고(`review/code/2026/08/30/17_36_15/database.md`,
`review/code/2026/08/30/18_10_28/database.md`), 이번 프롬프트에도 그 두 산출물이 diff 파일
목록(파일 11, 24)에 포함돼 있어 판정 근거를 직접 대조할 수 있었다. 두 라운드 이후 `HEAD`
(`9d5e001bf`)까지의 유일한 추가 커밋은 같은 함수 JSDoc 의 self-deadlock 호출부 카운트를
"11곳"에서 "20곳"(파일 내 직접 호출 11 + `EngineDriver` 경유 9)으로 정정하고, 그 확인이
"어휘적(lexical) 범위" 임을 명시한 것뿐이다 — **DB 쿼리·트랜잭션 경계·바인딩·스키마 자체는
한 글자도 바뀌지 않았다** (`git show 9d5e001bf -- codebase/backend/.../execution-engine.service.ts`
로 diff 를 직접 열어 확인, 변경분은 JSDoc 블록 한 곳뿐).

나머지 파일(`CHANGELOG.md`, `plan/in-progress/*.md`, `spec/5-system/4-execution-engine.md`,
`spec/data-flow/3-execution.md`, `review/**` 하위 다수, `execution-engine.service.spec.ts`)은
이 코드 변경을 추적·문서화·테스트하는 산출물이며 DB 코드 자체의 변경이 아니다.
`execution-engine.service.spec.ts` 의 mock 재작성(`mockTxManagerQuery` → `UPDATE execution`
매칭 시 기존 `mockExecutionRepo.query` 로 위임)과 신규 테스트 2건(롤백 축 + 정상 경로 공허
방지 축)도 이미 두 라운드에서 검증됐고 이번 라운드에서 추가 변경이 없다.

## 발견사항

이번 라운드에서 **새로 발견된 DB 관점 이슈는 없다.** 기존 두 라운드가 남긴 INFO 세 건
(hot path 라운드트립 증가, self-deadlock 방지가 런타임 가드 없이 JSDoc 규약에만 의존,
SQL 인젝션 벡터 없음 확인)은 코드가 그 사이 바뀌지 않았으므로 그대로 유효하며, 아래에
간단히 재확인만 남긴다.

- **[INFO]** hot path 에 트랜잭션 왕복(BEGIN/COMMIT)이 추가되어 커넥션 풀 점유 시간이 늘어난다
  — 이미 `17_36_15`/`18_10_28` database.md 가 기록. 목적(shape 위반 throw 시 UPDATE 롤백
  보장)이 비용을 상회한다고 판단하며 조치 불요.
- **[INFO]** self-deadlock 방지가 코드 레벨 가드가 아니라 JSDoc 서술 + 호출부 전수 대조에만
  의존한다 — 이번 라운드는 오히려 이 서술의 정확도를 높였다(11→20곳, "어휘적 확인" 이라는
  범위 한정 추가). 호출 스택 상위에서 트랜잭션을 연 caller 가 있는지는 여전히 미확인이라고
  스스로 명시해 뒀다 — 정직한 범위 축소이지 새로운 위험이 아니다.
- **[INFO]** `AND status IN (${elseStatusesSql})` 문자열 보간은 `NON_TERMINAL_STATUSES_SQL` /
  `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(고정 enum 파생 static 상수)만 사용하고, 나머지 값은
  전부 `$1`~`$8` 파라미터 바인딩이다 — SQL 인젝션 벡터 없음. 이번 라운드에서 이 쿼리 문자열도
  변경되지 않았다.

## DB 관점 개별 점검 (변경 없음 확인)

- **인덱스**: `WHERE id = $1` (PK 단일 행 UPDATE) — 신규 인덱스 요구·스캔 패턴 변화 없음.
- **N+1**: 호출당 단일 쿼리, 반복문 내 호출 패턴 변화 없음.
- **트랜잭션**: else 분기가 `linkedNodeExec` 분기와 동일한 `dataSource.transaction` 형태로
  통일됐고, 부작용(`emitTerminalExecutionMetrics`, `recordRunningSegmentStart`)은
  `finishStatusTransition` 헬퍼를 통해 트랜잭션 경계 밖에서 실행된다 — 경계 설정이 적절하다.
- **마이그레이션 안전성**: 이번 diff 에 스키마 변경(migration 파일)이 없다 — 해당 없음.
- **스키마 설계**: 테이블 구조·컬럼·관계 변경 없음 — 해당 없음.
- **커넥션 관리**: TypeORM `dataSource.transaction()` 이 획득/BEGIN/콜백/COMMIT-ROLLBACK/반환을
  자동 처리 — 누수 위험 없음.
- **SQL 인젝션**: 파라미터 바인딩 + enum 파생 상수만 보간 — 위험 없음.
- **대량 데이터**: PK 단일 행 UPDATE — 대용량 스캔·페이지네이션과 무관.

## 요약

이번 라운드(`19_26_58`)의 diff 는 DB 관점에서 실질적으로 새로운 내용이 없다. 핵심 프로덕션
변경(`updateExecutionStatus` else 분기의 트랜잭션 래핑)은 이미 두 차례 독립적으로 database
reviewer 검토를 거쳐 위험도 NONE 으로 판정됐고, 이번에 `HEAD` 까지 추가된 유일한 커밋
(`9d5e001bf`)은 같은 함수의 JSDoc 호출부 카운트를 정정한 순수 문서 수정으로 DB 쿼리·트랜잭션·
바인딩·스키마는 전혀 건드리지 않았다. 나머지 파일은 CHANGELOG/plan/spec 갱신과 리뷰 산출물
커밋으로 DB 코드가 아니다. 기존에 기록된 INFO 3건(hot path 왕복 증가, self-deadlock 문서
의존, SQL 인젝션 없음)은 여전히 유효하나 전부 조치 불요 수준이다.

## 위험도

NONE — DB 코드 변경분은 이전 두 라운드에서 이미 NONE 으로 검증됐고, 이번 라운드가 추가한
유일한 커밋은 DB 동작에 영향 없는 JSDoc 정정이다.
