# Cross-Spec 일관성 검토 — V-10 impl-done (트리거 목록 Cron·다음 실행 시각 배치 조회)

> 참고: 본 세션의 `_prompts/cross_spec.md` 페이로드가 `spec/2-navigation/` 일반 항목(대시보드·워크플로우 목록 등)으로 mismatch 되어 있어, 그 payload 대신 `git diff origin/main...HEAD` 와 지시된 target spec 문서를 직접 읽어 검토했다.

## 검토 대상

- Target diff: `codebase/backend/src/modules/triggers/triggers.service.ts` `findAll()` 이 schedule 타입 트리거 행을 `scheduleRepository.find({ where: { triggerId: In([...]), workspaceId } })` 배치 조회로 enrich(`cronExpression`/`timezone`/`nextRunAt`). `TriggerDetail` 타입 도입(`Trigger & { cronExpression?, timezone?, nextRunAt? }`), `trigger-response.dto.ts`(`TriggerDto`) JSDoc 3필드 정정("schedule 타입 트리거 단건 조회 시에만 채워짐" → "목록·단건 조회 모두 채워짐"), 신규 unit(`triggers.service.spec.ts` 3케이스) + e2e(`schedule-trigger.e2e-spec.ts` C-2 1케이스).
- 참고: 직전 세션(`review/consistency/2026/07/05/17_26_42/cross_spec.md`, impl-prep 단계)이 이미 동일 변경을 상세 검토했고(위험도 NONE, INFO 1건 — DTO 주석 stale 예정), 본 구현이 그 계획대로 정확히 실행되었는지 diff 기준으로 재검증했다.

## 검토 관점별 결과

### 1. 데이터 모델 충돌 — 없음

- `spec/1-data-model.md` §2.8 Trigger 테이블에는 `cronExpression`/`timezone`/`nextRunAt` 컬럼이 없다(의도적 — Schedule 전용 컬럼). §2.9 Schedule 이 `cron_expression`/`timezone`/`next_run_at`을 정의하며, 실제 `Schedule` 엔티티(`codebase/backend/src/modules/schedules/entities/schedule.entity.ts`)의 컬럼명(`cronExpression`/`timezone`/`nextRunAt`, FK `triggerId`/`workspaceId`)과 diff 코드가 정확히 일치한다.
- `TriggerDetail = Trigger & { cronExpression?, timezone?, nextRunAt? }` 는 DB 영속 컬럼이 아니라 API 응답 전용 derived 타입 — §2.8 JSDoc 이 이미 이런 패턴(`hasBotToken` derived 필드)을 명시적으로 허용하고 있어 선례와 정합한다.
- §2.9.1 Trigger↔Schedule 동기화 규칙(write-path: 생성/이름/is_active/삭제 동기화)은 이번 변경의 대상(read-path, `findAll` 목록 조회)과 무관 — 상태·동기화 규칙 어느 것도 건드리지 않는다.

### 2. API 계약 충돌 — 없음

- `spec/2-navigation/2-trigger-list.md` §2.1 "Schedule 태그 | Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각"과 §1 목업(`daily-report [Schedule] ... 0 9 * * * Next: 09:00`)이 이미 목록 행에서의 cron/다음 실행 시각 표시를 명문화하고 있다 — 이번 구현은 그 약속을 코드로 충족시킨 것으로, 새 계약을 만든 게 아니라 기존 계약과 실제 동작(`findAll` 미enrichment) 간의 공백을 메운다.
- §3 `GET /api/triggers` 행 자체에는 enrichment 문구가 없지만, 이는 diff 이전에도 있던 문서 상세도 격차(§2.1 은 화면 요소로 명시, §3 API 표는 침묵)이며 본 diff 로 인해 §3 텍스트가 모순되게 바뀌지는 않는다(선택적 보강 사항 — impl-prep 세션에서 이미 INFO 로 지목·수용됨).
- `PaginatedResponseDto.create(enriched, totalItems, page, limit)` 를 변경 전과 동일하게 사용해 `{data: [...], pagination: {...}}` top-level 형제 구조를 그대로 유지한다 — `spec/5-system/2-api-convention.md` §5.2 목록 응답 형식과 충돌 없음. 필드 셋 확장만 있고 wrapper shape 변경은 없다.
- Controller(`triggers.controller.ts`)의 `@ApiOkPaginatedResponse(TriggerDto, ...)` 가 `findOneDetail`과 `findAll` 양쪽에서 동일 `TriggerDto` 클래스를 재사용하므로, JSDoc 정정("목록·단건 조회 모두 채워짐")이 Swagger 스키마 설명과 실제 반환 타입(`TriggerDetail`)을 정합시킨다 — 이 부분이 정확히 impl-prep 세션이 예고한 INFO 항목이었고, diff 상에서 의도대로 반영 완료임을 확인했다.

### 3. 요구사항 ID 충돌 — 없음

- "V-10"은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 내부 로컬 감사 식별자이며 `spec/**`의 어떤 요구사항 ID 네임스페이스와도 겹치지 않는다. 해당 plan 체크박스도 diff 에서 `[x]`로 정확히 갱신되었고("잔여: V-10·..." → "**V-10**...완료" + "잔여: V-12·V-13·V-14·V-18"), 다른 항목과의 혼선 없음.

### 4. 상태 전이 충돌 — 없음

- 이번 변경은 read-only 목록 조회(`findAll`)에 한정되며 Trigger/Schedule 어느 쪽의 상태(`is_active`, `chatChannelHealth` 등)도 변경하지 않는다. `update()`의 schedule PATCH 제한 로직(§3 "Schedule 타입 트리거는 name·isActive 만 PATCH 허용")과도 무관하다.

### 5. 권한·RBAC 모델 충돌 — 없음

- `GET /api/triggers`는 변경 전과 동일하게 모든 역할(viewer 포함)에 열려 있고, 추가된 3필드는 `2-trigger-list.md §2.3.1` 필드 권한 매트릭스에서 이미 `read-only (시스템 계산)`으로 분류된 필드다. 목록·단건 어느 경로로 노출되어도 편집 가능 여부·권한 게이트는 동일 — RBAC 신규 분기 불요.
- `scheduleRepository.find`에 `workspaceId` 조건이 포함되어 워크스페이스 경계를 넘는 스케줄 데이터 유출 위험이 없다(cross-workspace 격리 유지).

### 6. 계층 책임 충돌 — 없음

- Schedule 조인 로직을 `TriggersService` 내부(`scheduleRepository` 직접 주입, 기존 `findOneDetail`과 동일 패턴)에 두는 방식은 이미 클래스 내 기존 코드(`syncScheduleActivation`, `findOneDetail`)가 확립한 책임 분할과 동일하다 — `SchedulesService` 쪽 책임을 침범하지 않는다. workflow-list 목록의 list-level enrichment 선례와 같은 접근으로, 기존 아키텍처 결정과 배치되지 않는다.

## 발견사항

없음. CRITICAL/WARNING/INFO 어느 등급에도 해당하는 신규 충돌을 찾지 못했다.

impl-prep 단계(17_26_42 세션)에서 이미 지목한 INFO 1건("`TriggerDto` cron/timezone/nextRunAt JSDoc 'schedule 타입 트리거 단건 조회 시에만 채워짐' 문구가 구현 후 stale")은 본 diff 에서 정확히 해소됨을 확인했다 — `trigger-response.dto.ts` 세 필드 JSDoc 모두 "목록·단건 조회 모두 채워짐"으로 정정되어 있다. 재발 항목 없음.

## 요약

target diff(V-10 impl-done: `TriggersService.findAll()`이 schedule 타입 행을 `triggerId IN (...)` 배치 조회로 enrich하여 `cronExpression`/`timezone`/`nextRunAt`을 목록 응답에 포함)는 `spec/1-data-model.md` §2.8 Trigger·§2.9 Schedule·§2.9.1 동기화 규칙, `spec/2-navigation/2-trigger-list.md` §2.1·§3, `spec/5-system/2-api-convention.md` §5.2 어느 것과도 직접 모순되지 않는다. 오히려 §2.1/§1 목업이 이미 약속한 목록 행 cron·다음 실행 시각 표시를 코드로 충족시켜 스펙-구현 공백을 메우는 방향의 변경이다. `Schedule` 엔티티 필드명·FK 관계·API 응답 wrapper 형식·RBAC 노출 범위 모두 기존 spec 정의와 정확히 일치하며, impl-prep 단계에서 예고된 유일한 동반 갱신 사항(TriggerDto JSDoc stale 문구)도 diff 상에서 정확히 반영되었다. plan 체크박스도 정합하게 갱신되었다.

## 위험도

NONE
