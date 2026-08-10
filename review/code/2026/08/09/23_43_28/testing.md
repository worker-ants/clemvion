# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 새 `status` 모순 가드가 `plan/complete/**` → `plan/in-progress/**` 방향만 커버 (대칭 방향 미검증)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:214-237` (`describe("completed plans declare a terminal status")`)
  - 상세: 새 테스트는 "`complete/` 에 있으면서 `status: in-progress`" 모순만 잡는다. 거울상 케이스 — `plan/in-progress/**` 에 있으면서 `status: complete`(혹은 `implemented`/`applied`/`superseded`) 를 선언한 채 이동을 깜빡한 plan — 은 `collectTopLevelPlans` 루프의 기존 4개 `it`(`worktree`/`started`/`owner`/frontmatter 파싱)에 `status` 검증이 없어 어떤 게이트도 보지 않는다. PR 코멘트가 스스로 "이동이 남기는 두 갭" 이라 스코프를 明示했고 Stop-hook nudge(체크박스 기반)가 부분적으로 겹치는 안전망이라 이번 PR 스코프 밖으로 보는 것이 합리적이나, 같은 `TERMINAL_STATUSES` 상수를 재사용해 `plan/in-progress/*.md` 에 대해 "선언했다면 종료 상태가 아니어야 한다" 는 대칭 `it` 을 추가하면 비용 대비 커버리지 이득이 크다.
  - 제안: 후속 항목으로 `plan/in-progress/**` 의 `status` 가 `TERMINAL_STATUSES` 에 속하면 실패하는 대칭 테스트 추가를 검토 (원 plan 문서의 `## 후속` 섹션에 이미 유사 항목이 적혀 있는지 확인 후 없으면 등재 권장).

- **[INFO]** `status` frontmatter 가 문자열이 아니면 검증을 조용히 skip
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:227` (`if (typeof status !== "string") continue;`)
  - 상세: YAML 오기로 `status:` 가 리스트나 boolean 등 비-문자열이 되면(예: `status: [complete]`) 이 분기가 조용히 넘어가 그 파일은 검증 대상에서 빠진다. 실사용상 발생 가능성은 낮지만, 이 가드 자체가 "사람의 규율에만 기대던 필드를 게이트로 승격" 하는 것이 목적이므로 비-문자열 값도 위반으로 잡는 편이 가드의 취지에 더 부합한다.
  - 제안: `typeof status !== "string"` 대신 `status === undefined` 만 skip 하고, 존재하되 문자열이 아닌 경우도 `wrong` 목록에 포함시키는 방안 고려 (낮은 우선순위).

- **[INFO]** `relativeLinkTargets` 는 루트-상대 링크(`](/spec/...)`)를 리터럴 파일시스템 절대경로로 오인할 수 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:88-99` (`relativeLinkTargets`), 소비처 `:180-201`
  - 상세: `path.resolve(path.dirname(abs), target)` 는 `target` 이 `/` 로 시작하면 `dirname(abs)` 를 무시하고 그 절대경로를 그대로 쓴다. 현재 `plan/in-progress/*.md` 전수에 루트-상대 링크(`](/...)`) 가 0건임을 직접 확인했으나(정규식으로 스캔), 향후 그런 표기가 도입되면 실제로는 의도된 "repo-root 기준" 링크였어도 존재하지 않는 파일시스템 절대경로로 오판돼 거짓 실패(false positive)를 낼 수 있다. 외부 URL(`https?:`/`mailto:`/`<`)은 이미 제외 처리돼 있으나 `/` 시작 절대경로는 그 필터에 포함되지 않는다.
  - 제안: 현재는 실질 위험 없음(0건) — 대응 불요, 다만 후속에서 `/` 로 시작하는 target 도 제외 목록에 추가하거나 "repo-root 기준" 으로 해석하도록 명시하면 더 견고해진다.

- **[INFO]** 신규 헬퍼(`collectCompletedPlans`, `relativeLinkTargets`)에 대한 fixture 기반 격리 단위 테스트 부재 — 실제 저장소 콘텐츠에만 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:60-99`
  - 상세: 두 헬퍼 모두 임시 디렉터리·인메모리 마크다운 문자열로 만든 edge case(`archive` 하위폴더 재귀 제외, `[t](path#frag)`, `[t](mailto:...)`, `[t]()`, 중첩 대괄호 등)를 독립적으로 검증하지 않고, 실제 `plan/**` 콘텐츠를 통해서만 간접 검증된다. 이는 이 저장소의 기존 "living-document guard" 패턴(spec/plan 가드 전반)과 일관되고, vacuity 방지용 `toBeGreaterThan` 임계값(실측: in-progress 관련링크 92건 vs 임계 50, completed plan 375건 vs 임계 20 — 둘 다 여유 있는 안전마진 확인함)이 정규식이 죽는 경우를 어느 정도 캐너리로 잡아준다. 결함이라기보다 참고사항.
  - 제안: 필요 시 우선순위 낮음. 현재 캐너리 임계값으로 충분히 방어되고 있다고 판단.

## 검증 결과 (직접 실행)

- `pnpm exec vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` → **148 passed** (회귀 없음).
- `relativeLinkTargets` 로직을 별도 node 스크립트로 재구현해 `plan/in-progress/*.md` 전수 스캔 → **관계링크 92건, 깨진 링크 0건** (테스트 임계값 `>50` 대비 충분한 여유, vacuous 아님).
- `plan/complete/**` 전수 스캔(`archive` 제외) → **375건** (테스트 임계값 `>20` 대비 충분한 여유).
- diff 중 `plan/in-progress/node-cancellation-residual-signal-propagation.md`·`rag-quality-improvement.md`·`spec-update-node-cancellation-shutdown-classification.md` 의 상대링크 수정(자매 plan이 `complete/` 로 이동하며 깨진 링크를 `../complete/<name>` 으로 정정)이, 이번에 추가된 "top-level in-progress plans have no broken relative links" 테스트가 검증하려는 정확히 그 회귀 클래스임을 실측 확인 — 테스트가 실제 발생 이력이 있는 결함을 겨냥하고 있어 vacuous 하지 않다.
- `TERMINAL_STATUSES = {complete, implemented, applied, superseded}` 이 `.claude/docs/plan-lifecycle.md` §4 신설 문단의 서술과 정확히 일치.
- write 권한 부재로 실제 뮤테이션 재현(status 필드를 되돌려 RED 확인)은 이번 세션에서 직접 수행하지 못했으나(sandbox 가 codebase/plan 경로 편집 차단), plan 문서 자체에 뮤테이션 방법론과 결과(18파일/2821 tests → 전부 GREEN 이었다가 신규 가드 도입 후 캐치)가 상세 기록돼 있고, 위 재실행(148 passed, 0 broken/0 위반)으로 현재 상태의 정합성은 직접 확인했다.

## 요약

이번 PR 의 실질 테스트 변경은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 한 파일에 집중되며, `plan/complete/**` 이동 시 반복적으로(2번, `#1108`·`#1117`) 놓친 두 가지 실패형 — (a) `status:` 필드가 디렉터리와 모순, (b) 이동 후 형제 plan 을 향한 상대링크 깨짐 — 을 정확히 겨냥한 회귀 가드다. 두 신규 테스트 모두 vacuity 방지 단언(discovery count·parsed-link count 하한)을 갖췄고, 임계값이 현재 실측치 대비 합리적 여유를 두고 있음을 직접 재계산으로 확인했다. 나머지 25개 대상 파일은 대부분 `status: in-progress` → `complete` 1줄 frontmatter 정정 또는 이동으로 깨진 상대링크 정정으로, 새 가드가 검출·강제한 결과물이며 별도 테스트 갭은 없다. 발견된 항목은 전부 INFO 수준의 커버리지 미세 갭(대칭 방향 미검증, 비-문자열 status skip, 루트-상대 링크 오분류 가능성)으로, 현재 실제 데이터에는 영향이 없고 즉시 조치가 필요한 결함은 아니다.

## 위험도

LOW
