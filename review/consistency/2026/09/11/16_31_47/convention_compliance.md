# 정식 규약 준수 검토 — `impl-chat-channel-binder` (--impl-done, scope=spec/5-system/)

## 검토 범위와 방법

프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/**` 대부분과 `spec/5-system/{4,6,8~17}*.md`
본문·실제 코드 diff 를 절단했다. 대신 아래를 **워크트리 절대경로**로 직접 확인했다:

- `git -C <worktree> diff origin/main...HEAD --stat` (실제 변경 파일 3개: `chat-channel-input-rules.ts`
  신규 · `chat-channel-input-rules.spec.ts` 신규 · `triggers.service.ts` 수정, 순수 이동)
- `git -C <worktree> diff origin/main...HEAD -- 'spec/**'` → **0줄** (이 PR 은 spec 을 전혀 건드리지 않음.
  `spec_impact: none` 과 일치)
- `plan/in-progress/impl-chat-channel-binder.md` 전문 (이 턴의 설계·정지 규칙·귀속 실측)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 이번 신규 추가분 (5건)
- `spec/conventions/{audit-actions,chat-channel-adapter,review-citations}.md` 원문 (직접 Read)
- `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" (2026-09-11 갱신분, 원문)
- `review/consistency/2026/09/11/14_59_33/convention_compliance.md` (같은 작업의 `--impl-prep` 선행 검토)
- `review/code/2026/09/11/{15_31_54,15_57_42,16_16_44}/SUMMARY.md` (직전 3라운드 코드 리뷰 결과)

## 배경 — 이 diff 의 성격

`TriggersService` 의 chat-channel 검증 로직(외부 협력자 의존 0개, "T1" 계층) 6개 함수를
`triggers/chat-channel-input-rules.ts` 로 **순수 이동**한 리팩터. 로직·에러 메시지·`details`
형태는 한 글자도 바꾸지 않았고(`git diff` 로 직접 대조 확인), 테스트는 새 파일에 직접 호출
테스트를 추가했을 뿐 기존 `triggers.service.spec.ts` 단언은 무편집이다.

## 발견사항

없음 — CRITICAL·WARNING 대상 위반을 찾지 못했다.

## 확인해 통과로 판정한 항목 (참고용)

- **에러 봉투 `details.field`+`details.code` 동시 배선** — `spec/5-system/2-api-convention.md`
  §5.3 의 2026-09-11 신규 규칙("`field` 를 실으면 `code` 도 싣는다")을 이동된 6개 함수 전체가
  이미 준수한다. `assertChatChannelInputSafe`·`assertPatchCarriesNoSecrets`·
  `assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider` 의 모든 throw 자리가
  `details: { field: '<name>', code: ErrorCode.INVALID_FIELD }` 형태이고, 테스트도
  `res?.details` 를 `toEqual({ field, code: 'INVALID_FIELD' })` 로 단언해 형태를 고정한다.
  `translateSetupChannelError` 는 top-level 을 도메인 특화 코드(`BOT_TOKEN_INVALID`/
  `CHAT_CHANNEL_SETUP_FAILED`)로 교체하고 `details: { reason }` 만 실어 `field` 가 없다 —
  같은 §5.3 이 규정한 "`field` 없는 진단 payload 는 대상 아님" 갈래에 정확히 해당해 규칙 저촉 없음.
- **top-level 특화 코드의 카탈로그 등재** — `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 는
  `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표(도메인 spec)에 이미 등재돼 있다(이 PR
  이전부터, `#1318`/main 에 이미 병합). 이동으로 새로 발행되는 코드가 아니므로 §5.3 의 "등재
  의무" 충족 상태에 변화 없음.
- **리뷰 인용 형식** — 이동된 파일·신규 스펙 파일의 인용 4건(`review/code/2026/09/10/23_55_23 W4`
  등) 전부 `spec/conventions/review-citations.md` §2 가 권장하는 **전체 경로+날짜+지적번호**
  형태다. bare `hh_mm_ss` 없음.
- **감사·Redis·secret-store 등 인접 규약** — 이 diff 는 감사 액션·Redis 키·secret ref 형식을
  전혀 건드리지 않는다(순수 검증 로직 이동). `SS-SE-01`(`stripChatChannelPlaintext`) 인용은
  코드·주석 그대로 이동해 원문과 계속 일치.
- **파일 명명** — `chat-channel-input-rules.ts` 는 같은 폴더의 `chat-channel-rejection-messages.const.ts`
  ·`chat-channel-token-rotator.service.ts` 와 동일한 kebab-case 규칙을 따른다. `.service.ts`
  접미사를 붙이지 않은 것은 Nest provider 가 아니라는 설계 판단(외부 협력자 의존 0, 파일
  docstring 에 근거 명시)과 일치하며, 이 저장소에 "모든 모듈 파일은 접미사 필수" 를 강제하는
  명명 규약은 확인되지 않았다.
- **`spec/` 쓰기 권한 경계** — 이동으로 `spec/4-nodes/7-trigger/providers/{slack,discord}.md`
  의 `TriggersService.assertInboundSigningPlaintextByProvider` 표기 2곳이 부정확(클래스 접두
  stale)해졌음을 plan 이 스스로 실측했으나, developer 는 그 문장을 쓴 사람이 아니므로
  (`git blame` 상 이전 planner 턴 작성) **자기-반증형 소정정 조건 1 불성립**을 정확히 판정해
  spec 을 직접 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  planner 사안으로 등재했다 — CLAUDE.md 의 역할 경계(`developer` 는 `spec/` read-only, 좁은
  예외 미충족 시 planner 위임)를 정확히 지킨 사례.

## 참고 — 이 diff 밖의 기존 갭 (재발 아님, 조치 불필요)

- `--impl-prep`(`review/consistency/2026/09/11/14_59_33`) 이 지적한 "`CHAT_CHANNEL_*`/`BOT_TOKEN_INVALID`
  등 신규 6종이 `3-error-handling.md §1` 카탈로그에 미등재"는 `#1318`(이 브랜치의 merge-base,
  이미 `origin/main`)에서 만들어진 gap 이며 이번 diff(코드 전용, spec 델타 0)의 대상이 아니다.
  plan 도 이를 "W3, planner 사안, 이 리팩터와 무관한 기존 갭"으로 정확히 분류해 트래커에 넘겼다.
  재확인을 위해 다시 CRITICAL/WARNING 으로 올리지 않는다 — 이 라운드가 만들거나 악화시킨 것이
  아니다.

## 요약

이번 diff 는 spec 을 전혀 건드리지 않는 순수 코드 이동(동작 보존)이며, 이동된 로직은 바로
전날(2026-09-11) `2-api-convention.md §5.3` 에 갓 성문화된 "details.field 실으면 code 도"
규칙을 이미 완전히 준수한 상태로 옮겨졌다. 리뷰 인용 형식·감사/시크릿 관련 인접 규약·파일
명명·spec 쓰기 권한 경계 모두 위반 없이 확인됐다. 사전 존재하던 에러코드 카탈로그 미등재
갭은 이 diff 의 책임 범위 밖이며 plan 이 이미 올바르게 planner 트래커로 위임해 두었다.

## 위험도

NONE
