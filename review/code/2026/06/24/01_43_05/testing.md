# Testing Review — C-2 클러스터5 chat-channel↔triggers forwardRef 순환 해소

## 발견사항

### **[WARNING]** `rotateBotToken` 에 `@Roles('editor')` 미적용 — 테스트에서 미검증
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` line 226, `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`
- 상세: 같은 파일의 다른 민감 endpoints (`rotateNotificationSecret` line 171, `revokePerTriggerToken` line 194, `create` line 84 등) 는 모두 `@Roles('editor')` 가 선언되어 있다. 그러나 이전된 `rotateBotToken` (line 226) 에는 `@Roles` 데코레이터가 없다. `triggers.controller.spec.ts` 도 이를 검증하지 않는다. 원본 `ChatChannelController.rotateBotToken` 도 `@Roles` 가 없었으므로 verbatim 이전 결과이나, 이전 시점에 보안 속성이 동등한지 검증하는 테스트가 없다. viewer 권한 사용자가 bot token 회전 가능한지 여부가 테스트·설계 모두에서 미확인이다.
- 제안: `triggers.controller.spec.ts` 에 `getMetadata(Roles, TriggersController.prototype.rotateBotToken)` 등으로 `@Roles('editor')` 가 선언됐음을 assertion 하거나, 실제 적용 의도가 "auth guard 만"이면 spec 주석에 명시 + 테스트에 의도 확인 케이스 추가.

### **[INFO]** `newBotToken` 빈 문자열(`''`) 엣지 케이스 미테스트
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`
- 상세: 현재 validation 로직 `!body?.newBotToken || typeof body?.newBotToken !== 'string'` 에서 `''` (빈 문자열) 은 falsy 이므로 `BadRequestException` 이 발생하나, 이 동작을 명시적으로 검증하는 케이스가 없다. 다른 엣지(미전달, 비문자열)는 커버됨.
- 제안: `{ newBotToken: '' }` 케이스를 추가하면 validation 의도를 완전히 문서화할 수 있다.

### **[INFO]** `rotateBotToken` 에 `@Param('id')` 에 `ParseUUIDPipe` 미적용 — 테스트에서도 비UUID 입력 케이스 없음
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` line 234, `triggers.controller.spec.ts`
- 상세: 같은 파일의 다른 endpoints (`findOne`, `update`, `remove`, `rotateNotificationSecret`, `revokePerTriggerToken`) 는 `@Param('id', ParseUUIDPipe)` 를 사용한다. 이전된 `rotateBotToken` 은 `@Param('id')` 만 사용해 형식 검증이 없다. 원본 `ChatChannelController` 도 동일했으므로 verbatim 이전 결과이나, 테스트에서도 non-UUID `triggerId` 를 주면 어떻게 처리되는지 미검증이다. 서비스 레이어에서 DB 조회 실패(404)로 자연스럽게 처리될 수 있어 INFO 수준이나, 일관성 결여와 테스트 커버리지 공백이 공존한다.
- 제안: 다음 리팩터 시 `ParseUUIDPipe` 추가와 함께 테스트에 malformed-id 케이스 보강.

### **[INFO]** `ChatChannelTokenRotatorService.process` 위임 테스트가 `cleaned > 0` 분기 로직을 검증하지 않음
- 위치: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.spec.ts` line 615-623
- 상세: `process` 케이스는 `cleanupRotatedChatChannelTokens` 호출 여부만 확인(`cleaned: 0`). `cleaned > 0` 일 때의 logger.log 호출(비즈니스 로깅)은 `handleHourly` 케이스(line 625-631)가 별도 커버하므로 사실상 중복이다. 단, `process` → `handleHourly` 위임이 명확히 성립하는지 (`process` 가 `handleHourly` 를 내부 호출하는지) 를 검증하는 테스트는 spy 없이 side-effect 만으로 간접 증명하고 있다. 격리도는 충분하고 큰 문제는 아니다.
- 제안: 필요 시 `jest.spyOn(svc, 'handleHourly')` 로 `process` → `handleHourly` 위임을 직접 검증하는 케이스 추가.

### **[INFO]** `impl-anchor-existence.test.ts` 의 canonical 앵커 테스트가 파일 실존 확인을 런타임 파일시스템에 의존
- 위치: `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts` line 1874-1893
- 상세: `fs.existsSync(abs)` 로 `triggers.controller.ts` 실존 확인 — 파일 이동 리팩터 후 앵커 경로가 갱신됐으므로 이전과 동일한 수준의 안전성을 유지한다. 올바르게 갱신됨. 다만 `repoRoot()` 구현이 `__dirname` 기반이라 CI 환경에서 working directory 위치에 따라 결과가 달라질 가능성이 있으나, 이는 기존 테스트 방식 그대로이므로 이번 변경의 새 위험은 아니다.
- 제안: 특이사항 없음. 현행 유지.

---

## 요약

이번 변경은 기존 `ChatChannelController`(파일 삭제)·`ChatChannelTokenRotatorService`(모듈 이전)에 대한 테스트를 `triggers/` 하위로 이전·신설하고, spec/앵커 경로를 정합적으로 갱신했다. 신설된 `triggers.controller.spec.ts` 는 4개 케이스(정상·미전달·비문자열·서비스 throw)로 핵심 경로를 커버하고, `chat-channel-token-rotator.service.spec.ts` 는 scheduler 등록·실패 전파·위임·swallow 패턴을 포함해 6개 케이스로 충분히 검증한다. `impl-anchor-existence.test.ts` 앵커 경로 갱신과 `system-status.e2e-spec.ts` 큐 목록 유지도 정확하다. 주요 미비는 이전된 `rotateBotToken` 에 `@Roles('editor')` 가 누락됐음을 테스트가 검증하지 않는다는 점으로, 동일 컨트롤러 내 다른 mutation endpoints 과 대비되는 보안 속성 일관성 결여가 테스트 레이어에서도 확인되지 않은 채 이전됐다.

## 위험도

LOW

---

STATUS: SUCCESS
