# 변경 범위(Scope) 리뷰

## 검토 대상 구성

`git diff origin/main...HEAD` 는 커밋 3개로 구성된다 (23개 파일, 실제 파일 확인 완료).

1. `5600ca245` (`test: isConversationOutput OR-체인 3분기 mutation 고립 테스트 (#968 이월)`)
   - `output-shape.test.ts` (+62), `output-shape.ts` (+16/-4, JSDoc 전용), `hydration-coverage.test.ts` (+9/-4, 주석 전용)
2. `4ee965978` (`docs(review): 20_06_14 리뷰 WARNING 반영 + RESOLUTION`)
   - `hydration-coverage.test.ts` 주석 재수정(라인 번호 → 함수명 참조, +4/-4) + `review/code/2026/07/17/20_06_14/**` 9개 신규 파일
3. `730a87cf0` (`test: isConversationOutput AND-guard 4곳 mutation 고립 테스트 + 10_40_03 리뷰 반영`)
   - `output-shape.test.ts` (+54, AND-guard 4개 고립 테스트) + `review/code/2026/07/17/20_06_14/SUMMARY.md`(+22/-6, placeholder 절 완성) + `review/code/2026/07/18/10_40_03/**` 12개 신규 파일

`git show --stat`으로 3개 커밋 전부 직접 확인. 각 커밋이 커밋 메시지가 선언한 목적과 diff 가 1:1 대응한다.

## 발견사항

- **[INFO]** 애플리케이션 코드(`output-shape.ts`)는 3개 커밋 전체에 걸쳐 `isConversationOutput` 함수 **본문 무변경** — diff 는 JSDoc 블록 내부(5600ca245, +16/-4)로 국한
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
  - 상세: `git show 5600ca245 -- output-shape.ts`, `git show 730a87cf0 --stat` 로 확인 — 730a87cf0 은 이 파일을 아예 건드리지 않는다(신규 4개 테스트는 `.test.ts` 에만 추가). 실행 로직 리팩토링·기능 확장·분기 추가 전무. 신규 JSDoc 12줄("No known producer" 근거 문단)은 새로 추가된 테스트 3건이 방어하는 두 분기(`output.interactionType`, 중첩 `output.conversationConfig`)의 실측 근거를 문서화한 것으로, 같은 커밋의 테스트 작업과 직접 연결된다.
  - 제안: 조치 불필요.

- **[INFO]** 3번째 코드 파일(`hydration-coverage.test.ts`)이 주 작업 디렉터리(`components/editor/run-results`)와 다른 하위 트리(`lib/conversation`)에 위치, 2개 커밋에 걸쳐 주석이 두 번 수정됨
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts`
  - 상세: 1차(5600ca245)는 `maxTurns` 가 `output.conversationConfig` 에서 직접 읽히지 않는다는 사실 정정(같은 커밋의 "no known producer" 전수 조사의 직접 부산물, 커밋 메시지에 근거 명시), 2차(4ee965978)는 그 1차 수정 자체를 지적한 20_06_14 리뷰 WARNING(하드코딩 라인 번호 `result-timeline.tsx:168` drift)을 함수명 기반 참조로 교정. 두 변경 모두 주석 텍스트에 국한되고 `COVERAGE_MATRIX` 데이터·검증 로직·`sites` 배열은 무변경. 근거가 매 단계 커밋 메시지/RESOLUTION 에 명시돼 있어 무관한 수정으로 보기 어렵다.
  - 제안: 조치 불필요.

- **[INFO]** 코드/테스트 하드닝 커밋과 리뷰 산출물(`review/code/**`) 커밋이 하나의 diff 로 묶여 리뷰 대상이 됨 — 3개 커밋 중 2개(4ee965978, 730a87cf0)가 리뷰 산출물 파일을 포함
  - 위치: 전체 diff (`origin/main...HEAD`)
  - 상세: `review/code/2026/07/17/20_06_14/**`(9파일, RESOLUTION/SUMMARY/6개 리뷰어 리포트/meta.json/_retry_state.json) 와 `review/code/2026/07/18/10_40_03/**`(12파일, 동일 구성 + testing.md/documentation.md)는 CLAUDE.md 저장 위치 표("코드 리뷰 산출물 → `review/code/<...>/`")와 `developer` 스킬의 `review/**/RESOLUTION.md` 쓰기 권한, 그리고 사용자 메모("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋")에 정확히 부합하는 표준 워크플로 산출물이다. 임의로 추가된 무관한 파일이 아니라, 이 프로젝트가 "구현 완료 후 `/ai-review` 는 상시 승인된 강제 의무"로 규정한 절차의 필연적 부산물이다. 각 커밋 메시지(`test(frontend):`, `docs(review):`)도 두 성격을 명확히 구분해 표시한다. 이 판단은 이번 diff 안에 이미 포함된 두 개의 선행 scope 리뷰(`20_06_14/scope.md`, `10_40_03/scope.md`)와도 독립적으로 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 730a87cf0 은 "신규 테스트 추가"와 "직전 리뷰 산출물 커밋"을 하나의 커밋으로 합쳤다 — 직전 라운드(5600ca245+4ee965978)는 이 둘을 별도 커밋으로 분리했던 패턴과 다르다
  - 위치: 커밋 `730a87cf0` (`output-shape.test.ts` +54 vs `review/code/2026/07/18/10_40_03/**` 12파일 +/- 476)
  - 상세: 커밋을 분리하지 않았다고 해서 스코프 위반은 아니다 — 커밋 메시지가 두 부분(AND-guard mutation 테스트 4건 + 10_40_03 리뷰 WARNING 1·2 반영·WARNING 3 근거 있는 거절)을 모두 상세히 설명하고, 실측(mutation A~D 표)까지 포함한다. 다만 회차가 거듭될수록 "코드 페이로드(신규 테스트 줄 수)" 대비 "리뷰 산출물 페이로드(파일 수·줄 수)" 비중이 커지는 추세(1차 3파일/83줄 코드 vs 9파일 리뷰문서 → 2차 1파일/54줄 코드 vs 12파일 리뷰문서)가 관찰된다. 이는 이 리뷰 자체를 포함해 프로젝트가 명시적으로 강제한 워크플로(구현 후 `/ai-review` + fix 는 상시 의무)의 구조적 결과이지, 이번 diff 가 스스로 도입한 범위 이탈은 아니다.
  - 제안: 조치 불필요(참고용 관찰). 만약 앞으로도 이 패턴이 반복돼 리뷰-산출물 대 실코드 비율이 계속 커진다면, 코드 변경 커밋과 리뷰 반영 커밋을 분리 유지하는 이전 컨벤션(5600ca245/4ee965978 분리)으로 되돌아가는 편이 감사(audit) 가독성에 유리할 수 있다는 점만 기록.

## 점검 관점별 결과

1. **의도 이상의 변경** — 없음. 3개 커밋 모두 각자 선언한 목적(OR-체인 3분기 테스트 / 20_06_14 리뷰 반영 / AND-guard 4개 테스트 + 10_40_03 리뷰 반영)과 diff 가 1:1 대응.
2. **불필요한 리팩토링** — 없음. `isConversationOutput`/`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등 실행 로직 함수 바디는 3개 커밋 전 구간 무변경.
3. **기능 확장(over-engineering)** — 없음. 신규 API·export·분기 로직 추가 없음. JSDoc 확장은 기존 방어 분기의 근거 문서화일 뿐, 새 기능이 아니다.
4. **무관한 수정** — 없음. 위 INFO 4건은 모두 근거가 명시된 인접 수정이거나 프로젝트 표준 워크플로 산출물이다.
5. **포맷팅 변경** — 실질 변경과 섞인 의미 없는 공백/줄바꿈 변경 없음(`git diff --stat` 기준 모든 hunk 가 텍스트 내용 변경).
6. **주석 변경** — `output-shape.ts` JSDoc 확장 1건, `hydration-coverage.test.ts` 주석 정정 2회(각각 근거 명시) 외 불필요한 주석 변경 없음.
7. **임포트 변경** — 없음. 3개 코드 파일 모두 import 문 diff 전무.
8. **설정 변경** — 없음. `tsconfig`/`eslint`/`package.json` 등 설정 파일 미포함.

## 요약

핵심 코드 변경(`output-shape.ts`, `output-shape.test.ts`, `hydration-coverage.test.ts`)은 PR #968 리뷰가 발견한 mutation-testing 갭(OR-체인 3분기 + AND-guard 4곳)을 이월 처리하는 작업으로, 3개 커밋 전체에 걸쳐 실행 로직 diff 가 0(테스트 7건 순증 + 주석/JSDoc 정정)이며 선언된 목적과 정확히 스코프된다. 나머지 21개 파일은 두 차례 `/ai-review` 세션의 산출물(`review/code/2026/07/17/20_06_14/**`, `review/code/2026/07/18/10_40_03/**`)로, 프로젝트가 명시적으로 요구하는 저장 위치·커밋 관행에 부합해 스코프 이탈이 아니다. 이번 diff 안에 포함된 두 선행 scope 리뷰도 동일한 결론(NONE)에 도달했으며, 본 리뷰는 그 판단에 3번째 커밋(730a87cf0)까지 확장해 재확인하고 동의한다. 무관한 파일·불필요한 리팩토링·기능 확장·포맷팅 노이즈·임포트/설정 변경 모두 발견되지 않았다. 유일하게 기록해 둘 만한 경향은 회차가 거듭될수록 리뷰-산출물 파일 수가 실코드 변경량보다 빠르게 늘고 있다는 점이나(730a87cf0: 코드 54줄 vs 리뷰문서 12파일), 이는 강제된 워크플로의 구조적 결과이지 이번 변경이 새로 만든 스코프 이탈이 아니다.

## 위험도

NONE
