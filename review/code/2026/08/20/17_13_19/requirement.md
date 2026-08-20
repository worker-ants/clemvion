STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard (round 8)

## 검토 방법

`origin/main...HEAD` 전체 diff(78파일, 프롬프트에서 생략된 부분은 `git diff` 로 직접 원본 대조)와
관련 spec 7개 문서(`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{12-webhook,13-replay-rerun,
14-external-interaction-api,6-websocket-protocol}.md`)를 line-level 로 대조했다. 이 세션은
이미 7라운드(`14_08_45`~`16_51_19`) 코드 리뷰 + 6라운드 impl-done consistency 를 거친 뒤의
최종 changeset이라, 이전 라운드에서 지적된 CRITICAL/WARNING 이 실제로 반영됐는지를 우선
확인했다.

## 핵심 구현 로직 검증

`rerun-modal.tsx` 의 `blockedByMaskedInput` 세 조건 합(`!touched || hasMaskedMarkerLeaf(v) ||
(isStructuredField && typeof v === "string")`)을 코드·테스트·spec §10.2 세 곳에서 대조했다 —
세 곳 모두 정확히 같은 규칙을 서술하고, De Morgan 전개(차단 = ¬(touched ∧ ¬marker ∧
parse-ok)의 부정)도 코드와 일치한다. `hasMaskedMarkerLeaf` 의 깊이 상한(10)이 backend
`MAX_REDACT_DEPTH`(`sanitize-error-message.ts:112`)와 실제로 같은 값이고, 값 검사가 깊이
컷오프보다 먼저 실행돼(`masked-markers.ts` `scanForMarker`) depth-10 지점에 놓이는 마커도
정확히 잡히는지, depth-11 은 안 잡히는지 두 방향 모두 backend `deepRedactCore` 의 실제 치환
지점과 대조해 재현했다 — 일치한다. `executions.service.ts` 의 `toResponseExecution`(라인
1075) · `toExecutionDto`(라인 1010) · `getChain`/`stop`(모두 `toResponseExecution` 경유)이
전부 `redactStoredDataForResponse(inputData)` 를 통과하고, `original.inputData ?? {}`
(라인 484, `useOriginalInput=true` 경로)는 마스킹 관문을 거치지 않는 raw 엔티티에서 직접
읽어 spec 이 주장하는 "토글 ON 은 원문" 을 실제로 보장한다.

## 발견사항

없음 — 이전 라운드가 지적한 항목 전부가 이번 changeset 에 반영돼 있음을 확인했다:

- `MASKED_INPUT_DATA_REASON` 앵커 삭제 주장을 `grep -rn` 으로 재확인(코드베이스 전체 0건).
- CHANGELOG 상단 신규 항목과 하단 기존 #1180 블록의 모순(`15_32_34` W2)은 `CHANGELOG.md:108`
  의 `> 이 카브아웃은 2026-08-20 에 닫혔다` 후방 참조로 해소돼 있다.
- `executions.service.spec.ts` describe 소제목 "의도적으로 대상이 아니다" (`14_44_08`
  documentation WARNING, `15_10_25` RESOLUTION 이 `ResponseExecution` JSDoc 주제문도 함께
  수정한다고 명시)는 이번 diff 에서 `## 두 레벨 모두 마스킹 대상이다` 로 정정돼 있다.
- `rerun-modal.tsx` 의 두 JSDoc 블록 분리 지적(`14_44_08` maintainability WARNING)은 현재
  `blockedByMaskedInput` 위 단일 JSDoc 블록(조건 표 포함)으로 병합돼 있다.
- 무효 JSON 우회(`15_32_34` W1, 리뷰어 재현) — `isStructuredField(k) && typeof
  paramValues[k] === "string"` 세 번째 조건이 실제로 존재하고, 대응 캐너리
  (`rerun-modal.test.tsx` "[캐너리] object 필드를 무효 JSON 으로 만들어도 계속 막는다")가
  스키마 도착 → 파싱 성공(해제) → 마커 복귀 + JSON 파괴(재차단) 순서로 정확히 그 경로를
  행사한다.
- 값-단독/터치-단독 회귀 캐너리(`14_08_45` W2, `14_44_08` W2)도 각각
  "[캐너리] 마스킹된 boolean 은 지연 스키마 도착 후에도 계속 막힌다"와 "[캐너리] 건드린 뒤
  값이 다시 마커면 계속 막는다"로 고정돼 있다.
- i18n 신규 키 `editor.runWithInputMasked` / `history.rerun.maskedInputBlocked` 는 ko/en
  양쪽 dict 에 존재하고 호출부(`editor-toolbar.tsx:117`, `rerun-modal.tsx:538`) 경로와
  정확히 일치한다.
- spec 7개 문서(§R17 표·§10.2·§6.4/websocket flip-flop 서술·webhook §5.3 이중 방어 caveat·
  data-model 세 컬럼 규칙·background §5.1 재인용)가 전부 "두 레벨 모두 마스킹" 최종 상태로
  일관되게 갱신돼 있고, 코드의 실제 분기(background-runs, background-run-response.dto,
  execution-response.dto, NodeExecutionSummaryDto)와 문구 수준에서 어긋나는 곳이 없다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정이 backend 마스킹 관문 3곳
(`toResponseExecution`/`toExecutionDto`/`getChain`·`stop` 경유), frontend 소비처 3곳(폼
프리필·Re-run 모달·에디터 히스토리 로드), 공용 마커 판별 유틸(`masked-markers.ts`), spec
7개 문서, i18n 2쌍, 유저 가이드 4개 MDX 전체에 걸쳐 line-level 로 정확히 반영돼 있다. 세
번의 리뷰 라운드에 걸쳐 좁혀진 "차단 판정 세 조건"(touched ∧ ¬marker ∧ parse-ok)이 코드·
테스트·spec 세 곳에서 동일하게 서술되고, 각 조건이 없을 때 뚫리는 경로를 겨눈 전용 캐너리가
모두 존재해 회귀 방어가 실질적이다. TODO/FIXME/HACK/XXX 미완성 마커, 반환값 누락, spec 과의
line-level 불일치는 발견되지 않았다.

## 위험도

NONE
