# 정식 규약 준수 검토 — convention_compliance

검토 모드: --impl-done (구현 완료 후), scope=`spec/2-navigation/`, diff-base=`origin/main`

## 배경

이번 turn 의 diff (`git diff origin/main --stat`, HEAD=`bef267c17`) 는 V-05
(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`) 구현의 연속이다. 직전
consistency-check 라운드(`review/consistency/2026/07/05/16_49_52/`)가 이미 1차
구현 커밋(`a32327074`)을 검토해 위험도 NONE 으로 결론지었고, 그 이후
`bef267c17`("V-05 ai-review CRITICAL 조치 — Input/startedAt 매핑 + dry-run 배지
복원")이 추가됐다. 코드 변경은 여전히 순수 프론트엔드 3개 파일
(`page.tsx`/`result-detail.tsx`/신규 테스트) + 문서(CHANGELOG·user-guide MDX·plan
체크박스) 뿐이며, 백엔드(`codebase/backend/**`)는 이번 diff 에서 전혀 건드리지
않았다 (`git diff origin/main --stat -- codebase/backend/` 결과 0줄, 직접 확인).
`spec/2-navigation/14-execution-history.md` 자체도 이번 diff 에 포함되지 않았다.

## 발견사항

- **[INFO]** `executionDryRun` prop 명명이 기존 dry-run 명명 계층(§9.2)과 정합
  - target 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:829-838` (`ResultDetailProps.executionDryRun`)
  - 위반 규약: 해당 없음 (준수 확인 항목) — `spec/5-system/13-replay-rerun.md §9.2`
  - 상세: §9.2 는 "**NodeExecution** `outputData._dryRun`(결과 표시용) vs **Execution** `dry_run`(실행 제어용, DTO 는 §7 `dryRun: boolean`)" 두 레이어를 명시적으로 분리한다. 신규 prop `executionDryRun`(camelCase, execution-level 접두)은 이 구분을 코드 레벨에서 정확히 반영한 이름이라 규약과 자연스럽게 대응된다. JSDoc 도 `_dryRun` 마커가 effect 노드에만 심긴다는 §7.2/§7.3 근거를 인용하고 있어 spec-code 추적성도 확보됨.
  - 제안: 없음.

- **[INFO]** `spec/2-navigation/14-execution-history.md` frontmatter `code:` 글로브가 변경 파일을 계속 커버
  - target 위치: `spec/2-navigation/14-execution-history.md` frontmatter `code:` (`codebase/frontend/src/app/(main)/workflows/[id]/executions/**`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1/§4 (`spec-code-paths.test.ts` — `status: implemented` spec 의 `code:` 매치 의무)
  - 상세: 이번 diff 로 변경된 `page.tsx`, 신규 `__tests__/execution-detail-waiting.test.tsx` 는 모두 위 glob 하위 경로라 frontmatter 갱신 없이도 가드를 계속 통과한다. 재사용 대상인 `result-detail.tsx`(에디터 공용 컴포넌트)는 `3-workflow-editor` 영역 spec 의 책임 범위라 본 spec `code:` 목록에 없어도 정합 — 실제로 `run-results.mdx` 쪭 user-guide 프론트매터의 `code:` 배열에 실행 상세 경로가 이미 추가됐다(diff 확인).
  - 제안: 없음 (준수 확인).

- **[INFO]** 신규 API endpoint·DTO·에러 코드·audit action 표면 없음
  - target 위치: 전체 diff (`git diff origin/main --stat`, `codebase/backend/` 매치 0줄)
  - 위반 규약: `spec/conventions/swagger.md`, `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`
  - 상세: 이번 라운드에 추가된 커밋(`bef267c17`)도 백엔드를 건드리지 않는다. `toNodeResult()` 매핑에 `startedAt`/`inputData` 필드가 추가됐으나 이는 이미 API 응답(`NodeExecutionData`)에 존재하는 필드를 프론트 로컬 타입(`NodeResult`)으로 옮겨 담는 것뿐이라 신규 출력 포맷이 아니다.
  - 제안: 없음.

- **[INFO]** dead i18n 키 잔존 (`executions.tabPreview`/`tabInput`/`tabOutput`/`tabError`) — conventions 위반 아님, 코드 품질 성격
  - target 위치: `codebase/frontend/src/lib/i18n/dict/{ko,en}/executions.ts` (`tabPreview`/`tabInput`/`tabOutput`/`tabError` 키)
  - 위반 규약: 해당 없음 — `spec/conventions/i18n-userguide.md` 에는 "리팩터로 미사용이 된 키를 제거하라" 는 조항이 없다.
  - 상세: `page.tsx` 의 로컬 4탭(`DetailTab` = preview/input/output/error) 구현이 이번 리팩터로 완전히 제거되면서 그 4개 라벨을 참조하던 유일한 코드 지점도 사라졌다(`grep -rn "executions.tab(Preview|Input|Output|Error)"` 결과 0건). i18n dict 자체에는 아직 남아 있어 dead entry 다. 이는 명명·출력 포맷 규약 위반이 아니라 유지보수성(코드리뷰) 영역이며, `review/code/2026/07/05/16_49_52/maintainability.md` 에서도 다뤄지지 않은 항목이다.
  - 제안: 정식 규약 준수 관점에서는 조치 불요. 후속 정리가 필요하면 `developer` 스킬의 일반 코드 정리 백로그로 남기는 편이 적절 (본 검토의 스코프 밖).

- **[INFO]** `spec/2-navigation/14-execution-history.md` 문서 구조(Overview/본문/Rationale) 훼손 없음
  - target 위치: `spec/2-navigation/14-execution-history.md` (`## Overview (제품 정의)` → `## 1~7` → `## Rationale`)
  - 위반 규약: 해당 없음 (CLAUDE.md 정보 저장 위치 표 / 각 SKILL.md 3섹션 권장)
  - 상세: 이번 diff 에 spec 파일 자체가 포함되지 않아 구조 변경이 없다. EH-DETAIL-03 요구사항 행(§Overview)과 §3.3/§3.4.2 본문 서술은 이미 이번 구현이 메운 "에디터-실행상세 간 서브탭 격차"를 정확히 예견하고 있어(직전 라운드 검토 확인 사항 재확인), 코드가 spec 서술을 뒤늦게 따라잡은 형태다.
  - 제안: 없음.

## 요약

이번 라운드(`bef267c17` 추가 반영)도 직전 라운드(`16_49_52`)의 결론을 뒤집을 근거가 없다. 신규 API·DTO·에러 코드·audit action 등 명명·출력 포맷 규약이 규율하는 표면이 여전히 도입되지 않은 순수 프론트엔드 수정(Input/startedAt 매핑 보완, dry-run 배지 execution-level 플래그 추가)이며, 신규 prop(`executionDryRun`)의 명명은 `13-replay-rerun.md §9.2` 의 execution-level/node-output-level 구분과 정합한다. `spec/2-navigation/14-execution-history.md` 의 frontmatter `code:` 글로브·3섹션 구조 모두 변경 파일을 계속 정확히 커버·보존한다. 발견된 유일한 잔여 항목(dead i18n 탭 키)은 conventions 위반이 아닌 코드 정리 성격이라 위험도에 반영하지 않는다.

## 위험도
NONE
