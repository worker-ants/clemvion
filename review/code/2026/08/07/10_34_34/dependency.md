# Dependency Review — harness-review-ci-backstop

## 발견사항

- **[INFO]** 새 devDependency 4건 추가 — 필요성 확인됨, 실질적으로는 기존 결함(미선언 의존)의 정식화
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: `@types/mdast` `^4.0.4`, `github-slugger` `^2.0.0`, `mdast-util-from-markdown` `^2.0.3`,
    `mdast-util-to-string` `^4.0.0` 이 devDependencies 에 추가됐다. 실제 사용처는
    `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`(spec 문서 링크 검증 스크립트) 로,
    `import { fromMarkdown } from "mdast-util-from-markdown"`, `import { toString as mdToString } from
    "mdast-util-to-string"`, `import GithubSlugger from "github-slugger"`, `import type { Root, ... } from
    "mdast"` 를 직접 참조한다. plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md` 부록 #6)에
    기록된 대로, 이 4개는 원래 **어느 매니페스트에도 선언되지 않았는데** 워크트리가
    `<repo>/.claude/worktrees/` 아래 중첩된 구조 때문에 `.npmrc` 의 `node-linker=isolated` 가
    로컬에서만 무력화되어(node 가 상위 디렉터리의 부모 체크아웃 `node_modules` 를 찾아 해소) 조용히
    통과해 왔다. 즉 이번 diff 는 "새 기능을 위한 새 의존성 도입" 이 아니라 **암묵적으로 이미 쓰이던
    의존을 명시화하는 수정**이다 — 방향은 옳다.
  - 제안: 없음(적절한 수정). 다만 plan 문서가 이미 지적했듯 같은 클래스(미선언 의존이 상위 node_modules
    해소로 로컬에서만 통과)가 다른 파일에도 있는지는 전수 조사되지 않았다 — 별도 lint/CI 단계로
    import-vs-manifest 대조를 두는 근본 처방은 이 PR 범위 밖으로 남아 있다(그대로 defer 타당).

- **[INFO]** 버전 고정 — 프로젝트 정책(caret 기본) 준수
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: 4건 모두 `^` caret range. `package.json` 상단 `"//pin"` 주석이 명시한 예외(0.x semver `three` →
    tilde, 모노레포 정렬 `react`/`react-dom` → 정확 버전)에 해당하지 않는 일반 1.x 이상 패키지들이므로
    caret 이 정책과 일치한다.

- **[INFO]** 라이선스 — 전부 permissive, 프로젝트와 호환
  - 위치: `codebase/frontend/package.json:79,88,91,92`
  - 상세: 로컬 `node_modules/*/package.json` 실측 — `mdast-util-from-markdown` MIT, `mdast-util-to-string`
    MIT, `github-slugger` ISC, `@types/mdast` MIT. 모두 permissive 라이선스로 카피레프트 충돌 없음.

- **[INFO]** 취약점 — 알려진 CVE 없음, 신규 attack surface 최소
  - 상세: 4개 패키지 모두 unified/remark/mdast 생태계의 소규모·활발히 유지되는 유틸리티이며 별도 조사에서
    알려진 보안 권고를 발견하지 못했다. devDependency 로만 존재하고 사용처가 `__tests__/spec-links.ts`
    (빌드 산출물에 번들링되지 않는 테스트 스크립트) 뿐이라 런타임/브라우저 attack surface 에 영향이 없다.

- **[INFO]** 불필요한 의존성 아님 — 오히려 기존에 이미 transitive 로 resolve 되던 패키지의 명시화
  - 위치: `pnpm-lock.yaml` (importers 섹션 diff, `github-slugger`/`mdast-util-from-markdown`/
    `mdast-util-to-string`/`@types/mdast` 각 specifier+version 라인)
  - 상세: lockfile 상 이 4개 패키지의 `packages:`/`snapshots:` 엔트리는 **이번 diff 로 신규 추가된 것이
    아니다**(`grep` 확인 결과 `github-slugger@2.0.0:`, `mdast-util-from-markdown@2.0.3:`,
    `mdast-util-to-string@4.0.0:`, `'@types/mdast@4.0.4':` 가 이미 존재). `react-markdown`/`remark-gfm`/
    `rehype-slug`/`rehype-autolink-headings` 등 기존 dependencies 의 전이 의존으로 이미 install 되어
    있었고, 이번 변경은 `importers:` 아래 frontend workspace 항목에 **specifier 만 추가**한 것 —
    설치 크기 증가나 새 코드 실행 경로 추가가 없다.

- **[INFO]** 의존성 크기 — 번들·빌드 시간 영향 없음
  - 상세: devDependency + 테스트 전용 스크립트라 프로덕션 번들(webpack/next build)에 포함되지 않는다.
    위 항목대로 install 시점에 이미 존재하던 패키지라 `pnpm install` 시간에도 실질적 증가가 없다.

- **[INFO]** 호환성 — 버전 충돌 없음, 다만 lockfile diff 대부분이 무관한 노이즈
  - 위치: `pnpm-lock.yaml` (다수 `@@` hunk, 예: `jest@30.4.2`/`ts-jest@29.4.11`/`@jest/core@30.4.2` 관련
    peer 조합 재작성, `libc: [glibc]`/`libc: [musl]` 필드 제거 다수)
  - 상세: `jest`/`ts-jest`/`@jest/core` 등의 버전 자체(`30.4.2`, `29.4.11`)는 변경되지 않았고, pnpm 이
    workspace 전체를 재계산하면서 peer-dependency 조합 키(`ts-node@...` 포함 여부)만 재작성된 것으로
    보인다 — 실제 설치되는 버전의 변화는 없다. `@aws-sdk/core@3.977.4` 항목에 `deprecated: |- Deprecated
    due to Document number parsing bug in JSON …` 주석이 새로 붙었는데, 버전 자체는 그대로(3.977.4)이고
    이 PR 의 신규 의존과 무관한 backend(`@aws-sdk/client-s3`)의 전이 의존이 lockfile 재생성 과정에서
    registry 메타데이터를 새로 반영한 것뿐이다. **다만 이 사실 자체는 이번에 처음 lockfile 에 드러난
    것**이므로, 이 PR 을 계기로 별도 트랙(의존성 거버넌스)에서 `@aws-sdk/client-s3` 업그레이드 필요성을
    확인해 두는 것을 권장한다(이 PR 을 막을 사유는 아님).
  - 제안: 없음(블로킹 아님). 참고로 `pnpm-workspace.yaml` 의 `overrides:` 블록(`fast-uri`/`undici` 하한
    포함)은 이번 diff 의 컨텍스트에만 등장하고 실제로 변경되지 않았음을 확인했다 — plan 문서가 별도
    미처분 항목(#7)으로 남긴 것과 일치한다.

- **[INFO]** 내부 의존성 — 해당 없음(외부 패키지 선언 정합화)
  - 상세: 이번 3개 파일 변경은 프로젝트 내부 모듈 간 의존 관계를 바꾸지 않는다. plan 문서(#2)는
    코드 변경이 아니라 이 결함의 조사 기록이다.

## 요약

이번 diff 는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 이미 import 하고 있었지만 어느
매니페스트에도 선언되지 않았던 4개 패키지(`mdast-util-from-markdown`, `mdast-util-to-string`,
`github-slugger`, `@types/mdast`)를 devDependencies 에 정식으로 추가하는 수정이다. 4개 모두 unified/remark
생태계의 MIT/ISC 라이선스 유틸리티로, 프로젝트에 기존 dependencies(`react-markdown`/`remark-gfm`/
`rehype-slug` 등)의 전이 의존으로 이미 설치돼 있어 install 크기·빌드 시간 증가가 없고 caret 버전 고정도
프로젝트 정책과 일치한다. `pnpm-lock.yaml` 의 diff 는 대부분 관련 없는 peer-dependency 조합 재작성 노이즈
(jest/ts-jest 계열)이며 실제 해소 버전 변화는 없다. `@aws-sdk/core` 에 새로 붙은 `deprecated` 주석은 이
PR 과 무관한 backend 전이 의존이지만 이번에 처음 드러났으므로 별도 트랙에서의 후속 확인을 권장한다(비차단).
전체적으로 의존성 관점에서 차단 사유가 없는 낮은 위험의 변경이다.

## 위험도
LOW
