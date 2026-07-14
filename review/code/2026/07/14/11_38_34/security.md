# Security Review — F-5 MarkdownV2 toggle-scan 수정 + orphan JSDoc 정리 + 테스트 보강

## 발견사항

- **[INFO]** toggle-scan 알고리즘(`firstUnescapedMarkdownV2Special`) 정확성 검증 — 잔여 우회 없음
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts:178-191`
  - 상세: 이전 `/\\X/` regex 기반 escape-pair 제거 방식은 연속 backslash(`\\!`)에서 두 번째
    backslash 를 예약문자와 잘못 짝지어(첫 backslash 가 미매칭으로 남아 이후 스캔에서도
    특수문자 취급되지 않음) `!` 가 실제로는 unescaped 인데도 검출을 놓치는 우회가 있었다
    (F-5 원래 구현의 결함). 신규 구현은 문자 단위 toggle 스캔으로 `\` 를 만나면 무조건 다음
    1 code unit 을 escape 대상으로 건너뛴다(`i += 2`) — Telegram MarkdownV2 의 실제 의미론
    ("`\` 는 바로 다음 1문자를 escape, 그 문자가 무엇이든")과 정확히 일치한다.
    `a\\\!b`(escaped-backslash + escaped-`!`, 안전) / `lit\\!bang`(escaped-backslash + unescaped-`!`,
    위험) / `a\\.b` 등 홀짝 backslash 개수 경계 케이스를 직접 트레이스해봐도 모두 올바르게
    판정된다. regex 기반 구현이 갖던 ReDoS 표면도 자연스럽게 제거됐다(단순 O(n) 순회).
  - 제안: 없음 — 수정이 견고하다. 다만 아래 두 가지는 참고용 INFO.

- **[INFO]** UTF-16 서로게이트 쌍 인지 부재 (실질적 우회로 이어지지 않음)
  - 위치: `markdown-v2.ts:182-186`
  - 상세: `text[i]` 는 UTF-16 code unit 단위 인덱싱이라, `\` 바로 다음이 astral-plane 문자
    (surrogate pair, 2 code units)면 `i += 2` 로는 해당 문자의 low surrogate 까지만 건너뛰고
    low surrogate 자체가 다음 스캔 시작점이 된다. 다만 low surrogate 는 예약문자 집합에
    포함되지 않는 값이라 오탐/미탐으로 이어지지 않는다(다음 루프에서 그냥 1문자로 건너뜀) —
    직접 트레이스로 확인. 예약문자가 전부 ASCII 인 현재 스펙에서는 보안적으로 영향 없음.
  - 제안: 코드포인트 단위(`Array.from(text)` 또는 `[...text]`) 순회로 바꾸면 완전히 정확해지나,
    현재 위협 모델(ASCII 전용 예약문자 판별)에서는 불필요한 강화. 낮은 우선순위.

- **[INFO]** SoT drift 가드 테스트의 방어 범위
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.spec.ts:69-81`
  - 상세: `MARKDOWN_V2_SPECIAL_CHARS` 의 모든 문자를 `escapeMarkdownV2` 가 실제로 escape 하는지
    양방향으로 검증(집합 일치 + 비특수문자 미escape)하는 계약 테스트가 추가됐다. telegram
    Bot API 예약문자 집합이 변경되어 한쪽(shared 상수 vs renderer 정규식)만 갱신되는 silent
    drift — 결과적으로 검증 우회(신규 예약문자가 검증 대상에서 누락)로 이어질 수 있는 클래스의
    회귀 — 를 CI 에서 조기에 잡아준다. 좋은 방어적 설계다.
  - 제안: 없음.

- **[INFO]** `chat-channel-config.dto.ts` 중복 구현 제거로 drift 위험 축소
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:1-18` (diff)
  - 상세: 기존에 DTO 파일이 자체 리터럴로 `MD_V2_SPECIAL_CHARS`/`firstUnescapedMdV2Special` 를
    재선언하던 것을 shared `markdown-v2.ts` import 로 교체했다. grep 확인 결과 구 구현의 잔재
    (`firstUnescapedMdV2Special`, `MD_V2_SPECIAL_CHARS`, `MD_V2_ESCAPE_PAIR`) 는 코드베이스
    전체에 더 이상 존재하지 않는다 — 우회 가능한 구 버전이 다른 경로로 살아남아 있지 않음을
    확인했다. renderer 의 `MD_V2_ESCAPE_REGEX` 문자 클래스와 shared 상수도 육안 대조 결과 완전
    동일 집합이다.
  - 제안: 없음.

- **[INFO]** execution-engine / hooks.service 변경은 문서·테스트 전용, 동작 변경 없음
  - 위치: `execution-engine.service.ts:5274-5649`(JSDoc만), `hooks.service.ts`(JSDoc 블록 재배치),
    `execution-engine.service.spec.ts`(F-6 회귀 테스트 4건), `hooks.service.spec.ts`(F-4 회귀
    테스트 2건)
  - 상세: `continueButtonClick` / `continueAiConversation` / `endAiConversation` 이
    `expectedNodeId` 를 `resolveWaitingNodeExecutionId` 로 전달해 불일치 시
    `InvalidExecutionStateError` 를 던지는 실제 인가/상태 검증 로직은 이번 diff 이전부터 존재하는
    production 코드이며 본 delta 에서 변경되지 않았다(그대로 확인). 추가된 테스트는 WS 3개
    continue* 진입점 모두가 동일한 nodeId 불일치 방어를 갖는지 좌표계 오연결(인자 순서/이름) 회귀를
    가드하는 정당한 보강이다. hooks.service.ts 의 JSDoc 이동은 orphan 위치에 있던 주석을 올바른
    함수 위로 재배치한 것뿐으로 로직 diff 없음(unified diff 로 삭제·추가 블록 내용이 동일함을 확인).
  - 제안: 없음.

## 요약

이번 delta 의 핵심은 Telegram MarkdownV2 예약문자 미이스케이프 검출기의 regex 기반 구현을
문자 단위 backslash-toggle 스캔으로 교체한 것이다. 직접 케이스 트레이스(연속 backslash 홀/짝
경계, escaped-backslash + unescaped-특수문자 조합 등)로 확인한 결과 이전 regex 우회가 완전히
막혔고, 추가된 회귀 테스트가 정확히 그 우회 시나리오를 커버한다. renderer 의 escape 집합과의
SoT drift 가드 테스트, 구 구현 잔재 제거(grep 으로 재확인)까지 방어적으로 잘 마감됐다.
execution-engine/hooks.service 쪽 변경은 문서 정리와 기존 nodeId 인가 검증에 대한 테스트 보강일
뿐 실제 동작 변경이 없어 신규 보안 리스크가 없다. 하드코딩 시크릿, 인젝션, 인증 우회, 민감정보
노출 등 다른 OWASP Top 10 관점에서도 이번 diff 범위 내 문제는 발견되지 않았다.

## 위험도

NONE
