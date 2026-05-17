# 정식 규약 준수 검토 — convention_compliance

검토 범위: `spec/2-navigation/` 전체 (구현 착수 전 --impl-prep 모드)

---

### 발견사항

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — 잔존 `prd/` 경로 출처 표기
  - target 위치: `## Overview (제품 정의)` 섹션 직후의 blockquote (`> 출처: prd/7-execution-history.md`)
  - 위반 규약: CLAUDE.md 명명 컨벤션 — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: 해당 blockquote는 흡수 출처를 역사 기록으로 표기한 것이지만, 파일명 `prd/7-execution-history.md` 형태를 살아있는 spec 문서에 남겨두어 미래 독자가 아직 `prd/` 경로가 유효한 것으로 오인할 수 있다. 신규 문서 작성 금지 규약과 직접 충돌하지는 않으나, 규약의 취지(옛 경로 제거)에 어긋나는 잔류 표기다.
  - 제안: `> 출처: spec/2-navigation/14-execution-history.md 로 흡수 (docs-consolidation 2026-05-12, 구 prd/7-execution-history.md)` 형태로 경로를 `spec/` 기준으로 정정하거나, 해당 blockquote 자체를 Rationale 섹션으로 이동한다.

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — 문서 구조: Overview 섹션과 본문 섹션 번호가 중복
  - target 위치: `## Overview (제품 정의)` 하위에 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` 이 존재하고, 이와 별도로 같은 파일 하단에 다시 `## 1. 개요`, `## 2. 실행 내역 목록 페이지` 등 최상위 `##` 섹션이 등장한다.
  - 위반 규약: CLAUDE.md 스펙 문서 권장 3섹션 구성(Overview / 본문 / Rationale). Overview 내부의 소제목과 본문의 최상위 섹션이 같은 번호(`1. 개요`, `2. ...`)를 사용해 문서 구조가 이중화되어 있다.
  - 상세: Overview 블록 안에 `### 1. 개요` ~ `### 3. 요구사항` 이 있고, 그 아래 `---` 뒤에 동일 순번의 `## 1. 개요`, `## 2. 실행 내역 목록 페이지` 등이 다시 등장한다. 두 번호 체계가 혼재해 문서를 읽는 구현자가 어느 섹션이 기술 명세인지 파악하기 어렵다.
  - 제안: Overview 내부 소제목을 `### O-1. 배경`, `### O-2. 목표` 등으로 구분하거나, 요구사항 ID 목록을 별도 subsection으로 분리하여 본문 `## 1.` ~ `## 7.` 과 번호 체계가 겹치지 않도록 한다.

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — Rationale 섹션 부재
  - target 위치: 파일 전체. `## Rationale` 섹션이 없다.
  - 위반 규약: CLAUDE.md "각 spec 문서는 권장 3섹션 구성을 따른다 ... 3. Rationale — 결정의 배경·근거·폐기된 대안." 및 명명 컨벤션 표 "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: 문서가 요구사항 ID 목록(EH-LIST-*, EH-DETAIL-*, EH-NAV-*) 과 상세 기술 명세를 포함하고 있으나, 설계 결정의 근거나 폐기된 대안을 기록하는 Rationale 섹션이 없다. 같은 영역의 `1-workflow-list.md`는 `## Rationale`을 포함하는 것과 대비된다.
  - 제안: 파일 말미에 `## Rationale` 섹션을 추가한다. 최소한 "Trigger 출처 분류 5종 설계 근거", "2단계 페이지 구조 선택 이유" 등의 아키텍처 결정을 기록한다.

- **[WARNING]** `spec/2-navigation/13-user-guide.md` — Rationale 섹션 부재
  - target 위치: 파일 전체. `## Rationale` 섹션이 없다.
  - 위반 규약: CLAUDE.md 명명 컨벤션 — 숫자 prefix `N-name.md` 파일 "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: 섹션 `01-` ~ `99-faq` 구조, `/docs/[...slug]` 라우팅 방식, MDX 프론트매터 스키마 등 여러 설계 결정을 담고 있으나 근거 기록이 없다.
  - 제안: 파일 말미에 `## Rationale` 섹션을 추가하여 MDX 방식 채택 이유, `99-faq` 숫자 프리픽스 규칙 배경, 내부 `/docs` 경로 채택 이유 등을 기록한다.

- **[WARNING]** `spec/2-navigation/12-workflow-version-history.md` — Rationale 섹션 부재
  - target 위치: 파일 전체.
  - 위반 규약: 위와 동일 (숫자 prefix 파일의 Rationale 권장).
  - 상세: 자동 스냅샷 전략, `jsonb` snapshot 선택, 복원 후 페이지 리로드 방식 등의 결정 근거가 없다.
  - 제안: `## Rationale` 섹션 추가 — 최소한 "불변 스냅샷 jsonb 선택 이유", "복원 시 페이지 리로드 vs in-place 상태 갱신" 폐기된 대안을 기록한다.

- **[WARNING]** `spec/2-navigation/11-error-empty-states.md` — Rationale 섹션 부재
  - target 위치: 파일 전체.
  - 위반 규약: 위와 동일.
  - 상세: 에러 페이지 5종 정의, 401 감지 시 전체 화면 교체 방식 등의 결정 근거가 없다.
  - 제안: `## Rationale` 섹션 추가.

- **[WARNING]** `spec/2-navigation/0-dashboard.md` — Rationale 섹션 부재
  - target 위치: 파일 전체.
  - 위반 규약: 위와 동일.
  - 상세: 요약 카드 4개 구성, 최근 5개 워크플로우 기준(`max(updatedAt, lastExecutedAt)`) 등의 결정 근거가 없다.
  - 제안: `## Rationale` 섹션 추가.

- **[INFO]** `spec/2-navigation/14-execution-history.md` — API 응답 필드명 camelCase 혼재 확인 필요
  - target 위치: `## 5. API 엔드포인트` 응답 예시 JSON — `triggerSource`, `triggerLabel`, `executedBy`, `parentExecutionId`, `nodeExecutions` 등
  - 위반 규약: API 규약 참조(본 파일은 `spec/5-system/2-api-convention.md#52-목록-응답`을 인용). 응답 DTO 내 snake_case 필드(`started_at`, `finished_at`, `duration_ms`)와 camelCase 필드(`triggerSource`, `triggerLabel`, `durationMs`)가 같은 응답 블록 내에 혼재한다.
  - 상세: 목록 API 응답 예시에서 `"startedAt"`, `"finishedAt"`, `"durationMs"` (camelCase)가 쓰이는 반면, 쿼리 파라미터 표에서는 `sort` 값으로 `started_at`, `finished_at`, `duration_ms` (snake_case)가 언급된다. 응답 JSON 자체는 camelCase 로 일관되어 있으나, 정식 API 규약 문서(`spec/5-system/2-api-convention.md`)를 직접 확인할 수 없어 INFO 수준으로 분류한다.
  - 제안: `spec/5-system/2-api-convention.md`의 응답 필드 케이싱 규칙을 확인하여, 쿼리 파라미터의 snake_case와 응답 필드의 camelCase 혼용이 의도된 규약인지 명시적으로 주석을 달아 독자 혼란을 방지한다.

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — 파일명 패턴: `_overview.md` vs `_product-overview.md`
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` (언더스코어 prefix = 영역의 제품 정의), `spec/<영역>/_layout.md` 두 패턴만 언더스코어 prefix로 명시.
  - 상세: `_overview.md` 는 CLAUDE.md 명명표에 없는 패턴이다. 컨벤션 상 `0-overview.md`(`0-` prefix, 기술 아키텍처 개요)나 `_product-overview.md`(영역 제품 정의)가 공식 패턴이다. `spec/conventions/cafe24-api-catalog/`는 정식 규약 디렉토리이므로 `spec/conventions/*.md` 평문 패턴 내에서 서브디렉토리가 허용되는지 여부가 불명확하다.
  - 제안: 규약 위반이 의도적이면(카탈로그 인덱스 파일로서 특수 목적) `spec/conventions/cafe24-api-catalog/_overview.md`를 CLAUDE.md 명명 컨벤션 표에 예외로 명시하거나, 파일명을 `0-overview.md` 또는 `README.md`로 변경한다. 현재는 INFO 수준으로 분류.

---

### 요약

`spec/2-navigation/` 소속 7개 spec 파일과 `spec/conventions/cafe24-api-catalog/` 규약 파일들을 정식 규약 기준으로 검토한 결과, 직접적인 CRITICAL 위반은 발견되지 않았다. 가장 빈번한 문제는 **Rationale 섹션 누락**: 숫자 prefix를 가진 5개 spec 파일(`0-dashboard.md`, `11-error-empty-states.md`, `12-workflow-version-history.md`, `13-user-guide.md`, `14-execution-history.md`) 이 모두 권장 Rationale 섹션 없이 작성되어 있다. 또한 `14-execution-history.md`는 폐기된 `prd/` 경로를 문서 본문에 잔존시키고 있어 규약 취지에 반하며, Overview와 본문 섹션 번호 이중화로 문서 구조가 불명확하다. `spec/conventions/cafe24-api-catalog/_overview.md`의 파일명은 명명 컨벤션 표에 등재되지 않은 패턴이지만, 카탈로그 전용 서브디렉토리 내 인덱스 파일이라는 특수성을 감안하면 INFO 수준이다. API 응답 필드 케이싱 혼재는 상위 규약 문서 미조회로 INFO 처리했으며, 구현 착수 전 `spec/5-system/2-api-convention.md` 확인을 권고한다.

---

### 위험도

LOW
