STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (17_13_19)

## 발견사항

- **[INFO]** plan 제목과 CHANGELOG 제목이 "소비처 개수"를 다른 기준으로 세어 나란히 보면 숫자가 어긋나 보인다 (기존 라운드에서 이미 지적·조치 불요로 판정된 항목의 재확인 — HEAD 시점에도 그대로 존재)
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md` (frontmatter `title`: `` `Execution.inputData` egress 마스킹 — 재제출 소비처 2곳에 마커 가드 선행 ``) vs `CHANGELOG.md:3` (`Unreleased — \`Execution.inputData\` 카브아웃을 닫았다 (재제출 소비처 3곳에 마커 가드)`)
  - 상세: plan 제목은 "이 작업이 새로 세우는 가드" 2곳(Re-run 모달·에디터 히스토리 로드)만 세고, CHANGELOG 제목은 "닫는 조건을 총족한 전체 소비처" 3곳(#1181 폼 프리필 포함)을 센다 — 각자 본문 안에서는 내적으로 일관되고 실제 모순은 아니다. `review/code/2026/08/20/14_44_08/documentation.md` 에서 동일 항목이 INFO 로 이미 지적됐고 해당 RESOLUTION 이 "조치 불요에 가깝다"고 판정한 바 있다. HEAD 기준으로도 두 제목이 그대로 남아 있어 재확인 차 다시 기록한다 — 신규 결함이 아니라 기지(旣知) 항목의 현재 상태 확인이다.
  - 제안: 이전 라운드의 판정(조치 불요)을 유지해도 무방하다. 굳이 정리하려면 plan 제목에 "(총 3곳 중 나머지 2곳)" 같은 짧은 한정어를 붙인다.

## 검증한 항목 (문제 없음 확인)

diff 전체(211개 변경 파일 중 실질 문서 대상 — CHANGELOG, backend/frontend 소스 주석·JSDoc, DTO 설명, 신규 `masked-markers.ts`/테스트, 유저 가이드 mdx 4종 ko/en, i18n 키, spec 7개 파일, plan 3개 파일)를 확인한 결과 아래는 모두 정확했다.

- **이전 라운드가 CRITICAL/WARNING 으로 잡았던 "주제문 방치" 패턴 재발 없음**: `executions.service.spec.ts` 의 describe 소제목(`## 두 레벨 모두 마스킹 대상이다`), `execution-response.dto.ts` 의 `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc, `executions.service.ts` 의 `ResponseExecution` 주제문("**세 컬럼**") 모두 HEAD 시점에 현재형 결론이 최상단에 있고 구 결론은 `>` blockquote 로 내려가 있다 — 이 저장소가 반복 겪은 "아래에 캐비엇만 덧붙이고 위 주제문은 안 건드리는" 패턴이 이번 회차 diff 에는 남아 있지 않다.
- **`blockedByMaskedInput` JSDoc 분리 문제(이전 maintainability WARNING) 해소 확인**: `rerun-modal.tsx` 의 두 JSDoc 블록이 하나로 병합되어 "세 조건의 합" 표와 "토글 ON 이면 막지 않는다" 설명이 한 덩어리다.
- **`MASKED_INPUT_DATA_REASON` 앵커 전수 삭제 주장 실측 확인**: `grep -rln "MASKED_INPUT_DATA_REASON" codebase/ spec/` 결과 0건 — CHANGELOG·plan 의 "전수 삭제" 서술과 일치.
- **`masked-markers.ts` 상대경로 링크 정확성**: `codebase/frontend/src/lib/utils/masked-markers.ts` 에서 `../../../../../spec/5-system/14-external-interaction-api.md` (5단계 up) — 파일 위치(`lib/utils/` 아래) 기준으로 정확히 repo root 에 도달한다. 이전 위치(`dynamic-form-ui.tsx`, 6단계 up)에서 승격되며 경로 깊이가 올바르게 재조정됐다.
- **`MAX_MARKER_SCAN_DEPTH`(프런트, 10) = `MAX_REDACT_DEPTH`(백엔드, 10) 일치**: JSDoc 이 "두 값은 같아야 한다"고 명시한 근거를 실제 상수 확인으로 재검증 — 일치.
- **spec 7개 파일**(`14-external-interaction-api.md` §R17, `1-data-model.md`, `13-replay-rerun.md` §10.2, `3-workflow-editor/3-execution.md` §2.2, `12-webhook.md` §5.3, `6-websocket-protocol.md` §4.1, `4-nodes/1-logic/12-background.md`)이 카브아웃 폐지 결론을 상호 일관되게 반영 — 취소선 처리(`~~잔여 ②~~ 해소`), 판단 기준 표 flip, "레벨이 가른다" 축 폐기 서술이 서로 모순 없이 교차 링크된다.
- **i18n 키 parity**: `en/editor.ts`·`ko/editor.ts` 의 `runWithInputMasked`, `en/history.ts`·`ko/history.ts` 의 `maskedInputBlocked` 모두 ko/en 쌍으로 존재하고 spec(`13-replay-rerun.md` §10.4 문자열 표)에도 동일 키로 등재.
- **유저 가이드 mdx 4파일**(`run-results.mdx`/`.en.mdx`, `running-a-workflow.mdx`/`.en.mdx`) 동반 갱신 — 신규 마커 차단 동작을 사용자 시점 언어로 설명하며 ko/en 내용이 대응.
- **인라인 주석의 복잡한 로직 설명**: `editor-toolbar.tsx` 의 try/catch 안에 파싱과 마커 검사를 함께 둔 이유(재귀 깊이 상한이 유일한 방어가 되지 않게 하려는 의도, `useMemo` 렌더 경로 예외 전파 우려)를 인라인 주석이 정확히 설명하며, 실제 코드 순서(파싱 성공 시에만 마커 검사)와 일치.

## 요약

이번 diff(누적, `origin/main...HEAD`)는 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 CHANGELOG·plan 3개·spec 7개·backend DTO/서비스·신규 `masked-markers.ts` 유틸과 테스트·유저 가이드 mdx 4종(ko/en)·i18n 키에 걸쳐 이미 7라운드의 `/ai-review`(문서화 관점 포함, 이전 라운드에서 CRITICAL 1건·WARNING 3건이 documentation 카테고리에서 잡혀 모두 수정됨)를 거친 상태다. HEAD 시점 재검토 결과 이전에 지적됐던 "주제문 방치"·"JSDoc 블록 분리" 패턴은 모두 해소되어 있었고, 앵커 삭제·경로·상수 일치 등 주장된 사실 관계도 실측으로 재확인해 전부 정확했다. 유일하게 남은 항목은 plan 제목과 CHANGELOG 제목의 "소비처 개수" 표기 차이(INFO, 이미 이전 라운드에서 조치 불요로 판정)뿐이며 신규 결함이 아니다.

## 위험도

NONE
