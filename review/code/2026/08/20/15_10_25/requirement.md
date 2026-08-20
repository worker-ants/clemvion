STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 크기 제한으로 일부 파일(`executions.service.ts`/`.spec.ts`, `rerun-modal.tsx`/
`.test.tsx`, `editor-toolbar-run-input.test.tsx`, spec 파일들)의 diff 를 생략했으므로, 해당
파일을 `Read`/`grep` 으로 직접 열어 실제 구현·테스트·spec 본문을 대조했다. 이 changeset 은
직전 두 코드 리뷰 라운드(`14_08_45` CRITICAL 2 + WARNING 7, `14_44_08` WARNING 8)의
`RESOLUTION.md` 를 거쳐 이미 처분이 반영된 최종 상태이므로, 본 리뷰는 (1) 그 처분들이
실제로 코드에 반영됐는지, (2) 남은 요구사항 결함이 있는지, (3) spec 본문과 line-level 로
일치하는지를 재검증했다.

## 발견사항

이번 라운드에서 새로 지적할 요구사항 결함을 찾지 못했다. 검증한 핵심 항목:

- **차단 판정 로직** (`rerun-modal.tsx:345-349`, `blockedByMaskedInput`) — "건드렸는가"와
  "현재 값에 마커가 없는가"의 **논리곱**으로 구현돼 있다. 직전 두 라운드가 지적한 두 우회
  경로(스키마 지연 도착 시 `coerceInput("boolean","")` → `false` 로 값 기반 우회, 건드린 뒤
  마커로 되돌리는 터치 기반 우회)가 각각 반대 조건으로 막혀 있음을 확인했다. `useOriginalInput`
  ON 시 정확히 예외 처리된다(`!useOriginalInput && ...`).
- **object/array leaf 마커** — `hasMaskedMarkerLeaf` 가 `splitMaskedParameters`
  (`rerun-modal.tsx:127-132`)와 `editor-toolbar.tsx:118`(`jsonError` 계산) **양쪽 모두**에
  쓰이고 있음을 확인했다 — 직전 라운드 CRITICAL 1(헬퍼를 만들어 놓고 모달에 안 쓴 결함)이
  실제로 해소돼 있다.
- **backend 마스킹 관문 6곳** (`executions.service.ts`) — `toResponseExecution`
  (`findById`/`getChain`/`stop` 공유), `toExecutionDto`(목록), `findById` 의
  `nodeExecutions[]` map, `BackgroundRunsService.toNodeExecutionDto` 네 지점 전부
  `inputData`를 `redactStoredDataForResponse` 로 마스킹하도록 갱신돼 있고, `MASKED_INPUT_DATA_REASON`
  앵커는 코드베이스 전체에서 0건(전수 삭제 확인, `grep -rn` 실측).
  `background-runs.service.ts:303-304`의 "Execution 레벨만 예외" 대비 문장도 "두 레벨 모두
  마스킹" 으로 정확히 재작성돼 있다.
- **테스트 커버리지** — `rerun-modal.test.tsx`(707줄, describe 두 블록) 와
  `editor-toolbar-run-input.test.tsx`가 스칼라 마커, object/array 내부 leaf, 재-마스킹
  캐너리, 마스킹 키 2개 중 1개만 채운 경우(`some`↔`every` 변이 포착), `useOriginalInput`
  예외, 오탐 경계(`***bold***`, `a***b`), 실제 유입 경로(`getById → JSON.stringify →
  setJsonInput`) 를 전부 개별 테스트로 고정하고 있다. `masked-markers.test.ts` 신설로
  non-string 입력 경로(`123, null, undefined, true, {}, []`)와 순수 유틸 단위 테스트도
  확보됐다.
- **spec fidelity (line-level)**:
  - `spec/5-system/14-external-interaction-api.md:1568-1572` §R17 "닫는 조건" 표의 Re-run
    모달 행 — *"사용자가 그 키를 채우고 값에 마커가 없을 때까지 제출 차단… 토글 ON 이면
    차단도 풀린다"* — `blockedByMaskedInput` 구현과 정확히 일치.
  - `spec/5-system/14-external-interaction-api.md:1637-1645` "레벨이 가른다" 비교표가
    `Execution.inputData (REST) | 함 (2026-08-20~)` 으로 갱신돼 있어(직전 consistency
    라운드 `rationale_continuity` WARNING이 지적했던 자기모순이 해소됨), 코드의 3표면
    통일 상태와 일치.
  - `spec/5-system/13-replay-rerun.md:351-371` §10.2 캐비엇 — 프리필 스킵·터치+무마커
    이중 조건·`useOriginalInput` 예외·히스토리 로드와의 대비까지 코드와 정확히 대응.
  - `spec/3-workflow-editor/3-execution.md:91` §2.2 히스토리 로드 행 — `hasMaskedMarkerLeaf`
    기반 Run 차단 서술이 `editor-toolbar.tsx:118`의 실제 조건과 일치.
  - `spec/1-data-model.md:471,550` §2.13/§2.14 — `Execution.input_data`/`NodeExecution.input_data`
    양쪽 다 "두 레벨 같은 규칙" 으로 갱신, backend 구현(6곳 마스킹 관문)과 일치.
  - `spec/5-system/12-webhook.md`, `6-websocket-protocol.md`, `4-nodes/1-logic/12-background.md`
    세 자매 문서도 "레벨이 가른다" 축 폐기를 동일하게 반영 — 6개 SoT 미러 문서 전수 확인,
    불일치 없음.
- **TODO/FIXME/HACK/XXX** — 이 changeset 의 `codebase/` diff 전체에서 검색해 0건.
- **에러 시나리오** — `handleSubmit`(rerun-modal.tsx)의 `catch` 블록은 `RERUN_*` 에러 코드를
  i18n 매핑하고 미매핑 코드는 generic fallback 으로 떨어진다(기존 로직, 이번 PR 무변경).
  JSON 파싱 실패 시 마커 검사를 건너뛰는 것도 의도된 설계이며(같은 사유 중복 방지, plan 문서
  "구현 제약" 절에 명시) 정상 동작한다.

## 회색지대 (INFO, 조치 불요)

- `inputOverride` 의 서버측 마커 리터럴 재검증 부재(defense-in-depth 부재)는 이번 PR 이
  만든 결함이 아니고, §R17 이 가드 범위를 "UI 정상 흐름 방어" 로 명시하고 있어 spec 상 의도된
  경계다. 트래커(`spec-sync-external-interaction-api-gaps.md`)에 이미 등재돼 있다.
- 마스킹 게이트 4곳(관문 2 + 노드 루프 + `background-runs.service.ts`)이 단일 헬퍼로
  통합되지 않은 fragmentation 은 유지비 이슈이나 이번 PR 범위 밖으로 트래커에 별도 등재돼
  있다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정이 backend 마스킹 관문
6곳, frontend 재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)의 마커 가드,
그리고 spec 7개 문서에 걸쳐 line-level 로 정확히 반영돼 있다. 직전 두 코드 리뷰 라운드가
잡은 CRITICAL 2건(object/array leaf 우회, stale JSDoc)과 WARNING 8건(값 기반 우회, 터치
기반 우회, spec 비교표 자기모순 등)은 이번 최종 상태에서 모두 코드·테스트·spec 으로 실제
해소돼 있음을 직접 실행 대신 소스·테스트 대조로 확인했다. 새로 지적할 기능 완전성·엣지
케이스·spec fidelity 결함을 찾지 못했다.

## 위험도

NONE
