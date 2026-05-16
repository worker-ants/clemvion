# 정식 규약 준수 Review — `spec/2-navigation/4-integration.md`

검토일: 2026-05-16
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. **[WARNING]** `## Rationale` 섹션이 존재하나 `## Overview` 섹션이 없음
- **target 위치**: 문서 최상단 (`# Spec: 통합 관리 화면`)
- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 — 권장 3섹션 구성 (Overview / 본문 / Rationale). "각 spec 문서는 권장 3섹션 구성을 따른다."
- **상세**: 문서는 `## Rationale` 섹션(§962 이후)으로 결론 배경을 잘 다루고 있으나, 영역의 사용자 가치·요구사항·목표를 기술하는 `## Overview (제품 정의)` 섹션이 누락되어 있다. 본 파일은 `spec/2-navigation/` 하위의 numbered spec 파일(`4-integration.md`)이므로 단일 파일 내 `## Overview` 섹션이 권장된다. `_product-overview.md`가 별도로 존재하기 때문에 본 파일에서 Overview를 생략한 것으로 보이지만, 규약은 "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다"고 명시하고 있다. `spec/2-navigation/`는 다중 spec 파일을 가진 영역이므로 `_product-overview.md`에 Overview를 별도 두는 패턴이 적용될 수 있으나, 그렇다면 본 문서 상단에 `_product-overview.md` 링크만으로 충분한지 명시적 안내가 없다. 링크는 있으나 명시적 Overview 섹션이나 짧은 제품 정의 문단이 없어 문서 자립도가 낮다.
- **제안**: 본문 상단(라우트 구성 앞)에 `## Overview` 섹션을 추가하거나, 문서 상단의 링크 블록에 "제품 정의는 `_product-overview.md#34-integration-통합` 참조" 안내를 소절 형태로 명시한다. 또는 `_product-overview.md`가 다중 spec 영역 Overview를 책임지는 패턴이 본 파일에도 의도적으로 적용된 것이라면, 규약 자체에 "numbered spec 파일은 다중 영역일 때 Overview 생략 가능" 예외를 명문화하는 것을 권장한다.

---

### 2. **[WARNING]** 에러 응답 포맷이 규약의 `{ error: { code, message, details? } }` 구조와 불일치
- **target 위치**: §9.4 공통 응답 포맷 — "실패: `{ code, message, details? }`"
- **위반 규약**: `spec/conventions/swagger.md` §2-4 / `spec/5-system/2-api-convention.md` §5.3 — 에러 응답은 `{ "error": { "code": "...", "message": "...", "details": [...] } }` 형식이 정식 규약.
- **상세**: §9.4에서 실패 응답을 `{ code, message, details? }` (최상위 필드 나열)로 표기하고 있으나, 정식 API 규약(`spec/5-system/2-api-convention.md §5.3`)은 에러를 반드시 `{ "error": { ... } }` 래퍼 안에 담도록 정의한다. swagger.md §2-5는 성공 응답이 `TransformInterceptor`로 `{ data: ... }` 래핑됨을 명시한다. 에러 응답 래퍼 구조 상이는 구현·문서 일관성을 해친다. swagger.md §2-4의 `@ApiConflictResponse` 선례도 본 에러 포맷과 연결된다.
- **제안**: §9.4의 실패 응답 표기를 `{ "error": { "code": "...", "message": "...", "details"?: ... } }` 형식으로 수정한다. 단, 실제 `GlobalExceptionFilter`의 출력이 `{ code, message }` 최상위 형식이라면 `spec/5-system/2-api-convention.md §5.3`을 현행 구현에 맞게 갱신해야 한다. 두 spec 사이의 모순을 먼저 정리한 뒤 본 문서에 반영한다.

---

### 3. **[INFO]** API endpoint 명명 — URL 쿼리 파라미터 `serviceType` camelCase vs 규약 케밥/snake 경향
- **target 위치**: §9.1 목록·CRUD — `GET /api/integrations` 쿼리 파라미터 `serviceType`
- **위반 규약**: `spec/5-system/2-api-convention.md` §2.2 — "케밥 케이스" 규칙은 URL 경로에 명시되어 있으나, 쿼리 파라미터 케이스에 대한 명시적 규칙은 없음. 다만 §4.1에서 `sort`, `order`, `search` 등 모두 snake/lowercase 단순어를 사용하고 있어 camelCase(`serviceType`)는 이질적이다.
- **상세**: `serviceType`은 camelCase이나 `page`, `limit`, `sort`, `order`, `search` 등 기존 파라미터들은 모두 lowercase/snake_case 스타일이다. 또한 §2.3 `serviceType`과 §9.1의 `status` 파라미터 허용값 목록(`connected`, `expiring`, `expired`, `error`, `attention`)은 모두 snake/lowercase인데 `serviceType`만 camelCase로 일관성이 어긋난다.
- **제안**: 쿼리 파라미터를 `service_type` 또는 `serviceType` 중 하나로 프로젝트 전체를 통일하고, API 규약(`spec/5-system/2-api-convention.md`)에 쿼리 파라미터 케이스 규칙을 명문화한다. 현행 다른 API와 `serviceType`이 이미 정합하다면 INFO로 무시 가능.

---

### 4. **[INFO]** `§9.4 공통 응답 포맷` — 성공 응답 래퍼 언급이 모호
- **target 위치**: §9.4 — "성공: `{ data: ... }` 또는 `{ data: ..., pagination: ... }` (기존 컨벤션 준수)"
- **위반 규약**: `spec/conventions/swagger.md` §5-2 — `ApiOkPaginatedResponse`의 정확한 래퍼 형식은 `{ data: { data: [...], pagination: { page, limit, totalItems, totalPages } } }` (이중 래핑). `spec/5-system/2-api-convention.md §5.2`는 `{ data: [...], pagination: { ... } }` (단일 래핑).
- **상세**: 두 규약 문서 간에도 pagination 래퍼 구조가 서로 다르다 (`swagger.md §5-2`의 `ApiOkPaginatedResponse`는 이중 래핑, API 규약 §5.2는 단일 래핑). 본 target 문서는 "기존 컨벤션 준수"로만 언급해 어느 규약을 따르는지 불명확하다. 단, 이 불일치는 target 문서보다 두 convention 문서 간 모순이 근본 원인이다.
- **제안**: target 문서 §9.4는 "페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수"를 명시하고 있으므로(§9.1에 이미 참조 있음) 이 링크로 일단 충분하다. 근본 해결은 `swagger.md §5-2`와 `spec/5-system/2-api-convention.md §5.2`의 pagination 래퍼 형식을 일치시키는 convention 갱신이 필요하다.

---

### 5. **[INFO]** 문서 내 `prd/`, `memory/` 경로 사용 여부 — 없음 (이상 없음)
- **target 위치**: 전체 문서
- **위반 규약**: `CLAUDE.md` — 옛 `prd/`, `memory/`, `user_memo/` 경로 사용 금지.
- **상세**: 문서 전체에서 옛 `prd/`, `memory/`, `user_memo/` 경로를 사용하지 않는다. 관련 링크는 모두 `spec/`, `../1-data-model.md`, `../4-nodes/`, `../5-system/` 등 정식 경로를 사용하고 있어 이상 없음.
- **제안**: 해당 없음.

---

### 6. **[INFO]** Rationale 내 `review/consistency/` 경로 참조 — 과거 flat 형식 경로
- **target 위치**: §Rationale — "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 항: `(참고: review/consistency/2026/05/14/18_23_55)`
- **위반 규약**: `CLAUDE.md` 명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO). 언급된 경로 `review/consistency/2026/05/14/18_23_55`는 nested ISO 형식으로 보이나 끝에 `/` 가 없고 파일명이 없어 경로가 불완전하다.
- **상세**: 해당 경로는 기록용 참조이므로 실제 경로 이동을 강제하지는 않는다(`CLAUDE.md`도 "역사 기록" 성격의 review 문서는 옛 경로 그대로 두도록 허용). 다만 경로 형식이 올바른 nested ISO이고 단지 trailing slash와 파일명이 생략된 것이므로 기술적 위반이라기보다 표기 부정확이다.
- **제안**: 참조 형식을 `review/consistency/2026/05/14/18_23_55/SUMMARY.md` 처럼 완전한 경로로 기재하거나, 단순 날짜 참조(`2026-05-14 일관성 검토`)로 단순화한다.

---

## 요약

`spec/2-navigation/4-integration.md`는 전반적으로 정식 규약을 충실히 따르고 있다. 파일명(`4-integration.md`)은 숫자 prefix 컨벤션에 정합하고, `## Rationale` 섹션이 적절히 배치되어 있으며, 옛 `prd/`·`memory/` 경로 사용은 없다. API 엔드포인트 경로(`/api/integrations/...`, `/api/3rd-party/...`)는 복수형·케밥 케이스 규칙을 준수한다. 주요 지적은 두 가지다: (1) 다중 spec 파일 영역에서 `_product-overview.md`가 별도로 존재함에도 `## Overview` 섹션이 본 문서에 없어 권장 3섹션 구성이 충족되지 않는다는 점, (2) §9.4의 에러 응답 포맷 표기(`{ code, message, details? }` 최상위 나열)가 정식 API 규약의 `{ error: { ... } }` 래퍼 구조와 불일치한다는 점. 두 사항 모두 규약 갱신 또는 문서 수정으로 명확히 해소할 수 있으며, 다른 시스템의 invariant를 직접 파괴하는 CRITICAL 수준 위반은 발견되지 않았다.

---

## 위험도

LOW
