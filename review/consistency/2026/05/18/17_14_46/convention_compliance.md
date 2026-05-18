# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md`

## 발견사항

### 문서 구조 규약

- **[WARNING]** `## Rationale` 섹션이 존재하지만 `## Overview` 섹션 누락
  - target 위치: 문서 최상단 (파일의 제목 바로 아래)
  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — 권장 3섹션(Overview / 본문 / Rationale)
  - 상세: 본 문서는 `## Rationale` 섹션으로 끝나 배경·근거 영역은 갖추고 있다. 그러나 도입부에 사용자 가치·요구사항·목표를 정리한 `## Overview` 섹션이 없고, 바로 `## 1. 라우트 구성` 본문으로 시작한다. 문서 상단에 PRD 링크들(blockquote)이 있어 관련 문서를 가리키고 있지만, 이는 `## Overview` 를 대체하지 않는다.
  - 제안: 제목 아래에 `## Overview` 섹션을 추가하고 통합 관리 화면의 사용자 가치·목표(현재 `_product-overview.md` 에 있는 내용 요약)를 짧게 기술한다. 또는 이미 `_product-overview.md` 가 영역 진입 문서로 있으므로 본 문서는 다중 spec 파일 중 하나로 보고 Overview 생략이 의도된 경우라면 CLAUDE.md 의 "권장" 표현에 따라 INFO 수준으로 내려도 무방하다. 단 현재 문서 서두의 blockquote 에 "PRD 통합/연동" 링크가 있어 Overview 의도가 외부에 위임된 것이 명시적이지 않으므로 WARNING 유지.

- **[INFO]** 파일 제목이 `# Spec: 통합 관리 화면` 형태로 "Spec:" 접두 사용
  - target 위치: 1번 라인
  - 위반 규약: `CLAUDE.md` §명명 컨벤션 — `spec/<영역>/N-name.md` 패턴. 다른 파일들과 비교(예: `0-dashboard.md` 제목 확인 불가)하면 관리 spec 파일의 제목 형식이 일관되는지 불명확하나, "Spec:" 접두는 폴더 위치 자체가 `spec/`임을 중복으로 표기한다.
  - 상세: 파일이 `spec/` 하위에 있음에도 제목에 "Spec:" 을 붙이는 것은 의미 중복. 같은 영역의 다른 파일들도 동일 패턴을 따른다면 일관성 차원에서 INFO이나, 향후 신규 문서 작성 시 제거 권장.
  - 제안: `# 통합 관리 화면` 으로 간결화. 전 영역 파일이 같은 패턴이라면 규약 자체에 "# Spec:" 접두 허용을 명문화하거나 일괄 정리.

---

### 출력 포맷 규약 (API 응답)

- **[WARNING]** `§9.4 공통 응답 포맷` 에러 응답 형식이 `spec/5-system/2-api-convention.md §5.3` 규약과 불일치
  - target 위치: §9.4 공통 응답 포맷 — 실패 블록 `{ code, message, details? }`
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` — 에러 응답 형식 `{ "error": { "code": "...", "message": "...", "details": [...] } }`
  - 상세: API 규약(2-api-convention.md)의 §5.3은 에러 응답을 `{ "error": { "code", "message", "details" } }` 구조(최상위 키 `"error"`)로 정의한다. 그러나 본 spec §9.4의 "실패" 항목은 `{ code, message, details? }` 처럼 최상위에 `code`/`message`/`details` 를 두는 형태로 기술하고 있어, `"error"` 래퍼 키가 누락되어 있다.
  - 제안: `{ "error": { "code": "INTEGRATION_IN_USE", "message": "...", "details": { ... } } }` 형태로 수정하거나, 또는 `spec/5-system/3-error-handling.md` 에 정의된 `GlobalExceptionFilter` 출력 형식과 동일한 구조로 표기. 만약 이 spec이 의도적으로 단축 표기했다면 규약 자체에 "단축 표기 허용" 를 명시할 것.

- **[INFO]** `§9.3 activity` 응답 형식이 목록 응답 규약과 다소 다름
  - target 위치: §9.3 — `GET /api/integrations/:id/activity` 응답 `{ items[], summary: { ... } }`
  - 위반 규약: `spec/5-system/2-api-convention.md §5.2` — 목록 응답 `{ data: [...], pagination: { ... } }`
  - 상세: 일반 목록 응답은 `{ data: [...], pagination: {...} }` 를 규약으로 한다. activity 응답은 `{ items[], summary: {...} }` 를 사용하는데, `data` 키 대신 `items` 를 쓰고 있다. 페이지네이션이 없는 "최근 N건 + 요약" 형태라 완전 동일하게 맞추기 어렵지만, `data` 키 사용은 지킬 수 있다.
  - 제안: `{ data: [...], summary: { ... } }` 형태로 변경해 최상위 배열 키를 규약 `data` 로 통일. `summary` 는 추가 필드로 허용 가능.

---

### API 문서 규약 (Swagger/DTO 패턴)

- **[INFO]** `Cafe24PrecheckResultDto` 가 응답 DTO 로 언급되나 위치·명명 패턴 명세 누락
  - target 위치: §9.2 — `GET /api/integrations/cafe24/precheck` 응답 DTO `Cafe24PrecheckResultDto`
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `dto/responses/*-response.dto.ts` 에 위치
  - 상세: 본 spec 이 `Cafe24PrecheckResultDto` 를 명시하면서 파일 위치(`dto/responses/` 하위인지)나 래퍼(`ApiOkWrappedResponse`) 사용 여부를 명기하지 않는다. 동일 행에서 `ApiOkWrappedResponse` 래퍼가 언급되고 있어 의도는 맞지만, DTO 클래스명이 `*-response.dto.ts` 파일 명명 패턴(파스칼 접미 `Dto` 외 `Response` 접미 포함 권장)과 살짝 다를 수 있다.
  - 제안: `Cafe24PrecheckResultDto` 의 위치를 `dto/responses/cafe24-precheck-response.dto.ts` 에 두도록 spec 에 명시. 또는 swagger 규약 §5-1 참조 링크 추가.

- **[INFO]** `PUT` 메서드가 API 규약에서 "사용하지 않음"으로 금지되어 있으나 Cafe24 API 카탈로그 내 endpoint 에 `PUT` 사용
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md`, `category.md`, `collection.md` 등 카탈로그 파일들 — `apps_update (PUT)`, `category_update (PUT)`, `brands_update (PUT)` 등 다수
  - 위반 규약: `spec/5-system/2-api-convention.md §3` — "PUT: 사용하지 않음 (PATCH 선호)"
  - 상세: API 규약 §3 에서는 `PUT` 을 "사용하지 않음" 으로 정의한다. 그러나 이 규약은 **우리 서비스 자체 API** 에 대한 것이고, Cafe24 API 카탈로그는 **외부 Cafe24 Admin API** 의 실제 메서드를 문서화하는 것이다. 카탈로그 자체는 위반이 아니지만, 규약 문서와 카탈로그의 `PUT` 노출 이 혼동될 여지가 있다.
  - 제안: `spec/conventions/cafe24-api-catalog/_overview.md` 에 "본 카탈로그의 `method` 는 Cafe24 외부 API 의 실제 메서드이며, 우리 서비스 API 설계 규약(`spec/5-system/2-api-convention.md`)과 무관" 임을 한 줄로 명시. 이미 `§2.3` 에 "rule" 과 "tool" 분리 맥락이 있으나 PUT 혼동 방지 문구는 없다. (규약 자체는 갱신할 필요 없고, 카탈로그에 주석만 추가)

---

### 명명 규약

- **[INFO]** 에러 코드 `status_reason` 값(DB 저장값)이 `snake_case` 임을 본문에서 명시하지만, API 응답의 `status_reason` 필드명이 `camelCase` 정책과의 관계가 불명확
  - target 위치: §6 상태 전이 표 — `oauth_token_exchange_failed`, `oauth_state_mismatch`, `install_timeout` 등 `snake_case` 값
  - 위반 규약: `spec/5-system/2-api-convention.md` — JSON 응답 키 명명 (camelCase 명시 여부 불명)
  - 상세: Rationale §"Cafe24 Private 앱의 callback 실패" 에서 `status_reason` 은 DB snake_case, API 응답·에러 코드는 `UPPER_SNAKE_CASE` 로 명시한다. 그러나 API 응답의 `IntegrationDto` 필드명 자체(`status_reason` vs `statusReason`)에 대한 명세가 본문에 누락되어 있다. REST API 관행은 camelCase(`statusReason`) 이나 spec 내 표·예시에서 `status_reason` 표기가 혼용된다.
  - 제안: §9.1 또는 §13 에서 `IntegrationDto` 의 JSON 필드명이 camelCase(`statusReason`) 인지 snake_case(`status_reason`) 인지를 명기. 또는 공용 API 응답 필드명 컨벤션 문서에 통일 기준 추가.

- **[INFO]** `install_token` 발급 형태 설명에서 "16바이트 base64url 22자, `^[A-Za-z0-9_-]{22}$`" 이 여러 곳에 반복 기술
  - target 위치: §3.2 "Cafe24 Private 흐름" / §9.2 `oauth/begin` / §9.2 `GET /api/3rd-party/cafe24/install/:installToken` 등 3곳 이상
  - 위반 규약: CLAUDE.md §정보 저장 위치(단일 진실 원칙) — 동일 정보를 여러 곳에 중복 기재하지 않도록 한 곳이 SoT
  - 상세: `installToken` 의 형식(`16바이트 base64url`, `22자`, 정규식)이 동일 문서 내 3곳에 중복 기재된다. 나중에 토큰 길이 정책이 변경될 경우 한 군데만 갱신되어 불일치 위험이 생긴다.
  - 제안: `§5.8 credentials JSONB 스키마` 또는 §13 데이터 모델 영향 요약에 SoT 로 한 번만 정의하고 다른 곳에서는 해당 섹션으로 참조. spec 문서 내 DRY 권장.

---

### 금지 항목

- **[WARNING]** 목록 응답의 `pending_install` 포함 여부에서 `status` 필터 값이 DB Enum 과 혼재되는 표기
  - target 위치: §9.1 `GET /api/integrations` 설명 — `status` 허용값 = `connected / expiring / expired / error / attention`
  - 위반 규약: §2.3 및 §9.1 Rationale "Attention 가상 필터값" — 가상 필터값과 DB Enum 의 분리 원칙
  - 상세: spec §9.1 의 `status` 허용값 목록에 `pending_install` 이 빠져 있고, §2.3 상태 칩에서도 명시적으로 제외한다. 그런데 §2.4 배너 조건과 §11.4 사이드바 카운트 조건에서는 `status NOT IN (...)` 에서 `pending_install` 을 제외하는 방식으로 처리한다. 이 때문에 "API의 `status` 파라미터로 `pending_install` 을 명시적으로 필터링하는 방법이 없다" 는 점이 spec 어디서도 명시적으로 선언되지 않아 구현자가 혼동할 수 있다.
  - 제안: §9.1 의 `status` 허용값 설명에 "※ `pending_install` 은 필터 파라미터로 노출하지 않음 — §2.3 Rationale 참조" 를 한 줄 추가해 의도적 누락임을 선언.

- **[INFO]** `§9.4` 에서 `INTEGRATION_TEST_FAILED (422)` 를 사용하나 API 규약 §6 의 422 용도와 미세 불일치
  - target 위치: §9.4 — `INTEGRATION_TEST_FAILED (422) — 연결 테스트 실패`
  - 위반 규약: `spec/5-system/2-api-convention.md §6` — 422: "비즈니스 로직 오류"
  - 상세: API 규약에서 422 는 "Unprocessable Entity — 비즈니스 로직 오류"로 정의한다. 연결 테스트 실패는 넓게 보면 비즈니스 로직 오류에 해당하므로 직접 위반은 아니지만, Rationale §"연결 테스트 endpoint 의 `pending_install` 가드 응답 형식" 에서 "422 가 아닌 200 + success:false" 를 의도적으로 선택했음을 설명한다. 즉 §9.4 에는 `INTEGRATION_TEST_FAILED (422)` 가 있으나 실제 `pending_install` 가드는 `200 + success:false` 를 반환한다는 점이 §9.4 표에 주석 없이 공존해 불명확하다.
  - 제안: §9.4 의 `INTEGRATION_TEST_FAILED (422)` 행에 "단, `pending_install` 가드는 `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 반환 — §9.1 비고 참조" 를 추가해 두 패턴의 공존을 명시.

---

## 요약

`spec/2-navigation/4-integration.md` 는 전체적으로 spec 본문(§1~§14) + Rationale 의 2섹션 구조를 갖추고 있으며, API endpoint 명명(kebab-case, 복수형 자원), 에러 코드 명명(`UPPER_SNAKE_CASE`), 가상 필터값 분리 원칙, swagger 래퍼(`ApiOkWrappedResponse`)의 의도적 사용 등 주요 규약을 전반적으로 준수한다. 발견된 CRITICAL 항목은 없다. 핵심 주의 사항은 두 가지다: (1) `§9.4` 에러 응답 형식이 `spec/5-system/2-api-convention.md §5.3` 의 `{ "error": { ... } }` 래퍼를 누락하고 있어, 구현자가 응답 구조를 혼동할 수 있다(WARNING). (2) `## Overview` 섹션이 없어 권장 3섹션 구조의 진입 부분이 빠져 있다(WARNING). 나머지 INFO 항목들은 문서 DRY, 응답 키 명명 명세 보완, 의도적 누락 항목의 명시 등 형식 일관성 개선 사항이다. 전체 위험도는 낮으며 채택 시 다른 시스템의 invariant 를 깨는 사항은 없다.

## 위험도

LOW
