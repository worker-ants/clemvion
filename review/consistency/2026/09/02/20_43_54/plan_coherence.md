# Plan 정합성 검토 — `spec-draft-api-convention-status-and-password-codes.md`

## 발견사항

- **[WARNING]** 소스 plan(`ws-token-expired-socket-lifetime-impl.md`)의 두 WARNING 체크박스 전환이 변경안에 없다
  - target 위치: `## 변경안 — spec 5곳` 표 (5행 전체) — spec 파일 5곳만 나열하고 plan 갱신 항목이 없다
  - 관련 plan: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:65,69` (unchecked `[ ]`)
  - 상세: target 문서 자신이 상단 "착수 근거"에서 밝히듯, 이 draft 는 정확히
    `ws-token-expired-socket-lifetime-impl.md` 의 두 미해결 체크박스(65행 `410 Gone`·`202 Accepted`
    §6 미등재 W1, 69행 `INVALID_PASSWORD`/`PASSWORD_INVALID` W2)를 해소하기 위해 작성됐다.
    실측(2026-09-02 현재 파일 상태)으로도 두 항목은 여전히 `[ ]` 다. 그런데 target 의
    "변경안" 표는 `2-api-convention.md`·`error-codes.md`·`3-error-handling.md` 의 **spec 편집
    5건만** 나열하고, 그 spec 편집이 적용된 뒤 소스 plan 파일의 이 두 체크박스를 `[x]` 로
    전환하는 항목이 없다. 이대로 적용하면 실제 결정은 끝났는데 `ws-token-expired-socket-lifetime-impl.md`
    에는 "planner 턴 필요" 문구가 그대로 남아 다음 사람이 미해결로 오독할 위험이 있다.

    이 worktree 안의 **바로 이웃한 자매 draft**가 동일 패턴을 이미 다른 방식으로 처리한
    선례가 있다 — `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md`(commit
    `7e6a4bc3e` 로 이미 spec 에 적용됨, 실측 확인)의 "변경안" 은 spec 5곳뿐 아니라 **"plan —
    라이프사이클" 표를 별도로 두어**, 자신이 해소하는 `ws-token-expired-socket-lifetime-impl.md`
    의 다른 항목(§10.4 위임)을 `[x]` 로 전환하는 작업을 row 14 로 명시했다
    ("PR 체크 + planner 항목 둘 다 `[x]` — 배지 flip·§10.4"). target 은 같은 worktree, 같은
    소스 plan 파일을 대상으로 하면서 이 관례를 따르지 않았다.
  - 제안: target 의 "변경안" 표(또는 별도 "plan" 절)에 6번째 행을 추가해
    `ws-token-expired-socket-lifetime-impl.md:65,69` 두 체크박스를 `[x]` 로 전환하는 작업을
    명시할 것. (해당 plan 파일은 다른 잔여 항목이 남아 `complete/` 이동 대상은 아니다 —
    체크박스 전환만 필요.)

## 확인했으나 문제 없음으로 판정한 항목 (기록용)

- **`error-codes.md §3` 동시 편집 우려** — `spec-update-node-cancellation-shutdown-classification.md`
  가 §3 에 `AbortError` 등재를 위임해 뒀고, `spec-conventions-engine-error-code-surface.md` 는
  이미 그 사실을 "나란히 가는 plan" 으로 교차 참조해 뒀다. 그런데 실측(`spec/conventions/error-codes.md`
  §3 현재 본문)으로 `AbortError` 행은 **2026-07-27 에 이미 등재 완료**된 상태다
  (`spec-update-node-cancellation-shutdown-classification.md:87-88` 도 "이미 이행 — 다시
  세지 말 것" 이라 명시). 즉 target 의 §3 `INVALID_PASSWORD` 신규 행 추가와 겹칠 살아있는
  미해결 편집은 없다 — 충돌 아님.
- **§6 202/410 누락·§5.3 `GlobalExceptionFilter` 매핑 부재·`3-error-handling.md §1.2`
  `INVALID_PASSWORD` 기등재** — 세 전제 모두 spec 본문 실측으로 확인. target 의 사실관계는
  플랜 정합성 문제가 아니라 정상.
- **`backend-lint-gate-broken-on-main.md` 의 idempotency 캐시 409/410 제외 결함(canary 고정,
  `[x]` 처리됨)** — target 의 §6 문서화 변경과 대상(런타임 캐시 로직 vs HTTP 상태 코드 표
  문서화)이 달라 충돌하지 않는다.
- **`ai-agent-tool-connection-rewrite.md` 의 미해결 "결정 필요" 5항목** — target 의 스코프
  (API 상태 코드·비밀번호 에러 코드)와 무관.

## 요약

target 은 `ws-token-expired-socket-lifetime-impl.md` 가 명시적으로 위임한 두 convention_compliance
WARNING(§6 상태 코드 표 누락, `INVALID_PASSWORD`/`PASSWORD_INVALID` 명명)을 정확히 겨냥해
실측 기반으로 타당하게 해소하며, 세 spec 파일에 대한 다른 미해결 plan 결정과도 충돌하지 않는다
(§3 `AbortError` 우려는 실측상 이미 종결됐음을 확인). 다만 이 worktree 의 자매 draft가 이미
정착시킨 관례 — "이 draft 가 해소하는 소스 plan 체크박스 전환을 변경안 자체에 명시" — 를
따르지 않아, 적용 후 `ws-token-expired-socket-lifetime-impl.md` 에 해소된 항목이 미해결처럼
남을 후속 누락 위험이 하나 있다.

## 위험도
LOW
