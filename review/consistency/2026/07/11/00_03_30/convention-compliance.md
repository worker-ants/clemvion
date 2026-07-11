# 정식 규약 준수 검토 — `variables.__*` 예약 prefix 강제 draft

대상: `/private/tmp/claude-501/-Volumes-project-private-clemvion--claude-worktrees-llm-usage-doc-alignment-01d7a4/9b5ca835-aa0d-4284-9bf6-3602bfcb6c7a/scratchpad/reserved-prefix-draft.md`
검토 저장소: `/Volumes/project/private/clemvion/.claude/worktrees/reserved-var-prefix-enforce-dedbde` (base origin/main)

## 발견사항

### [Info] i18n 의무 주장 — 검증 결과: draft 주장이 정확함 (no-op 확인)

- target 위치: draft `## 변경 1` 하단 "**i18n**: 불필요..." 문단
- 위반 규약: 해당 없음 (검증 항목)
- 상세: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:29-34` 의 parity guard 자체 주석이 "본 가드는 schema 파일을 정규식으로 정적 파싱한다... `validateConfig` 의 imperative 반환 (런타임 평가 필요)" 를 명시적 미커버 항목으로 선언한다. `extractWarningMessages()` (같은 파일 `:84-106`) 는 `warningRules: [...]` 배열 리터럴의 `message:` 문자열만 추출하며, `validateVariableDeclarationConfig`/`validateVariableModificationConfig` 는 `warningRules` 밖의 별도 함수(`variable-declaration.schema.ts:88-102`, `variable-modification.schema.ts:117-141`)라 이 추출 대상이 아니다. 실제로 기존 형제 메시지 `variables[i].name is required and must be a string` 도 `WARNING_KO` (`backend-labels.ts:384-449`) 에 없음을 grep 으로 확인했다 — draft 의 "기존 `variables[i].name is required...` 도 미등재" 주장과 일치.
- 결론: draft 의 i18n 불필요 주장은 **정확**하다. Critical 아님 — 오히려 검증 통과.

### [Warning] PROJECT.md 동반 갱신 매트릭스 — 검토 필요성 자체가 draft 에 언급되지 않음

- target 위치: draft "## 영향 없음 선언" — "프론트엔드 변경 0 (validateConfig 는 backend 전용, 프론트로 strip 됨)"
- 위반 규약: `PROJECT.md` §변경 유형 → 갱신 위치 매핑, "노드 schema 변경 (필드 추가·라벨 변경)" 행 (`PROJECT.md:120`) + `.claude/config/doc-sync-matrix.json` `node-schema-change` row (`id-node-schema-change`, `trigger.globs: ["codebase/backend/src/nodes/**"]`, `match: "glob"`)
- 상세: 매트릭스의 사람이 읽는 라벨은 "필드 추가·라벨 변경" 이지만, 기계용 SSOT(JSON)의 실제 트리거 glob 은 `codebase/backend/src/nodes/**` 전체이고 `match: "glob"`(기계적 매치, `semantic` 아님)이다. 즉 이번 PR 이 건드리는 두 `*.schema.ts` 파일은 이 트리거에 **기계적으로 매치**되어 `user-guide-sync-reviewer` 검토 대상이 된다. 실제로 `codebase/frontend/src/content/docs/02-nodes/logic.mdx` (frontmatter `code:` 에 두 schema.ts 파일이 명시적으로 등재됨, `:9`)의 FieldTable(`:269-271`, `:296-298`)은 `name`/`variable` 필드에 대해 예약 prefix 제약을 전혀 언급하지 않는다. 이는 "필드 추가·라벨 변경" 은 아니지만 **필드에 새 제약(제출 시 거부되는 값 패턴)이 생기는 변경**이라 매트릭스가 원래 의도한 "FieldTable 최신화" 취지에 실질적으로 해당할 여지가 있다.
- draft 는 이 매트릭스 검토 자체를 수행하거나 언급하지 않고 "프론트엔드 변경 0" 이라고만 선언한다. `codebase/frontend/src/content/docs/**` 는 frontend 트리 소속이므로 이 선언이 "이 검토는 불필요하다" 는 결론까지 함의하는지 불분명하다.
- 다만 동일 패턴의 선례(`codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts:349-351` 의 `__item_` schema-level reject)도 `codebase/frontend/src/content/docs/**` 어디에도 문서화되어 있지 않음을 확인했다(grep 0건) — 즉 "저수준 예약 prefix 거부는 유저 가이드에 미문서화" 가 기존에 이미 정착된 practice 로 보인다.
- 제안: spec 갱신 PR 본문 또는 `## Rationale` 에 "PROJECT.md node-schema-change 매트릭스 검토 완료 — FieldTable 갱신 불요(필드 추가/라벨 변경 아님, carousel `__item_` 선례와 동일하게 저수준 예약 prefix 는 유저 가이드 비문서화 관행 유지)" 한 줄을 명시할 것. 검토 누락이 아니라 "검토했고 해당 없음" 임을 문서에 남겨야 이후 `user-guide-sync-reviewer` 나 `/spec-coverage` 가 이 갭을 재발견해 반복 조사하는 낭비를 막는다.

### [Info] spec-impl-evidence — frontmatter 갱신 불요 확인 (검증 결과: 이슈 없음)

- target 위치: `spec/4-nodes/1-logic/4-variable-declaration.md:1-6`, `spec/4-nodes/1-logic/5-variable-modification.md:1-6`
- 위반 규약: 해당 없음 (검증 항목) — `spec/conventions/spec-impl-evidence.md` §3
- 상세: 두 spec 의 frontmatter `code:` 는 이미 glob `variable-declaration.*.ts` / `variable-modification.*.ts` 를 보유하며 이는 `*.schema.ts` 를 포함한다(글롭이 확장자 세그먼트를 이미 wildcard 처리). `status: implemented` 이고 spec+code 가 동일 PR(원자적)로 들어가므로 `spec-code-paths.test.ts` (glob ≥1 매치)는 그대로 통과하고, `status`/`pending_plans` 전이도 발생하지 않는다(둘 다 이미 `implemented`, 새 파일 추가나 이전 `partial` 상태 아님). draft 가 이 항목을 별도로 언급하지 않는 것은 갱신 대상이 없기 때문이며 누락이 아니다.

### [Info] 에러 메시지 문구 규약 — 해당 규약 부재, draft 문구는 기존 형제 메시지·선례와 정합

- target 위치: draft "## 변경 1" 하단 메시지 문구
- 위반 규약: 해당 없음 — `spec/conventions/error-codes.md` 는 `ErrorCode` **enum 값**(`error.code`)의 명명 규율만 다루며, `validateConfig` 가 반환하는 free-text 검증 문자열(`errors: string[]`)의 문구 형식은 대상 밖이다. `spec/conventions/node-output.md:128` 은 "message 자체는 영문 원문(SoT)" 원칙만 선언하고 구체 포맷(마침표 유무·인용부호 스타일)은 규정하지 않는다.
- 상세: draft 의 `variables[${i}].name must not start with reserved prefix "__"` 는 (a) 같은 함수의 기존 형제 메시지(`variables[${i}].name is required and must be a string` — `variable-declaration.schema.ts:96`, 마침표 없음) 및 (b) draft 가 명시한 선례 carousel `${prefix}.buttons[${j}].id must not contain reserved separator "__item_"`(`carousel.schema.ts:351`, 마침표 없음·리터럴 큰따옴표)의 스타일과 일치한다. 정합 확인됨 — Critical/Warning 아님.

### [Info] 테스트 컨벤션 — 기존 `.spec.ts` 패턴과 정합

- target 위치: `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts:48-72`, `codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts:48-86`
- 위반 규약: 해당 없음 (검증 항목)
- 상세: 두 파일 모두 `describe('validateVariable*Config (imperative)', ...)` 블록 안에 `it('rejects ...')` / `toContain(...)` 패턴이 기존에 확립돼 있다(예: "rejects variable without name", "rejects unknown operation"). draft 의 "reject 케이스 + 정상(`_single` underscore 허용) 케이스 추가" 계획은 이 기존 블록·단언 스타일을 그대로 따르는 설계로 확인된다. 정합.

### [Warning] Rationale 완결성 — "저장 시점 게이트 부재"를 아키텍처 불가피성으로 서술할 위험, 인접 선례 미인용

- target 위치: draft "## ⚠ breaking 성격" 섹션 전체
- 위반 규약: 직접적 규약 위반은 아니나, `spec/conventions/cross-node-warning-rules.md §5` "3중 가드" 원칙(같은 invariant 를 severity=error 수준에서는 save endpoint + canvas + runtime 3곳에서 가드해야 한다는 이 저장소의 확립된 아키텍처 관행)과 `codebase/backend/src/modules/workflows/workflows.service.ts:586-621` 의 `validateManualTrigger` 실제 선례(같은 파일의 `saveCanvas`(`:386-400`)가 노드별 구조적 검증을 저장 시점에 별도로 호출해, "handler.validate 는 실행 시점에만 호출된다" 는 일반 갭을 Manual Trigger 한정으로 이미 우회한 전례)와 draft 의 서술이 부분적으로 배치된다.
- 상세: draft 는 "워크플로우 저장 경로에는 handler.validate 게이트가 없다" 를 마치 근본적 아키텍처 제약처럼 서술하고 "이를 감수하는 근거(사용자 결정)" 로 넘어간다. 그러나 실제로는 `workflows.service.ts` 안에 Manual Trigger 전용으로 정확히 이 문제(저장은 통과했는데 실행 시점에만 실패가 드러나는 사용자 경험 저하)를 막기 위해 저장 시점 구조 검증을 추가한 선례가 존재한다(`:605-609` 주석: "Without this gate an invalid slot persists silently; at runtime it then... fails the run with a generic INVALID_NODE_CONFIG... Blocking here surfaces the precise per-field error immediately, on save."). 이는 draft 가 다루는 문제와 문자 그대로 동일한 패턴(저장은 통과 → 실행 시 pre-flight throw)이다.
- 다만 (a) `evaluateMetadataBlockingErrors`/`handler.validate` 자체가 `workflows.service.ts` 어디에서도 범용으로 호출되지 않음을 확인했고(grep 0건), (b) mini-DSL `warningRules` 의 `blocking` severity 조차 저장 시점에 서버가 강제하지 않는다(프론트 캔버스 UI 의 저장 버튼 disable 뿐, 직접 API 호출은 우회 가능) — 따라서 draft 가 기각한 "비차단 warningRule" 대안을 택했어도 이 breaking 문제는 해소되지 않았을 것이다. 사용자가 이미 전면 reject 를 결정했고 그 근거(silent 소실보다 명시적 실패가 낫다)도 합리적이므로, 이 발견은 **결정 자체에 대한 반대가 아니라 spec 본문/Rationale 의 서술 정확성**에 대한 것이다.
- 제안: `spec/conventions/execution-context.md` 원칙 5 갱신 시 (또는 각 노드 spec `## Rationale`) "저장 시점 게이트가 없다" 를 절대적 아키텍처 한계처럼 쓰지 말고, "Manual Trigger 에는 유사 문제에 대한 저장 시점 구조 검증 선례가 있으나(`workflows.service.ts` `validateManualTrigger`), 본 변경은 그 패턴을 채택하지 않고 런타임 pre-flight reject 만 두기로 스코프를 좁혔다(근거: ...)" 형태로 명시하면, 이후 리뷰어·`/spec-coverage` 가 "왜 save-time 가드를 안 뒀는가" 를 반복 재조사하지 않는다.

## 요약

draft 가 스스로 제기한 검증 대상 5개 항목 중 4개(i18n 미등재 주장, spec-impl-evidence frontmatter, 에러 메시지 문구, 테스트 컨벤션)는 저장소의 실제 코드·가드·선례와 대조한 결과 모두 **정합** 확인됐다 — 특히 i18n 주장은 parity guard 테스트 자체의 명시적 미커버 선언과 정확히 일치해 Critical 오탐 우려가 해소된다. 남은 두 Warning 은 규약 "위반" 이라기보다 **문서화 완결성** 문제다: (1) PROJECT.md/doc-sync-matrix 의 node-schema-change 트리거가 기계적으로 이 변경에 매치되는데 draft 가 그 검토 사실을 명시하지 않았고, (2) "저장 시점 미강제" 를 아키텍처 불가피성처럼 서술하면서 저장소 안의 정확히 유사한 선례(Manual Trigger 저장 시점 구조 검증)를 인용하지 않았다. 둘 다 이번 PR 을 차단할 사안은 아니며, 정식 spec 작성 시 한두 문장을 보강하면 해소된다.

## 위험도

LOW

STATUS: DONE
