# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이번 PR 이 고친 보안 경계(트리거 회전 secret 유출 차단, `GET/POST/PATCH /api/schedules` 의 트리거 조인 narrowing) 자체는 정확하지만, 그 수정을 지키는 회귀 테스트가 구조적으로 얇다. 특히 `GET /api/schedules/:id` 는 이번 PR 이 narrowing 을 추가한 바로 그 엔드포인트인데 unit/e2e 테스트가 **전무**하다(테스트 리뷰어 CRITICAL). 강제 화이트리스트(forced) 7개 reviewer 는 전원 결과를 확보했으며 누락은 없다 — "clean" 판정이 아니라 위 CRITICAL 1건 + 실질 WARNING 다수를 근거로 HIGH 로 판정한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `GET /api/schedules/:id`(`findOne`) — 이 PR 이 트리거 secret narrowing(`toResponse`)을 새로 배선한 바로 그 엔드포인트를 때리는 테스트가 unit·e2e 어디에도 없다(`grep`으로 0건 확인). 200 반환 여부조차 자동 검증되지 않는다 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `findOne` 핸들러 | `schedule-trigger.e2e-spec.ts`에 `GET /api/schedules/:id` 케이스 추가 + `assertMatchesContract(res.body.data, await contractForDto(ScheduleDto))` 동봉 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `config.notification.signing.secretRef`(secret-store 참조)가 `sanitizeForResponse` 의 두 스트립 목록(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`) 어디에도 없어 트리거 응답에 그대로 노출됨. `chatChannel` 이 없는 트리거는 `config` 자체가 손대지지 않아 노출 범위가 더 넓음. 평문이 아니라 참조값이라 이번에 고친 것보다 등급은 낮지만 PR 저자 스스로 세운 "참조도 내부 저장 위치를 드러내니 뺀다"는 원칙과 동일 적용 대상 | `codebase/backend/src/modules/triggers/triggers.service.ts` `sanitizeForResponse`(554-591행), `normalizeNotificationSecretRef`(603-634행) | `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 와 동급으로 `config.notification.signing.secretRef`(방어적으로 `secret`도) 스트립 추가, `chatChannel` 유무와 무관하게 항상 적용 |
| 2 | 테스트 커버리지 | `findAll`(목록)·`update`(PATCH) 응답 경로에 `assertMatchesContract` 미배선. `create` 단 1곳만 계약 검증을 받고, secret 유출 수정이 실제로 지나가는 배열 매핑(`findAll`)·수정(`update`) 경로는 회귀 무방비 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `findAll`/`update`, `test/schedule-trigger.e2e-spec.ts` 테스트 D/J | 각 테스트에 `assertMatchesContract(..., await contractForDto(ScheduleDto))` 한 줄씩 추가 |
| 3 | 테스트 커버리지 | `schedules.controller.spec.ts`/`triggers.service.spec.ts` 의 unit fixture 에 `notificationSecretV2`/`chatChannelTokenV2` 필드 자체가 없어, strip 로직이 되돌아가도(회귀) 이 unit 테스트들은 전부 그린으로 남는다. 이 보안 수정의 실질 커버리지는 e2e 2곳뿐 | `codebase/backend/src/modules/schedules/schedules.controller.spec.ts`, `codebase/backend/src/modules/triggers/triggers.service.spec.ts` | secret 필드를 채운 fixture + `expect(result).not.toHaveProperty(...)` 형태의 빠른 unit 테스트 추가 |
| 4 | 테스트 커버리지 | `contractForDto` 신규 promise 메모이제이션(in-flight 캐시, 실패 시 evict-재시도)에 대한 테스트가 전무 — 스스로 내세운 설계 근거가 검증되지 않은 상태 | `codebase/backend/src/shared/testing/response-contract.ts:406-422` | 캐시 재사용(동일 Promise 참조)·실패 후 재시도를 검증하는 unit 테스트 추가 |
| 5 | 유지보수성 | `sanitizeForResponse` 내 `TRIGGER_RESPONSE_STRIP_COLUMNS` 이중 순회 — 첫 순회(`overrides[column] = undefined`)는 이후 무조건 실행되는 `delete sanitized[column]` 때문에 함수 동작에 아무 영향 없는 죽은 코드. 보안 경계 코드라 불필요한 복잡도가 다음 검토자의 오해 비용을 늘림 | `codebase/backend/src/modules/triggers/triggers.service.ts:563-566, 587-590` | 죽은 루프 제거, 무조건 `delete` 순회 하나만 유지 (또는 필요성 주석으로 명시) |
| 6 | 문서화 | rename 된 private 메서드(`sanitizeChatChannelForResponse`→`sanitizeForResponse`)를 가리키는 stale 주석 잔존 — 저장소 전체에서 옛 이름을 가리키는 유일한 자리 | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:112` | 주석을 `sanitizeForResponse` 로 갱신 |
| 7 | API 계약 / 문서화 | 신규 필드 3개(`chatChannelHealth`, `notificationHealth`, `rerankMode`)가 엔티티상 닫힌 union(`'unknown'\|'healthy'\|'degraded'` 등)인데 Swagger `enum` 미선언 — 같은 파일의 형제 필드(`type`, `reembedStatus`, `ragMode`)는 전부 enum 명시 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:77-78,93-94`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:107-109` | 각각 `enum: [...]` 추가 |
| 8 | 문서화 | CHANGELOG 신규 항목 소제목 "24필드" 가 바로 아래 표의 실제 합계(23)와 어긋남 | `CHANGELOG.md:41` (헤더) vs `:46-52`(표) | 24→23 정정 (또는 24를 재현 가능하도록 표를 세분화) |
| 9 | API 계약 | `GET/POST/PATCH /api/schedules` 의 `trigger` 필드가 (버그로 새던) 엔티티 전체 → 4필드(`id`/`name`/`workflowId`/`workflow.name`)로 좁혀지는 breaking change. 내부 FE 소비처(4곳)는 실측 일치 확인됐으나, 문서화되지 않은 외부/서드파티 소비자가 있다면 이번 배포로 조용히 깨짐 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse`, `schedule-response.dto.ts:90-91` | 외부 소비자 유무 재확인, 있다면 별도 공지/마이그레이션 기간 고려 (보안상 필요한 수정이라 되돌릴 사안은 아님) |
| 10 | 요구사항 (SPEC 추적 확장) | 신규 선언 필드 다수(`TriggerDto` 7개, `IntegrationDto.consecutiveNetworkFailures`, `AlertRuleDto.createdBy` 등)가 엔티티상 §5.4 "항상 존재"(select:false 없음, 항상 non-null)인데 `@ApiPropertyOptional`로 선언되어 이미 추적 중인 Optional/nullable drift(`spec-draft-nullable-notation-followups.md` §③)를 소폭 확장 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:76-102` 등 | 코드 되돌리기 아님 — 해당 트래커의 잔여 작업 목록에 이번 신규 필드들도 포함되는지 확인 |
| 11 | 요구사항 | `KnowledgeBaseDto.documentCount`/`rerankCandidateK` 의 Swagger `example` 값(12, 20)이 실제 엔티티 기본값(0, 50)과 불일치 — 같은 파일 형제 필드는 전부 "example = 실제 기본값" 관례를 따름 | `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:99-100, 111-113` | example 을 0/50으로 정정 (또는 의도적 sample 이면 무시 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프 (추적 중) | `IntegrationDto.consecutiveNetworkFailures` — FE 참조 0곳인 내부 health 카운터가 선언에 포함됨. PR 자신과 plan 트래커가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다"고 이미 명시 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:145-152` | 조치 불요, 트래커 추적 계속 |
| 2 | 아키텍처 | 민감 필드 스트립 목록이 두 개의 독립 상수(JSONB 키축 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` / 엔티티 컬럼축 `TRIGGER_RESPONSE_STRIP_COLUMNS`)로 나뉘어 SoT 가 분산됨 — 이번 결함 자체가 이 분산 구조에서 비롯됨 | `codebase/backend/src/modules/triggers/triggers.service.ts` | 장기적으로 `@Sensitive()` 류 엔티티 메타데이터 기반 SoT 통합 고려 (이번 범위 조치 불요) |
| 3 | 아키텍처 | 조인된 자식 엔티티 과다노출 방지 방식이 모듈마다 다른 패턴(Trigger=서비스 레이어 블랙리스트 스트립 vs Schedule=컨트롤러 레이어 화이트리스트 참조 DTO)으로 갈려 재사용 가능한 공용 패턴이 없음 | `triggers.service.ts` vs `schedules.controller.ts:67` | 세 번째 재발 시 convention 문서로 승격 고려 |
| 4 | 부작용 | `response-contract.ts`에 신규 module-level 캐시(전역 가변 상태) 도입 — 설계는 신중(in-flight promise 캐싱, 실패 시 evict)하고 프로덕션 경로 영향 없음 | `codebase/backend/src/shared/testing/response-contract.ts:407` | 조치 불요, `tsconfig.build.json` exclude 유지만 회귀 감시 |
| 5 | 테스트 신뢰성 | CHANGELOG/plan 이 "뮤턴트에 `TriggerDto` 2건·`ScheduleDto` 18건 RED" 라 서술하나, 현재 커밋된 테스트에서 `ScheduleDto` 대상 `assertMatchesContract` 호출은 1곳뿐 — 수치가 실제 방어망보다 넓게 서술됐을 가능성 | `CHANGELOG.md`, `test/schedule-trigger.e2e-spec.ts` | 재실측하거나 "1곳(e2e)만 고정"으로 정정 |
| 6 | 문서화 | 신규 필드 주석의 "FE 참조 수"(예: "createdBy 14")가 특정 시점 grep 결과를 영구 주석에 못박아 향후 stale 가능 — 재현 기준(grep 커맨드)이 코드에 없음 | 4개 DTO 파일의 신규 필드 주석 | 정성적 표현으로 낮추거나 재현용 grep 커맨드 명시 |
| 7 | 스코프 | `workflow-crud.e2e-spec.ts` 에서 `ExportWorkflowDto` import 가 같은 경로의 `WorkflowDto` import 와 분리되어 한 줄로 합칠 수 있음 (사소, 비차단) | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | import 병합 |
| 8 | API 계약 (추적 중) | `ExportWorkflowDto.formatVersion` 이 여전히 `required` 선언인데 실제 export 구현은 emit 하지 않음 — 이미 spec 에 Planned 로 추적된 기존 갭, 이 PR 은 `allowMissing` 으로 스코프 밖에 두었을 뿐 확대하지 않음 | `test/workflow-crud.e2e-spec.ts:432-442`, `spec/2-navigation/1-workflow-list.md:153` | 조치 불요, 참고용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `config.notification.signing.secretRef` 미스트립 노출 (WARNING #1) |
| architecture | LOW | 스트립 SoT 분산 구조·조인 과다노출 방지 패턴 불일치 (INFO #2, #3) |
| requirement | LOW | Optional/nullable drift 확장, CHANGELOG 집계 오차, KB example 불일치 (WARNING #10, #11) |
| scope | NONE | 스코프 경계 양호, 사소한 import 분리 1건 (INFO #7, #1) |
| side_effect | LOW | 신규 module-level 캐시 도입(설계 신중), 스케줄 trigger 필드 축소 (INFO #4) |
| maintainability | LOW | `sanitizeForResponse` 이중 순회 죽은 코드 (WARNING #5) |
| testing | HIGH | `findOne` 테스트 전무 (CRITICAL #1), `findAll`/`update`/unit/캐시 테스트 갭 (WARNING #2~#4) |
| documentation | LOW | stale 주석, enum 미선언, CHANGELOG 수치 불일치 (WARNING #6~#8) |
| api_contract | LOW | 스케줄 trigger 필드 breaking change, formatVersion 기존 갭 (WARNING #9) |
| user_guide_sync | NONE | frontend 변경 0건, 매트릭스 어떤 trigger 도 동반 갱신 요구 안 함 |

## 발견 없는 에이전트

- user_guide_sync (해당 없음 — frontend 변경 없음, 동반 갱신 불요 판정)

## 권장 조치사항

1. `GET /api/schedules/:id` 에 대한 e2e 테스트를 추가하고 `assertMatchesContract`로 계약을 고정한다 (CRITICAL — 이번 PR 이 고친 바로 그 엔드포인트가 무방비 상태).
2. `findAll`/`update` 응답 경로에도 `assertMatchesContract`를 배선하고, `triggers.service.spec.ts`/`schedules.controller.spec.ts` unit fixture 에 secret 필드를 채운 회귀 케이스를 추가한다 (WARNING #2, #3).
3. `sanitizeForResponse` 에 `config.notification.signing.secretRef` 스트립을 추가해 이번 PR 이 놓친 동급 유출 경로를 닫는다 (WARNING #1).
4. `sanitizeForResponse` 의 죽은 이중 순회를 정리하고, `chatChannelHealth`/`notificationHealth`/`rerankMode` 에 Swagger enum 을 추가한다 (WARNING #5, #7).
5. CHANGELOG 소제목 수치(24→23)와 stale 주석(`sanitizeChatChannelForResponse`)을 정정한다 (WARNING #6, #8).
6. `contractForDto` 캐시 동작(재사용/실패 재시도)에 대한 unit 테스트를 추가한다 (WARNING #4).
7. 나머지 WARNING(#9~#11)은 이미 추적 중이거나 문서 정확도 수준이므로 트래커 갱신 확인 또는 후속 라운드로 미뤄도 무방하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 성능 영향 없는 변경으로 분류 |
  | dependency | router 판단 — 의존성 변경 없음으로 분류 |
  | database | router 판단 — 스키마/쿼리 변경 없음으로 분류 |
  | concurrency | router 판단 — 동시성 영향 없는 변경으로 분류 |