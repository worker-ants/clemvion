# 테스트(Testing) 리뷰

대상: `Execution.error` / `NodeExecution.error` 내부 REST(+WS `execution.snapshot`) 읽기
경로 egress 마스킹 (`redact-stored-error.ts` 신설 + `executions.service.ts` /
`background-runs.service.ts` 적용) 및 관련 plan/spec 문서 갱신.

## 발견사항

- **[WARNING]** JSDoc 이 명시한 "레거시 문자열·숫자 통과" 보장이 테스트로 고정되지 않았다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:52-53` (JSDoc 주장),
    `:63`(런타임과 어긋날 수 있는 캐스트) / `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` 전체(해당 케이스 부재)
  - 상세: 함수 JSDoc 은 "`@param err` … jsonb 라 레거시 문자열·숫자가 들어와도
    `deepRedactSecrets` 가 타입을 보존하며 통과시킨다" 고 명시적으로 약속한다. 그런데
    TS 시그니처는 `err: Record<string, unknown> | null | undefined` 로 객체만 받는 것처럼
    선언돼 있고, 반환문은 `deepRedactSecrets(err) as Record<string, unknown>` 로 **무조건
    객체로 캐스트**한다. 실제로 legacy `Execution.error` 값이 (엔티티 타입 선언과 달리)
    런타임에 순수 문자열/숫자로 들어오면 `deepRedactSecrets` 는 `redactSecrets(string)` 을
    거쳐 **문자열**을 반환하는데, 이 캐스트는 그것도 `Record<string, unknown>` 이라고
    호출부에 거짓말한다. `redact-stored-error.spec.ts` 의 캐너리 2건은 "자격증명 없는
    연결 문자열"·"평범한 메시지" 같은 **문자열 message 필드** 케이스만 다루고, `err`
    **자체**가 object 가 아닌 케이스(문서가 명시적으로 언급하는 시나리오)는 어느 스펙
    파일에도 없다 — `deepRedactSecrets` 쪽 spec(`sanitize-error-message.spec.ts:175-179`)
    이 `42`/`null`/`true` 는 통과 확인하지만, 이 래퍼(`redactStoredErrorForResponse`) 를
    거쳐서도 형태가 보존되는지, 그리고 그 반환값을 호출부가 object 로 spread(`...ne,
    error: redactStoredErrorForResponse(ne.error)`) 할 때 실제로 문제가 없는지는 검증되지
    않는다. 이 저장소가 "문서한 보장이 구현보다 넓으면 안 된다" 는 교훈을 이미 여러 번
    반복해서 얻은 바 있어 특히 이 패턴과 정확히 일치한다.
  - 제안: `redact-stored-error.spec.ts` 에 `redactStoredErrorForResponse('legacy string' as
    never)` / `redactStoredErrorForResponse(42 as never)` 형태의 캐너리 테스트를 하나 추가해
    실제 런타임 형태 보존을 이 래퍼 경계에서 직접 고정하거나, 그럴 일이 실제로 없다면(엔티티
    컬럼이 애초에 object 로만 쓰인다면) JSDoc 의 "레거시 문자열·숫자" 문구를 제거해 보장
    범위를 실제 타입 계약과 일치시킨다.

- **[INFO]** `findById` 캐시-히트 경로 테스트가 최상위 `error` 만 검증하고
  `nodeExecutions[].error` 는 검증하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:884-904`
    (`①-b findById 의 마스킹은 캐시 안쪽이다`)
  - 상세: 이 테스트는 캐시 히트 시 `result.error` 가 여전히 마스킹돼 있는지만 단언한다.
    `nodeExecutions[].error` 마스킹(형제 필드 우회 방지, ⑤ 테스트가 비-캐시 경로에서
    검증)이 캐시 히트 경로에서도 유지되는지는 별도로 단언하지 않는다. 소스상
    `reconciledNodeExecutions` 와 `toResponseExecution(execution)` 이 같은 `snapshot`
    객체 리터럴 안에서 함께 조립된 뒤 한 번에 캐시에 쓰이므로(`executions.service.ts`
    `findById`, `writeSnapshotCache` 직전) 실질 위험은 낮지만, 두 관심사(캐시 우회·형제
    필드 우회)가 겹치는 지점을 직접 겨눈 단언은 아니다.
  - 제안: 급하지 않음. `①-b` 에 `nodeExecutions` 항목을 하나 추가해 캐시 히트 응답의
    `nodeExecutions[0].error` 도 `MASKED` 인지 함께 단언하면 두 축(캐시·형제 필드)의
    교차 지점까지 커버리지가 닫힌다.

## 긍정적으로 확인된 부분 (회귀 방지 관점에서 특기할 만함)

- **표면 전수 판별력**: `Execution.error` 마스킹 관문(`toResponseExecution`)이 3곳
  (`findById`·`getChain`·`stop`)에서 공유되고 `toExecutionDto`(목록)는 별도 호출인데,
  `executions.service.spec.ts` 의 신설 `describe('Execution.error 응답 마스킹 — 표면
  전수', …)` (약 843~1069행대)가 ①findById ②findByWorkflow ③getChain ④stop(정상)
  ④-b stop(`affected=0` 분기) ⑤nodeExecutions[] 형제 필드까지 **각 반환 지점을 개별
  테스트로 겨눈다**. 이 저장소가 반복해서 겪은 "자매 넷 중 하나만 하드닝" 결함 형태를
  정확히 겨눈 커버리지 설계이고, `plan/in-progress/eia-internal-rest-error-masking.md`
  에 첨부된 뮤테이션 매트릭스(표면별 뮤턴트 → 실패 테스트 수가 갈림)로 판별력까지
  뒷받침된다. 실제로 `redact-stored-error.spec.ts` +
  `executions.service.spec.ts` + `background-runs.service.spec.ts` 3개 스펙 파일을
  직접 실행해 64/64 통과를 확인했다.
- **동등 교체(약화 아님)**: `stop()` 기존 테스트의 `expect(result).toBe(afterCancel)`
  (참조 동일성)가 마스킹 관문이 복사본을 반환하면서 깨질 수밖에 없게 됐는데, 단순 완화
  대신 `toMatchObject({id, status: RUNNING})` + `not.toMatchObject({status:
  WAITING_FOR_INPUT})` 조합으로 **원래 단언의 의도**(stale 최초 lookup 이 아니라 cancel
  후 재조회 결과)를 그대로 보존했다(`executions.service.spec.ts:744-758`). "결과 값이
  같으면 뭐든 통과" 식의 항상-참 완화가 아니라 원 의도를 내용 기반으로 재현한 좋은 예다.
- **Mock 적절성**: `redact-stored-error.spec.ts` 는 `deepRedactSecrets` 를 mock 하지
  않고 실제 구현을 그대로 통과시킨다. 함수 자체가 얇은 위임(null 정규화 + 위임)이라
  mock 을 쓰면 오히려 실제 동작과의 괴리를 만들 뿐이므로 이 선택이 맞다. 두 캐너리
  테스트("자격증명 없는 연결 문자열"·"평범한 메시지")는 `deepRedactSecrets` 의 보장
  경계를 이 래퍼 레벨에서도 명시적으로 고정해, 향후 누군가 패턴을 넓히면 여기서도
  의도적으로 RED 가 뜨도록 설계돼 있다 — 좋은 캐너리 사용례다.
- **테스트 격리**: 세 스펙 파일 모두 `beforeEach` 에서 mock 저장소를 새로
  만들고(`background-runs.service.spec.ts:105-116`, `executions.service.spec.ts:107`),
  `mockReturnValueOnce`/`mockResolvedValueOnce` 로 호출 순서를 명시적으로 제어해 테스트
  간 공유 mutable state 가 없다.
- **회귀 유효성**: `stripPrivateRelations` → `toResponseExecution` 이름 변경은 private
  메서드라 외부에서 직접 참조하는 기존 테스트가 없고(`grep` 확인), 재사용 3곳(`findById`
  ·`getChain`·`stop`) 각각의 기존 동작(관계 객체 제거)은 새 테스트들이 간접적으로
  계속 exercise 한다. 회귀 파손 없음.

## 요약

핵심 변경(egress 마스킹 관문 확장)에 대한 테스트 설계는 이 저장소가 반복적으로 겪어 온
"자매 표면 중 하나만 하드닝" 결함 패턴을 정확히 겨냥해 반환 지점별로 개별 discriminating
테스트를 두었고, 완화가 필요했던 기존 단언(`stop` 의 참조 동일성)도 원 의도를 보존하는
방식으로 등가 교체했다. mock 사용도 절제돼 있고 테스트 격리도 양호하다. 발견된 갭은
경계적(legacy 비-object `err` 입력에 대한 JSDoc 약속이 테스트로 뒷받침되지 않음, 캐시×형제
필드 교차 지점 미검증) 수준이며 둘 다 실제 회귀를 놓칠 위험은 낮다.

## 위험도

LOW
