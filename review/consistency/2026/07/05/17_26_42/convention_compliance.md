# 정식 규약 준수 검토 — spec/2-navigation/2-trigger-list.md (외 2-navigation/** 대상)

검토 모드: --impl-prep (scope=spec/2-navigation/)

## 발견사항

- **[WARNING] `GET /api/triggers` 목록 응답의 `nextRunAt`/`cronExpression`/`timezone` 필드 출처가 API 규약 문서화 요건을 충족하지 못함**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §1 화면 구조 목업(37행 `Next: 09:00`), §2.1 "Schedule 태그"(58행 "Cron 표현식 + 다음 실행 시각"), §2.3.1 필드 권한 매트릭스(100행 `nextRunAt`), §3 API 표(151행 `GET /api/triggers`)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.2`(목록 응답 형식) — 목록 응답 스키마는 화면이 실제로 그리는 필드를 문서가 커버해야 함. 유사 패턴의 모범 사례는 같은 폴더의 `spec/2-navigation/14-execution-history.md` R-1("목록 API 에서 nodeExecutions 를 제외하고 배치 집계만 응답하는 이유")처럼, 목록/상세 필드 비대칭이 있을 때 **그 비대칭을 API 절 또는 Rationale 에 명시**하는 관례를 따른다.
  - 상세: 코드 확인 결과 `codebase/backend/src/modules/triggers/triggers.service.ts`의 `findAll()`(목록, 78~135행)은 `Trigger` 엔티티만 조회하며 `Schedule` 조인이 없다 — `cronExpression`/`timezone`/`nextRunAt`은 `findOneDetail()`(151~167행, 단건 조회 전용)에서만 `schedule` 레코드를 조회해 채워진다. `trigger-response.dto.ts`의 JSDoc도 "다음 실행 예정 시각 (schedule 타입 트리거 **단건 조회 시에만** 채워짐)"이라고 명시한다. 그러나 `2-trigger-list.md`의 §1 ASCII 목업과 §2.1 표는 이 필드가 **목록 화면 행**에 노출되는 것처럼 서술하고 있고, §3 API 표의 `GET /api/triggers` 설명에는 이 list/detail 비대칭이 전혀 언급되지 않는다. 실제 프론트 구현(`triggers/page.tsx`)도 목록 쿼리 결과에서 `cronExpression`/`nextRunAt`을 그대로 읽어 상태에 담지만(206~220행), 정작 행 렌더링(636~739행)에는 그 값을 표시하는 셀이 없다 — 셀 표시가 아니라 삭제 확인 다이얼로그 prop 전달(811~812행)에만 재사용된다.
  - 제안: (a) API 규약을 지키려면 `2-trigger-list.md` §3의 `GET /api/triggers` 행에 "목록 응답은 `cronExpression`/`nextRunAt`을 포함하지 않는다(단건 조회 전용, `trigger-response.dto.ts` 참고)"를 명시하고, §1 목업의 "Next: 09:00" 표기와 §2.1 "Schedule 태그" 설명을 실제 미구현 상태에 맞게 "미구현(Planned)"으로 정정하거나, 별도 배치 조회(예: `nextRunAt` 를 트리거 목록 조회 시 Schedule과 LEFT JOIN)로 구현을 확장한 뒤 §3에 그 계약을 기술한다. 이 판단(문서 하향 vs 구현 확장)은 `developer`/`project-planner` 결정 사안이나, 현재 상태로는 API 출력 포맷 규약이 요구하는 "실제 응답 계약의 문서화"가 누락된 상태다.

- **[INFO] Rationale 하위 항목 번호가 비연속(R-9~R-11 없음) + 문서 순서와 번호 순서 불일치(R-8 이 R-7 보다 앞에 배치)**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §Rationale (271행 `### R-8`, 279행 `### R-7`, 289행 `### R-12` — R-9/R-10/R-11 부재)
  - 위반 규약: 명시적 규약은 없음(CLAUDE.md/SKILL.md 어디에도 Rationale 하위 번호의 연속성·순서를 강제하는 조항 없음) — 순수 가독성 이슈로 "정식 규약 위반"은 아님.
  - 상세: R-6 다음에 R-8이 먼저 나오고 R-7이 그 다음에 나오며, R-8 이후 R-9~R-11 없이 바로 R-12로 건너뛴다. 다른 `2-navigation/*.md` 문서(예: `14-execution-history.md`)의 Rationale은 R-1~R-4로 연속·순서가 일치한다.
  - 제안: 문서 등장 순서대로 R-7→R-8로 재정렬하고, 번호를 연속시키거나(재부여) 결번 사유를 각주로 남긴다. 규약 갱신 사안은 아니며 편집 수준의 정리로 충분.

- **[INFO] `2-trigger-list.md`가 `## Overview` 섹션 없이 `## 1. 화면 구조`로 시작 — CLAUDE.md 3섹션 권장과 형식상 차이**
  - target 위치: `spec/2-navigation/2-trigger-list.md` 21행 (`## 1. 화면 구조`로 시작, Overview 섹션 없음)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview / 본문 / Rationale)"
  - 상세: 다만 `spec/2-navigation/` 폴더의 16개 문서 중 14개가 동일하게 `## Overview` 없이 곧장 `## 1. ...`로 시작한다(`0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md` 등 전부 동일 패턴이며, `14-execution-history.md`·`6-config.md` 2개만 `## Overview (제품 정의)`를 명시). 즉 이 문서만의 개별 이탈이 아니라 폴더 전체의 기존 관행이다.
  - 제안: 새로운 위반이 아니므로 이번 검토에서 이 문서만 수정할 필요는 없다(폴더 전체의 관행 자체를 재검토하려면 `project-planner`가 별도 리팩터 트랙으로 다뤄야 함). 정보용으로만 기록.

## 요약

`spec/2-navigation/2-trigger-list.md`의 명명(API 경로 kebab-case, RPC-style sub-channel 예외, `PATCH` 단일 편집 경로, 에러 코드 `UPPER_SNAKE_CASE`/historical exception 인용)과 응답 봉투 형식(`{ data, pagination }`, `PATCH` body top-level 키 계약, 400/404/409 에러 코드 매핑)은 `spec/5-system/2-api-convention.md`·`spec/conventions/error-codes.md`가 정의한 정식 규약을 대체로 충실히 따른다. 다만 이번 --impl-prep 검토 대상인 "다음 실행 시각(cron next-run)" 관련 서술에서, 문서가 묘사하는 목록 화면의 필드 노출(§1 목업·§2.1)과 실제 API/DTO 계약(단건 조회 전용, `findAll`은 Schedule 미조인)이 어긋나며 §3 API 절이 이 비대칭을 문서화하지 않는다 — 이는 API 규약이 요구하는 "실제 응답 계약 문서화" 원칙에서 벗어난 WARNING 급 갭이다. 그 외 지적 사항은 편집 수준(Rationale 번호 정리)이거나 폴더 전체의 기존 관행(Overview 섹션 생략)이라 이번 문서 고유의 규약 위반으로 보기 어렵다.

## 위험도

MEDIUM
