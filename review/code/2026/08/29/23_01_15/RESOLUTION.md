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
