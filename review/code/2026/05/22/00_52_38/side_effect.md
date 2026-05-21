# 부작용(Side Effect) 리뷰 결과

**리뷰 대상**: Chat Channel (Telegram) 어댑터 spec + plan + review 산출물 일괄 커밋
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [INFO] EIA-AU-08 in-process bypass — InteractionService.interact() 시그니처 계약 변경
- 위치: `spec/5-system/14-external-interaction-api.md` EIA-AU-08, `spec/5-system/15-chat-channel.md` §5.1
- 상세: 스펙이 `InteractionService.interact()`를 in-process 직접 호출 경로로 공식화하면서 `InteractionRequestContext`에 `scope: 'in_process_trusted'` 선택 필드를 추가한다. 이는 기존 `{ executionId, tokenFamily, triggerId? }` 인터페이스에 새 선택 필드를 추가하는 인터페이스 변경이다. 현재 스펙 수준이므로 당장 코드 영향이 없으나, 구현 단계에서 `interaction.guard.ts` 가 새 필드를 검증 없이 통과시키도록 분기 로직을 추가해야 한다. 외부 HTTP 경로로부터 이 플래그를 인위적으로 주입하는 취약점이 발생하지 않도록 "HTTP guard 는 `scope` 플래그를 절대 set 하지 않는다"는 구현 제약이 코드 레벨에서 반드시 강제되어야 한다. Spec 은 이를 명시(`EIA-AU-08` 본문)하지만, 구현 시 단위 테스트로 검증하지 않으면 silent regression 위험이 있다.
- 제안: 구현 PR(PR-A)에서 `interaction.guard.ts`의 ctx 합성 경로에 `scope` 필드 주입 시도를 차단하는 가드 테스트를 의무화할 것을 spec 또는 plan 에 명시한다.

### [INFO] NotificationDispatcher fan-out 확장 — EventEmitter listener attach 부작용
- 위치: `spec/5-system/14-external-interaction-api.md` §R10 추가 단락, `spec/5-system/15-chat-channel.md` §3.2 CCH-AD-05
- 상세: 스펙이 NotificationDispatcher 의 fan-out 경로를 (a) Redis pub/sub + (b) in-process EventEmitter emit + (c) 외부 HTTP POST 세 갈래로 확장한다. 기존에는 (a)+(c) 두 갈래였으므로, Chat Channel 어댑터 구현 시 `NotificationDispatcher`에 in-process EventEmitter 리스너를 `attach`하는 코드가 추가된다. 이 리스너 등록/해제 라이프사이클이 잘못 관리되면 (예: `teardownChannel()` 미호출, 어댑터 재등록 시 중복 리스너) 동일 메시지가 Telegram 으로 여러 번 전송되는 부작용이 발생할 수 있다. Spec 이 `setupChannel()`/`teardownChannel()` 대칭 계약을 명시(`spec/conventions/chat-channel-adapter.md` §2.2/§2.3)하고 있으나, 리스너 중복 방지 메커니즘 (예: 등록 전 기존 리스너 제거, WeakRef 관리) 은 아직 spec 에 기술되지 않았다.
- 제안: `spec/conventions/chat-channel-adapter.md` 또는 `spec/5-system/15-chat-channel.md`의 신뢰성 섹션에 "어댑터 등록/해제 시 EventEmitter 리스너 중복 방지 정책"을 한 줄 명시한다.

### [INFO] webhook 처리 흐름 분기 추가 — 기존 단계 번호 밀림
- 위치: `spec/5-system/12-webhook.md` §7 처리 흐름 (step 7~10)
- 상세: 기존 step 7 (`resolveTriggerParameters`) 앞에 Chat Channel 분기(step 7. a~f)가 삽입되고 기존 step 7~8이 "기존 경로" 하위로 들여쓰기되었다. Spec 차원의 구조 변경이지만, `spec/5-system/12-webhook.md`를 cross-reference 하는 외부 문서(plan, 다른 spec 절)가 "step 7", "step 8" 번호로 직접 참조하고 있다면 의미가 어긋날 수 있다. 현재 커밋 범위 내에서 다른 파일이 이 step 번호를 직접 참조하는 패턴은 확인되지 않으므로 즉각적인 영향은 없다.
- 제안: 향후 step 번호로 직접 cross-reference 하는 문서가 생기지 않도록, 처리 흐름에 anchor ID(예: `WH-FLOW-*`)를 도입하는 방안을 long-term 권장.

### [INFO] spec/2-navigation/4-integration.md 다이어그램 — install_token 텍스트 제거의 맥락
- 위치: `spec/2-navigation/4-integration.md` 라인 ~602, ~614
- 상세: 다이어그램에서 `(install_token 보존)`, `install_token=NULL` 등 `install_token` 참조 텍스트가 제거되었다. 이 변경은 cafe24 backlog residual PR(#248)에서 다이어그램 정합화의 일부로 보이며, 실제 `install_token` 컬럼 동작 자체는 유지된다. Spec 다이어그램에서만 가시성이 제거된 것이므로 구현 부작용은 없다. 단, 향후 `install_token` 관련 코드를 spec 만으로 이해하려는 개발자에게 혼동을 줄 수 있다.
- 제안: `spec/2-navigation/4-integration.md` Rationale 에 "다이어그램에서 `install_token` 처리 가시화를 제거한 이유 — 상세는 `spec/5-system/...`에 위임"을 한 줄 추가하면 혼동을 방지할 수 있다.

### [INFO] plan 파일의 frontmatter worktree 필드 불일치
- 위치: `plan/in-progress/presentation-button-render-investigation.md` frontmatter
- 상세: frontmatter의 `worktree: button-cap-spec-validator`로 업데이트하라는 소유권 이전 주석이 문서 본문에 있으나, 실제 frontmatter의 `worktree` 값은 여전히 `button-cap-spec-validator`로 동일하게 표기되어 있다. 이 plan 파일 자체는 현재 `chat-channel-telegram-0c106c` worktree 안에 추가되는데, 내용은 `button-cap-spec-validator` worktree 소속이라고 명시한다. plan 파일이 두 worktree 에 걸쳐 존재하는 상태가 되어 `plan/complete/` 이동 책임이 모호해질 수 있다.
- 제안: 이 plan 파일을 `button-cap-spec-validator` PR 이 아닌 현재 PR 에 포함시킨 이유를 명확히 하거나, `button-cap-spec-validator` worktree 의 `git mv plan/complete/` 대상으로만 관리한다.

---

## 요약

이번 변경은 전량 spec 문서(plan, review, spec)의 신설·수정이며 실행 코드 변경은 없다. 따라서 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트 콜백 직접 변경 등의 런타임 부작용은 본 커밋에서 발생하지 않는다. 부작용 위험은 모두 "구현 단계에서 스펙을 어떻게 실현하느냐"에서 파생되며, 가장 주목해야 할 항목은 두 가지다. (1) `InteractionRequestContext.scope: 'in_process_trusted'` 추가에 의해 HTTP 표면 guard 가 이 플래그를 주입할 수 없도록 코드 레벨 보호가 반드시 동반되어야 한다. (2) NotificationDispatcher in-process EventEmitter 리스너의 중복 attach 방지 정책이 구현 전에 spec 에 명시되어야 메시지 중복 발송 부작용을 방지할 수 있다. 두 항목 모두 현재 스펙 단계에서 예방적으로 보완할 수 있으며 구현을 차단할 CRITICAL 수준은 아니다.

---

## 위험도

LOW

---

STATUS: SUCCESS
