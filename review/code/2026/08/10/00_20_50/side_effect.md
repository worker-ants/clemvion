# 부작용(Side Effect) 리뷰

## 검토 범위 확인

`git diff f8c334947..HEAD` 로 실제 변경분을 확인했다 (프롬프트가 unified diff 를 제공하지 않아 전체 파일 컨텍스트만으로는 신규/기존 구분이 어려웠기 때문). 결과:

- `spec-links.ts`: `collectLivePlanMarkdown` + `findBrokenPlanLinks` 두 함수 **순수 추가**. 기존 export(`findBrokenLinks`, `slugify`, `headingSlugs`, `extractLinks`, `isExternal`, `collectSpecMarkdown`, `findBrokenSpecLinksInSources`, `collectCodebaseSources`)는 시그니처·동작 불변.
- `plan-frontmatter.test.ts`: `collectTopLevelPlans` 내부 구현을 자체 순회 → `collectLivePlanMarkdown` 위임으로 교체 + `collectCompletedPlans`/`TERMINAL_STATUSES`/새 `describe` 블록 추가.
- `spec-links.test.ts`: 신규 `describe("findBrokenPlanLinks (living plans)")` 블록 추가(negative-path fixture).

## 발견사항

- **[INFO]** `collectTopLevelPlans` 의 반환 정렬 기준 변경 (부작용 아님, 확인 목적 기록)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:50` (`collectTopLevelPlans`)
  - 상세: 종전엔 `.map((e) => path.join(dir, e.name)).sort()` 로 **절대경로 기준** 정렬이었고, 지금은 `collectLivePlanMarkdown(root).map((f) => f.absPath)` 로 **relPath 기준** 정렬 결과를 그대로 쓴다. 같은 디렉터리 내 파일들이라 relPath/absPath 정렬 순서는 사실상 동일해 현재는 관측 가능한 차이가 없다. 이 파일의 `describe(rel, ...)` 순회는 순서에 의존하지 않으므로(각 파일이 독립 `describe` 블록) 실질적 부작용 없음.
  - 제안: 없음(정보성).

- **[INFO]** 신규 테스트 fixture 의 파일시스템 쓰기 범위는 `os.tmpdir()` 로 격리됨 — 실제 저장소에 영향 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (`beforeAll`/`afterAll`, `fs.mkdtempSync`/`fs.rmSync`)
  - 상세: `findBrokenPlanLinks (living plans)` describe 블록의 `beforeAll` 이 `plan/in-progress`, `plan/complete` 디렉터리 구조를 흉내낸 임시 트리를 `os.tmpdir()` 하위에 생성하고 `afterAll` 에서 `fs.rmSync({ recursive: true, force: true })` 로 정리한다. 이름이 실제 저장소 경로(`plan/in-progress`)와 같아 얼핏 실제 저장소를 건드리는 것처럼 보이지만 `root` 는 매번 새로 만든 임시 디렉터리이므로 실제 `plan/**` 은 전혀 건드리지 않는다. 프로세스가 `afterAll` 도달 전 강제 종료되면(크래시·SIGKILL) 임시 디렉터리가 남을 수 있으나, 이는 같은 파일의 기존 `findBrokenLinksInFiles core` describe 블록도 동일하게 갖고 있던 기존 패턴이라 이번 변경이 새로 도입한 리스크는 아니다.
  - 제안: 없음(기존 패턴과 일관, 조치 불요).

- **[INFO]** `plan-frontmatter.test.ts` 신규 `describe("completed plans declare a terminal status")` 는 `plan/complete/**` 를 read-only 로만 순회
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (`collectCompletedPlans`, 두 번째 `describe` 블록)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 만 사용하고 쓰기 연산이 전혀 없다. `archive` 서브디렉터리는 순회에서 명시적으로 제외된다. 실제 저장소 상태를 변경하지 않는다.
  - 제안: 없음.

- **[INFO]** `spec-links.ts` 신규 export 는 파일시스템에 대해 read-only
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`collectLivePlanMarkdown`, `findBrokenPlanLinks`)
  - 상세: `fs.existsSync`/`fs.readdirSync`(그리고 위임 대상인 `findBrokenLinksInFiles` 내부의 `fs.readFileSync`)만 사용. 전역 상태를 쓰지 않고, 매 호출마다 로컬 `slugCache`(함수 스코프 `Map`)만 사용해 호출 간 상태 누수가 없다. 환경변수·네트워크 호출·이벤트 발행 없음.
  - 제안: 없음.

CRITICAL/WARNING 급 발견 없음. 시그니처가 깨진 기존 함수도 없다(신규 함수 2개 순수 추가, 기존 함수는 내부 구현만 위임으로 교체되고 시그니처·반환 타입 불변).

## 요약

이번 변경은 plan lifecycle 가드 3개 파일에 걸친 순수 추가/리팩터링이다. `spec-links.ts` 에는 기존 함수 시그니처를 건드리지 않고 `collectLivePlanMarkdown`/`findBrokenPlanLinks` 두 read-only 함수가 새로 추가됐고, `plan-frontmatter.test.ts` 는 중복 순회 로직을 그 공유 함수로 위임하도록 바뀌었을 뿐 관측 가능한 동작 차이가 없다. 새로 추가된 negative-path 테스트들은 전부 `os.tmpdir()` 로 격리된 임시 디렉터리에만 쓰기를 수행하고 `afterAll` 에서 정리하므로 실제 저장소·전역 상태·환경변수·네트워크에 대한 부작용은 없다. 유일하게 실제 저장소를 순회하는 신규 코드(`collectCompletedPlans` 등)도 전부 read-only 다.

## 위험도

NONE
