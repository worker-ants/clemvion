# 정식 규약 준수 검토 결과

## 검토 대상

- Target: `spec/2-navigation/` (구현 완료 후 검토, diff-base `origin/main`)
- 실제 변경분: `feat(triggers): V-10 목록에 Schedule cron·다음 실행 시각 enrichment` (커밋 `73c022fc2`)
  - `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` — JSDoc 3건 정정
  - `codebase/backend/src/modules/triggers/triggers.service.ts` — `findAll()` 이 schedule 타입 행을 배치 조회로 enrich, 반환 타입 `Trigger` → `TriggerDetail`
  - `codebase/backend/test/schedule-trigger.e2e-spec.ts` — e2e 케이스 추가 (`C-2`)
  - `CHANGELOG.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — 문서 갱신
  - SoT spec: `spec/2-navigation/2-trigger-list.md §2.1`(이미 cron·다음 실행 시각을 목록 행 요소로 명시), spec 본문 변경 없음(정합 확인만)

## 발견사항

해당 diff 를 `spec/conventions/swagger.md`(DTO·Controller·응답 wrapper 패턴), `spec/conventions/error-codes.md`, `spec/5-system/2-api-convention.md §5.2`(목록 응답 pass-through), `CLAUDE.md` 명명 컨벤션 관점에서 점검한 결과 위반 사항을 찾지 못했다.

- **DTO 패턴(swagger.md §1)**: `TriggerDto.cronExpression`/`timezone`/`nextRunAt` 필드 자체는 기존에 이미 존재했고, 이번 변경은 JSDoc 설명 텍스트("단건 조회 시에만" → "목록·단건 조회 모두")만 정정했다. `@ApiPropertyOptional` 데코레이터·타입·nullable 표기는 변경되지 않았고 기존 패턴과 일치한다.
- **Controller/응답 wrapper(swagger.md §2, §5)**: `TriggersController.findAll()` 은 `@ApiOkPaginatedResponse(TriggerDto, ...)` 를 그대로 사용한다. 서비스 반환 타입이 `Trigger` → `TriggerDetail`(`Trigger & { cronExpression?, timezone?, nextRunAt? }`) 로 바뀌었으나 `TriggerDetail` 은 `TriggerDto` 의 필드 상위집합이라 Swagger 문서화 계약(`{ data: TriggerDto[], pagination }` single-wrap)과 어긋나지 않는다. `TriggerDetail` 타입은 기존 `findOneDetail()` 이 이미 사용하던 타입을 재사용한 것으로 신규 명명 규칙 위반이 없다.
- **N+1 회피 패턴**: `scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds), workspaceId } })` 로 배치 조회하며 `workspaceId` 로 멀티테넌시 스코프도 함께 건다 — 기존 `workflow-list §2.4`/`schedules.findAll` 의 list-level enrichment 선례와 동일 패턴(diff 주석에 근거 명시)이라 규약 이탈이 아니다.
- **에러 코드**: 이번 diff 는 신규 에러 코드를 도입하지 않는다. `error-codes.md` 관련 위반 없음.
- **e2e 네이밍**: 신규 테스트 케이스 `C-2. GET /api/triggers 목록이 schedule 트리거의 cron·nextRunAt 을 포함 (V-10)` 은 같은 파일의 기존 `A`/`B`/`D` 알파벳 케이스 명명 스타일과 정합. `list.body.data` 로 페이지네이션 응답의 `{ data, pagination }` single-wrap 계약을 그대로 소비해 `api-convention §5.2`/`swagger.md §5 Rationale` 과 어긋나지 않는다.
- **spec 문서 자체(`2-trigger-list.md`)**: frontmatter(`id`/`status`/`code`), 3섹션 구성(화면 구조 → 기능 상세/API → Rationale), Rationale 각 항목에 근거 번호(R-1~R-16) 부여 등 기존 관례를 그대로 유지하며 이번 PR 이 spec 본문을 변경하지 않았다(§2.1 이미 목록 cron·다음 실행 시각 표시를 명시하고 있었음 — CHANGELOG·plan 양쪽에서 "spec 변경 불요" 로 명시적으로 확인됨).

## 요약

이번 PR 은 `spec/2-navigation/2-trigger-list.md §2.1` 이 이미 약속했던 "목록에서도 Schedule 트리거의 cron 식·다음 실행 시각 표시"를 코드(`TriggersService.findAll()`)가 실제로 이행하도록 맞춘 좁은 범위의 변경이며, 응답 DTO·Swagger 데코레이터·페이지네이션 wrapper·명명 규칙 어느 것도 새로 도입하거나 변경하지 않고 기존 정식 규약(swagger.md, api-convention §5.2)의 기존 패턴을 그대로 재사용했다. 검토 범위(`spec/2-navigation/`) 내 다른 spec 문서들(대시보드·워크플로우 목록·인증·에러/빈 상태·유저 가이드·실행 내역·시스템 상태·agent memory)에도 이번 diff 로 인한 영향이나 신규 위반 소지는 없다. CRITICAL/WARNING/INFO 각각 발견된 항목 없음.

## 위험도

NONE
