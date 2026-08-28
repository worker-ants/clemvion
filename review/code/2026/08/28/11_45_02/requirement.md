# 요구사항(Requirement) 리뷰 — eslint 9→10 상향 (deps-peer-gating-and-eslint10 §2)

## 검증 방법

프롬프트에 전체 컨텍스트가 실리지 않은 파일은 전부 `Read` 로 직접 열어 대조했다. 추가로
다음을 실측했다:

- `codebase/backend`: `npx nest build` (실제 build 스크립트) — **clean**.
- `codebase/backend`: `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` (실제 lint
  스크립트, `NODE_OPTIONS=--max-old-space-size=6144`) — **clean, 0 output**.
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 단독 실행 —
  **30/30 pass**.
- `node_modules` 실물 대조: `eslint-plugin-unicorn@73.0.0` 의 `peerDependencies.eslint` =
  `>=10.4` (주석 주장과 일치).
- `npm view` 로 라이브 registry 대조: `eslint-plugin-react@7.37.5`/`eslint-plugin-jsx-a11y@6.10.2`/
  `eslint-plugin-import@2.32.0`(모두 eslint 9 상한) vs `eslint-plugin-react-hooks@7.1.1`(peer 에
  `^10.0.0` 추가) — `codebase/frontend/eslint.config.mjs` 헤더 주석의 수치·버전과 **완전히 일치**.
  `eslint-config-next@16.3.3` peer `eslint: >=9.0.0` 도 일치.
  `eslint-plugin-unicorn@57/66/70` 의 peer(`>=9.20.0`/`>=10.4`/`>=10.4`)도
  `codebase/backend/eslint.config.mjs` 의 registry 표와 일치.
- `@eslint/js@10` 의 `configs.recommended.rules` 에 `no-useless-assignment`,
  `preserve-caught-error` 가 실제로 포함됨을 코드로 확인 — 플랜이 "새 recommended 룰 15건"
  이라고 서술한 근거가 맞다.
- `grep -rl '"eslint":' --include=package.json codebase` = 11개 파일 — plan 의 "11개
  워크스페이스" 서술과 일치. `.github/dependabot.yml`, `codebase/backend/eslint.config.mjs` 에는
  더 이상 "10개" 잔존 표현 없음(모든 미러가 동기화됨).
- `.github/dependabot.yml` YAML 파싱 확인(`python3 -c "import yaml..."`) — `ignore:` 리스트에
  `typescript` 항목만 남고 unicorn 항목은 완전히 제거(댓글만 잔존, 구문 오류 없음).

## 발견사항

### `no-useless-assignment` 기계적 제거 8곳 — 전부 실제로 안전함을 개별 확인

아래 파일들은 `let x: T = <초기값>;` → `let x: T;` 로 바꾸고 `try` 블록에서만 대입한다.
각 파일을 열어 **모든 `catch` 경로가 조기 `return`/`throw` 로 끝나거나 자체 폴백 대입을
하는지** 확인했다 — 전부 안전:

- `codebase/backend/src/common/utils/ssrf-safe-url.util.ts:156` (`addrs`) — catch 가 `return`.
- `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:289` (`re`) — catch 가
  `re = null` 폴백.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918` (`live`) —
  catch 가 `return`.
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:67` (`trigger`) — catch 가
  `return true`.
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:239` (`results`) —
  catch 가 `return`.
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:328`
  (`recalled`) — catch 가 `recalled = []` 폴백.
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`finalSystemPrompt` 재대입 2곳,
  L1618/L2038 근방) — 제거된 대입 이후 그 지역 변수가 함수 내에서 **더 이상 읽히지 않음**을
  각 함수 끝까지 grep 으로 확인(진짜 dead store).
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:601` (`graphRequeued -=`
  제거) — 바로 다음 줄이 `throw err` 라 `return { …, graphRequeued }` 자체에 도달하지 않음을
  확인(주석과 실제 흐름 일치).
- `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts:69`
  (`overlapBuffer = getOverlapText(...)` 제거) — 제거된 줄 두 줄 뒤에 무조건
  `overlapBuffer = '';` 가 있어(diff L80) 원래도 read 없이 즉시 덮어써지던 죽은 대입이었음을
  확인. 기능 변경 없음.
- `codebase/packages/web-chat-sdk/src/index.ts:63` (`size`) — catch 가 `throw`.

전부 TS 컴파일러의 definite-assignment 분석을 통과하고(빌드 clean), 런타임 동작도 동일함을
논리적으로 확인했다. **의도(주석)와 구현이 일치**하며 회귀 위험 없음.

### `preserve-caught-error` 대응 3곳 — 정책 일관성 확인

- `codebase/backend/src/nodes/data/code/code.handler.ts:454`,
  `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316`
  — `cause: err` 추가. 메시지 포맷 불변, 원인 체인만 보존 — 기능·에러 시나리오 개선.
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94` — 유일하게
  `eslint-disable-next-line preserve-caught-error` 로 룰을 끔. 근거 주석이 SS-SE-05(평문 비노출)
  요구사항 및 `#814`(SSRF 에러 메시지 일반화, "서버 로그니까 안전"이 오전제로 반증된 선례)를
  정확히 인용하며, `cause: err` 를 달면 의도적 에러 추상화가 무의미해진다는 논리가 타당함.
  `eslint src/modules/secret-store/secret-resolver.service.ts --max-warnings 0` 를 직접 실행해
  disable 주석이 실제로 그 위반과 매칭돼 정확히 억제됨(무관한 오탐 억제가 아님)을 확인.

### `parseGteFloor` 파서 확장 — 회귀 없이 커버리지 확대

- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts:24` —
  `>=X`/`>=X.Y`/`>=X.Y.Z` 를 모두 받도록 정규식을 넓히고 누락 컴포넌트를 0 으로 채움. 기존
  "해석 안 하는 형태" 테스트 목록에서 `'>=9'`/`'>=9.18'` 을 빼고(이제 유효 입력으로 편입)
  `'>='`/`'>=x'` 를 새로 추가해 여전히 fail-closed 임을 고정 — **회귀 테스트가 형태(자릿수)
  축을 정확히 겨냥**하고 있어 커버리지 갭이 남지 않음.
- `eslint-unicorn-peer.spec.ts` — `readInstalledPackageJson` 헬퍼(파일 경로 직접 읽기)로
  전환. `eslint-plugin-unicorn@73` 의 `exports` 맵이 `package.json` 서브패스 접근을 막는다는
  주석의 주장을 실제 설치 패키지로 재현하지는 않았으나(별도 확인 시도 안 함), 스펙 실행
  결과(30/30 pass, 대상 describe 블록 포함)로 헬퍼가 실제로 올바른 값을 반환함을 간접 확인.

### `.github/dependabot.yml` — unicorn ignore 해제, YAML 유효성 확인

ignore 항목 삭제 후 남은 리스트는 `typescript` 단일 항목뿐이며 YAML 파싱이 정상. 되살릴 조건
(가드 + `--strict-peer-dependencies` 이중 방어)이 명시돼 있어 "막을 대상 없는 억제"를
치우면서 재발 방지 체계도 함께 서술됨 — 의도와 구현이 일치.

### plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md`) 수치 정합성

"11개 워크스페이스", "9개 완료 / 2개 상류 차단", "backend + packages/* 8개" 등 서술을
`grep -rl '"eslint":' --include=package.json codebase` (11개) 로 재검증 — 일치. 체크박스
갱신·미러 3곳(본문 §범위·체크박스·`eslint.config.mjs`) 동기화 및 `.github/dependabot.yml`
미러 소거(unicorn ignore 삭제)도 실물과 일치.

### `[INFO]` spec 문서 부재 — 이 변경 영역은 제품 spec 대상이 아님

`spec/` 하위에 eslint 버전 정책·dependabot 정책을 규정한 문서가 없다(유일한 관련 문서는
`spec/conventions/frontend-layering.md` 인데, 이는 layering 규칙 자체를 다루고 이번 diff는 그
파일의 규칙 내용을 바꾸지 않았다 — `codebase/frontend/eslint.config.mjs` 변경은 헤더 주석
추가뿐). 이 변경은 순수 빌드 툴체인/의존성 관리 영역이며, SoT 는 코드 주석
(`codebase/backend/eslint.config.mjs`, `codebase/frontend/eslint.config.mjs`) 과
`plan/in-progress/deps-peer-gating-and-eslint10.md` 로 명시적으로 지정돼 있다. Spec 누락으로
보지 않는다(제품 요구사항이 아니라 인프라 결정이므로 spec 커버리지 대상 자체가 아님).

### TODO/FIXME — 없음

diff 전역에서 TODO/FIXME/HACK/XXX 패턴 없음. `plan/.../deps-peer-gating-and-eslint10.md` §3
("frozen 게이트의 사각지대")은 미완료 후속 항목이지만 **이 PR 의 범위 밖으로 명시적으로
분리**돼 있고(§3 는 별도 체크리스트 항목, "typeorm → ioredis 실측이 선행" 명시), 이번 diff
자체가 그 갭을 만들지 않았다 — 처리 지연이 아니라 스코프 경계 설정으로 판단.

## 요약

이번 변경은 backend + 8개 내부 패키지의 eslint 9→10 상향(및 `eslint-plugin-unicorn`
56→73 동반 상향)과 그로 인해 발생한 신규 recommended 룰 위반 15건의 수정, 낡은 파서
가정(3-component peer range) 반증에 따른 가드 확장, 관련 문서(`dependabot.yml`,
`eslint.config.mjs` 주석, plan 체크리스트) 동기화로 구성된 순수 인프라/툴체인 PR 이다. 30개
변경 파일을 전부 열어 대조한 결과 각 `no-useless-assignment` 제거가 실제로 죽은 대입이었음을
개별 확인했고(catch 경로 전수 확인), `preserve-caught-error` 대응 3곳 중 유일한 disable 은
기존 보안 요구사항(SS-SE-05)과 정확히 부합하며 실제로 그 위반에 매칭돼 억제됨을 lint 실행으로
확인했다. `parseGteFloor` 확장은 정확한 회귀 테스트(형태-축 커버리지)를 동반한다. 문서에
적힌 registry 실측 값들(unicorn 56~73 대 peer floor, frontend 4개 플러그인의 peer 범위)을
`npm view` 라이브 조회로 전수 대조한 결과 전부 정확했다 — 이 PR 의 주석·plan 서술은 지어낸
근거가 아니라 실제로 검증 가능한 사실이다. `nest build`·backend 전체 lint(`--max-warnings 0`)
를 직접 재실행해 clean 을 확인했고, 대상 spec 파일은 30/30 통과했다. CRITICAL/WARNING 급
결함을 발견하지 못했다.

## 위험도

NONE
