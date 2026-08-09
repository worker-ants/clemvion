# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `makeSpecExists` 의 `spec/` prefix 가드가 `..` path traversal 로 우회된다 — 이 가드 자체가 막으려던 "spec 밖 파일이 spec_impact 로 통과" 클래스가 형태만 바뀌어 재발
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112`(`makeSpecExists`), 게이트: `:117`(`if (!p.startsWith("spec/")) return false;`)
  - 상세: `p.startsWith("spec/")` 검사는 **정규화 전 원문 문자열**만 본다. `path.join(root, p)` 는 그 뒤에 `..` 세그먼트를 정규화하므로, 예를 들어 `spec_impact: ["spec/../CLAUDE.md"]` 는 `"spec/../CLAUDE.md".startsWith("spec/")` 가 `true` 라 prefix 가드를 통과한 뒤 `path.join(root, "spec/../CLAUDE.md")` 가 `<root>/CLAUDE.md` 로 정규화돼 `isFile()` 이 `true` 를 반환한다. 즉 이 함수가 막으려는 정확히 그 시나리오(`CLAUDE.md`/`package.json`/`PROJECT.md` 같은 spec 밖 파일 통과 — 바로 이전 커밋 `4e1995cb8` 의 수정 대상)가 `..` 세그먼트 하나로 재발한다(실측 완료, node REPL 로 `startsWith`=true·`isFile`=true 확인). 더 깊은 `spec/../../<repo-root-밖>` 형태로는 저장소 루트 밖 파일까지 열람 가능하다.
    현재 fixture(`spec-plan-completion.test.ts:304`의 `` `makeSpecExists` requires a real file `` 테스트)는 `""`·`"   "`·`"spec"`·`"spec/conventions"`·`"CLAUDE.md"`·`"codebase/frontend/package.json"`·`"PROJECT.md"` 만 겨냥하고 `..` 트래버설 케이스는 없다.
    실질 위험은 제한적이다 — `spec_impact` 값의 유일한 소스는 저장소 내 plan frontmatter(신뢰된 내부 콘텐츠)이고, 이 값을 조작해 얻는 이득도 "실제 spec 파일을 안 건드리고 게이트만 통과" 하는 정도로, 그냥 `none` 이라 쓰는 것보다 번거롭다. 다만 이 PR/커밋 시리즈 전체가 정확히 이 클래스의 우회(빈 문자열·디렉터리·비-spec 파일)를 하나씩 막아온 이력이라, 같은 매트릭스에 있는 인접 케이스가 비어 있는 것은 완결성 관점의 결함이다.
  - 제안: `path.join`/`path.resolve` 로 정규화한 뒤 (a) 여전히 `spec/` 로 시작하는지, 또는 (b) `path.relative(path.join(root, "spec"), resolved)` 가 `..` 로 시작하지 않는지 확인. 예: `const resolved = path.resolve(root, p); if (!resolved.startsWith(path.join(root, "spec") + path.sep)) return false;`. fixture 에 `"spec/../CLAUDE.md"` 케이스 추가.

- **[SPEC-DRIFT]** `.claude/docs/plan-lifecycle.md` §5 "흔한 실패형" 의 판정 로직 서술이 이번 PR 시리즈가 실제로 배선한 코드보다 느슨하다 — 코드가 맞고(spec-impl-evidence.md R-8 과 일치) 이 문서만 낡았다
  - 위치: `.claude/docs/plan-lifecycle.md:131` (`판정 로직은 \`ok = (string && 비어있지 않음) || (배열 && length>0)\` 이다`)
  - 상세: 이 문서는 여전히 "문자열이면 비어있지 않기만 하면 통과" 라고 서술하지만, 실제 게이트(`spec-plan-completion.test.ts` 의 `"declares spec_impact"` 테스트)는 커밋 `5860f295b`(본 PR 시리즈 소속, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:250` `hasValidSpecImpact(impact, specExists)`)부터 문자열 분기를 `NONE_VALUES`(`none`/`없음`/`n/a`/`na`) 어휘로 좁혔다 — 커밋 로그 자체가 "종전엔 '비어있지 않은 문자열' 이면 통과 → `spec_impact: maybe` 도 지나갔다" 며 이 강화를 명시적으로 기록한다(git log -S 로 `2d4775e28`→`5860f295b` 이력 확인 — `hasValidSpecImpact` 함수는 원래부터 엄격했지만 실제 게이트 루프는 별도 인라인 predicate 를 써서 느슨했고, 이번 PR 이 둘을 통합하며 게이트를 조였다). `spec/conventions/spec-impl-evidence.md:245`(R-8, `spec/` 안 문서라 SoT 로 더 권위 있음)는 이미 "no-op sentinel(`none`/`없음`/`n/a`/`na`) 채택, 빈 문자열 기각" 이라 정확히 서술하고 있어 코드와 일치한다 — 어긋난 쪽은 `.claude/docs/plan-lifecycle.md` §5 문장 하나뿐이다. (참고: 같은 문단 두 번째 불릿 "bare string 경로는 fail" 은 이미 강화된 동작과 일치해 첫 문장의 공식과 문서 내부적으로도 모순돼 있었다.)
  - 제안: 코드는 유지. `.claude/docs/plan-lifecycle.md` §5 해당 문장을 "문자열은 `none`/`없음`/`n/a`/`na` 어휘와 일치해야 하고(그 외 비-빈 문자열도 fail), 배열은 비어있지 않고 모든 원소가 실존 spec 파일이어야 한다" 로 갱신 — `project-planner` 경유 spec/harness-doc 반영.

## 요약

핵심 로직(Gate C 컷오프 `2026-06-04`, `TERMINAL_PLAN_STATUSES` 4어휘, `isIsoDate` 라운드트립, `worktree`/`started`/`owner` 필수 3필드, `0-`/`_` 인덱스 파일 면제, `spec_impact` none/리스트 판정)은 `.claude/docs/plan-lifecycle.md`·`spec/conventions/spec-impl-evidence.md` 와 line-level 로 일치하며, negative-path fixture(`plan-scan.test.ts`)가 각 분기를 실제로 관측 가능하게 겨누고 있어 "위반 0건이라 검사가 죽어도 모른다" 는 이 PR 자신이 반복 경계해 온 실패 형태를 스스로는 피하고 있다. TODO/FIXME 류 미완성 표식은 없다. 다만 두 가지는 짚을 만하다: (1) 이번 커밋이 막 좁힌 `makeSpecExists` 의 spec-경로 가드가 `..` traversal 로 재우회될 수 있는 인접 케이스가 fixture 매트릭스에서 빠졌고(WARNING, 실질 위험은 낮음 — 신뢰된 내부 데이터), (2) `.claude/docs/plan-lifecycle.md` §5 의 판정 공식 서술이 이번 PR 이 강화한 실제 동작보다 뒤처져 있다(SPEC-DRIFT, 권위 있는 `spec/conventions/spec-impl-evidence.md` 는 이미 정확). 두 항목 모두 게이트의 핵심 강제력(Gate C 자체의 존재 이유)을 무너뜨리지 않는 주변부 결함이다.

## 위험도

LOW
