# Rationale 연속성 검토

## 검토 범위 및 방법

- 대상 diff: `origin/main` 대비 `codebase/backend/src/modules/triggers/**` (DTO·controller·service·spec) + `codebase/frontend/src/content/docs/**` (사용자 문서), 15 파일 / 1622줄.
- `spec/5-system` 자체는 이 브랜치에서 **변경 파일 0개** — 즉 이번 작업은 "이미 결정된 spec 을 뒤늦게 구현" 하는 성격이다.
- prompt 번들이 컨텍스트 예산으로 `spec/5-system/15-chat-channel.md`(원본 83,915자) 전문을 절단했기 때문에, 해당 파일과 `spec/2-navigation/2-trigger-list.md`·`spec/5-system/12-webhook.md` 의 `## Rationale` 을 워킹트리에서 절대경로로 직접 읽어 대조했다 (`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e/spec/5-system/15-chat-channel.md` 등).
- `origin/main` 에 이미 `R-CC-21`(및 하위 caveat)이 존재함을 확인했다(`git show origin/main:spec/5-system/15-chat-channel.md`) — 이번 diff 가 그 결정을 신설하는 것이 아니라 **이미 합의된 결정을 코드로 옮기는 작업**임을 의미한다.

## 발견사항

이번 diff 에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, 시스템 invariant 우회에 해당하는 항목을 찾지 못했다. 오히려 다음을 확인했다:

- **R-CC-21 "기각한 대안" 미재도입** — `spec/5-system/15-chat-channel.md` R-CC-21 은 "`botToken` 을 optional 로 두고 값이 오면 무시" 를 명시적으로 기각했다(침묵 폐기는 이 자원에 맞지 않는다는 이유). 구현(`ChatChannelUpdateConfigDto.botToken` = `@IsOptional() @IsEmpty()`)은 값이 오면 **명시적으로 400 거부**하지, 무시하지 않는다 — 기각된 대안을 피했다.
- **R-CC-21 "처방의 함정" 회피** — Rationale 은 "`SecretResolver.rotate` 에 빈 값 가드를 넣어 이 경로만 막기"도 별도 기각(원인이 아니라 증상 처리)했다. 실제 수정은 `secret-resolver.service.ts` 를 건드리지 않고 `setupChatChannel(..., { storeUserSuppliedSecrets })` 플래그로 **호출 경로 자체**를 막는 D-2 방식을 취했다 — Rationale 이 요구한 방향과 일치한다.
- **telegram carve-out 기각안 미재도입** — R-CC-21 이 "telegram 도 `rotate-inbound-signing` 전용 API 분리", "adapter 가 기존 서명 재사용하도록 바꿔 값 불변을 참으로 만든다", "`chatChannel` 이 실린 PATCH 에서 `setupChannel` 자체를 안 부른다" 세 가지를 명시적으로 기각했다. diff 는 셋 다 채택하지 않았다 — telegram 은 `storeUserSuppliedSecrets` 플래그와 무관하게 매 호출 재발급·재저장(쓰기 ③)을 유지했고, `setupChannel` 호출 자체도 유지했다.
- **R-CC-10 single-path 원칙 유지** — bot token 변경은 여전히 rotate 엔드포인트로만 열려 있고(`triggers.controller.ts` 의 `rotate-bot-token` 경로 자체는 비변경), PATCH 경로는 신설된 `assertPatchCarriesNoSecrets`/`ChatChannelUpdateConfigDto` 로 이중 차단된다.
- **`spec/2-navigation/2-trigger-list.md` R-12 정합** — "provider 변경은 트리거 삭제·재생성" 원칙과 신규 `assertChatChannelAlreadySetUp` 의 provider 전환 차단(`details.field='provider'`)이 일치한다.
- **선례(R-CC-10 우회) 실측 캐너리 폐기가 아니라 갱신** — `trigger-workflow-ref.e2e-spec.ts` 의 기존 "이 요청 바디는 판정된 결함을 재현한다" 경고 주석이, 결함이 닫혔음을 알리는 방향으로 다시 쓰였고 테스트 바디에서 `botToken` 을 제거했다. 과거 결정을 뒤집는 것이 아니라 **그 결정이 정확히 지켜지도록 캐너리를 갱신**한 것이다.

### [INFO] `§5.4.1`/`§5.4.1.1` 의 `details.field` flat 표기가 구현 실측과 어긋나지만, 별도 spec 갱신이 필요하다는 사실은 이미 추적 중

- target 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 신규 `it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다', ...)`
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1 표(`details.field='botTokenRef'` 등 flat 표기, "미확정 — 후속 e2e 확인 대기" 캐비어트) 및 R-CC-10
- 상세: 새 테스트는 전역 `CustomValidationPipe` 실측을 통해 "비어있지 않은 값" 경로에서는 `details.field` 가 `chatChannel.botToken` 같은 **중첩 경로**로 나가고, `null`/`''` 경로에서만 서비스 층 flat 이름(`botToken`)이 나간다는 것을 확정했다. 이는 spec 문면(flat 단일 표기, TBD 캐비어트)이 낡았다는 뜻이지만, `spec/` 은 이번 diff 의 변경 대상이 아니고 developer 의 자기-반증형 소정정 요건(예고·트리거 문장 한정)에도 해당하지 않는다(제품 계약/API 표기 성격이라 예외 대상 아님).
- 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "planner, §5.4.1·§5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다" 항목으로 추적되어 있고, 이번 테스트가 그 실측 정본 역할을 하도록 주석에 명시돼 있다. 후속 planner 턴에서 그 실측값(`chatChannel.<field>` 중첩 vs flat)으로 §5.4.1/§5.4.1.1 표를 갱신하면 된다 — 이번 PR 범위에서 추가 조치 불필요.

## 요약

이번 구현 diff(`codebase/backend/src/modules/triggers/**` 중심)는 `spec/5-system/15-chat-channel.md` 의 기존 `R-CC-10`/`R-CC-21`(및 §5.4.1/§5.4.1.1)이 이미 확정한 "PATCH 는 chatChannel 비밀을 받지도 쓰지도 않는다" 결정을 코드로 옮긴 것이며, Rationale 이 명시적으로 기각한 세 갈래 대안(필드 무시, `SecretResolver.rotate` 가드로 증상만 봉합, telegram 전용 API 분리/서명 재사용/`setupChannel` 스킵) 중 어느 것도 재도입하지 않았다. `spec/2-navigation/2-trigger-list.md` R-12(provider 전환 차단)와도 정합한다. 유일하게 남는 것은 spec 표기(`details.field` flat 표기)가 구현 실측보다 낡았다는 INFO 성격의 항목인데, 이는 developer 가 이미 plan 트래커에 planner 후속 작업으로 명시해 두었다.

## 위험도

NONE
