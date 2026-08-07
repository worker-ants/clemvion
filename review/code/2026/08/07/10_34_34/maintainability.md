# 유지보수성(Maintainability) Review

## 리뷰 대상
- `codebase/frontend/package.json` (devDependencies 4건 추가)
- `plan/in-progress/harness-review-gate-ci-backstop.md` (부록 섹션 추가, 문서만)
- `pnpm-lock.yaml` (락파일 재생성)

이번 변경은 `spec-links.ts`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`, 이번 diff에는 미포함·불변)가
런타임에 import 하던 `mdast-util-from-markdown` / `mdast-util-to-string` / `github-slugger` / `@types/mdast` 를
매니페스트에 정식 선언하는 의존성 선언 수정이다. 손으로 작성된 로직 변경은 없다.

### 발견사항

- **[INFO]** `pnpm-lock.yaml` diff에 신규 4개 패키지 추가와 무관해 보이는 광범위한 재해석 변경이 섞여 있음
  - 위치: `pnpm-lock.yaml` (예: 17332행 `jest-config@30.4.2(@types/node@20.19.43)…` 신설 블록, 17293행 `jest-cli@30.4.2(...)` 시그니처 변경, 15998행 `eslint-import-resolver-typescript` peer 체인 단순화, 1209/1215/1671 등 다수 `libc: [glibc]`/`libc: [musl]` 필드 제거, 918행 `@aws-sdk/core` `deprecated:` 배너 신설)
  - 상세: 의도한 변경은 4개 패키지(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`) 추가뿐인데, lockfile 재생성 과정에서 `jest-cli`/`jest-config`의 peer-dependency 조합 키가 재구성되고(`(@types/node@20.19.43)` 변형 신설/치환), 다수 네이티브 바이너리 패키지의 `libc:` 필드가 사라지고, `@aws-sdk/core`에 deprecated 안내가 새로 붙는 등 목적과 무관한 항목이 대량 포함됐다. 자동 생성 파일이라 손으로 다듬을 대상은 아니지만, 이 규모의 부수 변경은 향후 `git blame`/`git bisect`로 "무엇이 왜 바뀌었나"를 추적할 때 잡음이 된다.
  - 제안: 수정 불필요(락파일은 도구 산출물). 다만 재발 시 커밋 메시지나 PR 설명에 "신규 4개 의존성 추가 + pnpm 재해석에 의한 부수 변경"임을 한 줄 남겨두면 추후 diff 판독 비용을 줄일 수 있다.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 가 단일 파일에 다수의 독립적 사후조사 부록을 계속 누적
  - 위치: 파일 하단 신규 섹션 `## 부록 — CI 를 켠 뒤 드러난 기존 결함 (2026-08-06, 이 티켓 밖)`
  - 상세: 이 부록은 제목에서부터 "이 티켓 밖"이라고 명시하듯 원 티켓(CI 백스톱 설계 결정)과 직접 관련 없는 사후 발견 기록이다. 기존 문서도 이미 12라운드 가드 경화 이력·16개 defer 후속 항목 등으로 매우 길어져 있고(총 480줄+), 여기에 성격이 다른 부록이 계속 얹히는 구조다. 코드가 아니므로 함수 길이/중첩 같은 축은 적용되지 않지만, 문서 단위의 "책임 분리" 관점에서는 탐색성이 낮아지는 방향이다.
  - 제안: 프로젝트 관례상(`plan/complete/` 이관, `plan/research/`) 완료 시점에 분리 이관될 문서이므로 현재로선 규약 위반은 아니다. 다만 "이 티켓 밖" 발견이 반복적으로 이 파일에 쌓인다면 `plan/research/` 로 별도 분리하는 것을 고려할 만하다(강제 아님, 관찰 사항).

- **[INFO]** `codebase/frontend/package.json` 변경 자체는 기존 컨벤션과 완전히 일치 — 특기할 결함 없음
  - 위치: `codebase/frontend/package.json:79,88,91-92`
  - 상세: 4개 신규 항목 모두 `devDependencies` 블록의 기존 알파벳 정렬을 정확히 유지하며(`@types/dompurify` → `@types/mdast` → `@types/mdx`, `eslint-config-next` → `github-slugger` → `jest-axe`, `jsdom` → `mdast-util-from-markdown` → `mdast-util-to-string` → `typescript`), 5번째 줄의 `"//pin"` 주석이 명시한 caret 버전 정책(예외는 `three`, `react`/`react-dom`뿐)도 그대로 따른다. 실제 사용처(`spec-links.ts`)가 `__tests__/` 하위 테스트 전용 헬퍼이므로 `devDependencies` 배치도 적절하다.
  - 제안: 없음(참고용 긍정 관찰).

### 요약
세 파일 모두 손으로 작성된 로직 변경이 아니라 "누락된 의존성 선언을 정식화"하는 목적의 기계적 수정이다. `package.json`은 기존 정렬·버전 정책을 정확히 따랐고 가독성·네이밍·복잡도 관점에서 지적할 사항이 없다. `pnpm-lock.yaml`은 도구가 생성한 파일로 목적과 무관한 부수 churn이 섞여 있으나 자동 산출물이라 수정 대상이 아니며, 진단 가능성 측면의 경미한 참고사항만 남긴다. plan 문서는 이 티켓 범위 밖 사후조사를 계속 이어 붙이는 구조라 장기적으로 탐색성이 떨어질 여지가 있지만 프로젝트의 기존 plan-lifecycle 관례를 위반하지는 않는다. 전반적으로 유지보수성 리스크는 매우 낮다.

### 위험도
NONE
