# Consistency Check 통합 보고서 (--spec)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

대상: `spec/7-channel-web-chat/3-auth-session.md` (spec polish followups bundle)
검토 모드: `--spec`
일시: 2026-06-28 10:26:12

## 전체 위험도
**LOW** — spec 간 실질 충돌 없음. WARNING 2건 모두 pre-existing(본 polish 가 도입 아님), 비차단.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Rationale Continuity | §R5 "interact 응답 body void" 표현이 EIA R16(interact→InteractAckDto `{data}` 202)과 충돌 | **본 PR 에서 수정** — "위젯 eia-client 가 ack body 를 소비하지 않음(SSE 수신 대체)" + EIA §5.1·§R16 cross-ref 로 재서술. (pre-existing 문장, 본 doc 편집 중 hygiene 정정) |
| W-2 | Plan Coherence | V-18(§3.1 복원 시퀀스 spec 유지 여부) 미결 결정 — §3.1 유지하며 v1 단서 미추가 | **별도/현행** — 본 polish 는 **응답 코드 오기(410→200+status)만 정정**한다(코드 확인: getStatus 는 410 미반환). §3.1 서술은 실제 코드 동작(getStatus 로 waiting 시드, terminal/404 는 SSE/cleanup 으로 [ended])과 정합. V-18 의 "구현 범위 단서" 결정은 별개 open 항목으로 미해결 — 부정확한 "v1 미구현" 단서는 추가하지 않는다(코드가 getStatus 를 실제 호출하므로) |

## 참고 (INFO) — 비차단
- I-1: §R5 interact void(W-1 과 동일, 수정 반영). I-2: `?token=iext_*` 표기(선택). I-3: carousel 병기(선택).
- I-4/I-5: id prefix·R 번호(현행 유지, 영역 패턴). I-6: EIA §R4 vs 본문 §R4 앵커(선택). I-7: firstMessage 인라인(선택). I-8: getStatus context 구현 의존(EIA gaps, V-18 연계).

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | EIA/Webhook/보안/SDK 정합 양호. interact void·?token 표기 INFO |
| Rationale Continuity | LOW | §R5 EIA R16 번복 문장(W-1, 본 PR 수정) |
| Convention Compliance | NONE | 의무 항목 준수. id prefix·R 번호 현행 유지 |
| Plan Coherence | LOW | V-18 미결과 §3.1 정합(W-2, 응답코드 정정만·별도 결정) |
| Naming Collision | NONE | 식별자 충돌 없음 |

## 권장 조치사항
1. **(본 PR 반영)** §R5 interact ack body 표현 정정(W-1).
2. **(별도 open)** V-18 결정(§3.1 구현범위 단서)은 본 PR 범위 밖 — 응답코드 오기 정정만 수행(W-2).
3. (선택 INFO) ?token 표기·carousel 병기·앵커링크 등 — 비차단, 미반영.
