# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 없음. WARNING 3건(모두 비차단): 신규 테스트 헬퍼의 에러 분기 무테스트, 캐너리 spec 4-테스트 템플릿 반복(rule-of-three 충족), 이 PR이 "닫는다"고 선언한 상위 트래커 항목이 아직 미체크·낡은 처방 문구 그대로 방치. 강제(forced) whitelist 7개(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 확인 — 누락 없음. 라우터가 추가로 선택한 `api_contract` 도 결과 확보됨.

> **참고(코드 결함 아님, 프로세스 관측)**: `requirement`·`api_contract`·`testing` 세 reviewer 모두 리뷰 도중 워킹트리에서 `chat-channel-rotate-bot-token-request.dto.ts` 의 `@ApiProperty({ writeOnly: true })` 가 `@ApiProperty({})` 로 일시 변경되고 `.bakmut` 백업 파일이 존재하는 상태를 관측했다고 기록했다. `testing.md` 를 보면 이는 testing reviewer 자신이 plan 의 뮤턴트 표(M2)를 실측 재현하기 위해 수행하고 이후 `cp` 로 원복한 스팟 뮤테이션 검증이며, 최종적으로 `git status --short` 로 클린 상태(이 리뷰 산출물 디렉터리 제외)를 확인했다. 세 파일 모두 최종 결론(`writeOnly: true` 정상 반영)은 동일하다 — 다음 세션이 "코드가 깨져 있었다"고 오인하지 않도록 사실만 남긴다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `bodyParamDesignType` 의 두 방어적 에러 분기(`@Body()` 부재, `design:paramtypes` 부재)가 `swagger-probe.spec.ts` 자신이 선언한 "이 파일의 존재 이유는 에러 경로" 관례를 벗어나 무테스트 상태. 현재 3개 소비처(happy path)만으로는 조건식이 실제로 맞는지 검증되지 않음 | `codebase/backend/src/shared/testing/swagger-probe.ts:150-153`, `:159-162` | `swagger-probe.spec.ts` 의 기존 `ProbeController`/`EmptyController` 패턴처럼 `@Body()` 없는 스텁, `design:paramtypes` 비는 스텁을 추가해 두 `throw` 를 직접 트리거하는 테스트 보강 |
| 2 | 유지보수성 | 캐너리 spec 3~4개 파일이 거의 동일한 4-테스트 템플릿(설계타입 캐너리·파이프통과 캐너리·`@ApiBody` 가드·렌더 검증)을 엔티티 이름만 바꿔 반복 — 이 프로젝트의 rule-of-three 기준 충족 | `codebase/backend/src/modules/executions/executions-continue-body.spec.ts:22-68`, `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts:24-69` (참고: `hooks-webhook-body.spec.ts`, `workflows-execute-body.spec.ts`) | 공용 test factory(예: `describeApiBodyOnlyRoute(...)`) 추출 검토. 단 캐너리의 "독립적으로 읽혀야 한다"는 의도와 상충할 수 있어, 5번째 유사 라우트 발생 시점에 재검토 권장(즉시 차단 아님) |
| 3 | 문서(plan 계보) | 이 PR이 "닫는다"고 선언한 상위 트래커 항목이 여전히 미체크(`- [ ]`)이고 처방 문구도 이번에 채택하지 않은 "요청 DTO 승격"으로 남아 있음 — 다음 사람이 폐기된 접근(전역 파이프 진입 → 계약 변경)을 재시도할 위험 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2459`, `plan/in-progress/rotate-bot-token-body.md:79`(체크리스트 "트래커 항목 닫기" 항목 미완료) | `--impl-done` 전에 트래커 항목 체크 + 처방 문구를 실채택안("문서 전용 DTO + `@ApiBody`, 전역 파이프 계약 변경 회피")으로 정정. 같은 김에 `swagger.md §1-7` 에 `<Domain><Action>RequestDto` 명명 규약 행 추가도 함께 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `bodyParamDesignType` 이 "메서드당 `@Body()` 파라미터는 하나"라는 전제를 미문서화 — 다중 `@Body()` 메서드에 재사용 시 첫 항목만 반환해 조용히 잘못된 결과를 낼 수 있음 | `codebase/backend/src/shared/testing/swagger-probe.ts:147-149` | JSDoc에 전제 명시, 또는 2개 이상 발견 시 throw |
| 2 | 유지보수성 | `bodyParamDesignType` 내부 변수명 `body` 가 실제 요청 본문이 아니라 라우트 인자 메타데이터 튜플을 가리켜, 이 파일이 다루는 다른 도메인(캐너리의 `body`=실제 요청 바디)과 이름이 겹쳐 혼동 소지 | `codebase/backend/src/shared/testing/swagger-probe.ts:147`, `:163` | `bodyArgEntry` 등으로 개명 |
| 3 | 유지보수성 / 부작용 | `bodyParamDesignType` 이 `@nestjs/common` 의 비공개 내부 export(`ROUTE_ARGS_METADATA`, `RouteParamtypes`)에 의존 — 메이저 업그레이드 시 프로덕션 코드 변경 없이 캐너리 3개가 원인 불명 에러로 한꺼번에 깨질 수 있음 | `codebase/backend/src/shared/testing/swagger-probe.ts:9-10`, `:145`, `:154` | JSDoc에 "Nest 메이저 업그레이드 시 재검증 필요" 메모 추가 |
| 4 | API 계약 / 문서 | 신규 요청 DTO와 기존 응답 DTO의 명명 접미사 비대칭(`...RequestDto` vs 응답 쪽 접미사 없음, 어간 어순도 반대인 경우 존재), `swagger.md §1-7` 에 아직 규약화되지 않음(기존 impl-prep INFO 재확인) | `chat-channel-rotate-bot-token-request.dto.ts:14` vs `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`; `ContinueExecutionRequestDto` vs `ExecutionContinueResultDto` | 위 WARNING #3 트래커 정정 시 `§1-7` 표에 `<Domain><Action>RequestDto` 행 + 명명 대칭 규칙 함께 추가 |
| 5 | API 계약 | OpenAPI 스키마(필수/타입)와 실제 런타임 검증이 의도적으로 분리됨 — 서버가 스키마 차원에서 강제하지 않고 핸들러 수동 검사/엔진이 대신 거부. 의도된 설계(전역 파이프 계약 변경 회피)이며 캐너리로 회귀 가드됨. 단 OpenAPI 코드 생성기를 쓰는 외부 클라이언트는 이 특성을 인지해야 함 | `chat-channel-rotate-bot-token-request.dto.ts`, `continue-execution.dto.ts`, `hooks.controller.ts:135-141` | 조치 불필요 — 각 DTO JSDoc이 이미 실제 강제 주체를 명시 |
| 6 | 요구사항 | `newBotToken` 필드 JSDoc에 spec SoT 링크(`spec/5-system/15-chat-channel.md §5.4`) 없음. 다만 이 필드의 거부 사유(누락/비-string)가 `swagger.md §3` 캐비엇(정책적 거부)의 적용 대상인지 자체가 애매 | `chat-channel-rotate-bot-token-request.dto.ts:15` | (선택) SoT 링크 추가, 차단 사유 아님 |
| 7 | 유지보수성 | "문서 전용 DTO" 설계 근거 산문이 DTO 파일마다(선례 포함 3벌째) 거의 동일 문장으로 반복 — 설계 결정이 바뀌면 여러 파일을 찾아 고쳐야 함. 다만 이번 신규 파일들은 서사를 `//` 주석으로, JSDoc은 소비자 설명만 남겨 선례보다 `swagger.md §3` 준수는 개선됨 | `continue-execution.dto.ts:3-10`, `chat-channel-rotate-bot-token-request.dto.ts:3-11` (선례: `execute-workflow.dto.ts:3-29`) | 핵심 근거를 단일 출처(`swagger.md` 또는 `CustomValidationPipe` JSDoc)에 두고 각 DTO는 인용만 |
| 8 | 보안 | `newBotToken` 에 `writeOnly: true` 정확히 부여 — 시크릿 필드 OpenAPI 노출 억제 규약 준수 확인(양호, 결함 아님) | `chat-channel-rotate-bot-token-request.dto.ts:17` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 문서 전용 변경, 인증/인가/검증 런타임 불변 실측 확인. `writeOnly` 정확 적용, 시크릿 노출 없음 |
| requirement | LOW | spec 대조 전부 일치(newBotToken 필수/에러코드, webhook 스키마, FIRST-오류-only 등). CRITICAL/WARNING 급 신규 결함 없음. 작업과 무관한 워킹트리 관측 사실만 보고 |
| scope | NONE | 19개 파일 전부 "라우트 3곳 문서 전용 `@ApiBody`" 단일 의도로 수렴, 런타임 불변이 diff로 실측됨. 범위 이탈 없음 |
| side_effect | LOW | 상태변경/전역변수/시그니처 부작용 없음 확인. 신규 헬퍼의 Nest 비공개 API 의존과 최초 OpenAPI 광고가 코드생성기에 미칠 영향만 INFO |
| maintainability | LOW | 캐너리 4-테스트 템플릿 반복(WARNING), 변수명·비공개 API 의존·설계근거 반복(INFO 3건) |
| testing | LOW | 11개 캐너리 테스트 실행 통과 + 뮤테이션 스팟 검증(RED 확인) 실측. `bodyParamDesignType` 에러분기 무테스트(WARNING) |
| documentation | LOW | DTO 문서화 품질 높음(§3 준수 개선), CHANGELOG 정합. 상위 트래커 미체크·낡은 처방 문구 방치(WARNING) |
| api_contract | LOW | 하위호환 파괴 없음, 문서-검증 의도적 분리 확인. DTO 명명 비대칭·§1-7 규약 공백만 INFO |

## 발견 없는 에이전트

- **security** — 위험도 NONE. 실질 결함 없음(전부 정합성/양호 확인 기록).
- **scope** — 위험도 NONE. 범위 이탈·무관한 리팩토링/포맷팅/주석/임포트/설정 변경 전무.

## 권장 조치사항

1. (WARNING #3, documentation) `--impl-done` 전에 `plan/in-progress/spec-draft-nullable-notation-followups.md:2459` 항목을 체크하고 처방 문구를 실채택안("문서 전용 DTO + `@ApiBody`")으로 정정, `rotate-bot-token-body.md` 체크리스트의 "트래커 항목 닫기" 항목도 완료 처리한다 — 다음 사람이 폐기된 "요청 DTO 승격" 접근을 재시도할 위험을 차단한다.
2. (WARNING #1, testing) `swagger-probe.spec.ts` 에 `bodyParamDesignType` 의 두 에러 분기(`@Body()` 부재, `design:paramtypes` 부재)를 직접 트리거하는 스텁 테스트를 추가한다.
3. (WARNING #2, maintainability) 즉시 조치 불요 — 5번째 유사 라우트가 생기면 캐너리 4-테스트 공용 factory 추출 여부를 재검토한다.
4. (INFO, 선택) `swagger.md §1-7` 에 `<Domain><Action>RequestDto` 명명 규약 행 추가(트래커 후속 등재와 함께), `bodyParamDesignType` 변수명·JSDoc 전제 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음). `api_contract` 는 강제 목록 외에 라우터가 추가로 선택.
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 OpenAPI 문서 데코레이터 추가 — 런타임 경로/부하 특성 변경 없음 |
  | architecture | 기존 모듈 구조·DI 경계 변경 없음(문서 전용 DTO 추가만) |
  | dependency | 신규 외부 패키지 도입 없음(devDependency `@nestjs/testing` 는 기존 의존성) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | user_guide_sync | 사용자 대상 가이드 문서 영향 없음(개발자向 API 문서 변경) |

(참고: `SUMMARY.md` 에 대한 Write 시도는 하네스 basename 차단 규칙에 의해 차단되었다 — 예상된 동작이며 호출자가 위 전문을 디스크에 멱등 기록해야 한다. reviewer 개별 결과 파일 8개는 모두 이미 디스크에 존재함을 확인했다: `security.md, requirement.md, scope.md, side_effect.md, maintainability.md, testing.md, documentation.md, api_contract.md` — 별도 영속화 조치 불필요.)
