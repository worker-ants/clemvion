# 부작용(Side Effect) 리뷰 — column-guard-gaps

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (실제 코드 변경)
- `plan/in-progress/column-guard-gaps.md` (신규 plan 문서 — 부작용 대상 아님)
- `review/consistency/2026/09/20/00_34_58/*` (신규 consistency-check 산출물 — 생성된 보고서, 코드 아님)

부작용 관점에서 실질적으로 검토할 대상은 파일 1(e2e 스펙 파일)뿐이다. 나머지는 문서/리포트 산출물이라 8개 점검 관점(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트) 이 적용될 코드가 없다.

## 발견사항

- **[INFO]** 신규 테스트가 공유 e2e DB의 실 테이블(`user`/`workspace`/`workflow`)에 raw INSERT 를 수행
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `it('선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다 …')` 블록 (게이트 613~658)
  - 상세: `qr.startTransaction()` → raw INSERT 3건 + `ModelConfig`/`WorkflowAssistantSession` 저장 → `finally` 에서 `qr.rollbackTransaction()`. 정상 경로·assertion 실패 경로 모두 `finally` 가 rollback 하므로 커밋되어 잔존할 코드 경로는 없다(같은 파일의 기존 `inRolledBackTx` 패턴과 동일한 관용구, 다만 raw `pg.Client` 대신 TypeORM `QueryRunner` 를 직접 씀 — `qr.manager.save()` 로 RETURNING 값을 받아야 하므로 불가피). `email`/`slug` 는 `Date.now()+Math.random()`·`user.id` 로 유일성을 확보해 동시 실행 e2e 와 충돌하지 않는다. `ModelConfig`/`WorkflowAssistantSession` 엔티티에는 `@AfterInsert`/`EventSubscriber` 등 트랜잭션 밖으로 새는 훅이 없음을 확인했다(`grep -rl EventSubscriber codebase/backend/src` 0건) — 큐잉·webhook 같은 부수 효과는 없다.
  - 제안: 현재 구현으로 충분. 다만 프로세스가 rollback 이전에 강제 종료되면(OOM/SIGKILL) 잔존 프로브 행이 남을 수 있다는 점은 이 파일의 다른 트랜잭션 기반 테스트들과 공통된 기존 리스크이며 이 diff 가 새로 도입한 것은 아니다.

- **[INFO]** 읽기 전용 세션 옵션(`readOnlyDataSourceOptions()`)이 함수로 추출되어 두 테스트가 공유
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:211` (함수 선언), 호출부 568·595
  - 상세: 순수 리팩터 — 이전에 인라인으로 한 번 쓰이던 옵션 객체를 함수로 옮기고 새 회귀 테스트(읽기 전용 DDL 거부)가 재사용한다. 옵션 값 자체(`installExtensions:false`, `extra.options`)는 변경 없이 그대로 이동했으므로 기존 "컬럼 층" 테스트의 동작에는 영향이 없다. 새 테스트는 별도의 `DataSource` 인스턴스를 만들어 `initialize()`→`destroy()` 하므로 e2e DB 커넥션 수가 테스트당 1개 늘어나는 정도이고, 격리된 세션이라 다른 테스트의 상태를 바꾸지 않는다.
  - 제안: 없음(문제 아님).

- **[INFO]** 시그니처/인터페이스 변경 없음
  - 위치: 파일 전체
  - 상세: 이 파일은 e2e 테스트 전용이며 export 되는 심볼이 없다(`describe`/`it` 블록, 모듈 스코프 헬퍼 전부 파일 로컬). 프로덕션 코드의 함수/클래스 시그니처, 공개 API, 환경 변수 스키마는 이 diff 에서 전혀 건드리지 않는다.

- **[INFO]** `plan`·`review` 산출물 파일 추가
  - 위치: `plan/in-progress/column-guard-gaps.md`, `review/consistency/2026/09/20/00_34_58/*`
  - 상세: 프로젝트 관례(`plan/in-progress/`, `review/consistency/<날짜>/`)를 따르는 산출물 신규 생성이며, `--impl-prep` 실행 자체의 target 이 `spec/2-navigation/`(이번 plan 의 실제 대상인 백엔드 컬럼 가드 테스트와 무관)이라는 점은 `plan_coherence` checker 가 이미 INFO 로 자체 지적했고 plan 체크리스트에도 "선례" 로 기록돼 있다 — 이 리뷰가 새로 지적할 부작용은 없다. 저장소 파일시스템에 새 파일을 쓰는 것은 이 워크플로 자체의 정상 동작(리뷰/plan 산출물)이지 코드 실행의 의도치 않은 부작용이 아니다.

## 뮤테이션 검증

가설 확인을 위한 코드 뮤테이션은 수행하지 않았음(정적 분석 + entity 훅 grep 만으로 충분히 판단 가능). 저장소에 쓰기 작업 없음 — `git status --short` 확인 결과 세션 시작 시점의 `review/code/2026/09/20/` untracked 항목 외 변경 없음.

## 요약

이번 diff 는 e2e 테스트 파일 한 곳에 한정된 순수 테스트 추가/리팩터(가독성 개선용 함수 추출·변수 개명·주석, 회귀 테스트 2건 추가)이며, 프로덕션 코드의 함수 시그니처·공개 인터페이스·전역 상태·환경 변수를 전혀 건드리지 않는다. 새로 추가된 두 테스트는 모두 트랜잭션/세션 격리 안에서 동작하고(하나는 별도 읽기 전용 DataSource 로 DDL 거부를 확인, 하나는 QueryRunner 트랜잭션 내 INSERT 후 무조건 ROLLBACK), 대상 엔티티(`ModelConfig`, `WorkflowAssistantSession`)에는 트랜잭션 경계를 벗어나는 이벤트 훅이 없음을 확인했다. `plan/`·`review/` 산출물 추가는 프로젝트 관례에 따른 정상적인 문서 부산물이다. 부작용 관점에서 차단할 사유는 없다.

## 위험도

NONE
