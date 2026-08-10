# 테스트(Testing) 리뷰

## 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — plan 이동 시 (a) `status:` 모순 가드, (b) 살아있는 plan 의 상대링크 가드 신설
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `collectLivePlanMarkdown`/`findBrokenPlanLinks` 신규 export (기존 `findBrokenLinksInFiles` 코어 재사용)

두 파일 모두 diff 를 `git diff f8c334947..HEAD` 로 재확인했고, `pnpm vitest run src/lib/docs/__tests__/`(18 files / 2823 tests, 전체 GREEN)로 회귀 여부를 직접 실행 검증했다.

## 발견사항

- **[WARNING]** 신규 `findBrokenPlanLinks`/`collectLivePlanMarkdown` 조합이 fixture 기반 negative-path 테스트 없이 실리포지토리 dogfood 테스트로만 검증된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267` (`collectLivePlanMarkdown`), `spec-links.ts:302` (`findBrokenPlanLinks`) / 호출부 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:174`(위반 0건 단언), `plan-frontmatter.test.ts:185`(non-vacuity 파일수 단언)
  - 상세: 같은 `findBrokenLinksInFiles` 코어를 쓰는 자매 진입점 `findBrokenLinks`/`findBrokenSpecLinksInSources` 는 `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 에 임시 디렉터리 fixture 로 DEAD/ANCHOR 가 실제로 fire 하는지 검증하는 negative-path 테스트가 있다 (그 파일 자신의 docstring 이 이유를 명시: "실전 리포 가드는 positive-only… 스캐너가 죽어도 위반 0건으로 통과할 수 있다"). 그런데 이번에 추가된 세 번째 진입점 `findBrokenPlanLinks`(옵션 조합: `checkSelfAnchors:false`, `targetFilter` 없음)는 그 fixture 스위트에 대응 테스트가 없다. `plan-frontmatter.test.ts` 의 두 단언 — "위반 0건"(positive-only) 과 "수집 파일 수 > 5"(빈 배열 vacuous-pass만 방지) — 은 모두 "스캐너가 실제로 깨진 링크를 탐지하는가"를 증명하지 못한다. 이 코드 자체가 고치려는 원인(코드펜스 안 링크를 실링크로 오인해 거짓 양성을 낸 초판 버그, ai-review WARNING #1)을 지금 회귀로 고정해 두는 테스트가 이 진입점에는 없다.
  - 제안: `spec-links.test.ts` 의 기존 패턴대로 `plan/in-progress/*.md` 임시 fixture 를 추가해 (1) DEAD 상대링크가 실제로 잡히는지, (2) 코드펜스 안의 예시 링크는 무시되는지, (3) `checkSelfAnchors:false` 이므로 같은 파일 `#anchor` 는 무시되는지를 양성으로 단언할 것.

- **[WARNING]** "top-level 스코프가 같다"는 주석의 주장과 실제 필터 로직이 어긋나며, 이를 검증하는 테스트가 없다
  - 위치: 스코프 동일성 주장 — `plan-frontmatter.test.ts:34`~`38` 주석. 실제 필터 — `collectTopLevelPlans` `plan-frontmatter.test.ts:50`~`56` (`0-`/`_` 접두 제외) vs `collectLivePlanMarkdown` `spec-links.ts:273` (접두 제외 없음, `e.isFile() && e.name.endsWith(".md")` 뿐)
  - 상세: `plan-frontmatter.test.ts` 상단 주석은 "(b) 는 위 `collectTopLevelPlans` 와 같은 top-level 스코프"라고 명시하는데, 실제로는 `collectLivePlanMarkdown`이 `0-`/`_` 접두 인덱스 파일을 걸러내지 않는다(그룹 서브폴더 면제만 `e.isFile()`로 우연히 동일하게 성립). 현재 `plan/in-progress/` 최상위에 그런 파일이 없어(직접 확인함) 잠복 상태이지만, 나중에 `0-index.md` 류 파일이 예시 스니펫에 의도적으로 오래된 경로를 담고 추가되면 — frontmatter 검사는 면제되는데 링크 검사는 걸려 거짓 양성으로 push 가 막힌다. 두 컬렉터의 필터 동등성(혹은 의도된 차이)을 고정하는 테스트가 없다.
  - 제안: `collectLivePlanMarkdown` 에도 동일한 접두 제외를 적용하거나, 의도적 차이라면 `spec-links.ts` 의 docstring 에 그 차이를 명시하고 fixture 로 고정할 것.

- **[INFO]** `TERMINAL_STATUSES` 네 항목 중 `complete` 외 세 값(`implemented`/`applied`/`superseded`)의 커버리지가 실측 코퍼스 구성에 우연히 의존한다
  - 위치: `plan-frontmatter.test.ts:87` (Set 정의), `plan-frontmatter.test.ts:197`(non-vacuity `> 20` 카운트 가드)
  - 상세: 실측(`plan/complete/**`, archive 제외) 375개 문서 중 `status:` 선언은 134건이고 그중 `complete` 128 / `implemented` 4 / `applied` 3 / `superseded` 1 — 나머지 세 어휘는 각 1~4건으로만 실코퍼스에 존재한다. `> 20` 카운트 가드는 `complete` 128건만으로도 넉넉히 충족되므로, 이 세 어휘를 담은 문서가 나중에 archive 로 옮겨지거나 정리돼도 카운트 가드는 계속 통과하면서 그 분기들은 조용히 미실행 상태가 될 수 있다.
  - 제안: 필수는 아니나, `spec-links.test.ts` 처럼 임시 디렉터리 fixture 로 네 어휘 각각과 위반 케이스(`status: in-progress`)를 명시적으로 pin 해두면 코퍼스 구성 변화에 흔들리지 않는다.

- **[INFO]** `plan/complete/**` 프론트매터 파싱 실패는 침묵 스킵 — 의도된 스코프이나 검증 비대칭
  - 위치: `plan-frontmatter.test.ts:207`~`211` (`try { … } catch { continue; }`)
  - 상세: in-progress 플랜은 `it("has a parseable frontmatter block")`(`plan-frontmatter.test.ts:128`)로 파싱 실패 자체를 명시적으로 실패시키지만, complete 플랜은 파싱 실패 시 그냥 다음으로 넘어가 상태 모순 검사 자체가 무력화된다. 주석("frontmatter 파싱 실패는 이 검사의 관심사가 아니다")으로 의도가 설명돼 있어 설계 선택으로 보이지만, "완료 플랜의 프론트매터가 깨져도 아무 것도 감지하지 못한다"는 사각지대가 테스트로 고정되어 있지는 않다.
  - 제안: 낮은 우선순위. 필요하면 "깨진 YAML frontmatter 를 가진 completed plan 은 (별도) 경고를 낸다" 같은 후속 가드를 고려.

## 요약
이 변경은 그 자체로 테스트(가드) 코드이며, 실제로 이전에 두 번 놓친 실패 모드(`status:` 모순, plan 이동 후 깨진 상대링크)를 메꾸는 목적이 뚜렷하고, 커밋 이력에 실측 수치와 근거가 상세히 남아 있다. 직접 `pnpm vitest run`으로 18개 파일 2823개 테스트가 모두 GREEN 임을 확인했고 기존 테스트에 대한 회귀는 없다. non-vacuity 가드(discovery 가 죽으면 카운트 하한이 깨짐)도 일관되게 적용돼 있어 이 프로젝트의 기존 컨벤션을 잘 따른다. 다만 새로 노출한 `findBrokenPlanLinks`/`collectLivePlanMarkdown` 진입점은 자매 함수들과 달리 fixture 기반 negative-path 단위테스트가 빠져 있고, "top-level 스코프가 `collectTopLevelPlans` 와 같다"는 주석의 주장이 실제 필터(0-/_ 접두 제외 유무)와 어긋나는 잠복 갭이 있다 — 둘 다 오늘 당장 깨지지는 않지만 이 PR 자신이 강조하는 "실측되지 않은 전제가 조용히 재발한다"는 교훈과 정확히 같은 모양이라 조기에 fixture 로 pin 해두는 편이 안전하다.

## 위험도
LOW
