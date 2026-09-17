# 데이터베이스(Database) 리뷰

## 검토 범위

`TriggersService.update()`(창 1)의 저장 방식을 "재읽은 엔티티 통째 `save`"에서 "이 요청이
바꾸는 필드만 담은 부분 객체 `save`"로 좁힌 변경이 핵심이다. 관련 파일:
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`(신규),
`codebase/backend/src/modules/triggers/triggers.service.spec.ts`,
`codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`,
`CHANGELOG.md`, `plan/in-progress/trigger-save-partial-patch.md`. 나머지(`review/consistency/**`)는
스펙·plan 문서 산출물로 DB 코드 변경이 아니다.

## 발견사항

- **[POSITIVE/INFO]** advisory lock 안에서 lost update 를 제거하는 방향은 올바르고 실측으로 뒷받침된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:632-715` (트랜잭션 블록), 특히
    `:679-711`(부분 객체 save 근거 주석)과 `:707`(`m.save(Trigger, { id: target.id, ...defined, config: mergedConfig })`)
  - 상세: 종전엔 락 안에서 재읽은 엔티티를 통째로 `save`했는데, TypeORM `save()`는 저장 시점 DB
    값과 "엔티티가 다른 컬럼"을 되쓰므로, 재읽기 **뒤** 락 밖에서 커밋된 컬럼
    (`notification_secret_v2`, `last_triggered_at`, `chat_channel_token_v2`, schedule 동기화의
    `name`/`is_active`)이 옛 값으로 되써지는 실제 lost update 였다. 이를 부분 객체 저장으로 좁혀
    넘기지 않은 컬럼을 비교 대상에서 빼는 방식은 advisory lock 의 범위·시맨틱을 바꾸지 않고
    타이밍과 무관하게 문제를 없앤다. `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`
    가 실제 Postgres + TypeORM 조합으로 트랜잭션 A 재읽기 → 연결 B 커밋 → A 저장 순서를 강제
    재현해 통째 저장(회귀 재현) vs 부분 저장(수정 확인) 양쪽을 모두 단언으로 고정했다. 코드
    레벨(`repo.save` 호출 인자의 키 집합)과 DB 레벨(실제 컬럼 값) 양쪽에서 계약이 고정되어 있어
    회귀 방지 신뢰도가 높다.
  - 제안: 조치 불요 — 확인용 긍정 항목.

- **[INFO]** 수정의 전제가 TypeORM `save()`의 "부분 객체 diff" 내부 동작에 의존한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:679-706` (주석), `:707`
  - 상세: "`save()`에 넘긴 객체에 없는(undefined) 컬럼은 UPDATE SET 절에서 빠진다"는 동작은
    TypeORM 이 공식 API 계약으로 문서화한 것이 아니라 내부 구현 세부사항이다. 팀이 이를
    `trigger-update-save-window.e2e-spec.ts`로 실제 Postgres 위에서 characterization 테스트로
    박제해 "TypeORM 이 바뀌면 이 파일이 먼저 RED"가 되게 만든 점은 이런 종류의 암묵적 의존을
    다루는 올바른 방식이다. 다만 이 e2e 파일이 정기 CI(`run-test-all.sh` e2e 단계 등)에 실제로
    편입되어 있는지, TypeORM 업그레이드 시 우선 확인 대상으로 문서화(예: `package.json` TypeORM
    버전 변경 체크리스트)되어 있는지는 이번 diff 범위 밖이라 확인하지 못했다.
  - 제안: 이번 라운드에서 조치 불요. TypeORM 버전을 올리는 향후 PR 에서 이 e2e 파일을 우선
    실행/확인하도록 절차에 남겨두면 좋다.

- **[INFO]** `save()`가 `update()`보다 advisory lock 보유 시간을 늘릴 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:632-715`(트랜잭션 블록 전체),
    `:634`(`acquireTriggerConfigLock`), `:707`(`m.save`)
  - 상세: `save()`는 대상 행 존재 여부 확인과 컬럼 diff를 위해 내부적으로 추가 조회를 수행할 수
    있는 반면 `update()`는 단일 UPDATE 문으로 끝난다. 이 블록은 이미 `pg_advisory_xact_lock`을
    보유한 채 실행되므로, 저장 동사로 `save()`를 유지하는 한 `update()`보다 락 보유 시간이 약간
    길어져 동시 PATCH 트래픽이 많아질 경우 대기(`SET LOCAL lock_timeout`) 초과 빈도에 영향을 줄
    수 있다. 다만 PR 문서(`plan/in-progress/trigger-save-partial-patch.md` "설계" 절)에 따르면
    `update()` + 재조회로 바꿨다가 반환 엔티티·subscriber·`endpointPath` UNIQUE 충돌 처리가 함께
    달라져 단위 6건이 RED 가 된 이력이 있어, `save()` 유지는 의도적이고 문서화된 트레이드오프다.
  - 제안: 이번 PR 에서 별도 조치 불요. 트리거 PATCH 트래픽이 늘어나는 시점에 `lock_timeout` 초과
    율을 관측 지표로 추가하는 것을 고려할 수 있다.

- **[INFO]** FK CASCADE 경합(①)은 "시끄러운 실패"로 남고, 그 에러가 도메인 코드로 매핑되지
  않은 채 재던져진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:716`
    (`.catch((err: unknown) => this.rethrowEndpointPathConflict(err))`), `:1628-1653`
    (`rethrowEndpointPathConflict` — endpointPath 충돌이 아니면 `throw err`로 원본 재던짐)
  - 상세: 재읽기 뒤 `workflow`가 동시에 삭제(FK CASCADE)되는 경합은 이번 수정으로 "조용한
    lost update"에서 "시끄러운 롤백(23503 통째 엔티티 / 23502 부분 객체)"으로 바뀌었다 — 트리거
    행이 되살아나지 않는다는 점에서 데이터 정합성 관점의 개선이다. 다만 `rethrowEndpointPathConflict`
    는 `isEndpointPathUniqueViolation` 이 아닌 에러를 원본 그대로 재던지므로, 이 경합이 실제
    발생하면 Postgres 원본 에러(`QueryFailedError`)가 그대로 상위로 전파되어 NestJS 기본 예외
    필터를 거쳐 도메인 의미 없는 500 으로 노출될 가능성이 높다. plan 문서 자신도 "이 경로는 이
    PR 이 만든 것이 아니다"라고 명시하며, `spec/5-system/15-chat-channel.md §5.4` 에러 표에
    이 케이스를 반영하는 후속을 별도 트래킹(consistency INFO#1)하고 있다.
  - 제안: 이번 PR 범위 밖 — 이미 추적 중인 후속 작업으로 충분하다. 다만 §5.4 에러 표 갱신이
    실제로 집행될 때까지는 클라이언트가 이 경합과 다른 500 에러를 구분할 수 없다는 점만 재확인
    차 기재한다.

- **[정보]** e2e 신규 테스트의 커넥션 관리·SQL 파라미터화는 적절
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:74-105`
    (`beforeAll`/`afterAll`), `:118-119`·`:161-164`·`:193-196` 등 raw `db.query` 호출
  - 상세: 별도 `DataSource`와 `pg.Client`를 생성해 트랜잭션 경합을 직접 재현하고, `afterAll`에서
    `ds.destroy()`/`db.end()`를 `.catch(() => undefined)`로 감싸 정리해 커넥션 누수가 없다. raw
    쿼리는 전부 `$1`/`$2` 파라미터 바인딩을 사용하며, 리터럴이 섞인 `UPDATE ... SET
    notification_secret_v2 = 'v2-from-B'` 형태도 테스트 코드 내 고정 상수일 뿐 사용자 입력이
    아니라 인젝션 표면이 아니다.
  - 제안: 조치 불요.

- **인덱스 / N+1 / 마이그레이션 / 스키마 설계 / 대량 데이터**: 이번 diff 는 단건 트리거 행에 대한
  저장 방식 변경일 뿐 새 쿼리 패턴(반복문 내 개별 쿼리)·스키마 변경·마이그레이션·페이지네이션
  대상 쿼리를 포함하지 않는다. 해당 관점에서는 특이사항 없음.

## 요약

핵심 변경은 advisory lock 안에서 재읽은 트리거 엔티티를 통째로 `save`하던 것을 부분 객체
`save`로 좁혀, 재읽기 이후 락 밖에서 커밋된 컬럼(회전된 secret, 마지막 트리거 시각, cron 이 지운
토큰, 스케줄 동기화 필드)이 옛 값으로 되써지던 실제 lost update 를 제거한다. TypeORM + 실제
Postgres 를 붙인 characterization e2e 로 회귀(통째 저장)와 수정(부분 저장) 양쪽을 코드·DB 레벨
모두에서 고정해 검증 신뢰도가 높고, 커넥션 정리와 파라미터화된 SQL 사용도 적절하다. 남는 것은
전부 INFO 수준으로 — TypeORM 내부 diff 동작에 대한 의존(e2e 로 이미 완화), `save()` 가
`update()` 대비 락 보유 시간을 다소 늘릴 수 있다는 점(문서화된 트레이드오프), FK CASCADE 경합이
아직 도메인 에러로 매핑되지 않은 채 재던져진다는 점(이미 별도 후속으로 추적 중)이다. 이번 diff
범위에서 신규로 발생한 CRITICAL/WARNING 급 DB 결함은 발견되지 않았다.

## 위험도
LOW
