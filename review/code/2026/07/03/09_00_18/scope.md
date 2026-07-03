# 변경 범위(Scope) 리뷰

## 발견사항

없음.

## 상세 분석

리뷰 대상 diff(`44f956e9c`(C-2 본체, #791) → `762a56078`)를 계획 문서
`plan/in-progress/refactor-06-c2-followups.md` 와 대조한 결과, 4개 체크박스
항목(W2/W3/W5/W6) 각각이 정확히 1:1로 대응하는 최소 diff로 구현되어 있다.

- **W6 (커스텀 에러클래스)**: `execution-engine.service.ts` — 매직스트링
  `'__resume_claim_exec_terminal__'` + 클로저 플래그(`execMismatch`)를
  `ResumeClaimExecTerminalError` 클래스 + `instanceof` 판별로 교체. 기존
  로직·분기 구조는 그대로, 판별 메커니즘만 치환한 좁은 diff.
- **W5 (세그먼트 헬퍼 추출)**: `this.segmentStartMs.set(executionId, Date.now())`
  중복 2곳을 `recordRunningSegmentStart(executionId)` private 메서드로 추출.
  호출부 2곳만 교체, 그 외 로직 변경 없음.
- **W2 (unit 테스트 추가)**: `execution-engine.service.spec.ts` 에
  `driveResumeAwaited` 의 RUNNING skip-guard 케이스 1건만 순수 추가(append).
  기존 테스트 수정 없음.
- **W3 (e2e 테스트 추가)**: `execution-park-resume.e2e-spec.ts` 에 동시 재개
  e2e 케이스 1건만 순수 추가(append). 기존 테스트 수정 없음.
- `plan/in-progress/refactor-06-c2-followups.md` 신규 — 계획 문서 자체이므로
  범위 내.

체크: `git diff 44f956e9c..762a56078 --stat` 결과 4개 파일만 변경되어 있고
(`execution-engine.service.ts`/`.spec.ts`, `execution-park-resume.e2e-spec.ts`,
plan 문서), 각 파일의 diff 라인 수(36/91/89/16)도 대응 항목의 범위와 부합한다.
無관 파일(spec/, 다른 서비스, 설정 파일 등) 수정 없음. import 변경 없음.
포맷팅/공백만 바뀐 라인 없음(교체된 라인은 모두 의미 있는 코드/주석 변경).
주석 수정은 모두 위 4개 항목의 근거를 설명하는 데 국한(`ResumeClaimExecTerminalError`
사용을 반영한 주석 갱신, `recordRunningSegmentStart` 를 설명하는 JSDoc 신규) —
불필요한 주석 첨삭 없음. 기능 확장(over-engineering) 징후 없음 — 모든 변경이
계획서에 명시된 defer 항목 처리로 정확히 수렴.

## 요약

diff 는 plan 파일에 명시된 4개 non-blocking WARNING(W2/W3/W5/W6) 처리로 정확히
국한되어 있으며, 각 항목이 최소 diff(에러클래스 추출, 헬퍼 추출, 테스트 2건 추가)로
구현됐다. 의도 이상의 변경, 무관한 리팩토링, 기능 확장, 포맷팅/임포트/설정 잡음이
전혀 발견되지 않았다.

## 위험도

NONE
