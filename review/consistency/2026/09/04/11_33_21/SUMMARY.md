# Consistency SUMMARY — `--impl-done spec/5-system/`

- 세션: `review/consistency/2026/09/04/11_33_21`
- 대상: swagger DTO 계약 거짓 9곳 + 신설 가드 + 형제 가드 정규화
- checker 5/5 완료

## BLOCK: NO

Critical 0건.

## Warning (2건 — 모두 이 턴에 처리)

### W1 (plan_coherence) — 옮겨진 plan 경로를 가리키는 stale 주석 2곳

`source-scan.ts:190` · `nullable-type-lie-cast.spec.ts:22` 가
`plan/in-progress/entity-nullable-column-type-mismatch.md` 를 *"다음 배치 기준"* 이라 적는데,
그 plan 은 `#1277` 에서 `complete/` 로 이동·종결됐다. **경로만이 아니라 서술이 틀렸다** —
"다음 배치" 역할은 `spec-draft-nullable-notation-followups.md` 의 §5.4 drift 항목으로 넘어갔다.
이번 diff 가 두 파일 중 하나를 직접 편집하고도 인접 주석을 안 봤다는 지적도 정확하다.

**조치**: 두 곳 모두 완료 이력(`complete/`) + 실제 다음 배치 추적처로 다시 씀.

### W2 (cross_spec) — §5.4 의 스코프가 응답 전용인데 요청 DTO 에 인용됨

세 갈래로 조치했다:

1. **CHANGELOG 문구 정정** — `llmConfigId`(요청 DTO)에 대해 *"형태는 §5.4 를 따랐다"* 라고
   적었던 것을 뺐다. 고친 것은 "OpenAPI 선언과 TS 타입의 내부 일치" 뿐이고, 데코레이터 선택은
   손대지 않는 것이 맞다 — §5.4 는 응답 바디 전용이고 이건 요청 DTO 다.
2. **drift 배치에서 요청 DTO 카테고리째 제외** (plan). 104곳에 `update-*.dto.ts` 류 PATCH
   tri-state 가 섞여 있어, 기계적으로 `?` 를 떼면 **"필드 생략 = 값 불변" 계약이 깨진다.**
   표기 문제가 아니라 실제 회귀다. 착수 첫 단계를 "요청/응답 가르기" 로 명시했다.
3. **§5.4 스코프 문구 추가를 planner 항목으로 등재.** spec 본문 수정이라 developer 권한 밖이다.

## 판정

Critical 0 → **BLOCK: NO**. Warning 2건은 이 턴에 전부 조치 또는 등재.
