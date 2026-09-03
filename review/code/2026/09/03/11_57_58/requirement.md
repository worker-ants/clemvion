# 요구사항(Requirement) 리뷰 — WS `auth.token_expired` 이월 INFO 5건 정리

## 검증 방법
- `codebase/backend`에서 `npx jest src/modules/websocket/websocket.gateway.spec.ts` 실행 → **70/70 통과** (신규 3종 포함).
- `npx tsc --noEmit`으로 전체 backend 타입체크 — 대상 3파일 관련 신규 에러 없음(기존에 있던 무관 `.spec.ts` 파일들의 사전 존재 에러만 검출, `websocket.gateway.spec.ts:966`/`:1141`은 diff 밖 라인으로 이 PR 이전부터 존재).
- 저장소 파일은 뮤테이션하지 않았고 read-only 조사만 수행함 — `git status --short` 오염 없음.

## 발견사항

- **[WARNING]** JSDoc이 원래 대상에서 분리되어 엉뚱한 선언에 붙었다 — `AuthTokenExpiredPayload` 문서가 `MSG_AUTH_TOKEN_EXPIRING` 앞으로 밀렸다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315` (특히 게이트 `287`~`301`, `302`~`308`, `312`)
  - 상세: 새 `export const MSG_AUTH_TOKEN_EXPIRING`(게이트 `302`-`310`)이 기존 `AuthTokenExpiredPayload` 인터페이스(게이트 `312`-`315`) **바로 앞의 JSDoc**(게이트 `287`-`301`, "Wire payload for `AuthEventType.AUTH_TOKEN_EXPIRED`... spec §4.6 의 shape... `expiresAt`은 이 소켓이 강제 종료되는 시각... 초판 JSDoc 문서가 구현보다 넓었다" 등 4R 리뷰 이력까지 담은 상세 문서)와 인터페이스 선언 사이에 끼어들어 갔다. 그 결과 소스를 선형으로 읽거나 JSDoc 툴링(hover/TypeDoc)이 근접 주석을 붙이면, 원래 `AuthTokenExpiredPayload`를 설명하던 블록이 `MSG_AUTH_TOKEN_EXPIRING` 문서처럼 보이고, 정작 `AuthTokenExpiredPayload` 인터페이스는 그 자리에 인접 JSDoc 없이 남는다. 같은 파일 안에서 "문서가 구현보다 넓었다"는 과거 지적을 스스로 반복하는 패턴이다(리뷰 4R documentation W3 의 교훈이 이번엔 위치 이동으로 재발).
  - 제안: `MSG_AUTH_TOKEN_EXPIRING` 선언(및 그 JSDoc)을 `AuthTokenExpiredPayload` 인터페이스 **뒤**로 옮기거나, `AuthEventType` enum 바로 뒤(그 인터페이스 JSDoc보다 앞)로 옮겨 기존 JSDoc-선언 인접성을 보존할 것.

- **[WARNING]** 같은 패턴이 `websocket.gateway.ts`에도 발생 — `armExpiryTimers`의 설계 근거 JSDoc이 `clearExpiryTimers`에 붙었다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:162-190` (게이트 `162`-`176` JSDoc, `177`-`188` `clearExpiryTimers`, `190` `armExpiryTimers` 선언)
  - 상세: 신규 `private clearExpiryTimers(clientId: string): void {}`(게이트 `182`-`188`)가 삽입되면서, 원래 `armExpiryTimers`를 설명하던 JSDoc(게이트 `162`-`176`, "소켓 수명을 토큰 수명에 종속시킨다... 닫는 범위는 자연 만료뿐... `exp`가 없으면 타이머를 걸지 않는다" — 이 메서드의 핵심 설계 근거)이 이제 `clearExpiryTimers`용 새 JSDoc(게이트 `177`-`181`) 바로 앞에 위치하고, 정작 `armExpiryTimers` 선언(게이트 `190`)에는 인접 JSDoc이 하나도 남지 않는다. `clearExpiryTimers`(단순 "타이머 쌍 해제" 헬퍼)에 "소켓 수명을 토큰 수명에 종속" 같은 상위 설계 근거가 잘못 붙어 있고, 정작 그 근거가 설명하는 대상(`armExpiryTimers`)은 문서를 잃었다.
  - 제안: `armExpiryTimers`의 기존 JSDoc은 그대로 두고 `clearExpiryTimers`를 그 JSDoc-메서드 쌍의 **앞** 또는 **뒤**(양쪽 JSDoc 사이가 아닌 위치)로 옮길 것. 부수적으로 `expiryTimers` 프로퍼티(게이트 `147`-`156`)도 신규/구 JSDoc 두 블록이 스택되어 있어 병합 여지가 있음(INFO 수준, 둘 다 대상은 맞으므로 오귀속은 아님).

- **[WARNING]** 엣지 케이스 — 재무장(rearm) 시 `exp` 없는/유효하지 않은 토큰이면 옛 타이머 쌍을 못 지운다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:194,215` (`armExpiryTimers` 본문)
  - 상세: `armExpiryTimers`는 `if (typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)) return;`(게이트 `194`)로 조기 반환한 **뒤에야** `this.clearExpiryTimers(client.id)`(게이트 `215`, 신규 추가된 선제 해제)를 호출한다. 즉 같은 `client.id`로 이전 연결(유효한 `exp`, 타이머 무장됨)이 있었고, 재연결(`connectionStateRecovery` 시나리오)의 새 토큰에 `exp` claim이 없으면 조기 `return`으로 `clearExpiryTimers`가 실행되지 않아 **옛 타이머 쌍이 맵에 남는다**. 이번 라운드가 정확히 닫으려던 "같은 id 재무장 시 옛 타이머 누수" 결함이, "새 토큰에 exp가 없는" 조합에서는 그대로 재발한다. (`websocket.gateway.spec.ts`의 신규 rearm 테스트는 두 연결 모두 `exp`가 있는 경우만 검증 — 이 조합은 커버 안 됨.)
  - 제안: `this.clearExpiryTimers(client.id)` 호출을 `armExpiryTimers` 최상단(조기 `return`보다 앞)으로 옮기면 `exp` 유무와 무관하게 재무장 시 항상 옛 쌍을 정리한다. 현재 `connectionStateRecovery` 미사용으로 이 경로 자체가 도달 불가하다는 점은 완화 요인이나(plan에도 같은 전제로 "현재는 도달 불가" 명시), 이번 라운드가 "도달 불가와 검증 불가는 다르다"는 교훈으로 5건을 닫은 직후이므로 동일 기준을 이 조합에도 적용하는 편이 일관적이다.

## 기타 확인 (결함 아님)
- `MSG_AUTH_TOKEN_EXPIRING` 상수값은 spec(`5-system/6-websocket-protocol.md` §4.6)이 `{message, expiresAt}` shape만 규정하고 문구 자체는 규정하지 않으므로 spec fidelity 이슈 없음.
- `expiryTimers` 맵 타입 `{ notice?: … }` → `{ notice: … }` non-optional화, `clearExpiryTimers` 추출, `.unref()` 추가, 상수 승격 — 전부 기능적으로 올바르고 신규 테스트 3종이 실제로 해당 동작을 RED/GREEN으로 검증(직접 재실행 확인, 70/70 통과).
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`의 체크리스트 서술("3축 RED")은 실제 diff의 신규 테스트 3개(message 상수·rearm·unref)와 정확히 대응 — plan-코드 불일치 없음.
- TODO/FIXME/HACK/XXX 마커 없음.

## 요약
핵심 기능(같은 client.id 재무장 시 타이머 누수 방지, wire 메시지 SoT화, 타이머 쌍 non-optional화, `.unref()`)은 의도대로 구현됐고 신규 뮤테이션 테스트 3종이 실제로 통과함을 직접 재실행으로 확인했다. 다만 문서 삽입 위치 실수로 두 파일(`websocket-events.types.ts`, `websocket.gateway.ts`)에서 기존 JSDoc이 원래 대상(각각 `AuthTokenExpiredPayload`, `armExpiryTimers`)에서 분리되어 신규 선언에 잘못 붙는 동일 패턴이 반복됐고, `armExpiryTimers`의 조기 `return`이 신규 추가한 선제 `clearExpiryTimers` 호출보다 앞에 있어 "exp 없는 토큰으로 재무장" 조합에서는 이번에 고친 누수가 그대로 재발하는 좁은 엣지 케이스가 남아 있다. 두 클래스 모두 현재 런타임 동작(테스트 전량 통과)을 깨지 않는 저위험 결함이라 CRITICAL은 아니지만, 이 저장소가 문서-구현 정합성을 반복적으로 리뷰 근거로 삼아온 이력을 고려하면 다음 라운드에서 정리할 가치가 있다.

## 위험도
LOW
