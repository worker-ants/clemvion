# Consistency Check 통합 보고서 — HMAC raw-value 재정정 draft

**BLOCK: NO** (3 Critical 모두 false positive / spec-first workflow 정상 단계)

- 대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
- 모드: spec draft (--spec)
- 검토 일시: 2026-05-16T14:06:49
- Checker: 5/5 success

## Critical 분석

| # | Checker | 발견 | 분류 | 조치 |
|---|---------|------|------|------|
| 1 | cross_spec | CHANGELOG/Rationale 삽입 앵커 "Cafe24 App URL 상세 페이지 표시" 부재 | **False positive** — checker corpus 가 PR #89 머지 전 상태. 실제로는 spec/2-navigation/4-integration.md line 1152 에 존재 | 없음 (draft 유지) |
| 2 | cross_spec | spec 정정과 백엔드 구현 불일치 | **Spec-first workflow 정상 단계** — 본 PR 의 다음 단계 (developer skill) 가 코드 동기 수정 예정 (`buildHmacMessage`, `formUrlEncode` 제거) | 본 PR 하나로 spec+code+test 동시 머지 |
| 3 | cross_spec | self-fulfilling HMAC 테스트가 신규 spec 검증 못 함 | **Spec-first workflow 정상 단계** — developer skill 이 `formUrlEncodeForTest` 헬퍼 제거 + 사용자 실제 URL 회귀 테스트 추가 | 동일 PR 의 테스트 단계 |

## Warning / Info

cross_spec / convention_compliance / plan_coherence / naming_collision 의 Warning · Info 항목 대부분이 위 3 Critical 의 부산 — spec 정정 후 backend `buildHmacMessage` 구현 / `formUrlEncodeForTest` 헬퍼 / `accepts HMAC for queries containing space-encoded values` 테스트의 동기 수정 필요. 모두 본 PR 의 developer 단계에서 처리.

rationale_continuity: Critical 0. 옛 SEC H-1 결정 (2026-05-16) 의 번복이지만 명확한 신규 증거 (사용자 실제 URL `%20`) 기반이라 결정 합리성 인정.

naming_collision: 신규 식별자 없음 (`buildHmacMessage` 시그니처 동일 유지, `formUrlEncode` 제거).

## 결론

draft 를 spec 본문에 반영 진행. developer skill 이 후속해서 코드+테스트 동기화.
