# 신규 식별자 충돌 검토 결과

## 검토 대상
- target: `plan/in-progress/spec-draft-cross-audit-doc-batch.md`
- spec_impact: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/2-navigation/14-execution-history.md`, `spec/5-system/13-replay-rerun.md`

## 분석 요약

target 은 8개 "변경" 항목(V-13 하향, V-18 재검증 종결, V-05·V-14 spec-doc 보강)으로 구성되며, 전부 **기존 섹션에 대한 서술 하향(Planned 마킹)·주석 추가·상호 참조 각주**다. 실제 대상 spec 파일을 읽고 대조한 결과:

- **변경 1~3** (`0-common.md §8`, `1-ai-agent.md §11`, `3-information-extractor.md §8`) — 기존 "캔버스 요약" 표의 서술을 "(구현 예정 — 현재 요약 미표시)" 로 하향하고 `{N} tools` 예시를 삭제. 새 필드명·엔티티명·ID 없음.
- **V-18** — 코드 재검증 결과 정합 확인, spec/코드 변경 없음(순수 종결 메모).
- **변경 4** (`14-execution-history.md §3.3`) — 신규 탭 목록을 여기서 열거하는 게 아니라 "SoT 는 [`3-execution.md §10.6.1`](spec/3-workflow-editor/3-execution.md) 참조" 위임 문구만 추가. 새 식별자를 도입하지 않음.
- **변경 5** (`14-execution-history.md ## Rationale`) — Rationale 섹션에 마스킹 근거 문단 추가. 새 식별자 없음.
- **변경 6** (`13-replay-rerun.md §7.4`) — 기존 `Execution.dry_run`(§9.2에 이미 정의된 컬럼) 을 인용하는 노트 추가. 신규 컬럼/필드명 없음.
- **변경 7·8** (`13-replay-rerun.md §10.2`, `14-execution-history.md §3.7`) — 기존 필드 행에 각주 추가(원본 실행 헤더 새 탭 vs chain badge 같은 탭 — 이미 두 문서에 각각 서술되어 있던 동작을 상호 참조로 명문화).

## 발견사항

### [INFO] 변경 4가 참조하는 SoT(§10.6.1)에는 실제 탭명이 아직 열거되어 있지 않음

- target 신규 식별자: 없음 (target 자체는 새 이름을 만들지 않음)
- 기존 사용처: `spec/3-workflow-editor/3-execution.md §10.6.1`(라인 469-518) 의 서브탭 표는 `Preview / Input / Output / Response / Request / LLM Usage / Config / Error` 만 열거. 반면 실제 코드 `codebase/frontend/src/components/editor/run-results/result-detail.tsx:255-271`(및 `en/editor.ts:252-255` 의 `tabReferences`/`tabMeta`/`tabPort`/`tabStatus` i18n 키)에는 `references`/`meta`/`port`/`status` 탭이 이미 조건부로 존재
- 상세: 이것은 target 이 새로 도입하는 식별자 충돌이 아니라(target 은 `Meta/Port/Status/References` 라는 이름을 새로 만들지 않고 execution-history.md 쪽에서 "SoT 는 §10.6.1" 이라고 참조만 추가함), §10.6.1 문서 자체가 이 4개 탭명을 아직 반영하지 못한 **기존 spec-code drift**다. target 이 위임하는 대상 문서에 정작 그 이름이 없어 참조가 공허(dangling reference-by-omission) 해질 수 있음
- 제안: 신규 식별자 충돌은 아니므로 본 checker 관점에서는 차단 사유가 아님. 다만 후속으로 `3-execution.md §10.6.1` 의 탭 표에도 `Meta`/`Port`/`Status`/`References` 4행을 추가해 SoT 위임이 실제로 유효하도록 별도 spec-doc 항목으로 처리할 것을 권고(참조 위임 자체는 유효한 패턴이나 위임처가 비어있으면 독자가 실제 동작을 재추적해야 함 — doc/plan coherence 관점 검토 대상)

## 요약

target 문서가 다루는 8개 변경 항목 모두 기존 spec 섹션에 대한 서술 하향·각주·상호 참조 추가로, 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로 중 어느 것도 신규로 도입하지 않는다. 유일하게 주목할 점은 변경 4가 위임하는 SoT(`3-execution.md §10.6.1`)에 실제 코드가 이미 갖고 있는 `Meta/Port/Status/References` 탭명이 아직 반영되어 있지 않다는 것인데, 이는 신규 식별자 충돌이 아니라 위임 대상의 사전 존재 gap(다른 검토 관점의 소관)이다. 신규 식별자 충돌 관점에서는 문제 없음.

## 위험도
NONE
