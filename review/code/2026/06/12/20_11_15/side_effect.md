# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `TriggersService.rotateBotToken` 반환 타입 확장 — 모노레포 내 다른 호출자 영향 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/triggers/triggers.service.ts` (diff L863–L551)
- 상세: `rotateBotToken`의 반환 타입이 `Promise<{ rotatedAt: string }>` 에서 `Promise<{ rotatedAt: string; triggerId: string; chatChannelHealth: TriggerChatChannelHealth; botIdentity: {...} | null }>` 로 확장되었다. TypeScript 구조적 타이핑상 기존 `{ rotatedAt }` 만 소비하는 호출자는 추가 필드를 무시하므로 런타임 파괴는 없다. 그러나 반환값을 `{ rotatedAt: string }` 타입으로 narrowly 선언한 변수나 `Pick` mock에 할당하는 곳이 있다면 컴파일 타임 오류가 발생할 수 있다. 직접 확인된 호출자인 `ChatChannelController`는 `Awaited<ReturnType<TriggersService['rotateBotToken']>>`로 반환 타입을 동기화하여 이미 해소됨. 테스트(`chat-channel.controller.spec.ts`)도 `ROTATE_RESULT` 상수로 동기화 완료.
- 제안: `grep -r 'rotateBotToken'`으로 모노레포 내 추가 호출자 유무를 확인. CI 빌드가 통과한다면 TypeScript 컴파일러가 이미 전체를 검증한 것이므로 추가 조치 불필요.

### [INFO] `ChatChannelController.rotateBotToken` 반환 타입을 `Awaited<ReturnType<...>>`으로 변경 — Swagger 스키마 자동 반영 여부
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (diff L169)
- 상세: 반환 타입을 인라인 구조체 대신 service 메서드 반환 타입에 직접 연결했다. 타입 안전성은 향상되나 NestJS Swagger 자동 생성은 TypeScript 타입을 깊이 추적하지 않으므로, `@ApiResponse`나 응답 DTO 클래스 없이는 Swagger 문서에서 이 엔드포인트의 응답 스키마가 `{}` 또는 누락될 수 있다. 런타임 부작용은 없다.
- 제안: API 문서 정확도가 요구된다면 응답 DTO 클래스 또는 `@ApiProperty` 정의를 추가. 본 변경 범위 밖이라면 후속 작업으로 처리 가능.

### [INFO] `isActiveExecution` private 메서드 삭제 → `getActiveExecutionStatus`로 교체 — 동작 동등성 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` (diff L462–L492)
- 상세: `private isActiveExecution(executionId): Promise<boolean>` 완전 삭제 후 `private getActiveExecutionStatus(executionId): Promise<ExecutionStatus | null>`로 대체됨. private 메서드이므로 클래스 외부 영향 없음. 기존 `isActiveExecution`은 조회 실패 시 `.catch(() => null)` 후 `false` 반환했으며, 신규 `getActiveExecutionStatus`도 `.catch(() => null)` 후 `null` 반환한다. `hasActiveExecution = state?.executionId != null && activeStatus !== null` 평가 결과는 기존 boolean과 동등하므로 `/cancel`, `form_submission`, 인터랙션 forwarding 분기의 기존 동작이 유지된다. DB 조회도 흐름 내 1회로 줄었다(긍정적 변화).
- 제안: 없음.

### [INFO] `sendExecutionStillRunningNotice` 신규 메서드 — 의도된 외부 네트워크 호출 + 오류 삼키기
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` (diff L500–L521)
- 상세: `running`/`pending` 상태 execution에 대해 `adapter.sendMessage`로 채널 메시지를 발송하는 신규 외부 네트워크 호출을 도입한다. 이는 spec CCH-CV-03 (b) 의도된 동작이다. 실패 시 `logger.warn`으로 swallow하여 메인 플로우가 중단되지 않는다. `maybeNotifyIgnored`와 동일한 오류 처리 패턴을 따른다. 발송 실패 후에도 `{ executionId: 'ignored' }` 반환은 spec R9와 일치.
- 제안: `adapter.sendMessage` 실패가 swallow되므로 사용자가 안내를 받지 못하는 경우를 `logger.warn` rate 모니터링으로 추적하는 것을 권장.

### [INFO] `executionsService['executionRepository']` bracket notation — 기존 패턴 계승
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` L1337 (전체 파일 기준)
- 상세: `this.executionsService['executionRepository']` 방식은 변경 이전 `isActiveExecution`에서도 동일하게 사용하던 패턴이다. 신규 도입이 아니므로 새로운 부작용은 없다. 단, `ExecutionsService` 내부 구현 변경 시(필드명 변경 등) 런타임에 `undefined` 접근이 발생할 수 있는 잠재 위험이 존재한다(기존부터의 기술 부채).
- 제안: 중장기적으로 `ExecutionsService`에 `getExecutionStatus(id): Promise<ExecutionStatus | null>` 공개 메서드 추가를 권장. 본 변경 범위 밖.

### [INFO] `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter `worktree` 값 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/plan/in-progress/spec-sync-chat-channel-gaps.md` (diff L2)
- 상세: `worktree: spec-sync-audit` → `worktree: chat-channel-gaps`. 현재 실제 worktree 이름과 정합시키는 메타데이터 수정. 파일시스템·런타임 부작용 없음.
- 제안: 없음.

---

## 요약

이번 변경에서 의도치 않은 부작용은 발견되지 않았다. 핵심 변경인 `isActiveExecution` → `getActiveExecutionStatus` 리팩토링은 private 범위 내에서 완결되며, 호출 측 boolean 의미가 동등하게 유지된다. `sendExecutionStillRunningNotice` 신규 외부 네트워크 호출은 의도된 CCH-CV-03 (b) 구현이고, 실패 시 swallow 처리로 기존 플로우를 중단시키지 않는다. `rotateBotToken` 반환 타입 확장은 TypeScript 구조적 타이핑상 하위 호환적이며 유일한 호출자인 `ChatChannelController`는 이미 동기화 완료되었다. 전역 변수 변경, 예상치 못한 파일시스템 부작용, 환경 변수 읽기/쓰기, 이벤트 콜백 변경은 없다. `rotateBotToken` 반환 타입 확장에 대해 모노레포 내 추가 호출자 유무를 CI 빌드 결과로 최종 확인하는 것을 권장한다.

---

## 위험도

LOW
