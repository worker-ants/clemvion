# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `HooksService.getActiveExecutionStatus` — JSDoc 에 오류 전파 정책 미기재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 ~1330 (`getActiveExecutionStatus` JSDoc)
- 상세: JSDoc 에 "DB 예외 발생 시 `.catch(() => null)` 로 null 반환(비활성 처리)" 동작이 요약에는 있지만, `@throws` 가 없는 것은 맞으나 "catch → null → 새 execution 시작" 의 side-effect 가 명시되지 않아 호출 측에서 의도를 파악하려면 본문을 읽어야 한다. 기존 인라인 주석(`// 조회 실패 → null (비활성) → forwarding/안내 없이 새 execution 시작.`)이 호출 지점 테스트 케이스에는 잘 표현되어 있으므로 실용 영향은 낮다.
- 제안: JSDoc 에 `@remarks DB 예외 시 catch-null(비활성 처리) → 새 execution 분기` 한 줄 추가 권장.

### [INFO] `sendExecutionStillRunningNotice` — 기본 문구의 Markdown escape 규칙 주석 표현이 약간 부정확
- 위치: `hooks.service.ts` 라인 ~1354 (`sendExecutionStillRunningNotice` JSDoc)
- 상세: JSDoc 에 "텔레그램 MarkdownV2 는 어댑터가 escape 하지 않으므로 default 문구는 pre-escaped (`.` → `\.`)" 라고 기술하나, 실제로는 Telegram MarkdownV2 에서 `.` 이 escape 대상인 것이 맞지만 이 설명이 "어댑터가 escape 하지 않는다"는 가정에 의존한다. 어댑터 계약이 바뀔 경우 이 문구가 이중 escape 될 위험이 있는데, 해당 위험이 주석에 언급되지 않는다. `maybeNotifyIgnored` 와의 패턴 공유도 언급되어 있으므로 일관성은 좋으나, `maybeNotifyIgnored` 쪽에도 같은 escape 가정이 있어 두 곳이 암묵적으로 어댑터 계약에 결합된다.
- 제안: "어댑터가 MarkdownV2 raw text 를 그대로 전송한다는 전제 하에 pre-escaped — 어댑터 계약 변경 시 이중 escape 주의" 정도로 JSDoc 보강 권장 (INFO 수준, 기능 영향 없음).

### [INFO] `ChatChannelController.rotateBotToken` — 반환 타입 `Awaited<ReturnType<...>>` 의 Swagger 문서화 누락 가능성
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` 라인 ~226
- 상세: 반환 타입이 `Awaited<ReturnType<TriggersService['rotateBotToken']>>` 로 변경되어 타입 안정성은 높아졌지만, `@ApiOperation` 의 `description` 은 여전히 "기존 token 은 24h grace …" 수준의 설명에 그친다. 새롭게 추가된 3개 응답 필드(`triggerId`, `chatChannelHealth`, `botIdentity`) 및 `botIdentity=null` 케이스가 Swagger `@ApiResponse` 데코레이터나 응답 DTO 로 문서화되지 않았다. NestJS/Swagger 가 유틸리티 타입(`ReturnType`)을 자동으로 스키마로 추론하지 못하므로, Swagger UI 에서 응답 형태가 누락된다.
- 제안: `@ApiResponse({ status: 200, schema: { ... } })` 또는 응답 DTO 클래스(`RotateBotTokenResponseDto`)를 추가해 `triggerId`, `rotatedAt`, `chatChannelHealth`, `botIdentity` 필드를 명시하고 `botIdentity` 의 nullable 여부를 표현할 것을 권장.

### [INFO] `TriggersService.rotateBotToken` 반환 타입 인라인 주석 — spec 참조가 부분적
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 라인 ~1560
- 상세: 반환 구문의 인라인 주석 `[Spec Chat Channel §5.4] 성공 응답 3필드 동봉` 에서 `chatChannelHealth` 가 항상 `'healthy'` 고정으로 하드코딩되는 이유(setupChannel 성공 경로이므로)가 주석에 명시되지 않는다. 향후 유지보수자가 `chatChannelHealth` 를 동적 계산이 필요한 필드로 오해할 수 있다.
- 제안: `chatChannelHealth: 'healthy', // setupChannel 성공 = healthy 고정 (실패 시 이미 throw)` 형태의 inline 설명 추가 권장.

### [INFO] `plan/in-progress/spec-sync-chat-channel-gaps.md` — `worktree` frontmatter 변경 누락 위험 없음(확인됨), 비고 §7 동시 갱신 의무 준수 여부 기재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/plan/in-progress/spec-sync-chat-channel-gaps.md`
- 상세: plan 파일의 비고에 "§7 동시 갱신 의무: `15-chat-channel.md` 와 `chat-channel-adapter.md` 를 함께 갱신한다" 가 기재되어 있다. `spec/conventions/chat-channel-adapter.md §7` 의 갱신이 실제로 이루어졌는지 plan 본문에 명시되지 않아 이행 여부를 plan 만으로 확인할 수 없다. `§5.4` 구현 완료 체크박스에 "spec §5.4 예시 갱신" 언급이 있으나 `chat-channel-adapter.md` 언급이 없다.
- 제안: 완료 항목에 `chat-channel-adapter.md §7` 갱신 여부("갱신 완료" 또는 "해당 없음 — rotate-bot-token 은 adapter spec 변경 아님")를 명시하면 추적성이 높아진다.

### [INFO] `hooks.service.spec.ts` — 4개 신규 테스트케이스 describe 블록 레이블 미설정
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 라인 ~259–394
- 상세: 새로 추가된 4개 `it()` 케이스가 `describe('HooksService', ...)` 바로 아래 평탄하게 배치되는 것으로 보인다. CCH-CV-03 (b) 관련 케이스들을 별도 `describe('CCH-CV-03 (b) — running/pending 분기', ...)` 등으로 그룹화하면 테스트 보고서 가독성이 높아진다. 문서화 관점에서의 권장 사항이며 기능 영향 없음.
- 제안: `describe` 그룹핑 추가 고려 (INFO).

---

## 요약

이번 변경은 CCH-CV-03 (b) 분기 구현과 `rotateBotToken` 응답 확장에 집중되어 있으며, 코드 내 인라인 주석과 JSDoc 은 전반적으로 충실하게 작성되었다. Spec 번호(CCH-CV-03, §5.4, R9)를 코드 주석에 직접 기재하는 관행이 잘 지켜져 있고, `handleChatChannelWebhook` 메서드 단계별 JSDoc도 변경 내용을 정확히 반영하여 갱신되었다. 다만 Swagger 응답 스키마에 신규 3개 필드가 추가되지 않아 API 문서 자동화 관점에서 누락이 있고, `chatChannelHealth` 하드코딩 이유, `sendExecutionStillRunningNotice` 의 MarkdownV2 escape 전제, `getActiveExecutionStatus` DB 예외 전파 정책 등 세부 주석 보강 권장 사항이 존재하나 모두 INFO 수준이다.

---

## 위험도

LOW

STATUS: OK
