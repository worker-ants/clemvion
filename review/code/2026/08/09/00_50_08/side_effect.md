# 부작용(Side Effect) 리뷰 결과

## 발견사항

없음.

## 요약

이 변경은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 기록된 lint 게이트 복구
작업으로, `origin/main..HEAD` 전체 diff(75 파일, +272/-375)를 직접 확인한 결과 사실상 두
가지 기계적 패턴으로만 구성된다: (1) `@typescript-eslint/no-unnecessary-type-assertion` 이
지목한 `as T` / `as unknown as T` 캐스트 제거(예: `websocket.service.ts` 의
`sanitizePayloadForWs(...) as Record<string, unknown>` → 캐스트만 제거, `hooks.service.ts` 의
`config.languageLocale as LanguageLocale | undefined` → `ChatChannelConfig.languageLocale`
가 이미 그 타입이라 캐스트가 항상 redundant, `secret-resolver.service.ts` 의
`ref as unknown as string` 등), (2) prettier 3.9 규칙에 따라 멀티라인 union 타입을 한 줄로
접는 순수 포맷팅. 타입 단언(`as`)은 컴파일 타임에만 존재하고 런타임에 아무 코드도 생성하지
않으므로, 이를 제거해도 실행 시 동작(전역 상태·파일시스템·네트워크 호출·시그니처 실질
변경·이벤트/콜백 발생 순서)에는 영향이 없다. 함수 시그니처(파라미터/리턴 타입)나 공개 API
형태가 바뀐 곳도, 새 전역 변수·환경 변수 read/write 도, 새 I/O 도 없다. 유일하게 주목할
가치가 있는 항목은 `test/execution-seq-allocator-load.e2e-spec.ts` 에서
`// eslint-disable-next-line no-console` 주석 2곳이 제거된 것인데, `console.log` 호출
자체는 그대로 남아 있어 런타임 부작용(로그 출력)에는 변화가 없다 — 해당 룰이 이 파일에
실제로는 적용되지 않아 "미사용 disable directive" 로 지목됐을 가능성이 높은 정리로 보이며,
사이드이펙트 관점에서는 무해하다. `retry-turn.service.ts` 에 남겨진 1건의
`eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion` 은 로드베어링
narrowing(`unknown` → `{ details?: ... }`)을 보존하기 위해 **의도적으로 유지**됐고, plan
문서(§체크리스트)에 그 근거(`nest build` 로 반증됨)가 기록되어 있어 회귀가 아니다. `plan/`
문서 2건 변경도 서술/기록 갱신뿐이며 코드 부작용과 무관하다.

## 위험도

NONE
