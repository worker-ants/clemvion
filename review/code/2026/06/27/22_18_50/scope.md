# 변경 범위(Scope) 리뷰 결과

리뷰 대상: Channel Web Chat 위젯 리팩터(B2/B3/B5/B6) + 테스트 보강(C)
리뷰 일시: 2026-06-27
선언 범위: `plan/in-progress/webchat-widget-refactor.md` §B·§C

---

## 발견사항

발견된 범위 일탈 없음. 아래는 각 파일별 범위 적합성 확인이다.

### 파일별 범위 적합성

- **[INFO]** `widget-state.ts` — `isTextInputSurface()` 함수 추출 + JSDoc: B2/B5 선언 범위 내. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` +10줄 (함수 + 주석)
  - 상세: 기존 `PendingInteraction` 타입 정의 뒤에 헬퍼만 삽입. 기존 인터페이스/타입/리듀서 코드 미접촉.

- **[INFO]** `widget-state.test.ts` — `isTextInputSurface` import 추가 + 4케이스 직접 단위 테스트: C(테스트 보강) + RESOLUTION #12 반영. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` +25줄
  - 상세: ERROR→ended/ended 재open 2개 reducer 케이스도 추가됐으나 이는 C 항목("ERROR→ended reducer 강화 · ended 재open reducer")에 명시된 범위 내.

- **[INFO]** `panel.tsx` — import 변경(타입 only → `isTextInputSurface` 추가) + disabled 조건 denylist→allowlist 전환: B2/B5 선언 범위 내. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` -5/+2줄
  - 상세: Composer disabled 조건 1행만 수정. 다른 props·렌더 로직·JSX 구조 미접촉.

- **[INFO]** `panel.test.tsx` — `phase=ended` Composer 미렌더 케이스 추가: C("ended Composer 미렌더") 범위 내. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx` +13줄
  - 상세: 기존 `describe` 블록에 케이스 1개 추가만. 기존 테스트 미접촉.

- **[INFO]** `use-widget.ts` — `TERMINAL_EVENTS` 배열(B6) + `clearRefreshTimer`/`teardownSession` 헬퍼(B3) + `isTextInputSurface` 적용(B2/B5): 선언 범위 내. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` +25줄/-18줄
  - 상세: handleEiaEvent·newChat·언마운트 cleanup 세 곳의 중복 코드를 헬퍼로 일원화. 로직 변경 없는 순수 추출. `useWidget` God hook 분리(B1)는 이 PR 에서 미착수 — 올바름.

- **[INFO]** `use-widget-eager-start.test.ts` — `installControllableSse` 헬퍼 + C1 폐기 케이스 + fake-timer refresh 케이스 추가: C 범위 내. 범위 일탈 없음.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` +89줄
  - 상세: 기존 테스트 케이스 미접촉. 신규 helper 함수와 2개 `it` 블록만 추가.

- **[INFO]** `plan/in-progress/web-chat-quality-backlog.md` — §B·§C 체크박스 갱신 + B1 deferred 명시 + backlog 메모: RESOLUTION #4 반영 + 계획 파일 상태 동기화. 범위 일탈 없음.
  - 위치: `plan/in-progress/web-chat-quality-backlog.md` +5/-3줄

- **[INFO]** `plan/in-progress/webchat-widget-refactor.md` — 신규 plan 파일 생성: 프로젝트 규약(plan/in-progress 에 작업 추적) 준수. 범위 일탈 없음.
  - 위치: `plan/in-progress/webchat-widget-refactor.md` +33줄 (신규)
  - 상세: frontmatter·작업 체크박스·후속 항목 포함. `spec_impact: []` 명시(behavior-preserving).

- **[INFO]** `review/code/2026/06/27/22_08_42/SUMMARY.md`, `RESOLUTION.md`, `_retry_state.json` — /ai-review 산출물: 규약 경로(`review/code/YYYY/MM/DD/HH_mm_ss/`) 준수. 범위 일탈 없음.

---

## 요약

10개 변경 파일 전체가 `plan/in-progress/webchat-widget-refactor.md`에 선언된 B2·B3·B5·B6(헬퍼 추출) + C(테스트 보강) 범위 내에 있다. 불필요한 리팩토링, 기능 확장, 포맷팅 전용 변경, 무관 파일 수정은 발견되지 않았다. B1(God hook 분리)은 선언대로 별도 PR로 분리되어 이 PR에서 미착수 상태이며, 이는 올바른 범위 결정이다. plan 파일·review 산출물 변경은 모두 프로젝트 규약(plan-lifecycle, review 경로)을 준수한다.

---

## 위험도

NONE
