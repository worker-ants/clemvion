# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 적재한 SSOT

- `.claude/config/doc-sync-matrix.json` — `rows[]` 20건 Read
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(line 133~155) + §자주 누락되는 항목(line 168~184) 보조 Read

## 변경 파일 컨텍스트

이번 changeset 은 WS 소켓 수명을 JWT 토큰 수명에 종속시키는 기능이다(spec `5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·§6.1·§9.2, Rationale `R-ws-socket-lifetime-binds-token`):

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthEventType.AUTH_TOKEN_EXPIRED`, `AuthTokenExpiredPayload` 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 타이머(사전 통지 60초 전 + cutoff) 신설, `handleDisconnect` 에서 해제
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 로직 unit 테스트
- `codebase/frontend/src/lib/websocket/ws-client.ts` — `auth.token_expired` 구독 + `disconnect`(`io server disconnect`) fallback → REST refresh → 명시적 `connect()`
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` — 위 로직 unit 테스트
- `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — plan 문서(체크리스트 상 backend/frontend TDD·`lint/unit/build/e2e`·`/ai-review` 가 모두 `[ ]` 미완 상태로 명시)
- 나머지 `review/consistency/**` 산출물(파일 8~27)은 `--impl-prep` 게이트 부산물이며 doc-sync 매트릭스 어떤 trigger 와도 무관

`codebase/backend/src/modules/auth/**` 자체는 이번 diff 에 없다(수정된 것은 `modules/websocket/**`). 그러나 매트릭스 `auth-session-flow-change` 행은 `match:"semantic"` 이라 glob 부재 시 change_type 의미로 판단해야 하며, 이 변경은 "인증 토큰 수명에 소켓 세션 수명을 종속시켜 만료 시 사전 통지 후 강제 종료·재연결" — 텍스트북 수준의 "인증·권한·세션 흐름 변경"이다.

## 발견사항

- **[WARNING]** 인증·세션 흐름 변경(WS 소켓 수명 ↔ JWT 만료 종속) — 워크스페이스 가이드 갱신 + e2e 동반 누락
  - 변경 파일: `codebase/backend/src/modules/websocket/websocket.gateway.ts`(타이머·`auth.token_expired` emit·disconnect), `codebase/frontend/src/lib/websocket/ws-client.ts`(구독·재발급·명시적 재연결)
  - 매트릭스 항목: `auth-session-flow-change` (`match:"semantic"`) — targets: `"codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"`. PROJECT.md 148행 동일 인용, 그리고 §자주 누락되는 항목 181행이 **정확히 이 조합을 이름 붙여 지목**한다: "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음"
  - 누락된 동반 갱신:
    1. `codebase/frontend/src/content/docs/07-workspace-and-team/` — 이번 changeset 에 어떤 `.mdx`/`.en.mdx` 변경도 없음(`password-and-sessions.mdx` 가 "세션" 을 다루는 유일한 페이지지만 비밀번호/이메일 변경 시 타 기기 로그아웃만 서술 — WS 세션이 토큰 만료로 사전 통지 후 재연결된다는 서술 없음)
    2. e2e — `codebase/backend/test/`·`codebase/frontend/e2e/` 어디에도 `token_expired`/`AUTH_TOKEN_EXPIRED` 관련 e2e 없음(`grep` 0건). 기존 `codebase/frontend/e2e/profile/sessions.spec.ts` 는 별도 기능(디바이스 세션 목록)이라 이 경로를 안 덮음
  - 상세: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트 자체가 `- [ ] lint / unit / build / e2e` 를 아직 미완으로 명시하고 있어 "조용한 누락" 은 아니고 plan 이 추적 중인 상태다. 다만 이 changeset(unit 테스트 2건 포함)이 `/ai-review` 대상으로 올라온 시점 기준으로는 e2e 가 실제로 부재하며, PROJECT.md §e2e 면제 화이트리스트 기준으로도 `.ts` 코드 변경이 포함돼 이 PR 은 e2e 면제 대상이 아니다(주석/문서/dict-only 가 아님). PROJECT.md §292 는 "권한 경계(RBAC, workspace 격리, **토큰 만료**)" 를 e2e 스코프에 명시적으로 포함시킨다 — 이번 변경이 바로 그 "토큰 만료" 케이스다.
  - 제안: (1) `07-workspace-and-team/password-and-sessions.mdx` + `.en.mdx` 에 "장시간 열어 둔 탭은 백그라운드에서 자동으로 재연결된다"(또는 정확한 사용자 영향) 짧은 절 추가, 혹은 "이 변경은 사용자에게 보이지 않는 내부 신뢰성 개선이라 가이드 갱신 불필요" 라고 developer 가 명시적으로 판단·기록. (2) `make e2e-test` 대상에 WS 토큰 만료 → 통지 → 재연결 시나리오 e2e 1건 추가(백엔드는 짧은 TTL JWT 로 실제 타이머 발화를 검증하거나, 최소한 프론트 `connect_error`/`disconnect` 라우팅이 실제 브라우저 소켓에서도 작동하는지 e2e 로 1건 확인) 후 plan 체크리스트 갱신.

- **[INFO]** run-and-debug 흐름과의 간접 연관 — 문서 갱신 불필요 판단이나 명시적 확인 없음
  - 변경 파일: `codebase/frontend/src/lib/websocket/ws-client.ts`
  - 매트릭스 항목: `run-debug-flow-change` (`match:"semantic"`) — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"`
  - 상세: 이 WS 재연결 로직은 `codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 기존 `realtimeFallback` toast(실시간 업데이트 실패 시 REST 폴링 대체)와 상호작용한다 — 이번 변경으로 15분 근처 장시간 실행을 지켜보는 사용자가 이전보다 이 fallback toast 를 덜 보게 될 것으로 추정된다. 다만 `grep` 결과 `05-run-and-debug/*.mdx` 어디에도 `realtimeFallback`/폴링 fallback 관련 서술이 원래 없어(기존에도 미문서화 내부 동작), 이번 PR 이 새로 "문서화된 계약을 깬" 것은 아니다. 회색 지대로 분류 — 확정적 누락은 아니다.
  - 제안: 별도 조치 불요. developer 가 "내부 신뢰성 개선, 사용자 가시 흐름 불변" 으로 판단했다면 그대로 두어도 무방하나, PR 본문에 한 줄 근거를 남기면 향후 재조사 비용을 줄인다.

## 매칭되지 않은 trigger (참고, 발견사항 아님)

- `new-node` / `node-schema-change` — `codebase/backend/src/nodes/**` 변경 없음, 무관
- `new-ui-string` — `.tsx` 변경 없음(모두 `.ts`), 무관
- `new-userguide-section-dir` — `content/docs/` 신규 디렉토리 없음, 무관
- `new-warning-code` / `new-error-code` — `warningRules`/`ErrorCode` enum 변경 없음, 무관
- `integration-provider-change` / `expression-language-change` — 대상 경로 무변경, 무관
- i18n parity(ko/en 신규 리터럴) — 이번 diff 는 백엔드 로그 메시지("Token expired, disconnecting…")와 WS payload `message` 필드("Access token expires soon…") 뿐이며 둘 다 frontend UI 에 렌더링되지 않음(ws-client.ts 핸들러가 payload 를 사용하지 않고 침묵 재연결만 수행) — dict 등록 대상 아님

## 요약

매트릭스 20개 행 중 semantic 매칭 후보 2건(`auth-session-flow-change`, `run-debug-flow-change`)을 검토했다. `auth-session-flow-change` 는 PROJECT.md 가 이름 붙여 지목한 "자주 누락" 패턴과 정확히 일치하는 형태로 매칭됐고, 07-workspace-and-team 문서·e2e 동반 갱신이 이번 changeset 에 없어 WARNING 1건으로 기록했다(plan 자체가 e2e 를 미완으로 추적 중이라 완전한 "조용한 누락"은 아님). `run-debug-flow-change` 는 근거가 약해 INFO 로 grey-zone 처리했다. 나머지 트리거는 대상 파일이 없어 무관하며, i18n parity·backend-labels·section-locale 등 CRITICAL 등급 항목은 이번 diff 에 매칭되지 않았다.

## 위험도

MEDIUM — CRITICAL 없음, WARNING 1건(문서+e2e 동반 갱신 확인 필요, 단 plan 이 이미 추적 중이라 완전 은닉된 누락은 아님).
