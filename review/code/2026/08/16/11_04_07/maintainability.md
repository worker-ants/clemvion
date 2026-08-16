# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실질 코드 변경은 3개 파일이다(`git diff origin/main...HEAD --stat -- codebase/`).

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설, `toTerminalErrorPayload()` 4개 반환 경로에 일괄 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 다수 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만(로직 무변경)

나머지(`CHANGELOG.md`, `plan/**`, `review/**`)는 코드가 아니다. 이 PR 은 이미 세 차례
`/ai-review` 라운드(`09_51_00` → `10_19_30` → `10_41_55`)를 거쳤고, `10_41_55` RESOLUTION 이
"Critical 0 · Warning 2 · 3라운드 수렴, codebase 편집 종료" 로 마감했다. 이번 라운드는 그
누적 diff(4 커밋, `codebase/**` 무변경분 포함)를 대상으로 재검증한다.

## 검증한 항목 (직접 파일 대조)

- **W2(`10_41_55`) 중복 단언 주석 비대칭 — 실제로 해소됨을 확인.** `terminal-error-payload.spec.ts:193-194`
  (`null`/`undefined` 중복)와 `:219-221`(`details` 키-생략 중복) 양쪽 모두 이제 "상단 스위트에도
  같은 단언이 있다 … 한쪽만 갱신되면 그때 갈린다" 취지의 대칭 주석이 붙어 있다. 이전 라운드가
  지적한 "한쪽만 설명됨" 비대칭은 더 이상 존재하지 않는다.
- **JSDoc 궤도 이탈(`09_51_00` scope W1) — 현재 구조에 재발 없음.** `redactTerminalError` 의
  JSDoc(47-106행)은 그 함수 선언(107행) 바로 위에, `toTerminalErrorPayload` 의 `@param`/`@returns`
  JSDoc(117-121행)은 그 함수 선언(122행) 바로 위에 있다 — 두 JSDoc 이 각자의 선언에 정확히 귀속된다.
- **"호출부 5곳" 주장(문서 정확성) — grep 으로 재검증, 정확함.** `toTerminalErrorPayload(` 호출
  지점은 `execution-engine.service.ts`(3곳) · `retry-turn.service.ts`(1곳) ·
  `chat-channel.dispatcher.ts`(1곳) = 정확히 5곳이며, JSDoc(63-64행)의 "4 + chat-channel 1" 분해와
  일치한다. 이 저장소가 반복해서 겪은 "주장이 구현보다 넓다" 패턴이 이 문서에는 없다.
- **CHANGELOG §3.3→§3.1 오표기 — 두 인용처 모두 정정 확인.** `CHANGELOG.md` 의 신규 항목과
  기존 항목 양쪽 다 이제 "§3.1"(EIA-NX-02) 로 일치한다.
- `redactTerminalError` 함수 길이 8줄, 분기 없음(단일 조건부 spread) — 순환 복잡도 매우 낮음.
  `toTerminalErrorPayload` 는 얕은 순차 `if`(중첩 깊이 1) 4개로 구성되고 모든 반환 경로가 동일한
  `redactTerminalError(...)` 를 통과하는 균일한 구조라 읽기 쉽다.
- 네이밍은 `redactSecrets`/`deepRedactSecrets`(기존)와 `redactTerminalError`(신규)가 `redact*`
  접두어로 일관된다.

## 발견사항

- **[INFO]** `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 타입 단언 — 이미 세 라운드 연속 검토·기결정, 신규 근거 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:110` — `message: deepRedactSecrets(p.message) as string,`
  - 상세: 현재 구현상 문자열 입력에는 문자열을 반환하므로 런타임 안전하나, 타입 시스템이 이를 보증하지 않는다. 세 라운드 전부 "조치 불요, 참고용"으로 결론났고 이번 diff 로 악화되지 않았다.
  - 제안: 조치 불요(기결정 유지).

- **[INFO]** 동일 함수 `toTerminalErrorPayload` 내부에서 "optional 키 생략" 관용구가 명령형 `if`(159행)와 조건부 spread(111-113행)로 혼재 — 이미 명시적으로 무조치 확정된 사안
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:159` vs `:111-113`
  - 상세: `09_51_00` RESOLUTION 이 "강한 요구 아님·기존 `if` 를 건드리면 diff 가 넓어진다"는 근거로 결정했고 이후 라운드들도 재확인했다. 이번 diff 로 새로 추가된 근거 없음.
  - 제안: 조치 불요(기결정 유지).

새로 제기할 만한 유지보수성 문제는 발견하지 못했다. 매직 넘버·과도한 중첩·중복 로직(신규
도입분)·컨벤션 이탈은 없다.

## 요약

3라운드에 걸쳐 이미 상세히 검토된 PR 을 재검증한 결과, 이전 라운드가 지적하고 "반영했다"고
주장한 항목들(중복 테스트 주석 비대칭, JSDoc 궤도 이탈)이 실제 파일 상태에서도 정확히 해소돼
있음을 직접 대조로 확인했고, 핵심 안전성 논거인 "호출부 5곳" 수치도 grep 으로 독립 재검증해
정확함을 확인했다. 핵심 로직(`redactTerminalError` 도입, 4개 반환 경로 일괄 배선)은 함수
길이·중첩 깊이·순환 복잡도·네이밍 모두 양호하다. 남은 항목(타입 단언, optional-키 관용구
혼재)은 세 라운드 전부터 반복 검토돼 이미 명시적으로 기각된 INFO 이며 이번 라운드에서 새로
추가할 근거가 없다. 유지보수성 관점에서 이 PR 은 수렴됐다.

## 위험도

LOW
