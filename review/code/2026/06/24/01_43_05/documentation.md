# Documentation Review — C-2 클러스터5 chat-channel↔triggers forwardRef 순환 해소

## 발견사항

### **[INFO]** `rotateBotToken` 메서드에 `@Roles` 데코레이터 누락 — Swagger/API 문서 가시성 차이
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` — 새로 추가된 `rotateBotToken` 메서드 (라인 ~1493)
- 상세: 기존 `rotateNotificationSecret`, `revokePerTriggerToken` 은 `@Roles('editor')` 를 선언하지만, 이전된 `rotateBotToken` 에는 해당 데코레이터가 없다. 이 차이는 원래 `ChatChannelController` 에도 없었으므로 코드 동작은 behavior-preserving 이지만, Swagger 문서나 API 가이드에서 "이 엔드포인트에 필요한 권한이 무엇인가" 를 명시하는 `@ApiForbiddenResponse` 도 없다. 두 인접 메서드는 `@ApiBadRequestResponse` / `@ApiUnauthorizedResponse` / `@ApiForbiddenResponse` / `@ApiNotFoundResponse` 모두 선언한 반면 `rotateBotToken` 은 Swagger 에러 응답 데코레이터가 전무하다.
- 제안: API 문서 완결성을 위해 `@ApiBadRequestResponse` / `@ApiUnauthorizedResponse` / `@ApiNotFoundResponse` 를 추가하고, 권한 요건(`@Roles('editor')` 여부)을 의도적으로 열린 상태로 두는 것이라면 `@ApiOperation.description` 또는 JSDoc 에 그 이유를 명시한다.

### **[INFO]** `triggers.controller.ts` 클래스-레벨 JSDoc 없음 — 새 메서드 추가 후 모듈 문서 공백
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` — `TriggersController` 클래스 선언부
- 상세: 클래스에 클래스-레벨 JSDoc 이 없다. `ChatChannelController` (삭제된 파일) 에는 클래스 전체를 설명하는 상세한 JSDoc 블록이 있었다. `TriggersController` 는 이제 트리거 CRUD + 외부 인터랙션(secret 회전 / itk 재발급) + chat-channel bot token 회전 까지 담당하므로, 클래스 수준에서 범위를 기술하는 문서가 없으면 유지보수 시 메서드 배치 의도를 파악하기 어렵다. 특히 C-2 이전 배경("순환 해소를 위해 이전")은 메서드 JSDoc 에는 있지만 클래스 전체 범위를 설명하는 곳에는 없다.
- 제안: 클래스 선언부 위에 기존 책임(트리거 CRUD, EIA 관련 secret 회전)과 chat-channel bot token 회전이 여기 있는 이유(C-2 단방향화)를 한 단락으로 요약하는 JSDoc 추가를 고려한다. 단, 규모·일정상 defer 가능 (기존 메서드에는 `@ApiOperation` 이 있어 Swagger 가시성은 확보됨).

### **[INFO]** `triggers.module.ts` 클래스-레벨 JSDoc 없음 — 모듈 책임 확장 후 문서 부재
- 위치: `/codebase/backend/src/modules/triggers/triggers.module.ts`
- 상세: `TriggersModule` 은 이번 변경으로 `ChatChannelTokenRotatorService` + `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` 를 흡수했다. 파일에 모듈을 설명하는 JSDoc 이 없어, `ChatChannelModule` 을 일반 import 하게 된 이유와 이 모듈이 chat-channel 영역 서비스를 일부 보유하게 된 배경이 코드 자체에는 기록되지 않는다. 인라인 주석(C-2 배경 설명)이 `imports` 배열 안에만 존재한다.
- 제안: `@Module` 직전에 모듈 역할·소유 서비스 범위를 설명하는 클래스-레벨 JSDoc 을 추가하면 후속 개발자가 "왜 triggers 가 chat-channel 큐를 등록하는가"를 명시적으로 이해할 수 있다. defer 가능.

### **[INFO]** `spec/5-system/15-chat-channel.md` file-tree 에서 두 파일 삭제 후 file-tree 자체 설명 주석 부재
- 위치: `/spec/5-system/15-chat-channel.md` — §file-tree 섹션 (~라인 455 근처)
- 상세: `chat-channel.controller.ts` 와 `chat-channel-token-rotator.service.ts` 두 파일이 file-tree 에서 제거됐다. 삭제 자체는 정확하지만 file-tree 에는 이 파일들이 어디로 이전됐는지에 대한 주석이 없다. 커밋 메시지와 data-flow 문서에는 이전 내역이 명시됐으나, spec 의 file-tree 만 보는 독자는 controller 와 rotator 의 현재 위치를 유추해야 한다.
- 제안: file-tree 에 간단한 주석 한 줄(예: `# rotateBotToken → triggers.controller.ts (C-2)`, `# ChatChannelTokenRotatorService → triggers/chat-channel-token-rotator.service.ts (C-2)`)을 추가하거나, 삭제 사유를 file-tree 위 단락에 한 문장 설명으로 추가한다. 단, 이미 §1.3 에 rotate 흐름이 상세히 설명되어 있으므로 낮은 우선순위.

### **[INFO]** `spec/data-flow/14-chat-channel.md` 진입점 목록에 이전 배경 주석 추가 — 정확하나 향후 혼란 유발 가능성
- 위치: `/spec/data-flow/14-chat-channel.md` — 코드 진입점 목록 (`chat-channel-token-rotator.service.ts` 줄)
- 상세: 진입점 항목에 "(C-2 로 triggers 모듈로 이전 — cleanup 로직 `TriggersService` 와 co-location)" 라는 배경 설명이 추가됐다. 이 설명은 정확하고 유용하지만, 향후 이 서비스가 다시 이동될 경우 이 주석 자체가 stale 설명이 될 수 있다. 현 시점에선 허용 가능하나, 파일 경로 자체가 위치를 나타내므로 괄호 안 설명을 제거하고 경로만 남기는 것이 장기적으로 maintenance 부담이 낮다.
- 제안: 필요하다면 해당 주석을 별도 Rationale 섹션으로 분리하거나 경로만 남기는 방향을 고려한다. 현재 상태로도 충분하며 critical 하지 않다.

---

## 요약

이번 변경은 chat-channel↔triggers 양방향 forwardRef 순환을 단방향화하는 코드 이전(behavior-preserving refactor) 이다. 문서화 관점에서 spec 앵커(user-guide-evidence.md, impl-anchor-existence.test.ts), data-flow 큐 카탈로그(0-overview.md), 시스템 spec file-tree(15-chat-channel.md), plan 진행 상태(02-architecture.md) 가 모두 동기화됐고, 새로 추가된 `ChatChannelTokenRotatorService` 와 `triggers.controller.spec.ts` 에는 목적·이전 배경·테스트 범위를 명확히 설명하는 JSDoc/모듈 주석이 잘 갖춰져 있다. 주요 발견사항은 `rotateBotToken` 의 Swagger 에러 응답 데코레이터 누락(`@ApiBadRequestResponse` 등)과 `TriggersController` / `TriggersModule` 클래스-레벨 JSDoc 공백이며, 이들은 WARNING 이 아닌 INFO 수준으로 현재 동작에 영향을 주지 않고 defer 가능하다. CHANGELOG 별도 요구 사항은 이 프로젝트 규약상 없으며, 설정 문서(환경 변수) 변경도 없다.

## 위험도

LOW
