# Cross-Spec 일관성 검토 결과

대상 plan: `plan/in-progress/button-cap-spec-validator.md`
검토 모드: `--plan`
검토 일시: 2026-05-19

---

### 발견사항

- **[CRITICAL]** `spec/4-nodes/6-presentation/1-carousel.md` 가 개정된 cap 을 반영하지 않음
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §작업 항목 (체크박스 완료 표기)
  - 충돌 대상: `spec/4-nodes/6-presentation/1-carousel.md` 라인 22, 24, 35, 417, 432
  - 상세: `0-common.md` §1.1 은 2026-05-19 변경으로 "nodrode당 5개 / carousel itemButtons 5개" 로 정확히 기술되어 있다. 그러나 `1-carousel.md` 는 여전히 구 값을 여러 곳에서 참조한다.
    - 라인 22: `itemButtons` 설명에 "최대 4개" (→ 5개로 교체 필요)
    - 라인 24: `buttons` 설명에 "최대 10개" (→ 5개로 교체 필요)
    - 라인 35: `buttons` 설명에 "최대 4개" (→ 5개로 교체 필요)
    - 라인 417: UI 설명에 "최대 10개 버튼 (글로벌). per-item 은 ItemDef 당 최대 4개 (static), `itemButtons` 도 최대 4개 (dynamic)" (전체 교체 필요)
    - 라인 432: 에러 코드 표에서 "per-item 버튼 ≥5개 → `items[i]: maximum 4 buttons per item` / `itemButtons: maximum 4 buttons per item`" (에러 메시지 자체가 4로 하드코딩되어 있으므로 실제 backend 에러 문자열과 비교 시 불일치 발생. backend `carousel.schema.ts` 의 실제 출력은 `maximum 5 buttons per item`.)
  - 제안: `1-carousel.md` 의 위 5개 위치를 모두 5/5로 교체. 특히 에러 코드 표(라인 432)의 메시지를 backend 출력과 일치하도록 `maximum 5 buttons per item` 으로 수정.

- **[CRITICAL]** `spec/4-nodes/6-presentation/2-table.md` 에러 표가 구 cap(10개) 을 명시
  - target 위치: plan §작업 항목 (2-table.md 에 대한 직접 언급 없음)
  - 충돌 대상: `spec/4-nodes/6-presentation/2-table.md` 라인 353
  - 상세: 에러 조건 표에 "버튼 라벨 누락 / link URL 누락 / port + URL 충돌 / 버튼 ID 중복 / **10개 초과**" 라고 명시되어 있다. `0-common.md` §1.1 은 5개로 변경되었으므로 이 표현이 직접 모순된다. Table 은 `validateButtons` 를 공통 함수로 위임하므로 실제 runtime 은 5개 초과 시 에러를 낸다.
  - 제안: `2-table.md` 라인 353 의 "10개 초과" → "5개 초과" 로 수정.

- **[CRITICAL]** `spec/4-nodes/_product-overview.md` ND-CL-08 요구사항이 구 cap(4개) 을 명시
  - target 위치: plan 에서 언급 없음 (미식별 영역)
  - 충돌 대상: `spec/4-nodes/_product-overview.md` 라인 314
  - 상세: ND-CL-08 요구사항 정의에 "최대 4개/아이템" 이 박혀 있다. 본 plan 이 결정한 cap(5개)과 직접 모순된다. product-overview 의 요구사항 표는 기술 명세의 SSOT 이므로 그대로 남아있으면 향후 구현자·검토자가 오해할 수 있다.
  - 제안: `spec/4-nodes/_product-overview.md` ND-CL-08 행의 "최대 4개/아이템" → "최대 5개/아이템" 으로 수정.

- **[WARNING]** plan §작업 항목이 `1-carousel.md`, `2-table.md`, `_product-overview.md` 갱신을 누락
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §작업 항목
  - 충돌 대상: 위 CRITICAL 3건에서 식별된 파일들
  - 상세: plan 은 `0-common.md` 변경만 명시하고, 동일 cap 값을 인라인으로 담은 `1-carousel.md` · `2-table.md` · `4-nodes/_product-overview.md` 를 갱신 대상으로 포함하지 않았다. 결과적으로 CRITICAL 충돌이 plan 완료 후에도 spec 내부에 잔류하게 된다.
  - 제안: plan 에 위 세 파일의 갱신 항목을 `[ ]` 체크박스로 추가.

- **[INFO]** `spec/4-nodes/6-presentation/1-carousel.md` 에러 코드 표의 `≥5개` 임계 표현이 혼란 유발 가능
  - target 위치: `1-carousel.md` 라인 432
  - 충돌 대상: backend `carousel.schema.ts` `validateCarouselItemButtons` — `buttons.length > MAX_BUTTONS_PER_NODE` (strictly greater than 5 = reject)
  - 상세: spec 에러 표는 "per-item 버튼 ≥5개" 를 에러 조건으로 표기하고 있으나, backend 로직은 `> 5` (즉 6개부터 에러). 5개는 허용이므로 spec 의 "≥5" 는 잘못된 경계 조건이다. 이 불일치는 테스트(`carousel.schema.spec.ts` 라인 198: "allows exactly 5 per-item buttons") 와도 충돌한다.
  - 제안: `1-carousel.md` 라인 432 에러 조건을 "per-item 버튼 ≥6개" 로 수정.

---

### 요약

`0-common.md` 와 backend/frontend 코드(button.types.ts, carousel.schema.ts, button-list-editor.tsx, 테스트)는 5개 cap 으로 일관되게 정렬되어 있다. 그러나 plan 이 `1-carousel.md` · `2-table.md` · `spec/4-nodes/_product-overview.md` 의 인라인 cap 값 갱신을 작업 항목으로 명시하지 않아, 이 세 파일에 구 값(4, 10)이 그대로 남아 있다. CRITICAL 3건은 동일 도메인 엔티티(버튼 cap)에 대해 spec 문서끼리 직접 모순되는 사례로, plan 이 완료 판정을 받아도 spec 내부 일관성이 훼손된 상태로 PR 이 머지될 위험이 있다. 계층 책임 충돌이나 RBAC·API 계약 충돌은 없으며, 충돌 범위는 Presentation 노드 버튼 수 제한 값의 spec 내 동기화 문제에 집중된다.

### 위험도

HIGH
