# 변경 범위(Scope) 리뷰

## 검증 방법

- `git diff origin/main --stat` 로 실제 커밋된 diff(3 커밋: `edb6b3466`→`c9a2a1dde`→`1d46f483a`)가
  prompt 에 제시된 14개 파일과 정확히 일치함을 확인.
- `git diff origin/main -- output-shape.ts` 에서 `+`/`-` 라인 전수를 주석 프리픽스(` * `/`//`)
  기준으로 걸러낸 결과 **non-comment 라인 0건** — "JSDoc 만 재작성, 로직 무변경" 주장을 직접 재현.
- `git diff origin/main -- __tests__/output-shape.test.ts` 전문을 읽고 각 hunk 를 "기존 주석 재작성"
  vs "신규 `it()` 블록" 으로 분류 — assertion(`expect(...)`)이 바뀐 기존 케이스는 0건.

## 발견사항

- **[INFO]** `isConversationOutput` JSDoc 재작성이 "주석 정리" 표현 대비 구조를 확장
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:111-152`
  - 상세: 영어→한국어 번역을 넘어 `## 방어적 유지` 헤딩, blockquote(`> **근거의 SoT 는 이 JSDoc
    이다.**`) 등 신규 구조가 추가됐다(+49/-33줄). 다만 이는 `plan/in-progress/output-shape-comment-followups.md`
    항목 3("JSDoc ↔ 테스트 이중 SoT — JSDoc 이 근거의 SoT 로 확정, 위임 규약을 JSDoc 말미에
    명문화")에 사전 명시된 결정이고, non-comment diff 0건이 실측으로 확인돼 함수 로직은 무변경이다.
    스코프 이탈로 보지 않는다.
  - 제안: 없음 (기록 목적).

- **[INFO]** 2차 테스트(`output.endReason` fallback 고립)는 원 plan 의 항목 2/4 범위 밖에서 발생
  - 위치: `__tests__/output-shape.test.ts` (`detects a terminal whose endReason sits at
    output.endReason, not result.endReason`) / `plan/in-progress/output-shape-comment-followups.md`
    "측정 1b" / `review/code/2026/07/23/14_19_49/RESOLUTION.md` INFO 3 항목
  - 상세: 이 fixture 는 최초 plan 문서가 정의한 "항목 2(endReason 키 부재 음성 테스트)"가 아니라,
    같은 작업 1차 라운드 `/ai-review` 의 testing 리뷰어 INFO 3(`output.endReason` fallback 단이
    어떤 fixture 로도 격리되지 않음)에 대한 후속 반영이다. plan 체크리스트에
    "(리뷰 INFO 3 반영)" 으로 명시 추가됐고 RESOLUTION.md 가 반영 근거(실측 재현: 삭제 시 tsc
    clean + 40/40 green → 머지 가능한 갭)를 남겼다. 프로젝트 관례(구현 완료 후 INFO 반영은 같은
    턴의 의무)와 일치하며 은폐된 추가가 아니라 문서로 추적된 확장이다.
  - 제안: 없음 — 스코프 확장이 아니라 규약대로 처리된 리뷰 피드백 반영.

- **[INFO]** `review/code/2026/07/23/14_19_49/*` 11개 파일(SUMMARY·RESOLUTION·meta.json·
  `_retry_state.json`·reviewer 7종 `.md`)이 diff 에 포함
  - 상세: 이 diff 대상 3개 소스/plan 파일과 무관해 보일 수 있으나, 프로젝트 규약상 코드 리뷰
    산출물(`review/code/**`)은 gitignore 대상이 아니라 커밋 대상이며, 이 폴더는 정확히 본 작업의
    **1차 `/ai-review` 라운드**(2차 커밋 `c9a2a1dde` 직후 실행) 산출물이다. `git diff origin/main
    --stat` 확인 결과 이 diff 가 다루는 3개 커밋 전부가 이번 작업(`#983` 이월 처분) 단일 스레드에
    속하며, 별건 작업의 무관한 파일이 섞여 들어온 흔적은 없다.
  - 제안: 없음 — 규약(harness 산출물 커밋)에 부합.

- **[INFO]** plan NO-GO 판정 2건(OR-체인 union 재설계, `it.each` 전환)은 diff 에 코드 흔적 없음
  - 위치: `plan/in-progress/output-shape-comment-followups.md` 항목 1·4
  - 상세: 두 항목 모두 실측 근거를 남긴 채 진행하지 않기로 결정됐고, 실제 diff 에도 구조 재설계나
    테이블 구동 전환 흔적이 전혀 없다 — 판정과 코드가 정확히 일치한다. "기능 확장(over-engineering)"
    으로 이어지지 않았음을 확인.
  - 제안: 없음.

- **[INFO]** 임포트·설정 파일 변경 없음
  - 상세: `output-shape.ts` import 구문(3줄) 전수 대조 결과 무변경. 설정 파일(`tsconfig`,
    `package.json`, lint 설정 등) 변경 0건.
  - 제안: 없음.

## 요약

이번 diff 는 `plan/in-progress/output-shape-comment-followups.md` 가 정의·추적하는 단일 작업
스레드(PR #983 이월 처분 4건 중 코드 변경이 필요한 2건 + 1차 리뷰 라운드에서 나온 INFO 1건 반영)
와 정확히 대응한다. 핵심 소스 파일(`output-shape.ts`)은 non-comment diff 0줄로 실측 확인된
JSDoc 전용 재작성이며, 테스트 파일은 기존 6곳의 주석 정비와 신규 `it()` 2건(원 plan 항목 2 + 리뷰
INFO 3 후속 반영) 뿐이다. JSDoc 구조 확장(헤딩/blockquote)은 사전에 plan 에 명시된 결정이고,
2차 신규 테스트는 은폐 없이 plan 체크리스트·RESOLUTION.md 양쪽에 근거가 남아 있다. `review/code/`
하위 11개 신규 파일은 무관한 파일이 아니라 이 작업의 1차 `/ai-review` 라운드 산출물로, 프로젝트
규약상 커밋 대상이다. 요청 외 기능 추가, 무관한 파일·코드 영역 수정, 의미 없는 포맷팅, 불필요한
임포트/설정 변경은 발견되지 않았다.

## 위험도
NONE
