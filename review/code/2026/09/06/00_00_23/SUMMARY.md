# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(문서 설명 오류 1건 + 유지보수성 2건) 모두 기능·wire 안전에 영향 없는 수준. forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `IntegrationDto.appUrl` 의 공개 JSDoc·내부 주석이 "cafe24 Private 전용"이라고 잘못 서술한다 — 실제로는 MakeShop ShopStore 설치 통합도 이 필드를 채우며(`INTEGRATION_DERIVED_REGISTRY` makeshop 분기), spec(`4-integration.md:795`)은 이미 두 경우를 정확히 문서화하고 있어 코드측 설명만 낡았다. Swagger 문서에 그대로 노출되므로 makeshop 연동 개발자가 오판할 수 있다. | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:126-135` | 공개 JSDoc/내부 주석을 "cafe24 Private / MakeShop ShopStore 설치 통합" 으로 정정. spec 은 이미 옳으므로 코드만 spec 에 맞춘다 |
| 2 | maintainability | `sanitizeForResponse` 가 4개 비밀 축(chatChannel/notification.signing/interaction JSONB + 엔티티 컬럼) + workflow ref 좁히기까지 5개 책임을 78줄 단일 메서드에 몰아넣어 3단 중첩 조건문·높은 순환 복잡도를 갖는다. 메서드 자신의 JSDoc 이 "세 번 같은 형태로 좁았다"는 성장 이력을 스스로 기록하면서도 함수 분해는 하지 않았다 | `codebase/backend/src/modules/triggers/triggers.service.ts:627-705` | 각 축을 `stripChatChannelSecrets`·`stripNotificationSigningSecrets`·`stripInteractionSecrets`·`narrowWorkflowRef` 같은 이름 있는 함수로 분리하고 `sanitizeForResponse` 는 얇은 오케스트레이터로 남길 것(파일 분리가 아니라 같은 파일 내 메서드 분해이므로 기존 RESOLUTION 의 "매퍼 파일 추출 보류" 결정과 별개 판단) |
| 3 | maintainability | JSDoc 블록이 대상 테스트에서 분리돼 있다 — 191-197행 블록(응답 정화 회귀 설명)이 실제로는 233행 `it(...)`를 설명하는데, 198-206행의 다른 JSDoc 과 함께 208행 `it('PATCH 에서 생략된 필드는...')` 위에 붙어 맥락 없이 읽힌다. 이 PR 이 이미 4회 재발로 기록한 "JSDoc-대상 분리" 패턴의 5번째 사례 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:191-208` | 191-197행 블록을 233행 테스트 바로 위로 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY/ARCHITECTURE | 트리거 비밀 스트립이 4벌의 수기 deny-list 로 구성돼 구조적 fail-open 위험(신규 비밀 필드 추가 시 목록 누락)이 남아 있다. 이미 프로젝트가 인지해 `plan/in-progress/spec-draft-nullable-notation-followups.md:302-320` 에 측정 조건과 함께 백로그 등재했고 직전 리뷰 라운드에서도 유예 결정됨 | `triggers.service.ts:53-61,74-77,94-97,114` (`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 등), 통합 지점 `:627` | 조치 불요(이미 유예·등재). 다음 재설계 시 `@Sensitive()` 데코레이터 + 리플렉션 기반 allow-list 전환 검토 |
| 2 | ARCHITECTURE/MAINTAINABILITY | 조인된 자식 엔티티를 응답 경계에서 좁히는 책임이 트리거는 서비스 계층(`sanitizeForResponse`), 스케줄은 컨트롤러 계층(`toResponse`)으로 갈려 있다. 각자 근거는 문서화돼 있고 직전 라운드에서 이미 검토·유예됨 | `triggers.service.ts:594-627`, `schedules.controller.ts:53-85` | 조치 불요(근거 있는 판단, 유예 기록 있음). 세 번째 유사 모듈이 생기면 `spec/conventions/` 에 컨벤션 명문화 검토 |
| 3 | ARCHITECTURE | §5.4 금지-조합 drift 래칫이 `swagger-dto-contract.spec.ts`(78건, 전수)와 `execution-response.dto.spec.ts`(10건, ExecutionDto 만) 두 파일에 부분집합 관계로 중복 추적된다. 상호 참조 주석으로 완화됐음(`review/consistency/2026/09/05/19_08_19` W5 처분 결과) | `swagger-dto-contract.spec.ts` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT`), `execution-response.dto.spec.ts:59-71` | 조치 불요(이미 완화·기록). 다음에 만질 때 파생 관계로 리팩터링 고려 |
| 4 | SECURITY | `response-contract.ts`/`swagger-dto-contract-guard.ts` 는 테스트 전용 검증 유틸리티이며 런타임 보안 경계가 아니다 — 프로덕션 응답을 실제로 필터링하지 않고 drift 를 사후 검출·회귀 고정하는 개발 시점 도구 | `codebase/backend/src/shared/testing/response-contract.ts`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` | 조치 불요. 참고용 관찰 |
| 5 | SCOPE | `ExportWorkflowDto`/`WorkflowDto` import 가 같은 경로인데 두 줄로 분리된 채 여러 라운드째 남아 있다 | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합(매우 사소, 블로킹 아님) |
| 6 | SCOPE | 실질 코드 diff(31파일, +1,432/-50줄)보다 `review/**` 산출물(120개 이상 파일, 10라운드)이 훨씬 크다 — 프로젝트 규약상 정상이며 범위 위반 아님 | `review/code/2026/09/05/**`, `review/consistency/2026/09/05/**` | 조치 불요 |
| 7 | SCOPE | 보안 결함 수정(트리거/스케줄 secret 유출)과 §5.4 계약 스윕(DTO 선언 보정)이 한 브랜치에 섞여 있음 — 스윕 도중 실측으로 발견된 결함이라 분리 사유가 약함 | `triggers.service.ts`, `schedules.{controller,service}.ts`, CHANGELOG.md | 조치 불요 |
| 8 | SCOPE/API_CONTRACT | `IntegrationDto.consecutiveNetworkFailures` 는 FE 소비처 0곳인 내부 카운터인데 선언에 포함됨. PR 자신의 주석·plan 트래커가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다"고 이미 등재 | `integration-response.dto.ts` (`consecutiveNetworkFailures`) | 조치 불요(이미 등재) |
| 9 | SIDE_EFFECT | `response-contract.ts` 에 모듈 레벨 가변 `Map` 캐시(`contractCache`) 신설. 프로덕션 비-테스트 파일에서 import 없음 확인, 실패 promise 는 캐시에서 제거됨 | `response-contract.ts:386,412-425` | 조치 불요 |
| 10 | SIDE_EFFECT | `sanitizeForResponse` 가 조기 return 제거로 항상 새 객체를 반환하도록 변경(참조 동일성 변화). 5개 호출부 모두 terminal call 이라 실질 영향 없음 | `triggers.service.ts:627`, 호출부 `findAll`/`findOneDetail`(2)/`create`/`update` | 조치 불요 |
| 11 | SIDE_EFFECT/API_CONTRACT | `TriggersService.update()` 가 `v !== undefined` 필터를 추가해 `useDefineForClassFields` 로 인한 `undefined` own-property 가 로드된 필드를 덮어써 PATCH 응답에서 필드가 조용히 사라지던 기존 부작용을 제거(의도된 수정, tri-state 계약 보존, 회귀 테스트로 고정) | `triggers.service.ts:413-416` (`update()`) | 조치 불요 |
| 12 | SIDE_EFFECT/API_CONTRACT | `SchedulesController` 4개 엔드포인트의 `trigger` 필드가 전체 엔티티에서 참조 4필드로 축소됨 — breaking change 이나 CHANGELOG 에 원인·영향·소비처 실측(FE `RawSchedule` 유일, SDK 미해당)까지 문서화됨 | `schedules.controller.ts:67` (`toResponse`) 및 호출부 4곳 | 조치 불요. 향후 서드파티 소비자 생기면 CHANGELOG-only 고지 충분성 재검토 |
| 13 | SIDE_EFFECT | `schedules.service.ts` 의 `saved.trigger = ...` 대입이 `if (isActive)` 조건 밖으로 이동 — `save()` 이후 in-memory 대입이라 추가 DB write·BullMQ 잡 타이밍 변화 없음 확인 | `schedules.service.ts:203,263` | 조치 불요 |
| 14 | MAINTAINABILITY | `SchedulesController.create`/`update` unit 테스트에 동일한 6줄 단언 블록이 반복됨 | `schedules.controller.spec.ts:72-78,92-98` | `expectNarrowedScheduleTrigger(res.trigger)` 헬퍼로 추출 검토 |
| 15 | TESTING | `SchedulesController.findAll`/`findById` 는 unit 레벨 mock 검증이 없다(e2e 로만 커버) — `create`/`update` 와 비대칭 | `schedules.controller.spec.ts` | 급하지 않음. 다음 손댈 때 동일 mock 패턴으로 unit 대칭화 고려 |
| 16 | TESTING | `sanitizeForResponse` 의 `cfg` null/undefined 방어 분기가 unit 으로 검증되지 않음 — `Trigger.config` 컬럼이 `nullable:true` 없어 사실상 도달 불가에 가까운 방어 코드 | `triggers.service.ts` (`if (cfg) {...}`) | 조치 불요. `config` nullable 화 마이그레이션 생기면 그때 unit 추가 |
| 17 | DOCUMENTATION | "이미 응답에 실려 나가고 있었다..." 설명 주석 블록이 4개 응답 DTO 파일에 문자 그대로 반복 | `alert-rule-response.dto.ts:55-61`, `integration-response.dto.ts:118-124`, `knowledge-base-response.dto.ts:93-99`, `trigger-response.dto.ts:98-104` | 조치 불필요. 서사 정정 필요 시 `grep -rl "이미 응답에 실려 나가고 있었다"` 로 4곳 동기화 |
| 18 | REQUIREMENT | `appUrl`(WARNING #1) 을 제외한 나머지 23개 신규 필드는 엔티티/서비스 실제 nullable 여부·spec 문서와 전부 일치 확인(교차 검증 완료, 긍정 관찰) | (교차 확인, 단일 위치 아님) | 조치 불요 |
| 19 | API_CONTRACT | 이중 응답-계약 검증자(런타임 값 대조 + 정적 선언 대조, §5.4 금지조합 3번째 축 신설)가 계층 경계를 명확히 문서화하며 잘 분업됨(긍정 관찰) | `response-contract.ts`, `swagger-dto-contract-guard.ts` | 조치 불요 |
| 20 | API_CONTRACT | 페이지네이션 봉투(`total`/`page`/`limit`)는 이번 diff 로 변경되지 않음 확인 | `schedules.controller.ts` (`findAll()`) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | deny-list fail-open 구조적 위험(이미 유예) 외 신규 결함 없음. 트리거 회전 secret 유출 2경로 수정을 코드 대조로 재확인(긍정) |
| architecture | NONE | 레이어 분리·deny-list·drift 래칫 중복 모두 기존에 검토·유예된 트레이드오프. 신규 결함 없음 |
| requirement | LOW | `IntegrationDto.appUrl` JSDoc 이 MakeShop 케이스 누락(WARNING). 나머지 23개 필드는 spec/엔티티와 일치 |
| scope | NONE | 코드 변경이 §5.4 스윕이라는 단일 목적에서 벗어나지 않음. import 미병합 등 사소한 관찰만 |
| side_effect | LOW | 신규 전역 캐시·참조 동일성 변화·breaking change 등 전부 문서화·검증된 의도적 변경 |
| maintainability | LOW | `sanitizeForResponse` 5책임 미분해(WARNING), JSDoc-대상 분리 5번째 재발(WARNING) |
| testing | LOW | findAll/findById unit 갭, cfg null 방어 미검증 — 둘 다 INFO. 뮤테이션 검증·대조군 패턴 등 테스트 품질은 양호 |
| documentation | NONE | 여러 라운드 재발했던 문서화 패턴(JSDoc 분리·stale 주석) 전부 최종 커밋에서 해소 확인. 4곳 설명 주석 반복만 INFO |
| api_contract | LOW | `ScheduleDto.trigger`/`TriggerDto.workflow` 축소는 문서화된 breaking change. 신규 필드는 §5.4 기본형 일관 준수 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 중 1건(backend-api-change)만 매치, swagger jsdoc 충족·user-guide 갱신 불필요로 판단(신규 가시 기능 없음) |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 INFO 이상 발견사항 보고).

## 권장 조치사항

1. `IntegrationDto.appUrl` 의 JSDoc/내부 주석을 "cafe24 Private / MakeShop ShopStore 설치 통합" 으로 정정한다(WARNING #1) — spec 은 이미 정확하므로 코드측만 맞춘다.
2. `triggers.service.spec.ts:191-197` 의 분리된 JSDoc 블록을 실제 대상(233행) 위로 이동한다(WARNING #3).
3. 여유가 있으면 `sanitizeForResponse`(627-705행)를 축별 작은 함수로 분해해 순환 복잡도를 낮춘다(WARNING #2) — 급하지 않으나 이 메서드가 이미 3회 같은 형태로 좁게 성장한 이력이 있어 다음 비밀 축 추가 전에 정리해 두는 편이 유리하다.
4. 나머지 INFO 항목(deny-list 구조적 위험, 레이어 분산, drift 래칫 중복, 테스트 중복/갭 등)은 이미 유예·백로그 등재되었거나 영향이 미미하므로 이번 라운드에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(본 프롬프트에 개별 사유 미포함, 라우팅 결정 파일 기준 제외) |
  | dependency | router 판단(상동) |
  | database | router 판단(상동) |
  | concurrency | router 판단(상동) |