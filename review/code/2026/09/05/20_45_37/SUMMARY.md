# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 새 취약점 도입 없이 기존 secret 유출(트리거 회전 secret 2종)을 실제로 막은 교정 PR이나, 그 수정 자체와 이번에 새로 배선된 응답-계약 검증 인프라(`contractForDto` 메모이제이션, `allowMissing`, `SchedulesController.toResponse`)의 핵심 분기 다수가 테스트로 고정되지 않은 채 남아 "다음에 조용히 깨져도 못 잡는" 구조적 갭(WARNING 8건, 그중 5건이 testing/requirement 계열의 미검증 회귀)이 몰려 있어 MEDIUM으로 판정한다. **forced(router_safety) whitelist 7명(documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `schedules.service.ts::create()`가 고친 정확한 회귀("`isActive:false`로 생성하면 트리거는 생겼는데 응답 `trigger` 키가 사라진다")를 잠그는 테스트가 unit·e2e 어디에도 없음. 기존 e2e(`schedule-trigger.e2e-spec.ts` C/C-2/D/E)는 전부 `isActive` 미지정(기본값 true)으로만 생성 | `codebase/backend/src/modules/schedules/schedules.service.ts` `create()` (198~203행) | `POST /api/schedules {isActive:false}` → 응답 `trigger` 키 존재를 단언하는 케이스 추가, 뮤턴트(대입을 다시 `if(isActive)` 안으로)로 RED 확인 |
| 2 | Requirement / Side Effect | `SchedulesService.update()`의 `isActive:false`(else) 분기는 `create()`와 달리 여전히 `saved.trigger = trigger ?? schedule.trigger`가 `if(schedule.isActive)` 안에만 있어, PATCH로 스케줄을 비활성화하면 응답에서 `trigger` 키가 조용히 사라질 수 있음(TypeORM `save()`의 참조 반환에 암묵 의존, `trigger`가 optional이라 §5.4 계약 대조로도 검출 안 됨) | `codebase/backend/src/modules/schedules/schedules.service.ts` `update()` (else 분기, 대략 261~265행) | `PATCH /api/schedules/:id {isActive:false}` 후 `trigger` 키가 4필드로 존재함을 양성 단언하는 e2e 추가, 또는 대입을 조건 분기 밖으로 이동해 `create()`와 통일 |
| 3 | Testing | `SchedulesController.toResponse()`(이 PR의 핵심 보안 경계 — Trigger 엔티티 전체를 4필드로 좁힘) 에 대한 unit 테스트가 전무. 기존 `schedules.controller.spec.ts`는 `service.create` mock 반환값(`trigger` 필드조차 없는 객체)을 전혀 assert하지 않아 vacuous. e2e(`schedule-trigger.e2e-spec.ts` C)만이 실질 검증 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `private toResponse()`; `schedules.controller.spec.ts`(미변경) | `toResponse`(또는 controller 반환값)에 대해 "secret 실은 mock → 4필드만 남음" / "trigger 없으면 키 자체 없음" unit 케이스 2건 추가 |
| 4 | Testing | `contractForDto` 메모이제이션 신규 테스트 2건이 전부 성공(캐시 적중) 경로만 검증 — "실패 promise는 캐시에 남기지 않는다"는 JSDoc이 명시한 핵심 계약(`catch`의 `contractCache.delete`)이 어떤 테스트로도 검증 안 됨. 해당 줄 삭제 뮤턴트에도 GREEN 유지 | `codebase/backend/src/shared/testing/response-contract.ts` `contractForDto` catch 분기; 테스트는 `response-contract.spec.ts` | 실패하는 fixture로 "1차 실패→캐시 삭제→2차 재시도(다른 promise 인스턴스)"를 단언하는 테스트 추가 |
| 5 | Testing | `allowMissing` 옵션의 "중첩은 경로로 적는다" 기능이 신규 테스트 3건 전부 최상위(flat) 필드만 사용해 미검증. 실사용 호출부(`workflow-crud.e2e-spec.ts`)도 최상위 필드뿐 | `codebase/backend/src/shared/testing/response-contract.ts` `ContractCheckOptions.allowMissing`; `response-contract.spec.ts` | 중첩 스키마로 `allowMissing:['parent.child']`가 그 깊이의 missing만 정확히 면제하고 얕은 이름과는 매칭 안 됨을 단언하는 테스트 추가 |
| 6 | Documentation | CHANGELOG가 `appUrl`을 "키 생략형(`@ApiPropertyOptional()`, `\| null` 없음) 예외"라고 서술하나 실제 선언은 §5.4 기본형(`@ApiProperty({nullable:true})` + `string \| null`) — 코드 인접 주석 자체가 "첫 판은 키 생략형이었으나 e2e가 반증해 기본형으로 정정했다"고 이력을 적어 두었는데 CHANGELOG만 정정 전 상태로 남음 | `CHANGELOG.md:50-52` vs `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:126-135` | CHANGELOG를 "전부 기본형(appUrl 포함, 첫 판은 키 생략형이었으나 e2e로 정정)"으로 갱신하거나 "appUrl만 예외" 문장 삭제 |
| 7 | Documentation | `contractForDto`의 사용법 JSDoc이 함수 선언과 물리적으로 분리돼, 그 사이에 새로 삽입된 (export 안 되는) `contractCache` 상수에 귀속됨 — IDE 호버·문서 생성기가 자주 쓰이는 공개 헬퍼(`contractForDto`, 14개 e2e에서 신규 호출)의 문서를 못 보여줌 | `codebase/backend/src/shared/testing/response-contract.ts:385-409` (JSDoc → `contractCache` → 빈줄 → `export function contractForDto`) | JSDoc 블록을 `export function contractForDto` 선언 바로 위로 이동, `contractCache` 선언은 별도 위치로 분리 |
| 8 | API Contract / Side Effect | `GET/POST/PATCH /api/schedules`(+`:id`) 응답의 `trigger`가 Trigger 엔티티 전체(secret 컬럼 포함)에서 4개 참조 필드(`id`/`name`/`workflowId`/`workflow.name`)로 좁혀지는 breaking change. 보안상 필요했고 FE 소비 필드와 정확히 일치함이 e2e로 고정되었으며 CHANGELOG에 영향 범위(FE 4곳)가 이미 문서화·추적됨(재수정 불요) — 다만 응답을 그대로 로깅·캐시·재전송하는 미확인 외부 소비자가 있다면 조용히 깨지는 지점이라는 사실 자체는 남아 재확인 목적으로 기록 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()` (`findAll`/`findOne`/`create`/`update` 4곳) | 조치 완료로 간주. 외부 소비자 존재 여부만 재확인 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 응답 정화(sanitization)의 SoT가 여전히 서비스 레이어 병렬 목록 3벌(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`)로 흩어져 있음(이번에 2벌→3벌로 증가, 같은 결함 클래스 2회째 재발) | `codebase/backend/src/modules/triggers/triggers.service.ts` | 세 번째 재발이므로, 다음 재발 시 엔티티 컬럼 데코레이터에 `@Sensitive()` 류 메타데이터를 얹어 SoT를 엔티티로 옮기는 것을 검토 |
| 2 | Architecture | 근접 명명된 두 optional/nullable drift 래칫(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 vs `OPTIONAL_NULLABLE_DRIFT` 10건, 후자는 전자의 부분집합)이 상호 참조 주석만으로 동기화 — 자동 subset 검증 없음(기존 consistency WARNING과 동일 항목, 이미 처분됨) | `swagger-dto-contract.spec.ts` vs `execution-response.dto.spec.ts` | 다음에 상환될 때 `EXPECTED_OPTIONAL_NULLABLE_DRIFT.filter(...)` 파생 단언으로 주석을 테스트로 대체 |
| 3 | Maintainability | `sanitizeForResponse()` 안 strip 필터링 루프가 구조적으로 거의 동일하게 2회 반복(이미 트리아지됨, 후처리 차이로 조치 불요 처리 이력) | `triggers.service.ts:595-598`, `:611-616` | 세 번째 strip 대상 생길 때 `stripKeys(obj, denylist)` 공용 헬퍼 추출 고려 |
| 4 | Maintainability | `SchedulesController.toResponse()`의 지역 변수명 `t`가 파일 전반 대비 유독 축약(이미 이전 라운드에서 지적·이월, 여전히 미수정) | `schedules.controller.ts:68` | `t` → `trigger`로 변경 |
| 5 | Maintainability | "이미 응답에 실려 나가고 있었다…" 배경 설명 주석이 4개 DTO 파일에 거의 그대로 반복(이미 트리아지, 완전 추출은 파일별 고유 정보 때문에 어려움) | `alert-rule-response.dto.ts`, `integration-response.dto.ts`, `knowledge-base-response.dto.ts`, `trigger-response.dto.ts` | 서사 정정 필요 시 4곳 grep으로 동기화 |
| 6 | Maintainability | `findOptionalNullableResponseFields`의 클래스명 폴백 `'?'`가 이름 없는 매직 리터럴로 2회 중복(신규 발견, 매우 사소) | `swagger-dto-contract-guard.ts:293-295` | `UNKNOWN_OWNER` 상수로 추출 |
| 7 | Security | `notificationLastError`/`chatChannelLastError`가 이번에 DTO 정식 선언됨(값 자체는 기존부터 wire로 나가던 것, 변경 아님). Provider adapter 에러 메시지가 현재는 토큰을 echo하지 않으나, 향후 adapter가 요청 payload를 에러 메시지에 넣게 되면 워크스페이스 멤버 범위로 노출될 수 있는 잠재 경로 | `trigger-response.dto.ts` (`chatChannelLastError`/`notificationLastError`); 값 출처 `triggers.service.ts` `setupChatChannel` catch | 이번 PR 조치 불요. adapter 에러 처리 변경 시 "요청 payload 금지" 불변식을 주석/린트로 고정 권장 |
| 8 | Security / API Contract | `IntegrationDto.consecutiveNetworkFailures`(FE 미소비 내부 health 카운터)가 이번 스윕으로 공개 API에 정식 노출(이미 별도 트래커 항목으로 추적 중) | `integration-response.dto.ts` | 별도 트래커 그대로 진행, 이번 PR 조치 불요 |
| 9 | API Contract | `ExportWorkflowDto.formatVersion`이 OpenAPI상 required이나 실제 export 구현이 emit하지 않는 기존 갭 — `allowMissing`으로 e2e 통과시키되 갭 자체는 스코프 밖(spec에 Planned로 이미 문서화, 완료 조건에 allowMissing 제거 포함) | `workflow-crud.e2e-spec.ts`; `spec/2-navigation/1-workflow-list.md` | 조치 불요(추적됨) |
| 10 | Testing | `SchedulesController.toResponse()`의 두 조건부 분기(`t` 부재, `t.workflow` 부재)가 현재 어떤 테스트로도 도달되지 않음 — 살아있는 계약인지 불확실 | `schedules.controller.ts` `toResponse` | 다음 수정 시 mock으로 강제 재현하는 unit 테스트 최소 1건 추가 |
| 11 | Testing | `IntegrationDto.appUrl`의 cafe24 Private 비-null 문자열 분기가 `assertMatchesContract`로 미검증(null 분기만 실측) | `integration-response.dto.ts`; `ai-agent-tool-payload-warning.e2e-spec.ts` | 시급성 낮음 — cafe24 Private e2e 존재 시 계약 대조 추가 고려 |
| 12 | Scope | PR이 표면적으로 "secret 유출 수정"보다 훨씬 넓음(DTO 23필드 선언, 정적 가드 3번째 축, `contractForDto` 메모이제이션/`allowMissing`, 14개 엔드포인트 배선) — 다만 각 확장은 CHANGELOG·plan 트래커에 근거가 명시돼 "§5.4 응답-계약 스윕"이라는 원 과제 정의 안에 있음, 스코프 이탈 아님 | 전체 diff | PR 설명에 상위 과제명("응답-계약 스윕 1차 + secret 유출 수정")을 먼저 명시 권장 |
| 13 | Side Effect | 신규 모듈-레벨 캐시(`contractCache`)는 테스트 전용 경로(`tsconfig.build.json` exclude)에 격리되어 있고, 진행 중 promise 캐싱 + 실패 시 즉시 삭제 설계로 이전 라운드에서 이미 평가·수용됨 | `response-contract.ts:407` | 조치 불요, `tsconfig.build.json` exclude 회귀만 감시 |
| 14 | Architecture (긍정) | 신규 §5.4 검증 축(`required:false`+`nullable:true` 금지)이 기존 두 검증자(런타임 값 대조·정적 presence/null 대조)와 책임이 명확히 분리되고, 스캔 범위 제한으로 자기 테스트 fixture가 프로덕션 베이스라인을 오염시키지 않음 | `swagger-dto-contract-guard.ts` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실재하던 secret 유출(트리거 컬럼·chat-channel 키·notification signing 키) 3벡터를 모두 닫음, 새 취약점 없음 |
| architecture | LOW | 정화 SoT 3벌 분산(재발 2회째), 근접 명명 래칫 2벌 comment-only 동기화 — 둘 다 기존 트레이드오프 |
| requirement | LOW | `update()` else 분기 trigger 보존이 테스트로 미고정(WARNING #2와 동일 지점) |
| scope | LOW | 표면 확장은 원 과제(스윕) 정의 안, 무관 파일·포맷팅 혼입 없음 |
| side_effect | LOW | Schedule trigger narrowing(breaking, 문서화·수용됨) 외 새 부작용 표면 없음 |
| maintainability | LOW | 전부 이전 라운드 트리아지 이월(변수명 `t`, 주석 반복, strip 루프 중복) + 사소한 신규 매직 문자열 1건 |
| testing | MEDIUM | 4건의 WARNING(신규 배선 핵심 로직 다수가 unit/실패-경로/중첩-경로 미검증) |
| documentation | LOW | CHANGELOG appUrl 서술 역행, `contractForDto` JSDoc 위치 오류 — 둘 다 동작 무관 순수 문서 결함 |
| api_contract | LOW | Schedule trigger narrowing breaking change(문서화·수용됨) 외 하위호환 위반 없음 |
| user_guide_sync | NONE | `codebase/frontend/**` 변경 0건, 신규 선언 필드는 이미 문서·dict에 등재됨, 갱신 누락 0건 |

## 발견 없는 에이전트

user_guide_sync (해당 없음 — 전체 74개 변경 파일 중 `codebase/frontend/**` 0건, 매트릭스 21개 trigger 행 중 실질 매칭 없음)

## 권장 조치사항

1. `SchedulesService.update()`의 `isActive:false` 분기에 `PATCH {isActive:false}` 후 `trigger` 키 보존 e2e 추가 — `create()`와 로직 통일(대입을 조건 분기 밖으로 이동) 검토 (WARNING #2)
2. `schedules.service.ts::create()`가 고친 회귀를 잠그는 `POST {isActive:false}` 테스트 추가, 뮤턴트로 RED 확인 (WARNING #1)
3. `SchedulesController.toResponse()`에 대한 unit 테스트 추가(현재 e2e 단독 의존, 기존 controller spec은 vacuous) (WARNING #3)
4. `contractForDto`의 실패-후-캐시삭제 경로와 `allowMissing`의 중첩 경로 매칭을 각각 별도 테스트로 고정 (WARNING #4, #5)
5. CHANGELOG의 `appUrl` 서술을 코드와 일치하도록 정정, `contractForDto` JSDoc을 함수 선언 바로 위로 이동 (WARNING #6, #7)
6. (참고) Schedule `trigger` 응답 narrowing의 외부/서드파티 소비자 존재 여부 재확인 — 이미 조치 완료로 간주되나 추가 검증 권장 (WARNING #8)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨, 강제 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(diff가 응답 직렬화/DTO 선언/테스트 배선 중심으로 성능 경로 변경 없음으로 추정, 상세 사유 미제공) |
  | dependency | 라우터 판단(package.json/의존성 변경 없음으로 추정, 상세 사유 미제공) |
  | database | 라우터 판단(마이그레이션/쿼리 로직 변경 없음으로 추정, 상세 사유 미제공) |
  | concurrency | 라우터 판단(동시성 제어 로직 변경 없음으로 추정, 상세 사유 미제공) |