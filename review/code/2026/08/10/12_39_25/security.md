# 보안(Security) 리뷰

## 대상

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream` 을 자가-게이팅(self-gating)
  구조로 바꿔, 종전 두 호출부(`start()`, `applyConfig` 세션 복원)에 손으로 복제돼 있던
  `if (sessionEstablished()) return;` SSE 소유권 재확인을 `openStream` 내부(진입 시
  `streamRef.current !== null` 검사)로 옮기고 `boolean` 반환값으로 "다른 시도가 이 세션을
  넘겨받았는가" 를 알린다.
- `plan/in-progress/webchat-usewidget-extraction.md` — 위 작업의 plan 체크리스트 갱신(문서만).

## 발견사항

리뷰 대상 diff 범위 내에서 **CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.** 아래는 INFO 수준
관찰 사항이다.

- **[INFO]** SSE 스트림 소유권 가드를 호출부 복제에서 `openStream` 내부 구조적 강제로 이동 — 보안
  관점에서 오히려 긍정적인 변경
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:367-393` (`openStream` 정의),
    `codebase/channel-web-chat/src/widget/use-widget.ts:601` (`start()` 호출부),
    `codebase/channel-web-chat/src/widget/use-widget.ts:950` (`applyConfig` 세션 복원 호출부)
  - 상세: 종전엔 `start()`·`applyConfig` 두 호출부가 각자 `sessionEstablished()` 를 확인한 뒤에만
    `openStream`을 불렀다. 두 곳의 seed(`seedWaitingFromStatus`)가 microtask 경계를 사이에 두고
    같은 flush 에서 resolve 하면 두 시도 모두 "아직 스트림 미열림" 을 보고 통과해 각자
    `openStream` 을 호출할 수 있었고, `openStream` 내부의 `closeStream()` 이 먼저 연 쪽의
    `EventSource`(및 그 SSE 구독이 참조하던 토큰/세션 컨텍스트)를 조용히 교체하는 레이스가
    이론상 가능했다(JSDoc 에 `ai-review 01_44_21` 로 기존에 지적된 재현 사례로 기록됨). 이번
    diff 는 그 재확인을 `openStream` 진입 시점(`streamRef.current !== null` → `closeStream()`
    호출 전에 조기 반환)으로 옮겨, 두 호출부가 각각 가드를 들고 있어야 했던 구조를 단일
    지점의 구조적 강제로 바꿨다. "SSE 는 하나만 소유한다" 불변식이 세 번째 seed→openStream
    호출부가 추가돼도 자동으로 적용되므로, 이 파일이 반복 재발시킨 "가드를 한쪽에만 적용"
    결함 클래스(비대칭 세션 탈취/스트림 교체) 재발 표면을 줄인다.
  - 제안: 조치 불필요(개선). 새 스트림을 실제로 열기 전에 소유권 검사를 먼저 하는 순서
    (`streamRef.current !== null` 검사 → `closeStream()`)가 유지되는지만 향후 리팩토링 시
    계속 확인할 것.

- **[INFO]** `client` 미확립 시 `openStream` 이 `true`(넘겨받힘 아님)를 반환해 호출부가
  `scheduleRefresh()` 로 계속 진행하는 엣지 케이스가 문서화된 채로 보존됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:369-371`
  - 상세: `if (!client) return true;` — `client` 가 없으면 스트림을 열지 않고도 "넘겨받힘 아님"
    으로 처리해 호출부가 `if (!openStream(...)) return;` 를 통과, 이어서 `scheduleRefresh()`
    가 실행된다. JSDoc 에 "기능 변경 없음(종전 호출부도 `openStream(...)`(client 없으면
    내부 no-op) 후 `scheduleRefresh()` 를 그대로 실행했다)" 이라는 명시적 근거로 의도된
    동작 보존임을 밝히고 있다. `clientRef.current` 는 `establishConfig` 에서 `configRef.current`
    설정과 동시에 세팅되고, 호출부(`start()`)는 진입 시 `if (!cfg || !client) return;` 로
    이미 `client` 존재를 확인하므로 실무상 이 분기는 거의 도달 불가능한 방어적 코드다.
    `applyConfig` 세션 복원 경로(`use-widget.ts:950` 근방)는 `if (clientRef.current)` 블록
    **밖에서** `openStream(saved, "0")` 을 호출하므로, `clientRef.current` 가 falsy 인 극단
    상황이면 `seedWaitingFromStatus`/`isAttemptStale` staleness 재검증을 건너뛰고 바로
    `scheduleRefresh()` 로 진행하는 경로가 이론상 존재한다 — 다만 이는 이번 diff 가 새로
    만든 경로가 아니라 종전부터 존재하던 동작이며, `clientRef.current` 가 이 지점에서 null
    이 될 수 없다는 파일 내 불변식(establishConfig 가 config 확립과 동시에 client 를 세팅)
    에 의존한다. 보안적으로 악용 가능한 입력 경로는 보이지 않는다(공격자가 `clientRef.current`
    를 null 로 만들 수 있는 외부 입력 경로가 없음).
  - 제안: 조치 불필요. 다만 향후 `establishConfig`/`clientRef` 배선을 바꿀 계획이 있다면, 이
    "client 미확립 → 넘겨받힘 아님 취급" 분기가 여전히 도달 불가능한 방어적 코드인지 재확인할 것.

## 점검 관점별 요약

1. **인젝션**: 해당 없음 — SQL/커맨드/경로 조작 입력 처리 코드 변경 없음. `openStream` 은
   `session.endpoints`/`session.token` 을 그대로 `EiaClient.openStream` 에 전달하는 기존 배선을
   유지할 뿐, 신규 사용자 입력 처리 경로를 추가하지 않았다.
2. **하드코딩된 시크릿**: 없음.
3. **인증/인가**: 이번 diff 는 SSE 스트림 소유권(세션 라이프사이클) 가드를 구조적으로
   강화하는 변경으로, 인증/인가 로직 자체(토큰 검증, origin allowlist 등)는 건드리지 않았다.
   위 INFO 항목대로 오히려 "세션 탈취/스트림 교체" 류 레이스를 줄이는 방향.
4. **입력 검증**: 변경 범위 밖(`safeApiBaseFromQuery`, `isEmbedAllowed` 등은 컨텍스트로만
   포함되고 diff 대상 아님).
5. **OWASP Top 10**: 특별한 해당 항목 없음. 굳이 연결하면 A04(Insecure Design) 관점에서
   "동일 리소스에 대한 동시 요청 경쟁" 결함 클래스를 줄이는 방향의 변경.
6. **암호화**: 해당 없음.
7. **에러 처리**: `openStream` 자체는 에러를 던지지 않으며 반환값(`boolean`)만 바뀌었다.
   에러 메시지 노출 관련 기존 처리(`errMessage`, `console.warn` 계열)는 diff 범위 밖.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 diff 는 `useWidget()` 훅의 SSE 스트림 소유권 가드를 호출부 중복 구현에서 `openStream` 함수
내부 단일 지점으로 이동시키는 리팩토링으로, 신규 인젝션·인증 우회·시크릿 노출·안전하지 않은
암호화 등 보안 취약점을 도입하지 않았다. 오히려 "겹친 두 세션 확립 시도가 서로의 SSE 스트림을
조용히 교체할 수 있는" 레이스 컨디션을 구조적으로 봉쇄해 세션 무결성 측면에서 방어를 강화하는
변경이다. `plan/in-progress/webchat-usewidget-extraction.md` 변경은 체크리스트 텍스트 갱신뿐이라
보안 영향 없음. 발견된 사항은 모두 INFO 등급이며 조치가 필요한 항목은 없다.

## 위험도

NONE
