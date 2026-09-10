# Plan 정합성 검토 — impl-chat-channel-patch-token (--impl-done, scope=spec/5-system)

## 검토 범위와 방법

- `spec/5-system` 자체의 diff 는 0 파일(코드 전용 PR) — target 은 "spec/5-system 의 현재 상태 vs
  이 구현 diff(16 파일/1662줄) + plan/in-progress 진행 상태" 의 정합성으로 해석해 검토했다.
- 1차 근거: `plan/complete/impl-chat-channel-patch-token.md`(이 PR 에서 in-progress→complete 로 이동),
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff(`git diff origin/main...HEAD`),
  `spec/5-system/15-chat-channel.md` 현재 워킹트리 본문(절대경로 확인).
- 예산 절단으로 프롬프트에 본문이 없던 `spec/5-system/15-chat-channel.md` 는 워킹트리에서 직접
  `grep`/read 로 확인했다 (frontmatter `code:`/`pending_plans:`, R-CC-21, `details.field`,
  `SecretResolver.store` 언급 라인 전부).

## 발견사항

- **[INFO] planner 후속 결정 2건이 spec 에 아직 "미확정" 으로 정확히 남아 있음 — 조기 확정 없음**
  - target 위치: `spec/5-system/15-chat-channel.md:375,390` (`details.field` 는 **미확정 — 후속 e2e
    확인 대기**), `:200,201,373,390` (`SecretResolver.store()` 표기)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "spec 9곳이
    `SecretResolver.store()` 라 적는데 실제 호출은 전부 `rotate()` 다" 항목(planner, 미체크) ·
    "§5.4.1 · §5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다" 항목(planner, 미체크)
  - 상세: 이 PR 이 두 항목 모두 **실측**(호출부 전수가 `rotate()`, `details.field` 는 값의
    형태(빈 값 vs 비어있지 않은 값)에 따라 flat/중첩으로 갈린다)을 완료해 놓았지만, spec 본문
    자체는 developer 권한 밖이라 손대지 않고 "미확정" 상태를 그대로 유지했다. 실측 결과와 spec
    현재 문구 사이에 **모순은 없다** — "미확정" 은 placeholder 이지 확정 서술이 아니므로 이 구현이
    그것을 우회 확정한 것도 아니다.
  - 제안: 조치 불요. planner 턴에서 위 두 항목의 실측 표를 그대로 `15-chat-channel.md` 본문에
    반영하면 종결된다 (developer 가 이미 SoT 실측·정본 테스트 케이스를 남겨 뒀다).

- **[INFO] `pending_plans` frontmatter 는 현재 유효 — 과거 기록된 dangling 사례는 이미 해소됨**
  - target 위치: `spec/5-system/15-chat-channel.md:19-22`
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 의 "docs 가드가 spec frontmatter 의
    dangling `pending_plans` 를 안 잡는다" 항목(harness, 미체크)
  - 상세: 이 항목이 예시로 든 `plan/in-progress/spec-sync-chat-channel-gaps.md` 참조는 이미
    제거돼 있고, 현재 `pending_plans` 는 `chat-channel-discord-gateway.md` ·
    `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md` 세 개뿐이며 셋 다
    `plan/in-progress/` 에 실재한다(확인 완료). 즉 **참조 무결성 자체는 깨져 있지 않다** — 남은
    것은 "이런 dangling 을 자동으로 잡는 가드가 없다" 는 harness 백로그이고, 이 PR 의 스코프
    (`codebase/backend`, chat-channel PATCH 검증) 와 무관하다.
  - 제안: 조치 불요. 해당 harness 항목은 그대로 in-progress 에 유지하되, 예시 문구가 이미 낡았다는
    점만 다음 정리 시 갱신하면 된다(선택 사항).

- **[INFO] 이 PR 이 신설한 후속 항목 5건은 다른 in-progress plan 과 중복·충돌 없음**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (동시 PATCH lost-update
    경로 · `setupChatChannel` 함수 크기) · `chat-channel-config.dto.ts`(`botToken` minLength 부재 ·
    `@IsEmpty()` 메시지 중복)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 신규 5개 미체크 항목(동시성 lost-update ·
    함수 비대 · minLength 부재 · 메시지 리터럴 중복 · TriggersService 비대)
  - 상세: `plan/in-progress/` 전체를 대상으로 `advisory lock`·`previousInboundSigningRef`·
    `UpdateTriggerDto`·`assertChatChannelInputSafe`·`setupChatChannel`·`ChatChannelConfigDto` 를
    grep 했고, 겹치는 다른 in-progress 항목(예: `execution-engine-residual-gaps.md`,
    `node-cancellation-residual-signal-propagation.md` 등)은 전부 다른 도메인(노드 취소·EIA)이라
    이번 신규 항목과 충돌하지 않는다. 자매 plan 3건(`chat-channel-discord-gateway.md` 등)도 이번
    diff 가 건드린 DTO/서비스 표면을 참조하지 않아 무효화 대상이 없다.
  - 제안: 조치 불요.

## 요약

이 PR 은 plan(`plan/complete/impl-chat-channel-patch-token.md`)이 스스로 기록한 "planner 소관"
경계(§5.4.1/§5.4.1.1 의 `store()`→`rotate()` 표기 정정, `details.field` 확정)를 넘지 않고, 실측
결과만 남긴 채 spec 본문 수정은 유보했다. spec(`15-chat-channel.md`)의 현재 "미확정" 문구는 이
구현이 내린 어떤 결정과도 충돌하지 않으며, 이 PR 이 새로 등재한 5개 후속 항목(동시성 lost-update,
함수 비대, DTO 검증 공백 등)도 다른 in-progress plan 의 후속 항목을 무효화하거나 중복시키지 않는다.
`plan/{in-progress→complete}` 이동과 `spec-draft-nullable-notation-followups.md` 체크박스 갱신도
실제 상태와 일치한다. Plan 정합성 관점에서 이 PR 이 새로 만든 결함은 없다.

## 위험도

NONE
