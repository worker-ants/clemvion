# RESOLUTION — review/code/2026/07/11/00_59_29

- **대상**: `d8ce7693f` (`variables.__*` 3계층 강제)
- **SUMMARY 집계**: Critical 0 · Warning 8 · Info 다수

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
| --- | --- | --- | --- |
| W1 | Warning (doc) | **fix** — `execution-context.md` dangling "강제 갭" → "강제 (3계층)" | 문서만 |
| W2 | Warning (doc) | **fix** — 두 노드 spec §5 preamble 을 L2 런타임 throw 반영해 정정 | 문서만 |
| W3 | Warning (doc/req) | **fix** — `node-output-redesign/{decl,mod}.md` 에 "7차 갱신" 라인-ref 정정 노트 | plan 문서만 |
| W4 | Warning (test) | **fix** — `importWorkflow` L0 테스트 2건 추가 (reserved reject + offender label 폴백) | 테스트 |
| W5 | Warning (security) | **fix(문서) + 후속** — 원칙 5 에 Code 노드 `__workspaceId` 위조 blast radius 명시. 근본 하드닝은 `task_d04bb348` chip | 문서 + chip |
| W6 | Warning (api) | **fix(문서)** — 원칙 5 "import 경로" 절로 legacy escape 부재를 의도로 명시 | 문서만 |
| W7 | Warning (arch) | **defer(근거)** — 아래 §보류·후속 항목 1 | — |
| W8 | Warning (api) | **fix** — spec:1574 주석 옛 파라미터명 정정 | 테스트 주석 |
| INFO | Info (maint/doc) | **fix** — `logic.mdx`/`.en.mdx` 사용자 노트(KO/EN), `isReservedVariableName` JSDoc | 문서/주석 |
| INFO | Info | **조치 불요** — util 의 `code:` frontmatter 등재(≥1 매치 충족), offender node 이중 의미(테스트로 고정) | — |

fix 는 전부 문서·테스트·주석·JSDoc — **런타임/프로덕션 로직 변경 0**.

## TEST 결과

- **lint**: 통과
- **unit**: 통과 — 영향 backend 8 suites / 226 tests (전체 unit stage 는 직전 라운드 backend 8000 / frontend 5295 PASS, 본 fix 는 로직 무변경). frontend docs guard 528 (mdx KO/EN parity·link-integrity 포함) 통과
- **build**: 직전 라운드 통과 (본 fix 는 런타임 로직 무변경 — 재빌드 불요, fresh /ai-review 후 최종 재확인)
- **e2e**: 직전 라운드 통과 (249). 문서·테스트-only fix 라 e2e 표면 무변경

## 보류·후속 항목

### 1. W7 — L0/L1 config 필드 순회 중복 (architecture, defer)

L0(`WorkflowsService.validateReservedVariableNames`)와 L1(두 schema 의 `validateConfig`)이 각각
`variables[i].name` / `modifications[i].variable` 순회를 hand-roll 한다.

**defer 근거**:

- 실제로 공유되어야 할 불변식("무엇이 예약인가")은 이미 `reserved-variable-name.util.ts` 의
  `isReservedVariableName` 로 단일화됐고 util spec 이 검증한다. 중복은 "어느 배열의 어느 필드를 도는가" 뿐이다.
- L0 는 `{node, field, name}` **offenders 객체**(400 details 용)를 만들고, L1 은 `string[]` **메시지**
  (엔진 `INVALID_NODE_CONFIG` 용)를 만든다 — 반환 surface 가 근본적으로 다르다. 하나의 추출기로 묶으면
  두 표현을 모두 내는 어댑터가 필요해 오히려 표면이 는다.
- 대상이 2개 노드 × 1개 필드로 작다. registry 기반 offender-extractor 로의 일반화는 **변수-이름을 갖는
  세 번째 노드 유형이 생길 때** 재검토한다(그때 OCP 이득이 실질화).

**재검토 트리거**: `context.variables` 에 폼으로 이름을 쓰는 노드가 하나 더 추가되면.

### 2. W5 후속 — Code 노드 `__workspaceId` 신뢰 경계 하드닝

`task_d04bb348` chip 으로 durable 등록. 본 PR 범위 밖(기존 리스크, 임의 코드 노드 격리에 대한 별개 결정).
원칙 5 "강제 범위 밖" 에 구체 blast radius 를 문서화했다.
