# Consistency Check SUMMARY — `--spec` (task_7f283553, `variables.__*` 예약 prefix 강제)

- **일시**: 2026-07-11 00:03:30
- **모드**: `--spec` + `--impl-prep` 겸용 (spec+code 원자 PR 예정이었음)
- **base**: `origin/main` @ `cc3dafa8c`
- **checker**: 5종 직접 Agent fan-out

## BLOCK: YES

**Critical 1건 — spec 쓰기·구현 착수 차단.** 초안 설계(`schema-level reject` 단독)가 **강제 수단으로 불충분**함이
코드로 실증됐다. 설계를 고치기 전에는 진행하지 않는다.

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| cross-spec | **1** | 1 | 1 |
| rationale-continuity | 0 | 1 | 3 |
| convention-compliance | 0 | 2 | 0 |
| plan-coherence | 0 | 3 | 0 |
| naming-collision | 0 | 0 | 4 |

---

## Critical — schema-level reject 는 `{{ }}` 표현식으로 우회된다

**초안 전제**: "Variable Declaration/Modification 의 `validateConfig` 에서 `__` 이름을 거부하면 예약이 강제된다."

**반증 (main 이 독립 재현)**:

1. `handler.validate(node.config)` 는 **원본 config**(표현식 미해석)에 대해 실행된다
   (`execution-engine.service.ts:5278` — `node.config` 를 그대로 전달).
2. `variable_declaration` / `variable_modification` 은
   `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts` 의
   `EXPRESSION_EXCLUSIONS` 에 **등재돼 있지 않다** → 두 노드의 config 문자열 필드는 실행 직전
   `{{ }}` 표현식으로 재평가된다 (`spec/.../5-expression-language.md §8.3.3` 이 "모든 config 문자열 필드는
   표현식 대상" 이라 명문화).
3. `execute()` 는 **해석된** name 을 아무 가드 없이 그대로 쓴다:
   `variable-declaration.handler.ts:61` → `context.variables[variable.name] = coerced`.

**결과**: `name: "{{ $input.dynamicName }}"` 로 저장하면 pre-flight 검증을 통과하고, 런타임에 그 값이
`__workspaceId` 로 평가되면 **시스템 키를 덮어쓴다**. 초안의 가드를 100% 우회한다.

→ 초안대로 spec 에 "**강제**(schema-level reject)" 라 쓰면 **사실과 다른 보안/정합성 주장**이 된다.

## 필요한 설계 수정 (최소 2계층)

| 계층 | 위치 | 잡는 것 | 성격 |
| --- | --- | --- | --- |
| L1 pre-flight (raw) | `validateVariableDeclarationConfig` / `validateVariableModificationConfig` | 리터럴 `__foo` | 조기 실패·의도 문서화 |
| **L2 runtime (resolved)** | 두 노드의 `handler.execute()` — 해석된 name 검사 후 throw | `{{ }}` 로 만들어진 `__foo` | **실질 강제 지점** |

L2 없이는 강제가 성립하지 않는다. spec §6 의 "runtime 에러 포트 없음 / 모든 검증 실패는 pre-flight throw"
서술도 L2 도입에 맞춰 재작성이 필요하다(런타임 검증이 새로 생기므로).

**추가 검토 대상 (plan-coherence W1)**: 저장 시점 게이트 선례가 이미 있다 —
`WorkflowsService.validateManualTrigger`(`codebase/backend/src/modules/workflows/workflows.service.ts:586-621`)
가 정확히 같은 클래스의 문제("저장은 통과, 실행 시 pre-flight throw")를 저장 시점 구조 검증으로 해소했고,
`plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 가 그 기록이다.
L0(저장 시점) 게이트를 추가하면 breaking 성격이 크게 완화된다(사용자가 저장 시 즉시 알게 됨).

---

## Warning

### W1 (cross-spec) — 초안의 "잔여 유입 경로" 예시가 사실과 다름
Merge 노드는 `context.variables` 를 **읽지도 쓰지도 않는다**(`merge.handler.ts`). `merge.handler.ts:177` 의
`blockedKeys`(`__proto__`/`constructor`/`prototype`)는 `merge_object` **출력 값 내부의 object key** 필터로,
변수 이름 네임스페이스와 **다른 계층**이다(naming-collision 도 동일 결론).

실제 `context.variables` **쓰기 지점은 3곳**: variable-declaration · variable-modification ·
**Code 노드**(`code.handler.ts:464,476` — `$vars` 전체를 atomic replace, 필터링 없음).
→ Code 노드가 세 번째 우회 경로다. spec 은 "두(또는 세) 노드 한정 강제" 임을 정직하게 써야 한다.

### W2 (rationale-continuity) — "명시적 실패 > 조용한 손실" 근거가 기존 결정과 표면상 충돌
`spec/4-nodes/1-logic/4-variable-declaration.md` §6 은 **silent skip / silent fallback 을 의도적으로 채택**했다.
실제 구분은 "**관찰 가능한 silent**"(`meta.skipped` / `meta.coercionWarnings` 로 노출) vs
"**관찰 불가능한 opaque silent**"(park-filter drop — `execution-engine.service.ts:7554-7561` `filterUserVariables`
에 로그·meta 노출이 전혀 없음)다. 새 `## Rationale` 이 이 구분을 명시하지 않으면 정합성 의문을 남긴다.

### W3 (convention-compliance) — `doc-sync-matrix` 트리거 검토 미언급
`PROJECT.md:120` `node-schema-change` 행 + `.claude/config/doc-sync-matrix.json` 의 glob
(`codebase/backend/src/nodes/**`) 이 이번 변경에 **기계적으로 매치**된다. carousel `__item_` 선례가 유저 가이드
미문서화라 결론은 "갱신 불요" 로 보이나, **검토했다는 사실**을 명시해야 한다.

### W4 (plan-coherence) — CHANGELOG "Breaking changes" 관례 미반영
저장소는 유사 성격 변경(`$helpers.base64.encode/decode` 비문자열 입력 거부, `CHANGELOG.md:240-252`)마다
`Breaking changes` 섹션을 달아왔다. 초안 계획엔 없다.

### W5 (plan-coherence) — `node-output-redesign` 서브 plan 의 라인 인용 stale 화
`plan/in-progress/node-output-redesign/variable-declaration.md:89,111` ·
`variable-modification.md:103` 가 인용하는 `warningRules`/`executionMetadata` 라인 번호가
코드 삽입으로 밀린다. 갱신 계획 필요.

---

## Info (조치 불요 / 확인됨)

- **원칙 5 "강제 갭" 은 결정 번복이 아니다**: 도입 커밋 `d2b4590a2`(PR #889) 메시지가
  "스키마 가드 하드닝은 별도 task" 라 명시 → 본 작업은 예고된 후속. (rationale-continuity)
- **carousel `__item_` 선례 인용은 정당** — 원칙 5 자신이 참조점으로 지정. 단 동기가 다르므로
  (파싱 안전 vs 네임스페이스 보호) 새 Rationale 에 독자 근거 병기 권고.
- **i18n 의무 없음 확인**: `backend-labels.test.ts:29-34` parity guard 가 `validateConfig` imperative 반환을
  명시적으로 미커버 대상이라 선언. 기존 형제 메시지도 `WARNING_KO` 미등재. (convention)
- **spec-impl-evidence 갱신 불요**: 두 spec frontmatter `code:` glob 이 이미 `.schema.ts` 를 매치. (convention)
- **`_foo`(단일 underscore) 는 특별 취급 0건** — `filterUserVariables` 는 `__` 만 검사. 원칙 4 는
  `ExecutionContext` **top-level** 전용이라 스코프가 겹치지 않는다. (naming-collision)
- **시스템 주입 키 4종**(`__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun`) 목록 정확. (cross-spec)
- **저장 경로에 handler.validate 게이트 없음**·**park 필터가 `__*` drop** — 초안 서술 사실 확인. (cross-spec)
- 신규 검증 메시지 2개는 저장소 내 유일 문자열, 표 행 중복 없음. (naming-collision)
- 신규 최상위 `plan/in-progress/` 문서는 불요 (원자적 완결 PR). (plan-coherence)

---

## 결론

**차단.** 초안은 "schema-level reject = 강제" 라는 **틀린 전제** 위에 서 있었고, 그대로 진행했다면
spec 에 사실과 다른 강제 주장을 심을 뻔했다. gate 가 의도대로 작동했다.

진행 전 필요한 것:
1. L2(runtime, resolved name) 가드를 포함한 설계 확정 — 그리고 L0(저장 시점) 게이트 채택 여부 결정.
2. Code 노드(`$vars` atomic replace) 우회 경로를 강제 범위에 넣을지 결정.
3. 위 결정에 따라 §6(에러 코드) 서술·breaking 범위·CHANGELOG 항목 재작성.

**사용자 결정 필요** — 범위가 chip 이 기술한 것보다 실질적으로 크다.
