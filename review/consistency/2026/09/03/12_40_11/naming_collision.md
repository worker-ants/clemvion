# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 검토 범위 재확정 (실측)

- 선언된 scope(`spec/5-system/`) 의 `origin/main` 대비 spec 파일 델타: **0개** — 이 브랜치(`claude/ws-carried-info-cleanup`, HEAD `80ac92668`)는 spec 문서를 바꾸지 않았다. 프롬프트 지시대로 이를 CRITICAL 근거로 쓰지 않았다.
- 실제 구현 diff(`git -C <worktree> diff origin/main...HEAD -- codebase/`)를 절대경로 워킹트리에서 직접 재확인: **3개 파일 변경**
  - `codebase/backend/src/modules/websocket/websocket-events.types.ts` (+10)
  - `codebase/backend/src/modules/websocket/websocket.gateway.ts` (+54/-14 상당)
  - `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (+101, 테스트 전용)
  - (부수: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트 갱신 — 신규 식별자 없음)
- 이 diff 는 기존에 이미 `implemented` 로 승격된 `auth.token_expired` (WS 소켓 수명↔토큰 수명 종속) 기능의 **리뷰 이월 항목 정리 라운드**(1R/2R fix)다. 새 REST/WS 엔드포인트·새 엔티티·새 요구사항 ID 는 도입되지 않았다.

## 신규 식별자 인벤토리 (diff 의 `+` 라인 기준)

| 식별자 | 종류 | 위치 |
|---|---|---|
| `MSG_AUTH_TOKEN_EXPIRING` | exported `const` (wire 메시지 문자열 SoT) | `websocket-events.types.ts:314` |
| `clearExpiryTimers` | `WebsocketGateway` 의 `private` 메서드 | `websocket.gateway.ts:235` |

(`expiryTimers` 맵 값 타입이 `{ notice?: …; cutoff?: … }` → `{ notice: …; cutoff: … }` 로 non-optional 화됐지만 이는 기존 필드의 optionality 변경이며 새 식별자가 아니다. `armExpiryTimers` 는 기존 메서드로 이름 변경 없음.)

## 충돌 점검 결과

### 1. 요구사항 ID 충돌 — 해당 없음
이 diff 는 spec 요구사항 ID 를 신규 부여하지 않는다 (spec 델타 0, 코드 전용 변경).

### 2. 엔티티/타입명 충돌 — 없음
`clearExpiryTimers` 는 전체 backend 코드베이스(`codebase/backend/src/`)에서 이 파일에만 존재한다 (`grep -rn "clearExpiryTimers"` 1곳 정의 + 2곳 호출, 전부 `WebsocketGateway` 내부). `private` 스코프라 다른 클래스와 이름이 겹쳐도 실질 충돌이 아니며, 실제로 겹치는 동명 메서드도 없다.

### 3. API endpoint 충돌 — 해당 없음
새 HTTP/WS endpoint 없음. 기존 이벤트 `auth.token_expired`(`AuthEventType.AUTH_TOKEN_EXPIRED`)를 그대로 재사용한다.

### 4. 이벤트/메시지명 충돌 — 없음
`MSG_AUTH_TOKEN_EXPIRING` 은 프로젝트 전체에서 이 정의 1곳 + 소비처(gateway 본문·spec) 뿐이며 (`grep -rn "MSG_AUTH_TOKEN_EXPIRING" codebase/` 4건, 전부 이 3파일), 다른 의미로 이미 쓰이는 동명 식별자가 없다. 이 상수가 담는 문자열(`'Access token expires soon — refresh and reconnect.'`) 은 리팩터링 전에도 동일 리터럴로 이미 emit 되고 있었다(값 자체는 신규가 아니라 상수로 승격된 것) — `spec/5-system/6-websocket-protocol.md:874` 는 `auth.token_expired` payload 를 `{ message, expiresAt }` 로만 규정하고 `message` 의 정확한 wire 문구는 spec 계약에 pin 하지 않으므로, 코드가 상수화해도 spec 과 충돌하지 않는다.

이벤트 이름 `auth.token_expired` 자체는 이번 diff 이전부터 존재(`AuthEventType` enum, 이전 커밋들에서 구현·spec 승격 완료)하며 이번 변경이 새로 도입한 것이 아니다.

### 5. 환경변수·설정키 충돌 — 해당 없음
이 diff 는 신규 ENV var/config key 를 추가하지 않는다.

### 6. 파일 경로 충돌 — 해당 없음
신규 파일 생성 없음(기존 3개 파일 수정만). `review/code/2026/09/03/{11_57_58,12_16_24}/` 는 코드 리뷰 산출물 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)을 그대로 따른다.

## 부수 관찰 (충돌은 아니지만 명명 일관성)

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 은 `MSG_` **접두** 패턴인데, backend 에서 기존에 확립된 message-constant 명명은 `<NAME>_MESSAGE` **접미** 패턴이다 (예: `AI_NO_LLM_PROVIDER_MESSAGE` — `nodes/ai/llm-provider-rule.ts:30`, `FORM_SUBMITTED_GUIDANCE_MESSAGE` — `nodes/ai/ai-agent/ai-turn-executor.ts:260`). `grep -rn "^export const MSG_" codebase/` 결과 이 상수가 전체 코드베이스에서 유일한 `MSG_` 접두 사례다.
  - 신규 식별자 target: `MSG_AUTH_TOKEN_EXPIRING`
  - 기존 사용처: `codebase/backend/src/nodes/ai/llm-provider-rule.ts:30`, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:260`
  - 상세: 이름이 겹치거나 혼동되는 것은 아니다 — 의미가 명확히 구분되고 `spec/conventions/`에 상수 명명 접두/접미를 못 박은 공식 규약도 없다(`grep` 결과 0건). 단지 접두/접미 방향이 다른 사례가 프로젝트 내 유일한 예외로 새로 생겼다는 점을 남긴다.
  - 제안: 강제 사항 아님. 다음에 이 영역을 다시 만질 때 `AUTH_TOKEN_EXPIRING_MESSAGE` 로 접미 통일을 고려할 수 있으나, 현재 표본이 2건뿐이라(공식 규약 부재) WARNING 으로 올리지 않는다.

## 요약

이번 diff(WS `auth.token_expired` 이월 INFO 5건 정리)가 신규 도입한 식별자는 `MSG_AUTH_TOKEN_EXPIRING`(exported const) 과 `clearExpiryTimers`(private method) 두 개뿐이며, 둘 다 backend 전체에서 이 3개 파일에만 존재해 기존 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 어느 축과도 충돌하지 않는다. spec(`spec/5-system/6-websocket-protocol.md`)이 이미 `auth.token_expired` payload 형태(`{ message, expiresAt }`)만 규정하고 `message` 리터럴은 pin 하지 않으므로 상수화도 spec 계약과 상충하지 않는다. 유일한 관찰은 message-constant 명명 접두(`MSG_`)가 기존 접미(`_MESSAGE`) 관례와 다르다는 INFO 수준 제안이며, 이는 공식 규약 부재 상태의 스타일 차이일 뿐 충돌이 아니다.

## 위험도

NONE
