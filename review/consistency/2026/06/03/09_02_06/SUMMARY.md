# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 없음.

## 전체 위험도
**MEDIUM** — EIA §6.5 / Chat Channel CCH-MP-01 이 strip 정책 미반영(cross-spec WARNING 2건), `(L1)` 레이블 다의 충돌(WARNING), plan 체크박스 부재(WARNING).

## 경고 (WARNING) — 조치
- W-1 (Cross-Spec): `spec/5-system/14-external-interaction-api.md` §6.5 에 llmCalls strip 예외 명시 → **변경 3 으로 scope 추가**.
- W-2 (Cross-Spec): `spec/5-system/15-chat-channel.md` CCH-MP-01 에 fanout strip 후 어댑터 미수신 명시 → **변경 4 로 scope 추가**.
- W-3 (Naming): `(L1)` → `(외부 수신자 strip — strip-only)` 로 교체(기존 refresh L1~L4·캔버스 레벨과 구분).
- W-4 (Convention): spec-draft 에 `[ ]` 체크박스 task 추가.

## 참고 (INFO) — 채택
- I-1/I-2: strip 대상은 WS 이벤트 필드. DB 영속(`meta.turnDebug[i].llmCalls`) + 실행 이력 디버그 패널(DB 출처)은 영향 없음 → Rationale 명시.
- I-3: 새 Rationale 첫 줄에 §961 open item 확정 연결.
- I-9: `execution:{executionId}` 표기 통일.
- I-11: "external-interaction SSE 스트림(`iext_*`/`itk_*` 토큰 인증)" 관계 명확화.
- I-5: `## Rationale` 단순화.

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM |
| Rationale Continuity | NONE |
| Convention Compliance | LOW |
| Plan Coherence | LOW |
| Naming Collision | LOW |
