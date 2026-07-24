# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `apiBase` 발급-origin 바인딩은 실질적인 크로스-오리진 토큰 유출 방지책이며 fail-closed 설계가 정확하다
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:37-39`, `:90-96`
  - 상세: `loadSession()` 에 `expectedApiBase` 를 필수 인자로 추가하고, 저장된 세션의 `apiBase` 와 정규화 비교 후 불일치(`!parsed.apiBase` 포함 — 레거시 세션 미기록도 포함)면 `clearSession()` 으로 폐기한다. 이는 `applyConfig` 재전송이 `apiBase` 를 바꿀 때 `clientRef` 는 새 origin으로 교체되지만 저장된 단명 토큰은 옛 origin 발급분이라는 축 분리(session vs endpoint)를 정확히 겨냥한 수정이다. 인자를 optional 로 두지 않아 호출부가 검사를 조용히 생략할 수 없게 만든 설계(JSDoc `:66-69`)도 견고하다. 실패 시 "새 대화 1회" 비용을 감수하고 토큰 유출을 막는 fail-safe 방향 선택은 보안 관점에서 올바르다.
  - 제안: 없음(현행 유지 권장). 다만 아래 두 건의 경계 케이스는 참고.

- **[INFO]** `normalizeApiBase` 는 후행 슬래시 1개만 제거 — 중복 슬래시·대소문자·query/fragment 는 원문 그대로 비교된다
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:37-39`
  - 상세: `apiBase.replace(/\/$/, "")` 는 정확히 trailing slash 하나만 벗긴다. 예를 들어 `https://api.example.com//`, 대문자 호스트(`https://API.example.com`), 또는 query string 이 붙은 `apiBase` 는 실제로는 동일 오리진이어도 문자열 불일치로 세션이 폐기될 수 있다. 이는 **가용성 저하(불필요한 재대화) 방향**이지 보안 완화 실패가 아니다 — fail-closed 이므로 공격 표면이 아니다. 실제 호출부(`use-widget.ts` 의 `cfg.apiBase`, `fetchEmbedConfig` 의 `base = apiBase.replace(/\/$/, "")`)가 생성하는 값의 형태가 제한적이라 실무 영향은 낮다.
  - 제안: 필요 시 `new URL(apiBase).origin + pathname` 형태의 정규화로 대소문자/중복 슬래시까지 흡수할 수 있으나, 현재 diff 범위에서 보안 이슈는 아니므로 필수 아님.

- **[INFO]** `expectedApiBase`(=`cfg.apiBase`, boot 페이로드 유래)는 이 diff 범위에서 스킴 검증을 거치지 않은 채로도 비교에 사용된다 — 다만 이는 diff 이전부터 있던 신뢰 경계이며 이번 변경이 새로 유발한 취약점은 아니다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:997-999` (`loadSession(cfg.triggerEndpointPath, cfg.apiBase)`), 비교 대상 `establishConfig`(`:941-957`)의 `clientRef.current = new EiaClient({ apiBase: cfg.apiBase })`
  - 상세: `safeApiBaseFromQuery()`(`use-widget.ts:99-109`)는 **query-param 폴백 경로**(`configFromQuery`)에서만 `http(s)` 스킴을 강제한다. `bridge.onBoot((c) => applyConfig({ ...configFromQuery(), ...c }))` 로 들어오는 `postMessage` 기반 `wc:boot` 의 `apiBase` 는 이 검증을 거치지 않는다. 그러나 이 신뢰 경계(호스트가 `apiBase` 를 지정)는 이번 diff 가 만든 것이 아니라 기존 SDK 계약이고, `apiBase` 는 이미 `EiaClient` 의 fetch base 로 쓰이고 있었으므로 이번 변경으로 인해 새로 노출되는 표면은 아니다. `loadSession` 이 이 값을 `expectedApiBase` 로 받아도 비교(문자열 동등)만 하므로 인젝션 벡터는 아니다.
  - 제안: diff 범위 밖이나, 향후 후속 작업 시 `wc:boot` 경로에도 `safeApiBaseFromQuery` 와 동등한 스킴 검증을 적용하는 것을 고려할 만하다(이번 PR 필수 아님).

- **[INFO]** 테스트 픽스처의 `"iext_..."` 토큰·`"https://api.example.com"` 등은 실제 시크릿이 아닌 목 데이터
  - 위치: `codebase/channel-web-chat/src/lib/session-store.test.ts`, `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 전반
  - 상세: 하드코딩된 문자열은 테스트용 더미 토큰/도메인이며 실제 자격증명·API 키가 아니다. 하드코딩 시크릿 항목에 해당하지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 `applyConfig` 재전송으로 `apiBase`(EIA 호출 origin)가 바뀔 때 `sessionStorage` 에 남아 있던 이전 origin 발급 단명 토큰이 새 origin 으로 새어나갈 수 있던 실제 취약점(세션-엔드포인트 축 분리)을 겨냥한 방어 코드다. `session-store.ts` 의 `loadSession()` 에 `expectedApiBase` 필수 인자 + 정규화 비교 + 미기록/불일치 시 무조건 폐기(fail-closed)를 추가했고, `use-widget.ts` 는 실제로 현재 `apiBase` 를 넘기도록 배선을 고쳤다. 회귀 테스트도 옛 토큰이 어떤 요청에도 실리지 않음을 헤더/바디/URL 전수로 검증하는 대조군까지 포함해 견고하다. 새로 도입된 코드에서 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화 등 CRITICAL/WARNING 급 결함은 발견되지 않았고, 지적된 항목은 모두 경계 케이스에 대한 INFO 수준 참고사항이다.

## 위험도

NONE
