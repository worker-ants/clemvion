# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** 신규 plan 스텁의 `worktree` frontmatter 가 금지된 legacy placeholder 형태라 build guard 를 깬다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` (`worktree: (미정 — 착수 시 생성)`)
  - 상세: `.claude/docs/plan-lifecycle.md` §4 는 "아직 worktree 가 없는 미착수 plan 은 placeholder 대신 명시 sentinel `(unstarted)` 를 쓴다. placeholder 는 … 어떤 worktree 와도 매칭되지 않아 plan 이 게이트에서 사라지므로 guard 가 거부한다" 고 명문화하고 있고, 이 판정은 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `WORKTREE_PLACEHOLDER = /\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i` 정규식으로 실제 구현돼 `plan-frontmatter.test.ts` (frontend unit 스위트) 가 top-level `plan/in-progress/*.md` 전체를 스캔해 강제한다. 이번 PR 이 새로 추가한 `nestjs-v12-coordinated-upgrade.md` 의 `worktree:` 값 `(미정 — 착수 시 생성)` 은 "미정"과 "착수 시" 두 토큰 모두 이 정규식에 걸린다 — 로컬에서 정규식을 직접 대입해 `true` 로 매치되는 것을 확인했다. 이 파일은 `0-`/`_` 접두 index 도 아니고 하위 그룹 폴더도 아닌 top-level `plan/in-progress/*.md` 라 스캔 대상에서 면제되지 않는다. 즉 이 PR 을 머지하면 `pnpm --filter frontend test`(또는 `run-test.sh unit`)의 `plan lifecycle guards` 스위트가 이 파일 하나 때문에 실패한다 — plan 문서(=documentation) 규약 위반이 코드 게이트를 직접 깨는 사례다. 같은 PR 의 다른 plan 파일 `plan/in-progress/jest-esm-native-load.md` 의 `worktree: deps-nestjs12-ci-4a7b2e` 는 이 정규식에 걸리지 않아 문제 없다.
  - 제안: `worktree: (미정 — 착수 시 생성)` 를 문서가 요구하는 sentinel `worktree: (unstarted)` 로 교체할 것. "착수 시 생성" 이라는 의도는 stub 본문("스텁 — `jest-esm-native-load` 가 들어간 뒤 착수한다")에 이미 서술돼 있으므로 frontmatter 값은 sentinel 하나로 충분하다.

- **[WARNING]** `jest.config.ts` 모듈 docstring이 이번 diff로 오래된 주석이 됐다
  - 위치: `codebase/backend/jest.config.ts:3-9` (diff 로 수정되지 않은 기존 블록)
  - 상세: 파일 최상단 docstring 은 "Extracted from package.json (commit history) so we can annotate the transformIgnorePatterns regex — JSON does not allow comments and the regex is non-obvious." 라고, 이 파일이 존재하는 이유를 "그 정규식에 주석을 달기 위해서"로 서술한다. 그런데 이번 diff 가 바로 그 "non-obvious regex" (`node_modules/(?!(?:\\.pnpm/…)?(?:uuid|p-limit|…)/)`)를 제거하고 jest 기본값 `['/node_modules/']` 로 되돌렸다 — 더 이상 "주석이 필요한 비자명한 정규식"이 존재하지 않는다. 파일 자체는 계속 존재할 근거(vm-modules ESM 로딩 이력·`moduleNameMapper`·`forceExit` 이력 등 새로 추가된 풍부한 주석)가 있지만, 최상단 docstring 은 그 넓어진 목적을 반영하지 못한 채 이제는 사라진 옛 이유만 남아 있다. 다음에 이 파일을 읽는 사람이 "정규식이 단순해졌으니 package.json 으로 되돌려도 되나?" 라고 오판할 소지가 있다.
  - 제안: docstring 을 "이 설정에는 여러 비자명한 결정(ESM 네이티브 로딩·forceExit 미사용·moduleNameMapper)에 대한 근거 주석이 달려 있고 JSON(`package.json`)은 주석을 지원하지 않아 `.ts` 로 분리해 유지한다" 는 식으로 갱신해 현재 파일의 실제 존재 이유를 반영할 것.

- **[INFO]** `PROJECT.md` 의 packages/* → vitest 이행 트리거 전제가 이번 발견으로 약화될 수 있음
  - 위치: `PROJECT.md` §"버전·도구 정책" — "테스트 프레임워크 이원화 (정책)" 항목 (`packages/* 의 vitest 이행은 jest 가 실제로 막는 ESM 의존이 등장하는 별도 트리거 전까지 보류한다`)
  - 상세: 이 문장은 "jest 가 ESM 의존을 실제로 못 뚫는" 사건이 발생하면 그것을 `packages/*` 를 vitest 로 옮기는 트리거로 삼겠다는 전제다. 그런데 이번 PR(`plan/in-progress/jest-esm-native-load.md`)이 정확히 그 사건(backend jest 가 `@nestjs/typeorm@12` 의 `import.meta.url` 때문에 ESM 을 못 읽음)을 실측하고, 해결책으로 "vitest 이행"이 아니라 "jest 자체가 `--experimental-vm-modules` 로 ESM 을 네이티브로 읽게 한다"를 택했다. 이 일반적인 해법은 `packages/*` 가 향후 같은 벽에 부딪혀도 동일하게 적용 가능해 보이므로, PROJECT.md 가 상정한 "그 트리거가 오면 vitest 로 이행" 이라는 전제 자체가 이 PR 로 인해 실질적으로 무력화됐을 가능성이 있다. 이 PR 의 plan/PROJECT.md 어디에도 이 상호작용이 언급되지 않는다.
  - 제안: 필수는 아니나, `PROJECT.md` 해당 문장이나 `jest-esm-native-load.md` 에 "이 vm-modules 해법이 `packages/*` 에도 적용 가능하므로 그쪽 ESM 트리거가 오더라도 vitest 이행이 아니라 같은 해법을 먼저 검토할 것" 이라는 한 줄 교차 참조를 남기면 다음 세션이 두 문서를 따로 읽고 모순된 결론(트리거가 왔는데 왜 vitest 로 안 옮겼나)에 빠지는 것을 막을 수 있다.

## 요약

핵심 코드 변경(`jest.config.ts`/`package.json`/`test/jest-e2e.json`) 자체의 인라인 문서화는 예외적으로 상세하고 정확하다 — 게이트 정체·판별 실험·비용(ExperimentalWarning)까지 실측 근거와 함께 남겼다. 다만 diff 가 건드리지 않은 파일 최상단 docstring(`jest.config.ts:3-9`)이 이번 변경으로 오래된 주석이 됐고, PROJECT.md 의 vitest 이행 트리거 전제도 이번 발견과 교차 참조가 없어 잠재적으로 어긋난다. 가장 심각한 문제는 새로 추가된 plan 스텁 `nestjs-v12-coordinated-upgrade.md` 의 `worktree` frontmatter 가 저장소가 명문화하고 실제 가드(`plan-frontmatter.test.ts`)로 강제하는 legacy-placeholder 금지 규칙을 위반한다는 점이다 — 정규식 매치를 직접 실측 확인했으며, 이는 문서 규약 위반이 곧바로 frontend 빌드 게이트 실패로 이어지는 사례다.

## 위험도

HIGH — CRITICAL 1건이 build guard(`plan-frontmatter.test.ts`)를 실제로 깬다.
