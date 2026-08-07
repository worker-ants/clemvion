# 아키텍처(Architecture) 리뷰

## 리뷰 대상

- `codebase/frontend/package.json` — devDependencies 4건 추가(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)
- `pnpm-lock.yaml` — 위 추가에 따른 lockfile 재해석 diff (대부분 자동 생성)
- `plan/in-progress/harness-review-gate-ci-backstop.md` — 부록 표 추가(문서 전용, 코드 변경 없음)

세 파일 모두 **애플리케이션 코드(로직) 변경이 아니라 의존성 선언 정정 + 그에 대한 계획 문서 기록**이다. 실제 소비 코드(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`, `spec-link-integrity.test.ts`)는 이번 diff 에 포함되어 있지 않으므로(이미 `import` 문이 존재), 이번 변경은 "이미 쓰이고 있던 미선언 의존을 매니페스트에 뒤늦게 등재"하는 성격이다.

## 발견사항

- **[INFO]** 미선언(phantom) 의존성을 정식 선언으로 전환 — 모듈 경계 정합성 개선
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: `spec-links.ts` 가 import 하는 `mdast-util-from-markdown` / `mdast-util-to-string` / `github-slugger` / `mdast`(타입)는 이번 변경 전에는 어느 매니페스트에도 선언되지 않았고, 워크트리 중첩 구조 때문에 상위 디렉터리의 `node_modules` 로 우연히 해소되고 있었다(`plan/in-progress/harness-review-gate-ci-backstop.md:474-489` 부록 #6 참조). `.npmrc` 의 `node-linker=isolated` 는 "선언한 의존만 해소"를 강제하려는 의도인데, 워크트리 중첩이 그 강제를 로컬에서만 조용히 무력화하고 있었다. 이번 변경은 실제 코드-매니페스트 의존 그래프를 일치시켜 그 경계 누수를 닫는다.
  - 제안: (변경 자체는 올바름) 다만 plan 문서가 이미 지적했듯 이 클래스(코드가 import 하는데 매니페스트에 없는 의존)가 다른 파일에도 있는지는 전수 조사되지 않았다. lint/CI 단계에 import-vs-manifest 대조 규칙을 두는 것이 근본 처방이라는 문서의 결론에 동의한다 — 이번 diff 범위 밖이므로 별도 트랙으로 유지해도 무방.

- **[INFO]** 의존성이 실제 사용 스코프(devDependencies)와 정확히 일치
  - 위치: `codebase/frontend/package.json:79,88,91,92` (devDependencies 블록)
  - 상세: 4개 패키지 모두 `dependencies` 가 아니라 `devDependencies` 에 추가됐다. 실제 소비처를 확인한 결과(`grep`) `codebase/frontend/src/lib/docs/__tests__/` 아래 두 파일(둘 다 테스트/테스트 헬퍼)에서만 import 되며 런타임(프로덕션 번들) 경로에는 등장하지 않는다. 런타임 의존과 개발/테스트 전용 의존의 경계를 정확히 지켰다 — 프로덕션 계층에 불필요한 의존을 흘리지 않았다.
  - 제안: 없음 (올바른 배치).

- **[INFO]** 의존성 배치 위치(모듈 경계) 적절
  - 위치: `codebase/frontend/package.json` (workspace 전체)
  - 상세: 소비 코드가 `codebase/frontend/` 워크스페이스 안에만 있으므로 루트 `package.json` 이나 다른 워크스페이스(`packages/*`)가 아닌 `frontend` 워크스페이스 매니페스트에 선언한 것이 pnpm workspace 경계와 일치한다. 불필요한 workspace 간 결합을 만들지 않았다.
  - 제안: 없음.

- **[INFO]** `pnpm-lock.yaml` diff 폭이 순수 "4개 devDependency 추가"보다 넓다
  - 위치: `pnpm-lock.yaml` (예: `jest-cli@30.4.2` 계열 재파라미터화, `eslint-import-resolver-typescript` peer 시그니처 변경, 다수 optional 패키지의 `libc:` 필드 제거)
  - 상세: 4개 패키지 추가와 무관해 보이는 다수 항목(예: `ts-jest`/`jest-config`/`jest-cli` 의 peer-dependency 파라미터화 방식 변경, `@css-inline`/`@img/sharp-libvips`/`@next/swc-linux-*`/`@rolldown/binding-*`/`@tailwindcss/oxide-*`/`@unrs/resolver-binding-*`/`lightningcss-linux-*` 등 다수 optional 플랫폼 패키지에서 `libc:` 필드가 사라짐)이 같은 diff 에 섞여 있다. 이는 아키텍처 결함은 아니지만, lockfile 재생성 시점의 pnpm 버전/레지스트리 상태가 원본과 달랐을 가능성을 시사한다(빌드 재현성 관점의 관측). 이번 PR 이 만든 문제인지 사전에 이미 존재하던 drift 인지는 이 diff 만으로는 판별 불가.
  - 제안: 아키텍처 리뷰 범위는 아니나, `pnpm install --frozen-lockfile` 이 CI 에서 그대로 재현되는지(=lockfile 이 실제로 커밋된 devDependency 변경만 반영하는지) 한 번 확인해 두면 향후 "누가 이 넓은 diff 를 만들었는지" 추적 비용을 줄인다. Correctness/의존성 정합성 계열 리뷰어의 관심사에 더 가까워 여기서는 정보성으로만 남긴다.

- **[INFO]** plan 문서 변경은 순수 기록(코드 영향 없음)
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:458-497` (부록 섹션)
  - 상세: CI 활성화 이후 발견된 기존 결함 7건을 표로 정리하고, 이번 PR 이 해소하는 #6(미선언 의존)의 근본 원인(워크트리 중첩 + `node-linker=isolated`)을 설명한다. 아키텍처적으로 문제될 부분은 없다 — 근거·배경을 spec/plan 관례대로 기록한 문서 변경.
  - 제안: 없음.

## 요약

이번 변경 세트는 애플리케이션 로직이 아니라 **의존성 선언의 정합성 회복**이 전부다. `spec-links.ts` 가 실제로 import 하던 4개 패키지가 워크트리 중첩 구조의 부작용(상위 `node_modules` 로 우연히 해소)으로 매니페스트에 선언되지 않은 채 로컬에서만 통과하던 phantom dependency 였고, 이번 diff 는 그것을 `frontend` 워크스페이스의 devDependencies 로 정확히 등재해 코드-매니페스트 경계를 정합화한다. 배치 워크스페이스·의존성 스코프(dev vs runtime) 모두 올바르며 SOLID/결합도/레이어링/순환 의존 등 통상적 아키텍처 관점에서 지적할 결함이 없다. `pnpm-lock.yaml` 의 diff 폭이 4개 패키지 추가치고는 넓은 편이라는 점만 재현성 관점의 참고 사항으로 남긴다.

## 위험도
NONE
