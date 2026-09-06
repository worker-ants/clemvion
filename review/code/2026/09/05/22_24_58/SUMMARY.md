# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 다만 `TriggersService` 의 두 실동작 수정(PATCH 생략 필드 undefined 덮어쓰기 방지, findAll 경로 secret strip)에 unit 회귀 테스트가 없어 e2e 단독 방어 상태이고, 공개 응답 DTO(`TriggerDto`) 하나가 문서 주석을 완전히 잃었으며, `GET/POST/PATCH /api/schedules` 응답이 버전 신호 없이 축소되는 breaking change 가 있다 — 전부 WARNING 수준으로 병합을 막을 사유는 아니나 이번 라운드에 정리하는 것을 권한다. forced(router_safety) 화이트리스트 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `TriggersService.update()` 의 "PATCH 생략 필드 → `undefined` 덮어쓰기" 방지 수정에 대응하는 unit 회귀 테스트가 없다 — e2e 하나만 이 버그 클래스를 잡는다. `.filter(([, v]) => v !== undefined)` 를 삭제하는 뮤턴트를 넣어도 backend unit 전체가 GREEN 일 가능성이 높다 | `codebase/backend/src/modules/triggers/triggers.service.ts:371-380`, 테스트 부재 자리 `triggers.service.spec.ts` `update` describe | `{ isActive: false }` 처럼 `name` 을 생략한 PATCH 를 보내고 `result.name` 이 원래 값과 같음을 단언하는 unit 케이스 1건 추가 |
| 2 | Testing | `TriggersService.findAll` 의 schedule enrichment 경로(`sanitizeForResponse` 두 번째 호출부)는 `notificationSecretV2`/`chatChannelTokenV2` 스트립을 검증하는 unit fixture 가 없다 — 이번 diff 에 `findOneDetail` 에만 보강됨. `findAll` 배열 매핑 쪽 strip 이 실수로 제거돼도 unit 은 못 잡는다(e2e C-2 만 방어) | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:322-489` (`findAll` fixture), 프로덕션 `triggers.service.ts:190-204`,`:585` | `mockQb()` fixture 최소 1건에 두 비밀 컬럼을 채우고 `result.data` 에서 부재를 단언하는 케이스 추가 |
| 3 | Documentation | `/** 트리거 응답 DTO */` JSDoc 이 신설된 `TriggerWorkflowRefDto` 클래스 앞으로 밀려나 `TriggerDto` 는 현재 문서 주석이 전혀 없다 — 이 세션에서 4번째로 재발한 "새 선언을 기존 JSDoc 과 대상 사이에 끼워 넣는" 패턴 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:7-28` | `/** 트리거 응답 DTO */` 를 `export class TriggerDto {`(28행) 바로 위로 이동 (`TriggerWorkflowRefDto` 는 이미 자체 JSDoc 보유) |
| 4 | API Contract | `GET/POST/PATCH /api/schedules(/:id)` 응답의 `trigger` 필드가 버전 신호 없이 엔티티 전체(비밀 포함)→참조 4필드로 축소되는 breaking change. 보안 근거는 타당하고 FE 소비처 실측·CHANGELOG·e2e 로 뒷받침되지만, FE 저장소 밖 소비자(웹훅/서드파티/모바일)가 있었다면 무통보로 깨진다 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()`(~67-84행) | 코드 조치 불요(이미 팀 결정·문서화). 향후 유사 breaking change 는 API 계약 SoT(`spec/5-system/2-api-convention.md`)에도 이력을 남기는 관례 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | Security / Maintainability | 비밀 컬럼 방어가 수기 deny-list 3벌(strip 목록)에 의존 — fail-open 성격이고 같은 PR 리뷰 이력에서 근접 실패가 반복됐다(팀이 `@Sensitive()` 류 승격을 조건부로 이미 문서화) | `triggers.service.ts:53,74,94`(3개 상수), `sanitizeForResponse`(585-656) | 다음 비밀 컬럼 추가 시 전수 대조 정적 가드 또는 `@Sensitive()` 데코레이터 전환 검토 |
| 6 | Security / API Contract | `IntegrationDto.consecutiveNetworkFailures`(내부 health 카운터, FE 참조 0곳)가 공개 응답에 정식 선언됨 | `integration-response.dto.ts:160-161` | 조치 불요 — plan 트래커에 별도 wire 변경 항목으로 이미 등재 |
| 7 | Security / API Contract | `response-contract.ts` 신규 `allowMissing` 옵션(test-only)이 `ExportWorkflowDto.formatVersion` 계약 대조를 완화 — spec 의 기존 Planned 갭을 근거로 좁게 사용됨 | `response-contract.ts:95-113,247-248`, 사용처 `workflow-crud.e2e-spec.ts:436-440` | 조치 불요. 사용처가 늘면 "spec Planned 갭 참조 필수" 관례를 정적 검사로 승격 검토 |
| 8 | Scope / Maintainability | `CHANGELOG.md` 신규 섹션 끝에 빈 줄이 2연속(다른 섹션 경계는 1개) | `CHANGELOG.md:79-81` | 빈 줄 하나 제거 |
| 9 | Scope | `workflow-crud.e2e-spec.ts` 에서 같은 모듈의 두 타입을 별도 import 문 2줄로 선언 (4라운드째 이월, 조치 불요 처분 유지) | `workflow-crud.e2e-spec.ts:13-14` | 조치 불요 |
| 10 | Scope | 누적 diff 가 세 갈래 "왜"(secret 유출 차단·DTO 선언 보정·검증 인프라 확장)를 한 PR 에 담음 — CHANGELOG/plan 서술이 일관돼 은닉된 확장은 아님 | `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요. PR 제목·본문에 상위 과제명 명시(이미 처분됨) |
| 11 | Side Effect | `contractForDto()` 가 module-level 가변 `Map`(`contractCache`) 도입 — 테스트 전용, 현재 읽기 전용 소비뿐이나 향후 변형 코드 추가 시 파일 내 다른 테스트로 오염이 샐 수 있음 | `response-contract.ts` `contractCache`/`contractForDto` | 반환 `DtoContract`/`schema` 를 `Object.freeze` 하거나 JSDoc 에 "변형 금지" 명시 검토 |
| 12 | Side Effect | `sanitizeForResponse()` 조기 return 제거로 정화할 것 없는 트리거도 항상 새 객체 참조 반환(호출부는 참조 동일성 전제 금지, 이미 JSDoc 명시) | `triggers.service.ts` `sanitizeForResponse()` | 조치 불요 — 문서화 충분, 실제 호출부 영향 없음 확인 |
| 13 | Documentation / Maintainability | `SchedulesController.toResponse()` 지역 변수명 `t` 가 축약형으로 남음 (3라운드째 이월, "사소함" 으로 유예됨) | `schedules.controller.ts:68,78-81` | 여유 있을 때 `t`→`trigger` (비차단) |
| 14 | Documentation / Maintainability | "이미 응답에 실려 나가고 있었다…" 배경 설명 주석이 4개 DTO 파일에 거의 그대로 반복 | `alert-rule-response.dto.ts`, `integration-response.dto.ts`, `knowledge-base-response.dto.ts`, `trigger-response.dto.ts` | 조치 불요. 서사 정정 필요 시 4곳 grep 으로 동기화 |
| 15 | Testing | `schedules.controller.spec.ts` 의 `update` 테스트가 비밀 컬럼을 채운 `scheduleWithSecretTrigger()` mock 을 준비해 두고도 반환값(`trigger` 형태)을 단언하지 않음 — 같은 파일 `create` 테스트와 비대칭 | `schedules.controller.spec.ts:81-88` (대비 `:59-79`) | `update` 테스트에도 `create` 와 동일한 3종 단언(키 목록·비밀 2건 부재) 추가 또는 생략 사유 주석 |
| 16 | Maintainability | `sanitizeForResponse()` 가 4개의 서로 다른 책임(chatChannel strip/notification signing strip/workflow narrowing/entity column strip)을 한 private 메서드에서 처리 — 팀이 이미 순수 함수 추출을 의도적으로 보류(검증 수단은 안 바뀌면서 diff 만 넓힌다는 근거) | `triggers.service.ts` `sanitizeForResponse` 전체(~100줄) | 이번 PR 범위 조치 불요. 네 번째 비밀 축 추가 시 소함수 분리 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | secret 유출 2경로 수정 확인, deny-list 구조적 관찰(INFO) |
| requirement | NONE | 신규 Critical/Warning 없음 — 5차 실측 재검증 전부 일치 |
| scope | NONE | 범위 위반 없음, CHANGELOG 빈 줄·import 분리 등 INFO만 |
| side_effect | LOW | 신규 전역 상태(테스트 캐시) 1건, breaking change 는 문서화됨 |
| maintainability | LOW | 이월된 INFO 다수, 신규 결함은 CHANGELOG 빈 줄뿐 |
| testing | MEDIUM | unit 커버리지 갭 2건(PATCH undefined 방지, findAll secret strip) — e2e 만 방어 |
| documentation | LOW | `TriggerDto` JSDoc 오귀속 신규 발견(WARNING) |
| api_contract | LOW | schedules trigger 축소 breaking change(WARNING, 이미 근거 문서화) |
| user_guide_sync | NONE | frontend/channel-web-chat 변경 0건, 문서 동반 갱신 대상 없음 |

## 발견 없는 에이전트

requirement, scope, user_guide_sync — 실질 발견 없음("해당 없음"/"문제 없음"으로 명시 처분).

## 권장 조치사항
1. `triggers.service.spec.ts` 의 `update` 관련 describe 에 필드 생략 PATCH → 기존 값 보존 단언 unit 케이스 추가 (WARNING #1).
2. `triggers.service.spec.ts` 의 `findAll` fixture 에 비밀 컬럼을 채운 뒤 strip 여부를 단언하는 unit 케이스 추가 (WARNING #2).
3. `trigger-response.dto.ts` 의 `/** 트리거 응답 DTO */` JSDoc 을 `TriggerDto` 클래스 바로 위로 이동 (WARNING #3).
4. (선택) 향후 유사 breaking response-shape 변경 시 API 계약 SoT 문서에도 이력 기록하는 관례 검토 (WARNING #4).
5. 나머지 INFO 항목은 대부분 여러 라운드에 걸쳐 이미 트리아지·이월 처분된 사소한 항목이므로 즉시 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(프롬프트에 개별 사유 미제공) |
  | architecture | 라우터 판단(프롬프트에 개별 사유 미제공) |
  | dependency | 라우터 판단(프롬프트에 개별 사유 미제공) |
  | database | 라우터 판단(프롬프트에 개별 사유 미제공) |
  | concurrency | 라우터 판단(프롬프트에 개별 사유 미제공) |