STATUS=success plan_coherence review complete — 0 CRITICAL, 3 WARNING

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 의 "처방 후보" 결정이 이미 커밋에서
  내려졌는데 plan 체크리스트가 갱신되지 않았다
  - target 위치: (spec/5-system 자체엔 diff 없음 — 실질 target 은 `origin/main...HEAD` diff 의
    `codebase/backend/src/modules/websocket/websocket.service.ts` `stripExternalOnlyFields`/
    `stripDeep`, 커밋 `81f2c60d6`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"🔴 조사 중 발견"
    → "### 다음 (별건)" (130~137행) + 하단 "## 체크리스트" (150~155행)
  - 상세: plan 은 `turnDebug.llmCalls` 외부 누출에 대한 처방을 **미해결 결정**으로
    남겨 두며 "처방 후보: (a) `stripExternalOnlyFields` 를 깊이 우선으로 (b) waiting emit 이
    `turnDebug` 를 외부용에서 빼기 (c) 최상위 필드명을 strip 목록에 추가. **(a) 는 비용이
    크고 (c) 는 이름 충돌을 고착**시키므로 (b) 가 유력" 이라고 적었다. 그런데 같은
    worktree 의 후속 커밋(`81f2c60d6` `fix(security): 외부 fanout 의 llmCalls strip 이
    depth-1 이라 raw 프롬프트가 새고 있었다`, 이미 HEAD)은 정확히 **(a)** 를 채택해
    `stripDeep`(clone-on-write, depth-agnostic 삭제)으로 구현·병합했다. 커밋 메시지 자체엔
    "(a) 의 비용 우려는 clone-on-write 로 공통 경로 할당 0 을 테스트로 확인해 해소했고,
    이름은 문서화된 비밀 마커라 위치가 아니라 이름으로 막는 편이 새 중첩 위치에도
    자동 방어된다" 는 재반박 논거가 있어 결정 자체는 합리적이다. 문제는 **plan 문서가
    이 반전을 전혀 반영하지 않은 채**(체크박스 3개 전부 `[ ]`) 그대로 남아 있다는 점이다.
    이 plan 을 나중에 읽는 사람(다음 세션의 다른 developer/planner)은 "처방이 아직
    미정" 이라고 오인해 이미 끝난 조사·구현을 다시 하거나, 이미 기각된 (b) 를 다시
    검토할 위험이 있다 (memory 교훈 `feedback_stale_plan_claims_and_checklist_sync` 와
    동일 패턴).
  - 제안: `spec-draft-eia-62-waiting-payload.md` 의 "다음 (별건)" 체크리스트를 갱신 —
    "실증 테스트" 항목은 커밋에 포함된 `websocket.service.spec.ts` 프로브로 완료 표시,
    "처방 후보" 항목은 "**(a) 채택·커밋 `81f2c60d6`** — clone-on-write 로 비용 우려 해소"
    로 정정해 체크. 마지막 항목("이름 충돌 정리")만 실제 미해결이므로 아래 두 번째
    발견사항과 함께 별도로 남길 것.

- **[WARNING]** "이 처방과 함께 정리" 하기로 한 이름 충돌(`turnDebug`)이 실제로는
  분리됐는데 그 분리가 plan 에 기록되지 않았다
  - target 위치: (동일 diff, `websocket.service.ts` — 이름 충돌 자체는 코드에 아직 존재)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 137행
    "이름 충돌(`turnDebug` top-level vs `nodeOutput.meta.turnDebug`)은 이 처방과 함께
    정리" / 원 출처 `review/consistency/2026/08/14/09_38_17/naming_collision.md`
    CRITICAL "`turnDebug` — 같은 이벤트 payload 안에서 두 자리가 서로 다른 shape 으로
    공존한다"
  - 상세: plan 은 leak 처방과 이름 충돌 정리를 "함께" 하겠다고 명시했다. 그러나 실제로
    landed 된 커밋(`81f2c60d6`)은 strip 로직만 고쳤고, `ai-turn-orchestrator.service.ts:615`
    가 같은 emit 안에서 top-level `turnDebug`(단일 객체)와 `nodeOutput.meta.turnDebug`
    (배열, WS §4.4 표의 정본 필드)를 동시에 싣는 구조 자체는 그대로다. "함께" 라는
    계획된 동시 처리가 실제로는 분리됐는데, plan 에는 분리 사유나 잔여 항목이 기록되지
    않아 09_38_17 이 낸 CRITICAL 이 아직 열려 있다는 사실이 이 plan 파일만 봐서는
    드러나지 않는다. 특히 spec-draft 의 "변경 제안 (1)"(§6.2 예시를 실측 shape 으로
    재작성)이 나중에 집행될 때 top-level `turnDebug` 필드명을 그대로 §6.2 예시에
    박아 넣으면 09_38_17 CRITICAL 이 spec 본문에 그대로 고착된다.
  - 제안: "다음 (별건)" 섹션에 "이름 충돌 정리는 leak-fix 커밋(`81f2c60d6`)에 포함되지
    않았고 별도로 남아 있다" 는 메모를 추가하고, "변경 제안 (1)" 실행 시 top-level
    필드명을 `turnDebugSnapshot` 등으로 rename(09_38_17 제안 (a))할 것을 체크리스트
    항목으로 명시할 것.

- **[WARNING]** `eia-terminal-payload.md` 의 "다른 plan 과의 관계" 절이 자신을 막고 있는
  바로 그 planner 작업(plan)을 누락했다
  - target 위치: (spec/5-system diff 없음 — plan 간 교차 참조 문제)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` "## 다른 plan 과의 관계
    (W4·W6 — 교차 참조 없이 등재했었다)" (1817~1828행) vs
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  - 상세: `eia-terminal-payload.md` 는 `--impl-prep 07_44_12` 가 낸 CRITICAL
    ("§6.2 webhook 예시가 봉투 규칙을 어긴다")로 **BLOCK: YES** 상태이고, 체크리스트의
    다음 단계로 "planner 턴 — §6.2 봉투 + data-model §2.14 + §6.2 URL + `error.code`
    옵셔널" 을 명시한다. 이는 바로 `spec-draft-eia-62-waiting-payload.md` 의 "변경 제안
    (1)(4)(5)" 와 정확히 같은 작업이다(같은 날 owner: project-planner 로 착수됨). 그런데
    "다른 plan 과의 관계" 절 — 스스로 "교차 참조 없이 등재했었다" 는 과거 결함을
    의식해 만든 절 — 은 `spec-sync-external-interaction-api-gaps.md` ·
    `spec-draft-eia-notification-payload-contract.md` ·
    `backend-lint-gate-broken-on-main.md` 세 plan 만 열거하고, 자신을 실제로 막고
    있는 `spec-draft-eia-62-waiting-payload.md` 는 빠져 있다(이 plan 이 `eia-terminal-
    payload.md` 커밋 이후에 생겨서 당시엔 존재하지 않았을 수 있으나, 이후에도 갱신되지
    않았다). 이 상태로는 `eia-terminal-payload.md` 를 다시 여는 사람이 "planner 턴이
    이미 draft 로 진행 중" 이라는 사실을 놓치고 중복 조사를 하거나, `spec-draft-eia-62-
    waiting-payload.md` 가 완료돼도 `eia-terminal-payload.md` 의 차단 해제 절차를
    안 밟을 위험이 있다.
  - 제안: `eia-terminal-payload.md` "다른 plan 과의 관계" 절에
    `spec-draft-eia-62-waiting-payload.md` 를 "차단 해제 조건(정본 planner draft)"으로
    추가하고, 체크리스트 "planner 턴" 항목에 이 draft 파일 경로를 링크할 것.

### 요약

CRITICAL 은 없다 — 실제로 landed 된 코드 변경(`81f2c60d6`, `stripExternalOnlyFields`
depth-agnostic 화)은 WS spec §4.4:519 의 "모든 외부 수신자에서 strip 된다" 는 기존 선언을
**어기는 것이 아니라 오히려 참으로 만드는** 방향이라 spec 과 충돌하지 않고, 채택된 옵션
(a)에 대한 근거도 커밋 메시지에 합리적으로 남아 있다. 다만 이 작업은 같은 세션에서 동시에
진행 중인 세 plan(`spec-draft-eia-62-waiting-payload.md`, `eia-terminal-payload.md`, 그리고
이들의 근거가 된 `09_38_17` 리뷰)의 문서 상태와 어긋난다 — plan 이 "미해결" 로 남겨 둔
결정이 실제로는 이미 내려져 커밋됐는데 체크리스트가 그 사실을 반영하지 않고, "함께
정리" 하기로 한 부속 항목(이름 충돌)은 실제로는 분리됐는데 그 분리가 기록되지 않았으며,
차단 상태인 plan 이 자신을 풀어 줄 바로 그 후속 plan 을 교차 참조 목록에서 빠뜨리고 있다.
셋 다 "plan 체크박스 = 실제 상태" 원칙 위반이자, 다음 세션이 같은 조사를 반복하거나
이미 기각된 대안을 재검토하게 만들 위험이 있는 stale-plan 패턴이다.

### 위험도

MEDIUM
