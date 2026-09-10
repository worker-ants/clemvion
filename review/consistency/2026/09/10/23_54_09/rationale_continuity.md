# Rationale 연속성 검토 — chat-channel PATCH 토큰 우회 수정 (impl-done, spec/5-system)

## 발견사항

- **[INFO]** `§5.4.1` / `§5.4.1.1` 의 "`details.field` 미확정 — 후속 e2e 확인 대기" 문구가 이번 diff 의 unit 레벨 실측으로 이미 해소됨
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 표 3행, §5.4.1.1 표 2행 (`details.field` 는 **미확정 — 후속 e2e 확인 대기**)
  - 과거 결정 출처: 동일 문서 §5.4.1 표 자체 (2026-09-10 시점 미확정 상태로 명시)
  - 상세: `trigger-dto-validation.spec.ts` 의 신규 테스트 `[실측] 차단 5필드의 details.field 는 전부 중첩 경로다` (target diff L1029 부근)가 `chatChannel.botToken` 등 중첩 경로임을 실측했고, 테스트 주석 자체가 "이 단언이 그 실측의 정본이다 — 후속 planner 턴이 §5.4.1·§5.4.1.1 의 표기를 고칠 때 여기 값을 근거로 쓴다" 라고 명시해 spec 정정을 **의도적으로 다음 planner 턴에 위임**하고 있다. Rationale 자체를 위반하거나 은폐한 것은 아니며, 계획된 후속 조치로 자기-문서화돼 있다.
  - 제안: 이번 PR 범위는 아니므로 차단 사유는 아니다. 다음 `project-planner` 턴에서 §5.4.1/§5.4.1.1 의 "미확정" 표기를 이 실측치(중첩 경로)로 갱신할 것 — 이미 diff 주석이 그 경로를 정확히 지목하고 있어 후속 작업 비용은 낮다.

## 요약

target 은 `spec/5-system/15-chat-channel.md` 의 `R-CC-10`(bot token 변경 single-path) 을 번복하지 않고, 같은 문서의 `R-CC-21`(PATCH 는 비밀을 쓰지 않는다 — 차단이 필드명 층에만 걸려 있었다)이 이미 결정해 둔 처방(D-1: PATCH DTO 에서 `botToken`/`inboundSigningPlaintext` 제외, D-2: `setupChatChannel` 경로 자체가 사용자 공급 비밀을 쓰지 않도록 게이팅, D-3: `botTokenRef`/`inboundSigningRef` 재유도·보존)을 정확히 구현한다. `R-CC-21` 이 명시적으로 "기각한 대안" 3종(값 필드 optional 처리 후 침묵 무시, `SecretResolver.rotate` 에 빈 값 가드만 추가, telegram 전용 별도 rotate API 신설) 중 어느 것도 재도입하지 않았고, telegram server-issued signing 이 매 PATCH 마다 재발급·재저장되어야 한다는 §5.4.1.1 의 carve-out 도 `storeUserSuppliedSecrets` 플래그로 정확히 구분해 지켰다(사용자 공급 두 축은 차단, telegram 자체발급 축은 무조건 유지). 또한 이전 rationale-continuity 검토(`review/consistency/2026/09/10/15_23_41` W1)가 지적했던 "e2e 캐너리가 결함(R-CC-10 우회)을 그대로 재현·고정하는" 상태도 `trigger-workflow-ref.e2e-spec.ts` 에서 `botToken` 제거 + 주석 갱신으로 해소했다. `inboundSigningRef` 비대칭 보존 결함(자매 ref 소실 → 서명 검증 fail-open)도 별도 회귀 테스트로 고정해, Rationale 이 요구하는 "결정 번복 시 새 Rationale 동반" 원칙과 "invariant 우회 금지" 원칙을 모두 충족한다. 유일한 잔여 항목은 스스로 문서화된 후속 planner 작업(§5.4.1 표기 정정)으로, target 자체의 결함이 아니다.

## 위험도
NONE
