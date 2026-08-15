# 변경 범위(Scope) 리뷰 — ws-event-types-extract (3차 fresh review)

## 검토 방법

`git log --oneline -15` + `git diff origin/main...HEAD --stat` (73개 파일, +3909/-313)로 브랜치
전체 변경 목록을 실측했다. 이번 라운드는 2차 코드 리뷰(`20_05_17`, Warning 2·INFO 1)와 2차
consistency 검토(`20_05_19`, BLOCK:NO)에 대한 fix 커밋(`a6d764ac6`)까지 포함한 fresh 재검토다.
1차(`19_27_37`)·2차(`20_05_17`) scope 리뷰 모두 위험도 NONE으로 결론 냈으므로, 이번 라운드는
그 결론을 그대로 승계하지 않고 **직전 두 라운드가 보지 못한 델타**(fix 커밋 `a6d764ac6`)를
`git show a6d764ac6`로 직접 대조했다:

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`,
  `notification-fanout.service.ts`, `sse-adapter.service.ts` (W1 — `import type` 부여)
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (W2 — 가드 일반화)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (INFO1 — stale 주석 정정)
- `plan/in-progress/ws-event-types-extract.md` (fix 근거·후속 항목 기록)

## 발견사항

- **[INFO]** fix 커밋(`a6d764ac6`)의 코드 변경 5건 전부가 직전 라운드 리뷰/consistency 지적사항에
  1:1 대응한다 — 새 스코프 확장 없음
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`,
    `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts`,
    `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (각각
    `ExecutionChannelEvent` import 를 `import type` 으로 전환 — `20_05_17` W1),
    `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
    (`valueEdgeToWebsocketService` 헬퍼 도입, 세 번째 테스트가 `ts.isImportDeclaration` 만
    순회하던 것을 `export … from`·`export * from`·namespace·side-effect·`import = require` 5개
    형태까지 확장 — `20_05_17` testing W2), `codebase/backend/src/modules/websocket/websocket.service.ts`
    (`121-127` 라인 주석의 "바로 아래 KB union 문서" 참조가 `KbEventType` 이동으로 stale 해진 것을
    "당시 뒤따르던 선언의 문서" 로 파일-불변 표현으로 정정 — `20_05_17` INFO1).
  - 상세: `git show a6d764ac6`로 코드 diff 전체(파일 5개, +/-30줄 내외)를 직접 대조한 결과, 새
    기능·새 파일·무관한 모듈 수정은 없다. 테스트 가드 확장은 이 리팩터 자신이 신설한 회귀 가드의
    **미검출 버그를 고치는 것**이라 가드의 존재 목적(#1174 재발 방지) 안에 있다.
  - 제안: 없음 — 조치 불필요.

- **[INFO]** plan 문서(`ws-event-types-extract.md`)의 후속 목록이 1곳→6곳으로 확장됐지만, 이는
  스코프 확장이 아니라 이전 스코프 누락의 정정이다
  - 위치: `plan/in-progress/ws-event-types-extract.md` `## 후속 (이 PR 범위 밖)` 절
  - 상세: 이번 diff가 `KbEventType` 정본 위치 stale 서술을 `10-graph-rag.md:552` 한 줄에서
    `spec/5-system/8-embedding-pipeline.md:276`·`6-websocket-protocol.md:740,1034`·
    `spec/data-flow/6-knowledge-base.md:288`·`spec/data-flow/0-overview.md:110` 까지 6곳으로
    확장 등재했다(`20_05_19` plan_coherence W1 대응). 이 항목들은 모두 **"이 PR 범위 밖"** 체크박스로
    남아 실제 spec 파일은 건드리지 않는다 — `spec/` 는 developer 권한 밖(read-only)이라는 원칙을
    지키면서 planner 턴으로 정확히 이관됐다. `NotificationEventType` 개명 항목도 신설됐지만 이 역시
    체크박스 미체크 상태의 후속 등재일 뿐 실제 개명 코드는 없다.
  - 제안: 없음 — 실제 코드 변경이 아니므로 스코프 판정에 영향 없음.

- **[INFO]** 직전 두 라운드의 scope 판정(`19_27_37/scope.md`, `20_05_17/scope.md`) 근거를 재확인 —
  `TERMINAL_SHAPE` 모듈 스코프 복원은 이번 라운드에도 유일한 "import-only 가 아닌" 변경
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
  - 상세: `git diff origin/main...HEAD`에서 로직 변경으로 분류될 수 있는 지점은 여전히 이 파일의
    `TERMINAL_SHAPE` 상수 도입(호출 시점 인라인 파생 → 모듈 스코프 상수)뿐이며, plan이 사전에
    "역재현 성공 기준"으로 명시한 항목이라는 이전 두 scope 리뷰의 결론과 이번 실측도 일치한다. 새로
    추가된 코드 경로는 없다.
  - 제안: 없음.

- **[INFO]** 브랜치 전체 diff(73개 파일)에 frontend·무관 도메인 모듈·포맷팅-only 변경은 없다
  - 위치: `git diff origin/main...HEAD --stat` 전체
  - 상세: 변경 파일은 (a) `websocket.service` 값/타입 재배선 대상 22개 backend 소스+spec 파일,
    (b) 신설 `websocket-events.types.ts`/`.spec.ts`, (c) 이 리팩터가 stale 화시킨 4개 plan 문서의
    라인 인용 정정, (d) 신설 plan 문서, (e) `review/code/**`·`review/consistency/**` 두 라운드씩의
    프로세스 의무 산출물(CLAUDE.md가 developer에게 강제하는 `--impl-prep`/`/ai-review`+fix 사이클),
    (f) `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 1줄뿐이다. 이 범주 밖의 파일은
    하나도 없다.
  - 제안: 없음.

## 스코프 밖 변경 여부 판정

이번 라운드에서 새로 관측된 델타(`a6d764ac6`, +코드 5파일·+plan 60줄·+review/consistency 산출물
26개 신규 파일)는 전부 직전 라운드(`20_05_17` 코드 리뷰 W1/W2/INFO1, `20_05_19` consistency
BLOCK:NO 항목들)에 대한 fix이며, 새로운 기능·새로운 외부 의존성·무관한 모듈 수정을 도입하지
않는다. 브랜치 전체를 다시 봐도 plan(`ws-event-types-extract.md`)이 선언한 범위 —
`websocket.service.ts`의 런타임 값/타입 선언을 의존성-프리 모듈로 추출하고 소비 지점의 import를
갱신 — 를 벗어나지 않는다.

## 요약

3차 fresh 리뷰에서도 스코프 이탈은 발견되지 않았다. 이번 라운드의 유일한 실질 델타(fix 커밋
`a6d764ac6`)는 3개 파일의 `import type` 보정, 자신이 신설한 회귀 가드(`websocket-events.types.spec.ts`)
가 놓치고 있던 5가지 값-간선 형태를 마저 잡도록 일반화한 것, stale 주석 1건 정정, 그리고 그 근거를
기록한 plan 갱신뿐이며 전부 직전 리뷰·consistency 라운드의 지적사항에 정확히 대응한다. 실제 코드
로직이 바뀌는 지점은 여전히 `TERMINAL_SHAPE` 모듈 스코프 복원 하나뿐이고, 이는 plan이 사전에
명시한 검증 항목이다. frontend·무관 도메인·포맷팅-only 변경, 의도하지 않은 기능 확장은 발견되지
않았다.

## 위험도

NONE
