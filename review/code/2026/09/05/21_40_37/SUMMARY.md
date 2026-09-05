# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 이 PR 이 고친 보안 결함(트리거 회전 secret 유출)의 두 경로 중 트리거 쪽(`GET /api/triggers` 목록·`PATCH /api/triggers/:id`)이 §5.4 계약 대조로 wire 레벨 검증되지 않는 실질 테스트 갭이 남아 있고(testing WARNING), `SchedulesController.toResponse()` 의 보안 경계 로직이 unit 테스트 불가한 위치에 있다는 구조적 지적(architecture WARNING)도 함께 있어 LOW 보다 한 단계 위로 판정한다. 9개 reviewer(요청된 7개 forced 전원 포함) 전원이 STATUS=success 로 전문을 반환했고 forced 화이트리스트 미이행 항목은 없다.

## Critical 발견사항

없음 — 9개 reviewer 전원 CRITICAL 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `TriggerDto` 응답-계약 대조(`assertMatchesContract`)가 CHANGELOG 가 지목한 두 유출 경로 중 트리거 쪽의 **목록·PATCH 변형**에는 배선되지 않음 — 전 e2e 스위트에서 `TriggerDto` 대조 호출이 `POST` 생성 1곳뿐(스케줄 쪽 `ScheduleDto` 는 6곳 촘촘히 배선된 것과 비대칭). 근본 stripping 은 unit 이 지키므로 실질 유출 위험은 낮으나, 이 PR 목적(HTTP 응답 vs DTO 선언 대조)이 자기 보안수정의 절반에 미적용 | `codebase/backend/src/modules/triggers/triggers.controller.ts:60`(`findAll`), `test/schedule-trigger.e2e-spec.ts:231,246`(C-2, GET 목록), `:339,357,370,389`(G/H, PATCH); 배선된 유일한 곳 `test/chat-channel-trigger-create.e2e-spec.ts:110` | `schedule-trigger.e2e-spec.ts` C-2 (`GET /api/triggers?type=schedule`)와 G/H(`PATCH /api/triggers/:id`)에 `assertMatchesContract(..., await contractForDto(TriggerDto))` 추가. non-schedule(webhook/manual) 목록 케이스도 최소 1곳 추가 |
| 2 | testing | `contractForDto` 캐시 격리 범위에 대한 JSDoc 주장("Jest worker 단위로 격리된다")이 scratch 환경 실측(동일 jest 설정 재현)으로 **반증** — 실제로는 테스트 **파일** 단위 격리. 동작 결함은 아니나(파일 내 캐시는 정상 동작·회귀 테스트로 방어됨), 서술이 실측과 어긋남 | `codebase/backend/src/shared/testing/response-contract.ts:398-399`(JSDoc), 캐시 선언 `:386` | JSDoc 을 "테스트 **파일**마다 모듈 레지스트리가 새로 생성되므로 캐시는 같은 파일 내 반복 호출에서만 유효하다"로 정정 |
| 3 | architecture | `SchedulesController.toResponse()` 가 HTTP 오케스트레이션과 도메인 보안 경계 로직(트리거 엔티티 4필드로 narrowing)을 겸하면서 `private`·반환타입 미표기라 unit 테스트가 불가능 — 검증 수단이 e2e 4경로뿐 | `codebase/backend/src/modules/schedules/schedules.controller.ts:67-83`(정의), 호출부 `:101,120-121,194-196,246-248` | `toResponse` 를 컨트롤러 밖 순수 함수(`schedule-response.mapper.ts` 의 `toScheduleResponse(schedule): ...`)로 추출해 unit 테스트 가능하게 분리 |
| 4 | architecture | 트리거 비밀 응답 스트립이 3벌의 수기 deny-list(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`)로 구현되어 OCP 관점에서 새 비밀 필드 추가 시 컴파일러가 강제하지 못하는 사람 의존 스텝이 남음 — 이번 PR 이 고친 결함의 근본 패턴이 한 겹 더 쌓인 것 | `codebase/backend/src/modules/triggers/triggers.service.ts:53-97`(상수 선언), `:576-638`(`sanitizeForResponse`) | 즉시 조치 불요(팀이 이미 "4번째 비밀 필드 재발 시 `@Sensitive()` 류 데코레이터로 승격" 완화 계획 문서화). 다음 재발 시 선언적 접근 전환 고려 |
| 5 | maintainability / scope | `schedule-trigger.e2e-spec.ts` 신규 `C-3` 테스트 안에 같은 사실(같은 review 포인터 `20_45_37` W1·W2 까지 동일)을 설명하는 주석 블록이 순서만 바꿔 **두 번 반복** — 편집 잔여물로 보임 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:177-179`(1차), `:185-187`(2차, 사이 `:181-182` 에 별도 내용 삽입) | 177-179행과 185-187행 중 하나(185-187 권장, 더 간결)만 남기고 나머지 삭제 |
| 6 | maintainability | JSDoc 블록이 그 사이에 새로 삽입된 대형 코드 블록(78건 래칫 + describe, 약 160줄) 때문에 원래 대상 선언에서 100줄 이상 멀어짐 — 이 PR 이 이미 두 차례(`triggers.service.ts`, `response-contract.ts`) 겪고 고친 것과 같은 패턴이 세 번째로 재발 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:346-354`(numeric 컬럼 JSDoc, 실제 대상은 `:517`), `:355-369`(§5.4 래칫 JSDoc, 실제 대상은 `:460`), 사이 `:370` 한 줄 주석 | 346-354행 JSDoc 을 517행 `describe` 바로 위로, 355-369행 JSDoc 을 460행 `describe('§5.4 금지 조합 래칫...')` 바로 위로 재배치 |
| 7 | api_contract / side_effect | `GET/POST/PATCH /api/schedules(/:id)` 응답의 `trigger` 필드가 버전 신호 없이(non-versioned) 전체 `Trigger` 엔티티에서 4필드(`id`/`name`/`workflowId`/`workflow.name`) 참조 DTO 로 축소 — 보안 결함(비밀 유출) 수정의 불가피한 부수효과이자 이미 3라운드 리뷰·CHANGELOG·FE 소비처 감사로 근거가 충분하나, API 계약 축에서는 breaking change 로 별도 기록 필요. FE 저장소 밖(외부 SDK·웹훅 소비자 등)의 소비자 존재 여부는 이번 diff 범위에서 확인 불가 | `codebase/backend/src/modules/schedules/schedules.controller.ts:67-83`(`toResponse`), `dto/responses/schedule-response.dto.ts:91`(`ScheduleTriggerRefDto`) | 조치 불요(팀 결정 완료, 문서화됨). 향후 유사 패턴 재발 시 `spec/5-system/2-api-convention.md` 에도 breaking-change 이력 기록 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `chatChannelLastError`/`notificationLastError` 가 외부 chat-channel provider 의 `err.message` 를 그대로(1024자 절단) wire 로 노출 — 기존 로직(이번 diff 는 DTO 선언만 공식화), 즉각적 인젝션 경로 아님. 이전 라운드(`20_45_37` INFO#7)에 이미 "조치 불요(추적)"로 처분됨 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:81,98`, `triggers.service.ts:891` | 조치 불요. 어댑터 변경 시 "provider raw body 를 message 에 담지 않는다" 불변식 문서화 권고 |
| 2 | security / api_contract | `IntegrationDto.consecutiveNetworkFailures` 가 FE 미소비 내부 health 카운터임에도 노출 유지 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "wire 변경이라 별도 항목" 으로 등재됨 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:160-161` | 조치 불요(등재 완료). 제거 시점엔 별도 breaking CHANGELOG 필요 |
| 3 | security | 테스트 fixture 내 `'wsk_live_secret'` 등 시크릿-유사 문자열 — naive 시크릿 스캐너 오탐 가능 형태이나 `triggerRepo.findOne.mockResolvedValue` 안의 mock 값, 실제 자격증명 아님 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:203,205,213` | 조치 불요. secret-scanning CI 도입 시 allowlist 고려 |
| 4 | architecture | `SchedulesController.toResponse()`(allow-list, 4필드만 남김) vs `TriggersService.sanitizeForResponse()`(deny-list, 알려진 비밀만 제거) — 새 컬럼 추가 시 allow-list 는 기본 비노출, deny-list 는 기본 노출이라는 안전성 비대칭. 긍정적 관찰이자 향후 재설계 근거 | `schedules.controller.ts:73-80` vs `triggers.service.ts:94-97` | 조치 불요(참고). 향후 `sanitizeForResponse` 재설계 시 allow-list 전환 우선 고려 |
| 5 | architecture | `toResponse()` 반환 타입이 명시 DTO 타입으로 표기되지 않아 컴파일러가 §5.4 계약과의 일치를 못 검증 — 다만 이는 이 PR 의 런타임 검증자(`assertMatchesContract`)가 메우려는 의도된 설계 간극(팀이 이미 "반환타입 강제 시 Date→string 등 대량 거짓 타입오류" 실측으로 반증) | `schedules.controller.ts:67` | 조치 불요. 필요 시 필드 키 집합만 좁히는 절충 타입 고려(우선순위 낮음) |
| 6 | requirement | `workflow-crud.e2e-spec.ts` 가 `ExportWorkflowDto` 를 별도 import 줄로 추가해 같은 모듈 타입이 두 줄로 나뉨 — 이전 라운드(`18_23_02/scope.md`)에서 이미 "조치 불요(사소)" 처분된 이월 항목 | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | 조치 불요. 다음 편집 시 한 줄로 병합 |
| 7 | requirement | §5.4 래칫 양성 대조군 fixture(`optional-nullable.fixture.ts`)가 spec 의 `code:` glob 커버리지 밖 — `spec/` 쓰기는 developer 권한 밖이라 이미 planner 후속으로 등재됨 | `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` | 조치 불요(등재 완료, planner 턴 대기) |
| 8 | scope | 보안 결함 수정(트리거 회전 secret 유출) + §5.4 검증자 배선 확대(4→18 DTO) + 23필드 선언 보정이 한 PR 에 혼재 — 범위 위반은 아니며 CHANGELOG·plan 서술이 "§5.4 스윕 도중 실측 발견" 임을 일관되게 명시 | `CHANGELOG.md:3-79`, `triggers.service.ts`, `schedules.{controller,service}.ts` | 조치 불요. 참고: 이후 `git blame` 으로 보안 픽스 추적 시 계약-스윕 노이즈에 유의 |
| 9 | scope | 신규 3번째 검증 축(`findOptionalNullableResponseFields` + 78건 래칫)이 원 과제 정의("4→18 DTO 배선")보다 넓은 신규 인프라 — 이 PR 자신이 만든 §5.4 위반(23곳)의 직접적 후속 방어책으로 정당화됨, 근거가 CHANGELOG/plan 에 이미 투명하게 기록 | `swagger-dto-contract-guard.ts:222-311`, `swagger-dto-contract.spec.ts` 신규 describe | 조치 불요. PR 본문에 "§5.4 스윕 1차" 상위 과제명 명시 여부만 재확인 권장 |
| 10 | side_effect | `contractForDto` 캐싱 도입으로 module-level 전역 `Map` 신설 — `tsconfig.build.json` 이 `src/shared/testing/**` 를 프로덕션 빌드에서 제외함을 실측 확인, 실패 promise 는 `.catch()` 에서 캐시 축출, 메모이제이션·축출 둘 다 회귀 테스트로 고정됨 | `codebase/backend/src/shared/testing/response-contract.ts:386,410-423` | 조치 불요 |
| 11 | side_effect | `sanitizeForResponse()` 가 이제 항상 새 객체를 반환(종전엔 조기 return 시 원본 엔티티 참조 반환) — 계약 변경이나 현재 호출부 6곳 전부 응답 경계 최종 return 에서만 사용해 참조 동일성 의존 없음 | `codebase/backend/src/modules/triggers/triggers.service.ts:576-638` | 조치 불요. 향후 새 호출부 추가 시 참조 동일성 비의존 확인 |
| 12 | side_effect | `SchedulesService.create()`/`update()` 의 `saved.trigger` 대입이 `if (isActive)` 밖으로 이동해 항상 in-memory 엔티티를 뮤테이트 — 이 대입 이후 추가 `.save()` 없어 DB 미반영, 응답 셰이핑에만 영향(안전 확인) | `codebase/backend/src/modules/schedules/schedules.service.ts:203,263` | 조치 불요 |
| 13 | side_effect | `sanitizeForResponse` 에서 `config` 를 건드리지 않는 트리거(`configTouched===false`)는 반환 객체의 `config` 가 원본 엔티티와 같은 객체 참조를 공유 — 현재 다운스트림 mutation 없어 안전하나 잠재 경로 | `codebase/backend/src/modules/triggers/triggers.service.ts:590-624` | 조치 불요(잠재 경로만 기록). 필요 시 `configTouched` 분기에서도 무조건 얕은 복사 고려 |
| 14 | maintainability / documentation | `SchedulesController.toResponse()` 지역 변수명 `t` 가 상세 JSDoc 대비 유독 축약 — 3라운드 연속 지적·이월 | `codebase/backend/src/modules/schedules/schedules.controller.ts:68` | 조치 불요(이월). 다음 편집 시 `t`→`trigger` |
| 15 | maintainability / documentation | "이미 응답에 실려 나가고 있었다..." 배경 설명 주석 블록이 4개 DTO 파일에 거의 동일하게 반복 — 3라운드 연속 이월, 각 DTO 자기완결성 유지 목적으로 의도적 | `alert-rule-response.dto.ts:55-61`, `integration-response.dto.ts:118-124`, `knowledge-base-response.dto.ts:93-99`, `trigger-response.dto.ts:69-75` | 조치 불요. 서사 정정 시 4곳 전수 grep 동기화 |
| 16 | maintainability | `sanitizeForResponse()` 안 구조가 거의 동일한 "allowlist 밖 키 필터링" 루프가 chatChannel/notification.signing 두 축에서 반복 — 조건부 유예("3번째 strip 대상 생기면 공용 헬퍼 추출") 유지, 아직 조건 미충족 | `codebase/backend/src/modules/triggers/triggers.service.ts:592-603,605-622` | 조치 불요(추적 중) |
| 17 | testing | `IntegrationDto.appUrl` 의 cafe24 Private 비-null 분기, `toResponse()` 의 `trigger` 부재(falsy) 분기 모두 테스트로 미도달 — `trigger` 부재 분기는 FK `onDelete:'CASCADE'` 상 정상 데이터로 도달 불가능함을 이번 라운드에서 추가 확인, 이전 라운드에서 "시급성 낮음" 처분 | `schedules.controller.ts` `toResponse`, `schedule.entity.ts:28` | 조치 불요(이월, 저우선) |
| 18 | documentation | `CHANGELOG.md` 신규 섹션과 다음 섹션 사이 빈 줄이 2번(파일 전체 관례는 1번) | `CHANGELOG.md:80-81` | 80행 또는 81행 중 하나 제거 |
| 19 | api_contract | `ExportWorkflowDto.formatVersion` 이 required 선언이나 실제 응답에 미방출 — `allowMissing:['formatVersion']` 으로 e2e 계약 대조에서 면제, `spec/2-navigation/1-workflow-list.md` 의 기존 "Planned" 갭이 §5.4 검증자 확대로 드러난 것(신규 결함 아님) | `codebase/backend/test/workflow-crud.e2e-spec.ts:429-442` | 조치 불요(추적 중). `allowMissing` 사용처 증가 시 "spec Planned 갭 참조 필수" 정적 검사 승격 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 결함 수정(트리거 회전 secret 2경로 유출 차단) 검증 완료, 신규 유출 없음. INFO 3건(에러메시지 노출 경로 문서화 권고 등) |
| architecture | LOW | `toResponse()` unit 테스트 불가 구조(WARNING), 3중 수기 deny-list OCP 우려(WARNING). 3중 방어 계층 분업·경계 컨텍스트 소유권은 양호 |
| requirement | NONE | 30개 실질 변경 파일 전수 재검증 — DTO 23필드 전부 엔티티와 일치, 정화 경로 전수 확인, 신규 Critical/Warning 없음 |
| scope | NONE | codebase 외 변경 없음, drive-by 없음. 보안수정+계약스윕 혼재는 문서화된 정당한 판단 |
| side_effect | LOW | 신규 전역 캐시(테스트 전용, 방어됨), 응답 형태 축소(breaking, 이미 검토됨), 계약 변경 다수이나 전부 현재 안전 |
| maintainability | LOW | 중복 주석 블록(WARNING), JSDoc-대상 분리 패턴 3번째 재발(WARNING). 나머지는 3라운드 이월 INFO |
| testing | MEDIUM | `TriggerDto` 계약 대조가 GET 목록·PATCH 에 미배선(WARNING) — 이 PR 자신의 보안수정 절반이 wire 레벨 미검증. 캐시 격리 근거 반증(WARNING) |
| documentation | LOW | CHANGELOG 빈줄 포맷 사소 오류 외 전반적으로 완성도 높음. 정량 서술 다수 실측 대조 전부 일치 |
| api_contract | LOW | 스케줄 `trigger` 필드 축소가 non-versioned breaking change(WARNING, 이미 검토됨). DTO 23필드 전수 대조 불일치 없음 |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원 최소 1건 이상(INFO 포함) 보고.

## 권장 조치사항

1. `TriggerDto` 응답-계약 대조를 `GET /api/triggers`(목록)·`PATCH /api/triggers/:id` 에도 배선한다 — 이 PR 이 고친 보안 수정(트리거 회전 secret 유출)의 검증 커버리지 비대칭을 해소하는 것이 가장 우선순위 높다 (testing WARNING #1).
2. `SchedulesController.toResponse()` 를 컨트롤러 밖 순수 함수로 추출해 unit 테스트 가능하게 만든다 (architecture WARNING #3).
3. `response-contract.ts` 의 `contractForDto` 캐시 격리 범위 JSDoc 을 "파일 단위"로 정정한다 (testing WARNING #2).
4. `schedule-trigger.e2e-spec.ts` C-3 의 중복 주석 블록 정리, `swagger-dto-contract.spec.ts` 의 분리된 JSDoc 재배치 — 둘 다 사소하나 즉시 정리 가능 (maintainability WARNING #5, #6).
5. 트리거 비밀 스트립의 3중 수기 deny-list(OCP)와 스케줄 `trigger` 필드 축소(breaking change)는 팀이 이미 근거·완화 계획을 문서화했으므로 이번 라운드에서 즉시 조치는 불요 — 각각 "4번째 비밀 필드 재발 시" / "외부 소비자 존재 확인" 시점에 재검토 (architecture WARNING #4, api_contract WARNING #7).
6. 나머지 INFO 19건은 대부분 이전 3라운드 리뷰에서 이미 검토·이월 처리된 사소 항목이므로 별도 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이번 diff 범위 밖) |
  | dependency | router 판단(이번 diff 범위 밖) |
  | database | router 판단(이번 diff 범위 밖) |
  | concurrency | router 판단(이번 diff 범위 밖) |
  | user_guide_sync | router 판단(이번 diff 범위 밖) |