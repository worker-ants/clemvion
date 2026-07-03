# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `handleSubscribe` 함수가 매우 길고 순차 가드 체인이 많음(단일 책임 초과 경향)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156` ~ `280`대 (`handleSubscribe`)
  - 상세: 이번 변경(M-3)으로 `await client.join(channel)` + try/catch 롤백 블록이 추가되면서 함수가 채널 유효성 검사 → 인증 확인 → 구독 한도 검사 → authorizer 조회/fail-closed → workspace 검사 → authorize() → tentative-add 재검증(원자 블록) → join 실패 롤백 → snapshot 트리거까지, 8단계 이상의 순차 분기를 한 함수 안에서 처리한다. 각 단계 주석은 훌륭하지만 함수 자체의 순환 복잡도(early-return 분기 9개 이상)가 높아 신규 채널 인가 로직 추가 시 실수 여지가 커진다. 이미 "MAX_SUBSCRIPTIONS" 체크가 두 번(라인 초반 예비 체크 + tentative-add 이후 재검증) 등장해 동일한 에러 응답 블록이 3곳에서 거의 동일하게 반복된다(중복 코드 항목 참고).
  - 제안: 필수 리팩터는 아니나, "한도 검사+add+rollback" 블록과 "join+rollback" 블록을 각각 private 메서드로 추출하면 가독성이 개선된다(예: `reserveSubscriptionSlot(clientSubs, channel): boolean`, `joinChannelOrRollback(...)`). 현재도 주석 밀도가 높아 이해 가능한 수준이라 CRITICAL/WARNING 은 아님.

- **[INFO]** 동일한 "Maximum subscriptions" 에러 응답 객체가 3곳에서 리터럴 중복
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (초기 사이즈 체크, `isNewSubscription` 이후 재검증, 이 diff 범위 밖)
  - 상세: `{ event: 'subscribed', data: { success: false, error: \`Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached\` } }` 형태가 반복된다. 이번 diff 자체가 추가한 중복은 아니고 기존 패턴이지만, 이번에 추가된 join 실패 응답(`Subscription failed — please retry`)도 같은 `{event:'subscribed', data:{success:false,error:...}}` shape 을 손으로 다시 조립하고 있어 helper 부재가 계속 누적되는 경향.
  - 제안: `subscribeFail(error: string)` 같은 소형 helper 로 응답 조립을 통일하면 향후 wire shape 변경 시 단일 지점 수정으로 충분해진다. 우선순위 낮음(INFO).

- **[INFO]** 주석 대비 코드 비율이 높아 일부 블록의 신호 대 잡음비가 낮음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:228`~`263` (원자 블록 주석), `use-execution-events.ts` M-6/m-5 관련 블록
  - 상세: 동시성 관련 근거를 상세히 남기는 것은 이 코드베이스의 명시적 컨벤션(과거 회귀 방지 히스토리 기록)으로 보이며 실제로 유지보수 시 유용하다. 다만 `handleSubscribe` 안에서 "원자 블록" 주석(6줄)과 "tentative-add 사후 가드" 주석(3줄)이 짧은 코드 사이에 낀 형태라 로직을 눈으로 따라가기보다 주석을 읽는 데 더 시간이 걸린다.
  - 제안: 필요 시 위에서 제안한 함수 추출과 함께 주석을 함수 docstring으로 승격하면 본문 가독성이 개선된다. 현재 수준도 CRITICAL 은 아니며, 오히려 팀의 "왜"를 남기는 규약(README/CLAUDE.md의 Rationale 원칙)과 일관됨.

- **[INFO]** `bind()` 헬퍼 도입으로 중복 제거는 잘 되었으나 `use-execution-events.ts` 자체의 파일 길이/함수 길이는 여전히 큼(사전 존재 이슈, 이번 diff 범위 아님)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:2580`(`bind` 헬퍼), 이하 15개 이벤트 등록
  - 상세: 이번 변경은 `client.on(...)` 15회 반복 호출을 `bind(...)`로 통일해 off-before-on 중복 등록 방지 로직을 한 곳(헬퍼)에 모은 점이 **가독성/중복 제거 측면에서 명확한 개선**이다(15개소에 각각 방어 로직을 심지 않고 헬퍼 하나로 캡슐화). 다만 `useExecutionEvents` 훅 자체는(diff 밖) 원래도 매우 큰 함수이며 이번 변경이 그 크기를 줄이지는 않는다.
  - 제안: 범위 밖이므로 조치 불요. 향후 리팩터링 백로그 후보로만 언급.

- **[INFO]** `use-execution-events.ts` 의 hysteresis 타이머 값(`1000`ms, `500`/`600`ms 테스트값)이 매직 넘버
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:2655`(`setTimeout(..., 1000)`), 테스트 `use-execution-events.test.ts:2267`,`2272`
  - 상세: dismiss 지연 `1000`ms 가 인라인 리터럴로 박혀 있다. 옆의 `warnTimer`(기존 코드, `10_000`)는 그대로 유지되나 이번에 추가된 `1000`은 이름 있는 상수가 아니다. 값 자체는 주석으로 의도(hysteresis)가 설명되어 있어 이해에는 문제 없다.
  - 제안: `WS_WARNING_DISMISS_HYSTERESIS_MS = 1000` 같은 상수로 추출하면 기존 `10_000` warn 임계값과 나란히 정의 위치가 명확해진다. 사소하므로 INFO.

- **[INFO]** 테스트 파일의 "off 호출 횟수가 2배가 된다"는 어써션이 구현 세부사항(off-before-on)에 결합
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2296`,`2304` (`expect(connectOffCalls.length).toBe(4)`, `expect(resumedOffCalls.length).toBe(2)`)
  - 상세: `bind()` 헬퍼 구현이 "등록 시 dedup-off + cleanup-off" 이기 때문에 호출 횟수가 정확히 2배(2, 4)가 되는 것을 그대로 assert 한다. 정확성 측면에서는 옳지만, 이 테스트는 `bind()` 내부 구현(등록 시점에도 off 호출)에 강하게 결합되어 있어 향후 dedup 전략이 바뀌면(예: `once` 기반, ref 카운팅 등) 무관한 이유로 깨질 수 있다. 새 테스트(`registers each handler off-before-on`)가 이미 이 계약을 명시적으로 검증하고 있으므로, 기존 cleanup 테스트의 "정확한 횟수" 어써션은 다소 중복된 관심사를 섞은 형태.
  - 제안: 필수는 아님. 원한다면 cleanup 테스트는 "off 가 최소 1회 이상 호출되고, 최종적으로 리스너가 남지 않는지"를 검증하는 방향으로 완화하면 구현 결합도가 낮아진다. 현재도 회귀 방지 목적에는 부합하므로 INFO.

## 요약

이번 변경은 06-concurrency 리팩터의 마무리 배치로, WS gateway 의 `join`/`leave` 를 await 하여 실패를 롤백하는 방어 로직(M-3), 프런트 훅의 이벤트 리스너 중복 등록 방지(`bind` 헬퍼, M-6), dismiss hysteresis(m-5), `ws-client` 의 connecting 상태 가드(m-3) 를 추가한다. 전반적으로 각 변경 지점에 "왜"를 설명하는 상세 주석이 일관되게 달려 있고, 이름 있는 상수(`MAX_SUBSCRIPTIONS_PER_CONNECTION`, `WsErrorCode.*`)와 기존 helper(`buildContinuationErrorAck`, `verifyExecutionOwnership`) 재사용 패턴을 그대로 따르는 등 코드베이스 컨벤션과의 일관성이 높다. 프런트 `bind()` 헬퍼 도입은 15개소의 반복 등록 로직을 한 곳으로 모아 중복을 실질적으로 줄인 좋은 리팩터다. 다만 `handleSubscribe` 는 이번 추가로 순차 가드/롤백 단계가 더 늘어나 함수 하나가 담당하는 책임(유효성 검사·인증·인가·구독 한도·room 멤버십 동기화)이 여전히 많고, 유사한 에러 응답 리터럴이 여러 곳에 반복된다 — 다만 이는 이번 diff 가 새로 만든 문제라기보다 기존 구조 위에 한 단계를 더 얹은 것이며, 팀이 이미 상세 주석으로 각 단계의 의도를 남기고 있어 즉각적인 가독성 저해로 보기는 어렵다. CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도
LOW
