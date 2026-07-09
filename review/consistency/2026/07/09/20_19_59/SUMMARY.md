# Consistency Check 통합 보고서 (--impl-done, scope=spec/7-channel-web-chat/)

**BLOCK: NO** — Critical 0. 5개 checker 전원 판독 완료(convention_compliance 는 output 파일 부재 →
journal wf_5173978e-d15 에서 복원: INFO 만 — payload 번들 무관 conventions·pre-existing DTO 네이밍 drift,
Critical/WARNING 없음).

## 전체 위험도
**LOW** — Critical 0. WARNING 3(문서 정합·명명 혼동 방지 권고).

## Critical
없음.

## 경고 (WARNING) 및 처리
| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | rationale_continuity | conversation-thread §8.4 "durable 컬럼 park resume 전용" 배타 서술이 EIA R17 신규 소비처(getStatus REST)로 미갱신 | **수정** — §8.4 에 "소비처 갱신(2026-07-09)" 문단 추가(rehydration·SSE·getStatus 3소비처 명시, EIA R17 교차링크) |
| 2 | plan_coherence | 4-security.md §4 "interact rate-limit Planned" 가 stale(실제 구현됨, EIA §8.4 flip 완료) | **defer(pre-existing)** — 본 PR 이 만든 drift 아님(reviewer 확인). 별도 spec-sync 항목 권장 |
| 3 | naming_collision | `.wc-panel-action`(헤더 세션 컨트롤) vs `.wc-action`(퀵 액션) CSS 유사 명명 | **수정** — styles.ts 정의부에 "퀵 액션과 별개, 통합 금지" 구분 주석 추가 |

## 참고 (INFO)
- rationale_continuity: 헤더 세션 컨트롤 전용 `## Rationale` R 항목 부재(내용은 §2/§3.1 산문에 충실) — 선택.
- plan_coherence: EIA gaps plan 항목17 이 conversationThread 확장 미반영(모순 아님) — 다음 spec-sync.
- naming_collision: `endConversation` 내부 WS vs 외부 EIA 독립 재사용(의도된 도메인 정합).
- convention_compliance(복원): payload 번들 무관 conventions 우선 채택·pre-existing DTO 네이밍 drift — 모두 INFO.

## 결론
BLOCK: NO. 본 PR 유발 WARNING 2건(#1·#3) 반영, pre-existing #2 defer. 편집 postdate 위해 --impl-done 재실행.
