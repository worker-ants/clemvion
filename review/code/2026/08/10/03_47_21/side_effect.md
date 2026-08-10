# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** gray-matter 프로세스-전역 캐시 우회가 이번 diff 로 정확히 고쳐졌다 — 도메인 경계는 코드로 강제되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:97, 118` (수정), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:139, 249` (신설)
  - 상세: `matter(raw)`(옵션 없음)는 gray-matter 의 process-전역 캐시에 내용 문자열을 키로 등록하는데, 파싱이 throw 하면 캐시에 부분 초기화 객체가 남아 같은 내용의 2회차 호출이 조용히 `data={}` 를 돌려준다. `spec-plan-completion.test.ts`(Gate C)와 `plan-scan.ts`(`findNonTerminalCompletedPlans`)는 **같은 `plan/complete/**` 트리를 각각 파싱**하므로 실제로 이 캐시를 함께 밟을 수 있었고, 이번 diff 는 두 자리 모두 `matter(raw, {})` 로 옵션 객체를 넘겨 캐시를 우회하도록 정정했다(주석에 근거 명시). 두 파일의 모든 `matter()` 호출(4곳)을 확인했고 전부 `{}` 를 넘긴다 — 이 diff 범위 안에서는 일관되게 적용됐다.
  - 다만 같은 저장소의 `spec-frontmatter-parse.ts:113` 은 여전히 `matter(raw)`(옵션 없음, 캐시 사용)를 쓴다. 오늘은 그 모듈이 `spec/**` 만 읽고 이 diff 의 두 스캐너는 `plan/**` 만 읽어 내용 문자열이 겹치지 않으므로 실해는 없다. 다만 이 무해함은 "두 트리가 겹치지 않는다"는 **코드로 강제되지 않는 암묵적 전제**이고, 이번 diff 의 주석이 스스로 지적한 "같은 캐시를 서로 밟는다"는 위험 패턴과 동일한 클래스라 향후 워커/트리 재구성 시 재발할 수 있다. 이 diff 의 책임 범위 밖이라 CRITICAL/WARNING 은 아니며 기록 목적의 INFO.
  - 제안: 조치 불요(이 diff 범위에서는 올바르게 고쳐짐). 후속으로 `spec-frontmatter-parse.ts` 도 같은 `{}` 패턴으로 맞추면 이 클래스의 hazard가 저장소 전체에서 완전히 소거된다.

- **[INFO]** 신설 build gate 가 실 저장소 `plan/` 트리 전체를 대상으로 활성화된다 — 오늘은 무해함을 실측으로 확인
  - 위치: `.claude/docs/plan-lifecycle.md` §4/§5 (신설 체크리스트 항목), 소비처 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`(diff 밖, 이미 갱신됨)
  - 상세: 이번 diff 로 `findNonTerminalCompletedPlans`(완료 plan 의 `status` 종료값 검사)와 `findBrokenPlanLinks`(살아있는 plan 상대링크 검사)가 새로 신설되어 `plan-frontmatter.test.ts` 를 통해 CI 빌드 가드로 편입된다. 이는 이 diff 가 건드리는 5개 파일 밖의 `plan/**` 문서 전체에 새 실패 표면을 여는 광범위한 부작용이다(의도된 기능이지만 blast radius 가 이 PR 의 파일 범위를 넘는다). `pnpm --filter frontend test` 로 관련 4개 테스트 파일(`plan-frontmatter.test.ts`, `plan-scan.test.ts`, `spec-links.test.ts`, `spec-plan-completion.test.ts`)을 직접 실행해 확인한 결과 980 tests 전부 GREEN — 오늘 시점 실 저장소 데이터로는 신규 게이트가 기존 문서를 깨지 않는다.
  - 제안: 조치 불요. 이후 `plan/complete/**`·`plan/in-progress/*.md` 를 건드리는 무관한 PR 이 이 새 게이트에 걸릴 수 있다는 점만 팀에 공유되면 충분하다(문서 §4/§5 자체가 이미 이유를 설명하고 있어 서프라이즈는 낮다).

- **[INFO]** `plan/complete/**` 워커 중복이 아직 통합되지 않았다 — PR 스스로 인지·추적 중이라 신규 지적 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:59-96`(`walkPlanMarkdown`/`collectCompletePlanMarkdown`) vs `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-83`(`collectCompletePlans`, 독립 구현)
  - 상세: 두 함수가 `plan/complete/**` 를 각각 손으로 순회하며 `0-`/`_` 접두·`archive/` 제외 규칙을 **따로** 구현한다. `plan-scan.ts` 파일 최상단 주석이 이 상태를 이미 명시("Gate C 의 `collectCompletePlans` 는 아직 독립 구현으로 남아 있고... 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재")하고 있어 새로 발견한 문제는 아니다. 다만 이 파일 자체의 헤더 주석이 경고하는 "같은 트리를 보는 walker 가 여럿이면 규칙이 조용히 갈린다" 정확히 그 형태가 이 diff 이후에도 두 자리 남아있다는 점만 재확인차 기록한다 — 향후 한쪽에서만 접두 면제 규칙을 바꾸면 Gate C 의 enforced-set 과 status-검사의 enforced-set 이 서로 다른 파일 집합을 보게 된다.
  - 제안: 조치 불요(이미 별도 plan 으로 추적 중, 이번 PR 범위 아님).

- **[INFO]** `plan-scan.ts`/`spec-links.ts` 의 신규·확장 export 는 순수 추가이며 기존 소비처와의 시그니처 충돌 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (전체 신규 파일, `PlanMdFile`/`collectLivePlanMarkdown`/`collectCompletePlanMarkdown`/`TERMINAL_PLAN_STATUSES`/`findNonTerminalCompletedPlans`/`WORKTREE_SENTINEL`/`checkPlanFrontmatter`/`findFrontmatterViolations` 등), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:16-18, 269-271`(`collectLivePlanMarkdown` re-export + `findBrokenPlanLinks` 신설)
  - 상세: `spec-links.ts` 는 `collectLivePlanMarkdown` 을 `plan-scan.ts` 로부터 import 해 그대로 재-export 한다(하위호환 유지, `plan-frontmatter.test.ts` 헤더 주석이 이를 명시). 실제 소비처(`plan-frontmatter.test.ts`)를 grep 해 확인한 결과 새 함수/타입 이름으로 이미 일관되게 갱신돼 있고, 기존 함수 시그니처(`(root: string) => PlanMdFile[]` 등)는 변경되지 않았다. 공개 API 변경에 따른 호출자 영향은 없다.
  - 제안: 조치 불요.

- **[INFO]** 라이브러리 코드(비-테스트) 는 읽기 전용 fs 접근만 수행, 테스트 fixture 쓰기는 격리·정리됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`(전체), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`(전체) — `writeFileSync`/`mkdirSync`/`rmSync`/`process.env`/네트워크 호출 grep 결과 0건
  - 상세: 두 모듈 모두 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 만 사용한다(쓰기 없음). `plan-scan.test.ts` 는 `os.tmpdir()` 하위 `mkdtempSync` 로 격리된 합성 트리를 만들고 `afterAll` 에서 `rmSync({recursive:true, force:true})` 로 정리한다 — 실 저장소 `plan/` 을 건드리지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff(`plan-scan.ts` 신설, `plan-scan.test.ts` 신설, `spec-links.ts`/`spec-plan-completion.test.ts` 부분 수정, `plan-lifecycle.md` 문서 갱신)는 부작용 관점에서 대체로 안전하다. 라이브러리 함수는 전부 읽기 전용 fs 접근이고 쓰기·네트워크·환경변수 접근이 없으며, 신규 export 는 순수 추가라 기존 시그니처·소비처(`plan-frontmatter.test.ts`)를 깨지 않는다(직접 grep·`vitest run` 4개 파일 980 tests GREEN 으로 확인). 특히 눈에 띄는 점은 이 diff 가 gray-matter 의 프로세스-전역 캐시를 두 개의 서로 다른 가드(`spec-plan-completion.test.ts` Gate C, `plan-scan.ts`)가 같은 `plan/complete/**` 콘텐츠를 파싱하며 실제로 공유하고 있었다는 진짜 부작용 위험을 옵션 `{}` 우회로 정확히 고쳤다는 것 — 새 부작용을 만든 게 아니라 기존 부작용을 없앤 diff다. 유일하게 이 PR 파일 범위를 넘어서는 영향은 신설 build gate(완료-plan status 검사·상대링크 검사)가 CI 에서 `plan/` 트리 전체를 상시 검사하게 된다는 점인데, 오늘 시점 실 데이터로는 무해함을 실측했고 의도된 기능이라 결함으로 분류하지 않는다. 남은 두 walker(`collectCompletePlanMarkdown` vs `collectCompletePlans`)의 중복은 이미 PR 스스로 인지·추적 중인 follow-up 이라 신규 지적이 아니다.

## 위험도
LOW
