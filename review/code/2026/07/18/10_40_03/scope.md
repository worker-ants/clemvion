# 변경 범위(Scope) 리뷰 — isConversationOutput mutation 고립 테스트 + 20_06_14 리뷰 반영

## 검토 대상 구성

`git diff origin/main...HEAD` 는 커밋 2개로 구성된다.

1. `5600ca245` (`test(frontend): isConversationOutput OR-체인 3분기 mutation 고립 테스트 (#968 이월)`)
   - `output-shape.test.ts` (+62), `output-shape.ts` (+16/-4, JSDoc 전용), `hydration-coverage.test.ts` (+9/-4, 주석 전용)
2. `4ee965978` (`docs(review): 20_06_14 리뷰 WARNING 반영 + RESOLUTION`)
   - `hydration-coverage.test.ts` 주석 재수정 (라인 번호 → 함수명 참조)
   - `review/code/2026/07/17/20_06_14/{RESOLUTION.md,SUMMARY.md,_retry_state.json,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md}` 9개 신규 파일

## 발견사항

- **[INFO]** 두 개의 서로 다른 성격의 커밋(코드/테스트 변경 vs 리뷰 산출물 커밋)이 하나의 diff 로 묶여 리뷰 대상이 됨
  - 위치: 전체 diff (`origin/main...HEAD`)
  - 상세: `5600ca245` 는 순수 테스트/문서 하드닝, `4ee965978` 은 그 리뷰 라운드(20_06_14)의 WARNING 반영 + `RESOLUTION.md`/`SUMMARY.md`/reviewer 산출물 커밋이다. 후자가 앱 코드에 가하는 실질 변경은 `hydration-coverage.test.ts` 주석 4줄뿐이고 나머지 9개 파일은 전부 `review/code/**` 하위 산출물이다. 이는 본 프로젝트 CLAUDE.md 컨벤션("코드 리뷰 산출물 → `review/code/<...>/`", `developer` 스킬의 `review/**/RESOLUTION.md` 쓰기 권한, "review/ 는 gitignored 아님(SUMMARY·RESOLUTION 도 커밋)")에 부합하는 표준 워크플로 산출물이며, 임의의 무관한 파일 추가가 아니다. commit 메시지도 `docs(review):` 로 스스로의 성격을 명확히 표시했다. → 스코프 위반으로 보지 않음, 참고용 기록.
  - 제안: 조치 불필요.

- **[INFO]** `output-shape.ts` JSDoc 블록이 12줄 확장(로직 diff 0)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (`isConversationOutput` JSDoc, "No known producer" 단락)
  - 상세: `isConversationOutput` 함수 바디는 완전히 무변경(diff 는 주석 라인에만 존재, `git show 5600ca245 -- output-shape.ts` 로 확인). 신규 테스트 3건이 방어하는 두 분기(`output.interactionType`, 중첩 `output.conversationConfig`)에 대해 "실제 producer 없음"이라는 전수 조사 결과를 근거와 함께 문서화한 것으로, 같은 커밋의 테스트 추가 작업과 직접 연결된 산출물이다. 기능 확장이나 리팩터링이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 3번째 코드 파일(`hydration-coverage.test.ts`)이 주 작업 디렉터리(`components/editor/run-results`)와 다른 하위 트리(`lib/conversation`)에 위치
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts`
  - 상세: 커밋 메시지(`5600ca245`)가 "hydration-coverage.test.ts 의 stale 주석(`maxTurns` 를 `output.conversationConfig` 에서 직접 읽는다)도 동반 정정"이라고 명시적으로 근거를 남겼다. 동일 조사(`output.conversationConfig` no-known-producer 전수 확인) 과정에서 발견된 인접 stale 주석을 함께 고친 것으로, 주석 정정 범위를 벗어나는 로직·매트릭스 변경은 없다(diff 는 주석 텍스트뿐).
  - 제안: 조치 불필요.

## 점검 관점별 결과

1. 의도 이상의 변경 — 없음. 두 커밋 모두 각자 선언한 목적(테스트 하드닝 / 리뷰 반영+RESOLUTION)과 diff 가 1:1 대응.
2. 불필요한 리팩토링 — 없음. `isConversationOutput`, `unwrapNodeOutput`, `extractIeSnapshot` 등 로직 함수 바디는 전 구간 무변경.
3. 기능 확장(over-engineering) — 없음. 신규 API·export·분기 로직 추가 없음. JSDoc 확장은 기존 방어 분기의 근거 문서화일 뿐.
4. 무관한 수정 — 없음(위 INFO 3건은 모두 근거가 명시된 인접 수정이거나 프로젝트 표준 워크플로 산출물).
5. 포맷팅 변경 — 실질 변경과 섞인 의미 없는 공백/줄바꿈 변경 없음.
6. 주석 변경 — `output-shape.ts` JSDoc 확장, `hydration-coverage.test.ts` 주석 정정(2회, 각각 근거 있음) 외 불필요한 주석 변경 없음.
7. 임포트 변경 — 없음. import 문 diff 전무.
8. 설정 변경 — 없음. `tsconfig`/`eslint`/`package.json` 등 설정 파일 미포함.

## 요약

핵심 코드 변경(3개 소스 파일)은 `#968` 이월 mutation 커버리지 갭 해소라는 선언된 목적에 정확히 스코프되어 있고, 로직 diff 는 0(테스트 추가 + JSDoc/주석 전용)이다. 나머지 9개 파일은 별도 `docs(review):` 커밋으로 명확히 분리된 리뷰 산출물(RESOLUTION/SUMMARY/reviewer 리포트)로, 프로젝트 컨벤션상 `review/code/**` 커밋이 표준 절차이므로 스코프 위반이 아니다. 무관한 파일·불필요한 리팩토링·기능 확장·포맷팅 노이즈·임포트/설정 변경 모두 발견되지 않았다.

## 위험도

NONE
