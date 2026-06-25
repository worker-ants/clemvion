# Rationale 연속성 검토 결과

검토 범위: refactor 03 C-4 — WebsocketGateway 5개 명령 핸들러 인증+소유권 보일러플레이트 behavior-preserving 추출
커밋: b72f634e + review-fix 203222a3
diff-base: origin/main

---

## 발견사항

### [INFO] helper 이름이 plan 권고와 다름 (기능 동등, spec 위반 없음)
- **target 위치**: `websocket.gateway.ts` — `getCommandAuthContext(client)` / `verifyExecutionOwnership(executionId, workspaceId)`
- **과거 결정 출처**: `plan/in-progress/refactor/03-maintainability.md §C-4 개선 방안 1`
  - 권고 이름: `requireAuthenticated(client)` + `requireOwnership(executionId, workspaceId)`
- **상세**: plan 이 권고한 이름은 `requireAuthenticated` / `requireOwnership` 이지만 구현에서는 `getCommandAuthContext` (컨텍스트 반환형) / `verifyExecutionOwnership` (boolean 반환형) 으로 명명됐다. 이름은 달라졌으나 핵심 제약(ack 포맷 결정권을 핸들러에 유지, shape 차이 보존)은 동일하게 준수됐다. spec 위반은 없고 plan 의 함수명 권고를 부드럽게 번복한 수준이다. plan 갱신 없이 구현이 이루어진 것으로, 트레이서빌리티 관점의 갭이다.
- **제안**: `plan/in-progress/refactor/03-maintainability.md §C-4` 의 함수명 항목을 `getCommandAuthContext` / `verifyExecutionOwnership` 으로 업데이트(또는 "구현 시 재명명 허용" 주석 추가). 기능적 정합성은 검증됨.

### [INFO] `verifyExecutionOwnership` 의 boolean 반환 방식 — §7.1 IDOR 정책의 예외적 추상화
- **target 위치**: `websocket.gateway.ts` — `verifyExecutionOwnership` private helper (try/catch → boolean)
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §7.1` · `## Rationale §3.3 채널 인가`
  - 핵심 invariant: "`verifyOwnership` 은 NotFound 로 통일 — Forbidden 으로 응답하면 attacker 가 executionId 존재 여부를 추론할 수 있다"
- **상세**: helper 는 `executionsService.verifyOwnership()` 의 throw(NotFound 포함 모든 예외)를 catch 해 `false` 로 평탄화한다. 이로 인해 호출 핸들러는 "거부 이유(NotFound/Forbidden/DB오류)"를 알 수 없고 단일 `MSG_NOT_AUTHORIZED_EXECUTION` 문자열을 보낸다. spec §7.1 의 "NotFound 통일" 원칙은 "공격자에게 executionId 존재 여부를 노출하지 말라"는 것이므로, 내부 예외 종류를 모두 단일 거부로 묶어 노출 면을 줄이는 현 구현은 오히려 §7.1 취지에 부합한다. `retry_last_turn` 핸들러는 helper 를 사용하지 않고 spec 에 명시된 nested `error:{code:NOT_FOUND, message:'Execution not found'}` shape 를 직접 보내며 이것도 §7.1 정책과 정렬된다. spec 위반 없음. 다만 "예외 타입별 분기가 필요한 미래 핸들러" 에서 helper 가 정보를 은닉한다는 trade-off 는 향후 기록 필요성이 있다.
- **제안**: 필요 시 `spec/5-system/6-websocket-protocol.md ## Rationale` 에 "명령 핸들러 helper 가 예외를 boolean 으로 평탄화하는 이유(공격자 정보 노출 최소화 — §7.1 정책 확장 적용)" 를 INFO 수준 보충 항목으로 추가.

### [INFO] `§3.3 subscribe` 경로의 명시적 분리 — 기존 채널 인가(OCP) 구조 훼손 없음
- **target 위치**: `getCommandAuthContext` JSDoc 및 `MSG_NOT_AUTHORIZED_EXECUTION` 상수 주석
  - "subscribe 경로에는 적용하지 않는다 — 채널 인가는 `channelAuthorizers`(OCP, 02 M-7)가 담당"
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §3.3` + `## Rationale §3.3 채널 인가 refactor 04 M-6` + `plan/in-progress/refactor/03-maintainability.md §C-4 개선 방안 3`
  - 합의 원칙: `§3.3 구독 거부의 평문 error 포맷은 spec 명문화 — 변경 금지`
- **상세**: 구현은 `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 상수를 명령 핸들러 5종에만 적용하고, subscribe/unsubscribe 경로(`handleSubscribe`)의 리터럴은 그대로 유지했다. 코드 주석이 경계를 명시적으로 설명하고 있어 추후 개발자가 실수로 상수를 subscribe 경로에 합성할 위험도 낮다. 계획의 "§3.3 변경 금지" 합의가 정확히 지켜졌다.
- **제안**: 없음. 정합 확인.

---

## 요약

refactor 03 C-4 구현은 `plan/in-progress/refactor/03-maintainability.md §C-4` 의 핵심 설계 원칙(ack 포맷 결정권을 핸들러에 유지, §7.2 shape 차이 보존, §3.3 subscribe 미변경) 을 전부 준수했다. spec/6-websocket-protocol.md §7.1 의 IDOR-NotFound 통일 invariant, §4.2 의 continuation 4종 flat vs retry nested ack shape 차이, §3.3 의 채널 인가(channelAuthorizers OCP) 분리 원칙 모두 위반 없다. 유일한 지적 사항은 plan 이 권고한 함수명(`requireAuthenticated`/`requireOwnership`)을 구현이 `getCommandAuthContext`/`verifyExecutionOwnership` 으로 재명명한 것인데, 이는 Rationale 에 기록된 결정의 번복이 아니라 plan 내 명칭 권고의 가벼운 이탈이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 어느 항목도 해당하지 않는다.

---

## 위험도

NONE
