# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-decide-webchat-execution-residuals.md`

## 발견사항

- **[CRITICAL]** `cancelledBy='channel_idle_timeout'` — 기존 3-값 closed union 을 조율 없이 확장
  - target 위치: "(B-2) 익명 per_execution waiting execution 채널 idle-wait timeout" §정책 (line ~116) 및
    "회수 동작" §(line ~128) — `terminal(cancelled, cancelledBy='channel_idle_timeout')`. "변경안 (2)"
    (`spec/5-system/14-external-interaction-api.md` 신규 요구사항 절)도 동일 표현(`동작=cancelled/channel_idle_timeout`)을 반복.
  - 충돌 대상: `cancelledBy` 는 **닫힌 3-값 문자열 union** `"user" | "system" | "timeout"` 으로 최소 5개 spec 문서에
    동일하게 박제돼 있다 —
    [`spec/5-system/14-external-interaction-api.md §6.5`](spec/5-system/14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message)
    (`execution.cancelled` 는 §6.3 의 result 자리에 `cancelledBy: "user" | "system" | "timeout"` 만 채운 변형),
    [`spec/5-system/6-websocket-protocol.md §4.1`](spec/5-system/6-websocket-protocol.md#41-실행-이벤트-server--client)
    (`cancelledBy: 'user' | 'system' | 'timeout'`),
    [`spec/5-system/3-error-handling.md`](spec/5-system/3-error-handling.md) (큐 대기 초과 cancelled 귀결 노트),
    [`spec/5-system/4-execution-engine.md` Rationale](spec/5-system/4-execution-engine.md)
    ("기존 `cancelledBy` enum 의 미사용 값 `'timeout'` 을 첫 실사용"),
    [`spec/conventions/chat-channel-adapter.md`](spec/conventions/chat-channel-adapter.md) (타입 선언
    `result: { cancelledBy: "user" | "system" | "timeout" }` 및 §342 매핑 표).
  - 상세: `4-execution-engine.md` 의 Rationale 이 이미 이 union 이 **닫혀 있고, 신규 사유는 값 자체를 늘리지 않고
    `error.code` 로 세분화**하는 것이 확립된 패턴임을 명시한다 — 큐 대기 초과(`EXECUTION_QUEUE_WAIT_TIMEOUT`)도
    `cancelledBy='timeout'` 을 재사용하고 `error.code` 로만 구분했다("cancelled 귀결 그룹"). target 의
    `channel_idle_timeout` 은 이 패턴을 따르지 않고 **4번째 열거값**을 신설하며, "변경안" 섹션 어디에도
    `6-websocket-protocol.md §4.1` / `3-error-handling.md` / `conventions/chat-channel-adapter.md` 동반 갱신이
    포함돼 있지 않다(frontmatter `spec_impact` 에도 3개 파일 모두 누락). `grep -rn channel_idle_timeout spec/`
    결과 target 파일 자신 외 0건 — 기존 spec 어디에도 선례가 없다. 이대로 구현되면 `chat-channel-adapter.md` 가
    선언한 `cancelledBy` 리터럴 타입과 실제 emit 값이 어긋나는 타입 계약 위반이 발생한다.
  - 제안: `cancelledBy` 는 기존 값 재사용(`'timeout'` 또는 `'system'`) + 신규 `error.code`(예:
    `CHANNEL_IDLE_TIMEOUT`, `EXECUTION_QUEUE_WAIT_TIMEOUT` 선례와 동형)로 세분화하는 방향으로 (B-2) 정책 문구를
    수정할 것. 채택 시 "변경안 (2)"·`spec_impact` 에 `6-websocket-protocol.md §4.1`(cancelledBy 문서화는 불변,
    error.code 참고만 추가) · `3-error-handling.md`(신규 에러코드 카탈로그 등재) ·
    `conventions/chat-channel-adapter.md`(§342 매핑 표에 이 error.code 분기 추가 검토)를 동반 등재할 것.

- **[WARNING]** R-B2 근거가 auth-session §3.1 의 "미구현(Planned)" 배너를 기정사실처럼 인용
  - target 위치: "(B-2) 익명 per_execution … 판정 신호 = 토큰 영구 만료" §둘째 불릿(line ~123-125) —
    "위젯 자신도 reload 시 만료 토큰의 낙관적 refresh 가 실패하면 `[ended]` 로 포기한다
    ([auth-session §3.1·§R4])".
  - 충돌 대상: [`spec/7-channel-web-chat/3-auth-session.md §3.1`](spec/7-channel-web-chat/3-auth-session.md#31-재로드-복원-시퀀스-per_execution)
    상단의 명시적 경고 배너 — "**v1 구현 현황(부분)**: … 아래 2단계의 **200+종료·404·복구불가 401 REST 분기와
    `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)**".
  - 상세: target 이 인용하는 정확히 그 메커니즘(재로드 시 401 수신 → 낙관적 refresh 1회 시도 → 실패 시 `[ended]`)은
    auth-session.md 자신이 "아직 구현되지 않음"으로 표시한 부분이다. B-2 backstop 의 핵심 전제("alive 위젯은
    proactive refresh 로 유지, abandoned 위젯은 refresh 를 멈춰 토큰이 만료됨")는 §3 시퀀스 7(진행 중 세션의
    주기적 refresh, `use-token-refresh.ts`)에 의존하므로 그 자체는 별개 메커니즘이라 크게 흔들리지 않지만,
    "위젯 자신도 … [ended] 로 포기한다"는 문장은 현재 spec 상 미구현 경로를 이미 동작하는 것처럼 서술해 Rationale
    의 사실 전제 정확성을 해친다.
  - 제안: 해당 문장에 "(§3.1 의 이 401 분기는 현재 Planned — 구현 전까지 재로드 시 abandoned 세션의 즉시 `[ended]`
    전이는 보장되지 않음)" 같은 caveat 을 추가하거나, R-B2 의 논거를 §3 시퀀스 7(진행 중 세션 refresh, 이미 구현)
    만으로 한정해 미구현 경로 인용을 제거할 것.

- **[INFO]** 신규 요구사항 ID 미확정 — 기존 채번 규칙과의 정합 확인 필요
  - target 위치: "변경안 (2)" — "신규 요구사항(§3.4 신뢰성·일관성 또는 §5.x)"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §3.4` 는 `EIA-RL-01`~`EIA-RL-06` 까지 채번돼 있다.
  - 상세: 현재는 ID 가 미확정이라 직접적 충돌은 없으나, 실제 편집 시 `EIA-RL-07` (또는 §3.x 신설 시 그 절의
    다음 번호)을 명시적으로 배정하고 다른 영역에서 동일 ID 를 선점하지 않았는지 재확인이 필요하다(현재 grep 상
    `EIA-RL-07` 미사용 확인됨 — 상충 없음, 채번만 lock 하면 됨).
  - 제안: spec 편집 시 ID 를 확정해 커밋하고, `/consistency-check --spec` 체크리스트 항목대로 재검증할 것(이미
    체크리스트에 반영돼 있음).

## 요약

target 이 인용하는 execution-engine §7.4/§7.5 무기한 보존 불변식, EIA §5.4 cancel/§5.5 refresh/§8.3 토큰 규약/§9.3
EIA-RL-06 terminal revoke, widget-app §3.1·R7 현재 서술, auth-session §1~§3 인증·세션 모델은 실제 spec 본문과
문구 수준까지 정확히 일치하며, (A) coalesce·(B-1) client cancel 설계는 기존 상태 전이·계층 책임 구조와 충돌하지
않는다(waiting_for_input → cancelled 전이는 이미 허용됨, "새 대화" 발 cancel 은 "대화 종료"의 기존 cancel 분기와
대칭). 다만 (B-2) backstop 이 도입하는 `cancelledBy='channel_idle_timeout'` 값은 EIA/WS-protocol/error-handling/
chat-channel-adapter 4개 문서에 박제된 **닫힌 3-값 union**(`user`/`system`/`timeout`)과 정면으로 어긋나고, 이미
확립된 "새 사유는 값을 늘리지 않고 error.code 로 세분화" 패턴(EXECUTION_QUEUE_WAIT_TIMEOUT 선례)을 따르지 않는다
— 이는 spec 편집 단계에서 반드시 정정하거나 최소 4개 문서를 동반 갱신해야 하는 CRITICAL 사안이다. 부차적으로
R-B2 의 근거 서술 하나가 auth-session §3.1 이 스스로 "Planned"라 표시한 미구현 경로를 기정사실처럼 인용해
Rationale 의 사실 정확성을 낮춘다(WARNING).

## 위험도

HIGH
