# Cross-Spec 일관성 검토 — §5.4 응답-계약 스윕 (impl-done, scope=spec/5-system/)

## 검토 방법 메모

이 검토는 `--impl-done` 모드이며 `spec/5-system/` 델타는 0파일(정상 — 코드 전용 PR)이다.
프롬프트에 실린 구현 diff 섹션(`<git diff origin/main...HEAD -- code_areas>`)은 예산 초과로
생략되어 있었으므로, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
`git diff origin/main...HEAD -- codebase/ spec/` 를 직접 재현해 29개 파일 / 1698줄 전문을 확인했다
(프롬프트가 알린 수치와 정확히 일치). 아래 발견사항은 그 diff 전문 + `spec/1-data-model.md` ·
`spec/5-system/1-auth.md` · `spec/5-system/2-api-convention.md §5.4` · `spec/conventions/secret-store.md` ·
`spec/5-system/14-external-interaction-api.md §7.1` · `spec/5-system/15-chat-channel.md` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 대조에 근거한다.

## 발견사항

### [WARNING] `ScheduleDto.trigger` 를 키-생략형으로 선언 — data model 의 NOT NULL 1:1 보장과 §5.4 선택 기준에 양쪽 다 안 맞는다

- **target 위치**: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerRefDto.workflow?`, `ScheduleDto.trigger?` — 둘 다 `@ApiPropertyOptional`), `schedules.controller.ts` 의 `toResponse()` (`return t ? {...} : rest;`)
- **충돌 대상**: `spec/1-data-model.md §2.9.1` ("Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑", "Trigger(type=schedule)는 반드시 1개의 Schedule을 가짐") · `spec/5-system/2-api-convention.md §5.4` (부재 표현 선택 기준 (a)/(b) + "그 필드를 문서화하는 절에 사유를 명시")
- **상세**:
  - 데이터 모델은 Schedule↔Trigger 를 **NOT NULL FK 1:1**로 명시한다 — Trigger 행은 Schedule 이 존재하는 한 항상 존재한다.
  - 실제 호출부도 이를 어기지 않는다: `SchedulesService.findAll`(`leftJoinAndSelect('s.trigger','t')`) · `findById`(`relations:['trigger','trigger.workflow']`) · `create()`(`saved.trigger = savedTrigger` — 이번 diff 가 `if(isActive)` 밖으로 뺀 자리) · `update()`(`saved.trigger = trigger ?? schedule.trigger`) 넷 다 **무조건** `trigger` 를 채운다. 이번 PR 이 새로 추가한 e2e `C-3`(`schedule-trigger.e2e-spec.ts`)도 `isActive: false` 생성·PATCH 비활성화 양쪽에서 `trigger` 가 존재함을 직접 단언한다.
  - 즉 컨트롤러의 `toResponse()` 삼항 분기(`t ? {...} : rest`)가 대비하는 "trigger 없음" 분기는 현재 어떤 컨트롤러 도달 경로에서도 실측되지 않는 이론적 케이스다.
  - §5.4 는 "기본은 `null`(상시 존재)" 이고, 키 생략은 (a) 다른 표면과 형식 일치 또는 (b) 소비자가 부재를 정상 경로로 다루는 선택적 컨텍스트일 때만 쓰며, **그 사유를 그 필드를 문서화하는 절에 명시**해야 한다고 규정한다. `ScheduleDto.trigger` 는 이번 PR 로 신규 선언되는 필드라 "소급 적용 대상 아님" 예외(§5.4 하단)에 해당하지 않는데, `spec/2-navigation/3-schedule.md §4 API` 어디에도 이 필드의 존재나 부재-선택 사유가 기록돼 있지 않다 — 근거는 코드 주석에만 있다.
  - 비교: 이번 PR 이 같은 스윕에서 `IntegrationDto` 확장 필드를 위해서는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `4-integration.md §9.1 — IntegrationDto 확장 필드 포인터 (planner, 2026-09-05 등재)` 로 후속 스펙 갱신을 명시적으로 열어 두었다. `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow` 에는 그 트래커 안에 대응하는 항목이 없다(전수 grep 확인) — 같은 패턴(신규 필드 → spec 포인터 필요)을 한쪽만 등재했다.
- **제안**: (1) `spec/2-navigation/3-schedule.md §4` 또는 `1-data-model.md §2.9.1` 에 `trigger` 응답 필드와 그 참조 형태(id/name/workflowId/workflow.name)를 문서화하고, 부재가 정말 발생 가능한 경로(있다면 어떤 것인지)를 §5.4 기준 (a)/(b) 중 하나로 명시한다. (2) 실측대로 모든 경로에서 항상 채워진다면, `@ApiPropertyOptional()` 대신 §5.4 기본형(`@ApiProperty({ nullable: false })` 또는 최소한 근거 있는 optional 선언)으로 재검토한다. (3) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `IntegrationDto` 항목과 대칭되는 `ScheduleDto.trigger` 포인터 항목을 추가해 planner 턴에서 처리하도록 남긴다.

### [WARNING] `spec/conventions/secret-store.md §1` 의 "노출 창이 아직 닫히지 않았다" 서술이 이 PR로 stale 화됨 — 정정 누락

- **target 위치**: (코드) `codebase/backend/src/modules/triggers/triggers.service.ts` `TRIGGER_RESPONSE_STRIP_COLUMNS` + `sanitizeForResponse()`, `schedules.controller.ts` `toResponse()`
- **충돌 대상**: `spec/conventions/secret-store.md` §1 (line 69-78, `9a9c024a6` 로 origin/main 에 이미 존재)
- **상세**: 해당 문단은 현재형으로 다음을 주장한다 — *"노출 창은 아직 설계대로 닫혀 있지 않다... **현행 구현은 `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을 그대로 싣는다**... 즉 grace 24h 동안 **매 요청** 노출된다."* 그런데 이 브랜치의 `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼 2개 삭제) + `schedules.controller.ts` 의 4필드 allowlist 좁히기가 정확히 그 두 엔드포인트의 그 갭을 닫는다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 자신도 "트리거 회전 secret 이 응답에 나간다" 체크박스를 `[x]` 완료로 갱신하며 "이 브랜치가 그 수정이다" 라고 적었다(즉 plan 은 갱신됐다). 반면 `secret-store.md §1` 의 원문은 여전히 "아직 닫혀 있지 않다" 는 현재형 주장을 그대로 두고 있어, 이 PR 병합 후에는 spec 텍스트가 실제 구현과 어긋나는 상태가 된다.
- **제안**: `secret-store.md §1` 의 해당 문단을 갱신 — 같은 파일 §7.1 정정 이력이 이미 쓰는 패턴(원문을 취소선/인용으로 남기고 "정정 이력 (날짜)" 블록 추가)을 따라 "노출 창이 이 PR 로 닫혔다"는 사실과 커밋 참조를 덧붙인다. `spec/` 쓰기 권한은 `project-planner` 소관이므로 developer 자기반증 예외(CLAUDE.md §자기-반증형 소정정) 대상이 아니면 별도 planner 턴으로 처리한다.

## 요약

이번 diff(§5.4 응답-계약 스윕: AlertRule/Integration/KnowledgeBase/Trigger DTO 필드 선언 보정, Schedule 트리거 join 좁히기, `sanitizeForResponse` 확장, §5.4 금지-조합 정적 래칫 신설)는 검증한 전 영역에서 **data model(`spec/1-data-model.md`) 과 필드 단위로 정확히 일치**하고, RBAC 매트릭스(§3.2, Trigger/Schedule 모두 Viewer=R)와 상충하지 않으며, `spec/conventions/secret-store.md §1.1`·`spec/5-system/2-api-convention.md §5.4`·`spec/5-system/14-external-interaction-api.md §7.1`이 요구/서술하는 비밀-스트립 규범을 오히려 **정확히 구현해 닫는** 방향이다(사전에 등재된 알려진 갭의 해소). 다만 (1) `ScheduleDto.trigger` 를 키-생략형으로 새로 선언하면서 §5.4 가 요구하는 문서화된 선택 근거를 spec 쪽에 남기지 않았고 그 형태가 data model 의 NOT NULL 1:1 보장·실측 호출부 동작과 약간 어긋나며, (2) 이 PR 이 닫은 노출 갭을 `secret-store.md §1` 이 여전히 "열려 있다"고 서술해 spec-vs-구현 staleness 가 새로 생겼다. 둘 다 기능을 깨뜨리는 직접 모순은 아니고 spec 동기화 누락 성격이라 WARNING 등급이 적절하다.

## 위험도

LOW
