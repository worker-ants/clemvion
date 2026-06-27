# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done (scope: spec/conventions/, diff-base: origin/main)
**검토 대상 변경**: `spec/conventions/swagger.md §5-2` 표의 `ApiOkPaginatedResponse` 설명 정정

---

## 검토 대상 변경 요약

`spec/conventions/swagger.md` 의 `§5-2 공용 래퍼 헬퍼` 표에서 `ApiOkPaginatedResponse` 응답 shape 설명이 수정됐다.

- 변경 전: `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }` (double-wrap)
- 변경 후: `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` (single-wrap, `PaginatedResponseDto`가 `data` 키를 가져 `TransformInterceptor` pass-through)

---

## 발견사항

충돌 없음. 이하는 확인된 정합 사항이다.

### 확인 — 변경이 기존 불일치를 해소함

- **INFO** `spec/5-system/2-api-convention.md §5.2` 와 정합 복원
  - target 위치: `spec/conventions/swagger.md §5-2` 표 `ApiOkPaginatedResponse` 행
  - 관련 spec: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/spec/5-system/2-api-convention.md` §5.2 목록 응답
  - 상세: `spec/5-system/2-api-convention.md §5.2` 는 목록 응답 wire shape 를 `{ "data": [...], "pagination": { "page", "limit", "totalItems", "totalPages" } }` 으로 정의한다. 변경 전 `swagger.md §5-2` 는 `{ data: { data: <Dto>[], pagination: ... } }` (data-in-data 이중 래핑) 를 명시해 api-convention 과 충돌하고 있었다. 이번 수정으로 두 spec 이 단일-wrap 형태로 일치한다.
  - 상태: 충돌 해소 (기존 충돌이 이번 변경으로 정정됨)

- **INFO** `swagger.md §6` 레거시 패턴 제거 절과 내부 일관성 회복
  - target 위치: `spec/conventions/swagger.md §5-2` 표
  - 관련 위치: 동일 파일 §6 레거시 패턴 제거
  - 상세: §6 은 변경 전에도 "`{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`) 와 다른 스키마는 버그" 라고 명시했다. 즉 §6 이 이미 single-wrap 을 올바른 형태로 규정하고 있었으나 §5-2 표만 이중 래핑을 문서화해 동일 파일 내 불일치가 있었다. 이번 수정으로 §5-2 와 §6 이 일치한다.
  - 상태: 내부 불일치 해소

### 교차 spec 스캔 결과 — 충돌 없음

| 검토 대상 spec | 참조 내용 | 결과 |
|---|---|---|
| `spec/5-system/2-api-convention.md §5.2` | 목록 응답 wire shape `{ data: [...], pagination: {...} }` | 신규 표기와 일치 |
| `spec/2-navigation/4-integration.md` (line 843) | `{ data: ... }` or `{ data: ..., pagination: ... }` 컨벤션 준수 언급 | 신규 표기와 충돌 없음 |
| `spec/5-system/14-external-interaction-api.md` (line 855) | swagger §5 규약 일반 참조 (§5-2 특정 shape 비정의) | 영향 없음 |
| `spec/data-flow/8-notifications.md` | swagger §5-1 위치 패턴 참조 | 영향 없음 |
| `spec/3-workflow-editor/4-ai-assistant.md` | `PaginatedResponseDto` 를 오버스펙으로 언급만 (shape 재정의 없음) | 영향 없음 |
| `spec/5-system/2-api-convention.md §8.2` | cursor 기반 페이지네이션 (별도 endpoint, `ApiOkPaginatedResponse` 미사용) | 영향 없음 |

---

## 요약

`spec/conventions/swagger.md §5-2` 의 `ApiOkPaginatedResponse` shape 정정은 cross-spec 충돌을 유발하지 않는다. 오히려 변경 이전에 존재하던 두 가지 불일치 — (1) `spec/5-system/2-api-convention.md §5.2` 의 목록 응답 shape 와의 모순, (2) 동일 파일 §6 레거시 패턴 제거 절의 서술과의 내부 모순 — 를 이번 수정이 해소한다. 다른 spec 영역은 `ApiOkPaginatedResponse` 의 구체적 shape 를 독자 재정의하지 않으며, swagger §5 규약에 대한 일반 참조만 포함하므로 변경의 영향이 없다.

---

## 위험도

NONE
