# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/swagger.md` (변경된 유일한 conventions 파일)
diff-base: `origin/main`
변경 범위: §5-2 헬퍼 표 `ApiOkPaginatedResponse` 행 수정 + §2-5 pass-through 예외 추가 + `## Rationale §5` 신설
이전 세션 W-1 해소 여부 검증 포함 (19_31_47 → RESOLVED → 본 fresh check)

---

## 발견사항

### CRITICAL — 없음

---

### WARNING — 없음

이전 세션(19_31_47)의 W-1 `§2-5 모든 성공 응답 보편 선언 vs pass-through 예외 모순`은 **RESOLVED** 됐다.

- §2-5 에 "단, 반환 객체에 이미 top-level `data` 키가 있으면(`'data' in data` 분기) 추가 래핑 없이 그대로 pass-through 합니다" 예외 문장 추가됨
- §5-2 표가 단일 래핑(`{ data: <Dto>[], pagination: { ... } }`) 으로 교정됐으며 §2-5 pass-through 역참조 포함
- `## Rationale §5 ApiOkPaginatedResponse single-wrap (pass-through 예외)` 항목이 신설돼 wire shape 근거·구 double-wrap=버그·"되돌리지 말 것" 금지 명시

내부 일관성 검증:
- §2-5 ↔ §5-2: `'data' in data` pass-through 설명 ↔ single-wrap 표기 — 일치 ✓
- §5-2 ↔ §Rationale §5: 표 단일 래핑 ↔ Rationale 의 wire shape 선언 — 일치 ✓
- §6 "서비스 실제 반환 형태와 다른 스키마는 버그" ↔ §5-2 수정된 단일 래핑 — 일치 ✓ (구 이중 래핑이 §6 위반이었으므로, 수정이 오히려 일관성 회복)

---

### INFO

- **[INFO]** `swagger.md` 에 명시적 `## Overview` 섹션 없음 (pre-existing, 이번 변경 미도입)
  - target 위치: `spec/conventions/swagger.md` 최상단
  - 위반 규약: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: `audit-actions.md` 등 다른 convention 문서는 `## Overview` / 본문 / `## Rationale` 3섹션 구조를 따르나, `swagger.md` 는 도입부 산문 + §0~§6 + Rationale 구조이며 `## Overview` 헤딩이 없다. 이번 변경과 무관한 pre-existing 항목 (이전 세션 I-3 carryover).
  - 제안: 이번 PR 범위 외. 별도 정비 기회에 `## Overview` 섹션 추가 검토.

- **[INFO]** §6 레거시 패턴 목록에 구 double-wrap 패턴 미명시
  - target 위치: `spec/conventions/swagger.md §6 레거시 패턴 제거`
  - 상세: §6 은 `{ data: { items, totalItems, page, limit } }` 형태의 잘못된 스키마를 명시하나, 이번에 버그로 확인된 `{ data: { data: <Dto>[], pagination } }` 이중 래핑 패턴이 §6 에 추가되지 않았다. 실질적 커버는 §Rationale §5 의 "single-wrap 을 double-wrap 으로 되돌리지 말 것" 으로 이미 돼 있으므로 차단급 누락은 아니다.
  - 제안: §6 에 "이중 래핑 `{ data: { data: <Dto>[], pagination } }` 도 버그 — `ApiOkPaginatedResponse` 가 이미 단일 래핑을 선언한다" 한 줄 추가하면 §6 자체가 단독으로 금지 패턴을 완결하게 됨. 선택적 보강.

---

## 요약

이전 세션(19_31_47)에서 제기된 W-1(§2-5 보편 선언 vs pass-through 예외 외형 모순)은 §2-5 예외 추가·§5-2 단일 래핑 교정·Rationale §5 신설로 완전히 해소됐다. 현재 `spec/conventions/swagger.md` 는 CRITICAL·WARNING 발견 없이 정식 규약에 부합한다. 남는 항목은 pre-existing `## Overview` 미존재(INFO, 범위 외)와 §6 에 이중 래핑 금지 미명시(INFO, Rationale §5 로 실질 커버됨) 두 건이며 둘 다 차단 사유가 아니다.

## 위험도

NONE
