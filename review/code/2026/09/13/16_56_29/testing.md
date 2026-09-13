# 테스트(Testing) 코드 리뷰

## 검증 방법

`guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 전문을 `Read` 로 직접 확인했고,
`plan/in-progress/guide-identifier-existence.md` + `review/code/2026/09/13/{14_41_14,15_03_06,
15_24_12,15_42_54,16_04_15,16_28_47}/testing.md` 6라운드분을 읽어 이미 처분된 항목(경계 결함·
합성 대조군 부재·compose 리스트 스타일 갭 등)을 재지적하지 않도록 대조했다. 이 가드는 6라운드에
걸쳐 정규식 5개 전수 감사 + 판별 fixture 로 이미 매우 촘촘히 뮤테이션 검증되어 있다.

`npx vitest run` 으로 `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`
를 직접 실행해 41/41 GREEN 을 확인했다(회귀 검증).

**저장소 밖에서는 재현이 안 되는 가설이라, 규약대로 원본을 `mktemp` 계열 scratch 로 `cp` 백업한
뒤 저장소 파일을 직접 뮤테이션하고 즉시 `cp` 로 원복했다** — `git checkout`/`restore` 는 쓰지
않았다. 원복 직후 `diff` 로 바이트 동일함과 `git status --short` 로 클린 상태를 확인했다(아래
발견사항 1 참조). 다른 미확인 잔여물은 없다.

## 발견사항

- **[WARNING]** `GUIDE_EXTERNAL_VOCABULARY` 의 "4강제" 중 3개(어쩌면 4개)가 배열이 **비면
  전부 통과하는 vacuous 단언**이다 — 뮤테이션으로 직접 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:131-157`
    (`describe("외부 어휘 허용목록 — 은폐 수단이 되지 않도록"`, 특히 132행 `for (const entry of
    GUIDE_EXTERNAL_VOCABULARY)`, 146행 `.filter((e) => !cited.has(e.token))`, 152행
    `.filter((e) => basis.has(e.token))`). 대상 배열 정의는
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:175-185`.
  - 상세: CHANGELOG·PROJECT.md·이 파일의 JSDoc 은 모두 "테스트가 넷을 강제한다 — 외부
    시스템 이름 의무 · 상한 · 여전히 인용될 것 · 기준집합에 없을 것" 이라고 명시한다. 그런데
    이 넷 중 **상한 검사(139행, `toBeLessThanOrEqual`) 를 제외한 나머지 셋은 배열이 통째로
    비었을 때도 전부 통과한다** — `for...of` 빈 루프는 아무 것도 단언하지 않고, 빈 배열의
    `.filter(...)` 는 항상 `[]` 를 반환해 `toEqual([])` 가 자동으로 참이 된다.
    저장소 파일을 직접 뮤테이션해 실측했다: `GUIDE_EXTERNAL_VOCABULARY` 를 `[]` 로 비우고
    `vitest run` 을 돌리자, **이 describe 블록의 4개 `it` 은 전부 GREEN 으로 통과**했고, 대신
    전혀 다른 곳 — 바깥의 "가이드가 적은 모든 식별자가 실재한다 (베이스라인 0)" 테스트가
    RED 로 잡았다(실제 문서 `discord.mdx`/`discord.en.mdx` 가 지금도 `MESSAGE_CREATE` 를
    인용하고 있어서, 그 토큰이 `basis`에도 `allowed`에도 없어져 실패했다). 원복 후
    `diff`로 바이트 동일, `git status --short` 클린 확인 완료.

    즉 오늘 이 뮤테이션이 잡히는 것은 **"4강제" 테스트들 덕분이 아니라, 우연히 그 유일한
    허용 항목(`MESSAGE_CREATE`)이 실제 가이드에 지금도 인용되고 있어서 베이스라인-0 테스트가
    부수적으로 잡아 준 것**이다. 이 인과관계가 끊기는 두 시나리오 모두 현실적이다 —
    (a) 가이드 문서가 나중에 다른 이유로 재작성되며 `discord*.mdx` 의 해당 문장이 없어지면,
    (b) 또는 새 외부 허용 항목이 추가되면서 그 항목이 어쩌다 가이드에서 인용을 멈추면 —
    그 순간 "4강제" 블록은 계속 GREEN 인 채로 배열이 비거나 죽은 항목이 남아도 아무도
    잡지 못한다. 이는 이 프로젝트가 이미 문서화한 vacuous-test 세 형태(부정 단언이 제3상태
    에서 참·config 형태 오판·detached 실행) 와 같은 계열의 **네 번째 형태**로, "존재해야 할
    항목이 사라져도 for/filter 기반 단언이 그것을 감지하지 못한다" 는 패턴이다.
  - 제안: `expect(GUIDE_EXTERNAL_VOCABULARY.length).toBeGreaterThan(0)` (또는 `.not.toEqual([])`)
    형태의 명시적 하한 floor 를 이 describe 블록(또는 파일 상단 vacuity floor 묶음)에 추가한다.
    이렇게 하면 "4강제" 라는 문서상의 약속이 배열의 존재 자체에도 실제로 걸린다 — 지금은 상한만
    걸려 있다.

- **[INFO]** `FIELD_TABLE_NAME` 축은 `name` 이 객체 리터럴의 **첫 속성**일 것을 암묵 전제한다 —
  대조군 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:125`
    (`` const FIELD_TABLE_NAME = new RegExp(`\\{\\s*name:\\s*"(${UPPER_SNAKE})"`, "g"); ``).
    관련 테스트는 `guide-identifier-existence.test.ts:336-340` (`"[경계] 축 1 은 줄 단위라
    여러 줄로 쪼갠 행은 놓친다"`) 이지만, 이 테스트는 "여러 줄로 쪼개짐" 만 겨눈다.
  - 상세: 정규식이 `{` 바로 뒤에 `name:` 이 온다고 가정한다. 만약 `<FieldTable>` 행이
    `{ type: "x", name: "CODE" }` 처럼 `name` 이 첫 속성이 아니면 조용히 놓친다(fail-open —
    이 가드 계열이 가장 위험하다고 스스로 표시한 방향과 같다). 직접
    `grep -rEon '\{[^{]{0,5}type:[^}]*name:\s*"[A-Z_]+' codebase/frontend/src/content/docs`
    로 실측했고 현재 코퍼스 242개 `<FieldTable>` 행 전부 `name` 이 첫 속성이라(0건) 오늘은
    관측되지 않는다. 이미 문서화된 "줄 단위" 한계와는 **다른 축**(순서 의존성)이라 상단
    "정규식 경계 — 전수 감사" 표에도 이 항목이 없다.
  - 제안: 우선순위 낮음 — `{ type: "x", name: "MADE_UP" }` 류 fixture 로 현재 동작(놓침)을
    `[한계]`/`[비대상]` 형태로 고정하거나, `name` 위치 무관하게 잡도록 정규식을 넓힌다(과매치는
    이 가드에서 fail-closed 방향이라 안전).

## 회귀·기존 처분 재검증 (조치 불요)

- `\b`(collectSourceTokens) · `(?<!\w)`(CODE_FIELD) · `{` 앵커(FIELD_TABLE_NAME/BACKTICK) ·
  compose 매핑/리스트 스타일 갭 — 6라운드에 걸쳐 판별 fixture 로 확인된 항목들이며 이번
  라운드에서 재실행(`vitest run`)해도 GREEN, 코드 변경 없음. 재지적하지 않는다.
- `collectEnvDeclarations` 의 `^#?` 분기 — 라운드 2(`15_03_06`)가 지적한 무검증 문제는 현재
  `describe("collectEnvDeclarations — 분기별 대조군")`(252-313행) 로 해소되어 있음을 확인했다.
- 테스트 격리: `root`/`mdxFiles`/`sourceTexts`/`sourceTokens`/`envTokens`/`basis`/`citations` 는
  모두 `describe` 콜백 실행 시 1회 계산되는 상수이고 어떤 `it` 도 이를 변형하지 않는다.
  `it` 간 순서 의존성·공유 가변 상태 없음 — 독립 실행 가능.
- Mock 사용: 전무. 실제 파일시스템 판독(`fs.readFileSync`/`readdirSync`/`existsSync`)이 이
  가드의 존재 목적(실재성 검사)과 정확히 부합해 적절하다. 경계 테스트는 mock 대신 순수 문자열
  인자로 스캐너 함수를 직접 호출하는 방식이라 더 단순하고 신뢰도가 높다.
- 회귀 네이밍 테스트(`discord.en.mdx`/`EXECUTION_TIMEOUT`, `mcp-servers.mdx`/
  `MCP_ALLOW_INSECURE_URL`) 와 과거 결함 재현 3갈래(`MCP_INSECURE_URL_ALLOWED`/
  `MCP_ALLOW_INSECURE_URL`) — 실제 코퍼스 문자열과 대조해 유효함을 확인했다. 이번 라운드에
  직접 실행한 뮤테이션(발견사항 1)이 우연히 이 회귀 테스트의 실질적 안전망 역할도 드러냈다.
- `guide-sanitized-message-parity.test.ts` 의 변경은 자매 파일명 갱신(`guide-error-code-
  existence.test.ts` → `guide-identifier-existence.test.ts`, 옛 이름 병기) 뿐인 JSDoc 코멘트
  수정으로, 실행 경로에 영향 없음. 41/41 GREEN 으로 재확인.

## 요약

이 diff 는 이미 6라운드의 `/ai-review`·`--impl-done` 을 거치며 정규식 경계마다 판별 fixture 로
뮤테이션 검증을 마친 매우 성숙한 테스트 스위트다. 직접 뮤테이션(저장소 파일을 임시로 고치고
`cp` 로 즉시 원복)으로 새 갭 하나를 찾았다 — `GUIDE_EXTERNAL_VOCABULARY` 의 "4강제" 중 상한
검사를 제외한 나머지가 배열이 비면 전부 vacuous 하게 통과하며, 오늘 그 뮤테이션이 그래도 잡히는
것은 이 describe 블록 덕분이 아니라 무관한 베이스라인-0 테스트가 우연히 잡아 준 것이다(코퍼스가
바뀌면 이 안전망도 사라진다). 그 외에는 `FIELD_TABLE_NAME` 의 속성-순서 암묵 전제(INFO, 오늘
코퍼스 0건이라 저위험) 정도이며, Critical 급 결함은 없다. 나머지 축(경계·과거 결함 재현·
compose 파싱·테스트 격리·mock 부재의 적절성)은 기존 처분이 유효함을 재확인했다.

## 위험도

LOW
