# 변경 범위(Scope) 리뷰

## 검증 방법
- `_prompts/scope.md` 에 실린 9개 파일 항목(신규 3·수정 4·plan 이동 2) 전체를 diff+전체 컨텍스트로 확인.
- `git diff --stat origin/main -- .` 로 리뷰 payload 밖의 은닉 변경이 있는지 대조 → **정확히 8개 파일**(plan 항목은 rename 으로 병합 집계)만 변경, payload 와 100% 일치. 숨은 drive-by 변경 없음.
- 각 수정 파일의 diff hunk 개수·라인 수를 payload 서술("9지점 리다이렉트")과 대조 → ai-turn-orchestrator 4곳 + execution-engine 3곳 + shutdown-state 2곳 = 9, 정확히 일치.
- `repo-guards/__tests__/` 에 형제 패턴(`redis-fail-open-catalog-guard.ts` + `.spec.ts`)이 실재하는지 확인 → 존재 확인, 신규 가드 파일 3종(guard/fixture/spec 분리)이 이 저장소의 기존 관례를 그대로 따른 것임을 검증.
- 저장소 파일은 뮤테이션하지 않았음(읽기 전용 리뷰). `git status --short` 변경 없음.

## 발견사항

없음. 아래는 검토 과정에서 확인한 사항이며 CRITICAL/WARNING 급 스코프 이탈은 발견되지 않았다.

- **[INFO]** 신규 회귀 가드(guard+fixture+spec, 약 360줄)가 "9개 맨 문자열을 상수로 리다이렉트" 라는 최소 요청보다 넓은 산출물이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`, `engine-error-code-anchor-fixture.ts`, `engine-error-code-anchor.spec.ts` (전부 신규 파일 — 위치 표기는 파일명으로 대체, diff 전체가 추가라 게이트 숫자 인용은 의미 없음)
  - 상세: 순수 리다이렉트 작업 자체는 9개 diff hunk(파일 1~4)로 충분히 끝났을 것이나, 오탈자 재발 방지를 위한 AST 기반 가드 3파일이 함께 추가됐다. 다만 (1) plan 문서의 완료 노트가 이 가드를 작업의 명시적 산출물로 서술하고 있고, (2) 동일 디렉터리에 이미 `redis-fail-open-catalog-guard.ts` + `.spec.ts` 형제 패턴이 존재해 이 저장소의 "정규식 대신 AST 가드 + 별도 spec" 관례를 그대로 따랐으며, (3) 가드가 막는 회귀 클래스(맨 문자열 재유입)가 바로 이번 리다이렉트가 고치는 결함과 동일 축이라 "요청과 무관한 기능 확장"으로 보기는 어렵다.
  - 제안: 조치 불요. 스코프 이탈이 아니라 이 저장소의 표준 "고친 자리에 회귀 가드를 남긴다" 관례의 적용으로 판단. 정보 제공 목적으로만 기록.

## 요약

리뷰 대상 diff 는 `plan/complete/exec-intake-followups.md` 의 ARCH#5 항목("엔진 레벨 에러코드 레이어 분리")에 정확히 대응한다. `error-codes.ts` 에 `EngineErrorCode` const 를 신설하고, 문서화된 9개 맨 문자열 코드 지점(ai-turn-orchestrator 4·execution-engine 3·shutdown-state 2)만을 그 상수로 리다이렉트했으며, 각 파일의 diff 는 import 1줄 + 해당 지점 치환으로 국한돼 무관한 포맷팅·주석·리팩토링·임포트 정리가 섞여 있지 않다. `git diff --stat` 대조 결과 payload 에 없는 은닉 변경도 없다. 신규 회귀 가드 3파일은 최소 요청보다 넓지만 저장소에 이미 존재하는 형제 가드 패턴을 그대로 따르고 plan 문서가 이를 작업 산출물로 명시하므로 스코프 이탈로 보기 어렵다. plan 문서 이동(in-progress→complete)과 체크박스 갱신도 이 작업 하나에 국한돼 있고 상대경로 링크도 이동 후 위치 기준으로 올바르게 조정돼 있다. 설정 파일·무관 모듈·타 노드 핸들러 파일 변경은 없다.

## 위험도
NONE
