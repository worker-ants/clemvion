STATUS=success scope review complete. Findings: 0 CRITICAL, 0 WARNING, 1 INFO.
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — eslint10-upgrade

## 검토 방법

`git log origin/main..HEAD`로 이 브랜치의 커밋 7개(`beed5143e`~`193f90f48`)를 확인했고, 76개
변경 파일 전체(코드 29개 + `review/**` 산출물 44개 + plan/문서 3개)를 대조했다. 커밋 이력은
"eslint 9→10 상향(`beed5143e`) → `/ai-review` Critical/Warning fix 2라운드
(`0f3b3e0c3`~`193f90f48`) → plan/문서 동기화(`bb278116e`, `214af6d0e`)"로 이어지는 단일하고
일관된 작업 흐름이며, CLAUDE.md가 명시한 "구현 완료 후 자동 review/fix는 상시 승인된 강제
의무" 워크플로와 정확히 대응한다.

## 발견사항

- **[INFO]** 커밋된 파일 76개 중 44개가 실제 코드가 아니라 `review/code/**`·`review/consistency/**` 산출물(SUMMARY/RESOLUTION/각 관점별 `.md`/`meta.json`/`_retry_state.json`)이다.
  - 위치: `review/code/2026/08/28/11_45_02/**`, `review/code/2026/08/28/12_28_11/**`, `review/consistency/2026/08/28/11_15_50/**`, `review/consistency/2026/08/28/12_20_11/**`
  - 상세: 이는 CLAUDE.md "정보 저장 위치" 표와 `review/**` 산출물 커밋 관행에 정확히 부합하는 표준 절차이며, 스코프 위반은 아니다. 다만 PR 제목("eslint 9→10 상향")만 보고 diff 크기(76파일, +3,792/-376줄)를 판단하면 실제 기능적 변경 범위(29개 코드/설정 파일)보다 훨씬 커 보일 수 있다는 점만 기록해 둔다 — 리뷰어가 "커밋된 파일 수"를 스코프 위반의 프록시로 오판하지 않도록 하기 위함.
  - 제안: 조치 불요. 향후 유사 리뷰에서 "review/** 산출물"과 "실제 codebase 변경"을 분리해서 스코프를 판단할 것.

## 검증한 항목 (스코프 이탈 없음 확인)

- **핵심 diff 29개 파일 전수 대조** — 각 변경이 다음 4개 범주 중 하나에 정확히 귀속됨을 확인했다. 범주 밖 변경(요청 이상의 리팩토링, 기능 확장, 무관한 파일 수정)은 발견되지 않았다.
  1. **버전/설정 직접 상향**: `.github/dependabot.yml`, `PROJECT.md`, `codebase/backend/eslint.config.mjs`, `codebase/backend/package.json`, `codebase/packages/*/package.json`(8개), `codebase/frontend/eslint.config.mjs`, `codebase/channel-web-chat/eslint.config.mjs`, `pnpm-lock.yaml`, `plan/in-progress/deps-peer-gating-and-eslint10.md` — 전부 eslint 9→10 상향과 그 근거·결정(왜 frontend/channel-web-chat은 9에 남는지)의 직접 서술이다.
  2. **`no-useless-assignment`(eslint 10 recommended) 기계적 대응**: `ssrf-safe-url.util.ts`, `form-mode.ts`, `execution-engine.service.ts`, `public-webhook-throttle.guard.ts`, `kb-tool-provider.ts`, `information-extractor.handler.ts`, `web-chat-sdk/src/index.ts`, `ai-turn-executor.ts`, `text-chunker.ts`, `knowledge-base.service.ts` — 전부 `let x = <default>` → `let x` 형태의 죽은 초기화/재할당 제거이며, 각 지점을 직접 열어 실행 경로상 동작 변화가 없음을 확인했다(예: `ai-turn-executor.ts`의 `finalSystemPrompt` 재할당 2곳 제거는 이후 스코프에서 그 변수가 다시 읽히지 않음을 grep으로 확인).
  3. **`preserve-caught-error`(eslint 10 recommended) 대응**: `expression-resolver.service.ts`, `code.handler.ts`(`cause: err` 추가), `secret-resolver.service.ts`(반대로 `eslint-disable-next-line`으로 의도적 억제 + 근거 주석) — 새로 켜진 규칙이 지적한 지점에 국한된 최소 수정이다.
  4. **버전 상향이 직접 유발한 repo-guard 갱신**: `eslint-unicorn-peer-guard.ts`(`parseGteFloor`가 2-component `>=10.4` 표기까지 받도록 확장), `eslint-unicorn-peer.spec.ts`(`node_modules` 경로 직접 읽기로 전환 — `eslint-plugin-unicorn@73`의 `exports` 맵 제약 우회) — 둘 다 버전 상향 자체가 가드의 전제(3-component 표기, `require()` 서브패스 접근)를 깨뜨려서 발생한 **불가피한 후속 수정**이며, 가드의 계약(설치본 실측, fail-closed)은 그대로 유지된다.
- **테스트 추가 2건(`text-chunker.spec.ts`, `secret-resolver.service.spec.ts`)** — 신규 기능이 아니라 직전 `/ai-review` 라운드(`11_45_02`)가 지적한 Warning(force-split 분기·복호화 실패 분기의 회귀 안전망 부재)에 대한 fix다. CLAUDE.md가 "같은 턴의 강제 의무"로 규정한 review-fix 루프의 정상 산출물이며, 커밋 이력(`9bcbb7fa5`, `3a540aa81`, `193f90f48`)도 SUMMARY 항목 번호를 그대로 인용해 추적 가능하다.
- **불필요한 리팩토링·무관한 임포트/포맷팅 변경**: 발견되지 않음. 모든 편집이 한 줄~수 줄 단위로 좁고, 실질 변경(초기화 제거·`cause` 추가·주석 갱신)과 포맷팅/공백 변경이 섞인 지점도 없었다.
- **주석 변경**: 다수 발생하지만(예: `dependabot.yml`, `eslint.config.mjs` 헤더) 전부 이번 버전 상향의 "왜"를 갱신하는 목적에 정확히 대응하며, 이 저장소의 확립된 "근거·실측·날짜와 함께" 관행과 일치한다. 무관한 주석 추가/삭제는 없었다.
- **설정 변경**: `dependabot.yml`·각 `eslint.config.mjs`·`package.json` 전부 이번 상향 작업의 직접 대상이며, 이 상향과 무관한 설정 항목(예: 다른 CI job, 다른 lint 규칙 세트)을 건드린 흔적은 없다.

## 요약

이 PR은 ESLint 9→10 상향(backend + packages 8개)과 그로 인해 새로 발화한 recommended 룰
(`no-useless-assignment`, `preserve-caught-error`) 15건 수정, 버전 상향이 직접 깨뜨린
repo-guard 파서 확장, 그리고 mandatory `/ai-review` fix 루프의 정상 산출물(테스트 2건 추가 +
문서 동기화)로 구성된 단일하고 일관된 작업이다. 커밋 이력을 origin/main 대비 전수 대조한
결과 요청 범위를 벗어난 추가 수정, 무관한 리팩토링, 요청하지 않은 기능 확장, 무관한 파일·코드
영역 수정, 의미 없는 포맷팅/주석/임포트 변경, 의도치 않은 설정 변경 중 어느 것도 발견되지
않았다. `review/**` 산출물이 커밋 파일 수의 절반 이상을 차지해 diff가 커 보이지만, 이는 이
저장소가 명시적으로 요구하는 절차의 산출물이지 스코프 이탈이 아니다.

## 위험도
NONE
