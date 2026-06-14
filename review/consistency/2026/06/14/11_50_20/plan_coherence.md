### 발견사항

- **[WARNING]** `spec/5-system/1-auth.md §2.1/§2.3` — plan M-5 "spec 갱신 필요" 가 실제로는 이미 반영된 상태
  - target 위치: `spec/5-system/1-auth.md §2.3` 세션 정책 표 (COOKIE_SAMESITE·Origin 검증·Rationale 2.3.B 포함)
  - 관련 plan: `plan/in-progress/refactor/04-security.md` M-5 항목 — "⏳ spec 갱신 (planner, 필요): 1-auth.md §2.1/2.3 에 SameSite 정책(COOKIE_SAMESITE, 기본 none)·Origin CSRF 보완책 명문화"
  - 상세: target spec §2.3 표에 COOKIE_SAMESITE env·기본 none·/auth/refresh Origin 검증이 이미 반영돼 있고 Rationale 2.3.B 도 존재한다. plan 의 "⏳" 체크박스가 완료 처리되지 않아 plan 상태가 실제와 불일치.
  - 제안: `plan/in-progress/refactor/04-security.md` M-5 의 "⏳ spec 갱신 (planner)" 를 완료 처리 갱신.

- **[WARNING]** `refactor-04-followup-pwchange-userip.md` — "남은 planner 트랙" B-1 이 target spec 미반영 상태로 열려 있음
  - target 위치: `spec/5-system/1-auth.md §4.1 Rationale 4.1.B`
  - 관련 plan: `plan/in-progress/refactor-04-followup-pwchange-userip.md §남은 planner 트랙` — "B-1 data-model §2.18 ip_address→String? (AuditLog), Rationale 4.1.B WebAuthn 추가 credential·OAuth-only TOTP 비활성 보강" 미착수
  - 상세: target §4.1 Rationale 4.1.B 에 "WebAuthn 추가 credential 등록도 user.2fa_enabled" 와 "OAuth-only 사용자의 마지막 2FA 비활성화는 별개 결정" 으로 기술돼 있어 plan 의 "Rationale 4.1.B 보강" 필요성을 내포하고 있다. 직접 충돌은 아니나 plan 이 명시한 선행 보강이 미수행 상태로 target 이 불완전한 Rationale 을 보유.
  - 제안: `refactor-04-followup-pwchange-userip.md` B-1 planner 트랙 착수 추적 유지 — spec 갱신 전 target 을 확정된 진실로 보기 어려운 부분 존재.

- **[WARNING]** `execution-engine-typed-errors.md` — spec 결정 미확정, target `spec/5-system/` 내 관련 문서에 반영 없음 (정상 미완 상태 확인)
  - target 위치: `spec/5-system/4-execution-engine.md §7.5.1` + `spec/5-system/6-websocket-protocol.md` (범위 내)
  - 관련 plan: `plan/in-progress/execution-engine-typed-errors.md` — "결정 확정 시 후속: project-planner 가 spec 반영 → consistency-check --spec → developer 구현". "본 절 작성으로 spec 은 아직 바뀌지 않는다" 명시.
  - 상세: 설계 초안은 상세하게 작성됐으나 spec 은 의도적으로 미변경. 현재 worktree(`refactor-04-a1-typed-errors-156e87`)가 이 plan 에 대응하는 워크트리인데, spec 미반영 상태에서 구현 착수 여부를 확인해야 한다. plan 선행조건("spec 결정 확정→consistency-check --spec→구현")이 충족되기 전에 구현이 앞서나가면 CRITICAL 상태가 된다.
  - 제안: 현재 worktree 에서 진행 중인 구현 범위가 plan 이 요구하는 "spec 확정 선행" 조건을 만족하는지 확인. spec 미반영 상태라면 구현 착수 전 planner 단계 완료 필요.

- **[INFO]** `spec/5-system/1-auth.md §5 API 엔드포인트` 표 — POST /api/auth-configs/:id/reveal 행 누락
  - target 위치: `spec/5-system/1-auth.md §5` 엔드포인트 표
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` — "spec/5-system/1-auth.md §5 에 POST /api/auth-configs/:id/reveal 행 추가 (현재 §3.2 권한 매트릭스·Rationale 에만 언급)" 미착수 planner 위임
  - 상세: §5 표에 reveal 엔드포인트 행이 없다. plan §3 이 이를 미착수 후속으로 인식. 충돌 아니나 기록 불완전.
  - 제안: `auth-config-webhook-followups.md §3` 추적 유지.

- **[INFO]** `refactor/04-security.md` M-3 (ReDoS) — plan "spec 갱신 필요" 항목이 실제 반영됐는지 확인 불명
  - target 위치: 4개 spec (transform/filter/if-else/switch) 의 "길이 200 = ReDoS 방지" 서술 — `spec/5-system/` 직접 해당 아니나 교차 참조.
  - 관련 plan: `plan/in-progress/refactor/04-security.md` M-3 — "⏳ spec 갱신 (planner, 필요): 4개 spec 의 길이 200 = ReDoS 방지 서술 정정 + ReDoS 정책 단일 정의"
  - 상세: 코드 구현은 완료(2026-06-12)됐으나 spec 갱신이 "⏳" 상태로 남아 있음. 본 target 범위 외이나 spec/5-system 간접 영향.
  - 제안: planner 트랙에서 별도 처리.

### 요약

`spec/5-system/1-auth.md` (target) 는 refactor-04 security plan 의 주요 결정(C-1 fail-closed, M-5 SameSite/CSRF, Rationale 2.3.A/B/C, §4.1.A/4.1.B, Production fail-closed 가드)을 이미 반영하고 있어 in-progress plan 과의 직접 충돌은 없다. 그러나 plan 의 "⏳ spec 갱신" 체크박스가 완료 갱신되지 않아 plan 상태와 실제 spec 간 불일치가 존재한다(M-5). 더 중요한 것은 현재 worktree(`refactor-04-a1-typed-errors-156e87`)에 대응하는 `execution-engine-typed-errors.md` plan 이 "spec 결정 확정 선행" 을 명시적 선행조건으로 두고 있으므로, spec 미반영 상태에서 구현이 앞서나가지 않도록 주의가 필요하다. `refactor-04-followup-pwchange-userip.md` B-1 planner 트랙도 Rationale 4.1.B 보강으로 미착수 상태다.

### 위험도

MEDIUM
