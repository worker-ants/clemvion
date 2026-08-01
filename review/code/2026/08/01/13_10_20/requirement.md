# 요구사항(Requirement) 리뷰 — eslint-plugin-unicorn peer 복원 (13_10_20 세션)

## 배경

이 changeset 은 `eslint-plugin-unicorn` 을 dependabot(`#1049`, `a4bc9fde3`)가 의도치 않게 올린
`^72.0.0`(eslint peer `>=10.4`, 설치본 `9.39.4` 와 unmet peer)에서 원래 pin `^56.0.1` 로 되돌리고
(`d30c473df`), 직전 검토 라운드(`review/code/2026/08/01/12_27_15`)가 지적한 Warning 3건을 조치한
커밋(`b268ed671`)까지 포함한다. `plan/in-progress/eslint-unicorn-peer-restore.md` 가 SoT.

## 독립 재검증 (직접 재현, 이번 세션에서 수행)

- `.github/dependabot.yml`, `PROJECT.md:49-51`, `codebase/backend/eslint.config.mjs:16-35`,
  `codebase/backend/package.json:119` 를 직접 `Read` 로 열어 프롬프트의 unified diff 와 실제 파일
  내용이 1:1 일치함을 확인.
- `npm view eslint-plugin-unicorn@{57,58,60,62,66}.0.0 peerDependencies` 로 registry 를 재조회 —
  `eslint.config.mjs:26-27` 의 실측 표(`57=>=9.20.0` / `58~59=>=9.22.0` / `60~61=>=9.29.0` /
  `62~65=>=9.38.0` / `66+=>=10.4`)와 **전 구간 정확히 일치**.
  `npm view eslint-plugin-unicorn time` 으로 `57.0.0` 릴리스일이 `2025-02-17`임을 재확인 —
  plan 문서의 "약 1.5년" 서술(전 라운드 INFO#5 로 정정된 값)과 일치.
- `git show a4bc9fde3 / d30c473df / 7c10c9f02 / b268ed671` 로 인용된 커밋 4개가 실제로 존재하고
  내용이 서사와 일치함을 확인(지어낸 이력 아님).
- `codebase/backend/node_modules/eslint-plugin-unicorn/package.json` 실측 —
  `version: 56.0.1`, `peerDependencies.eslint: ">=8.56.0"`. `node_modules/eslint/package.json` 실측
  — `version: 9.39.4`. 둘 다 `eslint-unicorn-peer.spec.ts` 의 실측 대조 단언이 전제하는 값과 정확히
  일치(하드코딩 아님을 실측으로도 확인).
- `npx jest eslint-unicorn-peer.spec.ts` 직접 실행 — **28/28 PASS** (plan 체크리스트가 주장하는
  숫자와 일치).
- Non-vacuous 여부를 독립적으로 재검증하기 위해 `eslint.config.mjs` 의
  `'unicorn/catch-error-name': ['error', ...]` 를 `'off'` 로 뮤테이션 후 재실행 →
  "발화 1건" 단언이 실제로 **RED** (`Expected length: 1, Received length: 0`)로 실패함을 직접
  확인. `cp` 백업 → 뮤턴트 → RED 확인 → 복원 → `git diff --stat` 로 diff 0 재확인까지 수행,
  `review/code/.../RESOLUTION.md` 가 주장하는 mutation 결과와 독립적으로 부합.
- `codebase/backend/jest.config.ts` (`testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'`) 확인 —
  `eslint-unicorn-peer.spec.ts` 헤더가 주장하는 "지워질 수 있는 호출부가 없다"(jest 자동 발견)는
  서술이 실제 설정과 일치. `eslint-unicorn-peer-guard.ts`/`-fixture.ts` 는 `.spec.ts` 로 끝나지
  않아 별도 suite 로 이중 실행되지 않음도 확인.
- `spec/conventions/` 전체 목록을 확인했으나 dependabot/eslint 플러그인 버전 정책을 다루는 문서는
  없음 — `plan` frontmatter `spec_impact: none` 판정과 일치.

## 발견사항

없음 — Critical/Warning 급 요구사항 불일치를 찾지 못했다.

- **[INFO]** 관련 spec 문서 부재는 예상된 결과다.
  - 위치: `spec/` 전체(해당 없음)
  - 상세: 이 변경은 devDependency 버전 복원 + CI(dependabot) 설정 + 회귀 테스트 추가로,
    `spec/conventions/` 어디에도 이 영역(빌드 툴체인 버전 정책)을 다루는 문서가 없다. 실제 규범은
    `PROJECT.md`(§버전 핀 정책) 가 SoT 이고, 이번 diff 는 그 문서를 대상 파일에 포함해 정확히
    갱신했다(`PROJECT.md:49-51`, 개수 "typescript 1건" → "typescript·eslint-plugin-unicorn 2건" +
    `.github/dependabot.yml` ignore 블록 개수와의 2-place 결속 문구 포함).
  - 제안: 조치 불요. `spec_impact: none` 이 정확한 판정이다.

- **[INFO]** 직전 리뷰 라운드(`12_27_15`)의 Warning 3건이 후속 커밋(`b268ed671`)에서 실제로,
  그리고 이번 세션의 독립 재현으로도 확인된 방식으로 조치되었다.
  - 위치: Warning#1(Documentation) → `PROJECT.md:49`, Warning#2(Testing) →
    `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`(신규),
    Warning#3(Maintainability) → `codebase/backend/eslint.config.mjs:22-24`(SoT 선언) +
    `.github/dependabot.yml:87-89`/`plan/.../eslint-unicorn-peer-restore.md:40-42`(참조로 축약)
  - 상세: 세 항목 모두 diff 상에서 실제로 반영돼 있고, 새로 추가된 `eslint-unicorn-peer.spec.ts` 는
    본 세션에서 직접 실행(28/28 PASS) 및 뮤턴트 RED 로 non-vacuous 함을 재확인했다. "고쳤다"는
    서술과 실제 코드 상태 사이 괴리 없음.
  - 제안: 조치 불요, 참고 기록.

## 요약

`.github/dependabot.yml`, `PROJECT.md`, `codebase/backend/eslint.config.mjs`,
`codebase/backend/package.json`, 신규 `eslint-unicorn-peer{.spec,-guard,-fixture}.ts` 세 파일,
`plan/in-progress/eslint-unicorn-peer-restore.md`, `pnpm-lock.yaml` 를 모두 직접 열어 프롬프트의
unified diff 와 실제 파일이 정확히 일치함을 확인했고, 신규 회귀 가드 테스트는 실제로 실행해 28/28
PASS 를 재현했으며 룰을 `off` 로 끄는 뮤테이션을 직접 적용해 RED 로 실패함을 독립 검증해
non-vacuous 함을 확인했다(적용 후 `cp` 로 원복, `git diff --stat` 로 잔여 diff 0 확인). registry
실측(`npm view`)·git 커밋 이력(`git show`) 도 프롬프트·plan 문서의 서사와 전부 일치했다. 직전
라운드가 지적한 Warning 3건(PROJECT.md 카운트 stale, 자동 회귀 가드 부재, registry 표 3중 중복)은
모두 후속 커밋에서 조치됐고 이번 세션에서 독립적으로 재확인됐다. 함수 시그니처
(`parseGteFloor`/`parseCaretFloor`/`parseVersion`/`compareTriple`/`satisfiesFloor`)와 실제 동작이
일치하며, null/빈 문자열/복합 range 등 엣지 케이스에 대해 fail-closed(`null` 반환 → 호출부
`expect(...).not.toBeNull()`) 로 vacuity 를 명시적으로 차단하는 설계도 확인했다. `spec/` 는 이
영역을 다루는 문서가 없어 대상 아님(`spec_impact: none`)이 정확하다. TODO/FIXME 류 미완성 표식
없음, 반환값 누락 경로 없음, 비즈니스 로직(56.0.1 선택 근거 — preset 미사용·단일 룰만 사용·
워크스페이스 간 eslint floor 불일치 회피)도 코드·주석·plan 문서 3자가 정확히 부합한다.

## 위험도

NONE
