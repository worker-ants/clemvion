# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/5-system/14-external-interaction-api.md` + `spec/5-system/16-system-status-api.md` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [WARNING] 응답 DTO 파일 위치 — 규약 경로 미준수
- **target 위치**: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`
- **위반 규약**: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치는 `dto/responses/*-response.dto.ts` 하위 디렉터리
- **상세**: 규약은 응답 DTO를 `dto/responses/` 하위 디렉터리에 `*-response.dto.ts` 파일명 패턴으로 두도록 지정한다. 현 구현은 `dto/responses.dto.ts` (단일 flat 파일, 하위 디렉터리 없음)에 `InteractAckDto`, `RefreshTokenResponseDto`, `ExecutionStatusDto` 를 모두 모은다. `swagger.md §5-4` 체크리스트 첫 항목("응답 DTO가 `dto/responses/` 에 있는지")에도 명시적으로 위배된다.
- **제안**: `dto/responses/` 하위 디렉터리를 생성하고 `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`, `execution-status-response.dto.ts` 로 분리 이동하거나, 최소한 `dto/responses/responses.dto.ts` 로 이동하여 규약 경로를 준수한다. import 경로는 자동 수정.

---

### [WARNING] Swagger 에러 응답 설명에 비규약 에러 코드 `VALIDATION_FAILED` 사용
- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` line 72 — `@ApiBadRequestResponse({ description: 'VALIDATION_FAILED (form field) / ...' })`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명) 및 `spec/5-system/14-external-interaction-api.md §5.1` 에러 표 (정식 코드: `VALIDATION_ERROR`)
- **상세**: spec §5.1 의 에러 표에는 form field 검증 실패 코드가 `VALIDATION_ERROR` 로 명시되어 있다. 그런데 controller 의 `@ApiBadRequestResponse` 설명 문자열은 `VALIDATION_FAILED` 라는 다른 코드를 노출한다. Swagger UI 를 통해 외부에 노출되는 문서에서 spec SoT 와 어긋난 코드명이 표기된다. `error-codes.md §1` 의 "코드의 의미로 분기"하는 클라이언트 계약 원칙에 따라 문서에 노출되는 코드명 일관성도 준수해야 한다.
- **제안**: `description` 을 `'VALIDATION_ERROR (form field) / INVALID_COMMAND (필수 필드 누락).'` 으로 정정한다.

---

### [WARNING] `dto/responses.dto.ts` 필드에 JSDoc 주석 일부 누락
- **target 위치**: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` — `InteractAckDto.executionId`, `ExecutionStatusDto.id`, `ExecutionStatusDto.workflowId`, `ExecutionStatusDto.updatedAt` 필드
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)"
- **상세**: `InteractAckDto.executionId` 는 JSDoc 없이 `@ApiProperty({ format: 'uuid' })` 만 있다. `ExecutionStatusDto.id`, `workflowId`, `updatedAt` 도 JSDoc 주석이 없다. CLI 플러그인이 `@ApiProperty` 의 `format` 메타는 추론하지만 `description` 은 JSDoc 이 없으면 비워지므로 Swagger UI 에서 필드 의미가 표시되지 않는다.
- **제안**: 누락 필드에 한국어 JSDoc 주석을 추가한다. 예: `/** execution UUID */`, `/** 갱신 시각 (ISO8601) */`.

---

### [INFO] `spec/5-system/16-system-status-api.md` — `## Rationale` 섹션 헤더 누락
- **target 위치**: `spec/5-system/16-system-status-api.md` (Rationale 블록)
- **위반 규약**: CLAUDE.md — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (3섹션 권장)
- **상세**: `spec/5-system/16-system-status-api.md` 에는 Rationale 항목들이 `### R-1` ... `### R-5` 형태로 존재하지만 상위 `## Rationale` 헤더가 없이 바로 `### R-1` 로 시작한다. `spec/5-system/14-external-interaction-api.md` 는 `## Rationale` 헤더가 올바르게 있다.
- **제안**: `### R-1. 왜 개별 job 을 노출하지 않는가` 위에 `## Rationale` 섹션 헤더를 삽입한다.

---

### [INFO] `spec/5-system/14-external-interaction-api.md` — Overview 와 본문 경계 불명확
- **target 위치**: `spec/5-system/14-external-interaction-api.md` — `## Overview (제품 정의)` 이후 `## 3. 요구사항` 이 동일 `##` 수준으로 시작
- **위반 규약**: CLAUDE.md — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 요구사항(본문)이 `## 3. 요구사항` 으로 Overview 와 같은 헤딩 레벨에 나열되어 섹션 경계가 불명확하다. 기능적 문제는 없으나 3섹션 구조 가독성이 저하된다.
- **제안**: `## 3. 요구사항` 앞에 구분선(`---`) 또는 `## 본문` 절을 추가해 섹션 경계를 명시화한다.

---

## 요약

target 문서(14-external-interaction-api, 16-system-status-api) 와 관련 구현 코드는 정식 규약의 핵심 항목 — Swagger Bearer scheme(`interaction-token`) 분리, 공용 래퍼 헬퍼(`ApiAcceptedWrappedResponse`/`ApiOkWrappedResponse`) 사용, `@ApiBearerAuth('interaction-token')` 적용, 에러 코드 `UPPER_SNAKE_CASE` 표기, 문서 Rationale 섹션 구성 — 을 대체로 준수하고 있다. 주요 문제는 두 가지다. (1) 응답 DTO 파일이 `dto/responses.dto.ts` (flat) 로 있어 규약 지정 경로 `dto/responses/*-response.dto.ts` 를 충족하지 못하고, (2) `@ApiBadRequestResponse` 설명에 스펙 정의 코드 `VALIDATION_ERROR` 대신 비규약 문자열 `VALIDATION_FAILED` 가 노출된다. 이 두 항목은 WARNING 이며 외부 Swagger 문서 노출 품질에 영향을 준다. 나머지는 사소한 형식 일관성 문제(INFO) 에 해당한다.

## 위험도

LOW

STATUS: DONE
