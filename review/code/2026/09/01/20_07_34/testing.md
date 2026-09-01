# 테스트(Testing) 리뷰

## 검증 방법 메모

- `codebase/packages/expression-engine`: `pnpm --filter @workflow/expression-engine test` /
  `... lint` 를 현재 워크트리에서 실제 실행해 결과를 확인했다 (test: 3 suites / 133 passed,
  0 failed; lint: 0 errors).
- `error-shape.spec.ts` 의 "전수성 캐너리" 주장을 뮤테이션으로 직접 검증했다 — `errors.ts` 에
  7번째 하위 클래스(`ProbeError extends ExpressionError`)를 추가한 뒤 재실행 → **3 RED**
  (하위 클래스 나열 단언, 클래스↔코드 1:1 단언, `ProbeError` 의 `it.each` 케이스) 확인. 뮤테이션은
  **`Write` 로 원본을 저장소 안에서 직접 고친 뒤 원본 내용 그대로 `Write` 로 즉시 복원**했다
  (사전에 `git diff --stat`/원본 파일 내용을 `Read` 로 확보). 복원 후 `git status --short
  codebase/packages/expression-engine/` = 무출력(clean), `pnpm --filter @workflow/expression-engine
  test` 재실행 → 133 passed 로 재확인. 저장소에 잔여물 없음.

## 발견사항

- **[WARNING]** `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 의
  체크리스트가 **같은 PR 의 diff 와 모순**된다 — parser.ts 수정을 "안 했다/안 고친다" 고
  적어 놓았는데 실제로는 고쳤다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:124`~`127`
    (체크리스트 항목 `- [ ] parser.ts:317 no-case-declarations`) — 게이트 숫자는 프롬프트
    "전체 파일 컨텍스트" 블록 기준.
  - 상세: `:124`~`127` 은 "로컬 eslint 가 **내가 건드리지 않은** `parser.ts:317`
    (`no-case-declarations`)에서 실패한다 … **이 PR 에서 고치지 않는다**: 원인이 환경이면
    고칠 대상이 아니고, 무관한 파일을 이 changeset 에 끌어들이게 된다" 라고 명시한다. 그런데
    같은 리뷰 payload 의 **파일 5 (`codebase/packages/expression-engine/src/parser.ts`)** 는
    바로 그 317번째 줄(`case TokenType.LParen:`)을 `no-case-declarations` 를 피하려고
    블록(`{ }`)으로 감싸는 diff 를 담고 있다 — 주석("… TDZ 에 걸린다(`no-case-declarations`).
    블록으로 감싼다")도 정확히 그 규칙을 지목한다. 실측으로 확인: 현재 `parser.ts:317` 은
    이미 `case TokenType.LParen: {` 로 블록 스코프가 적용된 상태이고, `pnpm --filter
    @workflow/expression-engine lint` 는 **0 에러**로 통과한다. 즉 "안 건드렸다/이 PR 에서
    안 고친다" 는 두 서술 모두 diff 상태로 이미 반증됐다.
  - 이게 테스트 리뷰 관점에서 문제인 이유: 이 파일의 체크리스트는 이 changeset 의 **회귀
    검증 트래커**(테스트 통과 여부·CI 이력 대조를 기록하는 SoT) 다. 이 항목이 stale 한 채로
    남으면 다음 사람이 "parser.ts 는 미검증 상태·환경 이슈로 보류 중" 이라고 잘못 믿고,
    이미 로컬 lint 실패를 실제로 해소한 수정을 다시 조사하거나 반대로 "손대지 않았다" 는
    전제로 회귀 위험을 오판할 수 있다 (User memory: "plan 서술은 철회로 거짓이 될 수 있다").
  - 제안: 체크리스트 항목을 `[x]` 로 바꾸고 "이 diff 에서 함께 고쳤다 — lint 0 에러로
    해소, `no-case-declarations` 는 환경 이슈가 아니라 실제 위반이었다" 는 사실을 반영한다.
    "로컬-CI 툴체인 차이" 미해결 항목과는 **분리**해서 상태를 갱신해야 한다 (parser.ts 건은
    닫혔고, 툴체인 차이 건은 여전히 열려 있다 — 둘을 "같은 원인일 가능성" 으로 묶어 놨던
    전제 자체가 이 실측으로 약해졌다).

- **[INFO]** `error-shape.spec.ts` 의 전수성 캐너리 재설계는 뮤테이션으로 직접 검증했고
  주장대로 동작한다 — 좋은 테스트 설계 사례.
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:64`~`85`
    (`SubclassName` 타입 유도 + `SUBCLASSES` 필터).
  - 상세: 발견은 런타임(`Object.entries` + `instanceof`)으로 하고 타입은 모듈에서 매핑 타입으로
    유도하는 방식(`SubclassName`)으로, 명시 배열을 쓰지 않아 "새 하위 클래스가 추가돼도
    조용히 놓치는" 흔한 실패 모드를 피한다. `errors.ts` 에 `ProbeError` 를 추가해 직접
    확인한 결과 **3개 테스트가 RED** 로 전환됐다(하위 클래스 나열 단언, 클래스↔코드 1:1
    단언, `ProbeError` 의 `it.each` 케이스) — vacuous 하지 않고 실제로 새 클래스를 발견해
    순회한다는 뜻이다. 런타임 필터 로직 자체(`typeof value === 'function' && value !==
    ExpressionError && value.prototype instanceof ExpressionError`)는 diff 전후로 변경이 없고
    타입 술어만 TS2677 을 피하도록 바뀌었으므로 행동 변경 위험은 없다.
  - Mock 적절성/격리: mock 을 쓰지 않고 실제 에러 클래스를 직접 인스턴스화하며(`new Cls('probe
    message')`), 각 `it.each` 케이스가 독립적으로 인스턴스를 새로 만들어 공유 상태가 없다.
    가독성도 좋다 — 왜 명시 배열이 아니라 타입 유도인지, 왜 `enumerable` 축을 골랐는지를
    설명하는 인라인 주석이 상세하다.
  - 조치 불요 — 확인 목적의 INFO.

- **[INFO]** `parser.ts` 의 `case TokenType.LParen` 블록 스코프 리팩터는 순수 문법 변경이라
  신규 테스트가 필요 없고, 기존 회귀 테스트가 그대로 유효함을 확인했다.
  - 위치: `codebase/packages/expression-engine/src/parser.ts:317`
    (diff) / `codebase/packages/expression-engine/src/__tests__/expression.spec.ts:98`
    (`it('should evaluate parenthesized expressions', ...)`, 기존 파일 — 이번 diff 대상 아님).
  - 상세: diff 는 `{ }` 를 추가해 `const expr` 을 `case` 스코프에 가두는 것뿐이고 분기 로직·반환값은
    동일하다. `expression.spec.ts:98`(`{{ (1 + 2) * 3 }}` → `9`)이 바로 이 코드 경로를
    실행하며, `pnpm --filter @workflow/expression-engine test` 실행 결과 133/133 전부
    GREEN 으로 회귀 없음을 확인했다.
  - 조치 불요 — 확인 목적의 INFO.

- **[INFO]** 7개 패키지의 `"lint": "eslint src/**/*.ts"` → `eslint "src/**/*.ts"` 인용부호
  수정은 test 스코프(jest)가 아니라 lint 스코프이지만, 실제로 동작이 달라지는 회귀 수정임을
  확인했다.
  - 위치: `codebase/packages/expression-engine/package.json:11` 외 동일 패턴 6개 패키지
    (`ai-end-reason`, `chat-channel-validation`, `graph-warning-rules`, `masked-markers`,
    `node-summary`, 그리고 `expression-engine`; `chat-channel-validation`·`graph-warning-rules`
    등도 diff 동일).
  - 상세: 인용 전에는 현재 로컬 셸 환경에서 `eslint` 가 "No files matching the pattern
    src/**/*.ts were found" 로 **하드 실패**했고(스크래치에 남은 이전 라운드 로그로 교차
    확인), 인용 후에는 `pnpm --filter @workflow/expression-engine lint` 가 0 에러로 통과함을
    직접 재현했다. 이 스크립트들 자체를 검증하는 자동화 테스트는 없지만(JSON 설정이라
    당연하고, 7개 패키지가 동일 패턴이라 개별 유닛 테스트를 요구할 사안도 아니다), 이
    changeset 이 `codebase/packages/**` 를 건드리므로 CI `packages-checks` 가 실제로
    돌면서 나머지 6개 패키지에 대해서도 같은 신뢰도로 확인될 것이다(참고:
    `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 의 §CI 관측이
    이 job 이 `codebase/packages/**` 무변경 시 스킵-성공으로 보고된다는 사실을 이미
    독립적으로 규명해 뒀다 — 이번 PR 은 그 스킵 조건에 해당하지 않는다).
  - 조치 불요 — 확인 목적의 INFO. 순수 코드 변경(테스트 대상)은 아니므로 이 리뷰의
    커버리지 갭 판단에서는 제외했다.

- **[정보] 리뷰 대상 외 파일**: `plan/complete/spec-draft-avatar-storage-key.md`(신규),
  `plan/in-progress/spec-draft-avatar-storage-key.md`(삭제, 위 파일로 이동)는 spec 정정
  draft 문서이고 코드/테스트 변경이 아니라 이 리뷰의 관점(§1~§8) 적용 대상이 아니다.

## 요약

이번 changeset 의 실질적 "테스트" 표면은 `expression-engine` 패키지의 `error-shape.spec.ts`
타입 유도 리팩터와 `parser.ts` 의 문법 전용(no-case-declarations) 수정, 그리고 7개 패키지의
lint 스크립트 인용부호 수정이다. 세 가지 모두 로컬에서 직접 실행·뮤테이션 검증을 마쳤고
(jest 133/133 GREEN, lint 0 에러, 7번째 에러 클래스 뮤테이션 주입 시 3 RED 로 정확히
탐지), 실제 회귀 위험이나 커버리지 갭은 발견되지 않았다 — 오히려 전수성 캐너리는 검증
가능한 방식으로 잘 설계됐다. 유일한 실질적 문제는 코드가 아니라 **문서**다:
`plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 의 회귀-검증
체크리스트가 "parser.ts 는 안 건드렸다 / 이 PR 에서 안 고친다" 고 적어 두었는데, 같은 PR 의
diff 가 바로 그 줄을 고쳐 놓았다 — 이 트래커를 신뢰하는 다음 사람의 판단을 오도할 수 있어
머지 전 정정을 권한다.

## 위험도

LOW
