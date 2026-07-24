# 변경 범위(Scope) 리뷰

## 컨텍스트

`plan/in-progress/output-shape-comment-followups.md` 가 이번 변경의 스코프 정의서다. PR #983
최종 게이트 리뷰(SUMMARY INFO 1·4·5·6)에서 "다음에 이 파일을 편집할 때 함께" 로 defer 된 4건
중 실제 코드 변경이 필요한 2건(항목 2: endReason 키 부재 음성 테스트 추가, 항목 3: 주석 정리
3건)만 이번 diff 에 반영됐고, 나머지 2건(항목 1 union 재설계, 항목 4 `it.each` 전환)은 실측
근거를 남긴 **NO-GO** 판정으로 종결되어 코드 변경이 없다 — diff 에 구조 변경/`it.each` 흔적이
없는 것과 정확히 일치한다.

## 발견사항

- **[INFO]** JSDoc 재작성이 "언어 통일" 이상으로 구조를 확장함
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:111-152` (JSDoc 블록)
  - 상세: 영어 산문을 한국어로 옮기는 것 외에 `## 방어적 유지` 헤딩, blockquote(`> **근거의 SoT
    는 이 JSDoc 이다.**`) 등 새 구조가 추가됐다. 이 자체는 plan 항목 3("JSDoc ↔ 테스트 이중
    SoT" — 위임 규약을 JSDoc 말미에 명문화)에 명시적으로 포함된 결정이라 계획 이탈은 아니지만,
    "주석 정리" 라는 항목명 대비 실질 재작성 분량이 크다(diff +49/-33줄). 함수 바디(로직)는
    변경 없음을 diff 로 확인함 — 순수 comment-only 변경이 맞다.
  - 제안: 없음 (이미 plan 에 근거·판단이 기록되어 있어 조치 불요, 기록 목적의 INFO).

- **[INFO]** 테스트 주석 재작성이 계획된 4곳 + 1곳(SoT 포인터)으로 diff 와 정확히 일치
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
    (post-Stage-5 terminal / accepts every unified endReason / output.interactionType alone /
    nested conversationConfig alone / output.messages + meta.interactionType 5개 블록)
  - 상세: plan 항목 3 은 "OR-체인 3개 테스트 주석 + post-Stage-5 terminal 테스트(동일 위반)
    함께 교정(4곳)" + "JSDoc ↔ 테스트 이중 SoT"(accepts every unified endReason 코멘트의 SoT
    포인터 축약) 를 명시했고, diff 의 코멘트 변경 지점 5곳이 정확히 이 목록과 1:1 대응한다.
    기능 코드(assertion) 변경 없음 확인.
  - 제안: 없음 — 스코프 내 정합.

- **[INFO]** 신규 plan 문서(`plan/in-progress/output-shape-comment-followups.md`)는 저장소
  규약(`.claude/docs/plan-lifecycle.md`, worktree frontmatter) 을 준수하며, PR #983 SUMMARY 의
  구체적 INFO 항목 4건을 근거로 명시해 자기완결적이다. 스코프 이탈 아님.

## 요약

이번 diff 는 `plan/in-progress/output-shape-comment-followups.md` 에 명시된 4개 이월 항목 중
실제 코드 변경이 필요한 2건(신규 음성 테스트 1건 추가, 주석/JSDoc 정리 5곳)에 정확히 대응하며,
NO-GO 로 판정된 나머지 2건(OR-체인 구조 재설계, `it.each` 전환)은 코드에 아무 흔적을 남기지
않아 판정과 diff 가 일치한다. `output-shape.ts` 의 함수 바디(판정 로직) 는 무변경이며 diff 는
JSDoc/주석 블록에만 국한된다. 임포트·설정 파일 변경, 무관한 파일 수정, 요청 외 기능 추가, 의미
없는 포맷팅 변경은 발견되지 않았다. JSDoc 재작성이 단순 번역을 넘어 구조(헤딩/blockquote)까지
확장한 점만 기록해 두나, 이는 plan 에 명시적으로 계획된 결정이라 스코프 위반으로 보지 않는다.

## 위험도
NONE
