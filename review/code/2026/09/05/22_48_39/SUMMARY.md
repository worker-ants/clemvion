# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 이번 diff(§5.4 응답-계약 검증자 배선 4→18 DTO + 트리거 회전 secret 유출 수정)는 핵심 보안 결함을 실제로 막았으나, 그 수정으로 새로 넓힌 두 스트립 축(`config.notification.signing`·`config.interaction.triggerToken`)이 `TriggerDto.config` 가 `$ref` 없는 열린 map 이라 `assertMatchesContract` 로 구조 검증이 안 되어 e2e/wire 레벨 회귀 방어가 전무하다는 점(testing WARNING)이 가장 무겁다 — `triggerToken` 은 secret-store.md §1.1 금지 필드이자 직전 consistency 라운드 Critical 이었던 자리다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `TriggerDto.config` 가 `$ref` 없는 열린 map(`type:'object', additionalProperties:true`)이라 `assertMatchesContract` 가 내부를 구조적으로 못 보고, 그 결과 이번에 새로 넓힌 `config.notification.signing`(secret/secretRef)·`config.interaction`(triggerToken) 스트립이 e2e/wire 레벨 회귀 방어가 전무하다. mock 기반 unit 1건이 유일 방어선. `triggerToken` 은 secret-store.md §1.1 금지 필드이자 직전 consistency 라운드 Critical | `trigger-response.dto.ts:53-55`, `response-contract.ts` `descend():191-228`(`names.length===0` 조기 return), `triggers.service.ts:74,109` | `chatChannel` 축이 이미 쓰는 `chat-channel-trigger-create.e2e-spec.ts` 의 `not.toHaveProperty()` 수기 단언 패턴을 `notification.signing`·`interaction.triggerToken` 두 축에도 적용 |
| 2 | 테스트 | `GET /api/triggers/:id`(`findOneDetail`)가 목록·PATCH·생성과 달리 HTTP/e2e 계약 대조에서 유일하게 빠져 있음. 직전 라운드가 목록·단건·PATCH 3경로를 함께 지목했으나 후속 커밋이 "목록·PATCH" 로 범위를 좁히면서 단건이 등재 없이 누락됨 | `triggers.controller.ts:67-82`; `grep '\.get(.../api/triggers/'` 0건 | `schedule-trigger.e2e-spec.ts` 또는 `chat-channel-trigger-create.e2e-spec.ts` 에 `GET /api/triggers/:id` + `assertMatchesContract(res.body.data, await contractForDto(TriggerDto))` 추가, `workflow` 좁힘도 함께 고정 |
| 3 | 요구사항 | `ScheduleTriggerRefDto.workflow`/`TriggerWorkflowRefDto.workflow` JSDoc 이 "생성·수정 응답에는 로드되지 않는다" 고 단정하나, `update()` 경로는 `findById()`(relations 포함)로 로드한 엔티티를 그대로 `save()`·재사용(TypeORM `save()` 는 참조를 그대로 반환)하므로 실제로는 PATCH 응답에도 `workflow` 가 실릴 수 있다 — create() 만 맞고 update() 는 틀림. 기능/보안 결함은 아니나(필드 optional, 값 비민감) 어떤 e2e/unit 도 이 클레임을 검증하지 않음 | `schedule-response.dto.ts:38-40`, `schedules.service.ts:126-135/213-220/263`, `trigger-response.dto.ts:89-93`, `triggers.service.ts:226-235/342-348/604-615` | JSDoc 을 실제 동작에 맞게 정정하고 e2e 로 형태를 양성 고정하거나, "없다" 는 의도가 맞다면 `update()` 응답 경계에서 `workflow` 를 명시적으로 제거하고 회귀 테스트 추가 |
| 4 | 유지보수성 / 문서화 | "JSDoc 이 새 선언 삽입으로 대상 선언에서 분리됨" 패턴이 같은 세션에서 이미 4회 지적·재발방지 다짐됐는데, 최신(마지막) 커밋에서 **2건 추가 재발**(5번째) — `TRIGGER_RESPONSE_STRIP_COLUMNS` JSDoc 이 `INTERACTION_RESPONSE_STRIP_KEYS` 삽입으로 대상과 분리, 테스트 파일에서도 동일 패턴 | `triggers.service.ts:79-114`(JSDoc `:79-93` vs 선언 `:111-114`, 사이에 `INTERACTION_RESPONSE_STRIP_KEYS` 삽입), `triggers.service.spec.ts:191-229`(첫 JSDoc `:191-197` 이 삽입된 별개 테스트 `:198-207` 위에 놓임) | 각 JSDoc 블록을 해당 대상 선언/테스트 바로 위로 재배치. 삽입 시 "직전 줄이 원래 무엇을 설명하던 주석인지" 확인을 절차화(지금까지 다짐만으로는 3라운드 연속 재발 방지 실패) |
| 5 | 문서화 | `plan/in-progress/spec-draft-nullable-notation-followups.md:420` 의 "23필드 선언이 §5.4 금지 조합" 서술이 부정확 — 실제로는 23개 중 **17개**만 금지 조합(`Optional`+`nullable:true`)이고 나머지 6개는 별도의 "과소 선언"(항상 존재+non-null인데 Optional) 문제로, 같은 세션 자신의 consistency 리뷰(`rationale_continuity.md`)가 이미 명시적으로 구별해 둔 것을 합산 서술함 | `plan/in-progress/spec-draft-nullable-notation-followups.md:420`; 근거: `review/consistency/2026/09/05/18_23_03/rationale_continuity.md`(17개 Critical) + `review/code/2026/09/05/18_23_02/RESOLUTION.md`(6개 WARNING, 별도) | "23필드 중 17개가 §5.4 금지 조합, 나머지 6개는 별도의 과소 선언 위반" 식으로 두 갈래를 구별해 정정 |
| 6 | API 계약 | `ExportWorkflowDto.formatVersion` 이 OpenAPI 상 required 로 선언되나 실제 export 응답 구현이 이 필드를 채우지 않는 기존 갭. 이번 diff 는 고치지 않고 e2e 에서 `allowMissing: ['formatVersion']` 으로 우회(신규 갭 아니라 최초로 정식 문서화한 것) | `workflow-response.dto.ts:137-138`, `workflow-crud.e2e-spec.ts:436-440` | `spec/2-navigation/1-workflow-list.md` 에 이미 Planned 로 추적 중 — 그 갭을 닫는 PR 에서 DTO 를 Optional 로 내리거나 구현을 완성해 `allowMissing` 제거를 완료 조건으로 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (긍정 확인) | 트리거 회전 secret 2차 유출 경로(조기 return 으로 인한 미스트립 + 스케줄 조인을 통한 전이 유출)가 실제로 막혔음을 코드 레벨로 확인 — 원본 엔티티는 변형되지 않고 새 객체 위에서 delete, 4경로(목록/상세/생성/수정) 전부 배선 확인 | `triggers.service.ts`(`sanitizeForResponse`), `schedules.controller.ts`(`toResponse`) | 조치 불요 |
| 2 | 보안 | 테스트 픽스처의 시크릿류 문자열(`wsk_should_not_leak` 등)은 전부 스트립 검증용 더미, 실제 하드코딩 자격증명 아님. 신규 DTO 선언 필드들은 이미 wire 로 나가던 값의 문서화일 뿐 신규 노출 아님 | `schedules.controller.spec.ts`, `triggers.service.spec.ts`, 각 response DTO | 조치 불요 |
| 3 | 부작용 | `contractForDto()` 신규 module-level `Map` 캐시는 테스트 전용 파일(`.spec.ts`/`.e2e-spec.ts` 에서만 import)이라 프로덕션 경로 아님, 실패 promise 캐시 제거 회귀 테스트 존재 | `response-contract.ts:386,412-425` | 조치 불요(향후 반환값 변형 코드 추가 시 `Object.freeze` 고려) |
| 4 | 부작용 / API 계약 | `SchedulesController`/`TriggersService` 응답 경계 축소(`trigger`/`workflow`/`interaction.triggerToken` narrowing)는 unversioned REST 라 즉시 영향을 주는 breaking change 이나, CHANGELOG 가 FE 소비처 전수 실측과 함께 명시적으로 경고 — 이전 라운드에서 이미 처분됨 | `schedules.controller.ts:67-84`, `schedule-response.dto.ts:15-47`, `trigger-response.dto.ts:17-25` | 조치 불요(이월) |
| 5 | 부작용 | 마지막 커밋이 `ScheduleDto.trigger` 필드 JSDoc(공개 OpenAPI description 으로 승격됨) 안의 내부 리뷰 경로 참조를 라인 코멘트로 스스로 옮겨 고침 — 새로 만든 문제 아니라 같은 diff 안에서 도입 후 수정됨 | `schedule-response.dto.ts` (`trigger` 필드 주석) | 조치 불요. 향후 응답 DTO 필드 JSDoc 에 내부 경로 넣지 않는 체크리스트화 고려 |
| 6 | 유지보수성 | `sanitizeForResponse()` 안에서 "허용 목록에 없는 키만 복사" 루프가 3개 축(chatChannel/interaction/notification.signing)에 동일 패턴으로 반복 | `triggers.service.ts:626-660` | `stripKeys()` 지역 헬퍼로 추출 고려(4번째 비밀 축 추가 시 재복제 방지) |
| 7 | 유지보수성 / 변경범위 | `SchedulesController.toResponse()` 지역 변수명 `t` 가 여전히 축약형 | `schedules.controller.ts:68` | 조치 불요(이월) — 다음에 메서드를 만질 때 `trigger` 로 변경 |
| 8 | 변경범위 | `ExportWorkflowDto`/`WorkflowDto` import 가 같은 경로에서 두 줄로 분리됨(스타일, 스코프 밖) | `workflow-crud.e2e-spec.ts:13-14` | 조치 불요(이월) — 병합 가능하나 PR 차단 사유 아님 |
| 9 | 변경범위 | 보안 결함 수정 · 응답-계약 배선 확대 · DTO 선언 보정 세 축이 한 PR 에 섞여 있으나, 스윕 도중 실측으로 드러난 결함이라 같은 PR 수정이 타당. 커밋 단위로는 세 축 분리됨 | `CHANGELOG.md:3-56`, 커밋 시퀀스 `dfb2664af`/`cb17f08709`/`a6f582680`/`66a2510fd` | 조치 불요 |
| 10 | API 계약 | `IntegrationDto.consecutiveNetworkFailures` 는 FE 소비처 0곳인 내부 카운터가 공개 DTO 에 선언됨 — PR 자신이 "제거 후보, wire 변경이라 별도 항목으로 미룸" 이라 문서화 | `integration-response.dto.ts:153-161`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 별도 트래커 항목에서 wire 변경으로 다룰 것 |
| 11 | API 계약 | 비밀 필드 스트립이 4개의 수기 관리 allow-list 상수에 의존 — PR 자신의 JSDoc 이 "세 번 같은 형태로 좁았다"고 인지하고 §5.4 정적 래칫 + e2e 뮤테이션으로 완화함 | `triggers.service.ts` (`sanitizeForResponse` JSDoc + 4개 상수) | 조치 불요(이번 PR 범위) — 재발 시 `@Sensitive()` 류 선언적 SoT 전환 고려(코드 내 이미 명시) |
| 12 | 유저 가이드 동반 갱신 | `doc-sync-matrix.json` `backend-api-change` glob 에 매칭되는 DTO/controller 변경 다수가 있으나, 전부 "이미 wire 로 나가던 필드의 Swagger 선언 정정 + secret 유출 축소" 라 사용자 가시 동작 변화 없음 — user-guide 갱신 대상 없음 | 각 response DTO, `schedules.controller.ts` | 조치 불요. 후속 `consecutiveNetworkFailures` 제거(wire 변경) 시엔 재매칭 필요 |
| 13 | API 계약 / 테스트 | `contractForDto(IntegrationDto)` 를 부르는 e2e 는 1곳뿐이고 `appUrl` 이 항상 null 인 makeshop 분기만 exercise — cafe24 Private(non-null) 분기는 계약 대조로 미검증. 단 스키마가 `nullable+String` 이라 계약 대조 자체가 분기 구분을 못 하고, 값 정확성은 기존 unit(`integrations.service.spec.ts`)이 별도 커버 | `ai-agent-tool-payload-warning.e2e-spec.ts:79-99`, `integration-response.dto.ts:134-135` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 트리거 회전 secret 유출 차단 확인, 신규 노출 표면 없음 |
| requirement | LOW | `workflow` JSDoc 이 update() 실동작과 불일치(WARNING #3) |
| scope | NONE | 단일 응집 스윕(계약배선+보안수정+선언보정), 스코프 이탈 없음 |
| side_effect | LOW | 응답 경계 축소는 breaking 이나 CHANGELOG 로 문서화됨, 테스트 전용 캐시는 안전 |
| maintainability | LOW | JSDoc-선언 분리 패턴 5번째 재발(WARNING #4) |
| testing | MEDIUM | 단건 GET 계약대조 누락 + `config` 내부 secret 축 e2e 방어 부재(WARNING #1, #2) |
| documentation | LOW | 동일 JSDoc 분리 재발 + plan 문서 수치("23필드") 부정확(WARNING #4, #5) |
| api_contract | LOW | `ExportWorkflowDto.formatVersion` required-but-unimplemented 기존 갭 재확인(WARNING #6) |
| user_guide_sync | NONE | 실질 노출 변경 없어 user-guide 갱신 불요 |

## 발견 없는 에이전트

(없음 — 전 에이전트가 최소 INFO 이상 기록)

## 권장 조치사항

1. `TriggerDto.config` 하위 신규 스트립 축(`notification.signing`, `interaction.triggerToken`)에 대해 `chatChannel` 축과 동일한 `not.toHaveProperty()` 수기 e2e 단언을 추가한다 — `triggerToken` 은 secret-store.md §1.1 금지 필드이자 직전 consistency Critical 이었던 자리라 우선순위가 가장 높다 (WARNING #1).
2. `GET /api/triggers/:id`(`findOneDetail`) 에 대한 `assertMatchesContract` e2e 배선을 추가해 단건 조회 경로의 계약 검증 사각지대를 닫는다 (WARNING #2).
3. `ScheduleTriggerRefDto.workflow`/`TriggerWorkflowRefDto.workflow` JSDoc 을 실제 `update()` 동작에 맞게 정정하거나, 응답 경계에서 `workflow` 를 명시적으로 제거하고 회귀 테스트를 추가한다 (WARNING #3).
4. `triggers.service.ts`/`triggers.service.spec.ts` 의 JSDoc-선언 분리 2건을 각 대상 바로 위로 재배치하고, 향후 삽입 시 확인 절차를 명문화한다 — 5번째 재발이므로 이번엔 실제로 고친다 (WARNING #4).
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "23필드 전부 금지 조합" 서술을 17/6 구분으로 정정한다 (WARNING #5).
6. `ExportWorkflowDto.formatVersion` 갭은 기존 Planned 트래커 유지, 별도 PR 에서 완료 조건(Optional 전환 또는 구현 완성)으로 처리한다 — 이번 PR 을 막을 사유 아님 (WARNING #6).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 미제공) |
  | architecture | 라우터 판단(사유 미제공) |
  | dependency | 라우터 판단(사유 미제공) |
  | database | 라우터 판단(사유 미제공) |
  | concurrency | 라우터 판단(사유 미제공) |