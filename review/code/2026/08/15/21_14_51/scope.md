# 변경 범위(Scope) 리뷰 — ws-event-types-extract (누적 브랜치 diff, origin/main...HEAD)

## 검토 방법

프롬프트에 실린 diff(98개 파일, 크기 제한으로 다수 생략)에 더해 `git diff origin/main...HEAD --stat`
(98개 파일, 총 +6787/-319)로 전체 목록을 실측하고, 이번 라운드에서 새로 추가된 3개 커밋
(`a6d764ac6`, `e8585b574`, `fa1bca013`)을 `git show`로 직접 열어 대조했다. 이 3개 커밋은 이전
scope 리뷰(`19_27_37`/`20_05_17`/`20_27_08`/`20_50_49`, 전부 NONE 판정)가 커버하지 못한 신규분이다.
대조 대상 plan: `plan/in-progress/ws-event-types-extract.md`(`websocket.service`의 런타임 값을
의존성-프리 모듈로 분리, `spec_impact: none`).

## 발견사항

- **[INFO]** 회귀 가드(`websocket-events.types.spec.ts`)가 리뷰 4라운드에 걸쳐 "타입 추출"이라는
  원래 범위보다 훨씬 큰 318줄짜리 자체 TS-AST 정적 분석 스위트로 성장했다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체 (마지막
    개편은 커밋 `fa1bca013`, `moduleRefs` 함수 도입부는 118번째 줄)
  - 상세: plan(`ws-event-types-extract.md`)의 원래 조치 목록은 "선언을 의존성-프리 모듈로
    옮기고 22곳의 import 경로를 갱신"이다. 그런데 구현 중 리뷰가 `websocket.gateway.ts`가
    전환에서 빠진 것을 지적한 뒤(`19_27_37`), 그 재발을 막기 위해 도입한 정적 가드 자체가
    다시 3라운드 연속(`20_05_17`→`export…from` 미검출, `20_27_08`→별칭 판정 오류,
    `20_50_49`→`require()` 미검출) 결함을 드러냈고, 매 라운드 가드 코드를 고치는 커밋이
    이어졌다. 결과적으로 이 파일 하나가 커밋 `aedea7d63`(최초 130줄) →
    `65da1a9d7`(가드 신설) → `a6d764ac6` → `e8585b574` → `fa1bca013`(현재 318줄, `moduleRefs`
    로 전면 재구성)까지 5차례 편집을 거쳤다. 이는 "값/타입 선언 이동"이라는 최초 범위 서술만
    보면 과대해 보이지만, plan `## 이 리팩터의 검증 가능성` 섹션이 역재현(reverse-repro)을
    이 작업의 명시적 성공 기준으로 미리 못박아 뒀고, 매 확장이 직전 라운드 `/ai-review`의
    구체적 지적(프로브로 실증된 미검출 사례)에 대한 직접 대응이라 임의 기능 확장(over-engineering)
    으로 보기는 어렵다. 파일도 정확히 이 리팩터가 세우는 불변식(순환 재편입 방지)만 검증하며,
    다른 도메인으로 번지지 않았다.
  - 제안: 조치 불필요 — 이미 plan에 5차례 반복의 근거(뮤테이션 결과표 포함)가 기록돼 있고
    최종 구조(`moduleRefs` 단일 열거)가 "형태별로 패치"에서 "의미 기반 판정"으로 전환해 다섯
    번째 재발 가능성을 구조적으로 줄였다. 다만 병합 전 사람 리뷰어가 "이 정도 정적 가드 인프라를
    이 refactor PR에 포함할지"를 한 번은 명시적으로 승인하는 것을 권장(정책적 판단이지 코드
    결함은 아님).

- **[INFO]** 최근 3개 커밋(`a6d764ac6`/`e8585b574`/`fa1bca013`)의 코드 변경분은 전부 가드
  신호 정합성(`import type` 표시)과 가드 파일 자체로 국한되며, 무관 파일·기능 확장은 없음
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`,
    `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts`,
    `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (이상 3곳은
    `ExecutionChannelEvent` import 에 `type` 키워드만 추가), `codebase/backend/src/modules/
    execution-engine/execution-engine.service.ts`(`ChatChannelRoutingInfo`),
    `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    /`.spec.ts`(`ExecutionRoutingContext`), `codebase/backend/src/modules/websocket/
    websocket.service.spec.ts`(`ExecutionChannelEvent`), `codebase/backend/src/nodes/ai/
    ai-agent/ai-turn-executor.ts`(`ToolCallCompletedPayload`/`ToolCallStartedPayload`) — 전부
    이미 값이 아닌 타입 전용 심볼에 `type` 표시를 붙이는 1줄 수정
  - 상세: `git show`로 세 커밋의 전체 diff를 직접 대조한 결과, 로직 변경은 전혀 없고 (1) 가드의
    `isTypeOnly` 판별 신호를 흐리지 않기 위한 `import type` 보정, (2) `websocket.service.ts`의
    stale 주석("바로 아래 KB union" → "당시 뒤따르던 선언" — 리팩터 자신이 그 선언을 다른
    파일로 옮기며 생긴 stale 참조를 직접 수정) 뿐이다. frontend, 설정 파일, 무관 모듈은
    등장하지 않는다.
  - 제안: 없음 — 범위 내.

- **[INFO]** `TERMINAL_SHAPE` 모듈-스코프 상수 복원은 이번 라운드가 아니라 초기 커밋
  (`65da1a9d7`/이전 라운드)에 포함된 것으로, 이번 diff에서 재확인만 했다 — scope 신규 이슈 아님
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (프롬프트 게이트 71-84행, `TERMINAL_SHAPE` 선언부)
  - 상세: 이전 scope 리뷰(`19_27_37/scope.md`)가 이미 이 항목을 "plan이 성공 기준으로 명시한
    역재현 검증 항목이라 scope creep 아님"으로 판정했고, 이번 3개 신규 커밋에서는 이 파일에
    로직 변경이 추가되지 않았다(가드 신호 보정 1줄만). 기존 판정을 뒤집을 근거 없음.
  - 제안: 없음.

## 스코프 밖 변경 여부 판정

98개 변경 파일 전체 stat과, 이전 라운드가 못 본 3개 신규 커밋의 전체 diff를 직접 대조했다.
frontend·설정 파일(`package.json`/`.eslintrc`/CI 워크플로)·무관 모듈은 diff에 전혀 등장하지
않는다. 코드 파일 변경은 (a) 22개 소비 지점의 import 경로 기계적 치환, (b) 그 경로 전환이
드러낸 순환 잔여 노드(`websocket.gateway.ts`) 수정, (c) 전환의 무결성을 지키는 정적 가드
1개 파일의 반복적 하드닝, (d) 가드가 요구하는 `import type` 표시 보정 몇 줄 — 이 네 갈래로
전부 설명되며, plan(`ws-event-types-extract.md`)의 `## 범위 밖` 절(`WebsocketService` 책임
분리 아님·`forwardRef` 제거 아님)과 실제 diff가 일치한다. plan/review 문서 변경은 이 리팩터
자신이 유발한 stale 참조 정정과 프로젝트 표준 워크플로(`/ai-review`+`consistency-check`)
의무 산출물이다. 불필요한 리팩터링·기능 확장(가드 자체는 예외적으로 크지만 plan이 사전
계획한 성공 기준)·무관한 파일 수정·포맷팅 혼입·주석/임포트 드라이브-바이 정리는 발견되지
않았다.

## 요약

이번 라운드에서 새로 추가된 3개 커밋(`a6d764ac6`/`e8585b574`/`fa1bca013`)을 포함해 브랜치
전체(origin/main...HEAD, 98개 파일)를 대조한 결과, 이 PR은 plan이 선언한 범위 — `websocket
.service.ts`의 값/타입 선언을 의존성-프리 모듈로 추출하고 소비 지점의 import를 갱신 — 를
정확히 지킨다. 유일하게 주목할 지점은 그 전환의 정합성을 지키는 정적 가드
(`websocket-events.types.spec.ts`)가 리뷰 4라운드에 걸쳐 318줄짜리 AST 파서 기반 스위트로
성장한 것인데, 매 확장이 직전 라운드 리뷰가 프로브로 실증한 구체적 미검출(export…from,
별칭, require())에 대한 대응이고 plan이 역재현을 사전에 성공 기준으로 못박아 둔 것이라
scope creep으로 보기 어렵다. 신규 3개 커밋의 코드 변경분은 전부 `import type` 표시 보정과
가드 파일 자체로 국한되며 무관 파일·기능 확장·설정 변경은 없다.

## 위험도

LOW
