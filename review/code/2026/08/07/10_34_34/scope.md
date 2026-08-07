# 변경 범위(Scope) 리뷰

## 컨텍스트

리뷰 대상 3개 파일(`codebase/frontend/package.json`, `pnpm-lock.yaml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`)은 커밋 `caaa3735c`
(`fix(frontend): spec-link 가드가 미선언 의존으로 CI 에서만 깨져 있었다`) 단일 커밋으로
확인했다. 커밋 메시지가 스스로 밝힌 의도는 명확하다: `spec-links.ts` 가 이미 import 하고
있었지만 어느 매니페스트에도 선언되지 않았던 4개 패키지(`mdast-util-from-markdown`,
`mdast-util-to-string`, `github-slugger`, `@types/mdast`)를 `frontend` 의
`devDependencies` 로 명시 선언하는 것.

## 발견사항

- **[INFO]** `package.json` 변경은 의도와 정확히 일치
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: 추가된 4개 항목(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`,
    `mdast-util-to-string`)이 전부 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
    에서 실제 import 되고 있음을 `Grep` 으로 직접 확인했다(`import { fromMarkdown } from
    "mdast-util-from-markdown"`, `import { toString as mdToString } from
    "mdast-util-to-string"`, `import GithubSlugger from "github-slugger"`, `import type
    {...} from "mdast"`). 버전도 기존에 로컬에서 조용히 해소되던 값(2.0.3/4.0.0/2.0.0/4.0.4)과
    동일하게 고정했다고 커밋이 밝혔고 lockfile 의 `version:` 필드도 그대로 일치한다.
    범위 이탈 없음.
  - 제안: 없음.

- **[WARNING]** `pnpm-lock.yaml` 의 "churn 해명"이 실제 diff 를 다 설명하지 못한다
  - 위치: `pnpm-lock.yaml:918` (`@aws-sdk/core@3.977.4` 블록에 `deprecated: |-` 3줄 신규
    추가) 및 `@@ -1191,28 +1206,24 @@ packages:` 이하 다수 블록(예: 게이트 1206~1214 부근의
    `@css-inline/css-inline-linux-arm64-*@0.20.0`, 이어서 `@img/sharp-*`, `@next/swc-*`,
    `@tailwindcss/oxide-*`, `@unrs/resolver-binding-*`, `lightningcss-*`,
    `@napi-rs/canvas-*`, `@rolldown/binding-*` 등 네이티브 바이너리 optional 패키지들)에서
    `libc: [glibc]` / `libc: [musl]` 줄이 삭제됨 — 삭제된 줄이라 새 파일 기준 게이트는 없음.
  - 상세: 커밋 메시지의 "[lockfile churn 해명]" 은 "264줄 변경 중 새 버전 문자열 4개, 나머지는
    ts-jest@29.4.11·jest@30.4.2 의 peer 접미사 재정규화" 라고 정확한 수치까지 제시하며
    전체를 설명한다고 주장한다. 그러나 `git diff origin/main...HEAD -- pnpm-lock.yaml` 을
    직접 세어보면 그 설명에 없는 두 종류의 추가 churn 이 있다: (1) `@aws-sdk/core` 블록에
    `deprecated:` 메타데이터 3줄 신규 추가, (2) 이번에 추가한 4개 패키지·jest/ts-jest 와
    무관한 네이티브 바이너리 optional 패키지 19곳에서 `libc:` 필드 57줄 삭제. 이 60줄은
    전체 264줄(변경 라인 수, 커밋이 스스로 밝힌 수치와 정확히 일치)의 약 23% 로, mdast/
    github-slugger 추가나 jest 재정규화 어느 쪽으로도 설명되지 않는다. `lockfileVersion`
    은 양쪽 다 `'9.0'` 으로 동일해 lockfile 포맷 버전 변경이 원인도 아니다 — pnpm 이
    `pnpm add` 재해소 중 레지스트리에서 약간 다른 메타데이터를 다시 받아온 부산물로 보인다.
    기능적으로는 무해(해소된 버전 자체는 변경 없음, `pnpm install --frozen-lockfile` 통과
    확인됨)하지만, 커밋이 "churn 을 전부 계정했다" 고 구체적 수치로 단언한 것 자체가
    부정확하다 — scope 관점에서는 "선언된 churn 범위" 와 "실제 diff" 사이에 무관한 항목이
    섞여 있는데 그 사실이 공개되지 않은 사례다.
  - 제안: 커밋 메시지의 "[lockfile churn 해명]" 문단에 `deprecated:` 메타데이터 추가 1건과
    `libc:` 필드 삭제 57건(어느 것과도 무관, pnpm 재해소 메타데이터 갱신)을 추가로 밝히거나,
    최소한 "나머지는 ts-jest/jest 재정규화 **및 무관한 optional-dependency 메타데이터
    갱신**" 정도로 정정. 코드/락파일 자체를 되돌릴 필요는 없다(수동 개입이 오히려 위험).

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 에 추가된 부록은
  순수 append-only 이며 이번 커밋의 실제 처분(표의 "#6") 과 관련 티켓 맥락 안에 있다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:458-497` (부록 섹션 전체)
  - 상세: `git diff` 로 확인한 결과 이 파일에는 삭제 줄이 하나도 없다(전부 `+`) — 기존
    서술을 건드리지 않고 끝에만 추가했다. 부록 표의 7개 항목 중 이번 커밋이 실제로
    처분하는 것은 "#6 spec-link-integrity 미선언 의존" 하나뿐이고, 나머지(#1~#5, #7)는
    각각 "#1091 종결"/"PR 진행 중"/"미처분" 으로 상태가 명시돼 있으며 부록 도입부에서도
    "전부 origin/main 에 이미 있던 것이고 이 티켓의 코드가 만든 것이 아니다" 라고 스스로
    선을 긋는다. 이 저장소의 `plan/in-progress/` 문서는 라운드마다 발견된 관련 결함을
    표로 누적 기록하는 것이 기존 관행(같은 파일 안에 이미 1R~12R 표, "신규 후속" 목록 등
    동일 패턴이 반복됨)이라 이번 추가도 그 패턴과 일관되고, 코드 변경이 아니라 문서이므로
    "범위 이탈" 로 보지 않는다.
  - 제안: 없음(참고용 기재).

## 요약

리뷰 대상 3개 파일은 하나의 명확한 의도(미선언 markdown 파싱 의존 4종을 `frontend`
매니페스트에 명시)로 수렴하며, `package.json` 변경은 실제 import 와 1:1 대응하고 버전도
기존 해소값과 동일하게 고정돼 동작 변화가 없다. plan 문서 추가는 append-only 로 기존
서술을 건드리지 않고, 이번 커밋이 처분하는 항목과 처분하지 않는 항목을 스스로 구분해 표기해
투명하다. 유일한 흠은 `pnpm-lock.yaml` 의 "churn 해명" 문단이 실측(264줄) 을 정확히
인용하면서도 그중 약 23%(`libc:` 필드 삭제 57줄 + `@aws-sdk/core` deprecated 메타데이터
3줄)를 설명에서 빠뜨린 것 — 기능적으로 무해한 lockfile 재해소 부산물이지만, 커밋 자신이
정밀한 수치로 "전부 설명했다" 고 주장한 것과는 어긋난다. 의도적 기능 확장·불필요한
리팩토링·무관한 파일 수정·포맷팅 끼워넣기·임포트 정리·설정 변경 같은 전형적 scope creep
징후는 없다.

## 위험도

LOW
