# 정식 규약 준수 검토 결과

**대상**: `spec/5-system/16-system-status-api.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일자**: 2026-06-14

---

## 발견사항

### 1. 명명 규약

- **[INFO]** frontmatter `id` 값이 파일 basename 숫자 prefix 를 생략
  - target 위치: frontmatter `id: system-status-api`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1`
  - 상세: `spec-impl-evidence.md §2.1` 에 따르면 `id` 는 "파일 basename(확장자 제외) 기반 권장"이다. 파일명은 `16-system-status-api.md` 이므로 basename 은 `16-system-status-api` 이나 `id` 는 `system-status-api` 로 숫자 prefix 가 생략됐다. 동 규약에는 "basename 불일치처럼 보여도 의도된 패턴" 이 예시돼 있고(`nav-agent-memory` 사례), 숫자 prefix 생략은 `spec/5-system/` 내 다른 파일들에서도 일반적으로 쓰이는 패턴이므로 규약 위반은 아니다.
  - 제안: 이상 없음. 현 `id: system-status-api` 유지 적절.

- **[INFO]** DTO 명칭 `SystemStatusOverviewDto` / `QueueStatusDto` 패턴
  - target 위치: `## 2. API` TypeScript 코드 블록
  - 위반 규약: `spec/conventions/swagger.md §5-1`
  - 상세: `swagger.md §5-1` 은 응답 DTO 를 `dto/responses/*-response.dto.ts` 위치에 두도록 안내한다. spec 문서가 DTO 명칭을 명시하고 있으나 구현 경로 검증은 `code:` glob 에 위임돼 있어 spec 문서 자체의 위반은 아니다. DTO 이름 패턴 자체(PascalCase `*Dto` suffix)는 규약과 일치한다.
  - 제안: 이상 없음.

---

### 2. 출력 포맷 규약

- **[PASS]** API 응답 봉투 `{ data: SystemStatusOverviewDto }` 명시
  - target 위치: `## 2. API → GET /api/system-status/overview → 응답:` 항목
  - 위반 규약: `spec/conventions/swagger.md §2-5`
  - 상세: `swagger.md §2-5` 는 모든 성공 응답이 `TransformInterceptor` 로 `{ data: ... }` 로 래핑됨을 명시한다. 본 문서도 "전역 `TransformInterceptor` 의 `{data}` 래핑 준수"로 정확히 기술. 규약 준수.
  - 제안: 이상 없음.

- **[PASS]** health 어휘 `"healthy" | "degraded" | "down"` 의 분화 근거 명시
  - target 위치: `QueueStatusDto.health`, `SystemStatusOverviewDto.overall`, `## Rationale R-4`
  - 위반 규약: 해당 없음 (health 상태 어휘는 에러 코드 규약(`error-codes.md`) 적용 대상 아님)
  - 상세: health 어휘는 `error.code` 가 아닌 별도 상태 enum 필드이므로 `error-codes.md` 직접 위반 없다. R-4 에서 기존 `/api/health` 어휘(`healthy|unhealthy`)와의 관계를 충분히 설명하고 분화 근거를 밝히고 있다.
  - 제안: 이상 없음.

---

### 3. 문서 구조 규약

- **[INFO]** 별도 `## Overview` 헤더 부재
  - target 위치: 문서 제목 직하 리드 문장 ("전체 시스템의 BullMQ 큐 상태를...")
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
  - 상세: CLAUDE.md 는 "Overview / 본문 / Rationale 3섹션 권장"을 명시한다. 현 문서는 제목 직하 리드 문장(인트로)이 Overview 역할을 하고 본문(`§1~§4`) + `## Rationale` 구조를 갖추고 있어 실질 내용은 3섹션이나, `## Overview` 헤더가 명시적으로 없다. "권장" 수준이고 다른 `spec/5-system/` 파일들에서도 동일 패턴이 일반적이라면 INFO 로 평가.
  - 제안: 리드 문장을 `## Overview` 헤더 하위로 이동하는 것을 고려할 수 있으나, 기존 spec 문서 스타일과의 일관성을 우선하면 현 형태 유지도 무방하다.

- **[PASS]** 파일 위치·명명 패턴
  - target 위치: `spec/5-system/16-system-status-api.md`
  - 위반 규약: CLAUDE.md "기술 명세 → `spec/<영역>/*.md`"
  - 상세: 규약에 따라 기술 명세가 `spec/<영역>/*.md` 에 위치. 숫자 prefix 파일명(`16-`)은 `spec/5-system/` 내 다른 파일들(`1-auth.md`, `2-api-convention.md` 등)과 일관된 패턴이다.
  - 제안: 이상 없음.

- **[PASS]** `## Rationale` 섹션 완비 (R-1~R-5, 5항목)
  - target 위치: `## Rationale` 섹션
  - 위반 규약: CLAUDE.md "결정의 배경·근거 → `## Rationale`"
  - 상세: 설계 결정 전반에 근거(R-1~R-5)가 명시돼 있다. 규약 준수.
  - 제안: 이상 없음.

---

### 4. API 문서 규약

- **[PASS]** `@ApiBearerAuth('access-token')` 데코레이터 언급
  - target 위치: `## 2. API → GET /api/system-status/overview → 인증:` 항목
  - 위반 규약: `spec/conventions/swagger.md §2-1`
  - 상세: `swagger.md §2-1` 은 보호된 컨트롤러에 `@ApiBearerAuth('access-token')` 을 요구한다. spec 문서가 이를 인증 항목에 명시해 구현 방향과 일치. 규약 준수.
  - 제안: 이상 없음.

- **[PASS]** `@ApiForbiddenResponse` 불필요성 명확화
  - target 위치: `## 2. API → GET /api/system-status/overview` 인증 항목 ("admin role 가드 없음")
  - 위반 규약: `spec/conventions/swagger.md §5-4`
  - 상세: `swagger.md §5-4` 는 `@Roles(...)` 가 붙은 엔드포인트에만 `@ApiForbiddenResponse` 를 추가하도록 한다. 본 API 는 "admin role 가드 없음"이 명시돼 있으므로 `@ApiForbiddenResponse` 는 불필요하고 누락이 아니다.
  - 제안: 이상 없음.

---

### 5. Frontmatter 규약 (spec-impl-evidence)

- **[PASS]** 필수 필드 완비 (`id`, `status`, `code:`)
  - target 위치: 문서 frontmatter (L1-L6)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1`, `§3`
  - 상세: `id: system-status-api`, `status: implemented`, `code: codebase/backend/src/modules/system-status/**` 가 모두 존재한다. `status: implemented` 에 따라 `pending_plans:` 는 불필요하며 올바르게 없다. `§3` 의 `implemented` 상태 요건("≥1 매치 의무")도 해당 glob 으로 충족 예상.
  - 제안: 이상 없음.

---

### 6. 금지 항목

- **[PASS]** conventions 명시 금지 패턴 미발견
  - `audit-actions.md` 금지 패턴(prefix 없는 action 표기, 하이픈·camelCase 구분자): 감사 액션 정의 없음. 해당 없음.
  - `error-codes.md` 금지 패턴(구현 경로 포함 이름, 의미 불명 rename): 신규 에러 코드 정의 없음. 해당 없음.
  - `swagger.md` 금지 패턴(빈 껍데기 schema, 잘못된 pagination 형태): spec 문서는 구현 지시 레벨이라 직접 해당 없음.
  - `spec-impl-evidence.md` 금지 패턴(`_*.md` 에 frontmatter 부여, field-level 카탈로그에 `id/status`): 해당 없음.

---

## 요약

`spec/5-system/16-system-status-api.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. frontmatter(`id`/`status: implemented`/`code:`)가 `spec-impl-evidence.md §2.1·§3` 요건을 충족하고, API 응답 봉투 명시(`{ data: SystemStatusOverviewDto }`)가 `swagger.md §2-5` 와 일치하며, `@ApiBearerAuth('access-token')` 언급이 `swagger.md §2-1` 을 따른다. 문서 구조도 본문(`§1~§4`) + `## Rationale(R-1~R-5)` 의 기본 틀을 갖추고 있다. 발견된 사항은 모두 INFO 수준(패턴 일관성 관찰)이며, CRITICAL/WARNING 등급의 규약 직접 위반은 없다.

---

## 위험도

NONE

STATUS: PASS
