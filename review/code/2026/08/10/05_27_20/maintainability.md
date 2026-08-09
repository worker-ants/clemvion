# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `rawScalar` 가 `key` 인자를 이스케이프 없이 그대로 `RegExp` 리터럴에 삽입한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:219` (함수 `rawScalar`, 정의는 214~222)
  - 상세: `const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(block);` 는 `key` 에 정규식 메타문자(`.`, `*`, `[` 등)가 들어오면 의도와 다르게 매치한다. 현재는 저장소 전체에서 `rawScalar(block, "started")` 호출 한 곳뿐이라 실질 위험은 없지만(grep 확인), 이 함수는 `export` 된 범용 유틸이고 파일 상단 주석이 "다섯 번째 파서 호출이 추가될 때 조용히 되살아나는 종류" 를 경계하는 톤과 동일한 성격의 잠재 결함이다 — 나중에 `.`이 들어간 키(예: 향후 `spec.impact` 같은 이름)로 호출되면 매치가 조용히 틀어질 수 있다.
  - 제안: `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 이스케이프하거나, JSDoc 에 "key 는 영숫자/하이픈만 허용" 제약을 명시해 향후 호출자가 실수하지 않도록 한다.

- **[INFO]** `plan-scan.test.ts` 안에 frontmatter 문자열을 만드는 헬퍼가 두 벌(`fm`, `frontmatter`) 존재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:31-32` (`fm`) 와 `:217-218` (`frontmatter`)
  - 상세: 둘 다 `"---" ... "---" ... "# Doc"` 형태의 YAML 블록을 조립하는 동일한 목적의 헬퍼다. `fm` 은 `title: t` 를 하드코딩하고 선택적 `status` 하나만 받고, `frontmatter` 는 임의 필드 레코드를 받는다 — `fm(status)` 는 `frontmatter({ title: "t", ...(status !== undefined ? { status } : {}) })` 로 대체 가능해 보인다.
  - 제안: 필수는 아니나, 두 describe 블록이 이미 인접해 있으므로 하나로 합치면 "블록 포맷을 바꿀 때 두 곳을 손대야 하는" 부담을 없앨 수 있다.

- **[INFO]** `toBeGreaterThan(10)` 의 `10` 이 근거 주석 없이 하드코딩됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:165`
  - 상세: 바로 위 줄 주석은 "repoRoot 오판정 → 빈 스캔 → vacuous pass" 를 막는 목적만 설명하고, 왜 임계값이 `10` 인지는 설명하지 않는다. 저장소의 실제 `plan/complete/**` 개수가 줄어들면(정리 작업 등) 이 테스트가 무관한 이유로 깨질 수 있다.
  - 제안: `expect(plans.length).toBeGreaterThan(0)` 정도로 완화하거나, `10` 을 선택한 이유(예: "정상 상태라면 최소 이 정도는 있어야 빈 스캔과 구별된다")를 한 줄 덧붙인다.

- **[INFO]** `fs.mkdtempSync(path.join(os.tmpdir(), ...))` + `afterAll(() => fs.rmSync(...))` 보일러플레이트가 파일 내 3개 describe 블록에 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:38,73` / `:201-207` / `:363,373`
  - 상세: 임시 디렉터리 생성·정리 패턴이 동일한 형태로 세 번 나타난다. 각 블록이 독립된 fixture 라이프사이클을 갖는 것은 타당하지만, 생성/정리 로직 자체는 공통 헬퍼(`withTempPlanTree(fn)` 류)로 뽑아낼 여지가 있다.
  - 제안: 선택 사항 — 테스트 가독성에 큰 지장은 없어 우선순위는 낮음.

## 요약

세 파일 모두 유지보수성 관점에서 전반적으로 양호하다. 핵심 판정 로직(`isGateCEnforced`, `hasValidSpecImpact`, `danglingSpecImpact`, `makeSpecExists`, `checkPlanFrontmatter` 등)이 순수 함수로 분리돼 있고 각 함수가 단일 책임을 유지하며, 파일시스템 의존성을 주입(`specExists` 콜백 등)해 fixture 로 직접 겨눌 수 있게 설계했다. DRY 측면에서도 4벌로 흩어져 있던 plan 트리 워커를 `walkPlanMarkdown` 하나로 통합하고 `collectLivePlanMarkdown`/`collectCompletePlanMarkdown` 이 이를 위임하는 등 실질적인 중복 제거가 이루어졌다. 함수 길이·중첩 깊이·순환 복잡도 모두 임계 수준을 넘지 않으며, 네이밍(`TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL`, `FrontmatterViolationKind` 등)도 목적을 명확히 드러내고 기존 컨벤션(camelCase 함수, PascalCase 타입, UPPER_SNAKE_CASE 상수)과 일치한다. 각 결정에 대한 JSDoc/인라인 주석이 매우 상세해(실측 근거·뮤테이션 테스트 결과 포함) 다소 장문이지만, 이는 이 저장소가 반복해 강조하는 "판정 이중화 방지"·"조용한 우회 차단" 관행에 부합하는 의도된 스타일이며 가독성을 해치지 않는다. 지적된 항목은 모두 경미하며(정규식 이스케이프 부재, 소소한 테스트 헬퍼 중복, 근거 없는 매직 넘버 하나) 즉시 차단할 사유는 없다.

## 위험도

LOW
