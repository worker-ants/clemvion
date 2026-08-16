# 정식 규약 준수 검토 — `plan/in-progress/eia-internal-rest-error-masking.md`

검토 모드: spec draft 검토 (`--spec`). target 은 plan 문서이나 `## spec 초안` 절이 planner
턴에서 그대로 `spec/5-system/14-external-interaction-api.md` §R17 / `spec/conventions/secret-store.md`
§1 에 적용될 patch 텍스트이므로, 그 텍스트 자체를 정식 규약(명명·spec-impl 정합) 기준으로
검토했다. 대조 자료: `spec/conventions/secret-store.md`, `spec/conventions/spec-impl-evidence.md`,
`spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md`, `.claude/docs/plan-lifecycle.md`,
그리고 실제 코드(`codebase/backend/src/shared/utils/redact-stored-error.ts`,
`codebase/backend/src/modules/executions/executions.service.ts`).

## 발견사항

- **[CRITICAL] §R17 spec 초안이 이미 폐기된 함수명을 그대로 담고 있다**
  - target 위치: target 문서 `## spec 초안` → `### ① … §R17 — :1484 불릿 교체` 의 "교체안"
    블록, "`redactExecutionErrorValue`(`deepRedactSecrets` 위임, **형태 보존**)를…" 문장
    (target 파일 기준 두 번째 `redactExecutionErrorValue` 언급, 첫 번째는 `## 설계` 절에서
    이미 기각된 이름으로 인용됨)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` (spec 이 서술하는 구현 surface 는
    실제 코드와 정적으로 일치해야 한다는 본 컨벤션의 핵심 invariant) — 및 명명 규약 일반
    (spec 문서가 실존하지 않는 식별자를 SoT 로 등재하면 안 됨)
  - 상세: target 문서의 `## 설계` 절(§ "이름을 바꿨다")은 원래 이름 `redactExecutionErrorValue`
    가 예외 클래스 `ExecutionError`(`workflow-errors.ts:33`)를 온전한 부분 문자열로 포함해
    `16_03_57` naming W1 에서 지적받았고, 그래서 `redactStoredErrorForResponse` 로 교체했다고
    명시한다. 실제 구현(`codebase/backend/src/shared/utils/redact-stored-error.ts:57` —
    `export function redactStoredErrorForResponse(...)`, JSDoc 에 "초안의
    `redactExecutionErrorValue` 는 클래스명을 온전한 부분 문자열로 포함했다(`16_03_57`
    naming W1)"라는 주석까지 남겨 rename 근거를 스스로 기록)와 `## 조치` 체크리스트("[x]
    `redactStoredErrorForResponse` 추가")도 새 이름으로 일관된다. 그런데 planner 턴에서
    그대로 spec 에 patch 될 `## spec 초안 ①`의 "교체안" 텍스트만 옛 이름
    `redactExecutionErrorValue` 를 그대로 쓰고 있다. 이 상태로 적용되면
    `spec/5-system/14-external-interaction-api.md` §R17 이 **코드에 존재하지 않는 함수명**을
    정식 spec 텍스트로 등재하게 되고, W1 이 rename 으로 해소하려 했던 `ExecutionError` 부분
    문자열 충돌이 spec 문서 안에서 부활한다 — grep 기반 감사(이 저장소가 반복적으로 의존하는
    패턴, 예: secret-store.md 의 `secret://` prefix 검사·`비대상` 블록 감사)가 spec 텍스트를
    실제 심볼로 오인하게 만든다.
  - 제안: `## spec 초안 ①` 의 "교체안" 블록에서 `redactExecutionErrorValue` → 
    `redactStoredErrorForResponse` 로 정정한다. planner 턴이 이 텍스트를 그대로 복붙 적용할
    가능성이 높으므로, `--spec` 게이트를 통과하기 전에 이 자리를 반드시 고쳐야 한다.

- **[INFO] `## 설계` 절의 함수 시그니처가 실제 구현보다 좁다**
  - target 위치: `## 설계` 절, ` ```ts redactStoredErrorForResponse(err: Record<string,
    unknown> | null): Record<string, unknown> | null ``` ` 코드 블록
  - 위반 규약: 없음(설계 절은 spec 초안이 아니라 서술용) — 문서 정확성 제안
  - 상세: 실제 구현 시그니처는 `err: Record<string, unknown> | null | undefined` 로
    `| undefined` 를 추가로 받는다(`redact-stored-error.ts:57`, JSDoc 도 "입력이 없으면
    `null`" 로 undefined 케이스를 문서화). `## spec 초안`에는 이 시그니처가 그대로 옮겨지지
    않으므로 영향은 없지만, 설계 절 자체의 서술 정확도가 구현과 어긋난다.
  - 제안: `| undefined` 를 시그니처에 추가해 실제 구현과 맞춘다(선택).

- **[INFO] `14-external-interaction-api.md` frontmatter `code:` 가 이번 결정의 신규/변경
  파일을 아직 가리키지 않는다**
  - target 위치: target 문서 `## spec 초안 ①`이 patch 하는 대상 spec 파일의 frontmatter
    (`spec/5-system/14-external-interaction-api.md:6` 이하 `code:` 목록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한
    surface 의 구현 경로") — 단, R-1 이 이 종류의 완결성 갭을 하드 가드가 아니라
    `/spec-coverage` standing audit 소관으로 명시적으로 인정하므로 build 를 막는 위반은
    아니다
  - 상세: §R17 교체 불릿은 `codebase/backend/src/modules/executions/executions.service.ts`
    의 `findById`/`toExecutionDto`/`getChain`/`stop` 과 신규 파일
    `codebase/backend/src/shared/utils/redact-stored-error.ts` 를 구체적으로 지목하는데,
    현재 spec frontmatter `code:` 글로브에는 이 경로들이 없다(`external-interaction/**` 등
    기존 글로브만 있음). `spec-code-paths.test.ts` 는 "글로브 ≥1 매치"만 요구하므로 build 는
    통과하지만, spec 이 새로 서술하는 surface 의 evidence 완결성은 약해진다.
  - 제안: planner 턴에서 §R17 교체와 같은 커밋에 `code:` 에
    `codebase/backend/src/shared/utils/redact-stored-error.ts` 와
    `codebase/backend/src/modules/executions/executions.service.ts` 를 추가하는 것을 권장
    (필수는 아님).

- **[INFO] "정본 트래커 신규 잔여 2건 등재" 체크박스가 이미 실제로는 선등재돼 있다 (범위
  인접 — plan_coherence 소관일 수 있음)**
  - target 위치: target 문서 `## 조치` 마지막 두 미체크 항목 — "[ ] 정본 트래커 **신규 잔여
    2건 등재** (`NodeExecution.error` · `inputData`/`outputData`)"
  - 위반 규약: 직접적인 `spec/conventions/**` 위반은 아니고 `.claude/docs/plan-lifecycle.md`
    §5 "미해결 follow-up·TODO 항목이 0건인가"에 인접한 관찰
  - 상세: 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를
    확인하니 두 항목이 이미 각각 `:205`(`NodeExecution.error`)·`:212`
    (`inputData`/`outputData`)에 등재돼 있고, 첫 항목은 "`16_03_57` plan_coherence W1 이
    '선등재' 를 요구해 먼저 적는다"라는 문구로 target 문서 자신이 요구한 바로 그 선등재임을
    스스로 밝히고 있다. 즉 이 체크박스가 가리키는 작업은 이미 완료돼 있어 보이나 target 의
    체크리스트는 여전히 `[ ]` 다.
  - 제안: 실측을 재확인한 뒤(동일 세션/PR 안에서 먼저 등재됐는지) 이미 완료됐다면 `[x]` 로
    갱신한다. naming/output-format 범위를 벗어나므로 plan_coherence 검토 결과와 교차 확인
    권장.

## 확인했으나 위반 없음 (positive 확인)

- `secret-store.md §1` "비대상" 신설 블록(`## spec 초안 ②`)은 기존 `AuthConfig.config`
  비대상 블록과 동일한 `> **비대상 — \`X\`**: ...` 포맷을 유지하고, 독립 근거((a)~(c))를
  별도로 세워 "AuthConfig.config 문구 재사용 금지"라는 `16_03_57` W2 요구를 satisfy 한다 —
  포맷·명명 모두 정합.
- `Trigger.config.interaction.triggerToken` 명칭은 실제 코드
  (`triggers.service.ts:969`, `interaction.guard.ts:209-211`,
  `interaction-token.service.ts:24`)·기존 spec(`14-external-interaction-api.md:905,910,920`)
  과 정확히 일치한다.
- `toTerminalErrorPayload` 를 재사용하지 않고 값만 마스킹하는 설계는
  `spec/5-system/2-api-convention.md §5.3`의 "내부 구현 원문을 echo 하지 않는다(CWE-209)"
  원칙과 `swagger.md` 의 응답 wrapping/DTO 계약 불변 원칙에 부합하며, 응답 계약(wire shape)을
  임의로 바꾸지 않겠다는 명시적 결정이 규약과 정합한다.
- target 문서(plan) 자체의 frontmatter 는 `.claude/docs/plan-lifecycle.md §4` 3-필드
  스키마(`worktree`/`started`/`owner`)를 만족하고, `spec_impact` 는 실존 spec 경로 리스트로
  선언돼 있어 Gate C 형식 요건에도 부합한다(완료 시점 강제 대상은 아니지만 형식은 이미
  올바름). `pending_plans` 가 상위 트래커를 가리키는 용법도 동일 저장소의 다른 plan
  (`spec-draft-eia-notification-payload-contract.md`)과 동형 선례가 있다.
- `spec/5-system/14-external-interaction-api.md:910`·`:1484` 인용 라인 번호는 실측과
  정확히 일치한다(문서 인용 정확도 문제 없음).

## 요약

target plan 의 spec 초안 중 `secret-store.md` 쪽(② `interaction.triggerToken` 비대상 등재)은
명명·포맷 모두 기존 컨벤션과 정합하다. 반면 `14-external-interaction-api.md` §R17 교체안(①)에는
치명적인 잔재가 하나 있다 — 이 plan 자신이 `ExecutionError` 부분 문자열 충돌 때문에 폐기하고
`redactStoredErrorForResponse` 로 rename 했다고 명시적으로 기록한 옛 이름
`redactExecutionErrorValue` 가, 정작 planner 턴에서 spec 에 그대로 patch 될 텍스트 안에는
아직 남아 있다. `--spec` 게이트를 통과해 이 텍스트가 그대로 적용되면 spec 이 실재하지 않는
함수명을 SoT 로 등재하게 되므로, 반영 전 정정이 필요하다. 나머지는 완결성 제안(INFO) 수준이다.

## 위험도

MEDIUM
