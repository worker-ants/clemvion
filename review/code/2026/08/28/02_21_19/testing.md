# 테스트(Testing) 리뷰 — `system_error` 배너 라이브 WS 복구 (4라운드, `02_21_19`)

이전 3라운드(`01_26_11`→`01_44_22`→`02_02_18`)에서 지적된 WARNING 은 이번 diff 시점 기준
전부 반영되어 있음을 직접 재확인했다(`direct` 분기 제거, JSDoc 갱신, `wrapNodeHandlerOutput`
빌더 단일화, `!code || !message` 가드 테스트 추가, 단락 평가로 무검증이던
`isMultiTurnAiContext` "이전 대화 없음" 분기 보강). `pnpm exec vitest run
src/lib/websocket/__tests__/use-execution-events.test.ts` 로 **89/89 GREEN** 을 직접
재현했다.

이번 라운드는 기존 발견사항을 되풀이하지 않고, **아직 아무도 뮤테이션으로 짚지 않은 새 갭**을
찾기 위해 소스에 직접 뮤테이션을 넣어(매번 확인 직후 `cp` 로 원본 복원 + `git status`/`diff`
로 clean 확인) 검증했다.

## 발견사항

- **[WARNING]** `extractNodeErrorPayload` 의 `!code || !message` 가드가 **두 개별 항을 가르는
  fixture 가 없다** — `||` → `&&` 뮤테이션에도 89/89 GREEN (직접 실증)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:94` (`if (!code || !message) return null;`)
  - 상세: `01_44_22` 라운드에서 이 가드가 커버리지 0 이라고 지적되어 이번 PR 은 `"[가드]
    구조화 에러에 code/message 가 없으면 배너를 안 띄운다"` 테스트(`use-execution-events.test.ts:2246`
    부근)를 추가했다. 그런데 그 fixture(`error: { details: { retryable: true } }`)는 `code`
    **와** `message` 를 **동시에** 비운다. 그 결과 이 가드가 실제로 방어하는 두 갈래 — "code
    는 있는데 message 만 없음" / "message 는 있는데 code 만 없음" — 는 어느 테스트도 개별로
    겨냥하지 않는다. 직접 뮤테이션으로 실증: `if (!code || !message) return null;` 을
    `if (!code && !message) return null;` 로 치환(원본은 `cp` 로 즉시 백업, 확인 후 `cp` 로
    복원 + `diff` 바이트 일치 + `git status` clean 확인)하고 스위트를 재실행 →
    **89/89 GREEN 유지**. `||`→`&&` 로 바뀌면 "한쪽만 없는" 두 케이스에서 실제로는 `null` 이
    반환돼야 하는데 그렇지 않게 되므로(둘 다 없어야만 `null`), 이 변화를 잡는 테스트가 전혀
    없다는 뜻이다. 이 프로젝트가 반복 겪은 패턴("분기 매트릭스가 완성돼 보여도 `||`/`&&` 는
    각 항에 다른 값을 넣어야 관측 가능")과 정확히 같은 형태다.
  - 제안: 기존 가드 테스트를 두 갈래로 쪼갠다 — (a) `error: { code: "X" }` (message 만 없음)
    (b) `error: { message: "Y" }` (code 만 없음). 두 케이스 모두 배너가 안 뜨는지 확인하면
    `||` 의 양쪽 피연산자가 각각 실제로 분기에 기여함을 고정할 수 있다.

- **[INFO]** `asRecord` 의 배열 배제(`!Array.isArray(v)`) 분기는 이번 라운드에도 여전히
  무테스트 — `01_26_11` 에서 이미 낮은 우선순위 INFO 로 지적된 항목, 이번에 재확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:53`
  - 상세: `!Array.isArray(v)` 를 제거하는 뮤테이션(직접 실증, 즉시 원복·`git status` clean
    확인)에도 89/89 GREEN — `rawOutput`/`domain`/`source` 어느 자리에도 배열 값을 넣는
    fixture 가 없다는 뜻이다. `01_26_11` testing 리뷰가 "순수 함수·로직 단순, 우선순위 낮음"
    으로 판정했고 이번 실측도 그 판단을 뒤집을 근거를 주지 않는다 — 새로 에스컬레이션할
    사유는 없고, 미해결 상태만 재확인한다.
  - 제안: 조치 불요(기존 판정 유지). 여유가 있을 때 `output: []` 류 fixture 1건으로 고정
    가능.

- **[INFO]** `node.completed`(`handleNodeCompleted`) 호출부는 "이전 대화 없음"(single-turn)
  케이스에 대한 전용 테스트가 없다 — 공유 함수 커버로만 간접 방어됨
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:814` (`if (errorPayload
    && isMultiTurnAiContext(payload.nodeType))`), 테스트는 `handleNodeFailed` 쪽에만 존재
    (`02_02_18` W1 로 보강된 `"AI node failure without prior conversation context does NOT
    APPEND (single-turn case)"`, gate 2345 부근)
  - 상세: `handleNodeCompleted` 의 유일한 테스트(`"node.completed with output.output.error
    APPENDs system_error..."`, gate 2160)는 `seedConversation()` 을 호출해 `true` 분기만
    태운다. `isMultiTurnAiContext` **함수 자체**는 `handleNodeFailed` 쪽 테스트로 커버되므로
    공유 로직이 깨지면 그쪽에서 잡히지만, `handleNodeCompleted` **호출부의 배선**(그 조건을
    실제로 쓰는지)이 독립적으로 고정돼 있지는 않다. 실질 위험은 낮다 — 두 호출부가 동일한
    한 줄 패턴(`errorPayload && isMultiTurnAiContext(...)`)을 쓰고 있어 drift 여지가 작다.
  - 제안: 급하지 않음. 여력이 있으면 `completed?.()` 에 `seedConversation()` 을 생략한
    "이전 대화 없음" 케이스 1건을 추가해 두 호출부를 대칭으로 맞출 수 있다.

- **[INFO]** `plan/in-progress/system-error-banner-live-ws.md` 의 테스트 수 기록("frontend 87
  (86→87)")이 이후 라운드(`01_44_22`, `02_02_18`)에서 늘어난 실제 개수(현재 **89**)를
  반영하지 못해 stale 하다
  - 위치: `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 항목("TEST WORKFLOW
    4단계 PASS — frontend 87 (86→87) · e2e 285")
  - 상세: 실측(`pnpm exec vitest run src/lib/websocket/__tests__/use-execution-events.test.ts`)
    결과 현재 89/89 GREEN. 각 라운드의 RESOLUTION.md 는 정확한 수치(89)를 기록하고 있어
    SoT 로서는 문제 없으나, plan 본문의 최초 기록은 갱신되지 않았다. 테스트 관점에서는 실제
    실행 결과(RESOLUTION/CI)가 진실이므로 기능적 문제는 아니다.
  - 제안: plan 체크리스트를 최신 라운드 수치로 갱신하거나(선택), push 전 마무리 커밋에서
    한 번만 정리해도 충분 — 급하지 않음.

## 확인된 안전 항목 (재검증)

- `wrapNodeHandlerOutput()` 빌더가 `{ output, config: {}, meta: {} }` 리터럴을 정의하는
  유일한 지점임을 grep 으로 재확인(`config: {}, meta: {}` 는 파일 내 1곳). 10회 재사용,
  drift 재발 없음.
- `02_02_18` RESOLUTION 의 M5 뮤테이션 주장(`isMultiTurnAiContext` → `return true`, 예측
  2 failed / 실측 3 failed)을 동일 뮤테이션으로 직접 재현 — **3 failed** 일치 확인(치환 직후
  즉시 원복, `diff`/`git status` clean 확인).
- `direct` 분기 제거·JSDoc 갱신·자매 주석(`handleNodeCompleted` 위) 정정·테스트 제목
  (`output.output.error`) 정정 모두 현재 소스에 반영돼 있음을 `Read`/`grep` 으로 직접 확인.
- 테스트 격리: `describe` 블록 내 모든 케이스가 `startExecution("exec-1")` 로 스토어를
  리셋하고 시작하며, 뮤테이션 검증 과정에서도 스위트를 반복 재실행했지만 순서 의존적 실패는
  관측되지 않았다.

## 요약

핵심 회귀(문자열 top-level `error` + 래퍼 한 겹 아래 `output.output.error`)를 겨냥한 캐너리와
가드 테스트는 실측 뮤테이션으로 유효성이 확인됐고, 이전 3라운드에서 지적된 모든 WARNING(=`direct`
커버리지 0·malformed 가드 커버리지 0·단락 평가로 무검증이던 분기)이 현재 diff 시점에 실제로
해소돼 있음을 직접 재현해 확인했다. 다만 이번 라운드에서 새로 뮤테이션을 넣어 본 결과, 이번
PR 이 직접 추가한 `!code || !message` 가드가 "둘 다 없음" 케이스만 커버하고 `||` 의 개별
피연산자(코드만 없음/메시지만 없음)를 가르지 못한다는 새 갭을 실측으로 발견했다 — 이 프로젝트가
반복 겪어 온 "`||`/`&&` 각 항 개별 값 필요" 패턴과 같은 클래스라 WARNING 으로 표기한다. 나머지
발견사항은 기존에 낮은 우선순위로 유예된 항목의 재확인이거나 문서 수치 drift 수준으로, 기능적
위험은 없다.

## 위험도

LOW
