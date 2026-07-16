# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `chat-channel-adapter.md` §1.1 헤딩 rename 이 `15-chat-channel.md` 의 기존 앵커 링크 2건을 깨뜨림 (dead link)
  - 위치: `spec/conventions/chat-channel-adapter.md` (diff: `### 1.1 6함수 책임 / 부작용 / 멱등성` → `### 1.1 어댑터 함수 책임 / 부작용 / 멱등성`); 링크 사용처는 `spec/5-system/15-chat-channel.md:70`, `:582`
  - 상세: 이번 diff 가 `escapeControlText` 를 7번째 필수 인터페이스 함수로 추가하면서 `chat-channel-adapter.md` 의 `### 1.1 6함수 책임 / 부작용 / 멱등성` 헤딩을 `### 1.1 어댑터 함수 책임 / 부작용 / 멱등성` 으로 rename 했다(정확한 판단 — "6함수"가 더는 사실이 아니므로). 그런데 `15-chat-channel.md` 는 여전히 옛 anchor `#11-6함수-책임--부작용--멱등성` 를 두 곳에서 참조한다(CCH-CV-05 행, setupChannel 멱등성 문단). 헤딩 텍스트가 바뀌면 GFM 자동 anchor slug 도 바뀌므로(`#11-어댑터-함수-책임--부작용--멱등성` 로 추정) 두 링크 모두 깨진 상태다.
  - 제안: `spec/5-system/15-chat-channel.md:70`, `:582` 의 링크 fragment 를 새 anchor(`#11-어댑터-함수-책임--부작용--멱등성`, 실제 렌더 결과로 재확인 필요)로 갱신.

- **[WARNING]** 인터페이스에 7번째 필수 함수를 추가했는데 "6함수" 표현이 관련 문서 곳곳에 stale 로 남음 (types.ts 는 같은 파일 내 자기모순)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:5` (`* - [spec/conventions/chat-channel-adapter.md] — 6함수 인터페이스 + 데이터 타입 union`); `spec/conventions/chat-channel-adapter.md:517` (`### R1. 6함수 인터페이스의 책임 분리`), `:521` (`### R2. 6함수 (5+1 ack) 의 의도`), `:537` (`...6함수 인터페이스 (§1) drift...`), `:576` (`...기존 6함수 필수 계약 불변...`)
  - 상세: `types.ts` 는 이번 diff(파일 11)에서 `ChatChannelAdapter` 인터페이스에 `escapeControlText` 를 직접 추가했다. 그런데 같은 파일 상단의 module JSDoc(5번째 줄)은 여전히 "6함수 인터페이스"라고 자기모순적으로 서술한다. `chat-channel-adapter.md` 의 Rationale R1/R2 제목과 R-CCA-5 본문도 동일하게 "6함수"를 전제로 하는데, 이제 필수 함수는 `setupChannel/teardownChannel/parseUpdate/renderNode/sendMessage/ackInteraction/escapeControlText` 7개다("5+1 ack" 였던 R2 제목도 이제 "5+1 ack+1 escape" 여야 정확).
  - 제안: 이번 PR 범위에서 "6함수" → "7함수"(또는 "N함수" 일반화) 로 일괄 갱신하거나, 최소한 이번 변경으로 새로 stale 해진 항목만이라도 후속 정리 필요성을 plan 백로그에 남길 것.

- **[INFO]** 이번 diff 가 직접 수정한 provider adapter 파일들의 주석/테스트명도 동일한 "6함수" 표현을 그대로 유지
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts:2` (`* DiscordAdapter 단위 테스트 — provider 식별자 + 6함수 wiring ...`); `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts:3`, `:41` (`it('ChatChannelAdapter 6함수 모두 노출', ...)`); `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:35` (`* Phase 1: 6함수 stub + signing 검증.`)
  - 상세: 이 4개 지점은 모두 이번 PR 에서 편집된 파일(escapeControlText 테스트를 새로 추가) 내부에 있음에도 기존 "6함수" 카운트 주석은 그대로 남았다. 기능적으로 틀린 assertion 은 아니지만(해당 테스트는 원래 6개 함수만 wiring 체크), 인터페이스 전체 함수 수를 지칭하는 주석 문구로는 부정확해졌다.
  - 제안: 우선순위는 낮음(README/spec 급 파급은 없음) — 다음 관련 작업 시 함께 정리 권장. 이번 PR 을 블로킹할 사안은 아님.

- **[INFO]** F-5 제거·`escapeControlText` 이관에 대한 CHANGELOG·spec 반영은 정확하고 잔존 참조 없음 (positive finding)
  - 위치: `CHANGELOG.md` 신규 Unreleased 항목; `spec/conventions/chat-channel-adapter.md` (interface JSDoc + §1.1 테이블 행); `spec/5-system/15-chat-channel.md` §4.1/§4.1.1/§R-CC-15(c); `spec/4-nodes/7-trigger/providers/telegram.md` §5.8
  - 상세: worktree 전체를 `grep -rn "F-5"` 로 훑은 결과, 살아있는 "F-5 가 현재 유효하다"는 취지의 참조는 없다. 남은 F-5 언급은 모두 (a) `plan/complete/eia-command-waiting-surface-guard.md` 의 역사적 완료 기록, (b) `plan/in-progress/control-plane-provider-escape.md` 의 "F-5 를 대체하는 근본 fix"라는 배경 설명, (c) `CHANGELOG.md` 의 과거 Unreleased 항목(F-5 최초 도입 기록) 및 신규 항목의 "[#950 F-5] 등록 시점 검증으로 막았다"는 과거형 설명, (d) `trigger-dto-validation.spec.ts` 의 "F-5 (telegram 한정)"→"F-5 검증 제거" 주석 — 전부 문맥상 올바른 과거형/배경 설명이다. `UNSAFE_TELEGRAM_MARKDOWN` 문자열도 삭제된 validator 관련 코드에서 완전히 제거되고 test 주석에만 "제거됐다"는 설명으로 남아있어 정확하다. `LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`chat-channel/shared/markdown-v2.ts` 삭제도 diff·CHANGELOG·spec·plan 체크리스트가 상호 일치한다. DTO 의 Swagger `@ApiPropertyOptional` description 도 "평문으로 입력" 안내로 정확히 갱신됨.
  - 제안: 없음 (검증 완료, 문제 아님).

- **[INFO]** 신규 `escapeControlText` 관련 JSDoc/인라인 주석 품질은 양호
  - 위치: `types.ts`(인터페이스 JSDoc), `telegram.adapter.ts`/`slack.adapter.ts`/`discord.adapter.ts`(구현 JSDoc), `hooks.service.ts`(호출부 인라인 주석 3곳 + `sendBestEffortNotice` JSDoc 갱신)
  - 상세: 각 provider 구현체가 자신의 escape 규칙과 그 근거(렌더러 경로와의 일관성)를 명확히 문서화했고, `hooks.service.ts` 의 `sendExecutionStillRunningNotice` JSDoc 도 "default 는 평문 — provider 별로 escape" 로 정확히 갱신되어 오래된 주석(stale comment) 문제가 없다.
  - 제안: 없음.

## 요약

CHANGELOG·핵심 spec(§4.1/§4.1.1/§5.8/§R-CC-15)·plan 체크리스트는 `escapeControlText` 이관과 F-5 제거를 정확하고 상호 일관되게 반영했으며, "살아있는" F-5/`UNSAFE_TELEGRAM_MARKDOWN` 잔존 참조는 없다(과거형 설명만 남음, 문제 없음). 다만 이번 diff 가 인터페이스에 7번째 필수 함수를 추가하면서 발생한 부수 효과로 (1) `chat-channel-adapter.md` §1.1 헤딩 rename 이 `15-chat-channel.md` 의 기존 앵커 링크 2건을 깨뜨렸고, (2) `types.ts` 를 포함한 여러 파일에 "6함수" 표현이 stale 로 남아 일부는 같은 파일 내에서 자기모순을 이룬다. 두 사안 모두 이번 PR 의 핵심 목적(F-5 제거·per-provider escape 이관) 자체와는 무관하지만, 사용자가 명시적으로 요청한 "정확성/잔존 참조 없음" 점검 범위 안에 든다.

## 위험도

LOW
