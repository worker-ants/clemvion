# 요구사항(Requirement) Review

## 검토 대상

- `codebase/frontend/package.json` — devDependencies 4건 추가 (`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)
- `plan/in-progress/harness-review-gate-ci-backstop.md` — CI 활성화 후 드러난 기존 결함 7건을 표로 등재하는 부록 추가
- `pnpm-lock.yaml` — 위 매니페스트 변경 + peer-suffix 재정규화 264줄 churn

목적: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 import 하는 4개 패키지가
어느 매니페스트에도 선언돼 있지 않았고, 로컬에서는 워크트리 중첩(`node-linker=isolated` 가
상위 `node_modules` 로 새는 버그)이 이를 가려 CI(평평한 체크아웃)에서만 실패하던 것을 고치는
순수 의존성 선언 PR.

## 검증 절차

1. `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 를 grep — `fromMarkdown`(mdast-util-from-markdown),
   `mdToString`(mdast-util-to-string), `GithubSlugger`(github-slugger), `type { Root, RootContent, Heading } from "mdast"`
   4개 import 전부 실사용 확인.
2. 추가된 버전(`^2.0.3`/`^4.0.0`/`^2.0.0`/`^4.0.4`)이 커밋 메시지가 주장하는 "기존에 부모
   `node_modules` 에서 해소되던 버전과 동일" 과 lockfile 상 정확히 일치 — `pnpm-lock.yaml` 에
   각 패키지가 **단일 버전**으로만 존재(중복/충돌 없음), 즉 다른 transitive 소비자(rehype-slug 등)와
   버전 공유.
3. `.github/workflows/spec-link-checks.yml` 확인 — `pnpm install --frozen-lockfile --filter
   "frontend..."` 후 `spec-link-integrity.test.ts` 실행. `--frozen-lockfile` 은 매니페스트와
   lockfile 이 정확히 일치해야 통과하므로, 이번 fix(package.json + lockfile 동시 갱신)가 실제
   CI 실패 메커니즘을 정확히 겨냥함을 확인.
4. `PROJECT.md` §버전 핀 정책 대조 — 4건 전부 caret 기본(0.x 아님) → 사유 주석(`//pin`) 불필요,
   준수.
5. `pnpm-workspace.yaml` 의 `overrides`/`onlyBuiltDependencies` 대조 — 4개 패키지 모두 순수 JS,
   네이티브 빌드·취약점 override 대상 아님. 거버넌스 2-place 갱신 의무 미해당.
6. package.json devDependencies 알파벳 순서 확인 — `@types/dompurify < @types/mdast < @types/mdx`,
   `eslint-config-next < github-slugger < jest-axe < jsdom < mdast-util-from-markdown <
   mdast-util-to-string < typescript` 모두 정렬 유지.
7. `git diff origin/main -- codebase/frontend/package.json plan/in-progress/...` 에서
   TODO/FIXME/HACK/XXX grep — 0건.
8. `pnpm-lock.yaml` diff 중 lockfileVersion 변경 없음 확인 — churn 은 4개 신규 엔트리 + 기존
   `ts-jest`/`jest`/`eslint-import-resolver-typescript` peer-suffix 재정규화(버전 자체는 불변,
   커밋 메시지의 "264줄 churn, 버전 변화 없음" 주장과 일치)로 국한.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec fidelity 해당 없음)
  - 위치: `codebase/frontend/package.json` 전체
  - 상세: 이 변경은 제품 동작이 아니라 빌드/테스트 툴체인 의존성 선언이다. `spec/conventions/spec-impl-evidence.md` §4.2 를 포함해 어떤 spec 문서도 테스트 헬퍼(`spec-links.ts`)의 npm 의존성을 규정하지 않는다. 요구사항 충족 관점의 판단 근거는 PROJECT.md §버전 핀 정책과 실제 import 사용처뿐이며, 둘 다 일치를 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** 같은 결함 클래스의 전수 조사가 이 PR 범위 밖으로 명시적으로 이연됨
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:487`-`489` (부록 "→ **미선언 의존은 로컬 실행으로 검출되지 않는다.** 같은 클래스가 다른 파일에도 있는지는 미확인이다(전수 조사 미수행)." 문단)
  - 상세: 이번 fix 는 `spec-links.ts` 4개 import 만 좁혀 고쳤고, 워크트리 중첩이 다른 파일의 미선언 의존을 똑같이 가리고 있을 가능성은 plan 문서 스스로 "미확인" 이라 적어 남겨뒀다. 근본 처방(`deps-security-checks` 나 lint 단계에서 import-vs-manifest 대조)도 후속으로만 언급된다.
  - 제안: 이 PR 의 스코프(관측된 CI 실패 1건 해소)로는 충분하다. 다만 이연된 항목이 plan 문서 본문에 이미 명시돼 있으므로 별도 조치 불필요 — 향후 세션에서 "다른 파일도 있는지" 재점검 시 참조할 앵커로 위치만 기록해 둔다.

- **[INFO]** lockfile 재정규화 264줄 중 버전 실변경분 검증
  - 위치: `pnpm-lock.yaml` (diff 전체)
  - 상세: 커밋 메시지가 "추가된 버전 문자열은 정확히 4개, 제거 0" 이라 주장한다. 실제 diff 를 훑으면 `ts-jest@29.4.11(...)`/`jest-cli@30.4.2(...)`/`eslint-import-resolver-typescript@3.10.1(...)` 등 나머지는 전부 동일 버전의 peer-dependency 괄호 표기 재구성(예: `(esbuild@0.25.12)` 접미사 추가, 중첩 괄호 평탄화)이고 실질 버전 변경은 없다. 주장과 실측이 일치.
  - 제안: 조치 불필요.

## 요약

`codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 실사용하는 4개 패키지
(`mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger`, `@types/mdast`)를
`codebase/frontend/package.json` devDependencies 에 정확한 버전으로 선언하고 `pnpm-lock.yaml`
을 그에 맞춰 갱신한 순수 의존성 선언 fix다. 배치 위치(devDependencies — 테스트 전용
파일에서만 소비), 버전 핀 정책 준수(caret, 0.x 아님), 알파벳 순서, `--frozen-lockfile` CI
워크플로와의 정합, lockfile churn 의 무해성(버전 재구성뿐 실변경 0)을 모두 실측으로 확인했다.
CRITICAL/WARNING 급 발견사항 없음. plan 문서 갱신도 실제 커밋·PR 상태와 line-level 로 일치한다
("본 PR" 행이 정확히 이 변경을 가리킴). 같은 결함 클래스의 전수 조사 미수행은 plan 문서가
스스로 명시적으로 이연한 사항이라 이 PR 의 결함이 아니다.

## 위험도

LOW
