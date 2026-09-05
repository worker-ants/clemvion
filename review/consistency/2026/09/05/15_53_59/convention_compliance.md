# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

## 검토 범위와 방법

- 검토 모드: `--impl-done`, target scope=`spec/5-system/`, diff-base=`origin/main`.
- **spec/5-system/ 델타는 0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다. 따라서 "target
  문서가 정식 규약을 따르는가" 의 실질 대상은 (a) `spec/5-system/` 의 기존 3개 전문
  포함 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`, 나머지는 프롬프트
  예산 절단으로 헤더만 포함)와 (b) 이 문서들이 규정한 규약을 **구현 diff 가 지키는가**
  두 축이다.
- 구현 diff(9파일/1,101줄, HEAD 워킹트리 절대경로로 직접 `git diff origin/main...HEAD --
  codebase/` 실측)를 직접 읽고 `spec/conventions/swagger.md`·`review-citations.md`·
  `spec-impl-evidence.md` 원문(파일시스템에서 직접 Read, 프롬프트 번들 아님)과 대조했다.
  변경 파일: `audit-logs.service.ts`/`.spec.ts`, `execution-response.dto.spec.ts`(신규),
  `shared/testing/response-contract.ts`(신규)/`.spec.ts`(신규), e2e 4종.

## 발견사항

- **[INFO]** `spec/5-system/2-api-convention.md` 등 6개 문서에 `## Overview` 섹션 없음
  - target 위치: `spec/5-system/2-api-convention.md` 상단 (title 직후 바로 `## 1. 기본 원칙`으로 진입, `## Overview` 헤더 부재)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 + 각 SKILL.md 의 "Spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장"
  - 상세: `spec/5-system/*.md` 17개 중 `_product-overview.md`(그 자체가 overview 문서라 예외) 를 제외한 16개 중 **6개**(`2-api-convention.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md`)가 `## Overview` 헤더 없이 바로 본문으로 들어간다. `## Rationale` 은 16/16 전부 있어 3섹션 중 Overview 만 비대칭으로 빠져 있다. **이 PR 의 델타 0 이므로 이 6개 문서는 이 PR 이전부터 이 상태였다** — 새로 도입된 위반이 아니다.
  - 제안: 규약이 "권장"(mandatory 아님)이므로 CRITICAL/WARNING 은 아니다. 다음에 이 6개 문서를 편집할 project-planner 턴에서 짧은 `## Overview` 절을 추가해 3섹션 구성을 맞추는 것을 권한다. 또는 이 6개가 "프로토콜/규칙 나열형" 문서라 Overview 가 구조적으로 불필요하다고 판단되면, SKILL.md 쪽에 "규칙 카탈로그형 문서는 Overview 생략 가능" 예외를 명시적으로 적어 규약과 실태를 맞추는 편이 낫다.

- **[INFO]** 신규 코드의 리뷰 인용·swagger 규약 준수는 양호 — 위반 없음 확인
  - target 위치: `codebase/backend/src/shared/testing/response-contract.ts`, `audit-logs.service.ts`, `execution-response.dto.spec.ts` 의 JSDoc/주석
  - 관련 규약: `spec/conventions/review-citations.md` §2(날짜 포함 의무), `spec/conventions/swagger.md` §5-1(엔티티 패스스루 금지)·§5.4/§1-3(optional vs nullable 선언 형태)
  - 상세(검증 결과, 위반 아님): 신규 주석의 리뷰 인용은 전부 `review/code/2026/09/05/HH_MM_SS [W/C]#` 전체 경로 형식으로, §2 가 금지하는 bare `hh_mm_ss` 가 하나도 없다. `audit-logs.service.ts` 는 `leftJoinAndSelect`(entity 전체 패스스루, §5-1 이 명시 금지하는 패턴)를 `leftJoin`+`addSelect(['user.id','user.name','user.email'])` 로 교체해 §5-1 을 오히려 새로 준수하게 만들었다 — 사전에 존재하던 위반(`User` 26개 컬럼 노출, `passwordHash`/`totpRecoveryCodes`/`passwordResetToken` 포함)을 이 diff 가 고친 것이다. `execution-response.dto.spec.ts` 가 고정하는 `ExecutionDto` 의 10개 "optional+nullable" 필드는 §5.4 선언층 위반이지만, 이 diff 가 새로 만든 것이 아니라 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 기존 drift 이고, 테스트 자체가 "고치는 게 아니라 고정한다"고 명시해 위반을 은폐하지 않는다.
  - 제안: 해당 없음 (긍정 확인, 조치 불요).

- **[INFO]** `response-contract.ts` 의 `AuditLogListItem` 등 내부 프로젝션 타입은 `dto/responses/` 명명 규약 대상 아님을 확인
  - target 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 상단 `AuditLogListItem` 타입
  - 관련 규약: `spec/conventions/swagger.md` §5-1 (응답 DTO 는 `dto/responses/*-response.dto.ts` 에 위치)
  - 상세: `AuditLogListItem` 은 `@ApiProperty` 데코레이터가 없는 순수 TS 타입으로 OpenAPI 스키마에 노출되지 않는다(실제 OpenAPI 계약은 기존 `AuditLogDto`/`AuditLogUserDto` 가 그대로 담당). 따라서 §5-1 의 "응답 DTO 위치" 규칙 대상이 아니며 서비스 파일 내 정의가 규약 위반은 아니다.
  - 제안: 해당 없음.

## 요약

이 PR 은 `spec/5-system/` 문서 자체를 건드리지 않았다(델타 0). 구현 diff(감사 로그 `User` 엔티티 패스스루 유출 수정 + `assertMatchesContract`/`contractForDto` 응답-계약 검증기 신설 + `ExecutionDto` 스키마 회귀 가드)는 `spec/5-system/2-api-convention.md §5.4`·`spec/conventions/swagger.md §5-1/§1-3`·`spec/conventions/review-citations.md §2` 를 직접 대조했을 때 새로운 위반을 도입하지 않았고, 오히려 §5-1 이 금지하는 기존의 엔티티 패스스루 위반(감사 로그의 `passwordHash` 등 26개 키 노출)을 고쳤다. 유일하게 남는 지적은 `spec/5-system/` 문서 구조 관례(Overview/본문/Rationale 3섹션) 중 Overview 가 6개 파일에서 비어 있다는 것인데, 이는 이 PR 이전부터 존재한 상태이고 규약 자체가 "권장" 등급이라 CRITICAL/WARNING 이 아니라 INFO 로 남긴다.

## 위험도

LOW
