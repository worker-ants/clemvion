# 동시성(Concurrency) 코드 리뷰 — 웹훅 경로 영구 예약 (V133), 2라운드

## 검토 범위 및 방법

이번 라운드(`review/code/2026/09/19/20_13_30`)는 직전 라운드(`review/code/2026/09/19/19_44_33`)가 이미 전수 검토한 동일 기능(V133
웹훅 경로 영구 예약)의 후속 diff다. 직전 concurrency 리뷰가 남긴 WARNING 1건·INFO 1건이 이번 라운드에서 어떻게 처리됐는지를 중심으로,
`git diff origin/main...HEAD` 로 이번에 새로 늘어난/바뀐 내용 전체를 다시 대조했다:

- `CHANGELOG.md` — 문서, 동시성 무관
- `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` — 트리거 함수 주석 갱신(격리 수준 서술 추가)
- `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` — **신규 e2e 하나 추가**: 두 개의 독립 `pg.Client` 로 같은 새
  경로를 실제로 동시에 잡는 경합 테스트 (전체 파일을 `Read` 로 직접 열람)
- `codebase/backend/test/webhook-trigger.e2e-spec.ts` — `expectConflict`/`expectPathConflict` 중복 헬퍼 통합(순수 리팩터, 순차 호출 그대로)
- `codebase/backend/src/modules/triggers/triggers.service.ts`, `triggers.controller.ts`, `triggers.service.spec.ts` — 이번 라운드에서는
  주석/문자열/it.each 축 확장뿐, `create()`/`update()`/`rethrowEndpointPathConflict()`의 로직 자체는 불변(직접 `Read` 로 재확인)
- 나머지(review/consistency 산출물, spec 5개, plan draft)는 산문 문서로 동시성 코드 없음

저장소 파일은 전혀 수정하지 않았다(`git status --short` 확인 — 이번 세션 출력 디렉터리 외 변경 없음).

## 직전 라운드 WARNING 해소 확인

직전 concurrency 리뷰(`review/code/2026/09/19/19_44_33/concurrency.md`) WARNING: "이 기능이 닫으려는 '진짜 경쟁 조건'이 새 테스트
어디에서도 **동시 실행**으로 검증되지 않는다" — 이번 라운드가 정확히 이 갭을 메웠다.

`webhook-endpoint-reservation.e2e-spec.ts` 의 신규 `it('동시에 처음 잡는 같은 경로 — 커밋되면 기다리던 쪽은 주인 라벨로 거부, 롤백되면
기다리던 쪽이 주인이 된다', ...)` (파일 전체 217~317행, 프롬프트에서는 diff 생략 — 파일 직접 열람으로 확인)를 트레이스했다:

- 두 개의 진짜 `pg.Client`(`first`, `second`)를 별도 연결로 만들어 같은 완전히 새로운 `endpointPath` 로 서로 다른 워크스페이스의
  트리거를 삽입한다.
- `first`가 `BEGIN` 후 삽입(트리거 함수 내부의 `INSERT ... ON CONFLICT (endpoint_path) DO NOTHING`이 신규 키라 즉시 성공, 아직
  커밋 안 됨) → `second`가 같은 경로로 삽입 시도 → Postgres의 `ON CONFLICT` 는 같은 키를 잡고 있는 미확정 트랜잭션이 있으면 그
  트랜잭션의 커밋/롤백까지 대기하는 것이 문서화된 동작이므로 `second`는 실제로 블록된다.
- 인터리빙 지점을 추측이 아니라 `pg_stat_activity.wait_event_type = 'Lock'` 폴링(`waitUntilSecondBlocks`, 최대 5초)으로 **실측
  확인**한 뒤에만 `first`를 커밋/롤백시킨다 — "확인 없이 끝내면 순서대로 돈 것과 구별되지 않는다"는 파일 자신의 주석대로, 우연히
  순차 실행돼도 통과하는 거짓 통과를 막는 설계다.
- (a) 커밋 분기: `second`가 재개된 뒤 `ON CONFLICT DO NOTHING`이 스킵되고 재조회(`SELECT`)가 `first`의 주인을 보아
  `webhook_endpoint_reservation_owner` 라벨로 거부됨을 `code:'23505'`까지 단언. **PK 위반이 아니라 주인 라벨로 거부된다**는,
  이 기능이 존재하는 이유(단순 PK 유일성만으로는 예약을 가르지 못함)를 정확히 겨냥한 단언이다.
- (b) 롤백 분기: `first`가 롤백하면 충돌 행이 사라져 `second`가 정상적으로 예약을 얻고(`ownerOf` 가 `ws.b`), 에러 없이 통과함을
  확인 — 실패한 생성이 경로를 영구히 묶어버리는 회귀(가짜 tombstone)를 방지하는 방향도 함께 검증한다.
- 두 연결 사이에 대기 사이클이 없어(오직 `second → first` 단방향 대기) 데드락 가능성 없음. `finally` 에서 `first.end()`/
  `second.end()`로 정리하며, 폴링이 타임아웃돼 예외가 나도 각 연결의 미종료 트랜잭션은 `.end()` 로 서버 측에서 자동 롤백되므로
  잠금이 누수되지 않는다.

결론: 이 WARNING은 **실효적으로 해소**됐다 — 실제 인터리빙을 관측 기반으로 재현하고, 이 기능의 핵심 주장(단일 PK 승자 결정 +
패자는 주인 라벨로 거부, 승자 롤백 시 예약 이전)을 양방향으로 검증한다.

## 직전 라운드 INFO 해소 확인

직전 INFO: "트리거 함수의 정합성이 암묵적으로 READ COMMITTED를 전제한다"에 대해, 이번 라운드는 `V133__webhook_endpoint_reservation.sql`
게이트 42~46행(트리거 함수 주석)에 "호출 트랜잭션이 REPEATABLE READ 이상이면 위 INSERT 가 직렬화 실패(40001)로 끝난다(실측) —
쓰기는 막히지만 409 가 아니다. 서비스는 격리 수준을 올리지 않는다."를 명시적으로 추가했다. 이 서술은 Postgres의 문서화된
`INSERT ... ON CONFLICT` 동작(REPEATABLE READ/SERIALIZABLE 에서 동시 충돌 시 40001 직렬화 실패)과 부합하고, "실측"이라 표기해
근거가 있음을 밝혔다. `create()`/`update()` 어디에도 격리 수준을 올리는 코드가 없다는 사실도 이번에 grep 으로 재확인했다
(`this.triggerRepository.manager.transaction(...)` 호출부에 isolation level 인자 없음). 정보 격차가 문서로 닫혔다 — 조치 불요.

## 새로 확인한 사항 (참고용 INFO, 조치 불요)

- **[INFO]** 새 경합 e2e 의 인터리빙 감지가 폴링 기반(최대 5초, 25ms 간격)이다
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` — `waitUntilSecondBlocks` (게이트 없음, 파일 전체
    260~270행)
  - 상세: `pg_stat_activity.wait_event_type` 을 최대 200회 폴링해 `'Lock'` 을 확인한다. 정상적인 로컬/CI 환경에서는 락 대기가
    거의 즉시 나타나 문제가 되지 않지만, 극단적으로 자원이 부족한 CI 러너에서 5초 안에 락 대기 상태로 전이하지 못하면
    `throw new Error('두 번째 연결이 잠금 대기에 들어가지 않았다')` 로 실패한다. 이는 기능 결함이 아니라 테스트 자체의 타이밍
    의존성이며, 실패 시 원인이 명확한 에러 메시지로 나오므로 디버깅 비용은 낮다.
  - 제안: 조치 불요 — 이미 "확인 없이 끝내면 순서대로 돈 것과 구별되지 않는다"는 근거로 폴링을 의도적으로 선택했다고 주석에
    남겨져 있다. 향후 이 테스트가 CI 에서 flaky 로 보고되면 타임아웃을 늘리는 정도로 충분하다.

- **[INFO]** 타임아웃 분기에서 `loser`/`winner` 프라미스가 관찰되지 않은 채 남을 수 있음(현재 코드 경로상 문제로 이어지지 않음)
  - 위치: 같은 파일, `it('동시에 처음 잡는 같은 경로 ...')` 본문 — `const loser = insert(second, 'b', committed).then(() => null,
    (err) => err)` 가 `waitUntilSecondBlocks()` 호출 **이전**에 생성됨
  - 상세: `waitUntilSecondBlocks` 가 타임아웃으로 예외를 던지면 `loser`(또는 `winner`)는 그 이후 `await` 되지 않고 `finally` 로
    바로 넘어간다. 다만 두 프라미스 모두 `.then(resolve, reject)` 형태로 rejection 핸들러가 이미 붙어 있어 unhandled rejection
    으로 이어지지 않고, `finally` 의 `client.end()` 가 서버 측 미종료 트랜잭션을 정리하므로 실질적인 부작용(잠금 누수·좀비
    연결)은 없다. 이 경로는 폴링이 타임아웃되는 예외적 상황(이미 테스트 실패가 확정된 상태)에서만 발생한다.
  - 제안: 조치 불요 — 정상 경로에는 영향이 없고, 발생해도 이미 실패로 보고되는 테스트의 부수 효과일 뿐이다.

## 요약

이번 diff의 동시성 관련 실질 변경은 새 경쟁-조건 e2e(두 독립 `pg.Client` 로 같은 신규 경로를 실제로 동시에 잡는 시나리오)와
트리거 함수 주석의 격리 수준 서술 보강 두 가지다. 직전 라운드(`19_44_33`)가 남긴 유일한 WARNING("진짜 경쟁 조건이 동시 실행으로
검증되지 않는다")은 이번에 추가된 e2e가 `pg_stat_activity` 기반 실측 인터리빙 확인 + 커밋/롤백 양방향 분기 검증으로 실효적으로
해소했으며, 함께 남았던 INFO(격리 수준 암묵 전제)도 실측 문구로 명시됐다. `triggers.service.ts`의 실제 동시성 강제 로직(DB
트리거에 전적으로 위임, 앱 레벨 check-then-act 없음)은 이번 라운드에서 변경되지 않았고 재확인 결과도 이전과 동일하게 건전하다.
새로 발견한 항목은 테스트의 폴링 타임아웃·미관찰 프라미스에 대한 INFO 2건으로, 둘 다 실패 경로에서만 관측 가능하고 실질적 결함으로
이어지지 않는다.

## 위험도

LOW
