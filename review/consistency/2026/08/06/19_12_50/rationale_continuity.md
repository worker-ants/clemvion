# Rationale 연속성 검토 — spec/7-channel-web-chat (impl-done, diff-base=origin/main)

## 검토 범위 확인

target 으로 지정된 `diff origin/main...HEAD -- code_areas` 는 아래 7개 패키지 `package.json` 의
`prepare` 스크립트 변경 단 하나로 구성된다 (전체 diff 를 확인함, 그 외 변경 없음):

- `codebase/packages/ai-end-reason/package.json`
- `codebase/packages/chat-channel-validation/package.json`
- `codebase/packages/expression-engine/package.json`
- `codebase/packages/graph-warning-rules/package.json`
- `codebase/packages/node-summary/package.json`
- `codebase/packages/sdk/package.json`
- `codebase/packages/web-chat-sdk/package.json`

공통 변경: `"prepare": "[ -d dist ] || tsc"` (또는 `sdk` 의 구 `node -e "require('fs').existsSync('dist')||..."`)
→ `typescript` 모듈 해석 가능 여부를 먼저 확인해 있으면 `tsc` 를 실행하고, 없으면 `dist/` 존재 시에만 통과·부재 시
명시적 에러를 던지는 형태로 교체 (HEAD 워킹트리 `codebase/packages/web-chat-sdk/package.json` 로 실측 재확인함 —
diff 의 `+` 라인과 일치).

이는 monorepo 패키지 빌드 스크립트(postinstall `prepare` 훅)의 견고성 수정으로, `spec/7-channel-web-chat/*` 의
6개 문서(`0-architecture`·`1-widget-app`·`2-sdk`·`3-auth-session`·`4-security`·`5-admin-console`·
`_product-overview`) 및 함께 번들된 다른 영역(`0-overview`·`1-data-model`·`2-navigation/*`·`3-workflow-editor`)
Rationale 발췌 어디에도 등장하지 않는 순수 빌드-툴링 영역이다. 번들 전체를 `prepare`·`tsc`·`dist/`·`pnpm`·
`package.json`·`monorepo`·`타입스크립트` 키워드로 전수 확인했고, 유일하게 근접한 언급은 `0-architecture.md §4.1`
의 "**`build:widget`** 실행 위치 = frontend Dockerfile builder 스테이지 … 빌드 노드에 pnpm 이 없어도 무방" 인데,
이는 위젯 정적 자산을 만드는 별도 스크립트(`copy-widget.mjs`/`build:widget`)에 대한 것이고 본 diff 의
`prepare`(패키지 install 시 `dist/` 보증) 훅과는 다른 메커니즘·다른 목적이라 접점이 없다.

## 발견사항

없음. 아래 이유로 CRITICAL/WARNING/INFO 어느 등급의 발견사항도 성립하지 않는다.

- **기각된 대안의 재도입**: 해당 없음 — target 은 web-chat 영역의 어떤 과거 결정도 다루지 않는다.
- **합의된 원칙 위반**: 해당 없음 — CSR-only(§R4)·eager-start(§R6)·헤더 세션 컨트롤(§R7)·presentation 두 shape
  수용(§R8)·서버측 coalesce/cancel(§R9)·i18n chrome-only(§R10)·admin 외형 저장(§R1~R7 of 5-admin-console) 등
  spec/7-channel-web-chat 의 모든 Rationale 원칙은 위젯 SPA·admin 콘솔·EIA 상호작용 설계에 관한 것이며, target 은
  이 표면을 전혀 건드리지 않는다(코드 diff 는 `dist/` 산출을 보증하는 install-hook 로직뿐).
- **결정의 무근거 번복**: 해당 없음 — `prepare` 스크립트의 이전 형태(`[ -d dist ] || tsc`, 디렉터리 존재만 확인)는
  spec Rationale 에 등재된 결정이 아니라 순수 구현 세부이므로 "번복" 대상 자체가 아니다. 오히려 diff 는 커밋 로그
  (`1ac458d07 fix(packages): prepare 가 디렉터리 존재만 보고 있었다 — stale dist 가 재빌드되지 않는다`)가 보여주듯
  결함 수정이며 그 자체로 자기 근거를 가진 변경이다.
- **암묵적 가정 충돌**: 해당 없음 — spec Rationale 에 기록된 시스템 invariant(예: 위젯 동봉 co-deploy, single-flight
  coalesce, EIA 단일 sink 등) 중 어느 것도 패키지 install-time `prepare` 훅의 존재/부재에 의존하지 않는다.

## 요약

이번 target(diff)은 `spec/7-channel-web-chat` 영역의 제품/설계 결정과 무관한 7개 공유 패키지의 `prepare`
install-hook 견고성 수정 하나로 구성되어 있다. 번들된 `spec/7-channel-web-chat/*` 전체 Rationale(R1~R10, admin
콘솔 R1~R7)과 교차 참조된 다른 영역(`0-overview`·`1-data-model`·`2-navigation/*`·`3-workflow-editor`)의 Rationale
발췌를 전수 대조했으나 어느 결정·원칙·invariant 와도 접점이 없다. 따라서 기각된 대안의 재도입, 원칙 위반, 무근거
번복, invariant 우회 중 어느 것도 발생하지 않았다 — 이 checker 의 검토 관점에서 target 은 스코프 밖(out-of-scope,
관련 없음)이며 이는 결함이 아니라 "해당 없음"이다.

## 위험도
NONE
