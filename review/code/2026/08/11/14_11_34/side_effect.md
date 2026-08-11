# 부작용(Side Effect) Review

전제: 이번 라운드의 리뷰 대상 델타는 커밋 `bafa7c007` (직전 라운드 `13_51_44` 의 6개 WARNING 처분).
`review/code/2026/08/11/13_51_44/{side_effect.md,RESOLUTION.md}` 를 먼저 읽고, `git show bafa7c007`
로 실제 diff 를 직접 대조해 검증했다.

## 발견사항

이번 델타 범위에서 새 CRITICAL/WARNING 은 없다. 지시받은 5개 항목을 하나씩 실측한 결과는 아래와 같다.

- **[INFO]** (해소 확인) `path.isAbsolute(base)` 분기 제거는 어떤 호출부의 동작도 바꾸지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:77-82` (`for (const base of bases) { ... const dir = path.join(root, base); }`)
  - 상세: 직전 라운드에서 이 분기는 "어떤 호출부도 쓰지 않는 죽은 코드"(LOW/INFO) 로 지적됐고, 이번 커밋에서 삼항을 걷어내고 `path.join(root, base)` 단일 경로로 되돌렸다. `walkTree(` 호출부 5곳(`impl-anchor-parse.ts:112`, `plan-scan.ts:70`, `spec-frontmatter-parse.ts:89`, `spec-links.ts:160`, `spec-links.ts:332`)을 전수 grep 으로 재확인했고, 전부 `"spec"`/`path.join("plan", bucket)`/`subPath`/`CODEBASE_SOURCE_ROOTS` 등 **상대 세그먼트만** 넘긴다 — 절대경로를 넘기는 호출부는 없다. 따라서 이 제거는 이미 도달 불가능하던 표면을 지운 것뿐이고, 어떤 실행 경로의 동작도 바꾸지 않는다. 부수 확인: 남긴 새 주석이 "절대경로는 `relPath` 에 `../` 를 만들어 함수 자신의 계약을 깬다" 는 근거까지 명시해, 재도입 방지 설명으로도 적절하다.
  - 제안: 없음. `tsc --noEmit` 0 에러, docs 가드 관련 스위트(2835 tests) 전량 통과로 재확인했다.

- **[INFO]** `SpecMdFile` 삭제 + `MdFileRef` 치환은 타입 수준 변경뿐, 런타임 부작용 0
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:144` (삭제 주석 자리), `spec-links.ts:196` (`files: MdFileRef[]`)
  - 상세: `SpecMdFile` 은 `interface { absPath: string; relPath: string }` 구조였고, 삭제 전에도 `type SpecMdFile = MdFileRef`(alias) 관계였다 — 즉 구조적으로 완전히 동일한 타입이었다. `interface`/`type` 삭제와 함수 시그니처의 타입 애너테이션 교체(`SpecMdFile[]` → `MdFileRef[]`)는 컴파일 타임에만 존재하고 TS 컴파일 결과 JS 에는 아무 흔적도 남기지 않는다. `grep -rn "SpecMdFile" codebase/` 로 저장소 전수를 확인한 결과 남은 참조는 전부 **주석**(설명문)뿐이고 코드에서 이 이름을 쓰는 곳은 0건이다. `cd codebase/frontend && npx tsc --noEmit -p .` 로 직접 재컴파일해 0 에러를 확인했다.
  - 제안: 없음.

- **[INFO]** plan 이동(`plan/in-progress/` 36→35)이 가드 밖으로 아무것도 빠뜨리지 않았다 — 설계상 예정된 축소이고 가드 자체가 이 시나리오를 방어하도록 이미 짜여 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 의 `expect(plans.length).toBeGreaterThan(5)` 검사(하한만 봄, 상수 아님) + 같은 파일의 "특정 plan 파일명에 의존하지 않는다 — 그 파일이 complete/ 로 이동하면 테스트가 깨지는 fragility 회피" 주석. `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `findBrokenPlanLinks` JSDoc — `plan/complete/**` 를 **의도적으로** 스캔 범위에서 제외한다고 명문화돼 있다("Scope is deliberately narrow ... `plan/complete/**` is excluded").
  - 상세: `collectLivePlanMarkdown` 소비처는 `plan-frontmatter.test.ts`(frontmatter 검사)와 `spec-links.ts` 의 `findBrokenPlanLinks`(링크 무결성) 둘이다. 전자는 정확한 개수가 아니라 "discovery 가 살아있는가"만 보는 하한(`>5`) 이라 36→35 변화로 깨지지 않는다(직접 코드 확인). 후자는 애초에 `plan/complete/**` 를 스캔 대상에서 제외하도록 설계돼 있어(주석에 이유까지 명시: "moved to complete leaves point-in-time records; widening would turn documented-normal broken links into a mass failure"), 이동된 plan 자신의 링크는 원래도 이 가드가 보던 대상이 아니다 — 이동으로 새로 빠진 것이 없다. 실제로 관측된 유일한 부작용은 반대 방향이다: **남아있는** `plan/in-progress/harness-env-value-subpattern-dedup.md:113` 이 이동 전 상대경로로 `docs-guard-walker-dedup.md` 를 가리키고 있었는데, 이 문서는 여전히 in-progress 라 `findBrokenPlanLinks` 스캔 대상이고, 옛 경로 그대로 뒀다면 이 커밋에서 DEAD 링크로 잡혔을 것이다 — 실제로는 같은 커밋 안에서 `../complete/docs-guard-walker-dedup.md` 로 정정됐다(직접 확인). `npx vitest run` 으로 `spec-links.test.ts`/`plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 를 재실행해 975 tests 전량 통과를 확인했고, `ls plan/in-progress/*.md | wc -l` = 35, `plan/complete/docs-guard-walker-dedup.md` 존재를 직접 대조했다.
  - 제안: 없음.

- **[INFO]** `spec_impact` 를 리스트로 바꾼 것은 Gate C 외 다른 소비처에 영향을 주지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:346-360`(`hasValidSpecImpact`), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (Gate C `describe`)
  - 상세: `spec_impact` 라는 식별자를 저장소 전수 grep(`codebase/frontend/src/lib/docs/__tests__/*.ts`, `.claude/hooks/*.py`) 한 결과, 읽는 곳은 `plan-scan.ts`(판정 함수 정의)와 `spec-plan-completion.test.ts`(Gate C `describe`, 유일한 실행 경로) 뿐이다. `plan/complete/docs-guard-walker-dedup.md` 자신의 frontmatter 를 `none` → 리스트(`- spec/conventions/spec-impl-evidence.md`)로 바꾼 것은 이 plan **한 건의 데이터 값**이지 판정 함수의 계약 변경이 아니다 — `hasValidSpecImpact` 는 이미 문자열/배열 두 형태를 모두 받도록 짜여 있었고(이번 델타에서 로직 변경 없음, 직접 diff 대조), Gate C 실행(975 tests 중 포함)도 정상 통과했다.
  - 제안: 없음.

- **[INFO]** `harness-env-value-subpattern-dedup.md` 수정은 다른 가드를 건드리지 않는다
  - 위치: `plan/in-progress/harness-env-value-subpattern-dedup.md:113` (상대링크 `../complete/docs-guard-walker-dedup.md` 로 정정 + 부연 문장 추가)
  - 상세: 이 파일은 `status` frontmatter 필드가 없어(미완료 plan) Gate C(완료 plan 전용) 대상이 아니고, `worktree: (unstarted)`/`started`/`owner` 는 이번 델타에서 변경되지 않았다 — `checkPlanFrontmatter` 판정에 영향 없음. 변경은 (a) 이동한 plan 을 가리키는 상대경로 정정(위 항목에서 확인한 대로 `findBrokenPlanLinks` 를 GREEN 으로 유지하기 위한 필수 수정) 과 (b) 본문 설명 텍스트 추가뿐이다. 이 파일을 스캔하는 가드(frontmatter 검사·링크 검사)를 함께 재실행해 통과를 확인했다 — 다른 가드(Gate C, tree-walk 계약 테스트 등)는 이 파일을 아예 읽지 않는다(소비처 grep 으로 확인).
  - 제안: 없음.

새 **CRITICAL 은 없다.** 5개 확인 항목 모두 "동작 변경 없음" 또는 "설계상 의도된 변경이고 소비처가 그것을 이미 견디도록 짜여 있음"으로 실측 확인됐고, 직전 라운드가 지적한 유일한 실질 이슈(`path.isAbsolute` 죽은 분기)는 이번 커밋에서 정확히 그 근거(다섯 호출부 미사용 + 자기 계약 위반)를 남기며 제거됐다.

## 요약

이번 라운드의 델타(`bafa7c007`)는 직전 라운드 리뷰 7명의 수렴 지적을 처분하는 정리 커밋이다. 부작용 관점에서 확인해야 할 5개 항목 — `path.isAbsolute` 제거, `SpecMdFile`→`MdFileRef` 치환, plan 이동에 따른 가드 스코프 변화, `spec_impact` 리스트화의 소비처 영향, `harness-env-value-subpattern-dedup.md` 편집의 파급 — 모두 코드/테스트를 직접 열어 대조한 결과 새로운 부작용이 없었다. 특히 plan 이동은 `findBrokenPlanLinks` 가 애초에 `plan/complete/**` 를 스캔 범위에서 제외하도록 설계돼 있고 `plan-frontmatter.test.ts` 도 정확한 개수가 아닌 하한(`>5`)만 검사하도록 이미 방어돼 있어(주석에 "파일이 complete/ 로 이동해도 안 깨지도록" 이라고 명시) 이동 자체가 부작용을 만들지 않았다. 유일하게 실제로 걸릴 뻔했던 자리(harness-env 문서의 상대링크)는 같은 커밋 안에서 이미 정정돼 있었다. `tsc --noEmit` 0 에러, 관련 vitest 스위트 전량 GREEN 으로 교차 검증했다.

## 위험도

NONE

STATUS: OK
