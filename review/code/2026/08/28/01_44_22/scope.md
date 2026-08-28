# 변경 범위(Scope) 리뷰 — system-error-banner (01_44_22)

## 검토 절차

- `git diff origin/main --stat` 로 실제 변경 파일을 전수 확인 — 프롬프트에 제시된 14개 파일과 정확히 일치(총 787 insertions, 60 deletions, 신규 12 / 수정 2).
- 두 커밋으로 구성: `9869afd5c`(핵심 결함 수정) + `6e35a30a6`(같은 PR 내 직전 리뷰 라운드 `01_26_11` 의 WARNING 4건 반영).
- `plan/in-progress/system-error-banner-live-ws.md` 의 체크리스트(라인 55~62)와 실제 diff 를 항목별 1:1 대조.
- `review/code/2026/08/28/01_26_11/RESOLUTION.md`·`SUMMARY.md` 와 `use-execution-events.ts`/`use-execution-events.test.ts` 의 실제 수정 내용을 대조해, 두 번째 커밋이 그 라운드가 지목한 WARNING(W1~W4) 각각에 정확히 대응하는지 확인.

## 발견사항

없음.

### 판단 근거

1. **프로덕션 코드 변경은 결함 수정 두 지점에 국한** — `extractNodeErrorPayload` 의 unwrap 깊이를 `rawOutput.output.error` 로 정정(`use-execution-events.ts` 84-90행 게이트)하고, `handleNodeFailed` 가 `payload.output` 을 실제로 전달(909행 게이트)하도록 배선을 고쳤다. 둘 다 plan 체크리스트 1·2번 항목과 정확히 일치.

2. **`asRecord` 헬퍼(51-56행 게이트)는 기능 확장이 아니라 2단 중첩 접근의 가독성 최소 추출** — 새 로직·새 분기·새 기능이 아니라 `v && typeof v === "object" && !Array.isArray(v)` 라는 기존에 인라인으로 반복되던 패턴을 이름 붙인 것뿐이며, 호출부는 정확히 그 함수 안에서만 쓰인다.

3. **`direct` 분기(`rawError`)·`rawError` 파라미터 제거**는 plan 체크리스트에 명시돼 있지 않지만 범위 밖 리팩토링이 아니다 — 같은 함수(`extractNodeErrorPayload`)의 unwrap 로직을 고치는 이 PR의 핵심 diff와 물리적으로 같은 블록이고, 직전 리뷰 라운드(`01_26_11`)의 testing-reviewer 가 뮤테이션으로 커버리지 0을 실증한 WARNING(#4)에 대한 직접 대응이다. `RESOLUTION.md` W4가 "도달 불가능 + 결함을 낳은 계약을 그대로 인코딩" 을 근거로 제거를 선택한 것을 명시하고, CLAUDE.md 는 "구현 완료 후 같은 턴의 WARNING fix" 를 상시 승인된 의무로 규정한다 — 신규 기능도 무관한 파일도 아니다.

4. **`wrapNodeHandlerOutput` 테스트 빌더(test.ts 1986-1990행 게이트) 신설**도 같은 라운드 maintainability-reviewer WARNING(#3, fixture 손복제 5곳)에 대한 대응이며, 정확히 그 5곳(CT-S9·S10·S15·completed·신규 캐너리)에서만 쓰인다. 새 프로덕션 동작을 추가하지 않는 테스트 전용 헬퍼.

5. **fixture 4곳 정정 + 캐너리 2건**은 plan 체크리스트 4~6번과 1:1 대응 — `error` 를 문자열로, `output` 을 `NodeHandlerOutput` 래퍼로 바꿔 production shape 을 반영했고, "output 미동봉 경로" 테스트는 기존 테스트를 라벨·주석만 정정해 재사용(로직·assert 대상 불변, plan 체크리스트 6번이 명시적으로 이 재사용 방식을 지시).

6. **주석/JSDoc 재작성**(핵심 함수 JSDoc, `handleNodeFailed`/`handleNodeCompleted` 인라인 주석, 테스트 제목)은 이번 diff가 바꾼 shape(§4.1-a)을 정확히 반영하는 설명 갱신이며, 두 번째 커밋의 W1·W2·INFO5 대응이다. 새 규칙·새 계약을 추가하는 것이 아니라 코드가 실제로 하는 일을 서술만 갱신.

7. **`review/code/2026/08/28/01_26_11/**` 11개 파일 신규 추가**는 코드가 아니라 이 PR의 직전 리뷰 라운드 산출물이며, 프로젝트 컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`")상 정상적으로 커밋되는 아티팩트다. `RESOLUTION.md` 가 그 라운드 WARNING/INFO 전부를 항목별로 반영/보류 사유와 함께 기록하고 있어, 두 번째 커밋의 코드 변경과 정확히 대응 관계를 이룬다. 무관한 리팩토링이나 별도 작업이 아니다.

8. **`plan/in-progress/system-error-banner-live-ws.md` 신규**는 작업 추적 컨벤션에 따른 정상 산출물이며 `spec_impact: none` 으로 spec 변경 없음도 diff 와 일치한다.

9. **포맷팅/임포트/설정 변경**: 두 파일의 diff 훅 전부가 의미 있는 코드·주석 변경이며 공백/줄바꿈-only 훅은 없음. import 구문 변경 없음(신규 import 없음, 기존 import 정리 없음). `.eslintrc`·`tsconfig`·`package.json` 등 설정 파일 변경 없음.

## 요약

diff 전체(2 커밋, 14 파일)가 `plan/in-progress/system-error-banner-live-ws.md` 체크리스트와 직전 리뷰 라운드(`01_26_11`)의 WARNING 4건에 정확히 1:1 대응한다. 프로덕션 코드 변경은 `extractNodeErrorPayload` 의 래퍼 2단 언래핑과 `handleNodeFailed` 의 `payload.output` 배선이라는 결함 수정 두 지점에 국한되며, `direct` 분기 제거·`asRecord`/`wrapNodeHandlerOutput` 헬퍼 신설은 신규 기능이 아니라 같은 함수·같은 테스트 블록을 대상으로 한 review-driven 정리(커버리지 0 죽은 코드 제거, fixture 복제 제거)로 이 프로젝트가 "구현 완료 후 같은 턴 의무"로 규정한 워크플로에 부합한다. 무관한 파일·설정·포맷팅·불필요한 임포트 변경은 발견되지 않았고, `review/code/**` 신규 파일 11개는 코드가 아니라 컨벤션에 따른 리뷰 산출물이다.

## 위험도

NONE
