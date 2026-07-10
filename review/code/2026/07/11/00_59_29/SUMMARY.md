# Code Review 통합 보고서 — `variables.__*` 3계층 강제

- **세션**: `review/code/2026/07/11/00_59_29`
- **diff base**: `origin/main...HEAD` (커밋 `d8ce7693f`)
- **경로**: fallback 평문 Agent fan-out (main 이 SUMMARY persist)
- **실행 reviewer (10)**: requirement · security · api_contract · architecture · scope · side_effect · testing · maintainability · documentation (+ forced 전량). router 미실행.

## 전체 위험도

**MEDIUM → 처리 후 LOW.** Critical 0. reviewer 가 3계층(L0/L1/L2) 강제의 정합성과 `{{ }}` 우회 차단을
독립 검증(코드 컴파일·mutation 재현)했다. Warning 은 대부분 문서 정합성 부채로, **전부 fix 또는 defer(근거)** 처리.

| 구분 | 건수 | 처리 |
| --- | --- | --- |
| Critical | 0 | — |
| Warning | 8 | 6 fix · 2 defer(근거) |
| Info | 다수 | 주요 3건 fix, 나머지 조치 불요 |

## reviewer 가 독립 검증한 핵심

- **`{{ }}` 우회 차단 실증**: 두 노드가 `EXPRESSION_EXCLUSIONS` 에 없고, `handler.validate`(원본) → `resolveConfig`(표현식 재평가) → `handler.execute`(해석 후) 순서라, L2 만이 표현식으로 만들어진 예약 이름을 잡는다 — requirement·security·architecture 3인이 코드로 재현.
- **mutation**: testing reviewer 가 L2 throw 를 제거해 재실행 → reserved 테스트 11건만 단독 실패, L0/L1/util 무영향 확인 후 복원.
- **async 전환**: 컴파일·인터페이스(여전히 `Promise<NodeHandlerOutput>`) 무변경. 동기 throw-in-Promise 잠재 버그 클래스 해소로 판정(architecture·scope·side_effect).
- **의존 방향**: `WorkflowsService → nodes/logic/_shared` 는 기존 선례(`graph-warning-rule` 등)와 일치, 역참조 없음 → 순환 위험 없음(architecture).

## Warning 처리

| # | reviewer | 내용 | 처리 |
| --- | --- | --- | --- |
| W1 | documentation | `execution-context.md:65` 이 이름 바뀐 "강제 갭" 을 dangling 참조 | **fix** — "강제 (3계층)" 로 정정 |
| W2 | documentation | 두 노드 spec §5 preamble 이 "config 검증 실패는 pre-flight throw" 로 단정(L2 런타임 throw 신설과 모순) | **fix** — 양쪽 §5 preamble 을 "대부분 pre-flight, 예약 이름 L2 만 런타임" 으로 정정 |
| W3 | documentation·requirement·(impl-prep W5) | `node-output-redesign/{decl,mod}.md` 라인 인용이 코드 삽입으로 stale | **fix** — 각 파일에 "7차 갱신" 노트로 실제 위치 정정 |
| W4 | testing·requirement | `importWorkflow` L0 게이트 테스트 0건 (saveCanvas 는 5건) | **fix** — reserved reject + offender label 폴백 2건 추가 |
| W5 | security | Code 노드 `$vars` atomic replace 로 `__workspaceId` 위조 가능 — 워크스페이스 신뢰 경계라 blast radius 가 문서에 축소 서술됨 (본 PR 이 도입한 것 아닌 **기존 리스크**) | **fix(문서) + 후속 chip** — 원칙 5 "강제 범위 밖" 에 구체 blast radius(Integration 자격증명·LLM config·sub-workflow) 명시, 근본 하드닝은 `task_d04bb348` 로 스폰 |
| W6 | api_contract | `importWorkflow` 는 legacy escape 없음 — 규칙 이전 export 재import 시 400 | **fix(문서)** — 원칙 5 "import 경로" 절로 의도 명시 |
| W7 | architecture | L0 와 L1 이 config 필드 순회(`variables[i].name`/`modifications[i].variable`)를 각자 hand-roll — 중복 | **defer(근거)** — 공유 불변식(`isReservedVariableName`)은 이미 util 에 있고 테스트됨. L0 는 `{node,field,name}` offenders, L1 은 `string[]` 메시지로 **반환 surface 가 달라** 통합 시 오히려 어댑터가 늘고, 대상이 2노드×1필드로 작다. registry 기반 추출은 노드 유형이 늘 때 재검토. |
| W8 | api_contract | `workflows.service.spec.ts:1574` 주석이 옛 파라미터명(`skipParamSchemaValidation`) 참조 | **fix** — `skipLegacyDataGates` 로 정정 |

## Info 처리

- **fix**: `logic.mdx`/`logic.en.mdx` 에 `__` 제약 사용자 노트(KO/EN parity), `isReservedVariableName` JSDoc 추가.
- **조치 불요**: 신규 util 을 `logic.mdx` frontmatter `code:` 에 등재 — spec-impl-evidence 는 ≥1 매치면 충분(기존 glob 이 schema.ts 매치). `details.offenders[].node` 의 save(uuid)/import(label) 이중 의미 — 원칙 5·테스트로 이미 고정.

## skip 된 reviewer 와 사유

router 미실행(fallback fan-out). performance / dependency / database / concurrency / user_guide_sync 는 미실행 —
런타임 hot-path·신규 의존성·DB 스키마/쿼리·동시성·(유저 가이드는 본 세션에서 직접 갱신)에 해당 표면이 없거나
직접 처리됨. api_contract·architecture 는 forced 밖이지만 신규 400 계약·3계층 구조 때문에 명시 추가 실행.

## 재검증 (fix 후)

lint PASS · 영향 unit PASS(backend 8개 스위트 226 tests) · frontend docs guard PASS(528, mdx parity·link-integrity 포함).
fix 는 문서·테스트·JSDoc 중심(런타임 로직 무변경)이나, 관례상 fresh `/ai-review` 로 clean 재확인한다.
