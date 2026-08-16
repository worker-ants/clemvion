# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base origin/main)

## 검토 방법

`origin/main...HEAD` 의 실제 diff 는 `spec/5-system/{14-external-interaction-api.md,
6-websocket-protocol.md}` 2건(38+/6-)뿐이며, 이는 `plan/in-progress/eia-internal-rest-error-masking.md`
(신규 plan, 이번 diff 에 포함)가 집행하는 결정과 정확히 대응한다. 프롬프트 번들의 plan 섹션이
컨텍스트 예산으로 다수 절단돼 있어, 해당 plan 및 그 정본 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`), 그리고 연관 가능성이 있는 다른
in-progress plan 은 저장소에서 절대경로로 직접 `Read`/`git diff`/`git grep` 해 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

- **[INFO]** `pending_plans:` frontmatter 방향이 문서 정의와 다르게 쓰이지만 기존 선례를 따른다
  - target 위치: `plan/in-progress/eia-internal-rest-error-masking.md` frontmatter
    `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`
  - 관련 plan: `.claude/docs/plan-lifecycle.md §4` — plan 레벨 `pending_plans` 는 "이 plan 이
    착수·완료하기 위해 **먼저 닫혀야 하는** 선행/의존 plan"으로 정의된다(plan→plan, 방향:
    이 plan 이 그 plan 을 기다림). 그런데 `spec-sync-external-interaction-api-gaps.md` 는 계속
    누적되는 "정본 트래커"이고, 이 plan 은 그 트래커의 **항목(I1·D) 하나를 집행**하는
    자식 작업이라 실제로는 트래커가 먼저 닫히길 기다리는 관계가 아니다(트래커는 이 plan
    완료 후에도 잔여 3항목 — workflow-assistant 마스킹·WS `execution.node.*` emit·
    `inputData`/`outputData` — 이 열린 채로 남는다).
  - 상세: 다만 이 용법은 이번 target 이 처음 도입한 것이 아니다 — 동일 패턴이 이미
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md`(`pending_plans:` 로
    같은 정본 트래커 2건을 가리킴)에 선례가 있고, `.claude/docs/plan-lifecycle.md` 자신도
    "plan 레벨엔 build guard 없음 · 완료 판정에 쓰이지 않는 순서 힌트"라고 명시해 실질적
    피해(자동 게이트 오탐)는 없다.
  - 제안: 정정 불요(선례를 따른 것이고 가드 영향 없음). 다음에 이 패턴을 문서화할 기회가
    있으면 `.claude/docs/plan-lifecycle.md §4` 표에 "정본 트래커 → 집행 자식 plan" 도 plan
    레벨 용법의 세 번째 사례로 추가하는 것을 고려할 수 있다(선택 사항, 이번 PR 범위 아님).

## 정합성 확인 사항 (근거)

- `eia-internal-rest-error-masking.md` 는 정본 트래커의 미결 항목 **I1**·**D** 를 "사용자가
  2026-08-16 택일"로 명시 집행한다고 선언하고, 트래커(`spec-sync-external-interaction-api-gaps.md`)
  쪽도 같은 diff 안에서 두 체크박스를 `[ ]` → `[x]` 로 갱신하며 결정 내용·근거(집행 plan
  링크)를 동일하게 적었다 — **미해결 결정을 일방적으로 우회하지 않았다** (오히려 직전 세션이
  "근거 없이 한쪽으로 닫으려다 `--spec` CRITICAL 을 맞았다"는 이력을 plan 자신이 기록하고,
  이번엔 사용자 결정을 명시적으로 받아 재집행했다).
- 트래커에 새로 등재된 3개 잔여 항목(workflow-assistant `maskSensitiveFields` 약한 마스킹 ·
  WS `execution.node.*` emit 원문 · `inputData`/`outputData` 원문)은 **별도 체크박스로
  분리**되어 `[ ]` 로 남아 있고, I1/D 의 `[x]` 와 섞여 "완료"로 오독되지 않게 처리했다
  (plan 자신이 "한 체크박스로 묶이면 조용히 완료로 읽힌다"는 반복 실패 형태를 인지하고
  명시적으로 분리했다고 기록).
- 실제 committed diff(`spec/5-system/14-external-interaction-api.md` §R17 불릿 교체,
  `6-websocket-protocol.md` `execution.snapshot` 행 캐비엇 추가)는 plan 의 "## spec 초안"
  절 ①·ⓔ 원문과 문장 단위로 일치한다. plan 이 자체 `--spec` 라운드(`16_32_42` BLOCK:YES,
  CRITICAL 2 — 폐기된 함수명 잔존·`NodeExecution.error` 범위판정 오류)에서 지적받은 결함도
  committed 텍스트에 반영돼 있다(예: 옛 함수명 `redactExecutionErrorValue` 는 최종 diff
  어디에도 남아 있지 않고 `redactStoredErrorForResponse` 로 일관).
- `spec_impact` 로 함께 갱신돼야 하는 자매 문서 3건(`spec/2-navigation/14-execution-history.md`
  R-5 대상범위 캐비엇, `spec/4-nodes/1-logic/12-background.md` §8.2 마스킹 교차참조,
  `spec/conventions/secret-store.md` §1 비대상 예외)도 plan frontmatter `spec_impact` 목록과
  실제 diff 파일 목록이 정확히 일치한다(review scope 는 `spec/5-system/` 뿐이라 이 3건은
  참고 확인만 했다).
- 이 diff 가 건드리는 `Execution.error` 서술이 다른 활성 plan(`eia-terminal-payload.md`,
  `spec-draft-eia-62-waiting-payload.md`)에도 등장하지만, 그쪽은 **구조**(`nodeId` nullable
  등) 논의로 이번 **마스킹/노출** 결정과 다른 축이라 충돌하지 않는다.
- `spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md` 의 frontmatter
  `pending_plans`(spec 레벨)는 각각 여전히 대응하는 정본 트래커를 가리키고 있고, 이번
  narrow-scope 집행 plan 이 그 트래커를 조기에 "닫힌 것"으로 잘못 표시하지 않았다 — 트래커의
  잔여 항목이 실재하므로 `status: partial` 유지가 맞다.

## 요약

Target(`spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md`)의 실제
변경분은 신규 plan `eia-internal-rest-error-masking.md` 가 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)의 미결 항목 I1·D 를 사용자 결정에 따라
명시적으로 집행한 결과이며, 두 plan 문서가 같은 diff 안에서 상호 정합하게 갱신됐다. 새로
발견된 잔여(3건)는 트래커에 별도 체크박스로 분리 등재돼 조용히 묻히지 않았고, 자매 spec
문서(`spec_impact`)·frontmatter `pending_plans`(spec/plan 양쪽)도 실제 diff·상태와 어긋남이
없다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 관점에서도 CRITICAL/WARNING 급
발견사항이 없다.

## 위험도

NONE
