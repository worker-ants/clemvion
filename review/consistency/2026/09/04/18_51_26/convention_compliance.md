# 정식 규약 준수 검토 — spec/2-navigation/

## 검토 방법 메모

- 이번 PR 의 `spec/2-navigation/` 델타는 0개 파일 (정상 — 코드 전용 PR). 구현 diff 는 3개 파일(121줄): `validation.pipe.spec.ts`(신규 테스트), `query-execution.dto.ts`(`workflowId` 쿼리 필드 제거), `swagger-dto-contract-guard.ts`(`@Transform` 예외 주석 재실측).
- 프롬프트 번들이 컨텍스트 예산으로 `spec/conventions/**` 전체(273개)와 `spec/2-navigation/` 15개 파일을 절단했다. **diff 와 직접 관련된** 두 정식 규약 파일 — [`spec/conventions/swagger.md`](../../../../../../spec/conventions/swagger.md), [`spec/conventions/error-codes.md`](../../../../../../spec/conventions/error-codes.md) — 을 절대경로로 직접 Read 했다. 아울러 diff 가 인용하는 [`spec/2-navigation/14-execution-history.md`](../../../../../../spec/2-navigation/14-execution-history.md)(번들에서 절단됨)도 직접 Read 해 diff 주석의 spec 인용("페이지네이션, 상태 필터, 정렬만 약속")을 실측 대조했다.
- 번들에 완전히 실린 3개 spec 문서(`3-schedule.md` · `1-workflow-list.md` · `2-trigger-list.md`)의 API 표·에러 코드·문서 구조를 위 두 규약 및 `project-planner/SKILL.md` §명명 컨벤션과 대조했다.
- `spec/conventions/cafe24-*` 계열(273개 중 다수)은 본 PR·대상 영역과 무관해 열지 않았다.

## 발견사항

### [INFO] DTO 필드 제거가 spec 약속 범위와 정확히 일치함 — 규약 위반 아님, 확인용 기록
- target 위치: `spec/2-navigation/14-execution-history.md` §5 "GET `/api/executions/workflow/:workflowId`" 행(345번째 줄)
- 위반 규약: 없음 (positive confirmation)
- 상세: diff 는 `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터, `@IsUUID()` 로 인해 무시하지 않고 400 을 던지던 필드)를 제거했다. 커밋 주석은 "spec(`2-navigation/14-execution-history.md:345`)도 '페이지네이션, 상태 필터, 정렬'만 약속한다"고 주장하는데, 해당 spec 행을 직접 Read 해 대조한 결과 **정확히 일치**한다 — "페이지네이션, 상태 필터, 정렬 지원"만 명시하고 `workflowId` 쿼리 필터는 스펙 어디에도 약속돼 있지 않다(엔드포인트 경로 자체가 이미 `:workflowId` 로 스코프됨). `spec/conventions/error-codes.md` §1 "의미 기반 명명" 관점에서도 이 제거는 wire 계약(에러 코드) 변경이 아니라 미사용 쿼리 파라미터 제거이므로 §2 rename 안정성 정책의 적용 대상도 아니다.
- 제안: 조치 불요. spec-impl 정합성이 이미 맞는 사례로, 문서 갱신도 필요 없다.

### [INFO] 에러 코드 명명 — 전수 UPPER_SNAKE_CASE, 도메인 prefix 규칙 준수
- target 위치: `spec/2-navigation/3-schedule.md`(암묵), `spec/2-navigation/1-workflow-list.md` §3.1(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`), `spec/2-navigation/2-trigger-list.md` §3(`RESOURCE_CONFLICT`/`VALIDATION_ERROR`/`AUTH_CONFIG_NOT_FOUND`/`RESOURCE_NOT_FOUND`/`TRIGGER_ENDPOINT_PATH_CONFLICT`)
- 위반 규약: 없음 (positive confirmation)
- 상세: `spec/conventions/error-codes.md` §1 은 "의미 기반 명명 + `UPPER_SNAKE_CASE`"를, §3 예외 레지스트리는 `lower_snake_case`(초대 모듈)·`AbortError`(PascalCase) 같은 명시적 등록 예외만 허용한다. 대상 3개 문서가 노출하는 에러 코드는 전부 `UPPER_SNAKE_CASE`이고 §3 예외 목록에 해당하지 않는 신규/기존 코드다. `VALIDATION_ERROR`는 §1의 "시스템 전역 공용 코드"(prefix 없음 허용)에 해당한다. 위반 없음.
- 제안: 조치 불요.

### [INFO] 문서 구조 — Overview 위임(`_product-overview.md`) + `## Rationale` 패턴 준수
- target 위치: `spec/2-navigation/3-schedule.md` / `1-workflow-list.md` / `2-trigger-list.md` 전체
- 위반 규약: 없음 (positive confirmation) — `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)"
- 상세: SKILL.md 는 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"로 Overview 를 위임할 수 있다고 명시한다. 대상 3개 문서는 자체 `## Overview` 헤더 대신 문서 상단에 `_product-overview.md` 로의 앵커 링크(`> 관련 문서: [PRD 내비게이션](./_product-overview.md#...)`)를 두고, 각각 `## Rationale` 로 종결한다 — `spec/2-navigation/_product-overview.md` 파일이 실제로 존재함을 확인했다(디렉토리 리스팅 상). 파일명도 SKILL.md §명명 컨벤션의 `N-name.md`(정렬 보장된 상세 spec) 패턴(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)을 따른다. 구조 규약 위반 없음.
- 제안: 조치 불요.

### [INFO] Swagger DTO 규약(§1-4 닫힌 union / §5 응답 래퍼) — 직접 관련 diff 없음, 회귀 없음
- target 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (diff), `spec/conventions/swagger.md` §1-4
- 위반 규약: 없음
- 상세: diff 는 `swagger.md` §1-4 가 규정하는 "`@Transform` 필드는 wire/instance 타입이 달라 OpenAPI `nullable` 판정 축이 면제된다"는 원리 자체를 바꾸지 않고, 그 원리를 뒷받침하던 유일한 실사례(`QueryExecutionDto.workflowId`)가 제거되어 실사례 0건이 됐다는 사실을 갱신하며 대조군 fixture로 분기를 고정했다. `swagger.md` 본문은 이 가드의 세부 주석을 직접 규정하지 않으므로 이 변경으로 인한 규약-코드 불일치는 없다.
- 제안: 조치 불요.

## 요약

이번 검토 대상 delta(`spec/2-navigation/` 0개 파일 + 구현 diff 3개 파일 121줄)는 `spec/2-navigation` 정식 규약 준수 관점에서 **위반 사항이 발견되지 않았다**. 구현 diff(죽은 쿼리 파라미터 `QueryExecutionDto.workflowId` 제거 + swagger-dto-contract-guard 주석 재실측)는 `spec/2-navigation/14-execution-history.md` §5 가 이미 약속한 범위(페이지네이션·상태 필터·정렬만)와 정확히 일치하며, `spec/conventions/error-codes.md`(명명·rename 안정성)나 `spec/conventions/swagger.md`(DTO/응답 패턴)의 어떤 조항도 건드리지 않는다. 번들에 실린 3개 spec 문서(`3-schedule.md`·`1-workflow-list.md`·`2-trigger-list.md`)를 직접 대조한 결과 에러 코드 명명(전수 `UPPER_SNAKE_CASE`, §3 예외 레지스트리 미해당), 파일·섹션 구조(`N-name.md` + `_product-overview.md` 위임 + `## Rationale` 종결) 모두 `spec/conventions/**` 및 `project-planner/SKILL.md` 명명 컨벤션과 일치한다. 컨텍스트 예산으로 절단된 나머지 15개 `spec/2-navigation/*.md`(`4-integration.md` 등)와 273개 `spec/conventions/**` 파일 전수는 이번 diff 와 참조 관계가 없어 직접 열람하지 않았다 — 이 부분에 대한 전수 감사가 필요하면 별도 스코프의 검토를 권장한다.

## 위험도
NONE
