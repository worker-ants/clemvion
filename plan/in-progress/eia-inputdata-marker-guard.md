---
title: "`Execution.inputData` egress 마스킹 — 재제출 소비처 2곳에 마커 가드 선행"
worktree: eia-inputdata-marker-guard
started: 2026-08-20
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/1-data-model.md
  - spec/5-system/13-replay-rerun.md
  - spec/3-workflow-editor/3-execution.md
  - spec/5-system/12-webhook.md
  - spec/5-system/6-websocket-protocol.md
  - spec/4-nodes/1-logic/12-background.md
---

# `Execution.inputData` egress 마스킹 + 재제출 소비처 마커 가드

트래커 `spec-sync-external-interaction-api-gaps.md` 의 **"`inputData` egress 마스킹 — 프런트
마커 가드가 선행돼야 한다"** 집행. 사용자가 `token` 계열(#1186) 다음 순서로 지정했다.

## 왜 이 컬럼만 카브아웃돼 있었나

#1180 초안이 `inputData`·`outputData` 를 함께 닫았다가 **되돌렸다.** 이 값은 표시 전용이
아니라 **재제출**되기 때문이다 — 마스킹하면 리터럴 `'***'` 가 새 실행의 **실제 입력값**이
된다. 두 게이트가 독립으로 CRITICAL 을 냈고 사용자가 철회를 택했다.

§R17 이 적어 둔 **닫는 조건**: *"두 소비처가 마스킹 마커를 감지해 해당 필드 재입력을 강제하는
가드."* #1181 이 그 가드의 첫 조각(폼 프리필)을 세웠고, 이 작업이 나머지 둘을 세워 컬럼을 닫는다.

## 무수정 프로브 — 소비처 전수 (production 코드 변경 0)

트래커는 소비처가 "둘" 이라 했다. **맞다. 다만 진입점은 셋이다** — 셋이 같은 모달을 연다:

| # | 경로 | 프리필 → 재제출 |
|---|---|---|
| 1 | Re-run 모달 (`rerun-modal.tsx`) | `extractParameters(original.inputData)` → `paramValues` → `inputOverride` |
| 1-a | ↳ 진입점: 실행 상세 페이지 | `execution.inputData` 를 모달에 주입 |
| 1-b | ↳ 진입점: run-results drawer | `detail?.inputData` 를 모달에 주입 |
| 1-c | ↳ 진입점: 실행 목록 | (같은 모달) |
| 2 | 에디터 "히스토리에서 불러오기" (`editor-toolbar.tsx`) | `getById(id).inputData` → `setJsonInput(JSON.stringify(...))` → 재실행 |

**`useOriginalInput` 기본값은 `false`** 라 사용자가 손대지 않아도 `inputOverride` 가 실린다
(`rerun-modal.tsx:181,284` 실측).

**나머지 `.inputData` 참조는 전부 비대상**: `result-detail.tsx`·`transform/preview.tsx`·
실행 상세의 `ne.inputData` 는 **노드 레벨**(이미 마스킹됨)이고, store·WS 스냅샷은 표시 경로다.

## 설계 — 두 소비처의 가드가 왜 서로 다른가

**Re-run 모달 = 폼 가드와 같은 형태** (#1181 선례): 마커면 프리필하지 않고 빈 값 + 안내.
필드 단위로 무엇을 다시 넣어야 하는지 보이기 때문이다.

> **`useOriginalInput` 체크 경로는 막지 않는다** — 서버가 엔티티를 직접 읽어 원문을 쓰므로
> **이 경로가 오히려 정답**이다. 안내 문구가 그 사실을 알린다.

**히스토리 로드 = 제출 차단**: 이쪽은 필드가 아니라 **JSON 텍스트 전체**라 "빈 값으로
비우기" 가 어느 필드가 마스킹됐는지를 지워 버린다. 그래서 마커를 **그대로 보이게 두고**,
JSON 안에 마커가 남아 있는 동안 실행 버튼을 막는다 — 트래커가 요구한 *"재입력 강제"* 를
정보 손실 없이 만족한다.

> **구현 제약 (impl-prep W2)**: 텍스트에 대한 **substring 매칭 금지.** `isMaskedMarker` 는
> *"값 전체가 마커와 정확히 일치"* 만 잡도록 #1181 이 의도적으로 좁힌 경계이고, raw 문자열을
> 훑으면 마크다운 `***bold***` 같은 정상 입력이 오탐된다. **`JSON.parse` 한 뒤 leaf 값을
> 순회하며 `isMaskedMarker` 를 재사용**한다(재구현 금지).
>
> **파싱 실패 시**: 기존 `jsonError` 가 이미 그 경우를 잡아 실행을 막으므로 마커 검사는
> **수행하지 않는다** — 파싱 불가 상태에서 보수적 차단을 덧붙이면 같은 사유를 두 번 말한다.

**마커 유틸을 `lib/utils/` 로 옮긴다**: 지금은 `dynamic-form-ui.tsx`(폼 UI 컴포넌트) 안에
있어 소비처가 셋이 되면 모달·툴바가 무관한 폼 컴포넌트를 import 하게 된다.

## impl-prep 이 BLOCK 했다 — 결론이 **네 문서에 미러**돼 있었다 (`12_08_46`, CRITICAL 3)

내 `spec_impact` 는 §R17 하나만 지목했다. 실측하니 *"`Execution.inputData` 는 마스킹 대상이
아니다"* 라는 결론이 **SoT 로 세 곳에 더** 적혀 있다 — R17 만 뒤집으면 나머지가 그 자리에서
거짓이 된다.

| 문서 | 현재 서술 | 실측 |
|---|---|---|
| `1-data-model.md:471` §2.13 | *"**egress 마스킹 대상이 아니다** — Re-run 프리필이…"* | 확인 |
| `13-replay-rerun.md` §10.2 | *"**이 모달이 그 이유다**… 의도적으로 제외한다"* | 확인 |
| `3-workflow-editor/3-execution.md` §2.2 | 히스토리 로드 행 (§10.2 가 "동일 적용" 으로 상호참조) | 확인 |

**셋 다 `spec/` 쓰기라 developer 권한 밖이다 → planner 턴이 선행해야 한다.**
`spec_impact` 는 네 파일로 확장했다.

## 앵커 방향 확정 — **폐기한다** (CRITICAL 3 해소)

`MASKED_INPUT_DATA_REASON` 을 **반전해서 재사용하지 않는다.** 이름을 그대로 두고 의미만
뒤집으면 참조처가 정반대를 가리킨다 — 실측 결과 **backend 5개 파일 + spec 1곳**이 이 이름을
인용한다:

| # | 파일 | 인용 형태 |
|---|---|---|
| 1 | `executions.service.ts` | 선언 + `void` 참조 + JSDoc 3곳 |
| 2 | `executions.service.spec.ts` | 캐너리 주석 |
| 3 | `dto/responses/execution-response.dto.ts` | JSDoc 2곳 |
| 4 | `background-runs/background-runs.service.ts:304` | *"Execution 레벨만 예외"* 대비 문장 |
| 5 | `background-runs/background-runs.service.spec.ts` | *"…정본"* 인용 |
| 6 | `spec/5-system/13-replay-rerun.md` §10.2 | *"구현 정본은 `MASKED_INPUT_DATA_REASON`"* |

**전수 삭제**하고, 카브아웃이 사라지므로 대체 앵커도 두지 않는다(설명할 예외가 없어진다).
#4 의 "Execution 레벨만 예외" 대비 문장은 **"두 레벨 모두 마스킹"** 으로 재작성한다.

## 범위

- [x] `/consistency-check --impl-prep` (`12_08_46`) — **BLOCK: YES**, CRITICAL 3.
      위 표대로 `spec_impact` 확장 + 앵커 방향 확정으로 developer 권한 내 항목은 해소.
      **spec 3문서는 planner 턴 대기**
- [x] **planner 턴 완료** — `--spec`(`12_29_59` BLOCK:YES → `12_41_29` **BLOCK:NO**) 후
      **spec 7파일** 반영. 초판이 "네 문서" 로 좁게 셌으나 전수 스캔이 `12-webhook.md`
      "유일한 방어" · `6-websocket-protocol.md` "레벨이 가른다" 축 · `1-data-model.md:550`
      대비 문장 · §R17 판단 기준 문단·비교표까지 찾아냈다
      > **가드 사양이 강해졌다**: 체커가 *"안내만 하면 빈 문자열이 실제 입력이 되어 오염의
      > 값만 바뀐다"* 를 짚어, Re-run 모달은 **비어 있는 동안 제출을 차단**한다(토글 ON 이면
      > 해제). §R17 "닫는 조건" 의 **"강제"** 문언에 동작을 맞춘 것이다.
- [ ] `--impl-prep` 재실행 → BLOCK: NO 확인 후에야 구현 착수
- [ ] Re-run 모달 마커 가드 (프리필 스킵 + 안내, `useOriginalInput` 경로 보존)
- [ ] 에디터 히스토리 로드 마커 가드 (마커 잔존 시 실행 차단 + 사유)
- [ ] backend — `Execution.inputData` egress 마스킹으로 전환 + **`MASKED_INPUT_DATA_REASON`
      전수 삭제(위 표 6곳)**. `background-runs.service.ts:304` 의 "Execution 레벨만 예외"
      대비 문장은 "두 레벨 모두 마스킹" 으로 재작성
- [ ] **캐너리 4건 방향 반전** — `①`(findById)·`②`(findByWorkflow)·`⑧`(getChain)·`⑧-b`(stop).
      현재 *"원문으로 통과"* 를 고정하고 있어 그대로 두면 RED
- [ ] 회귀 테스트 + **뮤테이션 검증** (가드 제거 시 RED). 뮤턴트는 **`git show <SHA>:<path>`
      출력을 그대로** 넣는다 — 직전 PR 에서 손 재구성으로 수치를 세 번 틀렸다
- [ ] 트래커 항목 종결
- [ ] TEST WORKFLOW 4단계 → 코드 동결 → `/ai-review` → `--impl-done` → push
