# 정식 규약 준수 검토 — `plan/in-progress/spec-update-pr2a-timeout.md`

검토 모드: `--spec` (spec draft)
검토 기준: `spec/conventions/**`, `CLAUDE.md`, `.claude/docs/plan-lifecycle.md`, `.claude/skills/project-planner/SKILL.md`

---

## 발견사항

### [WARNING] plan 파일 명명이 project-planner SKILL 권장 패턴과 다름
- target 위치: 파일명 `plan/in-progress/spec-update-pr2a-timeout.md`
- 위반 규약: `.claude/skills/project-planner/SKILL.md §작업 워크플로` step 3 — `plan/in-progress/spec-draft-<name>.md` 를 권장 패턴으로 명시
- 상세: 동 worktree 의 선행 유사 문서(`spec-update-execution-context-options-bag.md`)도 `spec-update-` prefix 를 사용하고 있어 팀 내 관행으로 굳어진 것으로 보인다. 그러나 SKILL.md 가 명시한 표준 prefix 는 `spec-draft-` 다. `spec-update-` prefix 가 관행으로 정착됐다면 SKILL.md 자체를 갱신하는 것이 적절하다.
- 제안: 현재 draft 를 `plan/in-progress/spec-draft-exec-timeout-pr2a.md` 로 rename 하거나, `spec-update-` prefix 를 허용하도록 SKILL.md 를 갱신 (후자 권장 — 이미 동 worktree 에 선례가 있으므로).

---

### [WARNING] plan draft 에 `## Rationale` 섹션 없음
- target 위치: 문서 전체 구조 (분류 / 원본 발견사항 / 제안 변경 / 적용 우선순위 / 관련 파일)
- 위반 규약: `.claude/skills/project-planner/SKILL.md §작업 워크플로` step 3 — "본문 끝에 `## Rationale` 로 결정 근거 명시"
- 상세: plan draft 는 `spec-draft-<name>.md` 패턴의 문서로서 본문 끝에 `## Rationale` 섹션을 두어 spec 변경 결정의 배경·근거를 기술하게 되어 있다. 대상 문서는 "분류" 항에 SPEC-DRIFT 근거를 간략히 언급하지만 별도 Rationale 섹션이 없다. 선행 문서 `spec-update-execution-context-options-bag.md` 도 동일하게 Rationale 섹션을 생략하고 있어 이 패턴이 관행화된 것으로 보이나, SKILL.md 규약 상 위반이다.
- 제안: 문서 끝에 `## Rationale` 섹션을 추가하고 "PR2a 가 구현한 timeout 이 spec 보다 앞서 나간 SPEC-DRIFT 임을 확인한 근거, per-workflow 설정을 2단계로 분리한 이유" 등을 기술. 또는 SKILL.md 에 "SPEC-DRIFT 분류 plan 은 분류 항의 SPEC-DRIFT 설명으로 Rationale 을 대체 가능" 예외를 명시.

---

### [INFO] `execution-run` 큐 삽입 위치 표기가 알파벳 순서와 불일치
- target 위치: 제안 변경 §2 (BullMQ 큐 카탈로그 After 텍스트)
- 위반 규약: 직접 위반 규약 없음 — 단순 형식 일관성 제안
- 상세: After 목록에서 `execution-continuation` 뒤에 `execution-run` 을 배치했으나, 알파벳 순서로는 `execution-continuation` < `execution-run` 순서가 맞다. 실제 Before 텍스트의 큐 목록도 알파벳 순서를 따르고 있다. §4 표의 After 는 "첫 행에 추가" 라고 명시되어 있어 표 내부의 삽입 위치 기준이 불명확하다.
- 제안: After 텍스트에서 `execution-run` 을 `execution-continuation` 앞으로 이동해 알파벳 순서(`execution-continuation` → 현재 목록에서는 `execution-run` 이 뒤에 와야 하므로 `execution-continuation`, `execution-run` 순서 유지가 맞음 — 알파벳 기준 `c < r`). §4 표의 "첫 행에 추가" 기준도 알파벳 순 또는 큐 도입 순으로 명확히 기술할 것.

---

### [INFO] 오류 코드 추가 제안이 `spec/conventions/error-codes.md` historical-artifact 레지스트리 갱신을 언급하지 않음
- target 위치: 제안 변경 §3 (`EXECUTION_TIME_LIMIT_EXCEEDED` 추가)
- 위반 규약: `spec/conventions/error-codes.md §3` — historical-artifact 예외 레지스트리는 명명 원칙을 따르지 않는 기존 코드 등록용이지만, 신규 코드 추가 시 §1·§2 원칙 준수를 확인해야 함
- 상세: `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `UPPER_SNAKE_CASE` 형식과 `error-codes.md §1` 의 의미 기반 명명 원칙을 모두 준수한다. 기존 `EXECUTION_TIMEOUT` 과 의미를 분리하는 신규 코드를 신설하는 방식(§2 안정성 정책 준수)이므로 규약 위반은 없다. 단, spec 제안 변경에 "기존 `EXECUTION_TIMEOUT` 과의 의미 분리 근거"(`§3-error-handling §1.4` 참조를 인라인 기술로만 처리) 를 draft 본문에 명시적으로 연결하면 추후 리뷰어가 error-codes.md §1 준수 여부를 더 쉽게 검증할 수 있다.
- 제안: 제안 변경 §3 또는 Rationale 섹션에 "신규 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `error-codes.md §1·§2` 준수 확인 — 의미 분리 신설, rename 아님" 한 줄 추가.

---

### [INFO] `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 갱신 불필요 여부 확인 불가
- target 위치: 제안 변경 §3 적용 후
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 인 spec 은 `pending_plans:` 의무
- 상세: `spec/5-system/14-external-interaction-api.md` 가 `status: partial` 인 경우 `pending_plans:` 에 본 plan 을 등록해야 하는지 draft 에 언급이 없다. 해당 spec 의 현재 frontmatter status 를 draft 에서 확인하지 않으면 `spec-pending-plan-existence.test.ts` 가드가 silent miss 할 수 있다.
- 제안: 적용 전 대상 spec 파일들(`spec/5-system/14-external-interaction-api.md`, `spec/data-flow/0-overview.md`)의 frontmatter `status` 를 확인하고, `partial` 이면 `pending_plans:` 에 본 plan 경로 추가 여부를 draft 에 명시.

---

## 요약

`plan/in-progress/spec-update-pr2a-timeout.md` 는 정식 규약의 핵심 구조(SPEC-DRIFT 분류, 원본 발견사항, Before/After 변경 제안, 우선순위, 관련 파일)를 충실히 갖추고 있다. plan frontmatter(`worktree`, `started`, `owner`)는 `.claude/docs/plan-lifecycle.md §4` 스키마를 완전히 준수한다. 에러 코드 명명(`EXECUTION_TIME_LIMIT_EXCEEDED`)은 `spec/conventions/error-codes.md §1·§2` 의미 기반 명명 원칙을 준수한다. 주요 지적사항은 (1) 파일명 prefix가 SKILL.md 권장 `spec-draft-` 와 다르고, (2) SKILL.md 가 명시하는 `## Rationale` 섹션이 없다는 두 가지 WARNING 이다. 두 사항 모두 동 worktree의 선행 문서에서도 동일 패턴이 확인되므로 관행화된 것으로 보이며, 허용하려면 SKILL.md 를 갱신하는 것이 적절하다.

## 위험도

LOW
