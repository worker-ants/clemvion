# 요구사항(Requirement) Review

## 대상

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream` 반환 타입을 `boolean` → 명명 union
  `StreamClaim`(`"opened"`/`"already_owned"`/`"no_client"`)으로 승격, `start()` 의 `useCallback` 의존성
  배열에서 미사용 `sessionEstablished` 제거. (커밋 `8f6d783f1` + `2d9da4f26`)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 회귀 테스트 위 주석을 새 구조
  (게이트가 `openStream()` 내부)에 맞춰 갱신.
- `plan/in-progress/webchat-usewidget-extraction.md` — 해당 체크리스트 항목 완료 처리.
- `review/code/2026/08/10/12_39_25/**`(SUMMARY/RESOLUTION/각 리뷰어 산출물) — 선행 라운드 리뷰 산출물의
  신규 커밋(문서성, 기능 영향 없음).

## 검증 절차 (직접 실행)

- `pnpm vitest run`(channel-web-chat 전체) → **23 files / 409 tests passed** — plan·RESOLUTION.md 서술과 실측 일치.
- `pnpm exec tsc --noEmit -p .` → 0 errors.
- `git blame` 로 `use-widget.ts` 의 신규 JSDoc 라인 귀속 확인(아래 WARNING #1 근거).
- `grep -n "sessionEstablished"` / `grep -n "^  }, \["` 로 `start()` 의존성 배열에서 `sessionEstablished` 가 실제로
  빠졌는지 확인 — 630번째 줄 `}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]);`
  로 확인됨. RESOLUTION.md #2 조치가 정확히 반영됐다.
- 호출부 2곳(`start()` 619번째 줄, `applyConfig` 복원 968번째 줄) 모두 `=== "already_owned"` 로 정확히 게이팅.
- `spec/7-channel-web-chat/` 전수 grep 으로 이 변경과 관련된 spec 서술을 재대조(아래 SPEC-DRIFT 항목).

## 발견사항

- **[WARNING]** `openStream` 관련 JSDoc 두 곳이 여전히 "이미 열려 있으면 `false` 를 돌려준다" 라고 서술 — 실제로는
  `StreamClaim` 문자열 리터럴 `"already_owned"` 를 반환하며 `boolean` 이 아니다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:365`(`openStream` 자신의 JSDoc 요약문
    "SSE 를 연다. **이미 열려 있으면 아무것도 하지 않고 `false`** 를 돌려준다.")와 `use-widget.ts:462`
    (`seedWaitingFromStatus` JSDoc 안 "그래서 **`openStream` 자신이** 진입에서 소유권을 재확인하고 이미
    열려 있으면 `false` 를 돌려준다.")
  - 상세: `git blame` 로 확인한 결과 두 줄 모두 `boolean` 반환이었던 1차 커밋(`8f6d783f1`, 12:38:51)에 귀속되고,
    바로 아래·위 인접 줄들(377-384, 387, 389, 391 등)은 union 타입을 도입한 2차 커밋(`2d9da4f26`, 12:46:46)이
    갱신했는데 이 두 문장만 "false" 표현이 그대로 남았다. 즉 같은 diff 안에서 `@returns` 태그(383행)는
    `StreamClaim`/`"already_owned"` 로 정확히 적혀 있는데 바로 위 요약문(365행)과 다른 함수의 서술(462행)은
    구버전 표현을 그대로 유지해 **한 diff 내에서 자기모순**이다. 기능에는 영향 없지만, 이 파일이 plan
    문서(§JSDoc 인접성)·이번 라운드 RESOLUTION.md(#3, "다음에 이 테스트가 깨졌을 때 조사자가 있지도 않은
    '호출부 게이트'를 찾게 두면 안 된다")에서 반복해 자인한 바로 그 "주석/JSDoc drift" 패턴이 이번 수정
    자체 안에서 재발한 사례다.
  - 제안: 두 줄을 `"이미 열려 있으면 아무것도 하지 않고 \`"already_owned"\` 를 돌려준다"` 류로 갱신해
    `@returns` 태그·실제 구현과 일치시킨다.

- **[WARNING]** `[SPEC-DRIFT]` `spec/7-channel-web-chat/3-auth-session.md` §R7 이 여전히 "이중 스트림은
  **호출부**의 짝 가드가 막는다" / "**호출부**는 스트림을 여는 직전에도 확립 여부를 재확인한다" 라고 서술하는데,
  이번 diff(선행 커밋 `8f6d783f1` 포함)가 바로 그 가드를 호출부에서 `openStream()` 함수 내부로 옮겼다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:155-159`("이 가드는 '표면 되감기'만 막는다. '이중 스트림'은
    호출부의 짝 가드가 막는다... 그래서 호출부는 스트림을 여는 **직전**에도 확립 여부를 재확인한다"), 관련해서
    164행 "짝 가드의 필요성은..." 문단도 같은 가정을 전제한다.
  - 상세: 이 spec 문서 frontmatter `code:` 목록(4-9행)이 `codebase/channel-web-chat/src/widget/use-widget.ts`
    를 명시적으로 evidence 로 걸고 있어 spec-code-paths 매칭 대상이다(단순 우연한 참조가 아니라 SoT 로 선언된
    문서). 이번 diff 이전에는 실제로 `start()`·`applyConfig` 두 호출부가 각자 `if (sessionEstablished()) return;`
    를 `openStream` **직전**에 손으로 복제해 두어(`use-widget.ts` 옛 605-608행) spec 서술과 정확히 일치했다.
    그런데 이번 diff 는 그 재확인을 `openStream()` 함수 내부(`streamRef.current !== null` 검사, 391행)로
    이동시키고 호출부는 `openStream(...)` 의 반환값(`StreamClaim`)만 확인하도록 바꿨다 — `use-widget.ts` 자신의
    JSDoc(366-370행)도 "종전에는 두 호출부가... 손으로 복제했고... 그래서 게이트를 `openStream` 안으로 옮겨
    구조적으로 강제한다"고 이 변화를 명시적으로 서술한다. plan 문서(`webchat-usewidget-extraction.md` 60-90행)
    도 이 리팩터를 "완료"로 명시적으로 기록했다. 이는 코드 버그가 아니라 **의도적이고 잘 검증된 개선**
    (RESOLUTION.md #1, 뮤테이션 테스트로 소유권 게이트 제거가 RED 임을 실측)이므로, spec 이 낡은 쪽이다.
    다만 이 drift 는 이번 라운드(12_39_25)의 requirement/documentation/scope 리뷰 어디에서도 지적되지
    않았다 — 그 라운드들은 `spec/7-channel-web-chat/2-sdk.md` §3 만 확인했고 `3-auth-session.md` §R7 은
    보지 않았다(같은 파일 안에 `code:` 로 걸려 있는데도).
  - 제안: 코드는 유지하고 `spec/7-channel-web-chat/3-auth-session.md:155-159`(및 164행)의 "호출부의 짝 가드"·
    "호출부는... 직전에도 재확인한다" 문구를 "`openStream()` 함수 내부의 단일 게이트가... 진입 시 재확인한다"
    로 갱신 — `project-planner` 위임 대상(본 reviewer 는 spec 을 직접 수정하지 않음). `plan/in-progress/
    webchat-usewidget-extraction.md` 가 이미 별도 spec drift 항목(§spec 증거 포인터 drift, `2-sdk.md` §3)을
    `spec-update-webchat-evidence-pointers.md` 로 위임해 둔 선례가 있으므로 같은 방식으로 이어 붙이는 것을
    권고.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값 검토

- **동작 보존 검증**: `openStream` 세 분기(`!client`→`"no_client"`, `streamRef.current !== null`→
  `"already_owned"`, 정상 open→`"opened"`) 모두 명시적 반환 — 누락 경로 없음. `"no_client"` 를 진행으로
  취급하는 것은 JSDoc(377-379행)이 명시하듯 종전 "client 없으면 내부 no-op 후 `scheduleRefresh()` 그대로
  실행" 동작의 보존이며, 실제로 두 호출부 모두 `=== "already_owned"` 만으로 게이팅해 그 계약을 지킨다.
- **이중 스트림 회귀 방지**: `use-widget-eager-start.test.ts` 의 `raceStartVsResendSingleStream` 이 두 순서
  (start 먼저/재전송 먼저) 모두에서 `esCount===1` 을 단언 — 실행 결과 GREEN(409/409). 회귀 테스트 주석도
  이번 diff 로 "게이트는 이제 `openStream()` 내부 단일 지점" 이라고 정확히 갱신됐다(3401-3410행) — 코드와
  테스트 주석이 정합.
- **의존성 배열 정리**: `start()` 의 `useCallback` 의존성에서 미사용 `sessionEstablished` 제거를 grep 으로
  직접 확인(630행) — 선행 라운드(12_39_25) WARNING #2 가 정확히 반영됐다.
- **plan 체크리스트 서술**: "23파일 409건", "`tsc --noEmit` 0 errors" 등 수치를 직접 재실행해 일치 확인 —
  memory 의 "실측했다 주장이 세 번 틀렸다" 패턴 재발 없음.
- TODO/FIXME/HACK/XXX: `git show` 로 두 커밋의 diff 를 직접 훑었으나 diff 범위 내 없음.
- 반환값 누락 경로: 없음(위 참조).

## 요약

이번 diff 는 SSE 스트림 소유권 게이트를 호출부 2곳의 손 복제 코드에서 `openStream()` 내부 단일 지점으로
옮기고 반환 타입을 `boolean` 대신 명명 union `StreamClaim` 으로 승격한 리팩터로, 선행 라운드(`12_39_25`)의
WARNING 3건(boolean→union, 미사용 의존성, 테스트 주석 drift)을 모두 정확히 반영했다 — 직접 재실행한
`vitest`(23/409 PASS)·`tsc --noEmit`(0 errors)로 확인했다. 기능 완전성·반환값 누락·엣지 케이스는 문제없다.
다만 (1) 이번 diff 자신이 만든 JSDoc 두 줄이 union 전환 전 "false" 표현을 그대로 남겨 같은 diff 안에서
자기모순을 일으키고(WARNING), (2) 코드가 옳게 개선됐음에도 `spec/7-channel-web-chat/3-auth-session.md`
§R7(코드-연결 spec 문서)이 여전히 "호출부의 짝 가드"라는 옛 아키텍처를 서술한 채 남아 있다(SPEC-DRIFT
WARNING) — 둘 다 이 파일·이 프로젝트가 반복 경계해 온 바로 그 "설명이 구현을 못 따라가는" 결함 클래스이며,
차단 사유는 아니지만 다음 사람이 옛 설명을 정답으로 오독할 실질적 위험이 있다.

## 위험도

LOW
