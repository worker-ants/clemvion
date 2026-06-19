# Consistency Check (--impl-done) — agent-memory model fields → select

**대상**: 구현 코드 diff (`git diff origin/main...HEAD`) vs (동반 갱신된) spec 4문서 + conventions + plan.
**검토자**: cross-spec / convention-compliance / plan-coherence (3종, bg 세션 bgIsolation 으로
checker 는 텍스트 반환 + main 이 본 SUMMARY 기록). naming-collision 은 impl-prep 에서 검증됨(신규
식별자 추가 없음). requirement reviewer(/ai-review)도 spec-impl match 를 독립 PASS 확인.

## BLOCK: NO

3 checker 전부 NO-BLOCK. spec-impl 불일치(Critical) 0.

| checker | verdict | risk |
| --- | --- | --- |
| cross-spec | NO-BLOCK | NONE — spec 4문서 ↔ 구현 전 계층(backend schema/interface, frontend types/registry/widget) 완전 정합. 저장형태·런타임·데이터모델 무변경 → 타 영역 신규 충돌 0 |
| convention | NO-BLOCK | NONE — 신규 위젯 케밥케이스 `<domain>-selector` 준수, backend↔frontend↔spec §2.6.2 3-way 정합, label 불변→backend-labels parity 유지, embeddingModel 행 AI Agent·IE 양 섹션 존재 |
| plan-coherence | NO-BLOCK | LOW — 관련 plan(ai-context-memory-followup-v2, ai-agent-tool-connection-rewrite)과 동일 spec 파일의 직교 절, 미해결 결정 우회 0, 본 worktree frontmatter guard 위반 0 |

## INFO (비차단)
- backend `UiHint.widget` union 의 `multiselect` 누락 — 본 PR 이전 부채(origin/main 동일), 신규
  2위젯은 3-way 정합으로 추가됨. 별도 PR. (plan §Follow-up 등재)
- 유저 가이드 type 표기 KO "모델 선택" vs EN "model select" — 자동 가드 미대상 서술 필드.
  locale-aware 표기로 유지(KO 사용자엔 한국어 힌트). 통일은 선택적 후속.
- spec-draft-integration-mcp-usage.md frontmatter 는 main 에서 merge 전까지 비준수(본 PR 의
  conformance fix 로 해소) — 본문 무변경이라 해당 작업 진행과 무충돌.

## 결론
구현 ↔ spec 정합 확인. SPEC-CONSISTENCY 게이트 통과(BLOCK: NO).
</content>
