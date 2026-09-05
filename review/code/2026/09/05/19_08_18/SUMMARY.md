# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 기능·보안 결함은 없으나, 이번 PR 이 신설한 §5.4 금지-조합 "래칫 가드"의 positive-control 테스트가 존재하지 않는 fixture 를 참조해 **항상 통과하는 vacuous 테스트**임을 실행으로 확인했다(Critical). 이 가드는 바로 이 PR 의 1차 커밋이 스스로 재도입한 보안-계약 위반(응답 바디 금지 조합)을 다음에 재발하지 않도록 잡기 위해 신설된 것인데, 그 가드 자체의 양성 탐지 능력이 검증되지 않은 채 남아 있다는 점에서 위험도를 HIGH 로 판정한다. router 는 `documentation·maintainability·requirement·scope·security·side_effect·testing` 7개 전원을 강제 포함(router_safety)했고, 강제된 7명 전원의 결과가 확보되어 "화이트리스트 미이행" 문제는 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/QA | §5.4 금지-조합 래칫 가드의 "[대조군] 술어가 실제로 그 조합을 집는다" 단위 테스트가 존재하지 않는 fixture(`optional-nullable-ratchet-fixture.ts`, 저장소에 없음)를 참조한다. `findOptionalNullableResponseFields()` 는 `isResponseDtoFile(file)` 경로 필터링을 파일을 열기 전에 수행하는데, 이 fixture 경로가 `/dto/responses/` 를 포함하지 않아 파일 존재 여부와 무관하게 항상 `continue` 된다. `npx jest -t "술어가 실제로 그 조합을 집는다"` 실행으로 실측 확인 — 1 passed(파일이 없는데도 그린). 테스트 이름이 약속하는 "술어가 실제로 금지 조합을 검출한다"는 전혀 검증되지 않는다. | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:467-476` (참조 fixture 부재) | `dto/responses/` 하위에 `@ApiPropertyOptional({nullable:true})` + `field?: T \| null` 조합을 담은 실제 fixture 파일을 만들고 `found` 가 그 필드를 실제로 검출하는지 단언하거나, 지금 동작(스코프 밖 스킵만 확인)에 맞게 테스트 이름을 정정할 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/API Contract | `POST /api/schedules` 를 `isActive: false` 로 호출하면, 트리거 행이 실제로 생성·연결됐는데도 응답의 `ScheduleDto.trigger` 참조 필드가 키 자체까지 생략된다 — `SchedulesService.create()` 가 `isActive` 가 false 일 때 `saved.trigger = savedTrigger` 대입을 건너뛰기 때문. 이 도달 가능한 조합(공개 optional 필드 `CreateScheduleDto.isActive`)을 검증하는 e2e 가 없어 "trigger 는 조회 경로에 따라 없을 수 있다"는 문서화된 계약과 실제 원인(같은 POST 엔드포인트 내부에서 요청 값에 따라 갈림)이 어긋난다 | `schedules.controller.ts:67-83` (`toResponse`), `schedules.service.ts:159-205` (`create()`) | `create()` 에서 `isActive` 값과 무관하게 `saved.trigger` 를 채우거나, `isActive:false` 케이스의 e2e 를 추가해 "키 생략"이 의도임을 회귀로 고정 |
| 2 | Documentation/Maintainability | `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 설명하는 JSDoc 이 후속 커밋이 그 사이에 `NOTIFICATION_SIGNING_STRIP_KEYS` 상수+주석을 끼워 넣으면서 대상 선언에서 떨어져 나갔다 — 코드 순서상 엉뚱한 상수 앞에 위치해 TSDoc/IDE 도구는 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 사실상 무주석으로 인식 | `codebase/backend/src/modules/triggers/triggers.service.ts:63-76`(JSDoc) vs `:93-96`(실제 대상 선언) | JSDoc 블록을 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언 바로 위로 이동 |
| 3 | Documentation/Maintainability | `sanitizeForResponse`(구 `sanitizeChatChannelForResponse`) 위에 rename 전 옛 JSDoc 과 이번 PR 이 새로 쓴 JSDoc 두 블록이 나란히 남아 있다 — 옛 블록은 "strip 목록은 단일 진실" 이라고 적지만 지금은 3벌로 늘어 더 이상 정확하지 않은 서술이 방치됨 | `triggers.service.ts:547-557`(옛, stale) + `:558-569`(새) | 옛 JSDoc 블록(547-557) 삭제, 새 블록만 유지 |
| 4 | Testing | `notification.signing` strip 회귀 테스트가 `secretRef` 만 입력에 채우고 `secret` 은 채우지 않은 채 두 키 모두 `not.toHaveProperty` 를 단언한다 — `secret` 쪽은 입력에 그 키가 없어 vacuous 하게 항상 참(strip 목록에서 `'secret'` 을 실수로 빼는 뮤턴트가 들어와도 GREEN) | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:196-229`(픽스처 `:207-210`, 단언 `:224-225`) | 픽스처에 `secret: 'plaintext-should-be-stripped'` 를 함께 채워 실제 제거 여부를 검증 |
| 5 | Testing | `PATCH /api/schedules/:id` 도 이번 PR 에서 `toResponse()` 를 타도록 배선됐지만, `findAll`/`findOne`/`create` 와 달리 응답 계약 대조(`assertMatchesContract`) 단언이 없다. `update()` 서비스의 `saved.trigger = trigger ?? schedule.trigger` 대입 로직은 `findOne` 과 달라 공유 헬퍼만으로 안전성이 자동 보장되지 않는다 | `schedules.controller.ts:243-249`(신설), `test/schedule-trigger.e2e-spec.ts` test D | test D 에 `assertMatchesContract(patch.body.data, await contractForDto(ScheduleDto))` 추가 |
| 6 | Side Effect/API Contract | `GET/POST/PATCH /api/schedules` 응답의 `trigger` 필드가 (조인으로 새던) Trigger 엔티티 전체에서 참조 4필드로 좁혀지는 breaking interface change. 보안 유출을 막기 위한 의도된·문서화된 변경이나, API 버전 negotiation 이 없는 이 저장소에서 외부/서드파티 소비자가 사라지는 필드를 참조 중이었다면 무공지로 깨진다(이전 라운드 `api_contract.md` 에서도 동일 근거로 이미 지적·기록됨) | `schedules.controller.ts` `toResponse` | 추가 조치 불요(이미 처분됨) — 향후 알려진 외부 소비자가 생기면 변경 공지 절차 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 응답 정화가 엔티티 메타데이터 데코레이터가 아닌 서비스 레이어의 수기 strip 목록(3벌)에 의존하는 구조는 여전히 남아 있다 — 이번 PR 에서 실제로 두 차례 같은 병(엔티티 컬럼 축, notification.signing 축)이 재발한 것이 그 위험을 실증하나, 이미 추적 중이며 이번 PR 을 막을 사유는 아님 | `triggers.service.ts` | 조치 불요(추적 중) — 세 번째 재발 시 `@Sensitive()` 류 선언적 대안 승격 검토 |
| 2 | Security | `IntegrationDto.consecutiveNetworkFailures`(FE 소비처 0곳) 노출이 CHANGELOG/plan 트래커에 이미 스코프 밖으로 명시돼 있음 | `integration-response.dto.ts:145-152` | 조치 불요(추적 중) |
| 3 | Scope | 3-커밋 시퀀스(스윕 확장 → 자기 위반 정정+래칫 가드 신설 → 리뷰 산출물)는 프로젝트 규약("자동 review/fix 는 상시 강제 의무")이 의도한 흐름대로 작동한 사례이며, 신설된 세 번째 검증 축·`contractForDto` 메모이제이션·`allowMissing` 옵션 모두 핵심 배선 작업의 종속 요구사항이거나 자기 결함 교정으로 근거가 문서화돼 있음 | 3-커밋 시퀀스 전체 | 조치 불요 |
| 4 | Scope | `workflow-crud.e2e-spec.ts` 에서 같은 모듈 두 DTO import 가 두 줄로 분리됨(이전 라운드부터 이월된 사소한 스타일 이슈) | `codebase/backend/test/workflow-crud.e2e-spec.ts` | 병합 가능하나 불요 |
| 5 | Side Effect | `response-contract.ts` 에 테스트 전용 module-level `Map` 캐시(`contractCache`)가 신설됨 — production 빌드 제외 확인, 실패 시 캐시 삭제 후 rethrow 하여 상태 오염 방지 확인 | `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요(격리·오류처리 확인됨) |
| 6 | Side Effect | `sanitizeForResponse` 가 조기 return 제거로 이제 항상 새 객체(clone)를 반환 — 정화할 것이 없는 트리거도 원본과 다른 참조를 받게 되어 참조 동일성 전제 코드에는 함정이 될 수 있음 | `triggers.service.ts:570` | JSDoc 에 "항상 새 객체 반환" 계약 명시 권고 |
| 7 | Side Effect | `config.chatChannel`/`config.notification` 정화가 얕은 복사라 strip 대상이 아닌 중첩 값은 원본과 참조 공유(이번 PR 이 동일 패턴을 두 번째 지점에 반복) | `triggers.service.ts:588-616` | 조치 불요(기존 패턴 답습) — 세 번째 재발 시 `structuredClone` 전환 검토 |
| 8 | Maintainability | `sanitizeForResponse` 내부에서 strip-key-set 필터링 루프(`config.chatChannel` 축, `config.notification.signing` 축)가 동일 로직으로 반복됨(DRY 여지) | `triggers.service.ts:588-592`, `:604-610` | `omitKeys()` 헬퍼로 추출 권고 |
| 9 | Maintainability | `SchedulesController.toResponse()` 의 지역 변수 `t` 가 축약형으로 남아 있음(이전 라운드부터 이월) | `schedules.controller.ts:68` | `t` → `trigger` 개명 권고(강제 아님) |
| 10 | Maintainability | "이미 응답에 실려 나가고 있었다…" 배경 설명 주석이 4개 DTO 파일에 반복(이전 라운드부터 이월, 조치 불요로 처리됨) | `alert-rule-response.dto.ts` 등 4곳 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 회전 secret 유출 수정·§5.4 금지 조합 정정 모두 재검증 완료, 새 결함 없음 |
| requirement | LOW | vacuous positive-control 테스트(WARNING, testing 이 CRITICAL 로 재확인), `isActive:false` 시 trigger 키 생략 미검증 |
| scope | NONE | 3-커밋 구성·확장 범위 전부 근거 문서화됨, 이월된 사소한 스타일 이슈 1건만 |
| side_effect | LOW | schedules trigger 필드 축소(문서화된 breaking change), 테스트 전용 전역 캐시·참조 동일성 변경 등 INFO 다수 |
| maintainability | LOW | JSDoc 위치 어긋남 2건(WARNING), strip 루프 중복·변수명 등 INFO |
| testing | HIGH | positive-control 테스트 vacuous(CRITICAL, 실행으로 확인), trigger 키 생략·secret 평문 strip·PATCH 계약 미검증 3건(WARNING) |
| documentation | LOW | JSDoc 위치 어긋남 2건(maintainability 와 동일 발견 교차 확인), 이전 라운드 지적 사항은 모두 정정 확인됨 |

## 발견 없는 에이전트

- security, scope — 실질 결함 없음(INFO 만 존재)

## 권장 조치사항

1. §5.4 금지-조합 래칫 가드의 positive-control 테스트를 실제 존재하는 `dto/responses/` fixture 로 교체해 진짜 양성 탐지를 검증할 것 (Critical, 이 가드의 존재 이유를 회복).
2. `POST /api/schedules`(`isActive:false`) 경로에서 `trigger` 참조 필드가 생성 사실과 무관하게 생략되는 문제를 정정하거나 최소한 e2e 로 의도를 고정할 것.
3. `PATCH /api/schedules/:id` 응답에 `assertMatchesContract` 단언을 추가해 4개 배선 지점의 계약 검증을 완전하게 할 것.
4. `notification.signing.secret` strip 회귀 테스트 픽스처에 실제 `secret` 키를 채워 vacuous 단언을 제거할 것.
5. `triggers.service.ts` 의 어긋난/중복된 JSDoc 두 곳(TRIGGER_RESPONSE_STRIP_COLUMNS 위치, sanitizeForResponse 옛 블록)을 정리할 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (실행된 7명 전원이 router_safety 로 강제 포함되었고, 강제된 전원의 결과가 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이번 diff 성격상 성능 영향 낮음으로 분류) |
  | architecture | router 판단 |
  | dependency | router 판단 |
  | database | router 판단 |
  | concurrency | router 판단 |
  | api_contract | router 판단(단, 이전 라운드 산출물이 side_effect 리뷰어에 의해 교차 참조·재확인됨) |
  | user_guide_sync | router 판단 |