# 문서화(Documentation) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`), 5라운드

## 검토 범위와 방법

`origin/main`(`6ffadb1f4`) 대비 누적 diff(핵심 코드 파일 1~11 + 이전 4라운드
리뷰/컨시스턴시 산출물, 94개 파일)를 검토했다. 이 changeset 은 이미 4라운드 리뷰
(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43,19_12_36}/`)를 거쳤고, 매 라운드
`documentation.md` 가 WARNING 을 냈다(총 5건: export 완전성 목록·CHANGELOG·spec 배지
후속 포인터·pending-가드 주석 트리거 개수·`AuthTokenExpiredPayload.expiresAt` JSDoc). 이번
라운드는 프롬프트 크기 제한으로 diff 가 생략된 핵심 파일을 `git diff origin/main...HEAD`
와 `Read` 로 직접 열어 각 WARNING 의 조치 주장을 실제 소스와 대조했다(저장소 뮤테이션
없음 — 읽기 전용, `git status --short` 로 변경 없음 확인):

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (전체, `armExpiryTimers` 포함)
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (270~305행)
- `codebase/frontend/src/lib/websocket/ws-client.ts` (전체)
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` (전체)
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (전체)
- `review/code/2026/09/02/{18_45_43,19_12_36}/RESOLUTION.md`

## 직전 라운드(4R, `19_12_36`) WARNING 3건 조치 검증

| WARNING | 조치 주장 | 검증 결과 |
|---|---|---|
| `AuthTokenExpiredPayload.expiresAt` JSDoc 이 "클라이언트가 이 값으로 남은 창을 계산한다" 고 적어 구현보다 넓었다 | JSDoc 을 "클라이언트는 이 값을 소비하지 않는다 — 진단·로깅용" 으로 좁힘 | **해소 확인** — `websocket-events.types.ts:295-301` 을 직접 읽어 대조. `refreshAndReconnect`/`socket.on("auth.token_expired", () => ...)` 핸들러가 payload 인자를 받지 않고 즉시 재발급하는 실제 동작과 이제 문구가 일치한다. 초판 서술이 왜 틀렸는지("문서가 구현보다 넓었다. 리뷰 4R documentation W3")까지 JSDoc 안에 남겨, 다음 사람이 같은 실수를 반복할 근거를 차단한다. |
| 3R 이 "이중 빈 줄을 정리했다" 고 적었는데 diff 에 없었다(기록 정직성) | `ws-client.ts` 의 실제 이중 빈 줄 제거 + `18_45_43/RESOLUTION.md` 의 거짓 문장에 취소선 | **해소 확인** — `ws-client.ts:131-132` 를 직접 읽어 빈 줄이 하나임을 확인. `git log --follow -- review/code/2026/09/02/18_45_43/RESOLUTION.md` 로 이 파일이 3R(작성)·4R(수정) 두 커밋에서만 손댔음을 확인했고, 실제로 `~~**#11 이중 빈 줄은 이번에 정리했다**~~ — **이 문장은 거짓이었다.**` 취소선이 파일에 그대로 있다. 봉인이 아닌 `review/code/**` 산출물을 사후에 정직하게 정정한 드문 사례로, 문서화 신뢰성 관점에서 긍정적으로 평가한다. |
| flaky 테스트 관측(코드 문서화는 아니지만 plan 추적) | plan 에 "watch" 항목 신설 | **해소 확인** — `ws-token-expired-socket-lifetime-impl.md:98-109` 에 두 실측(리뷰어 1/76, 구현자 0/150)과 재개 신호가 함께 등재됨. |

## 발견사항

이번 라운드에서 신규로 발견한 CRITICAL/WARNING 급 문서화 결함은 없다.

- **[INFO]** `cutoff` 타이머의 `Math.max(0, untilCutoff)` 클램프에 개별 근거 주석이 없음 — **5라운드 연속 동일 지적**
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 내부 `timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))` (인접 `untilNotice` 클램프에는 "의도적 중복 방어" 근거 주석이 있음)
  - 상세: 2R부터 이번 5R까지 매 라운드 documentation 리뷰어가 동일하게 지적했고, 매번 "동작 영향 없음·같은 함수 8줄 이내라 혼동 가능성 낮음"을 근거로 INFO 로 보류됐다. 판단 자체는 지금도 유효하다고 본다 — 다만 5라운드째 미조치인 항목이라, "정말 사소해서 손대지 않는 것"과 "매번 보류만 반복되는 것"을 구분하기 위해 마지막으로 한 번 더 명시해 둔다. 코드 1줄 주석 추가로 이 반복 지적 자체를 종결할 수 있다.
  - 제안: 차단 사유 아님. 다음 접촉 시(다음 PR 이 이 함수를 건드릴 때) "notice 와 같은 이유 — 위 설명 참조" 한 줄을 추가해 이 5라운드짜리 루프를 닫을 것을 권한다.

## 검토했으나 이상 없음으로 판단한 항목 (전 라운드 대비 재검증)

- **`EXPECTED_EXPORTS` 완전성 목록** (`websocket-events.types.spec.ts:62-66`) — `AuthEventType`·`AuthTokenExpiredPayload` 및 `#1174` 회귀 설명 주석 유지 확인.
- **CHANGELOG.md** `Unreleased` 섹션 — 문제·해결·`connect()` no-op 함정·revoke 카브아웃 서술 유지. 2R~4R 에서 추가된 in-flight 가드·세대 비교 같은 내부 견고성 수정은 사용자 비가시적이라 CHANGELOG 미갱신이 누락이 아니라는 이전 판단에 재동의(기존 항목들의 관례도 내부 리팩터링까지는 기록하지 않음).
- **pending-가드 주석** (`ws-client.ts:24-27`) — "세 트리거 — `connect_error`·`auth.token_expired`·`disconnect("io server disconnect")`" 로 여전히 정확히 나열.
- **`TOKEN_EXPIRY_LEAD_MS`/`armExpiryTimers`/`expiryTimers` JSDoc** — 60초·900초·"약 6.7%" 수치가 상수·spec 서술과 일치, 뮤테이션 근거(M3) 명시 유지.
- **spec `_(계획·미구현)_` 배지** (`spec/5-system/6-websocket-protocol.md`) — 구현 완료 상태와 여전히 불일치하나, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:84-86` 에 "머지 후 planner 턴"으로 이미 등재돼 있고 developer 가 그 문구의 원저자가 아니므로 자기-반증형 소정정 예외 대상이 아니다 — 은닉 누락이 아니라 추적된 후속 조치.
- **유저 가이드**(`password-and-sessions.{mdx,en.mdx}`) — Callout 내용("최대 15분") 이 access token TTL 900초와 일치, ko/en 병렬 구조 유지.
- **테스트 설명 vs 실제 단언** — 신규 4R 관련 코드 변화 없음(4R 은 JSDoc·빈 줄·plan 만 수정), `ws-client.test.ts`/`websocket.gateway.spec.ts` 의 `describe`/`it` 문구는 3R 검증 시점과 동일하게 실제 단언과 부합.
- **README/설정 문서** — 신규 환경변수·설정 옵션·REST 엔드포인트 없음. `websocket/` 모듈에는 파일별 README 관례가 없어 대상 아님.
- **타이머 타입 optional 미조정·wire 메시지 미상수화** — 5라운드째 "취향 범위"로 판단 유지, 재확인.

## 요약

4라운드에 걸쳐 지적된 문서화 WARNING 은 이번 라운드에서 모두 실제 소스 대조로 해소가
재확인됐다 — 특히 `AuthTokenExpiredPayload.expiresAt` JSDoc 은 구현과 정확히 일치하도록
좁혀졌고, 3R 이 허위로 "정리했다"고 기록했던 이중 빈 줄 문제도 이번엔 실제로 제거되었으며
그 정정 과정 자체가 리뷰 산출물에 정직하게 남아 있다. 신규 CRITICAL/WARNING 급 문서화
결함은 발견되지 않았다. 유일한 잔여 항목은 `cutoff` 타이머 클램프에 개별 근거 주석이
없다는 INFO 로, 5라운드 연속 동일 지적이지만 동작에 영향이 없어 판단을 유지하되 이번엔
"이제 그만 닫아도 될 자리"라는 점을 명시해 둔다. CHANGELOG·유저 가이드·spec 절번호 인용·
테스트 설명은 모두 실체와 일치했다.

## 위험도

NONE
