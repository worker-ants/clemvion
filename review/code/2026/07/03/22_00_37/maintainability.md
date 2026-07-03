# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `handleSubscribe` 응집도 — 인가·구독 한도(사전/사후 이중 가드)·join 원자성 롤백·snapshot 발행까지 단일 메서드에 집중
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `handleSubscribe` (156행~300행대, 이번 diff 는 `try { await client.join(channel) } catch` 블록 129-142행 상당 추가)
  - 상세: 순차 분기가 8개 이상(인가 → 사전 한도검사 → tentative-add → 사후 한도검사+롤백 → join await → join 실패 롤백 → snapshot 발행)으로 순환 복잡도가 높다. 각 단계 주석(TOCTOU 가드 근거, Redis adapter 도입 시 실효 등)은 상세하고 유용하지만, 메서드 하나가 "인가 + 동시성 가드 + room 멤버십 + snapshot 트리거" 4가지 관심사를 모두 처리한다.
  - 제안: 즉시 조치 불필요(테스트 커버리지 양호, 기능 결함 없음). 후속 여유 시 `reserveSubscriptionSlot(clientSubs, channel)` / `joinChannelOrRollback(client, channel, clientSubs)` 형태의 private 헬퍼로 추출해 메서드당 책임을 좁히는 것을 고려.

- **[INFO]** "Maximum subscriptions" 에러 응답 리터럴 3중복
  - 위치: `websocket.gateway.ts:185, 246, 260` — 세 지점 모두 `` error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached` `` 동일 템플릿 문자열을 반복
  - 상세: 숫자 자체는 `MAX_SUBSCRIPTIONS_PER_CONNECTION` 상수(28행)로 이미 추출되어 매직 넘버 문제는 없으나, `{ event: 'subscribed', data: { success: false, error: ... } }` 응답 조립 블록이 통째로 3곳에서 반복된다. 사전 한도검사·사후 한도검사(TOCTOU 재검증)·이번 diff 는 관여하지 않지만 동일 패턴이 join 실패 분기에도 이어짐(`Subscription failed — please retry` 응답 조립).
  - 제안: 선택적. `subscribeFail(error: string)` 같은 작은 헬퍼로 응답 조립을 통일하면 3곳의 응답 shape 이 어긋날 위험(예: 한 곳만 `errorCode` 추가되는 드리프트)을 방지할 수 있다. 이번 저위험 배치 범위 밖이라 필수 아님.

- **[INFO]** dismiss hysteresis 지연 시간(`1000`)이 인라인 매직 넘버
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1187` (`setTimeout(() => { toast.dismiss(...) }, 1000)`), 인접한 기존 `warnTimer` 의 `10000`(1195행 부근)과 함께 두 숫자 모두 이름 없이 하드코딩
  - 상세: `1000`ms 는 "reconnect flap 흡수용 hysteresis 지연"이라는 명확한 의미를 갖지만 상수화되어 있지 않아, 향후 이 값을 조정하거나 기존 `10000`(무-snapshot 경고 임계치)과의 관계(예: hysteresis 가 임계치보다 충분히 작아야 한다는 불변식)를 코드만 보고 파악하기 어렵다.
  - 제안: `WS_WARNING_DISMISS_HYSTERESIS_MS = 1000` 같은 이름 있는 상수로 추출(파일 상단 또는 `10000` 과 나란히). 사소하며 선택적.

- **[INFO]** frontend `bind()` off-before-on 헬퍼 도입 — 반복 코드 제거 잘됨
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`bind` 로컬 함수 정의 + 기존 19개 `client.on(` 전체를 `bind(` 로 치환)
  - 상세: 이중 등록 방어 로직을 20개 가까운 호출부에 각각 흩뿌리지 않고 단일 헬퍼로 캡슐화한 것은 좋은 중복 제거 사례다. 네이밍(`bind`)도 "등록"이라는 의도를 간결히 전달하며 기존 `client.on(...)` 호출 스타일과 자연스럽게 이어진다.
  - 제안: 없음(양호).

- **[INFO]** 테스트가 `bind()` 구현 세부(off 호출 횟수)에 결합
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` — `connectOffCalls.length).toBe(4)`, `resumedOffCalls.length).toBe(2)` 단언
  - 상세: "등록 시 dedup-off 1회 + cleanup 시 off 1회 = 2배"라는 구현 디테일이 테스트 기댓값 숫자에 그대로 노출된다. `bind()` 내부 구현이 바뀌면(예: dedup 전략 변경) 테스트가 직접 깨지는 결합도이나, 회귀 가드로는 유효하고 주석(266-267행)이 "왜 4/2 인지" 근거를 남겨 가독성은 확보했다.
  - 제안: 완화는 선택적("최종적으로 리스너가 이벤트당 1개만 남는지" 같은 동작 기반 단언으로 대체 가능). 이번 배치에서 강제할 필요는 없음.

- **[INFO]** 백엔드 join/leave try/catch 블록의 로그 메시지 포맷 일관성 양호
  - 위치: `websocket.gateway.ts` 신규 join 실패(129-142행 상당) / leave 실패(163-173행 상당) 블록
  - 상세: 두 catch 블록 모두 `` `Client ${client.id} <verb>(${channel}) 실패 ...: ${err instanceof Error ? err.message : String(err)}` `` 패턴을 동일하게 사용해 로그 검색·grep 일관성이 좋다. 다만 이 패턴 자체도 2곳 반복이라 위 리터럴 중복 지적과 같은 결로, 로깅 헬퍼(`this.logWarnFailure(action, client, channel, err)`) 추출 여지가 있으나 2곳뿐이라 과도한 추상화가 될 수 있어 현행 유지가 합리적.
  - 제안: 없음(2회 반복은 DRY 강제 임계 미만으로 판단).

- **[INFO]** 주석 밀도와 품질이 전반적으로 높아 가독성에 긍정적
  - 위치: 6개 변경 파일 전반(M-3/M-6/m-3/m-5 태그가 붙은 모든 블록)
  - 상세: 각 방어 로직마다 "왜 필요한지(예: Redis adapter 도입 시 비동기화)", "왜 이 위치인지", "부작용 없음을 어떻게 보장하는지(동일 참조만 off)"를 근거 있게 설명한다. plan 문서(`06-concurrency.md`) 항목 ID(M-3/M-6/m-3/m-5)를 코드 주석에 병기해 추적성도 확보했다. 유지보수성 관점에서 모범적인 패턴.
  - 제안: 없음(양호, 향후 유사 작업의 참고 사례로 유지).

## 요약

이번 diff 는 06-concurrency 플랜의 잔여 4개 항목(M-3 join await+롤백, M-6 리스너 이중 등록 방어, m-3 connect churn 가드, m-5 dismiss hysteresis)을 각 계층의 기존 구조를 그대로 활용해 국소적으로 보강한 저위험 변경이다. 새 추상화 도입 없이 기존 패턴(try/catch, 로컬 헬퍼, setTimeout)을 일관되게 사용했고 주석 품질이 높아 의도 파악이 쉽다. 다만 `handleSubscribe` 가 인가·한도가드·join 원자성·snapshot 트리거까지 한 메서드에 응집되어 순환 복잡도가 높은 점, "Maximum subscriptions" 에러 응답 조립이 3곳에서 반복되는 점, hysteresis 타이머 값이 이름 없는 매직 넘버로 남아 있는 점은 모두 기능적 결함은 아니나 선택적 리팩토링 여지다. 테스트가 `bind()` 내부 off 호출 횟수에 결합된 점도 사소한 유지보수 부담이나 근거 주석이 있어 즉각적 위험은 아니다. 전체적으로 가독성·네이밍·기존 코드베이스 스타일 일관성은 양호하며, 지적 사항은 모두 CRITICAL/WARNING 이 아닌 선택적 개선 수준이다.

## 위험도
LOW
