# 변경 범위(Scope) 리뷰

> 대상: 커밋 `e99f46145`(`fix(web-chat): replay_unavailable 폴백의 terminal 상태 처리 + 계약 pin 테스트`), 부모 `436ee334e`.
> 이 커밋은 직전 ai-review(`01_42_44`)의 W-req/W1/W2/I2/I3 발견사항에 대한 fix 커밋이다.

## 발견사항

- **[INFO]** backend webauthn 테스트 파일이 channel-web-chat 위젯 fix 커밋에 계속 번들
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` (커밋 `e99f46145` 안에서 `use-widget.ts`/`use-widget-eager-start.test.ts` 와 동일 커밋으로 묶임)
  - 상세: 이번 커밋은 서로 다른 두 모듈(`backend/auth/webauthn` vs `channel-web-chat/widget`)의 fix 를 한 커밋에 담고 있다. 다만 이는 직전 라운드(`01_42_44` RESOLUTION.md I-scope 항목)에서 이미 "사용자가 ⑨ 를 '바로 처리 가능한 항목' 묶음으로 지시했다"는 근거로 의도된 것으로 판정된 패턴의 연장이며, 이번 fix 커밋도 그 배치(⑨-2/⑨-3/⑨-4 대응 W-req/W1/W2)를 그대로 이어받아 한 커밋으로 처리했다. 커밋 메시지가 W-req/W1/W2/I2/I3 각 항목을 모두 명시적으로 나열해 추적 가능성은 유지된다.
  - 제안: 조치 불필요(기존 결정 계승). 다만 향후 유사 라운드에서 모듈 경계가 다른 fix 를 분리 커밋할지 재고 여지는 있음.

- **[INFO]** 커밋 메시지의 "GET 판정 관용구 통일(5곳)" 서술과 실제 diff 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1140` (`init?.method === undefined` → `(init?.method ?? "GET") === "GET"`)
  - 상세: 실제 diff 에서 기존 코드 중 관용구가 바뀐 곳은 1곳뿐이다(신규 테스트 2건은 처음부터 올바른 관용구로 작성됐을 뿐 "통일"이 아니다). 커밋 메시지·RESOLUTION.md 의 "5곳" 표현이 코드 범위와 정확히 대응하지 않는다.
  - 제안: 코드 변경 자체는 범위 내(I2 대응)이며 문제 없음. 서술 정확도는 documentation 관점 사안이라 scope 위험도에는 반영하지 않음.

- **[INFO]** review 산출물 13개 파일(`review/code/2026/07/17/01_42_44/*`) 신규 커밋 포함
  - 위치: `RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, `documentation.md`, `maintainability.md`, `performance.md`, `requirement.md`, `scope.md`, `security.md`, `side_effect.md`, `testing.md`, `user_guide_sync.md`
  - 상세: 코드 변경이 아니라 프로젝트 컨벤션(`review/code/<date>/` 산출물 저장 위치)에 따라 직전 리뷰 세션의 산출물을 커밋한 것. 코드 fix 와 함께 묶였지만 리뷰 워크플로 자체가 "fix 커밋 + 해당 리뷰 산출물 커밋"을 한 세트로 다루는 관례를 따른 것으로 scope 이탈이 아니다.
  - 제안: 조치 불필요.

## 확인된 정합 사항 (긍정)

- `use-widget.ts` 의 terminal 분기는 신규 헬퍼·신규 상수를 만들지 않고 기존 `TERMINAL_EVENTS`(line 67)·`teardownSession`(line 141)을 그대로 재사용해 SSE terminal 이벤트 경로(line 184-186)와 동일 패턴으로 구현됨 — over-engineering 없음.
- `seedWaitingFromStatusRef` 갱신을 `useCallback`→`useEffect` 로 바꾼 리팩터는 같은 파일의 기존 `apiRef` 컨벤션과 정합을 맞추기 위한 최소 변경이며, W-req fix 로 `useCallback` deps 가 `[]` → `[teardownSession]` 로 바뀌면서 실질적으로 필요해진 변경이다(불필요한 리팩토링 아님).
- 신규 테스트 2건(`use-widget-eager-start.test.ts`)과 신규 `describe('webauthnList', ...)`(`webauthn.controller.spec.ts`)는 각각 W-req/I3, W2 발견사항에 정확히 1:1 대응하며 그 이상의 커버리지 확장은 없음.
- I1(in-flight 가드), I4(주석 중복), I5(`useWidget` 분리) 등 "즉시 조치 불필요"로 판정된 INFO 항목은 실제로 손대지 않았다 — 요청 범위를 넘어서는 선제적 리팩토링/기능 확장이 없음을 확인.
- 임포트·설정 파일 변경 없음. 포맷팅만 변경된 라인 없음(모든 diff hunk 가 실질 로직/테스트 변경).

## 요약

이번 diff(커밋 `e99f46145`)는 직전 ai-review 세션(`01_42_44`)의 WARNING 3건(W-req/W1/W2) + 채택된 INFO 2건(I2/I3)에 정확히 대응하는 fix 로, 각 변경이 특정 발견사항과 1:1로 추적 가능하다. 요청받지 않은 리팩토링·기능 확장·무관한 파일 수정은 발견되지 않았고, 기존 코드 패턴(`TERMINAL_EVENTS`/`teardownSession`/`apiRef` 컨벤션)을 재사용해 최소 변경으로 구현했다. backend webauthn 테스트와 channel-web-chat 위젯 fix 가 한 커밋에 번들된 점은 이미 직전 라운드에서 사용자 의도로 확인된 패턴의 연장이라 새로운 위반이 아니며, review 산출물 커밋 역시 프로젝트 컨벤션에 따른 정상 동반 산출물이다.

## 위험도

NONE
