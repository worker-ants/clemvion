# 문서화(Documentation) 리뷰 — webchat-apibase-scheme

이 PR 의 핵심 문서 주장(코드 JSDoc·spec Rationale·plan 완료 노트)을 전부 실제 소스/git 이력과 대조했다.
아래는 그 실측 결과다.

## 검증 결과 (요청된 6개 항목)

### 1. `safeApiBase` JSDoc — "SDK 는 같은 `apiBase` 를 양쪽으로 보낸다"

**확인됨 — 정확.** `codebase/packages/web-chat-sdk/src/bridge.ts` 의 `resolveIframeTarget`(라인 192)이
`new URLSearchParams({ apiBase: config.apiBase, trigger: config.triggerEndpointPath })` 로
iframe src 쿼리에 `apiBase` 를 싣고, `codebase/packages/web-chat-sdk/src/index.ts` 의 `boot()`(라인 81)이
`resolveIframeTarget` 호출 직후 `bridge.post("wc:boot", config)`(라인 94)로 **같은 `config`**(따라서 같은
`apiBase`)를 `wc:boot` postMessage 로도 보낸다. JSDoc 이 인용한 파일·심볼명(`resolveIframeTarget`,
`web-chat-sdk/src/bridge.ts` / `wc:boot` postMessage, `web-chat-sdk/src/index.ts`) 모두 실재하고 정확히
그 역할을 한다.

### 2. "병합이 `{ ...configFromQuery(), ...boot }` 라 boot 이 덮는다"

**확인됨 — 정확.** `git show 3f1169ab5^:codebase/channel-web-chat/src/widget/use-widget.ts` 로 종전 코드를
직접 열어보면 `runApplyConfig({ ...configFromQuery(), ...c } as BootMessage);` (구 1292행) 였다. `c` 가
`bridge.onBoot((c) => ...)` 의 boot 메시지이므로, JSDoc/커밋 메시지가 서술한 "boot 이 나중에 덮는다" 는
literal 코드와 일치한다.

### 3. "위젯은 CDN origin iframe 에서 돈다(`widgetOrigin: originOf(base)`)"

**확인됨 — 정확, 인용까지 literal 일치.** `bridge.ts:203`: `return { iframeSrc, widgetOrigin: originOf(base) };`
— JSDoc/spec 이 인용한 표현이 소스 코드와 글자 그대로 같다.

### 4. `4-security.md` §R0 "기각한 대안" — 지어낸 서술인가

**실제 이력에 근거함 — 지어낸 Rationale 아님.** `git log -S"safeApiBaseFromQuery" -- spec/7-channel-web-chat/4-security.md`
로 원 도입 커밋(`aba46cc90`)을 찾아 diff 를 직접 열어보면, 당시 커밋 메시지 자체가
"direct-load 외부입력 방어(**임베드 정상경로는 postMessage 라 무관**)" 라고 명시하고 있다 — 이것이 §R0 이
"기각한 대안" 으로 요약한 "쿼리는 외부 통제 입력, `wc:boot` 은 host SDK 계약이라 신뢰 경계 안" 논리의 실제
출처다. `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 원 "문제" 절(2026-07-24 작성, 이번
커밋 이전)에도 같은 문장이 이미 있었다. §R0 은 지어낸 역사가 아니라 실재했던 과거 판단을 정확히 요약하고,
그 판단을 무너뜨린 실측(SDK 양쪽 전송 + boot 이 덮는 병합)을 근거로 제시한다.

### 5. 자매 문서 stale 여부 — `2-sdk.md` / `3-auth-session.md` / `channel-web-chat/README.md`

**stale 없음.** 세 문서 모두 `apiBase` 를 언급하지만(`2-sdk.md` boot config 스키마, `3-auth-session.md`
§R8 발급-origin 바인딩, `README.md` 데모 사용법), **스킴 검증의 비대칭성(쿼리만 검증/boot 은 무검증)** 을
서술하는 문장은 애초에 이 세 문서 어디에도 없었다 — 그 서술은 `4-security.md` 단독 SoT였고, 그 문서는
이번 diff 에서 이미 갱신됐다(`grep`으로 `4-security.md` 전체에서 `safeApiBaseFromQuery`/구 비대칭 서술
잔존 0건 확인). `5-admin-console.md`·`1-widget-app.md` 의 `wc:boot` 언급도 검증 관련 서술이 아니라
merge/재전송/locale 흐름 설명이라 이번 변경과 무관하다. 자매 문서 stale 재발 패턴은 이번 PR 에서는
발생하지 않았다.

### 6. 옛 이름 `safeApiBaseFromQuery` 잔존 여부

- 코드: `use-widget.ts` 에 `@deprecated` 위임 함수로 **의도적으로 보존**(`safeApiBase(raw, "configFromQuery")` 얇은
  래퍼). 실사용처는 `use-widget.test.ts` 뿐이고 `configFromQuery()` 자체는 이미 `safeApiBase` 를 직접 호출 —
  JSDoc 의 "기존 호출부(테스트 포함) 호환을 위한 얇은 위임" 서술과 정확히 일치.
- `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 "## 문제"/"## 관련" 절에 옛 이름이 남아있지만,
  이는 **fix 이전 시점의 문제 진단을 서술하는 절**이라 그 시점 기준으로는 정확했던 서술이고, 아래 "## 완료
  (2026-08-11)" 절이 최신 상태(`safeApiBase`/`mergeBootConfig`)로 갱신해 병기하는 이 프로젝트의 plan 라이프
  사이클 관행(원 문제 서술 보존 + 완료 노트 append)과 일치한다. 별도 조치 불요.
- `plan/complete/webchat-polish-batch.md` 의 언급도 과거 완료 기록(historical log)이라 갱신 대상 아님.
- `spec/7-channel-web-chat/4-security.md` 본문에는 옛 이름 잔존 0건(신 이름 `safeApiBase`/`configFromQuery`/
  `mergeBootConfig` 만).

## 추가 관찰 (INFO)

- **[INFO]** `mergeBootConfig` JSDoc 에 `@param`/`@returns` 태그가 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:230` (JSDoc 시작) ~ `:236` (`export function mergeBootConfig(`)
  - 상세: 같은 파일의 다른 공개 함수(`safeApiBase`·`openStream`·`seedWaitingFromStatus`·`recoverFromExpiredToken` 등)는
    전부 `@param`/`@returns` 를 명시하는데, 바로 위에 새로 추가된 `mergeBootConfig` 만 산문 설명뿐이고 태그가 없다.
    함수 자체는 짧고 의도가 산문으로 충분히 설명되지만, 이 파일의 기존 문서화 컨벤션과 어긋난다.
  - 제안: `@param fromQuery` / `@param boot` / `@returns` 세 줄만 추가하면 파일 내 일관성이 맞는다. blocking 은 아님.

- **[INFO]** plan 완료 노트의 "회귀 5건" vs 커밋 메시지의 "신규 6"(수치 표현 차이, 불일치 아님)
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:41`("회귀 5건 + 뮤테이션... 4건 RED") vs
    커밋 `3f1169ab5` 메시지("448 passed(**신규 6**)... 뮤테이션... **4건 RED**")
  - 상세: `use-widget.test.ts` 의 신규 `describe("mergeBootConfig...")` 블록에는 테스트가 정확히 6개
    (정상 배포/덮어쓰기 차단/거절+부재 undefined/상대경로 거절/부재-폴백/비-apiBase 필드) 추가됐다. plan 은
    이 중 베이스라인 성격의 "정상 배포"(no-op 확인) 1건을 제외하고 "회귀 5건" 으로, 커밋 메시지는 전체
    "신규 6" 으로 센 것으로 보인다 — 두 수치 다 "4건 RED" 뮤테이션 결과와는 모순되지 않는다(구현 로직상
    "정상 배포"·"비-apiBase 필드가 boot 승리" 2건은 구현 되돌리기 뮤턴트에도 GREEN 으로 남는 것이 논리적으로
    맞고, 나머지 4건만 RED 로 떨어지는 것도 일치한다). **다만 이 세션에서 `node_modules` 가 설치돼 있지 않아
    (`pnpm test` → `vitest: command not found`) "448 passed"/"4건 RED" 자체를 직접 재실행해 재확인하지는
    못했다** — 위 6/5 두 수치의 상호 정합성만 논리적으로 검증했고, 절대값 실행 재현은 별도 확인이 필요하면
    testing 리뷰어 영역이다.
  - 제안: 실질적 수정 불요(모순 아님, 서로 다른 산정 기준). 참고용으로만 남김.

## CRITICAL

새 CRITICAL 없음. 요청된 6개 검증 항목 전부 실측 대조 결과 **정확**했다 — 이 저장소가 과거 반복해 낸
"지어낸 Rationale"·"자매 문서 stale"·"옛 이름 잔존" 패턴이 이번 PR 에서는 재발하지 않았다.

## 요약

`safeApiBase`/`mergeBootConfig` JSDoc, `4-security.md` §R0 Rationale, plan 완료 노트가 담은 모든 검증 가능한
주장(SDK 양방향 전송, 병합 순서, CDN origin 배포, 기각한 대안의 실제 이력)을 소스 코드·git 이력과 직접
대조했으며 전부 정확했다. 자매 문서(`2-sdk.md`·`3-auth-session.md`·`README.md`) 에는 이번에 고친 사실을
서술하는 중복 문장이 애초에 없어 stale 위험이 없었고, 옛 이름 `safeApiBaseFromQuery` 는 `@deprecated` 위임으로
의도적으로 보존되며 문서 서술과 실제 사용처가 일치한다. 유일한 개선 여지는 `mergeBootConfig` JSDoc 의
`@param`/`@returns` 태그 누락(파일 내 컨벤션 불일치, INFO)과, plan 노트의 테스트 개수 표현이 커밋 메시지와
다른 산정 기준을 쓴다는 점(모순은 아님, INFO) 뿐이다.

## 위험도

NONE
STATUS: OK
