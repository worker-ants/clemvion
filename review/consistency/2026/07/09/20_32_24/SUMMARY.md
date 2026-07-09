# Consistency Check 통합 보고서 (--impl-done 재실행, scope=spec/7-channel-web-chat/)

**BLOCK: NO** — Critical 0. 직전 회차(20_19_59) WARNING 2건(§8.4 소비처·CSS 명명)이 커밋 `e3357d518` 로 해소 확인
(rationale_continuity NONE, naming_collision INFO만). 신규 WARNING 1건(plan-lifecycle 추적) → 본 커밋에서 해소.

## 전체 위험도
**LOW** — Critical 0. WARNING 1(plan 추적 hygiene) → spec Planned 명문화로 해소.

## Critical
없음.

## 경고 (WARNING) 및 처리
| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | plan_coherence | 완료 plan "잔여/후속" 3건(presentation shape 매핑·host resetSession booting 엣지·durable thread redaction/orphan GC)이 in-progress 미등록 → complete 이관 시 추적 표면 상실. 특히 host resetSession booting caveat "필수" | **수정** — 3건을 **spec 본문 "알려진 제약(Planned)"** 로 durable 명문화: (a) 1-widget-app §2 presentation 행, (b) §3.1 새 대화 행(host-API booting 엣지), (c) EIA §R17·§3.1(redaction/orphan). 완료 plan 잔여/후속 을 이 spec 위치 참조로 갱신 |

## 참고 (INFO) — 처리/defer
- rationale_continuity: 헤더 세션 컨트롤 전용 R7 항목 부재(내용은 §2/§3.1 산문 근거) — 선택 defer.
- convention_compliance(journal 복원): §2 dangling `(§4)` self-ref — **수정**(§1.6 로 정정). DTO 파일명 접미사·evidence code: 링크·Rationale 번호 공백 — pre-existing/저우선 defer.
- naming_collision: `"user_ended"` 위젯 vs ai-turn-orchestrator 그래프 포트 우연 일치(인과 무관) — 저우선 defer(주석은 선택).
- plan_coherence: EIA gaps plan 항목17 conversationThread 미반영(모순 아님) — 다음 spec-sync.

## 결론
BLOCK: NO. plan_coherence WARNING 을 spec Planned 명문화로 해소. dangling `(§4)` INFO 도 정정. 편집 postdate 위해
--impl-done 최종 재실행 → BLOCK: NO 확인 후 push.
