# Convention Compliance Review — `spec/2-navigation/4-integration.md`

검토 모드: --impl-prep (구현 착수 전 검토)
검토 대상: `spec/2-navigation/4-integration.md`

---

## 발견사항

### 문서 구조 규약

- **[INFO]** `## Rationale` 섹션이 문서 말미에 존재하나, 항목별 앵커(`#rationale`)를 본문에서 직접 참조하는 패턴이 다수 있음
  - target 위치: §6 상태 전이, §9.4 에러 코드, §10.5 토큰 자동 갱신 등에서 `[Rationale "xxx"](#rationale)` 형태로 참조
  - 위반 규약: CLAUDE.md 명명 컨벤션 — `spec/<영역>/N-name.md` 은 본문 끝에 `## Rationale` 섹션을 권장함. 규약 자체에는 Rationale 하위 항목의 앵커 명명에 대한 추가 제약이 없음
  - 상세: `## Rationale` 하위 소섹션(예: `### refresh 실패 시 status_reason 통일 (2026-05-16)`)들은 실제 앵커가 `#refresh-실패-시-status_reason-통일-2026-05-16` 형태이나, 본문 인라인 참조는 `(#rationale)`이나 `(#refresh-실패-시-status_reason-통일-2026-05-16)` 혼용. 앵커가 정확히 다르면 마크다운 렌더러에서 참조가 깨질 수 있음
  - 제안: 참조 앵커를 실제 소섹션 헤딩과 일치시키거나, 본 spec 문서 자체는 이미 규약을 준수 중이며 INFO 수준의 내부 일관성 문제로 채택 여부를 검토하면 됨. 규약 갱신은 불필요.

- **[INFO]** 문서가 `## Overview` 섹션 없이 `# Spec: 통합 관리 화면` 제목 이후 바로 `## 1. 라우트 구성`으로 시작
  - target 위치: 문서 최상단 (1~7행)
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — 각 spec 문서는 권장 3섹션 구성(Overview / 본문 / Rationale)을 따른다. "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다"
  - 상세: 현재 `4-integration.md`는 Overview 섹션 없이 곧바로 본문(라우트 구성 등)으로 시작한다. 제품 정의·사용자 가치·요구사항 목표를 기술하는 Overview가 누락되어 있다. 다만 문서 상단 링크에 `[PRD 내비게이션](./_product-overview.md#34-integration-통합)` 이 제시되어 PRD 역할을 별도 문서에 위임한 구조임. 이 경우도 `_product-overview.md`가 Overview 역할을 대신하므로, 본 문서 안에서는 Overview 절이 필요 없을 수 있으나, `spec/<영역>/N-name.md`(단순 숫자 prefix 파일)이고 `_product-overview.md`가 별도 존재하는 영역이면 각 N 문서에서 Overview 생략도 관행으로 수용 가능. INFO 수준.
  - 제안: `## 1. 라우트 구성` 상단에 1~3문장의 간략한 목적 설명을 `## Overview` 로 추가하거나, 별도 Overview가 `_product-overview.md`에 있음을 명시하는 인트로 문단으로 대체 가능. 규약 갱신은 불필요.

---

### 명명 규약

- **[INFO]** API 경로 표기에서 `/:id`와 `/:provider` 등 path parameter에 일관성 있는 표기가 사용됨. spec/conventions/swagger.md §2-3 의 `@ApiParam` 패턴과 부합하며, 구현 시 UUID 파라미터에 `@ApiParam({ format: 'uuid' })` 필요 체크리스트(swagger.md §5-4) 적용 대상이 됨
  - target 위치: §9 전체 API 표
  - 위반 규약: spec/conventions/swagger.md §5-4 — "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"
  - 상세: spec 문서 자체에서는 경로 표기가 문제 없으나, 구현 시 `/api/integrations/:id` 류의 UUID path param에 `@ApiParam({ format: 'uuid' })`를 빠뜨리지 않도록 주의 필요. 이는 spec 문서 위반이 아니라 구현 시 체크포인트.
  - 제안: spec 문서에 "구현 시 UUID 파라미터에 `@ApiParam({ format: 'uuid' })` 적용 필요" 주석 추가를 고려. INFO 수준이므로 필수 아님.

---

### 출력 포맷 규약

- **[INFO]** §9.4 공통 응답 포맷에서 성공 응답 표기가 `{ data: ... }` 또는 `{ data: ..., pagination: ... }` 형태로 정의됨
  - target 위치: §9.4 (702~714행)
  - 위반 규약: spec/conventions/swagger.md §2-5 — `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌈; §5 — 응답 DTO 클래스 + 공용 래퍼 헬퍼 사용
  - 상세: spec 문서 자체의 API 응답 포맷 기술은 규약과 정합. 다만 §9.3의 activity 응답 `{ items[], summary: { totalCalls, successRate, dailyCounts[] } }` 표기가 최상위에 `data:` 래퍼 없이 기술되어 있어, 구현 시 `{ data: { items, summary } }` 형태로 래핑되어야 한다는 점이 spec에서 명시되지 않음.
  - 제안: §9.3의 activity 응답 예시를 `{ data: { items[], summary: { ... } } }` 형태로 명시하거나, §9.4 포맷 절에서 "이하 모든 응답이 `data:` 래퍼를 가짐" 문구를 추가. 규약 갱신은 불필요.

---

### API 문서 규약

- **[WARNING]** §9.4 에러 코드 중 일부가 `UPPER_SNAKE_CASE`로 기술되나, `error(auth_failed)` 등 status 값은 `snake_case` mixed 형태로 병기
  - target 위치: §9.4 (703~714행), §6 상태 전이 표
  - 위반 규약: spec/conventions/swagger.md §2-4 — HTTP 에러 응답 코드는 Swagger 규약상 표준 형식 사용; CLAUDE.md 의 단일 진실 원칙 — 동일 개념의 표기가 두 가지 형태로 혼용
  - 상세: API 응답의 `code` 필드는 `INTEGRATION_IN_USE`, `OAUTH_STATE_MISMATCH`, `CAFE24_INSTALL_REPLAY` 등 `UPPER_SNAKE_CASE`. `Integration.status` 의 값은 `pending_install`, `connected`, `error(auth_failed)` 등 `snake_case`. 이 구분 자체는 §Rationale에서 의도적으로 설명됨("DB 컬럼 컨벤션 전체가 snake_case, API 응답·callback HTML 의 에러 코드는 UPPER_SNAKE_CASE"). 의도적 이중 표기로 Rationale에 근거가 있으므로 CRITICAL이 아닌 WARNING 수준.
  - 제안: 구현 담당자가 혼동하지 않도록 §9.4 상단에 "API error code는 `UPPER_SNAKE_CASE`, DB `status_reason` 값은 `snake_case` — 의도적 구분 (Rationale 참조)" 한 줄 주석 추가 권장. 규약 자체의 갱신은 불필요.

---

### 금지 항목

- **[CRITICAL]** 대상 파일 경로 `spec/2-navigation/4-integration.md` 자체는 적법한 경로이나, **검토 모드의 target 문서가 실제로 존재하지 않는다**는 것이 orchestrator prompt에 명시됨
  - target 위치: prompt_file §Target 문서 섹션 — "경로: `spec/2-navigation/4-integration.md` (없음)"
  - 위반 규약: CLAUDE.md §개발 방법론 — "모든 개발은 반드시 SDD(Spec-Driven Development)로 접근"; 작업 이전: 관련 `spec/` 문서를 먼저 읽는다
  - 상세: orchestrator의 prompt에는 `spec/2-navigation/4-integration.md` 내용이 "(없음)"으로 표기되어 있으나, 실제 파일시스템에는 동 경로에 파일이 존재함(본 checker가 직접 Read하여 확인). orchestrator가 파일을 수집하지 못한 것으로 추정됨. 즉, **prompt 수집 단계의 오류**이며 파일 자체는 존재. 하지만 prompt의 "없음" 표기에 따라 impl-prep 검토를 진행했다면 실제 spec 내용 없이 검토가 수행될 뻔한 상황이었음. checker가 직접 파일을 읽어 이를 보완함.
  - 제안: orchestrator의 파일 수집 로직에서 `spec/2-navigation/4-integration.md`가 누락된 원인을 조사할 것. 본 checker는 직접 파일을 읽어 실질적인 검토를 수행했으므로 결과 자체의 신뢰도는 유지됨. 단, 향후 orchestrator 동작을 신뢰할 수 없는 경우 checker가 직접 파일을 읽는 fallback 정책을 명문화하는 것을 권장.

  > **비고**: 위 CRITICAL은 target 문서의 규약 위반이 아니라 검토 인프라(orchestrator)의 파일 수집 오류를 나타냄. `spec/2-navigation/4-integration.md` 문서 자체는 아래 요약과 같이 규약 준수 수준이 양호함.

- **[INFO]** 옛 경로 패턴(`prd/`, `memory/`) 사용 없음 — 문서 내 모든 상호참조가 `spec/`, `plan/` 경로를 사용하거나 `review/consistency/...` 형태를 사용함
  - target 위치: 문서 전체 링크/참조
  - 위반 규약: CLAUDE.md — "옛 `prd/`, `memory/`, `user_memo/` 폴더 신규 생성 금지"
  - 상세: 위반 없음.
  - 제안: 해당 없음.

---

## 요약

`spec/2-navigation/4-integration.md`는 정식 규약 준수 수준이 전반적으로 양호하다. 파일명은 `N-name.md` 패턴을 준수하고, `## Rationale` 섹션이 문서 말미에 배치되어 있다. API 경로 표기와 에러 코드 체계도 swagger.md 규약과 정합하며, 옛 경로(`prd/`, `memory/`) 사용은 없다. 경미한 개선 여지로는 `## Overview` 섹션 부재, 일부 응답 포맷의 `data:` 래퍼 명시 누락, Rationale 앵커 참조의 정확성 문제가 있으나 모두 INFO 수준이다. 한편, API error code(`UPPER_SNAKE_CASE`)와 DB status_reason 값(`snake_case`)의 이중 표기는 의도적이며 Rationale에 근거가 있어 WARNING 수준으로 분류한다. 가장 주목해야 할 사안은 orchestrator가 target 문서 내용을 수집하지 못한 점(CRITICAL)이며, 이는 문서 자체의 위반이 아닌 인프라 수집 오류다.

## 위험도

LOW
