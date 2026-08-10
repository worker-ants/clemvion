# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `seedWaitingFromStatus` JSDoc 안에 "이중 스트림은 **호출부의 짝 가드**가 막는다" 는
  옛 아키텍처 서술이 갱신되지 않고 남아, 같은 JSDoc 블록 안에서 자기모순을 일으킨다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:457`(및 `:463`) — `seedWaitingFromStatus`
    함수 JSDoc, "**이 seed 가드는 "표면 되감기" 만 막는다. "이중 스트림" 은 호출부의 짝 가드가 막는다.**"
    문장과 "그 짝 가드로 낭비성 두 번째 EventSource 생성 자체를 없앤다" 문장(직접 `Read` 로 현재
    소스에서 확인한 실제 줄 번호. `git blame` 확인 결과 이 두 줄은 2026-07-18 커밋 `2d9d202188`
    에서 작성된 채 이번 리팩터(오늘 최신 커밋 `bf8d71802`, 13:17)에도 갱신되지 않았다).
  - 상세: 이번 diff(및 그 직전 커밋들)로 "이중 스트림 방지" 가드는 호출부(`start()`/`applyConfig`)에
    손으로 복제된 재확인에서 `openStream()` **내부** 단일 게이트로 이동했다. `use-widget.ts` 자신의
    `openStream` JSDoc(`:367-370`)과 바로 이 `seedWaitingFromStatus` JSDoc 의 몇 줄 아래(`:466-468`,
    "종전에는 그 재확인이 두 호출부에 **손으로 복제된 3줄**이었다... 게이트를 `openStream` 안으로
    옮겨 **구조적으로 강제**한다")가 이 새 구조를 정확히 서술하는데, 바로 위 `:457` 문장은 여전히
    "이중 스트림은 **호출부의** 짝 가드가 막는다" 라고 옛 구조를 단언한다 — 같은 JSDoc 블록 안에서
    "호출부가 막는다"(`:457`)와 "손 복제를 없애고 `openStream` 안으로 옮겼다"(`:466-468`)가 정면으로
    충돌한다. `spec/7-channel-web-chat/3-auth-session.md` §R7 의 거의 동일한 문장("이 가드는 '표면
    되감기'만 막는다. '이중 스트림'은 호출부의 짝 가드가 막는다")은 이번 커밋(`bf8d71802`, 커밋
    메시지 자체가 "JSDoc·spec 의 옛 아키텍처 서술 정정")에서 "스트림 열기 자체가 막는다" 로 정확히
    갱신됐고, `use-widget.ts` 안의 다른 두 곳(`:365`·`:462`, 선행 `ai-review 12_48_08 documentation`
    WARNING 대상)도 `false`→`"already_owned"` 로 이미 정정됐다 — 그런데 정확히 같은 성격의 세 번째
    지점(`:457`)만 이번에도 놓쳤다. 이 코드베이스가 스스로 여러 차례 "주석/JSDoc drift 로 반복
    결함을 냈다"고 기록해 온 바로 그 패턴이, 그 패턴을 정정하려는 이번 diff 안에서 또 재발한
    사례다. 다음에 이 SSE 이중 오픈 방지 로직을 만지는 사람이 `:457` 문장만 읽으면 "게이트가
    호출부에 있다"고 오판해 호출부에 재확인을 다시 손으로 복제하려 들 위험이 실질적이다.
  - 제안: `:457` 을 "**이 seed 가드는 "표면 되감기" 만 막는다. "이중 스트림" 은 `openStream()`
    진입 시점의 소유권 재확인이 막는다**" 류로, `:463` 의 "그 짝 가드로" 도 "그 게이트로" 로 갱신해
    바로 아래 `:466-468` 문단·`openStream` 자신의 JSDoc·`spec/7-channel-web-chat/3-auth-session.md`
    §R7 정정본과 일치시킨다.

- **[INFO]** (검증 결과, 문제 없음) 선행 라운드(`12_39_25`·`12_48_08`)가 지적한 문서화 WARNING —
  `start()` `useCallback` 의존성 배열의 미사용 `sessionEstablished` 잔재, `openStream`/
  `seedWaitingFromStatus` JSDoc 의 "false" 잔존 표현(`:365`·`:462`), 회귀 테스트 주석의 옛 구조
  서술 — 은 모두 현재 소스에서 직접 확인한 결과 정확히 반영돼 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:634`(의존성 배열),
    `:365`·`:462`(`"already_owned"` 로 정정됨),
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3408`(주석 갱신)
  - 상세: 반복 재발한 이 파일의 "주석 drift" 클래스가 대부분 정정됐음을 실측으로 확인했다. 위
    WARNING 항목(`:457`)만 같은 정정 작업에서 누락된 유일한 잔여 지점이다.
  - 제안: 조치 불요, 참고 기록.

- **[INFO]** `plan/in-progress/webchat-reload-rest-error-branches.md` 는 새 계획 문서로서 자기수정
  이력("최초 작성에서 이 절을 '결정이 필요한 항목' 이라 적었다가 같은 날 정정")까지 투명하게
  남겨 CLAUDE.md `## Rationale`/plan 라이프사이클 규약이 요구하는 "결정의 배경" 기록 수준이 높다.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md` §"왜 등재하는가" 및 §"미구현 항목"
    상단 blockquote
  - 상세: `spec/7-channel-web-chat/3-auth-session.md` frontmatter `status: partial` + `pending_plans:`
    정정과 신설 plan 사이의 양방향 링크(spec → plan, plan → spec 파일명)도 직접 확인해 정합한다.
    별도 조치 불필요.
  - 제안: 없음.

## 요약

이번 diff 는 SSE 스트림 소유권 게이트를 호출부 손 복제 코드에서 `openStream()` 내부 단일 지점으로
옮기는 리팩터의 후속 라운드로, 선행 ai-review 두 차례(`12_39_25`·`12_48_08`)가 지적한 문서화
WARNING(미사용 의존성, `false`→`"already_owned"` JSDoc 불일치, 회귀 테스트 주석 drift, spec §R7
"호출부의 짝 가드" 서술)를 실제 소스·spec 파일 대조로 확인한 결과 대부분 정확히 반영됐다. 다만
`seedWaitingFromStatus` 자신의 JSDoc(`use-widget.ts:457`·`:463`) 에 정확히 같은 클래스의 세 번째
지점이 남아, 같은 JSDoc 블록 안에서 "이중 스트림은 호출부가 막는다"(옛 구조)와 "게이트를
`openStream` 안으로 옮겼다"(현재 구조)가 직접 충돌한다 — 이 프로젝트가 반복 경계해 온 "주석/JSDoc
drift" 패턴이 그 패턴을 정정하려던 바로 이 diff 안에서 다시 한 번, 이번엔 다른 위치에서 재발한
사례다. `plan/`·`spec/` 문서 갱신(신설 plan, frontmatter `status`/`pending_plans`, §R4 Planned 고지)은
모두 실측 대조 결과 정확하고 투명하다. 차단 사유는 아니나 다음 유지보수자가 옛 문장만 읽고 오판할
실질적 위험이 있어 WARNING 으로 보고한다.

## 위험도

LOW
