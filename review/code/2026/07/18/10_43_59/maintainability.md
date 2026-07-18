# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `repoRoot()` 디렉토리 탐색 상한 `12` 가 이름 없는 매직 넘버
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — `repoRoot()` 내 `for (let i = 0; i < 12; i++)`
  - 상세: 워크스페이스 루트(`pnpm-workspace.yaml`)를 찾기 위한 상위 디렉토리 탐색 횟수 `12` 가 근거 설명 없이 리터럴로 박혀 있다. 현재 실제 깊이(`__tests__/repo-guards/lib/src/frontend/codebase/root` ≈ 6단계) 대비 왜 12인지 코드만 봐서는 알 수 없다. 파일이 더 깊은 곳으로 이동하면 예외는 던지므로(fail-loud) 안전하지만, 상수의 의도가 불명확하다.
  - 제안: `const MAX_WALKUP_DEPTH = 12; // 현재 실제 깊이(~6) 대비 여유` 처럼 이름 붙이거나 주석으로 근거를 남긴다.

- **[INFO]** `explicitFilterCalls` 의 `!c.name.startsWith("$")` 필터가 도달 불가능한 방어 코드
  - 위치: 같은 파일 `explicitFilterCalls()` — 정규식 `/pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?/g` 와 이어지는 `.filter((c) => !c.name.startsWith("$"))`
  - 상세: 캡처 그룹의 문자 클래스 `[^\s"$]+` 가 이미 `$` 를 배제하므로, 매칭된 `name` 이 `$` 로 시작할 가능성은 정규식 단계에서 원천 차단된다. 뒤따르는 `.filter` 는 이론상 절대 걸러낼 대상이 없는 중복 방어 코드다. 주석("`\"$pkg\"` 같은 변수형은 무시")이 이 필터가 실제로 그 일을 하는 것처럼 읽혀, 나중에 정규식을 완화할 때 "필터가 있으니 안전하다"는 잘못된 확신을 줄 수 있다.
  - 제안: 정규식 주석에 "`$` 는 캡처 문자 클래스에서 이미 배제됨 — 아래 filter 는 방어적 중복" 이라 명시하거나, 배제 로직을 정규식 또는 filter 한쪽으로 일원화한다.

- **[INFO]** 파서 로직(bash 함수/배열 파서 + YAML 미니 파서 5종)이 테스트 파일 안에 직접 정의되어 재사용·독립 단위 테스트가 어려움
  - 위치: 같은 파일 전체(`discoverPackages`/`backendWorkflowDeps`/`internalPackages`/`fnBody`/`explicitFilterCalls`/`indentOf`/`isSkippable`/`blockRange`/`findKeyLine`/`listAtPath`/`packageDirsInPaths`, 약 200줄)
  - 상세: 이 파일은 bash 배열/함수 파서와 손으로 짠 YAML 블록 파서를 한 테스트 파일(310줄) 안에 담고 있다. 기존 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 도 동일하게 "파서 로직 + 단언을 한 테스트 파일에 두는" 스타일이라 이 저장소의 기존 컨벤션과는 일치한다(감점 대상 아님). 다만 향후 유사 가드가 늘어나면 각 테스트 파일마다 별도의 hand-rolled YAML/bash 스캐너가 재발명될 위험이 있고, 파서 함수 자체의 edge case(중첩 braces 외의 것들 — 예: flow-style YAML 리스트 `[a, b]`, 멀티라인 문자열)는 개별 단위 테스트가 없어 이 guard 의 통과/실패 케이스로만 간접 검증된다.
  - 제안: 규모가 더 커지면 `repo-guards/parsers/{bash,yaml}.ts` 로 추출해 재사용 가능하게 하고, 파서 자체의 edge case 를 독립 단위 테스트로 분리하는 것을 고려. 현재 규모(가드 1개)에서는 강제할 필요는 없음.

- **[INFO]** 밀도 높은 정규식 다수 사용
  - 위치: 같은 파일 — `internalPackages`, `fnBody`(`open`/`close`), `explicitFilterCalls`, `packageDirsInPaths` 의 정규식들
  - 상세: `^INTERNAL_PACKAGES=\(([\s\S]*?)^\)`, `^${fn}\\(\\)\\s*\\{\\s*$` 등 여러 곳에서 멀티라인·비탐욕 정규식이 쓰여 초심자가 한눈에 파악하기 어렵다. 다만 각 정규식 위에 그 한계와 실패 모드를 설명하는 주석이 충실히 달려 있고(`fnBody` 는 가정이 깨지면 명시적으로 throw), 이는 이 코드베이스가 이미 채택한 "가드 자신도 조용히 무력화되지 않아야 한다" 는 반복 패턴(예: `eslint-layering-guard.test.ts`)과 일관된다. 감점 요소라기보다 도메인(자기 자신을 보증해야 하는 가드) 특성상 불가피한 복잡도로 판단.
  - 제안: 없음(현행 유지 권장). 새 정규식을 추가할 때도 같은 "한계 명시 + fail-loud" 패턴을 유지할 것.

- **[INFO]** `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml` 변경은 주석 추가만
  - 위치: 두 파일의 diff 전체
  - 상세: 실행 로직 변경 없이 근거/상호 참조 주석만 추가되었다. 가독성·일관성 문제 없음.

## 요약

핵심 로직 변경은 신규 테스트 파일(`internal-package-registration.test.ts`) 하나이며, 나머지 두 파일은 주석 추가에 그친다. 신규 파일은 300줄을 넘는 분량과 정규식 기반의 손으로 짠 bash/YAML 파서를 포함해 표면적 복잡도가 높지만, 각 함수가 짧고(대부분 5~20줄) 책임이 분리되어 있으며, 모든 정규식·휴리스틱에 한계와 실패 모드를 설명하는 주석이 충실히 동반되어 있다. 특히 `fnBody` 는 자신의 휴리스틱이 깨지는 조건을 스스로 감지해 throw 하도록 설계되어, "가드가 조용히 무력화된다"는 이 파일이 막으려는 결함 자체를 파서 스스로도 반복하지 않도록 신경 썼다. 이런 스타일은 이미 저장소 내 `eslint-layering-guard.test.ts` 에서 확립된 컨벤션과 일치한다. 발견된 이슈는 매직 넘버 하나, 도달 불가능한 방어 필터 하나, 향후 확장 시 파서 재사용성에 대한 제언 정도로 모두 경미(INFO)하며, 즉시 수정을 요구할 수준은 아니다.

## 위험도
LOW
