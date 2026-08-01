# Rationale 연속성 검토 — spec/5-system (--impl-done)

## 검토 범위·방법

`prompt_file` 의 target(`spec/5-system` 번들: `1-auth.md`·`3-error-handling.md` + 관련
Rationale 발췌)을 실제로 대조한 결과 **본 브랜치(`audit-logging`)는 `spec/` 을 전혀 건드리지
않았다** (`git diff origin/main -- spec/` = 무출력). 반면 `codebase/` 는 spec §4.1 이 Planned 로
남겨둔 감사 액션 13개(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)를 구현했다
(`807bb2fe5` 외 9차 리뷰 라운드). 따라서 본 검토는 "target 문서 자체의 신규 서술"이 아니라
**신규 구현이 기존 spec Rationale(4.1.A·4.1.B·`conventions/audit-actions.md`·trigger-list
R-4)을 위반·번복·우회하는지** 를 중심으로, 다음을 실제 코드 diff (`git diff origin/main --
codebase/backend/src/modules/{audit-logs,workflows,triggers,schedules,model-config}/**`) 와
대조해 확인했다:

- `audit-action.const.ts` 신규 액션 13개의 명명(dot-prefix·시제)
- `workflows.service.ts`/`triggers.service.ts`/`schedules.service.ts`/`model-config.service.ts`
  의 `recordAudit` 호출 지점·workspace 귀속·트랜잭션 커밋 순서
- `plan/in-progress/spec-sync-auth-gaps.md` (이번 구현의 작업 로그 — 무엇이 의도적으로
  유예됐는지의 1차 증거)
- `spec/data-flow/1-audit.md`·`spec/data-flow/10-triggers.md`·`spec/conventions/audit-actions.md`
  (컨텍스트 예산으로 프롬프트에서 생략되어 `Read` 로 직접 확인)

## 발견사항

- **[INFO]** 신규 "1:1 결합 리소스는 주 리소스만 기록" 감사 dedup 규칙이 spec Rationale 에 아직 없음
  - target 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 상단 주석
    (`**1:1 결합 리소스는 주 리소스만 기록한다.**`) — `SchedulesService.create/remove` 가 짝
    `Trigger` 를 생성/삭제해도 `trigger.created`/`trigger.deleted` 를 남기지 않고, 역으로
    `TriggersService.remove`(schedule 타입 cascade 삭제)·`SchedulesService.update`(짝 Trigger 의
    `name`/`isActive` 동기화)도 상대 리소스의 액션을 남기지 않는다.
  - 과거 결정 출처: 없음 — 이 규칙 자체가 기존 spec Rationale 을 번복하는 것은 아니다(4.1.A·4.1.B
    어디에도 "관련 리소스는 모두 개별 기록" 이라는 반대 원칙이 없어 재도입/위반은 아님). 다만
    프로젝트 규약("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`", 루트 `CLAUDE.md` 정보
    저장 표)상 새 아키텍처 결정은 spec Rationale 이 SoT 인데, 이 결정은 현재 코드 주석("4차 리뷰
    W4 — 라운드 사이에 유실됐던 항목이라 여기 명문화한다")에만 있다.
  - 상세: `git diff origin/main -- codebase/backend/src/modules/schedules/schedules.service.ts
    codebase/backend/src/modules/triggers/triggers.service.ts` 로 실측 — `SchedulesService.create()`
    가 `Trigger` row 를 INSERT 하지만 `recordAudit` 은 `SCHEDULE_CREATED` 1건만 호출(파트너
    `trigger.created` 없음). `SchedulesService.remove()` 도 `triggerRepository.delete(...)` 뒤
    `SCHEDULE_DELETED` 1건만. `TriggersService.remove()` 는 schedule 타입일 때 FK CASCADE 로 짝
    `Schedule` 이 함께 삭제되는데(`data-flow/10-triggers.md §1.4`) `TRIGGER_DELETED` 1건만. `trigger`
    쪽 `update()` 의 `syncScheduleActivation()` 도 짝 `Schedule.isActive` 를 바꾸지만
    `SCHEDULE_UPDATED` 를 남기지 않는다. 이 dedup 규칙이 `plan/in-progress/spec-sync-auth-gaps.md`
    의 "spec SoT 4곳 동기화 — planner 턴 필요" 항목(`data-flow/1-audit.md §1.1` 표 갱신 포함)에
    명시적으로 나열돼 있지 않아, planner 가 그 항목을 CRUD 카탈로그 승격(Planned→구현)으로만
    좁게 해석하면 이 nuance 가 spec 화 없이 코드 주석에만 남을 위험이 있다.
  - 제안: 다음 planner 턴에서 `data-flow/1-audit.md §1.1` writer 표를 갱신할 때(이미 계획됨)
    `member.invited` 의 `details.mode` 각주와 같은 방식으로 "Schedule↔Trigger 1:1 결합 시 주
    리소스만 기록" 각주를 함께 추가하거나, `5-system/1-auth.md §Rationale` 에 4.1.C 항목으로
    승격. `plan/in-progress/spec-sync-auth-gaps.md` 의 "spec SoT 4곳 동기화" 체크리스트에도 이
    nuance 를 명시적으로 한 줄 추가해두면 다음 라운드에서 누락 위험이 줄어든다.

- **[INFO]** `workflow.executed`/`saveCanvas` 고빈도 액션 유예 논거가 spec Rationale 로 아직 승격되지 않음
  - target 위치: `audit-action.const.ts` 주석("**`workflow.executed` 는 의도적으로 미구현이다.**")
    — CRUD 13개와 달리 실행마다 적재되는 고빈도 액션이라 `audit_log` 의 보존 정책 미정(§4.2)과
    묶어야 한다는 논거.
  - 과거 결정 출처: `5-system/1-auth.md §4.2`("보존 정책 미정 — 현재는 정리 배치 없이 무제한
    보관")·`data-flow/1-audit.md §3`(pruner 없음) — 이 두 문장과 상충하지 않고 오히려 그
    귀결(무제한 테이블에 고빈도 이벤트를 넣지 않는다)이라 **번복이 아니라 정합적 확장**이다.
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md` 에 동일 논거로 이미 오픈 항목으로 추적되고
    있어("`workflow.executed` — Planned 잔류. … 보존 정책 결정과 묶어야 한다") 구현이 임의로
    미룬 것이 아니라 의도적·문서화된 유예다. `saveCanvas`/`restoreVersion` 감사 배제도 동일 plan
    파일에 별도 항목(리뷰 W3)으로 열려 있다.
  - 제안: 조치 불요에 가깝다(이미 plan 이 추적) — 다만 "보존 정책이 정해지지 않은 고빈도 액션은
    audit_log 에 넣지 않는다" 는 판단이 향후 다른 도메인(예: 알림 발송, LLM 호출)에도 재사용될
    일반 원칙이라면, 다음 planner 턴에서 `1-auth.md §4.2` 또는 `1-audit.md §3 보존 정책` 옆에
    한 문장으로 명문화해두면 "왜 execution 급 이벤트는 감사하지 않는가" 를 매번 code comment 로
    재추적할 필요가 없어진다.

## 검증 결과 (문제 없음)

다음은 Rationale 위반 가능성이 있어 보였으나 실측 결과 정합했다:

- **명명·시제 (4.1.A·`conventions/audit-actions.md §2-3`)**: 신규 13개 액션 전부
  `AUDIT_ACTIONS`(`WORKFLOW_CREATED='workflow.created'` 등, 과거분사) /
  `model_config.*`(현재형, `MODEL_CONFIG_SET_DEFAULT='model_config.set_default'`)로 registry
  표(§3)와 토큰 단위까지 일치. dot-prefix·언더스코어 구분자 모두 준수.
- **`workspace.deleted` 구조적 제외 Rationale 의 오적용 없음**: `workflow.deleted`/
  `trigger.deleted`/`schedule.deleted` 는 `audit_log.resource_id` 가 FK 가 아닌 순수 UUID 라
  해당 구조적 제약이 전이되지 않으며, 실제로 세 액션 모두 정상 구현됐다.
- **`isActive` 토글 = `trigger.update` 로 기록 (`2-navigation/2-trigger-list.md` R-4)**:
  `TriggersService.update()` 는 `isActive` 변경 경로를 포함해 항상 `TRIGGER_UPDATED` 로
  기록하고, 별도 `trigger.toggle` 액션을 신설하지 않았다 — R-4 를 정확히 따른다.
  `syncScheduleActivation()` 을 감사 기록 **이전** 위치로 되돌린 이력(코드 주석의 "4차 리뷰가
  잡았다")도 R-4 를 우회하지 않는 방향의 수정이었다.
  `spec/2-navigation/2-trigger-list.md` 자체에 남아있는 `trigger.delete`(단수형) 오탈자는 이
  구현이 만든 게 아니라 기존 spec 문서 결함이며 이미 `plan/in-progress/spec-sync-auth-gaps.md`
  가 정정 대상으로 추적 중이다(재확인만 함).
- **`4.1.B` 기각된 대안 재도입 없음**: `audit_log.workspaceId` nullable 화(기각안 b)·별도
  user/personal audit scope 신설(기각안 c) 모두 이번 구현에 없다 — workflow/trigger/
  schedule/model_config 는 모두 workspace-scoped 리소스라 `workspaceId` non-nullable 제약이
  자연히 충족된다.
- **`audit_log.action` DB CHECK 미도입 invariant (`1-audit.md §Rationale`)**: 이번 PR 에 신규
  마이그레이션이 없다(`git diff origin/main --name-only | grep migration` = 무출력) — 순수
  application union(`AUDIT_ACTIONS`) 확장으로만 처리해 "DB 는 자유 문자열, application 이 강제"
  invariant 를 그대로 유지했다.
- **append-only invariant**: 4개 서비스의 신규 `recordAudit` 호출은 모두 `AuditLogsService.record`
  (INSERT-only) 이며 기존 row 를 UPDATE 하는 경로가 없다.
- **OpenAPI 문서 drift 회피**: `audit-log-response.dto.ts` 의 `action` 필드 설명이 액션 목록을
  하드코딩 나열하던 것에서 "SoT 는 `AUDIT_ACTIONS` const" 로 바뀌어, 과거 반복된 drift 패턴(액션
  추가마다 설명 문구가 낡던 문제, 직전 impl-prep 검토가 `5-integration.md §4` 에서 지적한 것과
  동일 계열)을 이번 구현이 스스로 줄이는 방향으로 갔다.
- **재인증·워크스페이스 귀속 등 auth 도메인 기존 Rationale(1.1.B-*, 2.3.*, 1.4.*)**: 이번 PR 의
  diff 범위(`workflows`/`triggers`/`schedules`/`model-config`/`audit-logs`)가 이들 항목을
  건드리지 않아 재검토 대상이 아님을 확인(코드 diff 에 `auth`/`webauthn`/`sessions` 모듈 변경
  없음).

## 요약

본 구현(감사 로깅 커버리지 갭 13건)은 spec 문서 자체를 변경하지 않았지만, spec §4.1·`Rationale
4.1.A/4.1.B`·`conventions/audit-actions.md`·trigger-list R-4 가 확정해 둔 명명 규약·workspace
귀속 원칙·"toggle 도 update 로 기록" 원칙·`workspace.deleted` 구조적 제외의 비-전이 범위를 모두
정확히 지켰고, 기각된 대안(nullable workspaceId·별도 audit scope·DB CHECK)의 재도입도 없었다.
새로 도입된 두 설계 결정("결합 리소스는 주 리소스만 기록"·"고빈도 액션은 보존정책 확정 전
유예")은 기존 Rationale 을 뒤집는 것이 아니라 그 원칙들의 정합적 연장이며 근거도 명확하지만,
현재는 spec Rationale 이 아닌 코드 주석에만 있고 `plan/in-progress/spec-sync-auth-gaps.md` 의
예정된 planner 턴 체크리스트에 세부 항목으로 명시되어 있지 않아 누락 위험이 낮게나마 존재한다
— CRITICAL/WARNING 이 아닌 INFO 로 남긴다.

## 위험도

LOW
