# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `openStream` 이 `StreamClaim`(문자열 union) 을 반환하도록 승격됐는데, JSDoc 산문 두 곳이 여전히 옛 `boolean` 시절의 `` `false` `` 라는 표현을 그대로 쓰고 있다 — 함수 자신의 `@returns` 태그와도 모순된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:365` (`openStream` JSDoc 첫 줄), `codebase/channel-web-chat/src/widget/use-widget.ts:462` (`seedWaitingFromStatus` JSDoc 내 서술)
  - 상세: 이번 diff 는 `SeedOutcome` 선례를 따라 `openStream` 의 반환 타입을 `boolean` → 명명 union `StreamClaim`(`"opened"`/`"already_owned"`/`"no_client"`)으로 승격했고(타입 선언 게이트 104-110, 실제 반환문 게이트 389/391/408), `@returns` 태그(게이트 383-384)도 `` `StreamClaim` — **`"already_owned"` 만 중단**이고 나머지는 진행이다 `` 로 정확히 갱신됐다. 그런데 정확히 같은 JSDoc 블록의 **첫 문장**(게이트 365)은 여전히 `` SSE 를 연다. **이미 열려 있으면 아무것도 하지 않고 `false`** 를 돌려준다. `` 라고 적혀 있다 — 실제로 이미 열려 있을 때 `openStream` 은 boolean `false` 가 아니라 문자열 `"already_owned"` 를 반환한다(게이트 391 `return "already_owned";`). 같은 블록 안에서 요약 문장과 `@returns` 태그가 서로 다른 반환 타입을 주장하는 자기모순이다. 같은 패턴이 `seedWaitingFromStatus` JSDoc 의 "이 함수 안에는 staleness 정책이 두 개 공존한다" 문단(게이트 462)에도 있다: "그래서 `openStream` 자신이 진입에서 소유권을 재확인하고 이미 열려 있으면 `` `false` `` 를 돌려준다"— 역시 `StreamClaim`/`"already_owned"` 로 갱신되지 않았다.
    이 코드베이스는 정확히 이 종류의 drift(구조가 바뀌었는데 산문 서술이 옛 표현을 유지)를 여러 차례 겪었고, 이번 diff 자체가 그 재발을 막으려는 목적(테스트 주석 갱신, plan 기록에 "이 저장소가 주석 drift 로 반복 결함을 냈다"고 명시)으로 작성됐다. 그런데 바로 그 diff 가 도입한 `StreamClaim` 승격 과정에서 동일한 drift 가 두 곳 새로 생겼다 — 리팩터가 "타입으로 강제"하려던 것을 정작 산문 설명이 놓친 사례다. IDE 툴팁이 함수의 첫 요약 문장(게이트 365)을 우선 노출하는 경우가 많아, 다음에 이 함수를 만지는 사람이 `@returns` 태그보다 그 문장을 먼저 읽고 "여전히 boolean 을 반환하나?" 로 오독할 위험이 있다.
  - 제안: 게이트 365 를 `` SSE 를 연다. **이미 열려 있으면 아무것도 하지 않고 `"already_owned"`** 를 돌려준다. `` 식으로, 게이트 462 를 `` 이미 열려 있으면 `` `"already_owned"` `` 를 돌려준다 `` 식으로 갱신해 `@returns` 태그·실제 반환문과 일치시킨다.

- **[INFO]** (검증 결과, 문제 없음) `plan/in-progress/webchat-usewidget-extraction.md` 의 실측 수치(테스트 23파일/409건, `tsc --noEmit` 0 errors) 를 직접 재실행해 확인 — 두 수치 모두 정확히 일치한다.
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트(게이트 56, 88)
  - 상세: `pnpm --filter channel-web-chat exec tsc --noEmit` → 0 errors. `pnpm --filter channel-web-chat vitest run` → 23 files / 409 tests passed. memory 에 기록된 "실측했다 주장이 세 번 틀렸다" 패턴(과거 이 plan 파일에서 반복된 프록시 계측 오류)이 이번 항목에서는 재발하지 않았다.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** 회귀 테스트 주석(`use-widget-eager-start.test.ts:3401-3408`)은 이전 라운드(12_39_25 testing WARNING)에서 지적된 "옛 호출부-양쪽-게이트" 서술을 정확히 현재 구조(`openStream()` 내부 단일 게이트, `"already_owned"` 반환)로 갱신했고, 실제 파일을 열어 대조한 결과 코드와 일치한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3408`
  - 상세: 이전 라운드 WARNING 이 정확히 반영됐음을 확인. 다만 위 WARNING 항목(게이트 365/462)과 같은 클래스의 drift 가 이번 diff 로 새로 생겼다는 점에서, "회귀 테스트 주석"만 갱신하고 "함수 자신의 JSDoc 요약 문장"은 같은 라운드에서 놓친 셈이다.
  - 제안: 조치 불요(이미 정확함). 위 WARNING 과 함께 처리하면 이 리팩터의 문서 갱신이 완결된다.

## 요약

이번 변경은 `SeedOutcome` 선례를 따라 `openStream` 의 반환 타입을 `boolean` 에서 명명 union `StreamClaim`(`"opened"`/`"already_owned"`/`"no_client"`)으로 승격한 후속 수정이며, 직전 라운드(12_39_25)가 지적한 WARNING 3건(boolean 뭉개짐, `start()` deps 잔재, 회귀 테스트 주석 drift) 은 모두 실제로 반영됐음을 코드·plan·테스트 실행으로 직접 확인했다(`tsc --noEmit` 0 errors, 23파일/409건 실측 일치, deps 배열에서 `sessionEstablished` 제거 확인). 다만 바로 이 승격 작업 과정에서 같은 클래스의 새로운 drift 가 발생했다 — `openStream` 자신의 JSDoc 요약 문장과 `seedWaitingFromStatus` JSDoc 의 관련 서술 두 곳이 여전히 옛 `boolean`/`false` 표현을 쓰고 있어 같은 블록의 `@returns` 태그와 모순된다(WARNING). 이 코드베이스가 스스로 "주석 drift 로 반복 결함을 냈다"고 여러 차례 기록해 온 바로 그 패턴이 이 리팩터 자체 안에서 재발한 사례라 특히 눈에 띈다. 그 외 plan 문서의 실측 주장·테스트 주석 갱신은 모두 정확함을 확인했다.

## 위험도

LOW
