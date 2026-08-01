# 요구사항(Requirement) 리뷰 — eslint-plugin-unicorn peer 복원

## 변경 요약
dependabot #1049 가 `eslint-plugin-unicorn` 을 `^56.0.1` → `^72.0.0` (16 major) 로 올려
`eslint@>=10.4` peer 를 요구하게 됐고, 설치본은 `9.39.4` 라 unmet peer 가 발생했다. 본 변경은
① `codebase/backend/package.json` 을 `^56.0.1` 로 되돌리고, ② `pnpm-lock.yaml` 을 그에 맞춰
재생성하고, ③ `eslint.config.mjs` 주석을 registry 실측 표로 최신화하고, ④ `.github/dependabot.yml`
에 `eslint-plugin-unicorn` major ignore 를 추가해 재발을 차단하고, ⑤ `plan/in-progress/
eslint-unicorn-peer-restore.md` 로 경위·근거·검증을 기록한다.

## 독립 검증 (직접 재현)
- `pnpm install --frozen-lockfile` — unmet peer 경고 없음 (claim 과 일치).
- `codebase/backend` 에서 임시 `catch (badName)` 파일에 `npx eslint` 실행 → `unicorn/catch-error-name`
  룰이 실제로 발화함을 확인(`The catch parameter badName should be named err`). 버전을 되돌리며
  룰이 조용히 죽지 않았음을 독립적으로 재현.
- `pnpm lint` (backend) → 0 errors, 101 warnings(기존 설정대로 warn 규칙만). unicorn 규칙 관련 에러 없음.
- `.claude/tests/test_dependabot_npm_coverage.py` 14 tests 전부 PASS — `ignore` 블록 추가가
  `directory:` 파서·커버리지 불변식을 깨지 않음.
- `.github/dependabot.yml` 을 PyYAML 로 파싱해 신규 `ignore` 엔트리(`eslint-plugin-unicorn`,
  `update-types: ["version-update:semver-major"]`) 구조 확인 — 기존 `typescript` 항목과 동일 스키마.
- `npm view eslint-plugin-unicorn@<v> peerDependencies` 로 주석·plan 의 registry 실측 표
  (56.x=`>=8.56.0` / 57=`>=9.20.0` / 58~59=`>=9.22.0` / 60~61=`>=9.29.0` / 62~65=`>=9.38.0` /
  66+=`>=10.4`) 전 구간을 재조회 — **정확히 일치**.
- `npm view eslint dist-tags` → `maintenance: 9.39.5`, `latest: 10.8.0` — plan 의 "eslint 9 는
  maintenance, latest=10.8.0" 주장과 일치.
- `npm view typescript-eslint@latest peerDependencies` → `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` —
  plan 주장과 일치.
- `git log`/`git show` 로 #1049(a4bc9fde3, 56.0.1→72.0.0 major bump), #1047(484ee9509, TS
  5.9.3→7.0.2), #1043(a441e7f76), #1034(a41a0456e), #1030(395dedc8b), #1058(7c10c9f02) 전부
  실제 커밋으로 확인 — 서사가 지어낸 이력이 아님.
- `codebase/backend/src/instrumentation.ts` 에 `git diff HEAD` 로 diff 0 확인 — plan 체크리스트의
  "mutation 검증 후 원복, diff 0" 주장과 일치.
- 다른 워크스페이스(`codebase/frontend`, `codebase/channel-web-chat`, `codebase/packages/*`)
  어디에도 `eslint-plugin-unicorn` 의존성이 없음을 확인 — 변경 범위가 backend 단독이라는
  주장과 일치, 후속 동기화 누락 없음.

## 발견사항

- **[INFO]** 관련 spec 문서 부재 (예상된 결과)
  - 위치: `spec/` 전체 (해당 없음)
  - 상세: `spec/` 하위에 dependabot·eslint 플러그인 버전 고정을 다루는 문서가 없다
    (`grep -rli "dependabot\|eslint-plugin-unicorn"` 무관련 매치만). 이 변경은 빌드 툴체인/CI
    설정이라 `spec/` 대상이 아니며, plan frontmatter 의 `spec_impact: none` 및 `#1058` 과 동일한
    판단이라는 자체 서술과 일치한다.
  - 제안: 조치 불요. `spec_impact: none` 이 정확한 판정이다.

- **[INFO]** plan 문서의 "3년 가까이 유효" 서술이 같은 절의 실측 표와 어긋난다
  - 위치: `plan/in-progress/eslint-unicorn-peer-restore.md:49`
  - 상세: "주석의 주장("v57+ 는 >=9.20")이 정확했다. **3년 가까이 유효한 근거다**." 라고
    적혀 있는데, `npm view eslint-plugin-unicorn@57.0.0 time` 실측 결과 v57 릴리스일은
    2025-02-17 이다. 오늘(문서 frontmatter `started: 2026-08-01`) 기준 경과는 약 1.5년으로,
    "3년 가까이" 와는 거리가 있다(가장 관대하게 eslint 9.0.0 릴리스일 2024-04-05 을 기준으로
    잡아도 ~2.3년). 표 자체(56.x~66+ 각 구간의 peer 버전)는 registry 재조회 결과 전부 정확했고,
    이 문서가 스스로 "실측으로 재확인" 이라 표방하는 만큼, 실측되지 않은 서사적 과장 한 줄이
    같은 절에 섞여 있는 점만 짚는다. 기능·의존성 값 자체에는 영향 없음(코드 변경 정확성과 무관).
  - 제안: 코드 변경에는 영향 없으므로 조치 불요. plan 문서를 추후 편집할 기회가 있으면 "3년
    가까이" 를 실측 가능한 표현(예: "v57 릴리스 이후 계속 유효")으로 다듬는 정도로 충분하다.

## 요약
`eslint-plugin-unicorn` 을 dependabot 의 의도치 않은 16-major 점프(`^56.0.1`→`^72.0.0`) 이전
값으로 되돌리고, 재발 방지용 dependabot ignore 규칙을 추가하는 변경이다. package.json·
eslint.config.mjs 주석·pnpm-lock.yaml·dependabot.yml·plan 문서 다섯 파일이 서로 정합적이며,
독립 재현으로 (1) `unicorn/catch-error-name` 규칙이 여전히 정상 발화하고, (2) `pnpm install`
에서 unmet peer 경고가 사라졌으며, (3) 기존 dependabot 커버리지 가드 테스트 14건이 모두
통과하고, (4) plan 문서의 registry 실측 표·dist-tag 주장·PR 이력이 npm registry·git log 재조회
결과와 정확히 일치함을 확인했다. TODO/FIXME 류 미완성 표식 없음, 기능 완전성·에러 시나리오·
반환값(N/A, 설정 변경)·비즈니스 로직(preset 미사용, catch-error-name 단일 룰 유지) 모두
의도대로 구현됐다. 관련 spec 문서는 존재하지 않으며 이는 `spec_impact: none` 판단과 부합한다.
유일한 흠은 plan 문서 한 문장("3년 가까이 유효")이 같은 절의 실측 데이터와 정량적으로 어긋나는
서사적 과장인데, 코드·의존성 변경의 정확성에는 영향이 없다.

## 위험도
NONE
