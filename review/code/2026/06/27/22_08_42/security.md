# 보안(Security) 코드 리뷰

리뷰 대상: Channel Web Chat 위젯 리팩터(B) + 테스트 보강(C)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] error 메시지가 UI에 원문 그대로 노출됨
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` — `{error && <div className="wc-error" role="alert">{error}</div>}`
- 상세: `state.error` 는 `widgetReducer` 의 ERROR 액션에서 `action.message` 를 그대로 저장하고, BLOCKED 액션에서는 `action.reason` 을 저장한다. 이 값이 JSX에 원문 렌더된다. 현재 코드 범위 내 error 출처는 `"origin_not_allowed"` 같은 내부 문자열 상수이거나 SSE 이벤트 페이로드(`"network"` 등 테스트값)다. 서버 측 에러 응답 문자열이 그대로 흘러들어올 경우 민감 정보(스택 트레이스, 내부 경로, 토큰 일부 등)가 사용자에게 노출될 수 있다.
- 제안: `use-widget.ts` 의 에러 처리 경로(`start()` 의 webhook 실패, SSE 오류 등)에서 사용자에게 노출할 메시지와 내부 진단 메시지를 분리한다. 사용자에게는 일반화된 에러 코드·문자열만 dispatch 하고, 내부 상세는 `console.error` 등으로만 기록한다. plan `web-chat-quality-backlog.md §A` 의 "start() 에러 메시지 UI 일반화(W1)" 항목이 이 사항을 이미 backlog 로 등록하고 있다.

---

### [INFO] `isTextInputSurface` denylist 방식: 미지의 interaction type은 텍스트 표면으로 간주
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` — `isTextInputSurface`
- 상세: 함수가 `buttons`/`form` 이 **아닌** 모든 값을 텍스트 표면으로 허용한다(allowlist 주석이 있으나 실제 구현은 denylist). 미지의 새 interaction type이 서버에서 추가될 경우 UI에서 텍스트 입력이 활성화된 채 제출될 수 있다. 현재 `ExternalInteractionType` 이 제한된 union 타입이라면 TypeScript 수준에서 방어되지만, 런타임 SSE 페이로드는 타입 검증 없이 `as WaitingForInputEvent` 로 캐스팅되므로 실제로는 임의 문자열이 들어올 수 있다.
- 제안: 허용할 interaction type을 명시적 allowlist로 전환하거나(`pending?.type === "ai_conversation"`), 혹은 현행 denylist 유지 시 `parseWaitingForInput` 에서 알 수 없는 type의 경우 텍스트 표면 여부를 `false`로 기본값 처리하는 방어 로직을 추가한다. 주석과 구현의 "allowlist" 명칭 불일치도 향후 혼선의 소지가 있다.

---

### [INFO] `configFromQuery()` — URL 쿼리 파라미터를 직접 신뢰하여 API 설정에 사용
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `configFromQuery()` 함수 (전체 파일 컨텍스트 내)
- 상세: `apiBase`, `triggerEndpointPath`, `locale` 를 URL 쿼리스트링에서 읽어 `BootMessage` 로 사용한다. 공격자가 `?apiBase=https://evil.example.com` 을 조작하면 위젯이 악의적 서버로 요청을 보낼 수 있다. 이 경로는 "host 없이 직접 로드/샘플 대비" 폴백으로 명시되어 있어 정상 임베드 경로에서는 PostMessage `wc:boot` 가 우선하지만, 직접 URL 접근 시나리오에서는 SSRF 유사 공격 벡터가 된다.
- 제안: `configFromQuery` 에서 `apiBase` 에 대해 허용된 도메인 origin 화이트리스트 검증을 추가하거나, 최소한 `https://` 스킴 강제 및 `javascript:` 등 위험 스킴 거부 처리를 적용한다. 샘플/개발 환경 전용 경로임을 명확히 하고 프로덕션 빌드에서 이 경로가 호출되지 않도록 제어한다.

---

### [INFO] per_execution 토큰을 `localStorage` 에 저장 — 탭 종료 후 잔류
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `saveSession` / `loadSession` (session-store 경유)
- 상세: 세션 토큰(`iext_*`)이 `localStorage` 에 저장된다. 공유 컴퓨터 환경에서 탭을 닫아도 토큰이 잔류하며, XSS가 발생할 경우 `localStorage` 의 토큰이 탈취될 수 있다. 코드 내 주석과 `plan/in-progress/web-chat-quality-backlog.md §A` 에서 이미 `sessionStorage` 전환을 backlog로 인식하고 있다.
- 제안: `sessionStorage` 로 전환하여 탭 종료 시 자동 소거한다. backlog §A 항목이 이미 존재하므로 우선순위를 올려 구현한다.

---

### [INFO] SSE `onError` 에서 내부 URL·오류 객체를 `console.warn` 으로 출력
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream` 의 `onError` 핸들러
- 상세: `console.warn("[widget] SSE stream error ...", e)` 에서 오류 객체 `e` 가 그대로 기록된다. 브라우저 콘솔 로그는 악의적 확장 프로그램이나 스크린샷으로 접근 가능하며, 오류 객체에 토큰·URL 파라미터 등 민감 정보가 포함될 수 있다. 현재 이 변경 범위에서 새로 추가된 코드는 아니나 리뷰 대상 파일에 포함됨.
- 제안: 오류 로깅 시 민감 정보를 포함할 수 있는 오류 객체 원문 대신 오류 유형·코드만 기록하도록 한다. 최소한 `e` 를 `e instanceof Error ? e.message : String(e)` 형태로 제한한다.

---

## 요약

이번 변경은 텍스트 표면 판정 헬퍼(`isTextInputSurface`) 추출, SSE 종료 이벤트 배열(`TERMINAL_EVENTS`) 상수화, 세션 정리 함수(`teardownSession`/`clearRefreshTimer`) 통합, 그리고 이에 대응하는 테스트 보강으로 구성된 behavior-preserving 리팩터다. 신규 취약점을 도입하는 변경사항은 없다. 발견된 항목 모두 이번 diff가 아닌 기존 설계에서 유래한 pre-existing 사항이다. 그 중 에러 메시지 UI 노출과 `localStorage` 토큰 저장은 plan backlog에 이미 등록되어 있고, `configFromQuery` 의 `apiBase` 신뢰 문제와 denylist 방식 `isTextInputSurface` 는 현재 운영 환경의 제약(임베드 전용, TypeScript union 타입)으로 실제 공격 가능성이 낮으나 향후 확장 시 주의가 필요하다. 인젝션, 하드코딩 시크릿, 인증 우회, 암호화 취약점 등 OWASP Top 10 핵심 항목은 해당 없다.

## 위험도

LOW
