# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩터링으로 신규 버그·breaking change 없음. `rotateBotToken` 의 `@Roles('editor')` 누락 및 `ParseUUIDPipe` 미적용이 반복적으로 지적되나 모두 pre-existing(원본 ChatChannelController 에서 verbatim 이전)이고 현재도 JWT 인증 보호는 유지됨.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Architecture / Requirement / Testing / Maintainability | `rotateBotToken` 에 `@Roles('editor')` 가드 누락 — 동일 컨트롤러 내 `rotateNotificationSecret`, `revokePerTriggerToken` 은 모두 적용. bot token 은 민감 자격증명이므로 viewer 도 호출 가능한 현 상태는 권한 정책 불일치. pre-existing 이나 이전 시 수정 기회 존재. | `codebase/backend/src/modules/triggers/triggers.controller.ts` L1493–1516 (`rotateBotToken`) | `@Roles('editor')` 추가. 의도적으로 열어두는 경우 JSDoc에 근거 명시 + spec에 반영. |
| 2 | Requirement / Maintainability / API Contract | `rotateBotToken` 의 `@Param('id')` 에 `ParseUUIDPipe` 미적용 — 동일 컨트롤러의 모든 다른 엔드포인트는 `ParseUUIDPipe` 사용. 비UUID 값이 서비스 레이어까지 전달되고, 파라미터 변수명도 `triggerId`(다른 메서드는 `id`)로 불일치. pre-existing(원본 ChatChannelController 동일). | `codebase/backend/src/modules/triggers/triggers.controller.ts` L1501 `@Param('id') triggerId: string` | `@Param('id', ParseUUIDPipe) id: string` 으로 통일. |
| 3 | Maintainability | `ChatChannelTokenRotatorService` 가 `NotificationSecretRotatorService` 와 구조적으로 거의 동일(WorkerHost 확장·onModuleInit·process→handleHourly 위임·catch swallow 패턴)하나 공통 추상화 없이 복제. 현재 2종이나 세 번째 추가 시 유지보수 부담 증가. | `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 전체 (비교: `notification-secret-rotator.service.ts`) | 이번 PR 즉시 수정 불요. 백로그에 `abstract HourlyRotatorWorkerHost` 또는 공통 헬퍼 팩토리 추출 등록 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `rotateBotToken` 에 `@ApiBadRequestResponse` / `@ApiUnauthorizedResponse` / `@ApiNotFoundResponse` Swagger 데코레이터 전무 — 인접 mutation 메서드 대비 문서 불일치. pre-existing. | `triggers.controller.ts` `rotateBotToken` 핸들러 | `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiNotFoundResponse` (+ `@Roles` 추가 시 `@ApiForbiddenResponse`) 추가. |
| 2 | Security | `handleHourly` catch 블록에서 `err.message` 를 `logger.warn` 에 기록 — 서버 로그이므로 클라이언트 노출 없음. verbatim move. | `chat-channel-token-rotator.service.ts` L854–856 | 현행 유지. 필요 시 구조화 로그로 개선 가능하나 보안 결함 아님. |
| 3 | Architecture | `rotateBotToken` body 파라미터가 인라인 타입 리터럴(`{ newBotToken?: string }`) — DTO 클래스 없어 Swagger 자동 문서화·class-validator 적용 불가. pre-existing. | `triggers.controller.ts` L1503 | 별건으로 `RotateBotTokenDto` 클래스 + `@IsString()` 도입 검토. |
| 4 | Architecture | `chat-channel.module.ts` 의 `controllers: []` 빈 배열 명시 — "컨트롤러 없음" 의도 선언으로 기능 영향 없음. | `chat-channel.module.ts` L265 | 허용 범위. |
| 5 | Documentation | `TriggersController` 클래스 레벨 JSDoc 없음 — 이번 이전으로 책임이 넓어졌으나 클래스 범위 설명 부재. | `triggers.controller.ts` 클래스 선언부 | 클래스 직전에 책임 범위·C-2 이전 배경 한 단락 JSDoc 추가(defer 가능). |
| 6 | Documentation | `TriggersModule` 클래스 레벨 JSDoc 없음 — `ChatChannelTokenRotatorService` 흡수 후 "triggers 가 chat-channel 큐를 등록하는 이유" 코드 내 설명 없음. | `triggers.module.ts` 클래스 선언부 | 모듈 역할·소유 서비스 범위 JSDoc 추가(defer 가능). |
| 7 | Documentation | `spec/5-system/15-chat-channel.md` file-tree 에서 두 파일 삭제 후 이전 위치 주석 없음 — 독자가 현재 위치 유추 필요. | `spec/5-system/15-chat-channel.md` file-tree 섹션 | 간단한 주석 한 줄(`# → triggers/ C-2`) 추가 또는 생략(낮은 우선순위). |
| 8 | Testing | `newBotToken` 빈 문자열(`''`) 엣지 케이스 미테스트 — validation 로직은 올바르게 거부하나 명시적 케이스 없음. | `triggers.controller.spec.ts` | `{ newBotToken: '' }` 케이스 추가. |
| 9 | Performance | `onApplicationBootstrap` 에서 `trigger.config` JSONB 전체 적재 — 수만 건 규모 시 부팅 메모리 스파이크 가능. 이번 변경 신규 도입 아님. | `chat-channel.module.ts` `onApplicationBootstrap` | 장기적으로 스칼라 프로젝션(`SELECT config->>'chatChannel'->>'provider'`) 고려. 현재 즉시 수정 불요. |
| 10 | Concurrency | `forwardRef` 제거로 NestJS DI 초기화 순서가 결정적(deterministic)이 되어 초기화 타이밍 불확실성 해소 — 동시성 관점에서 긍정적 변경. | `triggers.module.ts`, `chat-channel.module.ts` | 이상 없음. |
| 11 | Scope | spec 앵커 동기화(user-guide-evidence.md, impl-anchor-existence.test.ts, data-flow/0-overview.md, data-flow/14-chat-channel.md, 15-chat-channel.md file-tree) 모두 코드 이동과 정합적으로 갱신됨. | 각 spec 파일 | 이상 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `rotateBotToken` @Roles 누락, ParseUUIDPipe 누락 (모두 pre-existing, INFO) |
| performance | NONE | 성능 신규 위험 없음. JSONB 전체 적재는 pre-existing. |
| architecture | LOW | @Roles 누락 WARNING, 레이어 책임 재배치는 적절 |
| requirement | LOW | @Roles 누락, ParseUUIDPipe 누락 WARNING; spec 앵커 동기화 정확 |
| scope | NONE | 범위 일탈 없음, 모든 변경이 이전·정리 작업과 직결 |
| side_effect | LOW | @Roles 미적용은 behavior-preserving. 런타임·공개 인터페이스 부작용 없음 |
| maintainability | LOW | 파라미터명 불일치, @Roles 미적용 일관성, rotator 패턴 중복 |
| testing | LOW | @Roles 미검증, 빈 문자열 케이스 미테스트 |
| documentation | LOW | Swagger 데코레이터 누락, 클래스 JSDoc 공백 (모두 defer 가능) |
| concurrency | NONE | 신규 동시성 위험 없음. forwardRef 제거로 초기화 결정성 개선 |
| api_contract | LOW | @Roles 누락, Swagger 응답 데코레이터 누락, ParseUUIDPipe 미적용 (모두 pre-existing, INFO) |
| user_guide_sync | NONE | 사용자 가이드 동반 갱신 누락 0건 |

## 발견 없는 에이전트

- **scope**: 범위 일탈 없음 (NONE)
- **performance**: 성능 신규 위험 없음 (NONE)
- **concurrency**: 동시성 신규 위험 없음 (NONE)
- **user_guide_sync**: 동반 갱신 누락 없음 (NONE)

## 권장 조치사항

1. **[Warning — 권장 수정]** `rotateBotToken` 에 `@Roles('editor')` 추가 — 동일 컨트롤러 내 모든 다른 mutation/rotation 엔드포인트와 일관성 맞춤. 또는 의도적 개방이면 JSDoc+spec에 명시.
2. **[Warning — 권장 수정]** `@Param('id', ParseUUIDPipe) id: string` 로 변경 — 변수명(`triggerId` → `id`) 과 UUID 파이프 일괄 통일.
3. **[Warning — 백로그 등록]** `HourlyRotatorWorkerHost` 공통 추상 클래스 추출 — 현재 2종 rotator 패턴 중복, 세 번째 추가 전 리팩터.
4. **[Info — defer 가능]** `rotateBotToken` 에 Swagger 에러 응답 데코레이터(`@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiNotFoundResponse`, `@ApiForbiddenResponse`) 추가.
5. **[Info — defer 가능]** `TriggersController`, `TriggersModule` 클래스 레벨 JSDoc 추가.
6. **[Info — defer 가능]** `triggers.controller.spec.ts` 에 `newBotToken: ''` 빈 문자열 케이스 추가.

## 라우터 결정

라우터가 reviewer 를 선별 실행함.

- **실행** (12명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`, `user_guide_sync`
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 선별 제외 |
  | database | 라우터 선별 제외 |

- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`