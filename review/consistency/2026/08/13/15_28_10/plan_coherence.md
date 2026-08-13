# Plan 정합성 Check — `spec-draft-eia-notification-payload-contract.md`

## 발견사항

- **[INFO]** `retry-turn-terminal-guard.md W1` 참조가 그 문서 자체 규약과 어긋난다
  - target 위치: `## 무엇을 쓸 것인가 → 3. EIA §6.5 + WS §4.1` 및 `## 후속 (developer)` 마지막 항목
    ("`failRetryExecution` 의 `cancelledBy` 누락은 `retry-turn-terminal-guard.md` W1 에서 집행")
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md`
  - 상세: 내용 자체는 정확하다 — `retry-turn-terminal-guard.md` 는 "5R W1(api_contract) —
    `EXECUTION_CANCELLED` payload 에 `cancelledBy` 누락" 항목(체크박스 미체크, line 272)을 갖고
    있고, 이는 "5차 라운드 이후 위생 정리" 절의 단일 진실 목록(`#1`~`#37`) 중 **#2**(P2, 아직
    미완료)와 동일 건이다. 다만 그 plan 자체가 "고유 14건이 체크박스 20개로 흩어졌다"는 사실을
    인지하고 라운드마다 재등장하는 `W1` 을 명시적으로 경계한다 — 실제로 같은 문서 안에
    `W1` 이 **5곳 이상**(5R api_contract=cancelledBy, 6R requirement/concurrency, 7R
    SPEC-DRIFT, `--impl-done` W1 rationale_continuity, 9R database) 독립적으로 등장하고,
    그중 6R 의 `W1(requirement/concurrency)`은 이미 조치 완료된 별개 항목이다. bare `W1`
    만으로 인용하면 그 plan 을 처음 여는 독자가 어느 라운드의 `W1` 인지 재판정해야 한다 —
    이 문서가 스스로 세운 "단일 진실 목록 번호로 참조하라"는 관례(§5차 라운드 이후 위생
    정리 서문)와 어긋난다.
  - 제안: target 의 두 인용을 `retry-turn-terminal-guard.md` **#2**(또는 "5R W1(api_contract)")
    로 구체화해 라운드-스코프 번호 충돌을 피할 것. 내용상 결함은 아니라 CRITICAL/WARNING 은
    아니지만, 이 저장소가 반복 관측한 "라운드 재등재로 같은 걸 두 번 잡는다" 패턴의 재발
    소지가 있어 기록한다.

## 확인했으나 문제 없음 (참고)

- `spec-draft-eia-r8-alignment.md` 도 같은 파일(`spec/5-system/14-external-interaction-api.md`)을
  건드리지만 다른 절(§R8 idempotency 캐시 대상 vs 본 target 의 §6.3~6.5 종결 이벤트)이라 내용
  충돌 없음. 그 plan 은 이미 체크리스트 전량 완료 상태.
- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 를 "되살리지 않는다"는 target 의 결정과
  충돌하는, 이 필드들의 구현/추적을 요구하는 다른 in-progress plan 은 없음
  (`plan/in-progress/` 전수 grep 결과 target 자신만 이 필드명을 언급).
- `durationMs`/`cancelledBy`/`EiaEvent` 관련 다른 plan 언급은 전부 다른 스코프(노드 레벨
  `meta.durationMs`, node-cancellation 의 shutdown 분류, retry-turn 의 원자 claim 등)이며
  target 의 종결 이벤트 payload 결정과 충돌하지 않음.
- target 이 전제하는 "재조회 경로(EIA-IN-04)는 이미 존재" — `eia-context-schema-followups.md`
  가 해당 항목을 이미 완료로 확정해 뒀고, 이 전제를 뒤집는 미해결 항목 없음.
- target 의 "후속 (developer)" 4건은 신규 추적 항목이며, 동일 작업을 이미 추적 중인 다른
  in-progress plan 과의 중복 없음(전수 grep 확인).
- `retry-turn-terminal-guard.md` 는 여전히 `in-progress` 이며 명시적으로 `complete/` 이동
  금지가 걸려 있어("🚫 `complete/` 로 옮기지 말 것"), target 이 그 W1 항목을 "open" 으로
  전제한 것은 실제 상태와 일치한다.

## 요약

target 의 핵심 결정(§6.3~6.5·WS §4.1 종결 이벤트 payload 를 실제 emit 에 맞추고,
`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 는 철회하며 `durationMs`/`result.outputs`
는 채우는 쪽으로 미룬다는 결정)은 다른 어떤 `plan/in-progress/**` 의 "결정 필요" 항목과도
충돌하지 않고, 전제(EIA-IN-04 재조회 경로, retry-turn 의 `cancelledBy` 선재 결함)도 실제 plan
상태와 부합한다. 유일한 지적은 `retry-turn-terminal-guard.md` 로의 교차 참조가 그 문서 자신이
정한 "라운드-스코프 W-번호 대신 단일 진실 목록 번호로 인용" 관례를 따르지 않아 발생하는
경미한 인용 모호성이며, 내용 정확성 자체는 문제없다.

## 위험도

LOW
