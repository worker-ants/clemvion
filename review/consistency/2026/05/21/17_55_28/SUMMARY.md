# Consistency Check 통합 보고서 (Round 1)

**BLOCK: YES** — Critical 2건 발견. draft 수정 후 재호출 필요.

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-21
Checker 상태: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision 모두 SUCCESS

## Critical 위배 (BLOCK 사유)

- **C1** [rationale_continuity] EIA-AU-02/06 필수 토큰 인증을 Chat Channel 어댑터가 우회하면서도, 해당 예외가 EIA spec 본문에 없음. EIA §R4 의 "Telegram 봇 = per_trigger 적합" 예시와 충돌. → EIA §3.3 에 `EIA-AU-08` 예외 조항 신설 + §R4 예시 수정 필요.
- **C2** [rationale_continuity] EIA §R10 의 단일 sink + facade invariant 를 어댑터가 준수한다고 주장하나, 구체 구독 경로 (NotificationDispatcher / Redis pub-sub / 별도 hook) 미명시. → 어댑터의 구독 메커니즘 (NotificationDispatcher EventEmitter listener) 을 spec 본문에 명시 + EIA §R10 보강.

## 주요 Warning

W1: spec/1-data-model §2.8 Trigger 컬럼 갱신 누락 (draft §2 변경 대상에 추가 필요)
W2: rotate-token vs rotate-secret 동사 통일 필요 (`rotate-bot-token` 으로 명확화)
W3: EIA §2 시나리오 표 — 흡수가 아니라 병존
W4: 처리 흐름 다이어그램에 202 반환 시점 명시
W5: in-process bypass path 명시 (C1 과 일부 중복)
W7: "5함수 규약" → "6함수 규약" (실제 6개)
W9: `InteractionService.dispatchCommand` 가 코드에 없음 — 실제 메서드명 `interact` 사용

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---|---|---|
| cross_spec | MEDIUM | 1-data-model.md 누락, rotate 동사 불일치, in-process bypass 미명시 |
| rationale_continuity | HIGH | C1·C2 |
| convention_compliance | LOW | 5함수 vs 6함수 불일치, providers _overview 권장 |
| plan_coherence | LOW | progress plan 간 critical 충돌 없음 |
| naming_collision | MEDIUM | dispatchCommand 미존재 (실제: interact), token_v2_ref vs notification_secret_v2 패턴 |

## 후속

Round 2 ([../18_10_33/SUMMARY.md](../18_10_33/SUMMARY.md)) 에서 Critical 2건 모두 해소됨 — spec write 진행.
