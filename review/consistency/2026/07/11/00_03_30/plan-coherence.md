# Plan 정합성 검토 — `variables.__*` 예약 prefix 강제 (task_7f283553)

draft: `reserved-prefix-draft.md` (spec+code 원자 PR, `variable-declaration.schema.ts` / `variable-modification.schema.ts` 에 schema-level reject 추가 + `execution-context.md` 원칙 5 "강제 갭" 갱신).

## 검토 범위 확인

`plan/in-progress/**` 전체를 `variable_declaration`/`variable_modification`/`execution-context.md 원칙 5`/`__` 예약 prefix 키워드로 grep, `plan/complete/**` 에서 "강제하지 않기로" 결정 이력 유무, `git log -S` 로 "강제 갭" 문구 도입 커밋 추적, 저장소의 breaking-change 절차(CHANGELOG/마이그레이션 규정) 존재 여부, 신규 plan 문서 필요성을 확인했다.

## 발견사항

- **[WARNING]** 선행 plan 이 확립 중인 "저장 시점 검증 게이트" 대안이 draft 에서 검토되지 않음
  - target 위치: draft `## ⚠ breaking 성격` 섹션(`reserved-prefix-draft.md:23-30`) — "저장 시점에는 게이트가 없다"를 유일한 사실로 전제하고 execution-time throw 를 그대로 수용
  - 관련 plan: `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` (전체, 특히 배경 단락 `:10-18`)
  - 상세: 이 in-progress plan(2026-07-09 시작, 아직 미완료)은 정확히 같은 클래스의 문제 — "노드 config 검증이 실행 시점(`handler.validate` pre-flight)에서만 걸려 저장 당시엔 잘못된 config 가 조용히 통과한다" — 를 다루며, `WorkflowsService.validateManualTrigger()`(`codebase/backend/src/modules/workflows/workflows.service.ts:586-620`, 특히 rationale 주석 `:603-610`: "Without this gate an invalid slot… persists silently; at runtime it then either strips every parameter's default… or fails the run… Blocking here surfaces the precise per-field error immediately, on save")가 이미 이 문제의 해법으로 저장 경로(`saveCanvas`, `POST /:id/save`)에 전용 ad-hoc 게이트를 추가한 선례를 문서화하는 중이다. `evaluateGraphWarnings`(같은 파일 `:571-584`)도 저장 시점에 cross-node `graphWarningRules` 를 평가해 `severity='error'` 시 저장 자체를 막는 별도 generic 게이트다. 즉 이 저장소는 "실행 시점에만 걸리는 breaking 검증"을 accept-risk 로 두기보다 **저장 시점 게이트 추가**로 해소해온 전례가 있다. draft 의 Rationale (`:29-30`, "조용한 데이터 손실보다 명시적 실패가 낫다")은 (a) 아무 검증 없음 vs (b) execution-time throw 두 옵션만 비교하며, (c) manual-trigger 선례와 같은 저장 시점 게이트 추가라는 제3의 옵션은 언급조차 없다.
  - 제안: draft 의 spec Rationale(`execution-context.md` 원칙 5 갱신분)에 이 선례를 검토했는지, 왜 execution-time-only 를 택했는지(예: 두 노드는 manual-trigger 처럼 "그래프에 항상 정확히 1개" 같은 그래프 불변식이 아니라 자유 배치 노드라 저장 시점 개입 비용이 더 크다는 등) 명시하거나, 대안으로 `saveCanvas` 에 두 노드 전용 저장 시점 게이트를 함께 추가하는 방향을 고려. 최소한 spec 문서에 "왜 저장 시점 게이트를 도입하지 않았는지"를 근거로 남겨야 후속 감사에서 동일 질문이 반복되지 않는다.

- **[WARNING]** CHANGELOG.md "Breaking changes" 관례 미반영
  - target 위치: draft 전체 — CHANGELOG.md 갱신 계획이 어디에도 없음
  - 관련 plan: 해당 없음(plan 파일이 아니라 저장소 관례) — `CHANGELOG.md:240-252`("Code 노드 isolated-vm 전환 후속" — `$helpers.base64.encode/decode` 비문자열 입력이 이제 `error` 포트로 분기, "영향받는 워크플로우"/"조치" 섹션 포함), `CHANGELOG.md:193-201`(model-config `:id/test` Viewer 차단)
  - 상세: 본 저장소는 "기존에 조용히 수용되던 입력/동작이 이제 거부·실패한다"는 성격의 변경마다 `CHANGELOG.md` 에 `### Breaking changes` 서브섹션을 달아 영향 범위와 필요 조치를 명시하는 관례를 반복 확립했다(`git grep -n "^### Breaking changes"` 5건). `$helpers.base64.encode/decode` 케이스는 이번 변경과 형태가 거의 동일하다 — "이전엔 통과하던 입력이 이제 에러가 된다 + 영향받는 워크플로우/조치 안내". 이 관례를 강제하는 CI 게이트나 `.claude/docs`/`spec/conventions` 명문 규정은 없었다(검색 결과 없음) — `documentation-reviewer` sub-agent(`/ai-review`)가 CHANGELOG 필요성을 advisory 로 지적하는 정도. 하지만 draft 는 spec/code 변경만 나열하고 CHANGELOG 갱신을 아예 계획하지 않아, ai-review 문서 관점에서 재차 지적될 가능성이 높다.
  - 제안: draft 변경 목록에 `CHANGELOG.md` "### Breaking changes" 항목 추가(영향받는 워크플로우: `__` prefix 변수를 쓰던 Variable Declaration/Modification 노드, 조치: 변수명 rename) — base64 케이스와 동일 포맷으로.

- **[WARNING]** `node-output-redesign` 클러스터 서브 plan 문서 라인 인용 stale화 누락
  - target 위치: 변경 대상 함수 — `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts:83-101`(`validateVariableDeclarationConfig`, 새 else-if 삽입 지점 `:88-98` 루프 내부), `codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts:111-144`(`validateVariableModificationConfig`, 루프 `:127-141`)
  - 관련 plan: `plan/in-progress/node-output-redesign/variable-declaration.md:89`("`warningRules` (`variable-declaration.schema.ts:117-128`) 가…"), `:111`("`executionMetadata.kind: 'standard'` (`schema.ts:110`) 일치") / `plan/in-progress/node-output-redesign/variable-modification.md:103`("`warningRules` (`schema.ts:162-173`) 의…")
  - 상세: draft 가 두 `validateConfig` 함수 루프 안에 `else if` 분기(각 3~5줄)를 추가하면, 그 뒤에 오는 `warningRules`/`executionMetadata` 라인 인용이 전부 밀린다. 이 클러스터는 이미 "6차 갱신"(`node-output-redesign/README.md:3`, `variable-declaration.md:3`, `variable-modification.md:3`)에서 "파일:라인 인용이 대거 stale 해진 것을 전수 현행화"를 반복해온 문서군으로, 라인 드리프트가 반복적으로 발생해온 알려진 실패 패턴이다. 두 서브 문서는 `plan-lifecycle.md §4` 상 하위 그룹 폴더 부속 문서로 top-level frontmatter(`worktree:`) 면제 대상이라 push gate 가 자동으로 갱신을 강제하지 않는다 — 즉 사람이 챙기지 않으면 그대로 stale 상태로 남는다.
  - 제안: 두 서브 문서에 이번 PR 이 추가한 else-if 분기와 그로 인한 하위 라인 번호 이동을 반영하는 짧은 "N차 갱신" 블록(기존 클러스터 관례와 동일 포맷)을 추가하거나, 최소한 새 reject 분기 존재를 한 줄 언급.

- **[INFO]** 신규 최상위 `plan/in-progress/` 문서는 불요 — 이미 선행 리뷰 WARNING 을 직접 이행으로 해소
  - target 위치: draft 전체
  - 상세: PR #889(`d2b4590a2`, 2026-07-10)의 consistency-check 산출물(`review/consistency/2026/07/10/10_56_04/plan_coherence.md`)이 "강제 갭 하드닝을 추적하는 `plan/in-progress/` 항목이 없다"를 WARNING 으로 지적하며 두 선택지 — (a) stub plan 신설, (b) 문구를 accepted-risk 톤으로 완화 — 를 제안했다. 본 draft 는 그중 어느 쪽도 아닌 **제3의 경로(즉시 완결 구현)**로 그 WARNING 을 해소한다 — spec+code+test 가 한 PR 안에서 원자적으로 끝나므로 `plan-lifecycle.md §2`("미해결 follow-up 이 남아있으면 in-progress")기준 미완료 항목이 남지 않는다. 이는 두 선택지보다 나은 해소이며 별도 검토 지연 없이 진행 가능. 다만 위 두 WARNING(서브 plan 문서 라인 갱신 + CHANGELOG)은 "원자적 완결"의 조건을 채우기 위해 같은 PR 안에서 처리하는 편이 안전하다.
  - 제안: (해결 방향 없음 — 확인용 메모) 신규 frontmatter 스키마 설계 불요.

## 미충돌 확인 (참고)

- `plan/in-progress/node-output-redesign/workflow.md:172`(`context.variables.__workspaceId` cross-workspace 격리 검증 전달)는 원칙 5 의 `__workspaceId` 선례와 일관 — 이번 변경(사용자 변수 `__` 거부)과 무관, 시스템 주입 키는 handler 내부에서 직접 설정되므로 스키마 reject 대상이 아니다(사용자 config 의 `varDefSchema.name`/`modDefSchema.variable` 만 검사).
- `plan/in-progress/node-output-redesign/carousel.md:5`(`__item_` schema-level reject 선례)는 이미 구현 완료로 기록돼 있어 draft 가 인용하는 선례와 대조 시 충돌 없음.
- `plan/complete/**` 어디에도 "`__` 예약 강제를 하지 않기로" 결정한 기록은 없다. "강제 갭" 문구의 최초 도입처는 `git log -S"강제 갭"` 결과 단일 커밋 `d2b4590a2`(#889, 2026-07-10)뿐이며, 그 커밋 메시지 자체가 "스키마 가드 하드닝은 별도 task"라고 명시해 본 draft 를 정확히 예견한 forward-looking 서술이다 — 번복이 아니라 예정된 후속.
- `plan/in-progress/execution-engine-residual-gaps.md`, `exec-intake-followups.md`, `spec-sync-*-gaps.md` 계열, `parallel-p2-followups.md`, `merge-p2-async-fanin.md` 는 `variable`/`__`/`reserved` 키워드 매칭 0건 — 충돌 없음.
- `spec/conventions/execution-context.md`, `spec/4-nodes/1-logic/4-variable-declaration.md`, `spec/4-nodes/1-logic/5-variable-modification.md` frontmatter 에 `pending_plans:` 없음(모두 `status: implemented`) — draft 의 spec 편집이 걸어야 할 선행 미해소 plan 없음.

## 요약

Draft 는 PR #889 가 명시적으로 예견한 "강제 갭" 후속 하드닝을 그대로 이행하며, `plan/in-progress`·`plan/complete` 어디와도 "미해결 결정 우회"나 "번복" 충돌은 없다(Q1·Q2 결과 CRITICAL 없음). 다만 세 가지 정합성 갭이 있다: (1) 같은 클래스 문제(저장 시점엔 안 걸리고 실행 시점에만 실패)를 이미 저장 시점 게이트로 해소해온 선례(`spec-update-manual-trigger-save-time-error-code.md` + `validateManualTrigger`)를 draft 가 검토하지 않고 execution-time-only accept-risk 로 단정, (2) 저장소가 이런 성격 변경마다 반복해온 CHANGELOG "Breaking changes" 관례 미반영, (3) 변경 지점과 같은 함수 안에 라인 인용을 가진 `node-output-redesign` 서브 plan 두 문서가 즉시 stale 화되는데 draft 가 갱신을 계획하지 않음. 신규 최상위 plan 문서 자체는 불요 — 이 PR 이 원자적으로 완결되면 선행 WARNING 이 해소된다. Critical 급 결정 우회는 없음.

## 위험도

MEDIUM

STATUS: DONE
