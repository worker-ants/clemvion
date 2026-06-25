# 유지보수성(Maintainability) 리뷰

대상 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
커밋: `b72f634`

---

## 발견사항

### 긍정적 사항

- **[INFO]** `AuthenticatedSocket` 타입 alias 도입으로 핸들러별 인라인 `Socket & {userId?, workspaceId?}` 단언 4곳을 단일 정의로 통합 — 수정 포인트 감소, 타입 의도 명시화.
  - 위치: 파일 상단 `type AuthenticatedSocket = Socket & { ... }`
  - 상세: 이전에는 동일한 인라인 단언이 `handleConnection`, `handleSubscribe`, `emitExecutionSnapshot`, 그리고 각 명령 핸들러에 흩어져 있었음. 이제 단일 진실 지점.

- **[INFO]** `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 상수화로 매직 문자열 5개 제거 — 오타 방지, 값 변경 시 단일 지점 수정.
  - 위치: 상수 선언부 및 5개 핸들러 내 사용처

- **[INFO]** `getCommandAuthContext` / `verifyExecutionOwnership` private helper 추출로 명령 핸들러 5종의 try/catch 보일러플레이트를 조건 검사 2줄로 교체 — 가독성 개선.

---

### 문제 사항

- **[WARNING]** `handleSubscribe` 내 `enriched` 변수가 같은 함수 스코프에서 두 번 선언됨(라인 566, 라인 651).
  - 위치: `handleSubscribe` 함수 내 `const enriched = client as AuthenticatedSocket;` 두 곳
  - 상세: 566번째 줄에서 `enriched`를 선언해 `workspaceId`/`userId`를 추출하고, 649~656 분기(`execution:` 채널 snapshot 발행)에서 다시 `const enriched = client as AuthenticatedSocket;`로 동일한 변수명을 재선언함. 두 번째 선언은 앞의 변수를 재사용하면 되므로 불필요한 중복 캐스팅임. `no-shadow` ESLint 규칙이 활성화된 경우 경고 발생 가능하며, 읽는 사람이 두 번째 캐스팅의 존재 이유를 의심하게 됨.
  - 제안: 라인 651의 `const enriched = client as AuthenticatedSocket;`을 제거하고 라인 566의 `enriched`를 재사용(이미 동일 함수 스코프에 있으므로 접근 가능). `enriched.workspaceId ?? ''`는 그대로 유지.

- **[INFO]** `handleRetryLastTurn` 내 `'Execution not found'` 문자열이 상수화 없이 리터럴로 사용됨(라인 1099).
  - 위치: `handleRetryLastTurn`, `message: 'Execution not found'`
  - 상세: 나머지 4종 핸들러는 `MSG_NOT_AUTHORIZED_EXECUTION` 상수를 사용하지만, retry 핸들러만 `'Execution not found'` 리터럴을 직접 사용함. 테스트가 이 문자열을 정확히 검증한다면(`MSG_NOT_AUTHENTICATED`·`MSG_NOT_AUTHORIZED_EXECUTION`과 같이) 상수화하는 것이 일관성 측면에서 바람직함.
  - 제안: `const MSG_EXECUTION_NOT_FOUND = 'Execution not found';` 추가 후 라인 1099에 적용. 커밋 메시지에서 "retry 핸들러가 문구를 소유"로 의도를 명시했으나, 값의 오타 방지·테스트 일관성을 위해 상수화는 여전히 유효한 선택.

- **[INFO]** `getCommandAuthContext` JSDoc이 함수 본문(9줄) 대비 22줄로 주석 비율이 역전됨.
  - 위치: `getCommandAuthContext` 메서드 위 JSDoc 블록
  - 상세: 주석이 상세한 것은 긍정적이나 "subscribe 경로에는 적용하지 않는다"와 OCP 설명은 함수 책임 범위를 넘는 설계 배경임. 클래스 레벨 주석이나 spec 참조로 위임하면 인라인 가독성이 나아짐.
  - 제안: 필수 정보(`null` 반환 조건, `workspaceId` 정규화 정책)만 남기고 OCP 설명은 클래스 레벨로 이동. 현재 상태도 이해는 가능하므로 강제 사항 아님.

- **[INFO]** `handleSubscribe`의 `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached` 에러 메시지가 세 곳에 중복 등장(라인 558~560, 617~622, 630~636).
  - 위치: `handleSubscribe` 함수 내 세 개의 subscriptions 한도 초과 반환 지점
  - 상세: `MSG_NOT_AUTHENTICATED` 패턴과 달리 이 메시지는 아직 상수화되지 않음. 이번 커밋 범위 밖의 기존 코드이나, 이번 refactor 의 일관성 적용 대상으로 고려할 수 있음.
  - 제안: 별도 이슈로 등록하거나 다음 유지보수 시 `MSG_MAX_SUBSCRIPTIONS_REACHED` 상수 추출.

---

## 요약

이번 리팩토링은 5개 명령 핸들러에 반복되던 인증·소유권 보일러플레이트를 `AuthenticatedSocket` 타입 alias, `MSG_*` 문자열 상수, `getCommandAuthContext`·`verifyExecutionOwnership` private helper로 추출하여 유지보수성을 실질적으로 향상시켰다. 방향성이 올바르고 코드 의도도 명확히 표현되어 있다. 다만 `handleSubscribe` 내 `const enriched = client as AuthenticatedSocket` 중복 선언(라인 566·651)은 동일 함수 스코프 내 불필요한 재선언으로, 라인 651 제거로 즉시 정리 가능한 WARNING 수준 항목이다. `retry_last_turn` 핸들러의 `'Execution not found'` 리터럴도 나머지 상수 패턴과의 일관성을 위해 상수화를 검토할 만하다. 전체적으로 중복 제거·가독성·일관성 모두 개선된 변경이며 blocker 없다.

---

## 위험도

LOW
