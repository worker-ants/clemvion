# 요구사항(Requirement) Review — webchat `wc:boot` apiBase 스킴 검증

대상: `codebase/channel-web-chat/src/widget/use-widget.ts` / `use-widget.test.ts`,
`plan/complete/webchat-boot-apibase-scheme-validation.md`(신설),
`plan/in-progress/webchat-boot-apibase-scheme-validation.md`(삭제, lifecycle 이동),
`spec/7-channel-web-chat/4-security.md`.

근거 plan(`plan/complete/webchat-boot-apibase-scheme-validation.md`)이 요구한 것: (1) `wc:boot` 경로에 동등한
스킴 검증을 적용할지 **판정**(host 가 상대경로/프록시 base 를 쓰는 정당한 배포가 있는지 실측 확인), (2) 적용하면
구현+회귀 테스트, 미적용이면 근거를 주석에 고정.

## 검증 절차 (직접 실측)

- `codebase/packages/web-chat-sdk/src/bridge.ts` `resolveIframeTarget()`: `iframeSrc` 를 `widgetBase`(CDN/self-origin
  base) 기준으로 만들고 `apiBase` 를 그 URL 의 쿼리 파라미터로 싣는다. `widgetOrigin: originOf(base)` — origin 은
  `widgetBase` 에서 유도되지, `apiBase` 에서 유도되지 않는다. → "위젯은 CDN/자기 origin iframe 에서 돈다" 주장이
  코드로 확인됨.
- `codebase/packages/web-chat-sdk/src/index.ts` `boot()`: `resolveIframeTarget(config, base)` 로 iframe 을 만든 뒤
  `bridge.post("wc:boot", config)` 로 **같은 `config`**(따라서 같은 `apiBase`)를 postMessage 로도 보낸다. → "SDK 는
  같은 apiBase 를 양쪽(iframe 쿼리·wc:boot)으로 보낸다" 주장이 코드로 확인됨. `validateBootConfig` 는 `!config.apiBase`
  만 거르고 스킴은 안 본다 — SDK 계층엔 스킴 검증이 원래 없었다.
- `spec/7-channel-web-chat/0-architecture.md` §4: `<widget-cdn-base>` 는 "기본값 = 배포 자신의 origin", `<api-base>`
  는 "EIA 가 서빙되는 API **origin**"으로 명시 — 위젯이 서빙되는 origin(프론트/CDN)과 API origin 은 원칙적으로 별개
  값이고, `apiBase` 는 설계상 항상 절대 origin 문자열로 취급된다(§2-sdk.md 예시도 `'https://<api-base>'`). "동봉
  same-origin 배포에서 상대경로가 우연히 동작할 수 있지 않냐"는 반론은 spec 이 `apiBase` 를 애초에 origin(절대값)으로
  타입핑하고 있어 설계상 성립하지 않는다.
- `codebase/channel-web-chat/src/widget/use-widget.ts` `applyConfig`: `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;`
  — 거절로 `apiBase` 가 `undefined` 가 되면 `applyConfig` 가 자기 자리에서 조용히 no-op 한다는 JSDoc/spec 주장과 일치.
  `mergeBootConfig` 는 코드베이스에서 `bridge.onBoot` 콜백 1곳에서만 쓰인다(직접 로드 폴백 경로는 `configFromQuery()`
  단독 사용 — 기존에도 검증돼 있던 경로라 그대로 둔 것이 맞다).
- 뮤테이션 재현(코드 판독으로 검증, 되돌리지는 않음): 신설된 6개 `it()` 중 구 병합 로직(`{...q, ...b}` 무검증)으로
  되돌리면 "덮어쓰기 차단"·"쿼리도 없고 boot 도 거절"·"상대경로 boot 거절"·"boot 이 apiBase 안 보내면(명시적
  `undefined` spread 문제)" 4건이 RED 로 떨어진다 — plan/커밋 메시지의 "뮤테이션 4건 RED" 주장과 일치. "정상 배포"·
  "apiBase 외 필드는 boot 이 이긴다" 2건은 신·구 로직에서 결과가 같아 mutation-discriminating 하지 않다(의도된
  sanity 테스트로 보임).
- 실행 검증: `channel-web-chat` 테스트 스위트 `448 passed`(신규 6, 커밋 메시지와 일치), `tsc --noEmit` 오류 0,
  `eslint` 대상 파일 0 issue — plan Rationale 의 "타입 오류 0, lint 0, 448 passed" 주장과 실측 일치.

## 발견사항

- **[INFO]** plan 완료 노트의 "회귀 5건" 이 실제 신규 테스트 수(6건)와 어긋난다.
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:41`
  - 상세: `## 체크리스트` 두 번째 항목이 "구현 + 회귀 테스트 ... 회귀 5건 + 뮤테이션(종전 동작 복원) **4건 RED**"
    라고 적었으나, 실제로 신설된 `describe("mergeBootConfig — ...")` 블록의 `it()` 은 6개(정상 배포 / 덮어쓰기 차단 /
    쿼리·boot 모두 거절 / 상대경로 boot 거절 / boot 미전송 시 폴백 / apiBase 외 필드는 boot 우선)다. 같은 커밋의
    커밋 메시지는 정확히 "신규 6" 이라고 적어 self-consistent 하지 않다. "뮤테이션 4건 RED" 쪽은 코드 판독으로
    재현 확인되어 정확하다 — 어긋나는 건 "회귀 5건" 쪽 표현뿐이다.
  - 제안: 기능·spec 에 영향 없는 완료 노트의 수치 오기재. `plan/complete/**` 는 아카이브 성격이라 급하지 않지만,
    후속 편집 시 "회귀 6건" 으로 정정하거나 "5건은 apiBase 검증 시나리오, 1건은 비-apiBase 필드 회귀"처럼 분해해
    명시하면 더 정확하다.

## 요약

`wc:boot` 경로 스킴 검증 판정은 추측이 아니라 실측(코드 판독)에 근거한다 — `resolveIframeTarget`/`boot()` 소스로
"SDK 가 apiBase 를 양쪽 경로에 동일하게 보낸다"와 "위젯 iframe origin 은 apiBase 가 아니라 widgetBase 에서 유도된다"
두 전제를 직접 확인했고, `0-architecture.md` §4 의 `<api-base>`/`<widget-cdn-base>` 정의도 "정당한 상대경로 배포는
없다"는 결론과 정합한다. 구현(`safeApiBase(raw, source)` 일반화 + `mergeBootConfig` 신설, 명시적 `apiBase: undefined`
spread 버그까지 함께 고정)은 두 경로 모두를 실제로 커버하며, `applyConfig` 의 no-op 폴백과 결합해 "거절 시 그 필드만
버리고 부팅은 막지 않는다"는 문서화된 계약과 일치한다. `spec/7-channel-web-chat/4-security.md` §입력검증 행과 신설
§R0 은 "두 경로 모두" 를 포함해 실제 구현(코드 SoT 표기 `safeApiBase`/`configFromQuery`/`mergeBootConfig`)과
line-level 로 일치한다. plan 의 세 체크박스는 실제 완료 상태(판정=적용·구현+테스트·근거를 spec+JSDoc 에 고정)와
부합하고, `spec_impact: [spec/7-channel-web-chat/4-security.md]` 는 이 PR 이 실제로 건드린 유일한 spec 파일과
일치한다(Gate C 충족, bare string·빈 배열 아님). 발견된 새 CRITICAL 은 없다 — 유일한 지적은 plan 완료 노트의 사소한
테스트 개수 오기재(INFO)뿐이다.

## 위험도

NONE
STATUS: OK
