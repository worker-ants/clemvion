# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 살아있는 plan 문서의 후속작업 줄번호 인용이 이 PR 자신의 편집으로 stale 해졌다
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md:58`(인용부) →
    실제 대상 `codebase/backend/src/nodes/core/error-codes.ts:122`(현재 "엔진 레이어" JSDoc 시작 위치)
  - 상세: 이 plan 문서는 아직 열려 있는(`status: in-progress`) 후속작업 항목에서
    `codebase/backend/src/nodes/core/error-codes.ts:114-115` 를 "`EngineErrorCode` JSDoc 이
    **엔진 레이어 이분법**으로 프레이밍한다" 는 미해결 drift 의 위치로 지목한다. 그런데
    직접 파일을 열어 확인하면 현재 114-115행은 `VALIDATION_ERROR`/`INVALID_FIELD` 상수
    정의부이고, 실제 "엔진 레이어" 문구가 있는 `EngineErrorCode` JSDoc 블록은 121~131행
    (문구 자체는 122행)에 있다 — 약 7~8줄 밀렸다. 원인은 바로 이 changeset 이 같은 파일
    최상단 `ErrorCode` JSDoc 에 6줄을 추가한 diff(파일 4, `@@ -1,5 +1,11 @@`)다. 인용
    시점을 추적해 보면 소비스 히스토리도 이를 뒷받침한다 — 같은 follow-up 을 반복 인용한
    consistency 세션 기록에서 `:116,125`(`21_49_21` 라운드) → `:114-115`(`21_56_30`,
    `23_17_23` 라운드) 로 이미 한 번 드리프트했고, 최종 커밋에서 최상단 JSDoc 이 한 번
    더 늘며 지금 상태로 벌어졌다. `review/consistency/**` 쪽 인용은 봉인된 시점 기록이라
    고칠 대상이 아니지만(이 프로젝트 관례 — RESOLUTION `22_25_37` INFO 9 참조), 이
    plan 문서는 **아직 열려 있고 다음 developer 턴이 실제로 찾아갈 좌표**라는 점에서
    다르다. 지금 상태로 두면 다음 사람이 114-115행(`VALIDATION_ERROR`)을 보고 "이미
    고쳐져 있다" 고 오판하거나 엉뚱한 줄을 수정할 위험이 있다.
  - 제안: `plan/in-progress/spec-conventions-engine-error-code-surface.md:58` 의 줄번호
    인용을 `error-codes.ts:121-131`(또는 앵커 문구 `"엔진 레이어" 에러 코드 —` 기준 서술)로
    갱신한다. 이 파일이 이번 PR 안에서도 여러 차례 편집되며 계속 줄이 밀렸으므로, 향후
    유사 인용은 이 저장소의 기존 교훈대로 줄번호 대신 앵커 문자열(`grep` 가능한 고유
    구절)을 함께 적어 재드리프트에 대비하는 편이 낫다.

## 확인했으나 문제 없음 (근거 기록)

- `codebase/backend/src/nodes/core/error-codes.ts` 최상단 `ErrorCode` JSDoc(1~13행)이
  새로 추가한 "boundary is asymmetric" 서술은 `spec/conventions/error-codes.md` §Overview
  (10~37행)의 "경계는 비대칭이다" 문단과 표현·근거가 정확히 일치하고, JSDoc 이 인용하는
  `§Overview` 섹션도 실제로 존재한다(`## Overview`, 10행). 상호 참조가 어긋나지 않는다.
- §Overview 가 "키가 겹치지 않는다(테스트로 고정)" 이라고 적은 주장을 직접 검증했다 —
  `error-codes.spec.ts` 에 `EngineErrorCode enum` describe 블록이 있고, 그 안의
  `'shares no code with ErrorCode'` 테스트가 `Object.keys(EngineErrorCode).filter((k) => k
  in ErrorCode)` 를 빈 배열로 단언한다. 문서의 "테스트로 고정" 표현이 지어낸 근거가 아니다.
- §3 예외 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행이 "이미 `EngineErrorCode` 멤버를
  다루고 있다" 는 §Overview 새 문단의 주장도, 실제로 `WORKER_HEARTBEAT_TIMEOUT` 이
  `ErrorCode` 가 아니라 `EngineErrorCode` const 안에 정의돼 있음을 grep 으로 확인해
  일치했다.
- `.claude/docs/plan-lifecycle.md` 새 절("이동하는 문서 자신의 outgoing 링크도 재계산")이
  인용하는 "`findBrokenPlanLinks` 가 `plan/complete/**` 를 의도적으로 제외한다" 는 근거도
  `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:430-438` 의 실제 JSDoc과
  대조 확인했다 — 문서-코드 간 어긋남이 없다. 이전 라운드에서 지적된 마크다운 `**...
  **자신의**...**` 자기중첩(회귀 2R W6)도 현재는 `*자신의*` 로 정정돼 있어 렌더링 문제가
  없다.
- `.claude/hooks/_lib/plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 정규식과 `_all_checkboxes_
  done()` docstring 은 열린/닫힌 체크박스를 비대칭으로 세는 최종 설계·그 근거(과거 두
  실패 사례, 반증된 초판 주장, 저장소 실사용 선례)를 정확하고 상세하게 기록하고 있다.
  `.claude/tests/test_plan_guard.py` 의 신규 테스트 6종(인용문 열린/중첩/서술 대조군/
  인용문 닫힘 단독/공존/거부권 유지) 각각의 docstring 도 실제 동작과 일치한다.
  `.claude/tools/plan-stale-audit.sh:123-125` 가 이 확장을 받지 못해 "세 번째 drift" 가
  났다는 `plan/in-progress/harness-review-gate-followups.md` 의 등재 내용도 스크립트를
  직접 열어 그 줄 번호·정규식이 정확히 일치함을 확인했다.
- 신규 파일 `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` 는 "무엇을
  막나 / 범위를 왜 직접 정하나 / 왜 코드펜스를 예외로 두지 않나" 세 문단으로 설계 결정을
  전부 서술하고, `MIN_EXPECTED_MD_FILES` 상수 주석에는 최초 오기(재지 않고 쓴 "436")를
  스스로 정정한 이력까지 남겨 두었다. 신규 build-blocking 가드가 규약 SoT
  (`spec/conventions/spec-impl-evidence.md §4.2`)에 미등재된 문제는 이미 1R 리뷰에서
  지적됐고, `plan/in-progress/harness-review-gate-followups.md:174-181`에 "이번 PR 에서
  안 하는 이유"(spec 축이 이미 과다 번들됐다는 동일 리뷰의 다른 WARNING과 상충)와 재개
  신호까지 명시해 등재돼 있어 무조치가 아니라 의식적 유예다.
- CHANGELOG.md 갱신 누락 여부 — 이 changeset 은 harness/plan/spec-convention 성격이고
  이 저장소에서 `fix(harness)`/`docs(harness)`/`docs(plan)`/`docs(spec)` 류 커밋이
  CHANGELOG 를 갱신한 선례가 없어(과거 라운드에서 이미 확인됨) 이번 누락도 관례를 깨는
  것이 아니다.

## 요약

이 changeset(harness 체크박스 정규식 비대칭 확장, 도구 아티팩트 태그 잔재 가드 신설,
`plan-lifecycle.md` outgoing-link 절 추가, `error-codes.ts`/`error-codes.md` 의
`EngineErrorCode` 병기 문서화)은 이미 3라운드의 코드 리뷰와 6라운드의 consistency 검토를
거치며 문서화 관점의 실질적 결함(SoT 미등재·서술-코드 불일치·자기중첩 마크다운 등)이 대부분
해소됐고, 남은 유예 항목들도 근거·재개 신호와 함께 명시적으로 등재돼 있다. 직접 코드를 열어
교차 검증한 결과 새로 추가된 JSDoc·주석·docstring 은 실제 동작·테스트와 정확히 일치했다.
유일하게 새로 발견한 문제는 `spec-conventions-engine-error-code-surface.md` 의 아직 열려
있는 후속작업 항목이 인용하는 `error-codes.ts` 줄번호가 이 PR 자신의 편집(최상단 JSDoc
6줄 추가)으로 stale 해진 것이다 — sealed 된 `review/**` 기록과 달리 이 plan 은 다음
developer 턴이 실제로 참조할 살아있는 좌표라 정정 가치가 있다.

## 위험도

LOW
