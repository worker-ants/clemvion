# 변경 범위(Scope) 리뷰

## 발견사항

없음 — 이 커밋(`8332d9a20`)은 plan(`plan/in-progress/update-returning-tuple-shape.md`)이 규정한
"UPDATE/DELETE RETURNING 이 `[rows, count]` 튜플인데 7곳이 행 배열로 다뤘다" 결함 수정 하나로
완전히 수렴한다. 아래 항목별로 무관 변경을 찾지 못했다.

- **의도 이상의 변경 / 무관한 수정**: `git diff --stat origin/main...HEAD -- codebase plan` 실측
  결과 6개 파일 전부가 이 리뷰 프롬프트의 대상 파일과 정확히 일치한다(숨은 파일 없음). 각 소비
  지점 변경은 plan 의 "무엇이 깨져 있었나 (7곳)" 표에 나열된 7곳(execution-engine 2곳,
  knowledge-base 5곳)과 1:1 대응한다.
- **불필요한 리팩토링**: `execution-engine.service.ts` 의 두 지점에서 `assertRowArray(...)` 호출을
  제거하고 `updateReturningRows(...)` 로 교체했다(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `admitExecutionOrDefer`·`updateExecutionStatus`). 얼핏 무관 삭제로 보이지만
  `updateReturningRows` 자체가 동일하게 `!Array.isArray` 가드를 내장해 "배열인가" 체크를 흡수하므로
  중복 가드를 남기지 않은 것은 이 수정의 핵심 처방(`common/utils/update-returning-rows.ts` 헬퍼로
  일원화)에 직접 속한다. 같은 파일의 세 번째 `assertRowArray` 호출(`lockNonTerminalExecutionRow`,
  SELECT ... FOR UPDATE 지점)은 손대지 않고 남아 있고 import 도 계속 사용되므로 dead import 도 아니다.
- **기능 확장**: 새 헬퍼(`updateReturningRows`)는 튜플/비-튜플 두 shape 만 처리하는 최소 함수이고,
  신규 옵션·플래그·설정 확장이 없다. over-engineering 신호 없음.
- **포맷팅 변경**: 각 파일 diff 는 실질 변경 줄에 국한된 단일/소수 hunk 이며, 무관한 개행·공백
  재정렬이 섞인 흔적이 없다.
- **주석 변경**: 추가된 주석은 전부 이번 결함(튜플 shape)의 실측 근거·회귀 이유를 설명하는
  신규 주석이며, 기존 무관 주석을 건드리지 않았다.
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts` 에 추가된
  `import { updateReturningRows } from '.../update-returning-rows'` 는 두 파일 모두에서 실제
  호출부가 있어 사용된다. 불필요한 정리/추가 없음.
- **설정 변경**: 설정 파일 변경 없음.
- **신규 spec 가드 테스트**(`update-returning-rows.spec.ts` 의 "직접 소비하는 지점이 다시 생기지
  않는다" describe)는 `stuck-document-recovery.service.ts`·`agent-memory-admin.service.ts` 를
  참조만 하고 수정하지 않는다 — plan 이 명시한 "이미 올바른 두 선례 고정" 목적과 일치하며 파일
  변경 목록에도 포함되지 않는다.
- plan 파일(`plan/in-progress/update-returning-tuple-shape.md`)의 `spec_impact: none` 은 실제로
  `spec/` 변경이 전무한 것과 일치하고, 원래 착수 전제(전역 `.query()` fail-open 감사)가 반증되어
  다른 결함 클래스로 전환된 경위를 "Rationale"/"Overview" 에 명시적으로 기록해 두었다 — 스코프
  전환이 은폐가 아니라 문서화되어 있다.

## 요약

리뷰 대상 6개 파일은 "UPDATE/DELETE RETURNING 튜플 shape" 결함 수정이라는 단일 의도에서 벗어나지
않는다. 새 헬퍼·헬퍼 자체 테스트·정확히 7개 소비 지점 수정·그 수정을 검증하는 최소 admission 테스트
2건·plan 문서만 포함되어 있으며, `assertRowArray` 제거도 헬퍼가 동일 가드를 흡수하는 의도된 통합이지
드라이브바이 리팩토링이 아니다. 실제 커밋 diff-stat 과 리뷰 프롬프트 파일 목록이 정확히 일치해 숨겨진
무관 변경도 없다.

## 위험도

NONE
