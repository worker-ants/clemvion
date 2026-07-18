# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `internal-package-registration-guard.ts` 내 일부 export 함수에 JSDoc 블록 누락 (형제 함수 대비 스타일 비일관)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` — `repoRoot()`(파일 상단, `export function repoRoot()`), `internalPackages()`(`// ─── test-stages.sh 파싱 ───` 섹션 헤더 직후)
  - 상세: 같은 파일의 `collectPackages`/`discoverPackages`/`workflowDepsOf`/`backendWorkldeps`/`fnBody`/`explicitFilterCalls`/`listAtPath`/`packageDirsInPaths`/`missingFromStage` 는 모두 `/** ... */` JSDoc 으로 목적·근거·엣지케이스를 설명한다. 그런데 `repoRoot()`(marker 탐색 방식·MAX_DEPTH 근거)와 `internalPackages()`(bash 배열 리터럴 파싱 규칙)는 본문 내부 인라인 `//` 주석만 있고 함수 위 JSDoc 이 없다. 기능적 문제는 아니지만, 같은 파일 안에서 "export 함수는 JSDoc 을 단다"는 관행이 두 곳만 예외라 다음 편집자가 패턴을 오인하거나 두 함수만 문서 수준이 얕다고 느낄 수 있다.
  - 제안: `repoRoot()` 위에 짧은 JSDoc(`marker 탐색 근거·MAX_DEPTH=12 의미`는 이미 인라인에 있으므로 그대로 끌어올리기만 하면 됨), `internalPackages()` 위에 "`INTERNAL_PACKAGES=(...)` bash 배열 리터럴에서 따옴표 문자열만 순서대로 추출. 선언 자체가 없으면 `[]`(→ 소비처 vacuity 단언이 잡는다)" 정도의 1~2줄 JSDoc 추가.

- **[INFO]** 커밋/테스트 주석의 정량적 역사 서술("리뷰어 9명")이 재현 불가능한 근거
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 파일 헤더 — "#968 은 리뷰어 9명이 못 봤고 작성자의 수동 grep 으로 뒤늦게 잡혔다." (동일 문구가 커밋 `f583856bc`/`7a4c69959` 메시지에도 있음)
  - 상세: `gh pr view 968 --json reviews` 로 확인한 결과 GitHub PR 리뷰 자체는 0건 — 이 "9명"은 아마 `/ai-review` 의 sub-agent(리뷰 관점) 개수를 가리키는 것으로 추정되나, 문면만으로는 "사람 리뷰어 9명"으로 오독될 여지가 있다. 사실관계 자체를 반박할 근거는 못 찾았고(개연성 있음), 다만 향후 이 주석을 근거로 삼는 사람이 "9명의 실제 리뷰어"로 오해할 위험이 있는 애매한 서술이다.
  - 제안: "sub-agent 리뷰(`/ai-review`) 9종" 처럼 무엇을 가리키는 9인지 한정해 명확히 하면 오독 위험이 줄어든다. 조치 불요 수준의 사소한 항목.

- **[INFO]** CHANGELOG 미갱신 — 정책과 일치, 조치 불요
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이번 변경은 사용자 가시 기능이 아닌 순수 harness/CI 자기검증 가드 추가다. 유사한 과거 harness-only 커밋들(`#966`·`#963`·`#960`·`#951`·`#939`·`#913` 등)을 확인한 결과 전부 `CHANGELOG.md` 를 건드리지 않는 일관된 관례가 있어, 이번 PR 도 CHANGELOG 갱신이 필요하지 않다.

- **[INFO]** README/설정 문서 갱신 불요 — 확인됨
  - 위치: `codebase/frontend/README.md`, `.claude/docs/test-wrapper.md`
  - 상세: `test-wrapper.md` 는 wrapper 메커니즘 자체(범용)를 문서화하고 `INTERNAL_PACKAGES` 같은 프로젝트별 스테이지 내용은 다루지 않는 것이 기존 관례라 갱신 대상이 아니다. `codebase/frontend/README.md` 도 테스트 디렉터리 컨벤션을 상세히 다루지 않아 `repo-guards/__tests__` 신설이 README 정합성을 깨뜨리지 않는다. 새 환경변수·API 엔드포인트도 도입되지 않았다.

## 주석 정확성 검증 (표본 대조)

문서화 관점에서 가장 중요한 것은 "주석이 실제 코드/저장소 상태와 일치하는가"였다. 다음 근거 주장들을 실측 대조했고 전부 정확함을 확인했다:

- "backend 의 `@workflow/*` 5개 의존 클로저는 flat(서로 재의존 없음)" — `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary}/package.json` 전수 확인, `@workflow/*` 의존 0건.
- "`@workflow/web-chat` → `@workflow/sdk` 만 전이 의존이고 backend 밖" — `codebase/packages/web-chat-sdk/package.json` 의 `devDependencies["@workflow/sdk"]="workspace:*"` 확인.
- "`js-yaml` 은 frontend 직접 의존이 아니고 hoist 로만 해소" — `codebase/frontend/node_modules/js-yaml` 부재, `pnpm-workspace.yaml`/`.npmrc` 의 `node-linker=isolated` 확인(전이 의존 접근이 불안정하다는 근거와 일치).
- `fnBody` 의 heredoc/here-string 판별 정규식(`/(?<!<)<<-?(?!<)/`)이 JSDoc 이 서술한 대로 `<<`/`<<-`는 매치하되 `<<<`(here-string)는 매치하지 않음을 정규식 수동 트레이스로 확인.

이런 실측 가능한 factual 주장을 코드 주석에 남기고, 리뷰 시점에 검증까지 통과했다는 점은 이 diff 의 문서화 품질이 평균 이상임을 보여준다.

## 요약

이번 diff(test-stages.sh·packages-checks.yml 헤더 주석 추가, 신규 순수 로직 모듈 `internal-package-registration-guard.ts`, 신규 테스트 `internal-package-registration.test.ts`)는 문서화 관점에서 이례적으로 충실하다. 각 파일 헤더가 "왜 이 위치인가"·"왜 이 방식인가"·"어떤 대안을 왜 기각했는가"를 전부 서술하고, 신규 함수 대부분이 목적·근거·엣지케이스를 설명하는 JSDoc 을 갖췄으며, 그 안의 사실관계 주장들은 실측 대조로 전부 정확함이 확인됐다. README·CHANGELOG·API 문서·설정 문서는 저장소의 기존 관례(harness-only 변경은 CHANGELOG 비갱신)와 일치해 갱신이 불필요하다. 유일한 흠은 같은 파일 안에서 두 함수(`repoRoot`/`internalPackages`)만 JSDoc 이 빠진 사소한 비일관성과, 검증 불가능한 정량적 역사 서술("리뷰어 9명") 하나뿐이며 둘 다 차단 사유가 아니다.

## 위험도

LOW
