# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 실제 코드 변경(핵심 검토 대상)
- `plan/in-progress/column-guard-gaps.md` — plan 문서(신규), 코드 없음
- `review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**` — 1라운드 리뷰/consistency-check 산출물(markdown·json). 정적 리포트일 뿐 실행되는 코드가 아니므로 부작용 관점이 성립하지 않는다.

핵심 대상 파일은 신규 `readOnlyDataSourceOptions()` 헬퍼 추출과 두 개의 신규 `it()` — "비교기 연결은 읽기 전용이다" · "선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다" — 이다. 아래는 이 둘을 중심으로 실측 검증한 결과다.

## 발견사항

- **[INFO]** 신규 "기본값 왕복" 테스트가 공유 e2e DB 의 실 테이블(`user`/`workspace`/`workflow`)에 raw INSERT 후 `ModelConfig`·`WorkflowAssistantSession` 을 `manager.save` 로 저장 — 부수 효과 경로를 독립적으로 재확인함
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 신규 `it('선언한 DB 기본값은...')` (615~662행), 관련 엔티티 `codebase/backend/src/modules/model-config/entities/model-config.entity.ts`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`
  - 상세: 두 엔티티 모두 `@BeforeInsert`/`@AfterInsert`/`@AfterLoad` 등 라이프사이클 훅이 없고, `EventSubscriber` 구현체를 백엔드 소스 전체에서 검색해도 0건이다. `dataSourceOptions()`(및 이를 펼쳐 쓰는 `readOnlyDataSourceOptions()`)도 `subscribers` 옵션을 지정하지 않는다. 대상 테이블(`user`/`workspace`/`workflow`/`model_config`/`workflow_assistant_session`)의 마이그레이션에서 트리거·`NOTIFY`/`LISTEN` 도 0건. 즉 이 insert 가 BullMQ enqueue·webhook·감사로그 등 트랜잭션 밖으로 새는 부수 효과를 유발할 경로가 없음을 실측으로 확인했다 — 1라운드 SUMMARY 의 side_effect INFO #8("부수 효과 없음")과 결론이 같다.
  - 제안: 조치 불요(검증 기록).

- **[INFO]** `readOnlyDataSourceOptions()` 헬퍼가 의미상 서로 다른 두 테스트("컬럼 정의 비교기" 테스트와 "읽기 전용 방어" 테스트)의 연결 옵션을 공유한다 — 의도된 결합이지만 향후 수정 시 양쪽에 동시에 영향
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:212` (`function readOnlyDataSourceOptions()`), 사용처 `:569`(컬럼 층 테스트), `:596`(신규 읽기 전용 방어 테스트)
  - 상세: 헬퍼 자체의 JSDoc(206~210행)이 "여기서 옵션을 지우면 뒤쪽 테스트가 RED" 라고 이미 명시하고 있어 의도된 설계다. 다만 이는 "한 함수를 고치면 두 개의 독립적으로 서술된 테스트 동작이 동시에 바뀐다"는 공유 상태이므로, 나중에 이 헬퍼에 (예: 다른 목적으로) 옵션을 추가/완화하면 두 테스트 모두 조용히 영향을 받는다. 이번 diff 가 새로 만든 결합이 아니라 기존에 두 곳에 중복돼 있던 것을 DRY 로 추출한 것이며 오히려 드리프트 위험(두 인라인 정의가 나중에 서로 달라지는 것)을 줄인 방향이다.
  - 제안: 조치 불요 — 다만 이 헬퍼를 다시 만질 때는 두 사용처 모두를 함께 검토할 것(이미 헬퍼 JSDoc 에 그 경고가 있음).

- **[INFO]** 신규 테스트의 `QueryRunner` 트랜잭션은 프로세스가 ROLLBACK 이전에 강제 종료되면 probe 행이 남을 수 있음 — 이 파일의 기존 트랜잭션 기반 테스트들과 동일한 기존 리스크이며 이번 diff 가 새로 도입한 것은 아님
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663`
  - 상세: `try`/`finally` 로 `rollbackTransaction()` → `release()` 순서를 보장하지만(1라운드 WARNING #2 조치로 이미 `connect()`/`startTransaction()` 도 `try` 안으로 이동돼 있음을 diff 로 확인), OS 레벨 강제종료·OOM 등 정상적인 `finally` 실행 자체가 불가능한 상황에서는 `default-probe-*` 행이 공유 e2e DB 에 남을 수 있다. 같은 파일의 다른 트랜잭션 기반 테스트(`inRolledBackTx` 를 쓰는 인덱스/CHECK 테스트)도 동일한 구조적 전제를 공유하므로 이번 변경만의 신규 위험은 아니다.
  - 제안: 조치 불요.

- **[정보/검증]** 시그니처·공개 인터페이스·전역 변수·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 변경 — 모두 해당 없음
  - 위치: 파일 전역
  - 상세: `readOnlyDataSourceOptions()` 는 파일 내부 전용 신규 헬퍼(export 없음)라 외부 호출자에 영향이 없다. 기존 함수 `dataSourceOptions()` 의 시그니처·동작은 변경되지 않았다(스프레드로 재사용만 함). `process.env.DB_HOST` 등은 기존과 동일하게 읽기 전용으로만 접근하며 새 환경 변수는 도입되지 않았다. 신규 코드가 호출하는 대상은 로컬 Postgres(`db`)와 테스트 전용 `DataSource` 뿐이라 외부 서비스 네트워크 호출이 없다. `plan/in-progress/column-guard-gaps.md`, `review/**` 산출물은 문서/리포트로 런타임 부작용과 무관하다.
  - 제안: 조치 불요.

## 부기 — 작업 트리 관측 사항 (본 세션의 뮤테이션 아님)

리뷰 종료 시점 작업 트리 상태 조회에 아래 두 파일이 **본 리뷰가 대상으로 받은 diff 밖에서** 수정 상태로 잡혔다. 본 세션은 이 두 파일을 열거나 고친 적이 없다(사용한 도구는 리뷰 대상 소스 확인용 Read·조회 명령, 그리고 `output_file` Write 뿐이다) — 병렬로 같은 워크트리를 쓰는 다른 세션(다른 reviewer 또는 developer)의 변경으로 추정된다. 원복은 시도하지 않았다 — 이 리뷰 규약이 금지하는 복원 명령 없이는 안전하게 되돌릴 수 없고, 내가 만든 변경이 아니므로 임의로 손대면 그 세션의 작업을 잃을 수 있다.

- 수정 상태: `plan/in-progress/harness-review-gate-followups.md`
- 수정 상태: `plan/in-progress/spec-draft-nullable-notation-followups.md`

이 두 파일은 이 리뷰의 프롬프트가 나열한 리뷰 대상 파일 목록(entity-schema-declarations.e2e-spec.ts · column-guard-gaps.md · review 산출물)에 포함돼 있지 않으므로, 위 발견사항·위험도 판정에는 반영하지 않았다. 통합 SUMMARY 작성자는 다른 병렬 reviewer/세션이 이 변경의 주체인지 확인 필요.

## 요약

핵심 변경(`readOnlyDataSourceOptions()` 추출 + 두 개의 신규 e2e 테스트)은 실행 시점에 실제 DB에 raw INSERT 를 수행하지만, (1) 트랜잭션 ROLLBACK 으로 격리되고 (2) 대상 엔티티·테이블 어디에도 TypeORM lifecycle 훅·`EventSubscriber`·DB 트리거/NOTIFY 가 없음을 실측으로 재확인했으며 (3) 커넥션 해제 순서(`connect`→`startTransaction`을 `try` 안, `finally`에서 `isTransactionActive` 체크 후 롤백 → `release`)가 이미 1라운드 조치로 안전하게 구성돼 있다. 공개 시그니처·환경 변수·네트워크 호출·전역 상태에 대한 의도치 않은 변경은 발견되지 않았다. 유일하게 언급할 만한 점은 새 헬퍼가 두 테스트의 동작을 결합한다는 것과, 프로세스 강제종료 시의 잔존 행 가능성인데 둘 다 기존 설계·기존 패턴과 일관되고 문서화돼 있어 INFO 수준이다. 별도로, 본 리뷰 대상 diff 와 무관한 두 plan 파일이 워크트리에서 수정 상태로 관측됐으나 본 세션이 만든 변경이 아니며 손대지 않았다(위 "부기" 참고).

## 위험도

NONE
