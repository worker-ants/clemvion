### 발견사항

- **[INFO]** `node-config-required-defaults-sweep.md` 의 "switch mode 확장 가이드" follow-up 항목과의 연동 상태
  - target 위치: `plan/in-progress/requiredwhen-dsl-whitelist.md` §작업 항목 마지막 체크박스 — "본 sweep plan 후속 follow-up 'switch mode 확장 가이드' → 'requiredwhen-dsl-whitelist 로 분리 + 해소' 마킹" [x]
  - 관련 plan: `plan/in-progress/node-config-required-defaults-sweep.md` §후속 follow-up 마지막 두 줄 — `~~switch mode 확장 가이드~~` 취소선 처리 여부
  - 상세: target plan 의 [x] 항목은 sweep plan 에 분리 해소 마킹을 했다고 선언한다. 실제로 `node-config-required-defaults-sweep.md:92` 에는 취소선 없이 "consistency-check I-4." 로 끝나는 원본 텍스트가 남아 있다. 다만 이는 본 worktree(`requiredwhen-dsl-whitelist`) 에서의 sweep plan 복사본이 아직 갱신 전인 상태일 수 있으며, PR merge 시 main 브랜치에서 충돌 없이 정합화될 예정이다. 현재 단계(PR 머지 전)에서는 두 plan 간 기술된 상태가 미세하게 다를 수 있다.
  - 제안: PR merge 직전 sweep plan 의 해당 항목에 취소선 또는 "→ requiredwhen-dsl-whitelist 로 분리 해소" 주석이 명시되어 있는지 확인. 없으면 동일 PR 내 chore commit 으로 갱신.

- **[INFO]** `node-output-redesign/switch.md` 의 gap A (configEcho hasDefault/strictComparison 누락) 와 target 변경의 관계
  - target 위치: `plan/in-progress/requiredwhen-dsl-whitelist.md` §작업 항목 — `switch.schema.ts:85` 마이그레이션 (`notEquals: 'expression'` → `equals: ['value']`)
  - 관련 plan: `plan/in-progress/node-output-redesign/switch.md` §종합 개선안 — `[ ] (impl) switch.handler.ts:86-90 configEcho 에 hasDefault/strictComparison 추가`
  - 상세: target 변경은 `switch.schema.ts:85` 의 `switchValue.requiredWhen` 만 수정하며, `configEcho`(`:86-90`) 에는 손대지 않는다고 선언했다. `node-output-redesign/switch.md` 의 gap A 항목은 `:86-90` configEcho 에 `hasDefault` / `strictComparison` 를 추가하는 것인데, 두 변경이 `switch.schema.ts` 의 인접 라인(`:85` vs `:86-90`)을 각각 독립적으로 수정하는 구조라 병합 시 충돌은 없다. 그러나 `node-output-redesign/switch.md` 의 gap A 가 여전히 미해소 항목(`[ ]`)이고, 해당 작업이 어느 worktree 에 배정되었는지 frontmatter 기록이 없다.
  - 제안: `node-output-redesign/switch.md` 의 gap A/B 항목은 별 plan/worktree 가 필요하다는 점을 README 나 해당 파일에 명시하거나, 해당 항목을 별 plan 으로 분리 추적. 현재 `node-output-redesign/` 폴더 내 파일들은 frontmatter 없이 운영되고 있어 worktree 추적이 불가능한 상태 — INFO 수준.

- **[INFO]** `send-email-to-array-only` worktree 의 sweep plan 복사본에 `notEquals: 'expression'` 기술이 잔존
  - target 위치: `plan/in-progress/requiredwhen-dsl-whitelist.md` §배경 — `switch.schema.ts:85` 의 `notEquals` 를 `equals: ['value']` 로 마이그레이션 완료 [x]
  - 관련 plan: `send-email-to-array-only` worktree 의 `plan/in-progress/node-config-required-defaults-sweep.md:51` — `switch | switchValue | ui.requiredWhen: { field: 'mode', notEquals: 'expression' }` 원본 텍스트 유지
  - 상세: `send-email-to-array-only` worktree 는 자체적인 plan 복사본을 보유하며, 해당 복사본의 Commit 2 표가 아직 `notEquals: 'expression'` 으로 기술되어 있다. 이는 각 worktree 가 main 의 스냅샷을 fork 한 시점의 내용이라 예상된 상태다. `send-email-to-array-only` PR 이 merge 될 때 main 의 최신 sweep plan (requiredwhen-dsl-whitelist PR merge 후 갱신된)을 기준으로 재정렬되므로 실제 충돌은 없다. 다만 merge 순서가 반전될 경우 `node-config-required-defaults-sweep.md` 의 해당 행 표현이 혼재될 수 있다.
  - 제안: `send-email-to-array-only` PR merge 는 `requiredwhen-dsl-whitelist` PR merge 이후 또는 동시 진행 시 merge 순서 확인 권장. 이미 "병행 PR: B `send-email-to-array-only` (#199)" 로 명시되어 있어 사용자 인지 상태.

### 요약

target plan `requiredwhen-dsl-whitelist.md` 는 `node-config-required-defaults-sweep.md` 의 후속 follow-up 으로 명시적으로 분리된 작업이며, 사용자 결정이 "결정 필요" 상태를 거쳐 확정된 이후 일방적 결정이 아니라 합의된 방향을 구현한다. 병행 활성 worktree(`loop-count-policy`, `send-email-to-array-only`, `button-cap-spec-validator`) 와 수정 파일 영역이 분리되어 있다 — `node-component.interface.ts` 타입 갱신, `visibility.ts` `matches()` 분리, `switch.schema.ts:85` DSL 마이그레이션, `spec/4-nodes/1-logic/2-switch.md` Rationale 신설이 target 의 핵심이며 다른 활성 plan 이 동일 파일·영역을 동시 수정하는 증거는 없다. 발견사항은 모두 INFO 수준의 추적 메모로, CRITICAL / WARNING 에 해당하는 미해결 결정 우회, 동시 worktree 충돌, 선행 plan 미해소는 없다.

### 위험도

NONE
