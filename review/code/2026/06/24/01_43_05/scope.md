# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `chat-channel.module.ts` — `controllers: []` 빈 배열 명시적 잔류
- 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.module.ts` 파일 전체 컨텍스트 라인 265
- 상세: `ChatChannelController` 삭제 후 `controllers: []` 가 명시적으로 남아 있다. NestJS `@Module`에서 `controllers` 프로퍼티 자체를 생략해도 동일하게 동작한다. 기능 영향 없음.
- 제안: 허용 범위. `controllers: []` 명시는 의도적인 "이 모듈에 컨트롤러가 없음" 선언으로 해석 가능하며, 삭제해도 되지만 굳이 추가 변경을 넣을 이유는 없다.

### [INFO] `triggers.controller.ts` — `rotateBotToken` 에 `@Roles('editor')` 데코레이터 미부착
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` 추가 메서드 (`@Post(':id/chat-channel/rotate-bot-token')`)
- 상세: 같은 파일의 `rotateNotificationSecret`·`revokePerTriggerToken` 메서드는 모두 `@Roles('editor')`가 있다. 이전된 `rotateBotToken` 에는 해당 데코레이터가 없다. 이전 원본(`chat-channel.controller.ts`)에도 `@Roles` 없이 `@ApiTags('Triggers')`+`@Controller('triggers')`만 있었으므로 **verbatim 이전**이지, 이번 커밋이 새로 누락시킨 것은 아니다. 그러나 범위 관점에서 "이전 전/후 동작 동일 유지(behavior-preserving)" 의도에 부합하므로 스코프 일탈은 없다. 별도 보안 관점 리뷰에서 다룰 사항.
- 제안: 이번 스코프 변경에서는 INFO 수준 참고. 권한 적정성은 security 리뷰어가 판단.

### [INFO] `spec/5-system/15-chat-channel.md` — 에러 표 링크 행 포맷 변경
- 위치: diff 라인 `spec/5-system/15-chat-channel.md` 라인 `|400|INVALID_BOT_TOKEN|…`
- 상세: 원래 라인에는 `chat-channel.controller.ts:52` 라인 번호 앵커가 포함되어 있었다. 신규 라인은 라인 번호 없이 `triggers.controller.ts` 파일 링크만 + `rotateBotToken` 텍스트를 추가했다. 라인 번호 제거는 이전 후 위치 변경에 따른 자연스러운 정리이며 의미 변경 없음.
- 제안: 허용 범위.

## 요약

이번 변경은 `chat-channel↔triggers` 양방향 forwardRef 순환을 해소하기 위해 ① `ChatChannelController.rotateBotToken` 엔드포인트를 `TriggersController`로 이전(route 무변), ② `ChatChannelTokenRotatorService`와 관련 큐·상수·테스트를 `triggers/` 디렉터리로 이전, ③ 양 모듈의 forwardRef 제거 및 단방향화, ④ `system-status.constants.ts` 임포트 경로 갱신, ⑤ 이동으로 인한 spec·앵커·plan 문서의 기계적 경로 동기화로 구성된다. 검토 대상 14개 파일 모두 위 다섯 가지 이전·정리 작업과 직접 연결된다. 불필요한 리팩토링, 관련 없는 파일 수정, 의미 없는 포맷팅 변경, 과잉 기능 추가는 발견되지 않았다. INFO 3건은 모두 이전 원본의 상태를 그대로 유지하거나 경로 이동에 필수적인 최소 변경이며 범위 일탈에 해당하지 않는다.

## 위험도

NONE
