# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/2-api-convention.md §5.2` (callout note 1건 추가) + `codebase/backend/src/common/swagger/api-wrapped.{ts,spec.ts}` (JSDoc NOTE + 테스트 하드닝)
검토 기준: origin/main → HEAD (commit 390147aa7)

---

## 발견사항

발견된 CRITICAL/WARNING 항목 없음.

아래 INFO 항목은 신규 내용 추가 과정에서 인접 참조 관계를 확인한 결과이며, 모순 없이 상호 일관적이다.

---

- **[INFO]** `api-convention.md §5.2` 신규 note — `swagger.md §2-5` 링크 앵커 유효성
  - target 위치: `spec/5-system/2-api-convention.md` L139, 추가된 callout note
  - 충돌 대상: `spec/conventions/swagger.md §2-5. 응답 wrapping` (L204)
  - 상세: note 가 `../conventions/swagger.md#2-5-응답-wrapping` 를 참조한다. 앵커 `### 2-5. 응답 wrapping` 는 실제 존재하며, 내용(TransformInterceptor pass-through / single-wrap / `'data' in data` 분기)이 note 의 요약과 정확히 일치한다. 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `spec/1-data-model.md` TestDataset 의 TransformInterceptor 서술 — 신규 note 와의 정합
  - target 위치: `spec/5-system/2-api-convention.md` L139
  - 충돌 대상: `spec/1-data-model.md` L528 (`data` 컬럼 → `input` DTO 속성 rename, "TransformInterceptor 의 top-level `data` 키 래핑 휴리스틱 충돌 회피" 주석)
  - 상세: 신규 note 가 기술한 "이미 `data` 키를 가진 객체는 TransformInterceptor 가 pass-through" 규칙을, data-model spec 은 반대 측면(pass-through 를 피하기 위해 필드 이름을 `data` → `input` 으로 바꿨다)에서 이미 설명하고 있다. 동일 메커니즘의 양면을 각각 서술한 것으로 모순 없음.
  - 제안: 현행 유지.

- **[INFO]** `spec/2-navigation/14-execution-history.md` 목록 응답 예시 — 단일 래핑 형식 일치
  - target 위치: `spec/5-system/2-api-convention.md` L139 (note: `data`·`pagination` top-level 형제)
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` L418–452
  - 상세: execution history 목록 API 응답 예시가 `{ "data": [...], "pagination": { "page", "limit", "totalItems", "totalPages" } }` 구조로 기술되어 있으며, 신규 note 의 single-wrap 단언과 정확히 일치한다. 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `api-wrapped.ts` JSDoc NOTE — `wrapPaginatedSchema` pagination 리터럴 필드 수동 동기화
  - target 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` (추가된 NOTE 주석)
  - 충돌 대상: `spec/conventions/swagger.md §5 Rationale` (L316–317)
  - 상세: JSDoc NOTE 는 `wrapPaginatedSchema` 내 pagination 필드 리터럴(`page`/`limit`/`totalItems`/`totalPages`)이 `PaginatedResponseDto`/`PaginationMeta` 와 **수동 동기화**임을 명시한다. `swagger.md §5 Rationale` 도 `api-convention §5.2` 가 single-wrap SoT 임을 전제하며, spec 상 pagination 필드 목록은 `swagger.md §5-2` 표(`page, limit, totalItems, totalPages`)에서 일치한다. 코드 내 리터럴이 spec 에 명시된 4개 필드와 동일하므로 현재 충돌 없음. 다만 NOTE 가 없었다면 drift 위험 지점이 될 수 있었으나, NOTE 가 추가된 자체가 drift 방어책이다.
  - 제안: 현행 유지. 향후 `PaginationMeta` 필드 변경 시 spec/conventions/swagger.md §5-2 표 + 코드 리터럴을 동시 갱신하는 절차를 `spec/conventions/swagger.md §5-4 체크리스트` 에 명시하면 더 견고해진다 (OPTIONAL 개선).

---

## 요약

이번 변경의 실질적 spec 수정은 `spec/5-system/2-api-convention.md §5.2` 에 추가된 2줄 callout note 1건이다. 이 note 는 페이지네이션 응답의 single-wrap 메커니즘(`PaginatedResponseDto` + `TransformInterceptor` pass-through)을 설명하고, 이미 동일 내용을 상세 기술하고 있는 `spec/conventions/swagger.md §2-5` 를 정확한 앵커로 참조한다. 인접 spec 영역(`1-data-model.md`·`14-execution-history.md`·`4-integration.md §9.4`·`swagger.md §5 Rationale`) 모두 동일한 single-wrap 사실을 상정하며, 신규 note 와 어떤 면에서도 모순하지 않는다. 코드 측 변경(`api-wrapped.ts` JSDoc NOTE·`api-wrapped.spec.ts` 테스트 단언 추가)은 spec 정의의 구현 보강이며 spec 층 모순을 유발하지 않는다.

## 위험도

NONE
