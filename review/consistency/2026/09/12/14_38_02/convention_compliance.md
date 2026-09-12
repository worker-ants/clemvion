# 정식 규약 준수 검토 — convention_compliance

## 범위와 방법

- Target: `spec/5-system/` (scope 델타 0개 파일 — 이 PR 은 이 영역의 spec 을 바꾸지 않았다. plan
  `plan/in-progress/impl-setup-error-code.md` 이 `spec_impact: none` 을 명시적으로 선언한다).
- 실제 구현 diff(21파일/1012줄)는 `codebase/backend/src/modules/chat-channel/**`
  (telegram/slack/discord adapter 의 `setupChannel` 실패에 `Error.code` 프로퍼티 부착)와
  `spec/conventions/chat-channel-adapter.md` frontmatter/§1.1.2 각주 갱신(자기-반증형 소정정 —
  `status: partial` pending_plans 서술 "미구현" → "구현됐다" 정정)이다.
- HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-setup-error-code-ddd078`)를
  절대경로로 직접 열어 `git diff origin/main..HEAD` 로 실제 변경분을 확인했고, 프롬프트에
  번들된 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 전문과
  `spec/conventions/error-codes.md`·`node-output.md`·`swagger.md`·`spec-impl-evidence.md` 를
  직접 Read 해 대조했다(예산 절단으로 프롬프트에서 생략된 conventions 파일들).

## 발견사항

### [INFO] chat-channel setupChannel 에러 코드가 `3-error-handling.md §1` 도메인 카탈로그에 전용 서브섹션이 없다
- target 위치: `spec/5-system/3-error-handling.md §1` (WS commands §1.5 · EIA §1.6 · webhook §1.7 ·
  KB/RAG §1.8 · 워크스페이스 멤버 §1.9 · 트리거 endpointPath §1.10 · AuthConfig binding §1.11)
- 위반(연관) 규약: `spec/5-system/2-api-convention.md §5.3` "어느 쪽을 택하든 [에러 처리 §1
  카탈로그]에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다" — 이 규칙은
  `2-api-convention.md` 자체 조항이라 엄밀히는 `spec/conventions/**` 파일이 아니지만,
  `spec/conventions/error-codes.md` Overview 는 "카탈로그·분류·트리거: `3-error-handling.md §1`
  (SoT)" 로 책임을 위임해 두었으므로 이 gap 은 그 위임 대상의 완결성 문제다.
- 상세: `BOT_TOKEN_INVALID`(400)·`CHAT_CHANNEL_SETUP_FAILED`(502) 는
  `2-api-convention.md §6`(HTTP 상태 코드 표)과 `triggers.controller.ts` 의
  `@ApiBadRequestResponse`/`@ApiBadGatewayResponse` 로는 문서화돼 있으나, `3-error-handling.md`
  에는 이 두 코드를 가리키는 §1.x 서브섹션이 없다(grep 결과 `3-error-handling.md` 전체에
  `BOT_TOKEN` 문자열이 §1.4 각주 한 줄 외 등장하지 않는다). 같은 문서가 이미 확립한 패턴
  (도메인 SoT 코드를 §1.5~§1.11 로 "공용 카탈로그 가시성" 목적으로 등재)에 비추면 비대칭이다.
- **이 PR 이 만든 문제가 아니다**: 이 코드들과 그 분류 규약(§R-CC-23)은 이전 PR 에서 이미
  확정·구현됐고, 이번 diff 는 그 계약을 provider adapter 3종에 배선했을 뿐이다(`plan/in-progress/
  impl-setup-error-code.md` `spec_impact: none`). 등급을 INFO 로 낮추는 이유: (a) 이 target 리뷰의
  실제 델타가 spec/5-system 0건이라 이번 PR 책임 범위 밖이고, (b) 소비자 가시성은 이미
  `2-api-convention.md §6` + swagger 데코레이터로 부분 충족되어 "소비자가 존재를 알 방법이
  없다"는 최악 시나리오는 아니다.
- 제안: 후속(별도 planner 턴)에서 `3-error-handling.md` 에 `### 1.12 Chat Channel setupChannel
  에러 코드 (도메인 spec 참조)` 류 서브섹션을 추가해 다른 도메인 코드와 동일 패턴으로 맞추거나,
  의도적으로 생략한다면 그 사유를 §1 Overview 목록(현재 §1.2.1·§1.5~§1.9 만 열거)에 명시.
  이 PR 을 이 이유로 block 할 근거는 없다.

### [INFO] 자기-반증형 소정정 성격의 conventions 파일 편집 — governance 축은 이 checker 범위 밖
- target 위치: `spec/conventions/chat-channel-adapter.md` frontmatter `pending_plans` 주석 +
  §1.1.2 "2026-09-12 갱신" 각주 (이번 브랜치 diff)
- 상세: `developer` 가 과거 자신이 그 문서에 쓴 예고("§1.1.2 의 `code` 선언 계약은 **미구현**이다")를
  실측(3종 provider 전부 `code` 부착 완료)으로 반증하고 그 문장만 정정했다. CLAUDE.md 의
  "자기-반증형 소정정" 5조건(① 그 문장을 developer 자신이 썼음 ② 예고·트리거 문장(제품
  정의·API 계약 아님) ③ 실측이 반증 ④ 정정이 그 문장에 국한(원문 취소선 보존, 인접 서술
  불변) ⑤ plan `spec_impact` 명시)에 형식상 부합해 보인다 — 다만 이는 **spec/conventions/**
  content 규약이 아니라 CLAUDE.md 거버넌스 절차 문제**라 본 checker(정식 규약 준수, 즉
  `spec/conventions/**`의 명명·출력형식·문서구조·API문서·금지항목)의 1~5 관점 중 어느 것에도
  직접 해당하지 않는다. 별도 governance/plan-coherence 관점 checker 의 소관으로 남기고 여기서는
  참고 정보로만 기록한다.
- 제안: (조치 불요, 정보 제공 목적)

### 검토했으나 위반 없음 (근거 기록)
- **명명 규약**: `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 모두 `UPPER_SNAKE_CASE` +
  의미 기반 명명(`error-codes.md §1`) 준수. 신규 rename 이 아니라 기존 발행 코드에 provider
  신호를 통일 배선한 것뿐이라 `error-codes.md §2` rename-안정성 정책과 충돌하지 않는다.
- **API 문서 규약**: `triggers.controller.ts` 의 `@ApiBadRequestResponse`(400)/
  `@ApiBadGatewayResponse`(502) 페어링은 `swagger.md §2-4` 상태코드-데코레이터 매핑표
  ("502 외부 provider 호출 실패 → `@ApiBadGatewayResponse`")와 정확히 일치.
- **출력 포맷 규약**: `translateSetupChannelError` 가 반환하는 고정 client-safe `message`("Bot
  token was rejected by the provider." / "Chat channel setup failed after rotation.")는
  `2-api-convention.md §5.3` 의 CWE-209 방지 규칙(내부 원문 echo 금지)을 그대로 따른다. provider
  원문은 응답 바디에 싣지 않고 호출자 로거로만 흘려보낸다 — §5.3 요구사항과 일치.
- **문서 구조 규약**: `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 모두 Overview /
  본문(번호 섹션) / Rationale 3섹션 구성과 frontmatter(`id`/`status`/`code`/`pending_plans`) 스키마
  (`spec-impl-evidence.md §2`)를 준수. `chat-channel-adapter.md` 의 `pending_plans` 3건(
  `spec-draft-nullable-notation-followups.md`·`chat-channel-discord-gateway.md`·
  `chat-channel-slack-socket-mode.md`) 모두 `plan/in-progress/` 에 실존 확인(§4
  `spec-pending-plan-existence.test.ts` 가드 통과 예상).
- **금지 항목**: `error-codes.md §3` historical-artifact 예외 목록(초대 흐름 lowercase 코드 등)을
  `1-auth.md §1.5.4`가 정확히 재인용하며 새 예외를 만들지 않음. `node-output.md` Principle 7 의
  spread-echo 금지·Principle 3.2 `UPPER_SNAKE_CASE` 등은 이번 diff 가 건드리는 노드 핸들러 레이어가
  아니라(REST 레이어) 적용 대상이 아니며 위반도 없음.

## 요약

이번 검토의 실제 target scope(`spec/5-system/`)는 델타 0으로, 이 브랜치가 그 영역의 spec 을
바꾸지 않았다는 전제가 맞다. 실제 코드 diff(chat-channel provider 3종의 `setupChannel` 실패에
`code: 'BOT_TOKEN_INVALID'` 배선)는 이미 확정된 spec 계약(`chat-channel-adapter.md §1.1.2`,
`15-chat-channel.md §5.4`, `2-api-convention.md §6`, `swagger.md §2-4`)을 그대로 구현한 것으로
확인되며, 명명(UPPER_SNAKE_CASE)·API 문서 데코레이터 페어링·에러 메시지 정보노출 방지 등
`spec/conventions/**` 규약을 위반하는 지점을 찾지 못했다. 유일하게 눈에 띈 것은
`3-error-handling.md §1` 카탈로그에 chat-channel 전용 서브섹션이 없다는 pre-existing 완결성
gap(INFO)이며, 이는 이번 PR 이전부터 있던 상태이고 이번 diff 의 책임 범위 밖이라 차단 사유가
아니다.

## 위험도

NONE
