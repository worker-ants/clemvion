# Plan 정합성 검토 — spec-draft-eia-notification-payload-contract.md

## 조사 범위

- Target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (spec draft, `--spec` 모드)
- 대조: `plan/in-progress/**` 전체 번들(예산 초과로 다수 파일 절단됨 — 절단분은 필요 시 원본을
  직접 `Read`). 특히 target 이 명시 참조하는 `retry-turn-terminal-guard.md`,
  `pending_plans:` 의 `spec-sync-external-interaction-api-gaps.md` /
  `spec-sync-websocket-protocol-gaps.md`, `node-output-redesign/README.md:372`,
  `eia-context-schema-followups.md`, `spec-update-node-cancellation-shutdown-classification.md`,
  `execution-engine-residual-gaps.md`, 동일 worktree 의 `spec-draft-eia-r8-alignment.md` 를
  원본에서 직접 확인.

## 발견사항

- **[WARNING]** `cancelledBy`/`error` 의 기존 행동 계약(닫힌 union 값 · `error.code` 매핑)이
  "필드 열거 축약" 과정에서 함께 삭제될 위험 — 아직 열려 있는 `retry-turn-terminal-guard.md`
  #2 가 그 계약에 의존한다
  - target 위치: `## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터` (1) 표의
    `result.cancelledBy`/`error` 행, (2) "WS §4.1 ... **필드 열거를 버리고** ... 두 줄로",
    (3) `chat-channel-adapter.md §1.2 → 참조로 축약`
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` §"5차 라운드 이후 위생 정리"
    코드 표 **#2**(아직 `[ ]`, P2) — "`EXECUTION_CANCELLED` payload 에 spec §4.1 필수
    `cancelledBy` 추가", 근거 인용: "spec §4.1 이 `'user'|'system'|'timeout'` **닫힌 union**
    을 필수로 요구하는데 `failRetryExecution` 의 payload 는 `{status}` 뿐이다"(5R W1)
  - 상세: 현재 `spec/5-system/6-websocket-protocol.md` §4.1 `execution.cancelled` 행과
    `spec/5-system/14-external-interaction-api.md` §6.5 는 단순 필드 이름 나열이 아니라
    **행동 계약**을 담고 있다 — `cancelledBy='system'|'timeout'` 일 때 동반되는 `error.code`
    가 `RESUME_*`(§7.5 rehydration 실패) / `EXECUTION_QUEUE_WAIT_TIMEOUT`(§8) /
    `WEBCHAT_IDLE_TIMEOUT`(EIA-RL-07) 중 무엇인지, 일반 user cancel 은 `error` 가
    **부재**해야 한다는 것, 그리고 "닫힌 3값 union 은 확장하지 않는다" 는 명시 제약까지
    포함한다. `chat-channel-adapter.md` §1.2 의 `execution.cancelled` variant 타입 정의에도
    같은 계약이 JSDoc 으로 동봉돼 있다(단 이건 §3 렌더 매핑 표에 중복 존재해 §1.2 만 지워도
    안전 — 이 부분은 target 설계가 맞다).
    target 의 (1) 표는 이 행을 "구현됨(경로 1곳 누락) / `cancelled` 한정" 으로만 요약하고,
    체크리스트 "WS §4.1 종결 3행 → 필드 열거 제거, 참조 + flat 봉투 2줄" 지시는 이 행동
    계약까지 "필드 열거" 로 뭉뚱그려 함께 삭제할 위험을 내포한다. 실제로 실행 시 EIA §6.5·
    WS §4.1 **양쪽 다** 축약 대상이라, 이 디테일을 (1) 도입부로 명시 이관하지 않으면 spec
    어디에도 안 남는다. 이 draft 자신의 "왜" 절이 기록한 3회 반려 사유("같은 규칙을 일부
    절에만 적용")와 **반대 방향의 동형 실패**("행동 계약을 필드 열거와 함께 삭제")가 재발할
    조건이 갖춰져 있다. `retry-turn-terminal-guard.md` #2 는 아직 미완료라 이 계약을 근거로
    `cancelledBy`/`error.code` 값을 결정해야 하는데, 이관이 누락되면 그 구현의 spec 근거가
    사라진다.
  - 제안: 체크리스트 "EIA §6 도입부 신설(필드 집합 + 봉투)" 항목에 "`cancelledBy` 의 닫힌
    union 값과 `error.code` 매핑(`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/
    `WEBCHAT_IDLE_TIMEOUT`), user-cancel 시 `error` 부재 규칙을 §6.5 → (1) 도입부로 그대로
    이관"을 명시적으로 추가하고, WS §4.1·EIA §6.5 축약을 실행할 때 diff 로 이 문장들이
    어디로 이동했는지 확인하는 항목을 체크리스트에 넣을 것 (target 또는 실행 시점 developer/
    planner 턴 갱신).

- **[INFO]** `cancelledBy` 닫힌 union 이 아직 열려 있는 별개 결정(SIGTERM/workflow-timeout
  node-abort 분류)의 영향권에 있다는 사실이 target 에 언급되지 않음
  - target 위치: 동일 (1) 표 `result.cancelledBy` 행 + 후속 목록
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    `## 결정이 필요하다 (택일)` — (a)/(b) 둘 다 미체크, `spec_impact` 에
    `spec/5-system/6-websocket-protocol.md` 포함
  - 상세: 그 plan 이 (b)(SIGTERM/workflow-timeout 유발 노드 abort 를 `failed` 대신
    `cancelled` 로 재분류)를 채택하면 `cancelledBy` 에 새 원인
    (`EXECUTION_TIME_LIMIT_EXCEEDED`/`SERVER_INTERRUPTED` 계열)이 추가될 가능성이 있는데,
    이는 EIA §6.5 가 이미 선언한 "닫힌 3값 union 은 확장하지 않는다" 전제와 부딪힌다.
    target 은 이 전제를 그대로 새 §6 도입부의 단일 SoT 로 승격시키면서 그 잠재 충돌을
    인지·기록하지 않는다. target 이 이 미해결 결정을 우회하거나 선점하는 것은 아니다(입장을
    취하지 않음) — 다만 도입부를 "유일한 규범 필드 집합" 으로 명명하는 순간 그 문서가 향후
    (b) 채택 시 가장 먼저 갱신돼야 할 자리가 된다는 연결고리가 후속 항목에 없어, 나중에
    (b) 가 결정될 때 이 자리를 다시 놓칠 여지가 있다.
  - 제안: target 후속 목록에 "spec-update-node-cancellation-shutdown-classification.md
    (a)/(b) 결정이 (b) 로 나면 §6 도입부의 `cancelledBy` 닫힌 union 을 갱신할 것" 한 줄
    포인터만 추가.

## 확인했으나 문제 없음 (근거로 남김)

- `retry-turn-terminal-guard.md` #2(cancelledBy 미해소)를 target 후속으로 소유권 위임한 것은
  정확 — 그 plan 의 코드 표 #2 는 실제로 아직 `[ ]`(미완료)이고, target 의 인용
  ("`failRetryExecution` L956 은 emit 안 함")과 그 plan 의 실측이 일치한다.
- `pending_plans:` frontmatter(`spec-sync-external-interaction-api-gaps.md`,
  `spec-sync-websocket-protocol-gaps.md`)는 target 이 건드리는 두 spec(`14-external-
  interaction-api.md`, `6-websocket-protocol.md`)의 **기존 frontmatter `pending_plans`
  를 그대로 미러**한 것 — 두 gaps 파일 본문에 종결 이벤트 payload 관련 미해결 항목은 없어
  직접 충돌은 없다.
- `node-output-redesign/README.md:372` 의 "EIA §6.3 cross-ref 재검증" 은 target 이 이미
  자기 후속 목록에 등재했고, 인용 내용도 정확하다(§6.3 이 참조하는 내용의 성격 변화).
  중복 발견이 아님.
- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제 결정은 다른 in-progress plan
  이 이 필드들의 존재를 전제하지 않아 충돌 없음(구현 0건, 어떤 소비자도 참조하지 않음).
- `chat-channel/types.ts` 를 SoT 아닌 구현체로 재확정하는 결정은 다른 plan 이 그 파일을
  SoT 로 취급하는 사례가 없어 충돌 없음.
- `EIA §6` 헤딩(6.1~6.6) 사이 실제로 빈 줄 1개만 있어 "번호 없는 도입부" 삽입이 재넘버링을
  유발하지 않는다는 target 의 실측 전제는 현재 spec 파일과 일치.
- `spec/3-workflow-editor/3-execution.md §8.1` 편집을 시도하는 다른 in-progress plan 없음
  (동시 편집 충돌 없음).
- `duration → durationMs` 전역 개명을 비목표/후속으로 defer 한 것은 다른 in-progress plan
  (`node-output-redesign/*`)의 `meta.durationMs`(노드별 output 메타)와 이름만 같을 뿐
  별개 네임스페이스라 충돌 아님.
- 같은 worktree 의 `spec-draft-eia-r8-alignment.md`(idempotency 캐시 대상 정합)는 이미
  체크리스트 전항목 완료 상태이고 주제(캐시 대상 vs payload 필드 계약)가 달라 target 과
  무관.

## 요약

target 은 3회 반려 이력을 근거로 "필드 집합 단일화(SoT 승격)" 전략을 택했고, 유일하게 실질
의존 관계가 있는 후속 plan(`retry-turn-terminal-guard.md` #2, 아직 미완료)을 정확히 인지·
연결하고 있어 **미해결 결정을 우회하는 지점은 없다**. 다만 이 draft 가 계획하는 "필드 열거
축약" 실행 범위가 `cancelledBy`/`error` 의 **행동 계약**(닫힌 union 값·`error.code` 매핑)까지
포함하는지 명시적으로 구분하지 않아, 실제 실행 시 그 디테일이 새 SoT(§6 도입부)로 이관되지
않고 조용히 소실될 위험이 있다 — 정확히 이 draft 가 스스로 경계한 "일부만 적용" 실패의 반대
방향 변주다. 이 점만 체크리스트에 한 줄 보강하면 다른 충돌·누락은 발견되지 않았다.

## 위험도

LOW
