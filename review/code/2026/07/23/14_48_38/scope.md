# 변경 범위(Scope) 리뷰

## 컨텍스트

이번 라운드(3차, `14_48_38`)는 `plan/in-progress/output-shape-comment-followups.md` 를 스코프
정의서로 하는 diff 전체(25파일, +1657/-58)를 대상으로 한다. 실질 코드/문서 변경은 3파일뿐이고
나머지 22파일은 앞선 두 리뷰 라운드(`review/code/2026/07/23/14_19_49/`,
`review/code/2026/07/23/14_34_01/`)의 산출물이다.

- `codebase/.../output-shape.ts` — `isConversationOutput` JSDoc 재작성
- `codebase/.../output-shape.test.ts` — 테스트 주석 재작성 + 신규 테스트 3건
- `plan/in-progress/output-shape-comment-followups.md` — 신규 plan 추적 문서
- `review/code/2026/07/23/{14_19_49,14_34_01}/*` — 1·2차 `/ai-review` 산출물(SUMMARY/RESOLUTION/
  각 리뷰어 리포트/메타). 프로젝트 규약(`CLAUDE.md` "코드 리뷰 산출물 → review/code/**", 사용자
  메모 "review/ 는 gitignored 아님 — SUMMARY·RESOLUTION 도 커밋")상 이 자체가 요구되는 산출물이며
  스코프 이탈이 아니다.

`git diff origin/main...HEAD --stat` 결과 정확히 이 25파일과 일치, 프롬프트에 없는 은닉 변경 없음.

## 발견사항

- **[INFO]** `output-shape.ts` 변경이 실제로 comment-only 인지 라인 단위 실측
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
  - 상세: `git diff origin/main...HEAD -- output-shape.ts` 의 추가/삭제 라인을 주석 라인(`*`,
    `/*`) 및 공백 제외로 필터링한 결과 **실 코드 라인 0건**. JSDoc 재작성(+49/-33, `##` 헤딩·
    blockquote 신설 포함)은 분량은 크지만 함수 시그니처·바디·타입은 무변경임을 직접 확인했다.
    RESOLUTION.md 의 "non-comment diff 0줄" 주장과 일치.
  - 제안: 없음 (검증 통과).

- **[INFO]** JSDoc 구조 확장이 "주석 정리" 항목명 대비 분량이 크지만 plan 에 사전 계획됨
  - 위치: `output-shape.ts` JSDoc 블록 전체
  - 상세: 단순 번역을 넘어 `## 방어적 유지` 헤딩·blockquote(`> **근거의 SoT 는 이 JSDoc 이다**`)
    가 신설됐다. plan 항목 3("JSDoc ↔ 테스트 이중 SoT — 위임 규약을 JSDoc 말미에 명문화")에
    명시적으로 포함된 결정이고, 1·2차 리뷰 스코프 리뷰어(`14_19_49/scope.md`,
    `14_34_01/scope.md`)가 모두 동일 지점을 INFO 로 기록하며 스코프 위반 아님으로 판정했다.
    3차인 이번 라운드에서도 동일 결론이 유지된다 — 새 근거로 뒤집힐 이유 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 3건 전부 plan 항목 또는 리뷰 라운드 조치 항목에 1:1 대응
  - 위치: `output-shape.test.ts`
    - `rejects result.messages when the endReason key is absent entirely` → plan 항목 2
    - `detects a terminal whose endReason sits at output.endReason, not result.endReason` →
      1차 리뷰 INFO 3 조치 (RESOLUTION `14_19_49`)
    - `prefers result.endReason over output.endReason when both are present` → 2차 리뷰 INFO 1
      조치 (RESOLUTION `14_34_01`)
  - 상세: 세 테스트 모두 `isConversationOutput` 의 기존 `endReason` 판정 로직(2단 조회 +
    화이트리스트)만을 검증하며, 판정 대상 함수 밖으로 스코프가 번지지 않았다. assertion 대상
    함수·모듈 신규 도입 없음.
  - 제안: 없음 — 스코프 내 정합.

- **[INFO]** review 산출물 22파일은 요청된 워크플로 산출물이며 "무관한 파일 수정" 아님
  - 위치: `review/code/2026/07/23/14_19_49/**`, `review/code/2026/07/23/14_34_01/**`
  - 상세: 모두 이번 PR(`isConversationOutput` 이월 처분) 자체를 대상으로 한 1·2차 `/ai-review`
    실행 결과다. 파일명·내용이 전부 `output-shape.ts`/`output-shape-comment-followups.md` 를
    가리키며 다른 PR·다른 작업 산출물이 섞여 들어온 흔적 없음. CLAUDE.md 규약상 review/code/**
    산출물은 커밋 대상이라 diff 에 포함되는 것이 정상.
  - 제안: 없음.

- **[INFO]** 소스 코드 논리 변경, 임포트/설정 변경, 무관 리팩터링 — 전혀 없음
  - 상세: `output-shape.ts` 는 위 실측대로 comment-only. import 문 변경 0건(diff 에 import 라인
    없음). `tsconfig`/`package.json`/lint 설정 등 어떤 설정 파일도 diff 에 없음. NO-GO 판정된
    두 항목(OR-체인 → discriminated union 재설계, `it.each` 테이블 전환)은 실제로 코드에 아무
    흔적을 남기지 않아 plan 판정과 diff 가 정확히 일치한다.
  - 제안: 없음.

## 요약

`output-shape.ts` 변경은 라인 단위로 재확인한 결과 완전히 comment-only(JSDoc 재작성)이고, 테스트
파일의 신규 3건은 모두 plan 문서 또는 선행 리뷰 라운드의 조치 항목에 1:1 대응하며 판정 대상
함수(`isConversationOutput`) 범위를 벗어나지 않는다. 신규 plan 문서와 두 차례의 `review/code/**`
산출물은 프로젝트 규약이 요구하는 표준 워크플로 부산물로, 스코프 이탈이 아니라 오히려 스코프
추적성을 강화한다. NO-GO 로 종결된 2개 항목(union 재설계, `it.each` 전환)은 코드에 흔적이 없어
plan 서술과 diff 가 정확히 일치함을 확인했다. 요청 외 기능 추가, 무관한 파일 수정, 의미 없는
포맷팅, 불필요한 임포트/설정 변경은 발견되지 않았다. 1·2차 스코프 리뷰(`14_19_49/scope.md`,
`14_34_01/scope.md`)의 NONE 판정과 이번 3차 실측 결과가 일치한다.

## 위험도
NONE
