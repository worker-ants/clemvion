# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** "합성 fixture" 라 문서화된 테스트가 실제 저장소 파일에 암묵 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:182-183` (`describe("Gate C enforcement logic", ...)` 안 `it("flags non-string \`spec_impact\` entries as dangling, not just missing paths", ...)`)
  - 상세: 같은 `describe` 블록의 다른 테스트들(`hasValidSpecImpact` 대상)은 `exists = (p) => p === "spec/5-system/4-execution-engine.md"` 같은 순수 스텁 predicate 로 완전히 격리돼 있다. 반면 이 신규 테스트는 `repoRoot()` 로 **실제 저장소 루트**를 얻어 `danglingSpecImpact(root, ["spec/conventions/spec-impl-evidence.md"])` 를 호출한다 — `danglingSpecImpact` 내부가 `fs.existsSync(path.join(root, p))` 이므로 이 단언은 실제 파일 `spec/conventions/spec-impl-evidence.md` 가 지금 존재한다는 사실에 기대고 있다. 파일시스템 쓰기는 없지만(읽기 전용), 이 블록의 주석("실제 게이트와 갈릴 수 있는 판정 이중화를 막는다", "합성 fixture 로 겨눌 수 있어야 한다")이 표방하는 "순수·격리된 단위 테스트"라는 전제와 달리 실제 repo 상태(그 spec 파일의 존재/경로)에 은근히 결합돼 있다. 그 spec 파일이 향후 리네임·이동되면 `danglingSpecImpact` 로직 자체는 멀쩡한데 이 테스트만 무관한 이유로 깨진다.
  - 제안: 이 한 케이스만 `fs.existsSync` 를 모킹하거나(예: 임시 디렉터리 + 임시 파일을 만들어 `root` 로 전달), 최소한 왜 이 한 assertion 만 실 저장소에 결합되는지 주석으로 명시.

- **[INFO]** plan 목록 정렬 기준이 절대경로 코드포인트 정렬 → 상대경로 로케일 정렬로 변경
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:84` (`out.sort((a, b) => a.relPath.localeCompare(b.relPath));`)
  - 상세: 종전 `spec-plan-completion.test.ts` 의 손수 DFS 는 `out.sort()`(절대경로 문자열의 기본 코드포인트 비교)를 썼다. 새 `walkPlanMarkdown` 은 `relPath.localeCompare(...)` 로 바뀌었다 — 로케일 인식 비교라 한글이 섞인 plan 파일명 등에서 코드포인트 정렬과 다른 순서를 낼 수 있다. 각 plan 이 독립된 `describe` 블록으로 도는 구조라 pass/fail 자체에는 영향이 없지만, 테스트 리포트/콘솔 출력 순서가 이 리팩터로 조용히 바뀐다는 점은 부작용 관점에서 기록해 둘 만하다.
  - 제안: 의도된 변경이면 무해하므로 조치 불요. 순서에 의존하는 다른 소비처(예: 스냅샷)가 생기면 이 지점을 먼저 의심할 것.

## 점검 결과 요약 (문제 없음 확인)

- **파일시스템 부작용**: `plan-scan.test.ts` 의 두 `describe` 블록(`"plan-scan"`, `"findFrontmatterViolations"`) 과 `it("returns nothing on a tree with no plan/ directory", ...)` 내부의 임시 디렉터리 사용은 전부 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 OS 임시 경로 하위에만 생성되고, 각각 `afterAll`/`finally` 에서 `fs.rmSync(root, { recursive: true, force: true })` 로 정리된다. 실 저장소(`codebase/`, `spec/`, `plan/`) 에 대한 쓰기/삭제는 없다. `plan-scan.ts`·`spec-plan-completion.test.ts` 의 신규/변경 함수(`walkPlanMarkdown`, `findNonTerminalCompletedPlans`, `findFrontmatterViolations`, `danglingSpecImpact`, `parseFrontmatterSafe`)는 전부 읽기 전용(`fs.existsSync`/`fs.readdirSync`/`fs.readFileSync`)이다.
- **전역 변수**: `GATE_C_CUTOFF`, `NONE_VALUES`, `TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL`, `WORKTREE_PLACEHOLDER`, `ISO_DATE` 는 전부 모듈 스코프의 불변 상수(`const`/`ReadonlySet`)이고 어디서도 mutate 되지 않는다. `globalThis`/`process.env` 조작 없음.
- **시그니처 변경**: `plan-scan.ts` 는 이 PR 에서 신설된 파일(`git log --diff-filter=A` 로 확인)이라 기존 호출자를 깨는 시그니처 변경이 없다. `spec-plan-completion.test.ts` 의 로컬 함수 `collectCompletePlans(root)` 는 시그니처 그대로, 내부 구현만 `collectCompletePlanMarkdown` 위임으로 교체됐고 제외 규칙(`.md`·`0-`/`_` 접두·`archive/` 제외)은 신구 동일함을 diff 로 확인했다. `parseFrontmatterSafe` 전환도 동일 반환 shape(`{ data, block } | null`) 유지.
- **인터페이스 변경**: `plan-scan.ts` 의 신규 export 들은 `spec-links.ts`(`collectLivePlanMarkdown` re-export), `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts`, `plan-scan.test.ts` 4개 호출부에서 일관되게 소비되고 있음을 확인(grep). `vitest.config.ts` 의 `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 패턴상 `plan-scan.ts` 자체는 테스트 파일로 오인식되지 않는다.
- **환경 변수 / 네트워크 / 이벤트·콜백**: 세 파일 모두 해당 없음(env 읽기/쓰기, 외부 호출, 이벤트 발행 없음).
- **동작 변화(참고, side-effect 카테고리는 아니나 교차 확인)**: `danglingSpecImpact` 는 비-문자열 `spec_impact` 원소도 위반으로 잡도록 강화됐다(`typeof p === "string" && !exists` → `typeof p !== "string" || !exists`). 실제 강제 경로(enforced 실 plan)에는 현재 비-문자열 원소가 없다고 주석에 명시돼 있어 CI 상 즉시 회귀 위험은 낮다.

## 요약

세 파일 모두 읽기 전용 스캔/파싱 로직 통합과, 임시 디렉터리에 국한된 자가-정리형(self-cleaning) fixture 테스트로 구성돼 있다. 전역 변수·환경 변수·네트워크·이벤트 계열 부작용은 없고, 파일시스템 쓰기는 `os.tmpdir()` 하위로 격리돼 `afterAll`/`finally` 로 정리된다. `plan-scan.ts` 는 신설 모듈이라 기존 시그니처 파괴가 없고, 4개 호출부가 새 단일 구현으로 일관되게 수렴한 것도 확인했다(구 필터 로직과 파일 집합 동치성도 diff 로 검증). 유일하게 주목할 점은 "합성" 이라 표기된 신규 테스트 하나가 실제로는 `repoRoot()` 를 통해 실 저장소 spec 파일 존재에 결합돼 있다는 것과, plan 정렬 기준이 코드포인트→로케일 비교로 바뀌어 열거 순서가 달라질 수 있다는 것인데, 둘 다 INFO 수준으로 기능적 회귀나 부작용 결함은 아니다.

## 위험도

LOW
