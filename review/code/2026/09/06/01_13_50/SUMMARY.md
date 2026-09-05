# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 트리거 회전 secret 유출 수정 자체는 유효하지만, 같은 스윕에서 추가로 발견·수정한 두 건의 secret 유출(`config.interaction.triggerToken`, `config.notification.signing.secret`)과 `TriggerDto.workflow` 엔티티 전체 유출 + PATCH `name` 소실 버그가 CHANGELOG 공지에서 빠져 있고(documentation MEDIUM), `SchedulesController.toResponse` 의 신설 500 에러가 `findAll` 경로에서 단일 행 손상을 워크스페이스 전체 목록 실패로 확대하는 blast-radius 트레이드오프가 별도 문서화 없이 남아 있다(side_effect MEDIUM). 강제(forced) 화이트리스트 7개 reviewer 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | CHANGELOG 의 "트리거 회전 secret" 공지가 같은 브랜치에서 추가로 발견·수정한 두 건의 secret 유출(`config.interaction.triggerToken` 영구 평문 bearer 토큰, `config.notification.signing.secret`/`secretRef`)을 누락. `secret-store.md §1.1` 이 이름으로 금지한 3필드 중 2개가 실제로 유출됐다가 닫혔다는 사실이 CHANGELOG 어디에도 없음(`grep triggerToken\|signing` 매치 0건) | `CHANGELOG.md` (Unreleased 상단 항목) / 커밋 `66a2510fd`, `cb17f0870` | CHANGELOG 표에 두 필드 추가, `triggerToken` 은 영구 토큰이므로 회전 권고 문구 포함 |
| 2 | Documentation | `TriggerDto.workflow` 가 이전에 `Workflow` 엔티티 전체를 선언 없이 노출하던 사실(`ScheduleDto.trigger` 와 구조적으로 동일한 결함)과, 같은 커밋(`7e85da873`)이 함께 고친 `PATCH` 응답 `name` 필드 소실 버그가 CHANGELOG 미기재. `ScheduleDto.trigger` 사례는 최상단에 상세 기재된 것과 비대칭 | `CHANGELOG.md`, 대조: `trigger-response.dto.ts` `TriggerWorkflowRefDto` 도입 주석 | `ScheduleDto.trigger` 소단락과 대칭으로 `TriggerDto.workflow` 축소 + PATCH `name` 버그 수정 사실을 기록 |
| 3 | Side Effect | `SchedulesController.toResponse` 가 trigger 관계 미로드를 500 으로 승격시키며, `findAll` 은 `data.map(...)` 안에서 호출되므로 **단 한 행이라도** trigger 미로드면 목록 전체 요청이 500 실패로 확대됨(종전엔 그 행만 필드 결손, 나머지는 정상 200). CWE-209 정보 노출은 이미 고쳐졌으나 이 blast-radius 확대는 별도 언급된 적 없음 | `codebase/backend/src/modules/schedules/schedules.controller.ts:71,91,96,131` | 의도된 설계면 blast-radius 트레이드오프를 CHANGELOG/스펙에 명시. 원치 않으면 `findAll` 에서 개별 행 격리(스킵+로그 또는 부분 실패 표시) 검토 |
| 4 | Requirement | `TriggerDto.workflow` JSDoc 이 "생성 응답에만 없다"고 단정하지만, `chatChannel` 을 포함한 `PATCH` 는 `setupChatChannel` 뒤 relations 없는 재조회로 `result` 를 덮어써 **수정 응답에서도 `workflow` 가 빠짐**. 기능적 파손은 없음(§5.4 키 생략형이라 계약 검증자가 부재를 위반으로 안 잡음, FE 도 옵셔널 체이닝 방어) — 문서 보장이 구현보다 넓은 사례 | `trigger-response.dto.ts:94-102` (JSDoc) / `triggers.service.ts:500-511` (`update()` 의 `chatChannel` 재조회 분기) | JSDoc 에 "chatChannel 포함 PATCH 는 workflow 없음" 한 문장 추가, 또는 재조회에 `relations: ['workflow']` 추가(§5.4 일관성 관점에서 후자 권장) |
| 5 | Testing / Maintainability | 응답 DTO 필드 78건 전수 래칫(`EXPECTED_OPTIONAL_NULLABLE_DRIFT`, swagger-dto-contract.spec.ts)과 `ExecutionDto` 10건 부분 래칫(`OPTIONAL_NULLABLE_DRIFT`, execution-response.dto.spec.ts)의 부분집합 관계가 **주석으로만** 선언되고 코드로 강제되지 않음 — 한쪽만 갱신돼도 두 스펙 모두 각자는 그린 유지 | `execution-response.dto.spec.ts:59-71`, `swagger-dto-contract.spec.ts` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT`) | `OPTIONAL_NULLABLE_DRIFT.every(k => EXPECTED...includes(...))` 형태의 자동 부분집합 단언 추가 |
| 6 | Testing | 신설 공유 테스트 헬퍼 `expectNarrowedScheduleTriggerRef` 가 자매 헬퍼(`response-contract.ts`, `swagger-probe.ts`)와 달리 전용 단위 테스트가 없음 — e2e 3곳+unit 2곳, 도합 5개 호출부의 유일한 양성 고정 수단인데 자체 검증 부재 | `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:39-52` | `schedule-trigger-ref.spec.ts` 신설 — 정확한 키셋 통과 / 여분 키 실패 / secret 키(`notificationSecretV2` 등) 혼입 시 실패를 직접 단언 |
| 7 | Security / Maintainability | `TriggersService.sanitizeForResponse` 의 비밀 제거가 deny-list 4벌(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`) 구조라 구조적으로 fail-open — 같은 리뷰 사이클 안에서 이미 3회 실제 누락을 냄(엔티티 컬럼 축 → notification.signing 축 → interaction.triggerToken 축). 현재는 세 필드 전부 반영됐음을 코드로 확인, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "선언적 SoT(`@Sensitive()`)로 전환" 후속 등재됨 | `codebase/backend/src/modules/triggers/triggers.service.ts:53,74,94,114` | 조치 불요(이미 추적 중) — 다음 축 추가 시 목록 확장 대신 선언적 SoT 전환 우선 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `TriggerDto.config` 가 `additionalProperties: true` 열린 맵이라 정적 가드·런타임 계약 검증자 양쪽 모두 그 안(`interaction.triggerToken`, `notification.signing.secret`)까지 못 내려가고 수기 e2e `not.toHaveProperty` 단언에만 의존. plan 에 규범 명문화 후속 등재됨 | `trigger-response.dto.ts:60`, `chat-channel-trigger-create.e2e-spec.ts:137`, `schedule-trigger.e2e-spec.ts:265-269` | 조치 불요(추적 중) — `secret-store.md`/`2-api-convention.md §5.4` 에 "열린 맵 안 비밀은 e2e 단언 필수" 규범화 권고 |
| 2 | Security | CWE-209 회귀(스케줄 트리거 미로드 시 500 바디에 `schedule.id`/컬럼명/조인 힌트 노출)가 이번 세션 도중 발생했다가 최신 커밋에서 정정 확인됨(로그로만 남기고 고정 문구 응답) | `schedules.controller.ts` `toResponse`, `http-exception.filter.ts` `catch` | 조치 불요 — 이미 정정 및 회귀 테스트로 고정됨 |
| 3 | Side Effect | 테스트 유틸리티에 module-level 캐시(`contractCache`) 신설 — 실패 Promise 는 캐시에서 제거해 영구 실패 방지, 프로덕션 코드 영향 없음 | `response-contract.ts:386,412-425` | 조치 불요 |
| 4 | Side Effect / API Contract | `ScheduleDto.trigger`/`TriggerDto.workflow` 를 엔티티 전체에서 참조 필드로 좁힌 것은 wire breaking change 이나, CHANGELOG 에 영향 범위(FE 단일 소비처, SDK 미사용)가 근거와 함께 이미 여러 라운드에 걸쳐 처분됨 | `schedule-response.dto.ts:20-56`, `trigger-response.dto.ts:10-34` | 조치 불요 — 향후 외부 소비자 발생 시 API 버전 정책 재검토 |
| 5 | Maintainability | `SchedulesController.toResponse` 에서 `schedule.trigger` 참조 변수명이 `t` 한 글자 | `schedules.controller.ts:72` | 선택 사항 — `trigger` 로 개명 시 가독성 소폭 개선 |
| 6 | Maintainability | 신규 unit 테스트가 같은 예외 상황을 만들기 위해 `controller.update` 를 두 번 호출(로그 등 부수효과 중복 가능) | `schedules.controller.spec.ts:103-129` | `try/catch` 1회로 통합해 중복 호출 제거 |
| 7 | Maintainability | `ScheduleTriggerWorkflowRefDto`(`name`만)와 `TriggerWorkflowRefDto`(`id`+`name`)가 이름이 유사해 향후 통합 리팩터 시도 시 회귀 위험 — 각 파일에 경고 주석 존재 | `schedule-response.dto.ts:20`, `trigger-response.dto.ts:23` | 조치 불요(의도된 분리, 경고 주석 존재) |
| 8 | Testing | `TriggersService.create()`/`update()` 의 `sanitizeForResponse` 호출이 secret 스트립을 실제로 거치는지 확인하는 mock 기반 unit 테스트가 없음(e2e 에만 의존, `findOneDetail`/`findAll` 은 전용 unit 보유) | `triggers.service.ts` `create`/`update` 말미, `triggers.service.spec.ts` | secret 컬럼을 채운 mock 으로 `create`/`update` 반환값에서 두 키 부재를 단언하는 unit 추가 |
| 9 | API Contract | `IntegrationDto.consecutiveNetworkFailures` 가 FE 소비 0곳인 내부 카운터임에도 공개 응답 계약에 노출 — 이미 트래커에 제거 검토 후속 등재됨 | `integration-response.dto.ts` (`consecutiveNetworkFailures`) | 조치 불요(추적 중) |
| 10 | API Contract | `IntegrationDto.appUrl` 이 URL 문자열인데 `format: 'uri'` 미선언 | `integration-response.dto.ts` (`appUrl`) | 사소함 — 다음 편집 시 `format: 'uri'` 추가 고려 |
| 11 | User Guide Sync | `AlertRuleDto.lastTriggeredAt` 신규 swagger JSDoc 문구("발화")가 채팅 문맥 어휘를 오용 — 다른 DTO 보일러플레이트를 복붙한 잔여물로 추정. `@nestjs/swagger` 가 OpenAPI description 으로 그대로 노출 | `alert-rule-response.dto.ts` (`lastTriggeredAt` JSDoc) | `/** 마지막 발동 시각 (없으면 \`null\`) */` 등으로 정정 |
| 12 | Scope | `workflow-crud.e2e-spec.ts` 에서 같은 모듈의 `ExportWorkflowDto`/`WorkflowDto` import 가 두 줄로 분리 — 이전 라운드에서 이미 INFO 처분됨 | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | 조치 불요(사소, 병합 가능하나 PR 차단 사유 아님) |
| 13 | Scope | 보안 결함 수정 + §5.4 응답-계약 배선 스윕 + 24필드 선언 보정이 한 PR 에 혼재하나, CHANGELOG·plan 서술이 일관되게 "스윕 도중 실측으로 드러난" 결함이라 범위 위반 아님(`git diff` 34개 파일 +1909/-62 전수 대조 완료) | `CHANGELOG.md`, `triggers.service.ts`, `schedules.controller.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. deny-list 4벌 구조(WARNING, 추적 중), 열린 맵 사각지대(INFO, 추적 중), CWE-209 회귀는 이미 정정 확인 |
| requirement | LOW | `TriggerDto.workflow` JSDoc 이 chatChannel 포함 PATCH 경로를 놓침(WARNING). 기능 파손 없음 |
| scope | NONE | 실 코드 diff 34개 파일이 전부 §5.4 스윕 목적에 부합. import 미병합 등 사소한 잔여물만 |
| side_effect | MEDIUM | `SchedulesController.toResponse` 의 findAll blast-radius 확대(WARNING), 나머지는 이미 문서화된 breaking change/안전한 테스트 전용 캐시 |
| maintainability | LOW | 새 구조적 결함 없음 — 기존에 알려진 deny-list/이중 래칫 부채 재확인 + 사소한 스타일 흠 |
| testing | LOW | drift 래칫 부분집합 미검증(WARNING), 신규 헬퍼 전용 테스트 부재(WARNING), create/update secret strip unit 부재(INFO) |
| documentation | MEDIUM | CHANGELOG 가 추가 발견된 secret 유출 2건 + TriggerDto.workflow 유출/PATCH name 버그를 누락(WARNING 2건) |
| api_contract | LOW | breaking change 는 CHANGELOG 근거로 이미 처분됨. 내부 필드 노출·format 누락은 INFO |
| user_guide_sync | NONE | `codebase/frontend`/`channel-web-chat`/`expression-engine`/nodes/auth 변경 0건 — user-guide 동반 갱신 의무 없음. JSDoc 어휘 오기 1건만 INFO |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상 발견사항을 보고했다(단, scope·user_guide_sync 는 전체 위험도 NONE 로 판정).

## 권장 조치사항

1. `CHANGELOG.md` 의 "Unreleased — 트리거 회전 secret" 항목에 추가로 발견·수정된 두 건(`config.interaction.triggerToken`, `config.notification.signing.secret`/`secretRef`)을 공지 — `triggerToken` 은 영구 토큰이므로 회전 권고 문구 포함.
2. 같은 CHANGELOG 항목에 `TriggerDto.workflow` 엔티티 전체 유출 좁히기 + `PATCH` `name` 필드 소실 버그 수정 사실을 `ScheduleDto.trigger` 소단락과 대칭으로 기록.
3. `SchedulesController.toResponse` 의 `findAll` blast-radius(단일 행 손상 → 목록 전체 500) 트레이드오프를 CHANGELOG/스펙에 명시하거나, 개별 행 격리 방안을 검토.
4. `execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT` 가 `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 부분집합임을 자동 테스트로 강제.
5. `schedule-trigger-ref.ts` 의 `expectNarrowedScheduleTriggerRef` 헬퍼에 전용 단위 테스트(`schedule-trigger-ref.spec.ts`) 신설.
6. `TriggerDto.workflow` JSDoc 을 `chatChannel` 포함 PATCH 경로까지 정확히 반영하거나, `triggers.service.ts` 재조회에 `relations: ['workflow']` 추가.
7. (저우선, 이미 트래커 등재) `TriggersService` 비밀 제거 deny-list 4벌을 선언적 SoT(`@Sensitive()` 데코레이터 등)로 전환 검토 — 다음 축이 생기면 재발할 구조.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(응답 DTO 선언/정화 로직)와 무관 |
  | architecture | 신규 아키텍처 변경 없음(기존 컨트롤러/서비스 내 로직 보정) |
  | dependency | 의존성 추가/변경 없음 |
  | database | 마이그레이션/스키마 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |