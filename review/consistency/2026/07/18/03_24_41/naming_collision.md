# 신규 식별자 충돌 검토

검토 대상: `spec/7-channel-web-chat/` (--impl-done, diff-base `origin/main`=`29aa918a6`, 실제 코드 SoT = 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4`)

## 검증 방법

이번 PR 의 spec 변경은 `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 목록에 증거 경로 2줄을 추가한 것뿐이라
(본문 프로즈 변경 없음), "target 문서가 새로 도입하는 식별자"의 실질은 spec 이 아니라 **코드**에 있다. 워킹트리에서
`git diff 29aa918a6..HEAD -- codebase/` 로 변경 파일을 확정한 뒤(`use-widget.ts`·`widget-state.ts`·두 테스트
파일·`CHANGELOG.md`·plan 3건), diff 의 `+` 라인에서 신규 선언(`const`/`useCallback`/`useRef`)을 전수 추출했다.
오케스트레이터가 지목한 7개 식별자(`sessionEstablished`·`bootGenRef`·`beginBootAttempt`·`cannotApplyConfig`·
`isAttemptStale`·`establishConfig`·`allowWhileStreaming`) + 추가로 발견한 `unmountedRef` 총 8개가 이 diff 가
도입하는 신규 식별자의 전체 집합임을 확인했다(diff 밖에는 새 선언 없음). 각 식별자를 `git grep`으로
`codebase/backend`·`codebase/frontend`·`codebase/packages`·`codebase/channel-web-chat`(대상 두 파일 제외) 전역에
대해 스캔해 기존 사용처와의 충돌 여부를 확인했다.

## 발견사항

충돌(CRITICAL/WARNING) 없음. 아래는 참고용 INFO 2건.

- **[INFO]** plan 파일명 근접 — `webchat-usewidget-extraction.md` vs 완료된 `webchat-usewidget-split.md`
  - target 신규 식별자: `plan/in-progress/webchat-usewidget-extraction.md` (새 파일)
  - 기존 사용처: `plan/complete/webchat-usewidget-split.md` (2026-06-28 완료, PR #744/#737 계열 — `useWidget()`
    에서 `useTokenRefresh`/`usePendingMessageQueue` 를 추출한 선행 리팩터)
  - 상세: 두 문서 모두 "`useWidget()` God hook 을 쪼갠다"는 동일 주제를 다루지만 대상 로직이 다르다 —
    `split.md` 는 토큰 갱신·pending 메시지 큐, 신규 `extraction.md` 는 이번 PR 이 도입한 세션 확립/staleness
    축(`worldGenRef`/`bootGenRef`/`unmountedRef`/`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`/
    `sessionEstablished`/`establishConfig`)을 `useEiaSession`(가칭) 으로 뽑자는 제안이다. 이름이
    "split" vs "extraction" 으로만 갈려 검색·회고 시 두 작업을 헷갈릴 여지가 있다. 다만 신규 문서 본문이
    자신을 `webchat-boot-single-flight.md` 산문 이월에서 분리했다고 명시하고, split.md 를 직접 언급하지는
    않지만 대상 코드(같은 파일)·시점(선행 완료 리팩터)이 자명해 실질 혼선 위험은 낮다.
  - 제안: 추가 조치 불요(현행 유지 가능). 다만 이 plan 을 착수할 때 도입부에 "선행 `webchat-usewidget-split.md`
    (완료, 토큰갱신/큐 추출)와 대상이 다름" 한 줄을 명시하면 plan 완료 이동 시점의 혼동을 예방할 수 있다.

- **[INFO]** predicate 명명 스타일 비일관 — `cannotApplyConfig`/`establishConfig` vs `is*` 계열
  - target 신규 식별자: `cannotApplyConfig`(boolean 반환), `establishConfig`(`"reset"|"continue"` 반환),
    `sessionEstablished`(boolean 반환)
  - 기존 사용처: 같은 파일 내 기존 `isStale`(pre-existing) 및 이번 PR 이 나란히 도입한 `isAttemptStale`
    — 둘은 `is` 접두 boolean predicate 관례를 따른다
  - 상세: `cannotApplyConfig`(`cannot` 접두)·`sessionEstablished`(형용사형 상태명, `is` 없음)는 인접
    predicate 군의 `is`/`has` 접두 관례와 스타일이 다르다. 이는 "다른 의미로 이미 쓰이는 이름과의 충돌"이
    아니라 순수 스타일 비일관이라 본 체크리스트의 엄밀한 "충돌"에는 해당하지 않는다.
  - 제안: 조치 불요 — 이미 `review/code/2026/07/18/01_44_21/maintainability.md`(§`sessionEstablished()`
    네이밍) 라운드에서 정확히 이 지점을 독립적으로 검토해 "가독성 손실 미미"로 결론짓고 종결한 사안이다.
    재조치를 요구하지 않음. 참고로만 기록.

## 교차 확인 — 충돌 없음 확정 근거

- **요구사항 ID**: 이번 diff 는 spec 본문(요구사항 ID·`§`섹션)을 변경하지 않는다(frontmatter `code:` 경로
  추가뿐). 신규 요구사항 ID 없음.
- **엔티티/타입명**: 신규 선언 8개 전부 `useWidget()` 훅 클로저 내부의 `const`(useCallback/useRef) 로, 모듈
  export 목록(`safeApiBaseFromQuery`, `useWidget`, 재-export 3종)에 포함되지 않는다 — 외부에서 import 불가능한
  범위. `git grep`으로 `codebase/backend`·`codebase/frontend`·`codebase/packages` 전체를 스캔한 결과 8개
  식별자 모두 0건 — 다른 도메인에서 재사용되거나 다른 의미로 쓰이는 사례 없음. `channel-web-chat` 내에서도
  `use-widget.ts`(정의)·`use-widget-eager-start.test.ts`(같은 대상을 참조하는 페어 테스트) 외 파일에는 등장하지
  않음. 새로 등장한 타입은 없다(모두 인라인 익명 객체 `{ world: number; boot: number }` 또는 기존
  `SeedOutcome`(pre-existing, 82행) 재사용 — 신규 `type`/`interface` 선언 0건).
- **API endpoint**: 신규 endpoint 없음(diff 에 `fetch`/`POST /`/`GET /`/`new URL` 등 신규 literal 없음 —
  기존 `EiaClient`/`isEmbedAllowed` 호출부 재사용).
- **이벤트/메시지명**: 신규 SSE/webhook/postMessage 이벤트명 없음. `allowWhileStreaming` 은 이벤트명이 아니라
  `seedWaitingFromStatus` 의 opts 파라미터 프로퍼티(로컬 함수 시그니처)이며, 호출부 2곳
  (`handleEiaEvent`replay_unavailable 폴백 / 기본값)에서만 쓰이고 다른 곳에 같은 이름의 옵션이 없다.
- **환경변수·설정키**: 신규 env/config key 없음(diff 에 `process.env`/`NEXT_PUBLIC_` 신규 참조 없음).
- **파일 경로**: 신규 파일은 plan 문서 3건(`webchat-boot-single-flight.md`·
  `webchat-command-failure-is-not-termination.md`·`webchat-usewidget-extraction.md`) — `git ls-files
  "plan/**/webchat-*"` 로 전수 대조해 기존 11개 `webchat-*` plan 파일과 경로 중복 없음, 명명 컨벤션
  (`webchat-<주제>.md`, kebab-case) 도 일치. 코드 파일은 기존 파일 수정만(신규 파일 생성 없음).
- **"single-flight" 용어 재사용(참고, 비충돌)**: `codebase/backend/.../execution-engine.service.ts` 가
  이미 "single-flight"(LLM default config 캐시 중복 호출 억제)라는 동일 일반 용어를 쓰지만, 이는 잘 알려진
  범용 동시성 패턴 명칭(중복 concurrent 호출 억제)이 두 무관한 하위시스템에 각자의 의미로 자연스럽게 쓰인
  것이며, 본 PR 이 backend 코드를 건드리지도 않고 새로 만든 용어도 아니다(백엔드 쪽은 이 PR 이전부터 존재).
  충돌로 판단하지 않음.

## 요약

이번 PR(`webchat-boot-single-flight`)이 도입한 신규 식별자는 `sessionEstablished`·`bootGenRef`·
`beginBootAttempt`·`cannotApplyConfig`·`isAttemptStale`·`establishConfig`·`allowWhileStreaming`·
`unmountedRef` 8개이며, 전부 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `useWidget()` 훅
내부 지역 스코프(export 되지 않음)에 한정된다. 저장소 전역(`backend`/`frontend`/`packages`/`channel-web-chat`
나머지 파일) 대비 `git grep` 전수 대조 결과 8개 식별자 모두 사전 사용례가 0건이라 실질적인 이름 재사용·의미
충돌은 없다. spec 쪽은 frontmatter 증거 경로 추가뿐이라 신규 요구사항 ID·엔티티·endpoint·이벤트명·env
key 도 전혀 도입되지 않았다. 발견한 2건은 모두 INFO 수준의 근접성/스타일 노트이며 그중 하나(predicate 명명
스타일)는 이미 별도 ai-review 라운드에서 검토·종결된 사안이라 실질적으로는 신규 지적이 아니다. 이 PR 은
이미 다수의 `/ai-review` 라운드(18_39_11·23_58_23·00_51_53·01_44_21·02_25_54·03_04_45)를 거치며 naming/
maintainability 축도 반복 검증됐다는 점도 이 결론과 부합한다.

## 위험도

NONE
