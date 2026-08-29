# RESOLUTION — 23_01_15

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING#1 | 코드 | `09fa029f9` | `hasDefaultExport()` 세 번째 분기(`export { X as default }` 별칭 감지)를 `ts.createSourceFile` 기반 합성 소스 `it.each` 테이블로 영구 고정 — 양성 3형태(`export default X` / `export default function f(){}` / `export { X as default }` [+ from 절]) + 음성 2형태. fix 후 뮤테이션 재검증 2건 모두 예측=실측 일치(아래 참조). |
| INFO#2 | 코드 | `09fa029f9` | `notification-config.dto.ts` 의 `NotificationEventType` JSDoc 에 `InAppNotificationEventType`(WS 인앱 알림, 무관)과의 대칭 disambiguation 한 줄 추가. |
| INFO#1 | won't-do | — | `plan/complete/` 이동은 `egress-masking.md:89` DEAD 링크 캐비엇을 정정할 다음 planner 턴으로 위임된 상태 — CLAUDE.md §자기-반증형 소정정 조건 1(developer 자신이 그 문장을 썼을 것)을 충족하지 못해 developer 권한 밖. `plan/**`·`spec/**` 미변경. |
| INFO#3 | won't-do | — | 네이밍/return 스타일 차이 — 리뷰어 스스로 "필수 아님, 순수 스타일 차이"로 낮춤. |
| INFO#4 | won't-do | — | JSDoc 길이(11줄) — 리뷰어 스스로 "조치 불요, 컨벤션 준수"로 낮춤(개명 반성의 근거 문서화됨). |
| INFO#5 | won't-do | — | plan 문서 정보 밀도 — 리뷰어 스스로 "조치 불요, 컨벤션 준수"로 낮춤("근거는 문서에 남긴다" 채택 컨벤션). |

## 뮤테이션 재검증 (예측/실측)

원복은 `cp` 백업(스크래치패드에 사전 백업 후 뮤테이션 → 원복). `git checkout`/`git restore` 미사용.

- **(a) 세 번째 분기 술어를 절대 불일치 문자열로 교체** (`el.name.text === '__mutant_never_matches__'`)
  - 예측: 새 테이블 테스트가 RED (별칭 2형태: `export { X as default };` / `export { X as default } from './m';`)
  - 실측: RED — 정확히 그 2건만 실패 (`Expected: true, Received: false`), 나머지 10건 GREEN. **일치**
- **(b) `hasDefaultExport` 를 `return true`로 뭉갬**
  - 예측: 음성 케이스가 RED (`export { X };` / `export const X = 1;`)
  - 실측: RED — 음성 2건 실패 + 기존 캐너리("두 모듈 어디에도 `export default` 가 없다")도 함께 RED(부수 확인, 예상대로). **일치**

두 뮤턴트 모두 원복 후 `npx jest src/modules/websocket/websocket-events.types.spec.ts` 12/12 GREEN 재확인.

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260829-231106.log`)
- unit  : 통과 (`_test_logs/unit-20260829-231159.log`)
- build : 통과 (`_test_logs/build-20260829-231333.log`, docker 이미지 빌드 포함)
- e2e   : 통과 (backend 49 suites / 285 tests + frontend Playwright 51/51, `_test_logs/e2e-20260829-231613.log`)

## 보류·후속 항목

- INFO#1: `plan/in-progress/ws-event-types-extract.md:294` 의 `plan/complete/` 이동은 다음 planner 턴에서 `spec/conventions/egress-masking.md:89` DEAD 링크 캐비엇 처리 후 진행 — 본 sub-agent 권한 밖, `plan/**`·`spec/**` 미변경.
- INFO#3~#5: 리뷰어 자체 판단으로 조치 불요/컨벤션 준수 확인 — won't-do.

---

## main 의 독립 재검증 (에이전트 보고를 그대로 받지 않는다)

`resolution-applier` 의 뮤테이션 보고를 확인하지 않고 받지 않았다. 같은 두 뮤턴트를 main 이
직접 다시 주입했다:

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| 별칭 술어를 절대 불일치로 (`'default'` → `'__never__'`) — **리뷰어가 6/6 GREEN 을 낸 그 뮤턴트** | RED | **RED 2** (`export { X as default }` · `… from './m'` 두 케이스) |
| `hasDefaultExport` 를 `return true` 로 뭉갬 | RED (음성 케이스) | **RED 3** (음성 2건 + 실제 캐너리 1건) |

**첫 줄이 이 라운드의 요점이다.** 리뷰어가 그 뮤턴트로 **6/6 GREEN** 을 실증했던 바로 그
자리가 이제 **RED 2** 다 — 갭이 일회성 증거가 아니라 스위트에 영구히 고정됐다.

둘째 줄은 음성 케이스가 실제로 일하는지를 본다. 양성만 있었으면 `return true` 뭉갬이
살아남아 "전부 default 로 판정" 하는 가드가 초록으로 통과했을 것이다.

원복 후 `npx jest src/modules/websocket/` **172/172**, `git status` clean 확인.

## 이 WARNING 이 짚은 것 — 기록해 둘 가치가 있다

내 잘못의 형태는 "뮤테이션을 안 했다" 가 아니다. **했고, 통과했고, 그 결과를 plan 에
근거로 적었다.** 문제는 그 뮤테이션이 **임시 사본에서 수행되고 되돌려졌다**는 것이다 —
증거는 그 순간에만 존재했고 스위트에는 아무것도 남지 않았다.

즉 **"뮤테이션으로 검증했다" 는 그 시점의 주장이지 회귀 방어가 아니다.** 고친 로직이
다음 주에 다시 깨져도 스위트는 초록이다. 특히 이 파일은 plan 이 "형태 하나를 놓쳤다 →
고침 → 다음 형태를 놓침" 을 **4라운드 연속** 겪었다고 기록하고 있는데, 나는 그 다섯 번째를
막는 장치가 아니라 **일회성 증거**를 더한 셈이었다.

판별 질문: **그 뮤턴트를 내일 다시 넣으면 무엇이 RED 를 내는가?** 답이 "내가 그때 손으로
넣어 봤다" 면 아무것도 아니다.
