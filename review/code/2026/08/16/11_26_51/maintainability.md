# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

`git diff origin/main...HEAD --stat -- codebase/` 기준 실질 코드 변경은 3개 파일이다:

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설, `toTerminalErrorPayload()` 4개 반환 경로에 일괄 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 다수 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만(로직 무변경)

이 PR 은 이미 4차례 `/ai-review` 라운드(`09_51_00` → `10_19_30` → `10_41_55` → `11_04_07`)를
거쳤고, 직전 라운드(`11_04_07`)의 maintainability 리뷰가 위 3개 파일 전부를 직접 대조해
"수렴, Critical 0 · 신규 근거 없는 기결정 INFO 2건만 잔존, LOW" 로 마감했다. 이번 라운드
(`11_26_51`)의 실제 신규 변경분은 최신 커밋(`5d4d8dab7`) 하나뿐이며, `codebase/` 안에서는
`sanitize-error-message.ts` 의 docstring만 건드렸다(`terminal-error-payload.ts`·
`terminal-error-payload.spec.ts` 는 `11_04_07` 이후 무변경 — `git show 5d4d8dab7 --stat` 로 확인).
나머지 파일(`CHANGELOG.md`, `plan/**`, `review/**`)은 코드가 아니다.

## 검증한 항목 (직접 파일 대조)

- `terminal-error-payload.ts` 현재 상태를 재확인 — `redactTerminalError`(47-115행) JSDoc 은
  자신의 선언(107행) 바로 위에 귀속되고, `toTerminalErrorPayload` 의 `@param`/`@returns`
  (117-121행)도 자신의 선언(122행) 바로 위에 있다. `11_04_07` 이 확인한 "JSDoc 궤도 이탈
  재발 없음" 이 그대로 유지된다.
- `redactTerminalError` 8줄·단일 조건부 spread, `toTerminalErrorPayload` 얕은 순차 `if` 4개
  (중첩 깊이 1) — 순환 복잡도·중첩 모두 낮다. 네이밍(`redact*` 계열) 일관.
- 이번 라운드의 유일한 신규 diff(`sanitize-error-message.ts` 1-30행)를 직접 열어 대조 — 아래
  발견사항 참고.

## 발견사항

- **[INFO]** 함수 docstring 안에 "과거 서술이 틀렸던 이유" narrative 가 두 겹으로 쌓여, 표가
  이미 말하는 사실을 산문이 다시 설명한다
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:4-20`
  - 상세: 이번 diff 가 4-10행에 호출부 3곳을 표로 정리해 "무엇에 쓰나" 를 정확·간결하게
    고정했다(좋은 개선). 그런데 바로 이어지는 12-15행("종전 첫 줄은 … 사실이 아니다")과
    17-20행("그 정정도 한 번 더 좁아야 했다")은 **표가 이미 확정한 사실**(호출부 3곳,
    `background-execution.processor` 가 WS 에도 싣는다는 것)을 두 라운드에 걸친 자기수정
    서사로 다시 풀어 설명한다. 표와 산문이 같은 사실(호출부 범위)을 서로 다른 형태로
    나란히 담고 있어, 향후 호출부가 하나 더 생기거나 채널이 바뀌면 표만 갱신되고 산문의
    역사적 설명은 stale 로 남을 여지가 있다 — 이 PR 자신이 이미 `terminal-error-payload.spec.ts`
    의 중복 단언(WARNING, `09_51_00`)에서 겪은 것과 같은 "정보가 두 곳에 있으면 한쪽만
    갱신된다" 패턴이다. 다만 여기서는 코드가 아니라 주석이라 실행 결과에 영향은 없고,
    이 저장소가 이미 3라운드 연속 "문서 지배적 스타일은 컨벤션에 부합, 조치 불요" 로
    확정한 것과 같은 종류의 트레이드오프(재지적 방지용 근거 축적)라 강하게 문제 삼을
    사안은 아니다.
  - 제안: 조치 불요(강한 요구 아님). 향후 이 파일에 세 번째 자기수정 레이어가 또 쌓이면,
    "현재 사실"은 표만 남기고 "왜 이렇게 좁혔나"의 역사적 서사는
    `plan/in-progress/eia-terminal-error-sanitize.md`(이미 같은 이력을 상세히 담고 있다)로
    포인터만 남기는 이관을 고려. `10_19_30`/`11_04_07` maintainability 리뷰가 같은 파일군에
    남긴 "근거가 더 누적되면 plan/Rationale 로 옮기라" 는 권고와 같은 방향이다.

새로 제기할 매직 넘버·과도한 중첩·중복 로직(신규 코드)·컨벤션 이탈은 발견하지 못했다.
`terminal-error-payload.ts`/`terminal-error-payload.spec.ts` 는 `11_04_07` 이후 바이트 단위로
무변경이라 그 라운드가 기결정 처리한 INFO 2건(타입 단언 `as string`, optional-키 관용구 혼재)
을 이번 라운드에서 다시 검토할 근거도 없다.

## 요약

이번 라운드의 실질 diff 는 `sanitize-error-message.ts` docstring 정정 한 건뿐이다(핵심 로직
파일 `terminal-error-payload.ts`/`terminal-error-payload.spec.ts` 는 직전 라운드 이후
무변경). 그 정정은 모호했던 "3곳 전부 알림 조립" 총칭을 호출부별 용도를 명시한 표로 바꿔
정확성을 높인 순개선이며, 함수 본문(길이 11줄, 분기 없음)은 무변경이라 함수 길이·중첩
깊이·순환 복잡도 관점에서 리스크가 없다. 유일한 관찰은 표로 확정한 사실을 이어지는 두
문단이 역사적 서사 형태로 다시 설명해 정보가 두 표현에 흩어진다는 점(INFO)이며, 이는 이
저장소가 이미 여러 라운드에 걸쳐 "문서 지배적 스타일은 컨벤션에 부합"으로 확정한 것과 같은
종류의 트레이드오프라 차단 사유가 아니다. 4개 라운드 전부에 걸쳐 코드 로직 결함은
`09_51_00` 이 마지막이었고, 이후 라운드는 전부 서술 정확성 문제였다는 이 PR 자신의 관찰과
일치한다.

## 위험도

LOW
