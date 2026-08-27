# 테스트(Testing) 리뷰 — `system_error` 배너 라이브 WS 복구 (5라운드, `02_39_10`)

## 사전 확인

`origin/main...HEAD` 전체 diff(48 파일) 중 코드 변경은 `use-execution-events.ts` /
`use-execution-events.test.ts` 2 파일뿐이고, 나머지는 이전 4라운드(`01_26_11` →
`01_44_22` → `02_02_18` → `02_21_19`)의 review 산출물이다. 이전 라운드 testing.md·
RESOLUTION.md 를 전부 읽고 지적된 항목(①`direct` 분기 커버리지 0 → 삭제, ②JSDoc/자매
주석 stale, ③fixture 손복제 → `wrapNodeHandlerOutput` 빌더, ④`!code || !message` 가 두
항을 못 가름 → 개별 fixture 분리, ⑤`isMultiTurnAiContext` 단락 평가로 무검증이던 분기
→ 보강)이 **현재 소스에 실제로 반영돼 있음**을 `Read`/`grep`으로 직접 재확인했다.
`pnpm exec vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 재현 —
**92/92 GREEN**.

이번 라운드는 반복 지적을 피하고, 아직 아무도 뮤테이션으로 짚지 않은 갭을 찾기 위해
소스에 직접 뮤테이션을 넣어(매 검증 직후 `cp` 원복 + `diff` 바이트 일치 + `git status`
clean 확인) 검증했다.

## 발견사항

- **[WARNING]** `retryable`/`retryAfterSec` 타입 가드가 **두 호출부 모두 무테스트** — 실측
  뮤테이션으로 92/92 GREEN 확인 (동일 코드가 이 PR 이 방금 고친 `extractNodeErrorPayload`
  자신의 가드와 같은 패턴)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:815-822`
    (`handleNodeCompleted`) 및 `:911-918` (`handleNodeFailed`) — 두 곳이 바이트 단위로
    동일한 블록:
    ```
    const retryable =
      typeof errorPayload.details?.retryable === "boolean"
        ? errorPayload.details.retryable
        : false;
    const retryAfterSec =
      typeof errorPayload.details?.retryAfterSec === "number"
        ? errorPayload.details.retryAfterSec
        : undefined;
    ```
  - 상세: 스위트 전체(`grep -n "retryable:\|retryAfterSec:"`)를 확인한 결과 `details.retryable`
    은 항상 리터럴 `true`/`false` 이거나 `details` 키 자체가 없고(→ optional chaining 으로
    `undefined`), `details.retryAfterSec` 은 항상 숫자이거나 부재다. 즉 **`typeof === "boolean"`
    / `typeof === "number"` 가드가 실제로 방어하는 "값은 있는데 타입이 틀림"(예: 백엔드가
    `retryable: "true"` 문자열이나 `retryAfterSec: "30"` 문자열을 보내는 경우)을 겨냥하는
    fixture 가 하나도 없다.** 직접 실증: `handleNodeCompleted` 블록의 두 타입 가드를
    `(errorPayload.details?.retryable ?? false) as boolean` / `errorPayload.details?.retryAfterSec
    as number | undefined` 로 치환(타입 체크 자체를 제거)하고 재실행 → **92/92 GREEN 유지**
    (원본은 `cp` 로 즉시 백업, 확인 후 `cp` 로 복원 + `diff` 바이트 일치 + `git status` clean
    확인 완료). 이 뮤턴트는 **등가가 아니다** — 현재 fixture 로는 우연히 안 걸릴 뿐, 실제로
    백엔드가 malformed 타입 값을 보내면(스키마 drift) 가드 유무에 따라 사용자에게 보이는
    `[다시 시도]` 버튼 상태·재시도 카운트다운이 실제로 달라진다.
  - 근거: 같은 함수 계열의 자매 가드(`extractNodeErrorPayload` 내부의 `!code || !message`,
    `:94`)는 정확히 이 클래스의 갭 때문에 직전 라운드(`02_21_19` W1)에서 WARNING 으로
    격상되어 두 항을 가르는 fixture 로 보강됐다(`RESOLUTION.md` M6). 이번에 발견한 자리는
    같은 파일·같은 함수 계열의 **다음 단계**(추출된 값을 UI 로 넘기기 전 타입 좁히기)이고,
    이번 diff 가 새로 추가한 캐너리·가드 테스트들이 전부 well-typed 값만 다뤄 이 자리를
    비켜갔다.
  - 제안: 두 호출부 중 한 곳(`handleNodeFailed` 쪽 canary 근처 권장, 이미 `[가드]` 접두
    네이밍 컨벤션이 자리잡혀 있음)에 `details: { retryable: "true", retryAfterSec: "30" }`
    같은 malformed 타입 fixture 1건을 추가해 `retryable` 이 `false` 로, `retryAfterSec` 이
    `undefined` 로 안전하게 fallback 됨을 고정한다. 두 호출부가 완전히 동일한 로직을
    복제하고 있으므로(이미 `maintainability.md` 가 별도로 지적한 DRY 이슈), 공유 헬퍼로
    추출한다면 그 헬퍼 하나에 대한 테스트로 양쪽을 동시에 고정할 수 있다.

- **[INFO]** 같은 클래스의 더 작은 갭 — `extractNodeErrorPayload` 내부 `details` 필드
  자체가 **object 가 아닌 truthy 값**(예: 문자열)일 때의 방어(`:96`)도 무테스트
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:95-98`
    (`source.details && typeof source.details === "object" ? ... : undefined`)
  - 상세: 기존 "`details` 키 자체가 없으면" 테스트(`use-execution-events.test.ts:2335` 부근,
    `01_44_22` INFO 7 로 추가됨)는 `details` **부재**만 겨냥하고, `details` 가 **존재하지만
    object 가 아닌 경우**(예: `details: "n/a"`)는 여전히 안 걸린다. 위 WARNING 항목과 동일
    패턴이지만, 백엔드 계약상 `details` 는 항상 object 이거나 생략이라 실도달 가능성은 더
    낮다(에러 payload 자체가 이미 `code`/`message` 를 문자열로 강제하는 스키마다). 우선순위는
    낮게 판단.
  - 제안: 급하지 않음 — 여유가 있으면 위 WARNING 항목 fixture 를 만들 때 `details: "n/a"`
    케이스도 같이 붙여 두 자리를 한 번에 고정할 수 있다.

## 확인된 안전 항목 (재검증)

- `wrapNodeHandlerOutput()` 빌더가 `{ output, config: {}, meta: {} }` 을 만드는 유일한
  지점임을 재확인(파일 내 다른 곳에서 이 리터럴 shape 을 복제하지 않음). 5회+ 재사용,
  drift 없음.
- 테스트 격리: 상위 `beforeEach` 가 `vi.resetAllMocks()` + `useExecutionStore.setState(...)`
  로 매 테스트 전 스토어를 리셋. mock WS client(`getWsClient`/`createWsClient`)는 `.on`
  호출 목록에서 등록된 핸들러를 꺼내 직접 fire 하는 방식으로, 실제 소켓 프로토콜을 흉내
  내지 않고 핸들러 로직만 단위 테스트하는 합리적 mock 경계다 — 이번 diff 가 새로 만든
  패턴이 아니라 파일 전역 기존 컨벤션을 그대로 재사용.
- `!code || !message`(`:94`) 가드는 두 항을 개별로 가르는 fixture(`[가드] message 만
  없어도`/`[가드] code 만 없어도`)가 이번 diff 시점 기준 실제로 존재함을 확인 —
  `02_21_19` W1 반영 완료.
- `output` 이 배열인 경우의 회귀 방어 테스트는 "항 하나를 가른다"고 과대 주장하지 않고
  주석으로 등가 뮤턴트임을 명시한 채 남아 있다(`02_21_19` INFO 7 처분 그대로 유지) — 재상정
  불필요.

## 요약

이번 diff 의 핵심 결함(문자열 top-level `error` + 래퍼 한 겹 아래 `output.output.error`)에
대한 캐너리·가드 테스트는 4라운드에 걸쳐 뮤테이션으로 유효성이 검증됐고, 이전 라운드가
지적한 모든 WARNING 이 실제로 해소돼 있음을 재확인했다. 다만 이번 라운드에서 새로 뮤테이션을
넣어 본 결과, `extractNodeErrorPayload` 가 반환한 값을 UI 로 넘기기 전 `retryable`/
`retryAfterSec` 을 좁히는 두 호출부(완전히 동일한 코드가 두 곳에 복제됨)의 타입 가드가
malformed 타입 입력에 대해 무테스트라는 새 갭을 발견했다 — 바로 이 PR 이 자매 함수의 같은
클래스 갭(`!code || !message`)을 WARNING 으로 격상해 고친 것과 동일 패턴이며, fixture 하나로
두 항 모두 고정 가능하다. 블라스트 반경은 원래 결함(배너 자체가 안 뜸)보다 좁다 — 이 가드가
깨져도 배너는 뜨고 재시도 버튼 상태/카운트다운만 malformed 값에 오염될 수 있다. `details`
non-object 케이스는 같은 클래스이지만 실도달 가능성이 낮아 INFO 로 남긴다. 테스트 격리·
가독성·mock 적절성은 기존 컨벤션을 일관되게 따르고 있어 별도 지적 사항 없음.

## 위험도

LOW
