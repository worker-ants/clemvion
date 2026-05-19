# Plan 정합성 검토 결과

대상: `plan/in-progress/send-email-to-array-only.md`
검토 모드: plan draft (--plan)

---

### 발견사항

- **[WARNING]** `node-output-redesign/send-email.md` 가 sum-type 전제로 작성되어 있고 target 변경 후 갱신이 필요함
  - target 위치: `send-email-to-array-only.md` — "작업 항목" 전체 (validator/handler/spec/output schema 변경)
  - 관련 plan: `plan/in-progress/node-output-redesign/send-email.md`
    - 65번 행: `config.*` (raw echo) 설명에서 "to/cc/bcc 의 **string/array 원형 보존**" 이라 명시
    - 145번 행: `validateSendEmailConfig 의 recipient **sum-type**` 이 spec §5.8 와 정합한다고 명시
    - 161번 행: handler spec 테스트 목록에 "to 의 **string**/array/expression/empty array/empty string 케이스" 나열
    - 177번 행: `normalizeRecipients: 배열 / **comma-string** 모두 trim+빈문자 제거` 를 spec §4 step 2 와 정합으로 기록
  - 상세: `node-output-redesign/send-email.md` 의 구현 분석(§6, §7) 은 sum-type(string|string[]) 이 정상 동작임을 전제로 spec ↔ 구현 정합성을 "OK" 판정한다. target 변경이 완료되면 이 분석 기록은 실제 코드와 달라져 오독을 유발한다. 특히 "Principle 7 — to/cc/bcc 의 string/array 원형 보존" 설명과 "normalizeRecipients: 배열 / comma-string" 기술이 array-only 이후의 동작을 잘못 서술하게 된다.
  - 제안: target PR merge 후 `node-output-redesign/send-email.md` 의 해당 행들을 갱신한다. 구체적으로 65번 행의 "string/array 원형 보존" → "array 원형 보존 (array-only, §8.1)", 145번 행의 "recipient sum-type" → "recipient array-only", 161번 행의 "to 의 string/..." 열거에서 string raw 케이스 제거, 177번 행의 "comma-string" 경로 제거. 본 send-email-to-array-only plan 의 작업 항목에 `node-output-redesign/send-email.md` 갱신을 추가하거나, 별도 후속 항목으로 명시하는 것이 권장.

- **[WARNING]** `node-config-required-defaults-sweep.md` 의 main branch 버전이 아직 갱신되지 않음 (B 항목 분리 마킹 미반영)
  - target 위치: `send-email-to-array-only.md` 작업 항목 `[x]` — "본 sweep plan `node-config-required-defaults-sweep.md` 후속 follow-up 섹션에서 B 항목을 '→ send-email-to-array-only 로 분리' 로 마킹"
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` (main branch 기준)
    - 84번 행: "send-email.to zod ↔ validator 정준화 — zod 는 array 전용 / validator 는 string 도 허용. 단일 string `to` 로 저장된 기존 workflow 영향 (DB 조사) 후 한쪽으로 통일." 이 원문 그대로 남아 있음. "→ send-email-to-array-only 로 분리" 마킹 없음.
  - 상세: target 의 작업 항목 55번이 `[x]` (완료)로 표시되어 있으나, 실제 main branch 의 `node-config-required-defaults-sweep.md` 에는 해당 마킹이 아직 없다. send-email-to-array-only worktree 로컬 복사본에만 반영되어 있는 상태다. sweep plan 의 PR merge 이전에 target PR 이 merge 되면, sweep plan 의 후속 항목에 여전히 "정준화" 가 미해결로 남아있어 혼란을 유발할 수 있다.
  - 제안: send-email-to-array-only PR merge 시 sweep plan 의 해당 행을 함께 갱신하여 "→ send-email-to-array-only 로 분리 + 완료" 로 표시하거나, target PR commit 중 하나에 sweep plan 갱신을 포함할 것.

- **[INFO]** `loop-count-policy` plan 이 PR #192 대기 중이고 target 이 같은 sweep plan 후속으로 병렬 진행됨 — worktree 경합 없음
  - target 위치: `send-email-to-array-only.md` "관련 문서" 섹션 — "관련 plan (병행 진행): `loop-count-policy` (PR #192, 머지 대기)"
  - 관련 plan: `plan/in-progress/loop-count-policy.md` (worktree: `loop-count-policy`)
  - 상세: loop-count-policy 는 `spec/4-nodes/1-logic/3-loop.md` 를 손대고, send-email-to-array-only 는 `spec/4-nodes/4-integration/3-send-email.md` 를 손댄다. 파일 경합 없음. 단, 두 plan 모두 sweep plan 의 후속 항목에서 분리되었으므로 sweep plan 의 최종 상태(완료 여부)는 두 PR 가 모두 merge 된 후에 결정된다. loop-count-policy 가 이미 PR #192 로 올라간 상태라면, sweep plan 의 `plan/complete/` 이동 타이밍을 조율해야 한다.
  - 제안: loop-count-policy PR #192 merge 후 sweep plan 의 잔여 항목을 확인하고, send-email-to-array-only PR merge 완료 시점에 sweep plan 이 모든 항목 `[x]` 가 되면 함께 `git mv` 처리할 것.

- **[INFO]** `node-config-required-defaults-sweep.md` 의 PR push / ai-review / consistency-check 체크박스가 미완료 상태이며, target 이 그 하위 후속임
  - target 위치: `send-email-to-array-only.md` "배경" — "node-config-required-defaults-sweep PR (#188) 의 후속 follow-up"
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` 75–77번 행 (`[ ] PR 본문 작성 + push`, `[ ] /ai-review + /consistency-check`, `[ ] PR merge`)
  - 상세: 부모 sweep plan 의 PR (#188)이 아직 merge 되지 않은 상태에서 후속 plan 이 별도 PR 로 진행됨. target 의 spec 변경(`spec/4-nodes/4-integration/3-send-email.md`)은 sweep plan PR 에서 sweep plan이 손댄 동일 파일에 해당한다. 단, target 은 spec 갱신을 포함하므로, sweep plan PR 과 target PR 이 동시에 같은 spec 파일을 건드리면 merge 시 충돌 가능성이 있다.
  - 제안: sweep plan PR (#188) 과 send-email-to-array-only PR 의 spec 변경 범위(`3-send-email.md` 내 어느 섹션인지)를 확인하고, 직접 충돌이 예상되면 직렬화 처리. 현 target plan 의 `[x]` 항목들이 이미 worktree 내에서 완성된 상태임을 고려할 때, sweep plan PR merge 이전이라도 분리된 파일 섹션이면 실용적으로 병렬 처리 가능.

---

### 요약

target plan(`send-email-to-array-only`)은 미해결 결정 우회나 심각한 worktree 충돌 없이 독립적으로 진행 가능한 상태다. 사용자의 명시적 결정(② validator array-only 정준화 + 마이그레이션 skip)을 기반으로 작업 범위가 명확하게 정의되어 있다. 다만 두 가지 후속 갱신이 누락되어 있어 WARNING 등급으로 처리했다. 첫째, `node-output-redesign/send-email.md` 가 sum-type 전제의 구현 분석을 보유하고 있어 target 완료 후 해당 문서를 array-only 기준으로 갱신해야 한다. 둘째, `node-config-required-defaults-sweep.md` 의 main branch 판이 아직 B 항목 분리 마킹을 반영하지 않아 두 plan 이 동시에 미해결 상태로 공존한다. 이 두 사안은 코드 충돌이 아닌 문서 정합성 문제이며, target PR merge 시 함께 처리하면 해소된다.

### 위험도

LOW
