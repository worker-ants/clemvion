# 테스트 리뷰 — /schedules 역방향 딥링크 (?triggerId=)

- 대상 커밋: `54f8aaac9` (worktree `schedules-triggerid-deeplink-91c2cc`)
- diff: `origin/main...HEAD`
  - `codebase/frontend/src/app/(main)/schedules/page.tsx` (+32/-2)
  - `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` (+60, 신규 describe 3 테스트)
  - `spec/2-navigation/3-schedule.md` (+2)

## 실험 방법

`page.tsx` 를 두 가지 방식으로 임시 패치하여 `../../node_modules/.bin/vitest run "src/app/(main)/schedules/__tests__/schedules-page.test.tsx"` (cwd=`codebase/frontend`) 를 재실행했다. 각 실험 후 즉시 원본으로 복원했으며, 최종적으로 `git status --short` 로 clean 상태(신규 미추적 review 산출물 외 변경 없음)를 확인했다.

1. `isFocused` 를 `false` 로 강제(강조 로직 무력화) → **1개 실패**
2. ref 콜백 내부 `el.scrollIntoView?.(...)` 호출 라인 주석 처리 → **1개 실패**

두 실험 모두 `highlights and scrolls to the schedule row matching ?triggerId= on landing` 테스트가 의도한 대로 실패했다. 실험 전/후 모두 17개 테스트 전량 통과를 재확인했다.

## 발견사항

- **[INFO]** "highlights and scrolls..." 테스트는 non-vacuous 함을 실증 확인
  - 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:568-575`, `page.tsx:1018-1038`
  - 상세: `isFocused` 파생 로직 제거, `scrollIntoView` 호출 라인 제거 각각 독립적으로 실험한 결과 해당 테스트가 fail. `data-testid="schedule-focused-row"` 존재 여부와 `Element.prototype.scrollIntoView` mock 호출 여부 두 단언 모두 실제 구현 동작에 결합(coupled)되어 있어 회귀 감지력이 있다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 빈 문자열 `triggerId` 오매칭 케이스의 명시적 회귀 테스트 부재 (커버리지 갭, 저위험)
  - 위치: `page.tsx:510` (`triggerId: s.trigger?.id ?? ""`), `page.tsx:1018-1019` (`isFocused = !!focusTriggerId && schedule.triggerId === focusTriggerId`)
  - 상세: `mapSchedule` 은 `trigger` 가 없는 스케줄에 대해 `triggerId: ""` 로 매핑한다. 만약 URL 이 `?triggerId=`(빈 문자열)로 진입하면 `focusTriggerId` 도 `""` 가 되어, `!!focusTriggerId` 가드가 없었다면 `"" === ""` 로 오매칭되어 trigger 없는 스케줄 행이 강조되는 회귀가 가능했다. 현재 코드는 `!!focusTriggerId` 로 이 케이스를 방어하고 있어 실제 결함은 없다. 다만 테스트 스위트의 "파라미터 없음" 케이스는 `focusTriggerId === null`(쿼리 파라미터 자체 부재) 만 검증하고, `?triggerId=`(빈 문자열 쿼리) + trigger 없는 스케줄이 공존하는 조합은 별도로 커버하지 않는다. `!!focusTriggerId` 가드를 실수로 `focusTriggerId !== null` 등으로 완화해도 현재 스위트가 잡아내지 못한다.
  - 제안: `it("does not highlight a no-trigger schedule when ?triggerId= is empty")` 같은 케이스를 추가해 이 가드를 명시적으로 고정(pin)하면 향후 리팩터링 시 회귀를 방지할 수 있다. 우선순위는 낮음(현재 로직 자체는 안전).

- **[INFO]** `Element.prototype.scrollIntoView` mock 복원(restore) 부재
  - 위치: `schedules-page.test.tsx:541-542` (`beforeEach` 내 `Element.prototype.scrollIntoView = vi.fn();`)
  - 상세: 이 신규 describe 의 `beforeEach` 에서 프로토타입에 직접 `vi.fn()` 을 대입하고, `afterEach`/`afterAll` 에서 원래 값(jsdom 은 `scrollIntoView` 미구현이라 원래 `undefined`)으로 복원하지 않는다. `vi.clearAllMocks()` 는 프로토타입 프로퍼티 자체를 되돌리지 않으므로, 이 describe 실행 후 같은 모듈 컨텍스트에 남아있는 다른 코드가 `Element.prototype.scrollIntoView` 를 참조하면 mock 이 남아있게 된다. 다만 vitest 기본 설정(`isolate` 미지정 → 기본 `true`, `vitest.config.ts` 에 `pool`/`isolate` 오버라이드 없음)에서는 테스트 파일마다 별도 워커/모듈 컨텍스트가 부여되므로 다른 테스트 파일로의 실질적 leak 은 확인되지 않았다. 이 describe 는 파일의 최종 describe 이기도 해서 같은 파일 내 다른 describe 로의 영향도 없다.
  - 제안: 위생 차원에서 `afterEach` 에 `delete (Element.prototype as any).scrollIntoView;` 또는 원본 참조 저장 후 복원하는 코드를 추가하면 더 안전하지만, 현재 리스크는 낮다(실기능 결함 아님).

## 각 검토 항목별 결론 요약

- **비-vacuous 여부**: 실증 확인 완료(위 실험 1, 2). 결함 없음.
- **`scrollIntoView` beforeEach mock 적절성**: jsdom 미구현 API 를 stub 하는 표준적인 패턴이며 적절. 단언은 mock 호출 여부만 검증하지만 실험으로 실제 ref 콜백 경로와 결합돼 있음을 확인. 문제 없음.
- **미매칭/파라미터 없음 테스트 유효성**: 두 테스트 모두 유효하게 각기 다른 경로(`triggerId` 불일치, `triggerId` 파라미터 자체 부재)를 검증한다. 단, 빈 문자열(`?triggerId=`) 조합은 미커버(INFO, 저위험 — 위 참고).
- **`currentSearchParams` mutable mock 격리**: 신규 describe 의 `beforeEach` 가 `currentSearchParams = new URLSearchParams()` 로 매 테스트 전 재설정하고, 각 테스트가 필요 시 명시적으로 재할당(`currentSearchParams = new URLSearchParams("triggerId=t1")` 등)한다. 파일 전체에 걸쳐 다른 describe 들도 동일 패턴(`beforeEach` 재설정)을 따르고 있어 describe 간 leak 없음. `afterEach` 전역 `cleanup()` 도 존재해 DOM leak 방지도 기존 파일 관례와 일관됨.
- **17개 테스트 통과**: 재실행하여 확인(원본 상태, 실험 전/후 모두 17 passed).

## 요약

신규 3개 테스트는 실제로 `page.tsx` 의 강조(`isFocused`/`data-testid`)·스크롤(`scrollIntoView` ref 콜백) 로직에 결합된 non-vacuous 테스트로, 실험적으로 로직을 제거했을 때 정확히 fail 함을 확인했다. `currentSearchParams` mock 은 파일의 기존 관례(매 describe `beforeEach` 재설정)를 따라 격리되어 있고 describe 간 leak 이 없다. `!!focusTriggerId` 가드 덕분에 빈 문자열 `triggerId` 오매칭 회귀는 코드상 안전하지만, 이를 직접 고정하는 회귀 테스트가 없는 점과 `scrollIntoView` prototype mock 의 명시적 복원이 없는 점은 낮은 우선순위의 개선 여지로 남는다. 전반적으로 심각한 결함은 발견되지 않았다.

## 위험도

LOW
