# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance checker 에서 Critical 위배 2건 발견. 구현 착수 전 helper 설계 제약 확인 필요.

## 전체 위험도
**MEDIUM** — Critical 2건 모두 "plan 권장안 A 를 벗어나 helper 가 ack payload 를 직접 조립하거나, 상수화 시 값을 변경할 경우" 에만 위반이 발생하는 구현 경계 경고. plan 설계 자체는 spec 과 정합하나, 구현 단계에서 경계를 명확히 지키지 않으면 §4.2 wire shape 계약과 §3.3 명문 문자열이 깨진다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `getCommandAuthContext` / `verifyExecutionOwnership` helper 가 ack payload 자체를 생성하면 `retry_last_turn` (nested `error:{code,message}`) 과 4종 continuation (평면 `error: string`) 의 wire shape 분리가 붕괴됨 | 계획된 `getCommandAuthContext` 반환값 소비 패턴 전반 (`websocket.gateway.ts` 5개 핸들러) | `spec/5-system/6-websocket-protocol.md §4.2` — 두 ack 계층이 "의도된 분리"로 명문화됨 | helper 반환 타입을 `{ userId: string; workspaceId: string } \| null` (인증) / `boolean` (소유권) 으로 고정하고, ack payload 조립은 반드시 각 핸들러가 직접 담당. plan `03-maintainability.md §C-4` 권장안 A 가 이 원칙을 이미 명시 — 이탈하지 않는다. |
| 2 | Convention Compliance | `'Not authenticated'` 상수화 시 값이 바뀌면 `handleSubscribe` L153·L192 의 §3.3 명문 wire 문자열이 함께 변경됨 | `handleSubscribe` L153, L192 (`websocket.gateway.ts`) | `spec/5-system/6-websocket-protocol.md §3.3` — 구독 거부 평문 error 문자열이 명문화된 wire 계약 | 상수화 후 값이 정확히 `'Not authenticated'` 로 유지되는지 확인. 상수 선언 옆에 `// spec §3.3 명문 문자열 — 값 변경 금지` 주석 필수. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `verifyExecutionOwnership` helper 또는 `'Not authorized for this execution'` 상수가 `retry_last_turn` 에 획일 적용될 경우, `retry_last_turn` 소유권 거부 ack 가 nested shape → flat shape 로 교체되는 구현 오류 위험 | `handleRetryLastTurn` L668~689 (소유권 거부 분기) | `spec/5-system/6-websocket-protocol.md §4.2` Rationale — "retry_last_turn 의 nested `error:{code,message}` 는 의도된 분리" | `verifyExecutionOwnership` helper 는 소유권 판단만 담당(boolean 반환). `retry_last_turn` 소유권 거부 ack 는 기존 nested shape `{success:false, resumed:false, error:{code:WsErrorCode.NOT_FOUND, message:'Execution not found'}}` 를 핸들러가 직접 조립. `'Not authorized for this execution'` 상수는 4종 continuation 전용으로만 적용. |
| 2 | Convention Compliance | `verifyExecutionOwnership` helper 의 예외 처리 전략이 두 가지 소유권 실패 ack 포맷(retry_last_turn nested vs 4종 flat)에 대해 명확히 분기되지 않으면 spec §4.2 를 위반하는 구현이 생길 수 있음 | `handleRetryLastTurn` L677~689 vs `handleSubmitForm` L354~364, `handleClickButton` L430~439, `handleSubmitMessage` L506~514, `handleEndConversation` L575~585 | `spec/5-system/6-websocket-protocol.md §4.2` | helper 가 boolean 반환 후 각 핸들러가 if-branch 로 자신의 ack shape 을 직접 조립. throw 방식 채택 시에도 retry_last_turn catch 와 4종 continuation catch 가 각각 자신의 ack shape 을 조립해야 함. |
| 3 | Convention Compliance | `AuthenticatedSocket` 타입 alias 를 파일 로컬로 정의할 경우 다른 파일에서 동일 패턴 독립 재정의 drift 위험 | `websocket.gateway.ts` 파일 로컬 | `spec/conventions/` (명시 규약 없음) | 본 C-4 scope(단일 파일 behavior-preserving)에서는 로컬 정의 허용. 향후 `src/modules/websocket/` 공용 타입 파일로 이동 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `retry_last_turn` 인증 실패 ack 가 nested `error:{code,message}` 를 쓰는 것이 형제 4종과 의도적으로 다름 — spec §4.2 에 명문화된 사항이므로 spec 모순 아님. helper 가 ack 조립을 넘겨받지 않는 한 런타임 차이 없음. | `websocket.gateway.ts` `handleRetryLastTurn` L662 | `verifyExecutionOwnership` helper 주석에 nested/flat ack shape 차이 한 줄 기록 권장. |
| 2 | Rationale Continuity | `'Not authenticated'` 상수가 subscribe 경로와 명령 핸들러 경로에 공유될 경우 한쪽만 메시지 변경 시 의도치 않은 범위 확대 위험 | `handleSubscribe` L153, L192; 5개 명령 핸들러 미인증 분기 | 상수 선언 옆에 두 경로가 동일 상수를 참조함을 주석으로 명시. |
| 3 | Rationale Continuity | `getCommandAuthContext` helper 가 subscribe 경로에 잘못 도입되면 OCP(channelAuthorizers) 구조 우회가 될 수 있음 | C-4 변경 (2) — `getCommandAuthContext` helper | helper JSDoc 에 "명령 핸들러 5종 전용 — subscribe 경로는 channelAuthorizers 경로 담당" 한 줄 명시. |
| 4 | Convention Compliance | 메시지 상수 이름이 `WsErrorCode` UPPER_SNAKE_CASE 패턴과 패밀리를 맞추면 자기설명적. 단 `spec/conventions/error-codes.md` 의 코드 값이 아닌 사람 가독 문자열이므로 conventions 직접 위반 아님. | `ws-error-codes.ts` 명명 패턴 | 선택적. `CMD_ERR_NOT_AUTHENTICATED` 등 권장. |
| 5 | Convention Compliance | `websocket.gateway.ts` 는 Swagger 적용 대상 아님. frontmatter `code:` 갱신 불요(behavior-preserving). | — | 해당 없음. |
| 6 | Naming Collision | `AuthenticatedSocket` — 코드베이스 전체 미사용 이름. `ChannelAuthorizerContext` 와 필드 교집합 있으나 역할 다름(Socket 타입 단언 vs 인가 DTO). | `websocket.gateway.ts` | module-private 주석으로 역할 구분 명시. |
| 7 | Naming Collision | `getCommandAuthContext` — 코드베이스 전체 미사용. `AuthContext` (`auth-context.ts`, HTTP 요청 IP/UA 전달용)와 충돌 없음. | `websocket.gateway.ts` | 선택적으로 반환 익명 객체를 `CommandAuthCtx` 내부 타입으로 명명. |
| 8 | Naming Collision | `verifyExecutionOwnership` — `ExecutionChannelAuthorizer.authorize` 가 이미 동일 `verifyOwnership → boolean` 래핑 패턴 구현 중. 명칭 충돌 없으나 구현 중복. | `execution-channel-authorizer.ts:35-39` | 향후 통합 후보 주석 권장. C-4 scope 내 차단 요소 없음. |
| 9 | Naming Collision | 문자열 상수 — `execution-channel-authorizer.ts:33,39` 도 동일 리터럴 하드코딩 잔존. 파일 내부 상수 정의 시 drift 잔존. | `execution-channel-authorizer.ts` | `ws-error-codes.ts` 에 `WsErrorMessage` 병기 또는 별도 `ws-messages.ts` 로 공유 권장. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | ack wire shape 비대칭이 spec §4.2 에 명문화됨. helper 가 ack 조립 안 하면 충돌 없음. |
| Rationale Continuity | MEDIUM | `verifyExecutionOwnership` + 상수가 `retry_last_turn` 에 획일 적용되면 nested → flat ack 교체 위험. |
| Convention Compliance | MEDIUM | Critical 2건: helper ack 생성 금지(§4.2), 상수화 시 문자열 값 보존(§3.3). |
| Plan Coherence | NONE | plan C-4 권장안 A 와 target 설계 완전 정합. 미결 결정·선행 조건·후속 누락 없음. |
| Naming Collision | NONE | 신규 식별자 4종 모두 충돌 없음. 구현 중복 및 drift 는 일관성 보완 권고 사항. |

## 권장 조치사항

1. **(BLOCK 해소 — Critical 1)** `getCommandAuthContext` 반환 타입을 `{ userId: string; workspaceId: string } | null` 로, `verifyExecutionOwnership` 반환 타입을 `Promise<boolean>` 으로 고정. ack payload 조립 코드는 각 핸들러 내부에 유지. plan `03-maintainability.md §C-4` 권장안 A 를 이탈하지 않는다.

2. **(BLOCK 해소 — Critical 2)** `'Not authenticated'` 상수화 시 값이 정확히 `'Not authenticated'` 임을 구현 직후 검증. 상수 선언 옆에 `// spec §3.3 명문 wire 문자열 — 값 변경 금지` 주석 추가.

3. **(WARNING 해소)** `'Not authorized for this execution'` 상수는 4종 continuation 핸들러(`handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`)에만 적용. `handleRetryLastTurn` 소유권 거부 분기는 기존 nested shape `{success:false, resumed:false, error:{code:WsErrorCode.NOT_FOUND, message:'Execution not found'}}` 를 그대로 유지.

4. **(INFO 권장)** `getCommandAuthContext` JSDoc 에 "명령 핸들러 5종 전용 — subscribe 경로(channelAuthorizers)는 별도 담당" 명시. `verifyExecutionOwnership` 주석에 retry_last_turn(nested ack)과 4종 continuation(flat ack)의 shape 차이 한 줄 기록.

5. **(INFO 권장)** 문자열 상수를 `ws-error-codes.ts` 의 `WsErrorMessage` 오브젝트 또는 별도 `ws-messages.ts` 로 공유해 `execution-channel-authorizer.ts` 의 동일 리터럴 drift 해소(C-4 scope 후속 과제로 주석 처리 가능).
