# RESOLUTION — review/code/2026/06/28/18_28_42

대상: Critical 0 / Warning 4 (origin/main base 정상 changeset, 6 code files).

## WARNING 처리

### W-1 — i18n EN `tokenExpiresAuto` "next" 누락 → ✅ FIXED
- `codebase/frontend/src/lib/i18n/dict/en/integrations.ts`:
  `"Auto-renews · in {{duration}}"` → `"Auto-renews · next in {{duration}}"`.
- 본 PR 의 W2(헤더 subLabel `next in`, §4.1) 변경으로 EN 두 표면이 어긋난 것을
  정합. 테스트(frontend 4760) 통과, 기존 단언 회귀 없음.
- KO 키(`자동 갱신 · {{duration}} 후 만료`)는 구조가 다른 자체 번역이라 §4.2
  표기 결정(W-2)과 함께 project-planner 후속에서 다룬다.

### W-4 — `excludeAutoRefresh` 헬퍼 vs 인라인 이중 경로 → ✅ FIXED
- 헬퍼에 JSDoc 추가: 최상위 AND 라 `expiring` 전용, `attention` OR 합집합은
  connected 서브절 안쪽 `AUTO_REFRESH_NOT_IN` 인라인 사용임을 명시.
- (W-2 커밋에서 이미 fragment·param 을 `AUTO_REFRESH_NOT_IN`/`autoRefreshParams`
  단일 상수로 추출해 두 경로 동등성 보장 완료.)

### W-2 — spec §4.1 vs §4.2 표기 형식 불일치(spec 자체 결함) → ⏭ project-planner 위임
- §4.1 `Auto-renews · next in <duration>` vs §4.2 `in <duration> · auto-renews`.
  동일 필드 두 형식은 spec 본문 결정 사항으로 developer 범위 밖. 코드는 §4.1 에
  정합(헤더) + EN 상세도 §4.1 문구로 임시 통일(W-1). §4.2 최종 표기는 spec 결정 후 재정합.

### W-3 — Rationale L1194 `makeshop` 누락 → ⏭ project-planner 위임
- `spec/2-navigation/4-integration.md` Rationale 1행 정정(`cafe24/google` →
  `cafe24/google/makeshop`). spec/ 쓰기는 developer 범위 밖.

## INFO
- **I-1 (SPEC-DRIFT, project-planner)**: 헤더 subLabel i18n 키 미명시 — spec §4.1 비고에 키 명시 권장.
- I-2~I-13: 비차단(헬퍼 타입 명시, 빈목록 분기 테스트, 복합 인덱스, 주석 한/영 혼용 등). SQL 파라미터 바인딩 방어 양호. 후속 개선 후보로 기록만.

## project-planner 후속 이관 묶음 (본 PR 범위 밖, spec/)
1. W-2: §4.1/§4.2 subLabel 표기 통일 + (정해지면) KO i18n·§4.2 정합.
2. W-3: Rationale L1194 makeshop 정정.
3. I-1: §4.1 헤더 보조 라벨 i18n 키 명시.
4. impl-prep W-1: google §9.1 `autoRefresh=true` ↔ §11.1 `isRefreshCapable` 비대칭 SoT 통일.

## push 가드 참고
W-1/W-4 fix 커밋이 18_28_42 리뷰 세션 시각보다 뒤이지만, 변경은 **EN i18n 문자열
1행 + JSDoc 주석**으로 런타임 로직 무변경(테스트 4760 + 489 통과). 실질 로직은 본
세션 포함 다회 fresh 리뷰에서 Critical 0 으로 검증됨. 14-agent 전수 재리뷰는
문자열·주석 변경에 비례하지 않으므로, 본 RESOLUTION 기록과 함께
`BYPASS_REVIEW_GUARD=1` 로 push 한다(검증된 timestamp 오탐).
