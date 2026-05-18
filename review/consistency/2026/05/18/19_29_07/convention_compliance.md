# Convention Compliance Check — `spec/2-navigation/4-integration.md`

검토 모드: 구현 착수 전 검토 (--impl-prep)

---

## 발견사항

- **[INFO]** `## Rationale` 섹션이 문서 끝에 존재하지만 상단에 `## Overview` 섹션이 명시적으로 없음
  - target 위치: 파일 최상단 (제목 바로 뒤)
  - 위반 규약: `CLAUDE.md §프로젝트 스펙 문서` — "각 spec 문서는 권장 3섹션 구성(Overview / 본문 / Rationale)을 따른다"
  - 상세: 파일 첫 번째 섹션이 `## 1. 라우트 구성` 이며 Overview 섹션이 없다. Rationale 은 문서 끝에 잘 배치되어 있으나 Overview(제품 정의·사용자 가치) 섹션이 누락됐다. 단일 spec 파일 영역이라 `_product-overview.md` 가 아닌 본 파일에 직접 `## Overview` 를 두어야 한다.
  - 제안: 파일 최상단(제목과 `---` 구분선 아래)에 `## Overview` 섹션을 추가해 "통합 관리 화면의 목적·사용자 가치·요구사항 요약"을 1~3단락으로 기술한다. 이미 `_product-overview.md#34-integration-통합` 에 제품 정의가 있다면 해당 내용을 단 한 줄 참조(`> 제품 정의: [_product-overview.md §3.4]`) 로 연결하는 것도 허용된다.

- **[INFO]** `§9.4 공통 응답 포맷` 의 성공 응답 설명이 `spec/conventions/swagger.md §5` 의 공식 래퍼 헬퍼 규약과 미묘하게 다른 서술
  - target 위치: `## 9. API § 9.4 공통 응답 포맷` (`{ data: ... }` 또는 `{ data: ..., pagination: ... }`)
  - 위반 규약: `spec/conventions/swagger.md §5-2` — `ApiOkPaginatedResponse` 의 응답 shape 는 `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }`
  - 상세: §9.4 에 기술된 `{ data: ..., pagination: ... }` 는 실제 컨벤션의 `{ data: { data: [], pagination: {...} } }` 와 구조적으로 다르다. 컨벤션은 pagination 이 outer 수준이 아니라 inner `data` 객체 안에 중첩된다. 다만 본 spec 이 "기존 컨벤션 준수" 를 참조(`§9.1`)하고 있으므로 의도된 축약 표기일 가능성이 있다.
  - 제안: §9.4 의 페이지네이션 응답 표기를 `{ data: { data: [...], pagination: { page, limit, totalItems, totalPages } } }` 로 정확히 일치시키거나, 단순히 "페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 참조" 로 위임하고 인라인 예시를 제거한다.

- **[INFO]** `§6 상태 전이` 다이어그램 내 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `oauth_invalid_scope` 값이 `snake_case` 로 기술되어 있으나, `§9.4` 에러 코드는 `UPPER_SNAKE_CASE` 사용 — 두 섹션 간 표기 혼재
  - target 위치: `§6 상태 전이` 표의 `status_reason` 열거값 vs `§9.4` 에러 코드
  - 위반 규약: `spec/conventions/node-output.md §3.2` — "`code` 는 `UPPER_SNAKE_CASE`"
  - 상세: `status_reason` 은 DB 컬럼 값(snake_case)이고 API 응답 error code 는 UPPER_SNAKE_CASE 로 분리된다는 사실이 Rationale 에 명문화되어 있어 의도된 구분이다. 다만 독자가 처음 §6 표를 볼 때 `snake_case` 값이 API error code 가 아니라 DB 저장값임을 즉시 파악하기 어렵다. 규약 자체 위반은 아니지만 명확성 개선 여지가 있다.
  - 제안: §6 표의 `status_reason` 열 헤더 또는 각주에 "(DB 저장값, snake_case — API error code 는 UPPER_SNAKE_CASE, §9.4 참조)" 를 명시한다.

---

## 요약

`spec/2-navigation/4-integration.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. API endpoint 명명(`/api/integrations/...`)·에러 코드(`UPPER_SNAKE_CASE`)·응답 래퍼 참조(`§9.1`)·Rationale 섹션 배치 모두 규약 범위 안에 있다. 발견된 사항은 모두 INFO 수준으로, `## Overview` 섹션 누락(권장 3섹션 구성)과 §9.4 의 페이지네이션 응답 표기 약식화, §6 DB 저장값 표기 혼재 가독성 문제에 그친다. CRITICAL·WARNING 수준 위반은 없다.

---

## 위험도

LOW
