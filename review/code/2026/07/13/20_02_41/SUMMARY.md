# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 회귀는 발견되지 않았다(이번 라운드 실질 변경분 "컨테이너 경계 핸들 SoT 상수화"는 spec R-3 서술과 line-level 로 일치). 다만 원 WARNING(hidden-coupling) 수정이 3곳 중 2곳에만 적용되어 부분 미완이고, backlog 추적 누락·harness diff-list 갭 재발(2회 연속)·documentation reviewer 의 disk-write 갭 등 프로세스성 WARNING 이 다수 남아 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/아키텍처 | 컨테이너 경계 핸들 SoT 상수화(직전 라운드 WARNING 수정)가 3개 호출부 중 2개에만 적용됨 — `propagateContainerInMap` 은 자신의 JSDoc 에서 "`propagateContainerOnConnect` 와 동일한 3규칙의 in-place 변형"이라 명시하면서도 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 상수(같은 파일 24-25행에 이미 import 됨)를 쓰지 않고 `'body'`/`'emit'` 리터럴을 재하드코딩. 이 함수는 죽은 코드가 아니며 엣지 제거 시 실행되는 `deriveContainerAssignments` 경로를 탄다(현재는 값이 우연히 일치해 기능 회귀는 없음). | `codebase/frontend/src/lib/stores/editor-store.ts:473,477`(`propagateContainerInMap`) vs 같은 파일 `detectContainerConflict`(269,283)·`propagateContainerOnConnect`(334,342) | 473/477행도 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 로 치환해 SoT 커버리지를 3곳 모두로 확장 |
| 2 | 프로세스/추적성 | RESOLUTION.md(19_42_07) 가 "노드 복제 phantom-undo → 별도 backlog task(`task_89a0d3a2`)로 전환"했다고 서술하지만, 이 backlog ID 는 canonical plan 위치(`plan/complete/spec-sync-edge-gaps.md` "비고" 섹션, 기존 `task_78c80fec`/`task_edb57ca2` 가 등록된 곳)에 소급 반영되지 않음 — 저장소 전체에서 `review/code/.../RESOLUTION.md` 한 곳에만 존재. 결함 자체(`workflow-canvas.tsx` `handleNodeMenuAction` case "duplicate" 의 중복 `pushUndo()` 호출)는 실제 코드에 그대로 존재하며 §4.1 스코프 밖 판단 자체는 정확함. | `review/code/2026/07/13/19_42_07/RESOLUTION.md`(INFO#1) vs `plan/complete/spec-sync-edge-gaps.md`(비고) | `plan/complete/spec-sync-edge-gaps.md` 비고 섹션에 `task_89a0d3a2` 추가, 또는 별도 `plan/in-progress/*.md` 신설 |
| 3 | Review-infra | harness diff-list 갭이 2회 연속(19_42_07 → 20_02_41) 재발 — 이번 payload 19개 파일이 review 산출물 + spec 문서뿐이고, 실제 마지막 커밋(`d00d39c18`)의 변경 파일 3개(`editor-store.ts`, `edge-utils.ts`, `edge-utils.test.ts`)가 전부 빠짐. 여러 라운드의 review 산출물만 선별 혼입돼 diff-base 계산 로직 자체가 일관성 없음. architecture·requirement 양쪽 reviewer 가 독립적으로 `git show`/`git diff` 직접 확인으로 우회 검증(결과: 결함 없음)했으나, 다음 라운드에서 실제 코드 결함이 있어도 조용히 놓칠 위험이 누적됨. | `review/code/2026/07/13/20_02_41/_prompts/*.md` (19개 payload 파일) | orchestrator 의 diff-base 산출 로직 점검(마지막 커밋 diff 또는 브랜치 전체 diff 중 하나로 일관되게 고정) — 2회 연속 재발이므로 이번엔 실제 수정 권고 |
| 4 | Review-infra | `documentation` reviewer 가 라우터에 의해 forced-include 되고 STATUS=success 로 보고되었으나, 출력 파일 `documentation.md` 이 세션 디렉터리에 실제로 생성되지 않음(disk-write gap) — journal.jsonl 등 복구 경로도 부재해 내용 검증 불가 | `review/code/2026/07/13/20_02_41/documentation.md` (파일 부재) | documentation reviewer 재실행 필요. 이 리뷰어는 문서(.md) changeset 변경 때문에 라우터가 강제 포함시킨 것이라 "발견 없음"으로 간주하고 넘기면 안 됨(과거 PR #901 disk-write gap 실사고 재발 패턴과 동일) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 레이어 분리(hit-test↔순수 판정)·용어 정합·R-3 스코프 축소(컨테이너 경계 엣지·컨테이너형 노드 제외) 등 나머지 아키텍처 판단은 이전 라운드와 동일하게 양호 | `spec/3-workflow-editor/2-edge.md` §4.1, R-3 | 조치 불요 |
| 2 | 요구사항 정합성 | 직접 코드 대조 결과 SoT 상수 export·`isContainerBoundaryEdge` 참조·null 방어 테스트·R-3 오탈자 정정·"onConnect 2회" 문구·테스트 158건(92+66)·CHANGELOG 반영이 모두 spec 서술과 line-level 로 일치 확인. TODO/FIXME/HACK 없음 | `edge-utils.ts`, `editor-store.ts`, `edge-utils.test.ts`, `spec/3-workflow-editor/2-edge.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | `propagateContainerInMap` SoT 상수 미적용(WARNING) 외 양호 |
| requirement | LOW | harness diff-list 갭 재발 + backlog 추적 누락(WARNING) 외 spec-코드 정합 확인 |
| documentation | 확인 불가 | STATUS=success 보고되었으나 output 파일 미생성(disk-write gap) — 재시도 필요 |

## 발견 없는 에이전트

없음(실행된 3개 에이전트 모두 WARNING/INFO 이상 보고, documentation 은 산출물 부재로 확인 불가).

## 권장 조치사항

1. **documentation reviewer 재실행** — STATUS=success 인데 출력 파일이 없는 disk-write gap. 내용을 확인하지 않고 "문제 없음"으로 간주하면 실제 WARNING 을 놓칠 위험(과거 PR #901 실사고와 동일 패턴).
2. `editor-store.ts` `propagateContainerInMap`(473, 477행)을 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 상수로 치환해 SoT 커버리지 완성(기능 회귀는 없으나 hidden-coupling 재발 방지).
3. `plan/complete/spec-sync-edge-gaps.md` 비고 섹션에 `task_89a0d3a2`(노드 복제 phantom-undo backlog) 등록 — canonical 추적 위치 정합.
4. orchestrator diff-base 계산 로직 점검 — 2회 연속 재발한 harness 이슈로, 다음 라운드에 실제 코드 결함을 놓칠 위험이 누적되고 있음.

## 라우터 결정

- `routing_status=pending` (`_retry_state.json` 확인 결과 `routing_status: "pending"`, `agents_success`/`agents_fatal` 모두 빈 배열 — 라우터 자체가 완료 상태를 기록하지 못함): "라우터 호출 실패 또는 미완료로 보이나, prompt manifest 상 실제로는 `agents_forced`(`documentation`, `requirement`) + 선택 실행(`architecture`)이 이뤄졌고 나머지 11개(`security`, `performance`, `scope`, `side_effect`, `maintainability`, `testing`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync`)는 router 판단으로 제외됨."
  - **실행**: `architecture`, `requirement`, `documentation` (3명)
  - **강제 포함(router_safety)**: `documentation`(문서 파일 변경), `requirement`(spec 본문 변경)
  - **제외**: 아래 표 (11명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router 판단 — 해당 changeset 에 보안 관련 변경 없음 |
  | performance | router 판단 — 성능 영향 경로 변경 없음 |
  | scope | router 판단 — 스코프 이슈 없음 |
  | side_effect | router 판단 — 부작용 경로 변경 없음 |
  | maintainability | router 판단 — architecture 커버 범위와 중복 판단 |
  | testing | router 판단 — 테스트 변경은 requirement/architecture 가 교차 확인 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 이번 changeset 은 위젯 사용자 가이드 대상 아님 |