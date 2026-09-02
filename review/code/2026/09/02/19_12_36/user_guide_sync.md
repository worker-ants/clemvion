# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(표 + "자주 누락되는 항목" 절)을 Read 해 SSOT 로 사용.

## 변경 파일 컨텍스트

orchestrator 가 넘긴 실 코드 변경분(리뷰 산출물 nested 파일 12~78 은 이전 라운드 review artifact 라 매트릭스 판단 대상에서 제외):

- `CHANGELOG.md`
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` / `.spec.ts` — `AuthEventType.AUTH_TOKEN_EXPIRED` enum + `AuthTokenExpiredPayload` 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` / `.spec.ts` — 소켓별 만료 타이머(사전 통지 60초 전 + `exp` 컷오프)
- `codebase/frontend/src/lib/websocket/ws-client.ts` / `__tests__/ws-client.test.ts` — `auth.token_expired` 구독 + 명시적 재핸드셰이크
- `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` / `.en.mdx`
- `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`

## 매칭

내용은 WS 소켓 수명을 access token 수명에 종속시키는 변경(`spec/5-system/6-websocket-protocol.md` §1.2/§4.6/§9.2, Rationale `R-ws-socket-lifetime-binds-token`) — 물리적 위치는 `codebase/backend/src/modules/websocket/` 이지만 인가·세션 수명 흐름 자체를 바꾸므로 매트릭스 `auth-session-flow-change` 행(semantic match, PROJECT.md 149행 "인증·권한·세션 흐름 변경")에 매칭된다. 이 행의 target 은 `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`.

다른 행(신규 노드, TSX 신규 UI 문자열, 신규 섹션 디렉토리, 통합/제공자 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경, 신규 warning/error code)은 변경 파일 셋에 해당 glob/semantic 조건이 없어 매칭되지 않음.

## 동반 갱신 확인 결과

### 가이드 페이지 갱신 — 정합 (PASS)

`password-and-sessions.mdx`(ko) 와 `.en.mdx`(en) 가 **같은 diff 안에서 짝을 맞춰** 갱신됐다. 새 `<Callout>` 이 두 언어 모두에 존재하고 서술이 대칭이다:

- ko: "실시간 연결(워크플로 실행 화면 등)은 따로 신경 쓰지 않아도 돼요 ... 다른 기기를 로그아웃시킨 경우 ... 최대 15분 안에 연결이 끊겨요"
- en: "Real-time views ... reconnect automatically ... within 15 minutes"

실측 대조: `websocket.gateway.ts` 의 `TOKEN_EXPIRY_LEAD_MS = 60_000`(사전 통지 60초 전)과 plan 문서(`ws-token-expired-socket-lifetime-impl.md:29`)에 기록된 access token 수명 900초(=15분)가 가이드 문구("최대 15분 안에")와 일치한다. 서버가 보내는 `auth.token_expired` payload 의 `message` 는 frontend(`ws-client.ts`)가 사용자에게 노출하지 않고 내부 재연결 트리거로만 쓰므로 별도 i18n dict 항목은 불필요 — 신규 UI 문자열(dict `{ko,en}` parity) 트리거는 해당 없음.

이 항목은 plan 체크리스트(`ws-token-expired-socket-lifetime-impl.md:87-90`)에 "유저 가이드" 로 명시적으로 체크되어 있고, 이전 리뷰 라운드(`review/code/2026/09/02/17_38_12/RESOLUTION.md` W5)에서 이미 지적·조치된 항목이 이번 diff 에 반영된 상태다.

### e2e 보강 — 매트릭스 target 의 일부지만 gap 아님 (documented deferral)

matrix `auth-session-flow-change` 행의 target 문구("... + e2e")와 PROJECT.md 182행("흐름 변경 + 가이드 갱신 + e2e 가 한 묶음", "자주 누락되는 항목")에 정확히 해당하는 패턴이라 표면적으로는 e2e 부재가 눈에 띈다. 이번 diff 의 테스트는 `websocket.gateway.spec.ts`/`ws-client.test.ts` unit 뿐이고 e2e-spec 변경은 없다.

다만 이는 **조용한 누락이 아니다** — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:92-96` 에 별도 체크박스로 "e2e — 유예. 근거를 여기 적는다" 로 명시 기록되어 있고, 유예 사유(현 e2e 하네스가 boot-only test-hook 게이트라 런타임 토큰 TTL 주입 표면이 없음)와 재개 신호(하네스에 런타임 설정 주입이 생기거나 회귀가 실제 관측될 때)가 함께 적혀 있다. `review/**` 산출물이 아니라 `plan/` 트래커에 적힌 것도 프로젝트 관례("미룬 항목은 그 턴에 plan/ 에 적어라")를 따른다. User-guide-sync 관점에서 재차 WARNING 으로 올릴 실익이 없어 INFO 로만 기록한다.

## 영역 무관 판정 대상

- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/02/17_38_12/**`, `review/consistency/2026/09/02/**` — 매트릭스 trigger 대상 아님 (docs MDX·dict·backend-labels 아님)
- 백엔드 `websocket-events.types.ts`/`.gateway.ts`, 프론트 `ws-client.ts` 자체는 노드/통합/표현식/실행-디버깅 트리거에 해당하지 않음 (WS 인프라 코드, node/provider/expression-engine 아님)

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 의 target 문구에 포함된 "+ e2e" 가 이번 diff 에 없음
  - 변경 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `codebase/frontend/src/lib/websocket/ws-client.ts`
  - 매트릭스 항목: `auth-session-flow-change` — "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e" (PROJECT.md 149행, 182행 "자주 누락되는 항목")
  - 누락된 동반 갱신: e2e 시나리오 (`codebase/backend/test/*.e2e-spec.ts` 등) — 실제로는 부재
  - 상세: 가이드 페이지(07-workspace-and-team) 자체는 이미 동반 갱신됐으므로 문서 stale 위험은 없음. e2e 만 빠졌는데, 이는 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:92-96` 에 근거·재개 신호와 함께 명시적으로 유예 기록되어 있어 silent gap 이 아니다.
  - 제안: 현 상태 유지. e2e 하네스에 런타임 토큰 TTL 주입 표면이 생기거나 이 경로의 회귀가 실관측되면 그 plan 항목을 재개.

## 요약

매트릭스 20개 행 중 이번 diff 는 `auth-session-flow-change`(인증·권한·세션 흐름 변경) 1개 행에만 매칭된다. 그 행의 핵심 동반 갱신 대상인 `07-workspace-and-team/password-and-sessions.{mdx,en.mdx}` 는 같은 diff 안에서 ko/en 대칭으로 이미 갱신됐고 실측(60초 통지·900초=15분 만료)과 문구가 일치해 CRITICAL/WARNING 없음. target 문구의 "+ e2e" 부분만 비어 있으나 plan 트래커에 근거·재개 신호를 명시한 의도적 유예라 silent gap 이 아니므로 INFO 1건으로만 기록. 신규 노드/TSX UI 문자열/신규 섹션 디렉토리/통합·제공자 변경/표현식 언어 변경/신규 warning·error code 트리거는 매칭 대상 없음.

## 위험도

NONE
