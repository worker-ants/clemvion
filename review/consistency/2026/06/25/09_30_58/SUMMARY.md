# Consistency Check 통합 보고서 (--impl-done, 1차)

**BLOCK: NO** — Critical 없음. WARNING 4건 중 W1·W2 는 FALSE POSITIVE, W3·W4 는 spec 갱신으로 해소(후속 재실행으로 검증).

> 대상 커밋: `bd0d9517` (이후 W3·W4 spec 갱신 amend). rationale_continuity 출력 미생성 → 재실행 필요.

---

## 전체 위험도
**MEDIUM** — Critical 0 / WARNING 4 / INFO 13 / rationale_continuity 재시도 1건.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배(보고) | 처분 |
|---|---------|-----------|------|
| W1 | Cross-Spec | `execution.message` EIA §5.2/§6 미등재 | §5.2 = **FALSE**(L387+R18 실재, `grep -c`=6). §6 outbound webhook 은 **의도적 제외**(SSE 전용). 세 번째 동일 blind-spot 오탐 |
| W2 | Cross-Spec | `resetSession` SDK §3 미등재 | §3 = **FALSE**(L86 실재). §5 ChatInstance 미포함은 **의도**(host→iframe 명령, 공개 메서드 아님) |
| W3 | Cross-Spec | execution.message/node.completed 이중발송 invariant 미명문화 | **FIXED** — EIA §5.2 에 "위젯은 execution.message 에서만 소비, node.completed 무시; chat-channel 은 node.completed 픽업 → 중복 없음" 불변식 추가 |
| W4 | Plan Coherence | WS §4.4 카탈로그 execution.message 미등재(EIA §5.2 cross-ref dangling) | **FIXED** — WS §4 카탈로그에 execution.message 행 추가(payload+제약). plan Phase 4 §4 완료 표시 |

## 참고 (INFO)
I1~I13: 전부 비차단(plan frontmatter·상수 신설·명명·diff 겹침 등). 위반 없음 확인 또는 백로그. I8(newChat ChatInstance 미반영)은 W2 와 동일 — resetSession/newChat 을 공개 SDK 메서드로 격상하지 않고 host→iframe 명령으로 유지하는 의도적 결정.

## Checker별
- Cross-Spec: MEDIUM (W1·W2 FALSE, W3 fixed)
- Plan Coherence: LOW (W4 fixed)
- Convention/Naming: NONE
- Rationale Continuity: 재시도 필요(출력 미생성) → 후속 impl-done 재실행에 포함

## 권장 조치 → 처분
1. W1/W2: FALSE POSITIVE (verified). 조치 불필요.
2. W3/W4: spec 갱신 완료(EIA §5.2 불변식 + WS §4 카탈로그).
3. rationale_continuity: 후속 impl-done 재실행으로 결과 확보.
