# 문서화(Documentation) Review

## 리뷰 대상
- `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts` — 모듈 JSDoc 정정
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — `maybeNotifyIgnored` 테스트 2건 추가
- `plan/in-progress/eia-command-waiting-surface-guard.md` — F-6 handler 개수 정정 (4개→3개)

## 발견사항

- **[INFO]** `markdown-v2.ts` JSDoc 정정은 실제 구현과 정확히 일치함 (검증 완료)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts:6-13`
  - 상세: 정정 전 문구("여기 단일 정의하고 양쪽이 import 한다")는 부정확했다 — 렌더러
    (`providers/telegram/telegram-message.renderer.ts:27`)는 실제로 `MARKDOWN_V2_SPECIAL_CHARS` 를
    import 하지 않고 자체 리터럴 정규식 `MD_V2_ESCAPE_REGEX`를 유지한다. 정정된 문구("DTO 검증기는
    직접 import, 렌더러는 자체 regex + test-guarded 동등성")는 실측과 일치함을 확인했다: DTO
    (`triggers/dto/chat-channel-config.dto.ts:20`)는 이 파일의 `firstUnescapedMarkdownV2Special`
    (내부적으로 `MARKDOWN_V2_SPECIAL_CHARS` 사용)을 import 하고, `markdown-v2.spec.ts:37-49`
    ("MARKDOWN_V2_SPECIAL_CHARS ↔ escapeMarkdownV2 계약")가 두 정의의 문자 집합 동등성을
    실제로 강제한다. spec 문서(`spec/5-system/15-chat-channel.md:263`)도 동일하게
    `firstUnescapedMarkdownV2Special` 를 공유 SoT 로 명시해 정합. 오래된 주석(stale comment)을
    바로잡은 좋은 수정이며 추가 조치 불필요.
  - 제안: 없음 (승인)

- **[INFO]** `hooks.service.spec.ts` 신규 테스트 2건의 설명 주석이 실제 동작과 일치
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:831-873`
  - 상세: "F-4 — private unsupported → unsupportedMessageKind 안내 발송" 및 "F-4 — from.is_bot=true
    → silent skip" 두 테스트의 인라인 주석은 `hooks.service.ts:789-819` 의 `maybeNotifyIgnored` 실제
    분기(그룹/봇/기타 3-way)와 기존 JSDoc("봇 자기 메시지는 silent skip. 그 외(group, unsupported)는
    안내 발송 후 무시")에 정확히 대응한다. 종전엔 group 케이스만 테스트되고 private-unsupported·
    is_bot 분기는 미검증이었던 커버리지 갭을 메운 것으로, 코드 변경 없이 기존 계약을 실증하는
    성격이라 별도 CHANGELOG 갱신은 불필요하다는 판단이 타당하다.
  - 제안: 없음 (승인)

- **[INFO]** `plan/in-progress/eia-command-waiting-surface-guard.md` F-6 handler 개수 정정 확인
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md:1564` (F-6 체크리스트)
  - 상세: "WS gateway 4개 handler" → "WS gateway 3개 handler" 로 정정됐고, 항목에 실제로 나열된
    핸들러는 `handleSubmitMessage`/`handleEndConversation`/`handleClickButton` 3개뿐이다(코드베이스
    gateway 파일에는 `handleSubmitForm` 도 존재하나 nodeId 를 forward 하지 않는 별도 케이스로 같은
    문단에 "미제공(`submit_form`...)이면 skip"로 이미 구분 서술되어 있어 3개 카운트가 정확하다).
    plan 문서 정확성 정정으로 적절함.
  - 제안: 없음 (승인)

## 요약
본 델타는 세 곳 모두 "정확성 정정" 성격의 순수 문서/테스트 보강으로, 실측 코드(렌더러 regex,
DTO import, gateway handler 목록)와 대조한 결과 세 정정 모두 실제 구현과 일치함을 확인했다.
markdown-v2.ts JSDoc은 이전의 부정확한 "양쪽 import" 서술을 "DTO import + 렌더러
test-guarded 동등성"으로 바로잡아 오래된 주석 문제를 해소했고, hooks.service.spec.ts 는 기존
`maybeNotifyIgnored` JSDoc이 이미 명시한 분기(그룹/봇/기타) 중 미검증이던 두 경로에 대한 회귀
가드를 추가해 테스트-문서 정합을 높였다. plan 파일의 handler 개수 정정도 실제 목록과 일치한다.
API/README/환경변수/CHANGELOG 영향이 없는 순수 정확도 개선이라 추가 조치가 필요한 문서화 이슈는
발견되지 않았다.

## 위험도
NONE
