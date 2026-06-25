# 아키텍처(Architecture) 리뷰

대상 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
커밋: `b72f634` — refactor(websocket): C-4 명령 핸들러 5종 인증+소유권 보일러플레이트 helper 추출

---

## 발견사항

- **[INFO]** `AuthenticatedSocket` 타입 alias — 단일 책임 통합 적절
  - 위치: 라인 77-80 (type alias 선언)
  - 상세: 5개 핸들러에서 반복되던 인라인 `Socket & {userId?, workspaceId?}` 단언을 하나의 alias 로 통합한 것은 DRY 원칙을 지키며 타입 표현 책임을 한 곳으로 모은다. 주석에서 `ChannelAuthorizerContext` 와의 혼용 금지를 명시한 점도 모듈 경계 오염을 차단하는 적절한 설계 의도다.
  - 제안: 현행 유지.

- **[INFO]** `getCommandAuthContext` / `verifyExecutionOwnership` — 판단과 응답 조립의 분리
  - 위치: 라인 736-768
  - 상세: 두 helper 모두 ack payload 를 생성하지 않고 `null | {userId, workspaceId}` / `boolean` 만 반환한다. ack wire shape 의 차이(`retry_last_turn` nested vs. continuation 4종 flat)를 각 핸들러가 소유하게 한 결정은 단일 책임 원칙에 부합하며, helper 가 caller 의 응답 형태를 알아야 하는 역전 관계를 피한다. 의존성 방향이 올바르다.
  - 제안: 현행 유지.

- **[INFO]** `subscribe` 경로에 `getCommandAuthContext` 미적용 — OCP 보존 의도적 설계
  - 위치: 라인 564-600 (`handleSubscribe`)
  - 상세: `channelAuthorizers` 전략 맵(refactor 02 M-7) 이 담당하는 구독 인가 경로에 명령 핸들러용 helper 를 도입하지 않은 결정은 두 책임(구독 인가 vs. 명령 실행 인증)을 명확히 분리한다. 신규 채널 추가 시 gateway 본문을 수정하지 않아도 되는 OCP 구조를 유지한다.
  - 제안: 현행 유지.

- **[WARNING]** `WebsocketGateway` 클래스 크기 — 단일 책임 경계 긴장
  - 위치: 전체 클래스 (1246라인)
  - 상세: 현재 클래스는 (1) 연결/인증 생명주기(`handleConnection`/`handleDisconnect`), (2) 구독 관리(`handleSubscribe`/`handleUnsubscribe`), (3) 5종 명령 핸들러, (4) 인증/소유권 보조 로직(`getCommandAuthContext`/`verifyExecutionOwnership`), (5) ack 빌더(`buildContinuationErrorAck`), (6) 채널 브로드캐스트(`broadcastToChannel`) 를 한 클래스에 담는다. 이번 C-4 리팩터 자체는 DRY 를 개선했지만 클래스의 책임 수는 줄지 않았다. 향후 명령 유형 추가 시 클래스가 지속 비대해지는 성장 경로가 열려 있다.
  - 제안: 즉각 분리 불필요(현 변경 범위 밖)이지만, 후속 슬라이스에서 `ExecutionCommandHandler` 류의 별도 서비스/파사드로 명령 핸들러 5종 + 보조 helper 를 추출하는 방향을 고려할 것. 이번 C-4 의 helper 설계는 그 추출을 쉽게 만드는 준비 단계로 볼 수 있다.

- **[INFO]** `emitExecutionSnapshot` 내 `verifyOwnership` 직접 호출 — 일관성 소폭 이탈
  - 위치: 라인 665-691 (`emitExecutionSnapshot`)
  - 상세: `emitExecutionSnapshot` 은 명령 핸들러가 아니라 `handleSubscribe` 에서 호출되는 내부 메서드이므로 `verifyExecutionOwnership` helper 적용 제외가 합리적이다. 그러나 동일한 `try/catch → boolean 환원` 패턴을 내부적으로 다시 구현하고 있다(`catch (error)` 후 snapshot 스킵). 이 경로는 이미 구독 인가(`channelAuthorizers`)를 통과한 뒤라 소유 검증이 이중 방어라는 점에서 의미가 다르므로 직접 호출이 잘못된 것은 아니지만, 미래 유지보수자가 두 검증 경로의 차이를 이해해야 하는 인지 부하가 생긴다.
  - 제안: 현행 유지 허용. 주석에 "구독 경로의 IDOR 이중 방어 — verifyExecutionOwnership helper 와 의도적으로 분리" 한 줄 추가 권장(인지 부하 최소화).

- **[INFO]** 모듈 파일 레벨 상수 — 범위 적절
  - 위치: 라인 442-443 (`MSG_NOT_AUTHENTICATED`, `MSG_NOT_AUTHORIZED_EXECUTION`)
  - 상세: 파일 레벨 `const` 로 선언되어 모듈 외부로 노출되지 않는다. subscribe 경로의 인라인 리터럴과 의도적으로 분리한 결정은 두 계약(subscribe 인가 vs. 명령 인증) 간 커플링을 차단하는 올바른 경계 설계다.
  - 제안: 현행 유지.

- **[INFO]** 순환 의존성 — 없음
  - 위치: 생성자 주입 (`forwardRef` 사용 대상)
  - 상세: `ExecutionEngineService`, `RetryTurnService`, `ExecutionsService` 에 대해 `forwardRef` 를 유지하고 있으며, 이번 변경에서 새 의존성을 추가하지 않았다. 순환 참조 구조의 증가는 없다.
  - 제안: 현행 유지.

---

## 요약

이번 C-4 리팩터는 5개 명령 핸들러에 산재한 인증/소유권 보일러플레이트를 `getCommandAuthContext`(인증 컨텍스트 추출)와 `verifyExecutionOwnership`(소유 검증 boolean 환원) 두 private helper 로 중앙화하여 DRY 원칙과 응집도를 개선했다. 두 helper 가 ack payload 조립 책임을 갖지 않고 판단만 수행하는 설계는 단일 책임 원칙을 준수하며, `retry_last_turn` 의 nested ack shape 과 continuation 4종의 flat shape 차이를 각 핸들러가 독자적으로 소유하는 구조를 보존한다. subscribe 경로의 `channelAuthorizers` OCP 구조도 침범하지 않았다. 아키텍처상 주목할 긴장 지점은 `WebsocketGateway` 클래스가 여전히 6종 책임을 담고 있다는 점이나, 이는 이번 변경 범위를 벗어난 기존 설계 부채이며 C-4 가 이를 악화시키지는 않았다. 전체적으로 behavior-preserving 리팩터로서 아키텍처 방향이 올바르다.

---

## 위험도

LOW
