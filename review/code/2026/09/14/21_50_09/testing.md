# 테스트(Testing) Review

## 검토 범위

`trigger.config` lost-update 수정 (advisory lock + 락 안 재읽기)의 최종 상태를 코드
관점에서 확인했다. 핵심 파일을 직접 열어 실제 소스를 대조했다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `codebase/backend/src/repo-guards/__tests__/*` (정적 가드 + fixture)

이 PR 은 이미 여러 라운드의 `/ai-review` 를 거치며 testing 지적을 **뮤테이션으로 실측
확인**해 가며 닫아 온 이력이 코드 주석·CHANGELOG 에 그대로 남아 있다(예:
`trigger-config-lock.spec.ts`, `trigger-transaction-mock.ts`, `triggers.service.spec.ts`
"락 안 재읽기" describe 블록). 아래는 그 이력을 전제로, 남아 있는 갭만 추린 것이다.

## 발견사항

- **[WARNING]** `remove()` 실패 시의 "로그로 남긴다" 절반이 어떤 테스트로도 관측되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:984-991` (`.catch` 블록의
    `this.logger.error(...)` 호출), 대응 테스트는
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3929-3948`
    (`'remove() 실패는 삼키지 않고 던진다 — 반쯤 삭제된 상태를 드러낸다'`)
  - 상세: `CHANGELOG.md:41` 과 `trigger-config-lock.ts` 의 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
    JSDoc 이 명시한 설계 목표는 "상한을 넘기면 그 사실을 **로그로 남기고** 오류로 드러낸다 —
    조용한 지연보다 낫다" 다. 실제 구현은 두 동작(① `logger.error` 호출, ② `throw err`)을
    모두 하는데, 해당 테스트는 `rejects.toThrow('lock timeout')` 과 감사 미기록만 단언하고
    `Logger.prototype.error` 를 spy 하지 않는다. 즉 ①번 절반은 이 테스트만으로는 검증되지
    않는다 — `this.logger.error(...)` 호출을 통째로 지워도(메시지만 지우고 `throw err` 는
    남기면) 이 테스트는 여전히 GREEN 이다. 같은 파일의 `rotateBotToken` 502 테스트(`:2035-2061`)
    는 정확히 이 패턴("응답에 안 남는 원문이 로그에만 남는다")을 `warn` spy 로 고정해 뒀는데,
    `remove()` 쪽만 그 짝이 없다. 이 PR 자신이 반복해서 지적해 온 *"관측 고리가 없으면 보증도
    없다"* 원칙이 이 한 자리에는 아직 적용되지 않은 상태다.
  - 제안: 위 테스트에 `jest.spyOn(Logger.prototype, 'error').mockImplementation(...)` 를
    추가하고(try/finally 로 원복 — `:2037-2039` 의 warn spy 패턴 재사용), 로그 메시지에
    trigger id 가 포함되는지까지 단언하면 로깅 보증이 실제로 잠긴다.

- **[INFO]** DELETE 경로의 실제 lock-timeout 계약(진짜 Postgres `55P03`)은 e2e 로 재현되지 않는다
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (전체) vs
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3853-3874`
    (`'remove() 도 같은 config 락을 잡는다'`)
  - 상세: e2e 는 PATCH-vs-PATCH lost update 시나리오만 실제 Postgres 로 재현한다. `remove()`
    가 `SET LOCAL lock_timeout` 을 걸고 삭제도 같은 advisory lock 으로 직렬화한다는 계약은
    unit 테스트에서 mock(`withTransactionMock`)의 SQL 문자열·호출 순서로만 검증된다 — 실제로
    다른 트랜잭션이 락을 쥔 상태에서 `remove()` 가 5초 뒤 정말 `55P03` 으로 실패하는지는
    어떤 테스트도 실행하지 않는다. `remove() 실패는 삼키지 않고 던진다` 테스트도 `removeRejects`
    옵션으로 **에러를 인위적으로 주입**할 뿐, 타임아웃 자체를 유발하지 않는다. 삭제 경로가
    이 PR 이 새로 도입한 유일한 "실패해도 되는(오히려 실패해야 하는)" 분기라는 점에서, 최소
    한 번은 진짜 계약(락 보유 중 삭제 시도 → 지정 시간 내 에러)을 e2e 로 고정해 둘 가치가
    있다. 다만 심각도는 낮다 — mock 검증이 SQL 문자열·순서를 정확히 보고 있고, `lock_timeout`
    자체는 Postgres 표준 기능이라 통합 리스크가 크지 않다.
  - 제안: 여유가 있으면 기존 e2e 파일 패턴(`lockDb` 로 advisory lock 선점)을 재사용해
    "락을 쥔 채 DELETE 요청 → `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 안에 5xx" 케이스를 하나
    추가. 이번 배치를 막을 사유는 아니다.

## 긍정적으로 확인한 점 (참고)

- `trigger-config-lock.spec.ts` 가 헬퍼의 계약(락 우선순위, 재읽은 값 사용, `columns`/`config`
  스프레드 순서, 삭제-경합 시 `false`+머지 미호출)을 각각 독립된 `it()` 으로 분리해 확실히
  잡고 있고, 모든 케이스가 "왜 이 케이스가 필요한가" 를 뮤테이션 실측과 함께 주석에 남긴다.
- `trigger-transaction-mock.ts` 는 `freshFindOne`/`onLock`/`onLockTimeout` 관측 고리를 명시적으로
  제공해, "두 읽기가 같으면 lost-update 수정이 검증되지 않는다" 는 구조적 함정을 이미 스스로
  찾아 고쳐 뒀다(주석에 실측 수치까지 기록).
  `triggers.service.spec.ts:3602-3961` 의 "락 안 재읽기" describe 블록은 `withoutRef`/`withRef`
  fixture 가 서로 다른 판정을 내도록 설계돼(같은 값이면 뮤턴트가 못 걸린다는 교훈을 직접
  반영) 판별력 있는 테스트를 구성한다.
- `chat-channel-input-rules.spec.ts` 의 신규 `extractInboundSigningRef` 테스트는 `it.each` 로
  7개 입력 형태(정상/누락/null/undefined 조합)를 모두 커버한다.
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture 트리오는 정적 가드의 새 판별 조건
  (`manager.save(Trigger, …)` 형태)에 대해 양성(`managerSaveWrapped`)·음성(`managerSaveUnwrapped`)·
  대상외(`managerSaveOtherEntity`) 세 fixture 를 모두 갖춰 가드 자체의 회귀도 잡는다.
- e2e(`trigger-config-lost-update.e2e-spec.ts`)는 겹침을 우연에 맡기지 않고 advisory lock 을
  테스트가 직접 쥐어 결정적으로 재현하며, 세 단언(①값 유실 ②ref 유실 ③손대지 않은 키 유실)이
  서로 다른 자리를 물어 하나만 남기는 편집이 조용히 통과하지 못하게 설계돼 있다.

## 요약

이번 변경분의 테스트는 이미 다수의 리뷰 라운드를 거치며 mutation testing 으로 자기 검증을
반복한 결과물로, 헬퍼 단위(`trigger-config-lock.spec.ts`)·서비스 단위(`triggers.service.spec.ts`)·
e2e(`trigger-config-lost-update.e2e-spec.ts`)·정적 가드(`repo-guards/__tests__`) 네 계층 모두에서
판별력 있는 fixture 와 순서·형태 단언을 갖추고 있다. 남은 갭은 두 가지뿐이다: `remove()` 실패
시의 `logger.error` 호출이 어떤 테스트로도 관측되지 않아(§CHANGELOG 가 명시한 "로그로 남긴다"
약속의 절반이 비어 있음) WARNING 하나, 그리고 DELETE 경로의 실제 lock-timeout 계약을 e2e 로
재현하는 테스트가 없다는 INFO 하나다. 둘 다 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
