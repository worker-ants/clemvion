# 문서화(Documentation) Review — 재검토 (fresh re-review, commit `6e08fe425` on `d8ce7693f`)

대상: `variables.__*` 예약 네임스페이스 3계층 강제. 직전 라운드(`review/code/2026/07/11/00_59_29`)가 낸
Warning 3건(W1/W2/W3, 문서 카테고리)의 fix 반영 여부 + KO/EN 신규 유저 노트 정확성/상호 일관성 검증.

## 검증 방법

각 항목을 diff 만이 아니라 **현재 워킹트리 파일 상태**를 직접 Read/grep 해 확인했다 (라인 번호까지 실측).

## 발견사항 — 직전 Warning 3건 fix 검증

- **[확인됨 — WARNING 해소]** `execution-context.md:65` dangling "강제 갭" forward-reference
  - 위치: `spec/conventions/execution-context.md:65`
  - 상세: 현재 65행은 "...사용자 변수는 `__` 를 쓸 수 없다(강제 방식은 아래 **"강제 (3계층)"** 참조)." 로 정정되어 있고, 실제 해당 절 제목도 `:70` 에서 `- **강제 (3계층)**:` 로 정확히 일치한다. `grep -rn "강제 갭" spec/ plan/ codebase/ CHANGELOG.md` 결과 이 문서·이 PR 관련 파일에는 0건 — 유일한 잔여 hit 은 `plan/complete/security-fixes-audit-guard-secret-rotation.md:23` 로 완전히 무관한 주제(감사 로그 Admin 강제 갭)의 기존 문구다. dangling reference 완전 해소.

- **[확인됨 — WARNING 해소]** 두 노드 spec §5 preamble의 "config 검증 실패는 pre-flight throw" 단정이 §6 신설 L2 런타임 throw와 모순되던 문제
  - 위치: `spec/4-nodes/1-logic/4-variable-declaration.md:95`, `spec/4-nodes/1-logic/5-variable-modification.md:101`
  - 상세: 두 줄 모두 현재 "검증 실패는 §6 참조 — 대부분 pre-flight throw 이나, 예약 `__` 이름의 런타임 해석 후 검사(§6 L2)만은 실행 중 throw 된다."로 §6 과 정합하게 정정됐다. §6 도입부도 각각 "**runtime** 에러 포트를 갖지 않는다 / 모든 검증 실패는 pre-flight"에서 "**에러 포트를 갖지 않는다**(runtime 형용사 제거). 대부분의 검증 실패는 pre-flight... 단 하나의 예외가 예약 이름의 런타임 검사다"로 정정되어 §5/§6 간 내부 모순이 사라졌다. `grep "runtime 에러 포트를 갖지 않는다" spec/` 결과에 이 두 파일은 더 이상 나타나지 않음(다른 12개 미관련 노드 spec 은 원래 문구 그대로 유지 — 정상, 이 PR 범위 밖).

- **[확인됨 — WARNING 해소]** `plan/in-progress/node-output-redesign/{variable-declaration,variable-modification}.md` 의 stale 라인 인용
  - 위치: 두 파일 헤더에 "7차 갱신 (2026-07-11, ...)" 블록 신설
  - 상세: 인용된 모든 라인 번호를 실제 코드에서 재확인했다 — variable-declaration: `varDefSchema`:11(실측 11 일치), `variableDeclarationNodeConfigSchema`:57(일치), `validateVariableDeclarationConfig`:87(일치), `executionMetadata.kind`:118(일치), `warningRules`:125(일치), `validate`:28(일치), `execute`:43(async, 일치). variable-modification: `variableModificationNodeConfigSchema`:65(일치), `validateVariableModificationConfig`:115(일치), `warningRules`:170(일치), `execute`:67(async, 일치). 전부 정확 — stale 참조가 정확한 값으로 정정되었고 §8/§7 잔여 항목(coercionWarnings 테스트, recordValues echo)도 "이 PR 과 무관"으로 올바르게 경계 지어짐.

## 발견사항 — 신규 KO/EN 유저 가이드 노트

- **[확인됨 — 정확·상호 일관]** `logic.mdx`(KO) / `logic.en.mdx`(EN) 의 `__` 제약 노트
  - 위치: `logic.mdx:275,304`, `logic.en.mdx:264,293` — 두 파일 모두 FieldTable 직후·Example 직전, Variable Declaration/Modification 두 섹션에 각각 1줄씩.
  - 내용 검증: Declaration 노트(KO "변수 이름은 `__`(밑줄 두 개)로 시작할 수 없어요 — 시스템이 예약한 이름이라, 저장하거나 실행할 때 에러가 나요." / EN "...fails on save or at run time.")는 실제 L0(저장 시점 400)·L2(런타임 throw) 이원 강제와 정확히 일치한다. Modification 노트(KO "대상 변수 이름은 `__`(밑줄 두 개)로 시작할 수 없어요 — 시스템 예약 이름이에요." / EN "...that prefix is reserved for the system.")도 사실관계에 오류 없음. KO↔EN 은 각 섹션별로 문장 구조·정보량이 1:1 대응 — mutual consistency 문제 없음.
  - 배치도 두 파일에서 완전히 대칭(같은 상대 위치, FieldTable 다음 줄).

- **[INFO]** 같은 파일 내부에서 Declaration 노트와 Modification 노트의 정보량이 비대칭 — KO/EN 자체는 일관되지만 두 섹션 간 상세도가 다름
  - 위치: `logic.mdx:275` vs `:304`, `logic.en.mdx:264` vs `:293`
  - 상세: Declaration 쪽 노트는 "저장하거나 실행할 때 에러가 나요"(fails on save or at run time)까지 명시하는데, Modification 쪽은 "시스템 예약 이름이에요"(reserved for the system)까지만 쓰고 실패 시점 언급이 빠졌다. 두 노드가 공유하는 동일한 3계층 강제(L0/L1/L2)이므로 실패 시점 문구도 대칭으로 맞추는 편이 사용자에게 더 유용하다. KO/EN 상호 불일치는 아니고(양쪽 다 동일하게 비대칭) 사실 오류도 아니라 INFO.
  - 제안: Modification 노트에도 "저장하거나 실행할 때 에러가 나요" / "fails on save or at run time" 을 덧붙여 두 섹션 표현을 통일.

## 확인됨 (기타, 문제 없음)

- `isReservedVariableName` (util) 에 이전 라운드 INFO 로 지적된 누락 JSDoc 이 "세 계층 공통 술어 — ..." 한 줄로 추가되어 형제 export 들과 문서화 수준이 맞춰졌다.
- `reserved-variable-name.util.ts` 소비처(2×`*.schema.ts`, 2×`*.handler.ts`, `workflows.service.ts`)의 인라인 L0/L1/L2 주석은 spec 문서 용어(L0/L1/L2, 강제 실질 지점)와 정확히 일치해 추적성이 좋다.
- `skipParamSchemaValidation` → `skipLegacyDataGates` 리네임은 `saveCanvas`/`restoreVersion` 경로에 전부 반영되어 잔여 stale 참조 없음(`validateManualTrigger` 내부의 동명이인 파라미터는 의도적으로 별도 스코프로 유지되며 혼동 소지 없음).

## 확인됨 (이전 라운드 INFO — 이번 fix 범위 밖, 여전히 미반영이나 non-blocking)

- **[INFO, 재확인 — 미반영]** "§variable-declaration §6" 서식 오류(§ 중복)는 이번 fix 커밋에서도 그대로 남아 있다 (`CHANGELOG.md:8`, `spec/conventions/execution-context.md:111`). 직전 라운드에서 INFO 로만 분류되어 RESOLUTION 의 fix 대상(W1~W3, 문서 3건)에 포함되지 않았던 항목이라 예상된 결과이며, 기술적 정확성에는 영향 없음 — 이번 재검토에서 강등/차단 사유 아님.

## 요약

이번 fresh re-review 대상인 3건의 WARNING(execution-context.md dangling 참조, 두 노드 spec §5/§6 내부 모순, node-output-redesign 서브 plan 의 stale 라인 인용)은 모두 실제 파일 상태를 직접 읽고 실측 라인 번호까지 대조해 정확히 반영되었음을 확인했다. `grep "강제 갭"` / `grep "pre-flight throw"` / `grep "runtime 에러 포트를 갖지 않는다"` 로 저장소 전체를 훑어도 이 PR 관련 파일에 옛 표현이 남아있지 않다(다른 무관 노드 spec 의 기존 문구는 그대로— 정상). 신규 KO/EN 유저 가이드 노트(`logic.mdx`/`logic.en.mdx`)도 사실관계가 정확하고 두 언어 간 완전히 대칭적으로 배치·표현되어 상호 일관성 문제가 없다. 유일한 잔여 지적은 같은 파일 안에서 Declaration/Modification 두 노트의 상세도가 비대칭하다는 INFO 수준 개선 여지와, 이전 라운드에서 이미 non-blocking INFO 로 defer 됐던 "§variable-declaration §6" 서식 오타가 (예상대로) 그대로 남아있다는 점뿐이다. Critical/Warning 급 결함 없음.

## 위험도

NONE

STATUS: DONE
