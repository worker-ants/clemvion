# 변경 범위(Scope) 리뷰 — plan-lifecycle-gates

## 배경 확인

- 브랜치 `plan-lifecycle-gates` 는 `origin/main..HEAD` 상에서 이 4개 파일에 대해
  `9e880e908`(원 feat: "plan 이동이 남기던 두 갭에 게이트 — status 모순 · 살아있는 plan 의
  깨진 링크")부터 시작해 다수의 `fix(harness)` 라운드(ai-review/consistency 피드백 반영)를
  거쳐 현재 상태(`5311d6b01`)에 이르렀다. 즉 "frontmatter 검사 추출 + status/링크 게이트
  신설 + negative-path fixture" 는 이 작업 자체의 목표이며, 이번 라운드에서 갑자기 끼어든
  범위가 아니다.
- `plan/in-progress/docs-guard-walker-dedup.md` 를 확인했다 — 저장소에 남아 있는 나머지
  두 walker(`collectSpecMarkdown`, `collectCodebaseSources`, `spec-links.ts`)와 Gate C 의
  `collectCompletePlans` 통합은 이 PR 범위 밖으로 **명시적으로 분리·이관**되어 있다. 즉
  "관련 있어 보이지만 손대지 않은" 부분이 방치가 아니라 의도된 스코프 경계임을 별도 plan
  문서가 근거로 뒷받침한다 — 좋은 신호.

## 발견사항

- **[INFO]** `plan-scan.ts` 최상단 헤더 주석(파일 도입부)이 회고적 서사를 담고 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:1`~`26` (모듈 헤더 블록)
  - 상세: "왜 별 모듈인가" 절에 "158 tests 전량 GREEN 인데 위반 수집 분기는 한 번도 실행되지
    않았다" 같은 리뷰 경위·구체 수치가 영구 코드 주석으로 남는다. 같은 PR 의
    `plan-frontmatter.test.ts:37-39` 는 "코드 주석은 **현재 규칙**만 담는다(ai-review 가
    회고 서사 누적을 지적)" 라고 명시하는데, `plan-scan.ts` 헤더는 그 원칙과 결이 다르다.
    다만 이 서사가 파일이 하는 일과 무관한 내용은 아니고("네 벌 중 왜 둘만 합쳤는가" 스코프
    경계 설명이 핵심), 완전히 무관한 리팩토링·drive-by 코멘트는 아니다.
  - 제안: scope 관점에서는 차단 사유가 아니다. maintainability/documentation 리뷰어가
    같은 지점을 "장기 유지 주석 vs 커밋 이력" 기준으로 더 깊이 판단하는 편이 적합하다.

## 점검 관점별 결론

1. **의도 이상의 변경**: 없음. 4개 파일 모두 "plan 라이프사이클 불변식 게이트 + 공유 스캔
   모듈 추출 + negative-path fixture" 라는 단일 주제로 수렴한다.
2. **불필요한 리팩토링**: 없음. `plan-frontmatter.test.ts` 인라인 로직을 `plan-scan.ts` 로
   뽑아낸 것은 이 작업이 고치려는 결함(위반 분기 무관측)의 직접적 해법이며, 그 외 무관한
   코드 정리는 발견되지 않았다. 인접한 다른 두 walker 는 손대지 않고 별도 plan 으로
   분리했다(위 배경 참고) — 오히려 스코프 절제의 근거.
3. **기능 확장(over-engineering)**: `findNonTerminalCompletedPlans`(status 게이트)와
   `findBrokenPlanLinks`(링크 게이트)는 신규 기능이지만, 브랜치 원 커밋(`9e880e908`)이
   "두 갭에 게이트" 라는 제목으로 이미 두 기능을 함께 도입했으므로 이번 라운드의 확장이
   아니라 작업 본연의 정의다.
4. **무관한 수정**: 없음. 4개 파일 모두 plan 라이프사이클 스캔·검증 경로에 있다.
5. **포맷팅 변경**: `git diff` 확인 결과 각 파일의 변경 hunk 는 실질 로직/주석 변경에
   집중되어 있고, 넓은 범위의 개행·들여쓰기만 바뀐 무의미한 리포맷은 보이지 않는다.
6. **주석 변경**: 위 INFO 항목 외 특이사항 없음. 다른 주석들은 해당 함수의 현재 동작·판정
   근거를 설명하는 데 쓰인다.
7. **임포트 변경**: `plan-frontmatter.test.ts` 에서 `matter` import 제거(로직이
   `plan-scan.ts` 로 이동했으므로 정당), `extractLinks`/`findBrokenPlanLinks`/
   `checkPlanFrontmatter` 등 신규 import 는 전부 본문에서 실사용된다. 미사용 import 없음.
8. **설정 변경**: 이번 4개 파일에는 설정 파일이 없다(별도 diff-stat 상 `.claude/docs/
   plan-lifecycle.md`·`PROJECT.md` 변경이 존재하나 이번 리뷰 대상 파일 목록에는 포함되지
   않아 범위 밖).

## 요약

리뷰 대상 4개 파일은 "plan 라이프사이클 불변식(frontmatter 3필드·완료 plan 의 종료
status·살아있는 plan 의 링크 무결성)에 게이트를 걸고, 그 판정 로직을 공유 모듈로 추출해
negative-path fixture 로 실제 탐지를 증명한다" 는 단일 목표로 수렴하는 응집된 변경이다.
브랜치 히스토리(`origin/main..HEAD`)를 추적한 결과 이 범위는 원 feature 커밋부터 일관되게
유지돼 왔고, 인접해 보이는 walker 통합·타입명 정리는 `plan/in-progress/
docs-guard-walker-dedup.md` 로 명시적으로 분리되어 있어 "손대지 않은 부분" 도 의도된
경계임이 확인된다. 불필요한 리팩토링, 무관한 파일 수정, 미사용 임포트, 의미 없는 포맷팅은
발견되지 않았다. 유일한 관찰(`plan-scan.ts` 헤더의 회고적 서사)은 이 PR 이 스스로 세운
"코드 주석 = 현재 규칙만" 원칙과는 다소 결이 다르지만 범위 이탈이라기보다 문서화 스타일
문제에 가까워 INFO 로 남긴다.

## 위험도

NONE
