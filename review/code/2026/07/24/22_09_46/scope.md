# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 새 `describe` 블록 앞에 연속 빈 줄 2개(포맷팅 잡음)
  - 위치: `codebase/channel-web-chat/src/lib/session-store.test.ts:62-63`
  - 상세: 기존 테스트("손상된 JSON → null") 종료 `});` 직후 빈 줄이 1개가 아니라 2개 연속으로 추가됐다. 실질 변경은 아니지만 diff 노이즈다.
  - 제안: 빈 줄 1개로 정리(선택 사항, 기능에 영향 없음).

## 요약

리뷰 대상 7개 파일(구현 2 · 테스트 3 · plan 라이프사이클 2) 전부가 "세션 ↔ 발급 apiBase 바인딩" 단일 작업 범위 안에 있다. `session-store.ts` 는 `PersistedSession.apiBase` 필드 추가 + `normalizeApiBase` 헬퍼 + `loadSession` 의 필수 `expectedApiBase` 인자와 불일치/미기록 폐기 로직만 추가했고, `use-widget.ts` 는 `persist()` 의 `apiBase: cfg.apiBase` 기록과 `applyConfig` 의 `loadSession` 호출부에 `cfg.apiBase` 전달, 단 두 지점만 건드렸다 — 관련 없는 리팩토링·포맷팅·임포트 변경은 없다. 세 테스트 파일의 변경은 타입 변경(`apiBase` 필수 필드화)에 따라 불가피한 fixture 갱신(`session()` 헬퍼·인라인 세션 JSON 전체에 `apiBase` 추가, `loadSession` 호출부에 두 번째 인자 추가)과, 새 동작을 검증하는 신규 테스트(불일치/레거시/trailing-slash/경로 상이/위젯 통합/대조군)로 구성되며 전부 이 기능의 회귀 방지에 직접 기여한다. `use-widget-eager-start.test.ts` 의 `boot()` 시그니처에 기본값 있는 `apiBase` 파라미터를 추가한 것도 기존 인자 없는 호출부(`boot()`)의 동작을 그대로 보존하면서 신규 통합 테스트만 다른 origin 을 주입하도록 하는 최소 배선이라 범위 이탈이 아니다. plan 파일 두 건(`in-progress` 삭제 → `complete` 신설)은 CLAUDE.md 가 규정한 표준 plan 라이프사이클 이동이며 신규 plan 은 spec_impact: none 근거와 mutation 검증 결과까지 기록해 범위를 스스로 좁혔다. 유일하게 지적할 점은 `session-store.test.ts` 에서 새 `describe` 섹션 앞에 빈 줄이 2개 연속 삽입된 사소한 포맷팅 잡음뿐이며 실질 변경과 섞여 리뷰를 방해하는 수준은 아니다.

## 위험도

NONE
