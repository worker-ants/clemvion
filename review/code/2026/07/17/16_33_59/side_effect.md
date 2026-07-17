# 부작용(Side Effect) 리뷰 — codebase/frontend/eslint.config.mjs

## 리뷰 범위

`src/lib/**` 스코프에 `no-restricted-imports` 규칙 블록을 신설해 `@/components/**` (및 그 상대경로 우회 형태) import 를 금지하는 ESLint 설정 변경. 이 변경 자체는 순수 정적 설정 파일(빌드/린트 타임)이며 런타임 코드가 아니므로, 8개 표준 관점 중 "린트 게이트가 유발하는 부작용"(신규 error 발생 여부, 스코프 오탐/누락)에 집중해 실측 검증했다.

## 검증 방법

1. `npx eslint .` 를 변경 적용 전(`git stash`)/후로 각각 실행해 diff 비교
2. `src/lib/**` 전체에 대해 `@/components`, `../components`, 딥 상대경로 등 실제 import 패턴을 임시 probe 파일로 만들어 규칙 매칭 여부 실측 (실행 후 즉시 삭제, `git status` 로 잔여물 없음 확인)
3. 모노레포 내 다른 `eslint.config.mjs` (backend, channel-web-chat) 와의 격리 여부 확인

## 발견사항

- **[INFO]** 기존 코드베이스에 신규 error 유발 없음 (실측 확인 완료)
  - 위치: `codebase/frontend/eslint.config.mjs` 전체 diff
  - 상세: 변경 적용 전/후 각각 `npx eslint .` 를 실행해 비교한 결과 두 경우 모두 `0 errors, 12 warnings` 로 동일했다. `git stash`/`git stash pop` 으로 워킹트리를 원복하며 A/B 비교했고, 12개 warning 은 전부 신규 규칙과 무관한 기존 `no-unused-vars`/`jsx-a11y` 항목이다. `src/lib/**` 하위에서 `@/components`, `../components`, `../../components` 등 어떤 형태로도 컴포넌트를 import 하는 기존 코드가 없음을 `grep`/`find` 로도 별도 확인했다.
  - 제안: 없음. 이 항목은 문제가 아니라 "부작용 없음"을 확정하기 위한 실측 근거로 기록.

- **[INFO]** 규칙 스코프는 의도한 만큼만 적용됨 (오탐/과소탐 없음, 실측 확인)
  - 위치: `files: ["src/lib/**"]`, `patterns.group` 4개 항목
  - 상세: 임시 probe 파일로 실제 매칭 여부를 테스트했다.
    - 정상 탐지(의도대로 error): `@/components/foo`, `@/components`, `../components/foo`, `../../components/foo`, `../../../components/foo`, `../../../../components/foo`(4단계 우회까지 커버)
    - 오탐 없음(의도대로 통과): `./components-helper`, `../components-like/foo`(문자열에 "components" 를 포함하지만 다른 이름인 케이스), `@/components-extra/foo`, `@/component/foo`(단수형 오타 케이스) — 전부 flag 되지 않아 근접 이름에 대한 false positive 없음을 확인
    - 스코프 경계: `src/lib/` 바로 아래(0-depth) 파일은 정상적으로 규칙이 적용되고, `src/app/**` 등 `src/lib/` 밖의 파일은 규칙이 전혀 적용되지 않음을 확인 — glob 이 의도보다 넓게 새거나 좁게 누락되는 현상 없음
  - 제안: 없음. 다만 향후 이 프로젝트에서 `no-restricted-imports` 의 매칭 엔진(ESLint 내부적으로 `ignore`/minimatch 계열 라이브러리 사용)이 ESLint 메이저 업그레이드로 교체될 경우 `**/../components` 같은 ".." 리터럴 세그먼트 매칭 방식이 재검증 없이는 회귀 위험이 있다는 점은 참고용으로 남겨둔다.

- **[INFO]** 다른 패키지로의 규칙 누출 없음
  - 위치: 모노레포 구조 (`codebase/frontend`, `codebase/backend`, `codebase/channel-web-chat` 각각 독립 `eslint.config.mjs`)
  - 상세: `codebase/frontend/eslint.config.mjs` 는 frontend 패키지 전용이며, backend/channel-web-chat 은 별도의 독립 eslint 설정을 보유한다. 따라서 이번 변경이 다른 패키지의 린트 결과에 영향을 줄 가능성은 없다.
  - 제안: 없음.

- **[INFO]** autofix 부작용 없음
  - 위치: `no-restricted-imports` 규칙
  - 상세: `no-restricted-imports` 는 ESLint 내장 fixer 가 없는 규칙이다(`eslint --fix` 실행 시 해당 규칙으로 인한 import 문 자동 삭제/재작성 없음). 실측에서도 `--fix` 로 수정 가능하다고 표시된 항목은 이번 변경과 무관한 기존 1건뿐이었다.
  - 제안: 없음.

- **[INFO]** diff 범위 밖 배경 맥락(코멘트 참조 파일)은 이번 리뷰 대상 아님
  - 위치: 신규 블록 주석 — "배경 주석: src/lib/conversation/rag-types.ts · src/components/editor/run-results/conversation-utils.ts"
  - 상세: 주석이 과거 레이어 역전 사례로 언급한 두 파일은 이번 diff 에 포함되어 있지 않다. 다만 위 실측(전체 `npx eslint .` 클린 통과, `src/lib` 내 components import 전무)으로 미루어 해당 리팩터링은 이미 별도 커밋/이전 작업에서 완료되었거나 애초에 이 규칙이 방지하려는 "미래 재발" 목적으로만 추가된 것으로 보인다. 이 규칙 신설 자체가 그 두 파일을 변경하지는 않는다.
  - 제안: 없음. host 워크플로 상 문제 없음 — 참고 정보로만 기록.

## 요약

이 변경은 런타임 코드가 아닌 ESLint 설정 파일에 `src/lib/**` 스코프로 한정된 `no-restricted-imports` 규칙 블록 하나를 추가하는 것으로, 전역 상태·파일시스템·환경변수·네트워크·함수 시그니처·공개 API·이벤트/콜백 등 8개 표준 부작용 관점 대부분은 애초에 해당사항이 없다(정적 설정, 부수효과 없는 순수 린트 게이트). 유일하게 실질적인 "부작용" 후보는 (a) 기존 코드에 신규 CI/lint error 를 유발하는지, (b) 규칙 스코프가 의도보다 넓거나 좁아 무관한 import 를 오탐/누락하는지였는데, 두 가지 모두 실제로 `eslint` 를 변경 전/후로 실행하고 다양한 import 패턴의 probe 파일을 넣어 실측 검증한 결과 문제가 없음을 확인했다(신규 error 0건, 근접 이름 오탐 0건, 4단계 상대경로 우회까지 정상 탐지, 다른 패키지·`src/lib` 밖 파일로의 스코프 누출 없음). autofix 로 인한 의도치 않은 코드 변형 위험도 없다(해당 규칙은 fixer 미보유).

## 위험도

LOW
STATUS: success
