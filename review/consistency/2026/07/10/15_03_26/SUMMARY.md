# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 없음

## 전체 위험도
**LOW** — 신규 "연결 안 됨" 배너(§4.6)는 spec·plan·구현이 1:1 정합하고 규약(i18n·명명)도 준수하나, 톤(색상)이 문서 안 두 확립 패턴(Inline Alert 공용 정의 §3.4, status→tone escalation)과 근거 없이 갈라져 문서 동기화 필요.

## Critical
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 조치 |
|---|---|---|---|
| 1 | cross_spec | 배너가 기존 Inline Alert 패턴(`0-overview.md §3.4`)과 사실상 동일한데 인용·등록 안 됨 (§4.4 는 인용하는데 §4.6 은 독립 서술) | **조치: §4.6 에 §3.4 Inline Alert 인용 + §3.4 사용처에 등재** |
| 2 | rationale_continuity | error/expired/pending_install 에 균일 amber 톤 → 확립된 status→tone escalation(error=red, §3.4 톤 매핑·computeStatus·StatusBadge) 과 어긋남. 같은 페이지 헤더 배지는 error=red 인데 배너는 amber | **조치: 배너 톤 status-aware 로 (error=red, expired/pending_install=amber)** |

*(#1·#2 동일 근본원인 — 톤 재구현. §3.4 정합 + 톤 escalation 으로 함께 해소.)*

## 참고 (INFO)
- cross_spec: dark amber border 1단계 차이(amber-900 vs 800) → tone fix 로 정합.
- rationale_continuity: pending_install 배너 포함 근거(§Rationale 교차참조) / 근거 인라인 배치 → §4.6 문구 정리(조치).
- plan_coherence: REVIEW WORKFLOW 체크박스 미완(본 검토 단계라 정상).
- naming_collision: dead `statusDisconnected` i18n 키 어휘 중첩(별건, 실질 충돌 없음).

## Checker별
cross_spec LOW(W1·INFO1) · rationale_continuity LOW(W2·INFO2) · convention_compliance NONE · plan_coherence NONE · naming_collision NONE.

## 권장 조치
1. §4.6 배너를 §3.4 Inline Alert 인스턴스로 등록 + error=red 톤 escalation (W1·W2 함께 해소).
2. pending_install 포함 근거 §4.6 정리.
3. 리뷰 clean 후 plan complete 이동.
