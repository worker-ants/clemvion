# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md

## 발견사항

- **[WARNING]** `eia-terminal-emit-facade.md` 가 `retry-turn-terminal-guard.md` #2 (P2, 미해결)의
  대상 코드를 같은 턴에 건드리면서도 서로를 참조하지 않는다 — 소유권이 두 plan 에 흩어진다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합"
    표의 `result.cancelledBy` 행(`"구현됨 — 경로 1곳 누락 | retry-turn.service.ts failRetryExecution
    은 채우지 않는다 ([retry-turn-terminal-guard] #2)"`)
  - 관련 plan: `plan/in-progress/eia-terminal-emit-facade.md` (오늘 착수, 이 worktree/branch 의
    현재 작업) 의 "실측 — 직접 호출 11곳" 표 및 "조치" 체크리스트 vs
    `plan/in-progress/retry-turn-terminal-guard.md` "코드 — 우선순위 순" 표 #2 (P2, 미체크) vs
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md` §후속(developer) 의
    명시적 위임 문장(`"failRetryExecution 의 cancelledBy 누락 → retry-turn-terminal-guard.md #2
    에서 집행"`, 이미 `[x]` 로 역포인터까지 걸어 둔 항목)
  - 상세: 코드를 직접 대조하면 `retry-turn.service.ts:989`(`failRetryExecution`)가 실제로
    `EXECUTION_CANCELLED`/`EXECUTION_FAILED` 를 한 자리에서 분기 emit 하는 **직접 호출**이고,
    cancelled 분기의 payload 에는 `result.cancelledBy` 가 전혀 없다(반면 형제 shared helper
    `emitCancellationEvent`, `execution-engine.service.ts:1117` 는 이미 `result: { cancelledBy }`
    를 싣는다). `eia-terminal-emit-facade.md`"실측" 표는 `EXECUTION_CANCELLED` 2곳의 payload 를
    모두 `{status, durationMs, result:{cancelledBy}} + 조건부 error`" 로 균일하게 서술해, 이
    한 곳이 그 서술과 다르다는 사실(=target spec §6 이 이미 알려진 갭으로 등재한 바로 그 결함)이
    표에 드러나지 않는다. `eia-terminal-emit-facade.md`"조치" 체크리스트("직접 호출 11곳 이관")는
    이 call site 를 포함하므로, `cancelledBy` 를 union 의 필수 필드로 만들면 컴파일러가 이 자리에
    값을 요구해 결과적으로 `retry-turn-terminal-guard.md` #2 를 부수적으로 해소하게 될 공산이
    크다. 그런데 `eia-terminal-emit-facade.md` 의 "다른 plan 과의 관계" 절은 정본 트래커
    (`spec-sync-external-interaction-api-gaps.md`)만 언급하고 `retry-turn-terminal-guard.md`
    는 전혀 참조하지 않으며, "조치" 체크리스트의 "정본 트래커 항목 닫기" 도 그 문서의 W1(타입
    초크포인트) 항목만 가리킨다 — `retry-turn-terminal-guard.md` #2 의 체크박스나 target spec
    §6 의 "경로 1곳 누락" 각주를 갱신하는 항목이 없다. `spec-draft-eia-notification-payload-contract.md`
    가 이미 이 결함의 집행처를 `retry-turn-terminal-guard.md` #2 로 **명시 위임**하고 역포인터까지
    걸어 둔 상태이므로, 오늘 시작된 새 plan 이 같은 코드를 별도 경로로 건드리면서 그 위임을
    승계하지 않으면 (a) 두 plan 이 같은 결함을 각자 인지 못한 채 겹쳐 고칠 위험, (b) 파사드
    PR 이 먼저 랜딩할 경우 `retry-turn-terminal-guard.md` #2 가 실제로는 해소됐는데 계속 열려
    있는 채로 남거나, target spec §6 각주가 stale 서술("경로 1곳 누락")로 남는 위험이 생긴다.
    이 저장소 자신이 이미 기록한 패턴("체크박스를 옮길 때 그 옆 산문을 같이 읽어라",
    "SoT 한쪽만 고친다")과 같은 형태다.
  - 제안: `eia-terminal-emit-facade.md` 의 "다른 plan 과의 관계"/"조치" 절에
    `retry-turn-terminal-guard.md` #2 를 명시적으로 흡수한다고 적고, `retry-turn.service.ts:989`
    분기의 `cancelledBy` 값(문맥상 `ExecutionCancelledError`/Stop 트리거이므로 `'user'`, `error`
    키 없음 — §6 "행동 계약" 의 user cancel 규칙과 일치)을 명시한다. 구현 완료 시 같은 커밋/턴에서
    `retry-turn-terminal-guard.md` #2 체크(`[x]`) + target spec §6 "경로 1곳 누락" 각주 제거를
    함께 수행하도록 체크리스트 항목을 추가할 것.

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`) 자체는 최근 커밋들(§R8 캐시 스코프,
§6 종결 이벤트 SoT 단일화, `durationMs`/`error` 객체화 등)과 이미 정합 상태이고, 오늘 새로
등재된 `eia-terminal-emit-facade.md` 도 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
의 등재 항목을 정확히 집행하는 형태다. 다만 그 계획이 마이그레이션할 "직접 호출 11곳" 중 하나
(`retry-turn.service.ts:989`)가 이미 다른 두 plan(`retry-turn-terminal-guard.md` #2,
`spec-draft-eia-notification-payload-contract.md` 의 명시적 위임)이 소유권을 지정해 둔 알려진
결함(`cancelledBy` 누락)과 정확히 겹치는데, 새 plan 은 이를 인지·교차참조하지 않고 있다. 코드
직접 대조로 확인한 구체적 사실이며, 이 turn 이 착수 전 해당 교차참조를 plan 문서에 반영하지
않으면 두 트래커 중 하나가 stale 해지거나 중복 작업이 발생할 개연성이 높다. 그 외에는
plan/in-progress 전반이 target 과 크게 어긋나지 않는다(§R8 정합화·§5.5/§5.2 stale 서술 정정 등은
이미 별도 plan 이 선행 완료했고 self-consistent).

## 위험도
MEDIUM
