# Maintainability Review

대상 커밋: `54b466defab6a2766ff0eeb1487be1b3df8da900` — 이전 리뷰(20_26_00) Warning 3건 조치.
주 대상 코드: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`. `PROJECT.md`·`review/code/2026/07/09/20_26_00/**`(RESOLUTION.md·SUMMARY.md·meta.json·_retry_state.json 등)는 리뷰 산출물/문서 diff 라 코드 유지보수성 체크리스트(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성) 적용 대상이 아님(내용상 특이사항 없음) — 아래는 실질 코드 diff 인 테스트 파일에 집중.

## 발견사항

- **[INFO]** self-test 공유 rationale 설명이 3곳에 중복 서술
  - 위치: `e2e-no-sub-global-timeout.test.ts` 파일 헤더 JSDoc(라인 451-469 부근) / `subGlobalTimeoutsInLine` 함수 JSDoc(라인 510-514) / `describe("검출 로직 true/false positives")` 앞 인라인 주석(라인 547-550)
  - 상세: 이번 diff 의 목적(W1 조치)인 "self-test 와 프로덕션 스캔이 `subGlobalTimeoutsInLine` 을 공유해 drift 를 없앤다"는 동일 설명이 함수 JSDoc 과 `describe` 앞 주석 두 곳에 거의 같은 문장으로 반복된다. 코드(로직) 자체는 잘 DRY 됐지만 그 근거를 설명하는 주석은 다소 WET — 향후 판정 로직이 바뀌면 두 주석을 함께 갱신해야 하는 부담이 생긴다.
  - 제안: `describe` 앞 주석은 "아래 self-test 는 `subGlobalTimeoutsInLine` 문서(위 참고)의 계약을 고정한다" 정도로 축약하고 세부 근거는 함수 JSDoc 한 곳에만 남기는 편이 유지보수 부담을 줄인다. 차단 사유는 아님.

- **[INFO]** 파라미터명 `global` 이 Node.js 전역 객체명과 동일
  - 위치: `subGlobalTimeoutsInLine(line: string, global: number)`, `findSubGlobalTimeouts(global: number)` (리팩터 후 두 함수 모두 동일 파라미터명 사용)
  - 상세: 기존에도 있던 네이밍(이번 diff 가 신규 도입한 문제는 아님)이 공유 헬퍼로 승격되며 그대로 유지됐다. 함수 스코프 내 지역 파라미터라 런타임/타입 문제는 없고 lint 도 통과했지만, 코드 읽는 사람이 순간적으로 Node 전역 `global` 객체를 떠올릴 여지가 있어 가독성 관점에서 사소한 마찰이 있다.
  - 제안: `globalTimeout` 처럼 의미가 더 분명한 이름으로 바꾸면 좋으나, 현재도 기능상 문제 없고 최소 변경 원칙(이번 diff 목적은 W1/W2 fix)에 부합하지 않으므로 강제 아님 — 다음 접촉 시 병행 정리 권장.

- **[INFO]** `findSubGlobalTimeouts` 의 3중 루프 중첩(파일 순회 → 라인 순회 → 매치 순회)
  - 위치: `findSubGlobalTimeouts(global)` 본문 (`for...of` → `forEach` → `for...of value`)
  - 상세: 이번 리팩터로 최내부 루프가 `subGlobalTimeoutsInLine` 호출로 대체되어 실제 판정 로직은 빠졌지만, 구조적 중첩 자체는 3단으로 남아 있다. 각 단이 한 줄 수준으로 단순해 복잡도는 낮지만, 점검 관점 4(중첩 깊이)에 해당하는 항목이라 참고로 남긴다.
  - 제안: 현재 가독성에 실질 지장 없음 — 조치 불필요.

## 요약

이번 diff 는 직전 리뷰(20_26_00)에서 지적된 Warning 2건(self-test/프로덕션 로직 이중 구현으로 인한 drift 위험, 오도하는 타이틀 보간)을 정확히 겨냥해 `subGlobalTimeoutsInLine` 단일 헬퍼 추출과 `${GLOBAL}` 실값 보간으로 깔끔히 해소했다. 함수는 모두 짧고 단일 책임이며, 네이밍(`collectE2eFiles`/`readGlobalExpectTimeout`/`toNumber`/`subGlobalTimeoutsInLine`)이 목적을 명확히 드러내고, JSDoc 이 "왜 공유해야 하는가"까지 근거를 남겨 향후 유지보수자가 실수로 다시 이중 구현하는 것을 방지한다. 매직넘버(`toBeGreaterThan(10)`)도 이번 조치로 근거 주석이 붙었다. 남은 항목은 주석 중복·파라미터명(`global`)·중첩 깊이 정도의 INFO 수준 참고사항이며, 기존 코드베이스의 다른 build-time 가드 테스트들과 스타일·패턴이 일관돼 있다.

## 위험도
NONE
