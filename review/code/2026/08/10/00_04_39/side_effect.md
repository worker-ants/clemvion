STATUS=success side_effect review complete (2 files, additive test-guard change)
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `spec-links.ts` 의 신규 export 는 순수 추가(additive) — 기존 시그니처 무변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267-306` (`collectLivePlanMarkdown`, `findBrokenPlanLinks` 신설)
  - 상세: `git diff f8c334947 HEAD -- codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 로 확인한 결과, 이 파일의 변경은 파일 끝부분에 두 함수를 **추가**한 것뿐이고 기존 export(`slugify`, `headingSlugs`, `extractLinks`, `isExternal`, `collectSpecMarkdown`, `findBrokenLinks`, `collectCodebaseSources`, `findBrokenSpecLinksInSources` 등)의 시그니처·동작은 전혀 건드리지 않았다. 이 모듈을 import 하는 기존 소비자(`spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `spec-links.test.ts`)는 named import 만 사용하므로 이름 충돌·회귀 위험이 없다.
  - 제안: 조치 불필요 — 안전한 순수 추가.

- **[INFO]** 신규 `it()` 두 건 모두 read-only 파일시스템 접근만 수행
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — `collectCompletedPlans` (함수, `dir`/`walk` 내부에서 `fs.existsSync`/`fs.readdirSync` 호출), `describe("completed plans declare a terminal status", …)` 블록 내부의 `it("no completed plan still declares \`status: in-progress\`", …)` (`fs.readFileSync` 호출)
  - 상세: `spec-links.ts` 의 신규 `collectLivePlanMarkdown`/`findBrokenPlanLinks` 도 `fs.existsSync`/`fs.readdirSync`/`fs.readFileSync` 만 사용한다(위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:270-273`, 및 `findBrokenLinksInFiles` 내부 `extractLinks`/`headingSlugs`). 파일 생성·수정·삭제, 네트워크 호출, 환경변수 read/write 는 diff 전체에서 발견되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** `describe` 블록 바디에서 즉시 실행되는 신규 재귀 디렉터리 워크(collection-time side effect) — 기존 패턴의 연장
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — 함수 `collectCompletedPlans` (파일 상단 신규 함수, `plan/complete/**` 재귀 워크) 가 `describe("completed plans declare a terminal status", …)` 블록의 최상위(즉 Vitest test-collection 단계)에서 `collectCompletedPlans(root)` 호출을 통해 즉시 실행된다.
  - 상세: 이는 새 부작용이 아니라, 이미 존재하던 `collectTopLevelPlans(root)` 를 describe 최상위에서 즉시 호출하는 기존 패턴(파일 상단 `plan-frontmatter guard` describe 블록)을 그대로 답습한 것이다. `plan/complete/**` 트리를 재귀 순회하므로(archive 서브트리 제외) 첫 번째 describe 보다 스캔 대상이 넓지만, 여전히 read-only 이고 테스트 컬렉션 단계에서 예외가 나면 해당 파일의 테스트 전체가 실패하는 정도의 영향만 있다(기존 설계와 동일 수준의 리스크). 실제 진짜 부작용(전역 상태 변경, 쓰기, 네트워크)은 없다.
  - 제안: 조치 불필요 — 정보 제공 목적.

- **[INFO]** 모듈 스코프 신규 상수 `TERMINAL_STATUSES` — 전역(globalThis) 오염 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:87` (`const TERMINAL_STATUSES = new Set([...])`)
  - 상세: ES 모듈 스코프의 `const` 로, `globalThis`/`window`/`process.env` 등 진짜 전역 상태를 건드리지 않는다. export 도 되지 않아 외부에서 접근·변조 불가능(해당 파일 내부에서만 read-only 참조).
  - 제안: 조치 불필요.

## 요약

두 파일 모두 부작용 관점에서 위험이 낮다. `spec-links.ts` 변경은 파일 말미에 새 export 두 개(`collectLivePlanMarkdown`, `findBrokenPlanLinks`)를 추가한 것뿐이고 기존 export 의 시그니처·동작·다른 소비자(`spec-link-integrity.test.ts` 등)에 영향이 없음을 `git diff f8c334947 HEAD` 로 확인했다. `plan-frontmatter.test.ts` 변경은 신규 헬퍼 함수(`collectCompletedPlans`)·신규 상수(`TERMINAL_STATUSES`)·신규 `describe`/`it` 두 블록을 추가한 것으로, 전부 `fs.existsSync`/`readdirSync`/`readFileSync` 를 통한 read-only 파일시스템 접근만 수행하며 쓰기·삭제·네트워크 호출·환경변수 조작·이벤트/콜백 변경은 전혀 없다. Vitest `describe` 최상위에서 파일시스템을 즉시 스캔하는 패턴(collection-time side effect)이 새 `describe` 블록에도 반복되지만, 이는 기존 파일에 이미 있던 설계 패턴을 그대로 따른 것이며 read-only 라 실질적 리스크가 없다.

## 위험도
NONE
