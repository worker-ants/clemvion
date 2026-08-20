---
title: "`Execution.inputData` egress 마스킹 — 재제출 소비처 2곳에 마커 가드 선행"
worktree: eia-inputdata-marker-guard
started: 2026-08-20
owner: developer
status: complete
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
      > 값만 바뀐다"* 를 짚어, Re-run 모달은 **그 키가 안전해질 때까지 제출을 차단**한다
      > (토글 ON 이면 해제). §R17 "닫는 조건" 의 **"강제"** 문언에 동작을 맞춘 것이다.
      > *"안전해질 때까지"* 의 판정은 이후 리뷰 3라운드에 걸쳐 **세 조건**으로 자랐다 —
      > 아래 `15_32_34` 항목 참조.
- [x] `--impl-prep` 재실행 (`12_58_14`) — **BLOCK: YES**, 다만 사유가 *"spec 이 코드보다
      앞섰다"* 였다. 체커가 해소 경로를 **developer 쪽**으로 지목했고(`plan_coherence` 는
      독립적으로 NONE), 이 BLOCK 은 구현으로만 풀린다 — 여기서 멈추면 순환이다
- [x] 마커 유틸을 `lib/utils/masked-markers.ts` 로 승격 + `hasMaskedMarkerLeaf` 신설
- [x] Re-run 모달 마커 가드 — **프리필 소스 한 곳**(`originalParameters`)에서 걷어내
      `useState` 초기값과 열릴 때 리셋이 함께 덮인다. `useOriginalInput` 경로는 보존.
      > **차단 판정은 세 조건의 합이다**(리뷰 3라운드에 걸쳐 좁혔다): *"사용자가 그 키를
      > 건드렸다"* **그리고** *"현재 값에 마커가 없다"*. 값만 보면 스키마 지연 도착 시
      > `coerceInput("boolean","")` 이 `false` 를 만들어 뚫리고(`14_08_45` W2), 터치만 보면
      > 건드린 뒤 값을 다시 마커로 되돌려도 영구 해제된다(`14_44_08` W2).
- [x] 에디터 히스토리 로드 — 기존 `jsonError` 채널에 얹어 alert·`aria-invalid`·Run 차단을
      한 번에 붙였다. 파싱 실패 시엔 마커 검사를 **하지 않는다**(같은 사유 중복 방지)
- [x] backend — `toResponseExecution`·`toExecutionDto` 두 관문에 마스킹 적용.
      `MASKED_INPUT_DATA_REASON` **코드에서 0건**(표 6곳 전수 삭제)
      > **함정**: `toExecutionDto` 는 주석만 바꾸면 `inputData: execution.inputData ?? null`
      > 이 남아 **주석과 코드가 어긋난다**. 잡아서 실제 마스킹으로 고쳤다.
      > **build 가 jest 가 못 잡은 것을 잡았다** — `ResponseExecution` 이 `inputData` 를
      > 안 넓혀 둬 마스커의 `| null` 반환이 대입 불가였다(`ResponseNodeExecution` 은 이미
      > 넓혀져 있었다 — 자매 비대칭)
- [x] **캐너리 4건 반전** — 반전 전 실행에서 **정확히 그 4건만 RED**(131 passed)로 예측이
      맞았음을 확인한 뒤 뒤집었다. 노드 레벨 캐너리(`⑤`·`⑥-b`)는 **그대로 둔다** — 그쪽이
      고정하는 회귀(WS↔REST flip-flop)는 여전히 유효하다
- [x] 회귀 **27 it-블록** 신규 (모달 14 · 툴바 4 · 마커 유틸 9 — `it.each` 가 있어 실제
      실행 케이스는 이보다 많다) + **뮤테이션 14종**. 전부 라운드 처분 과정에서 실행했다:

      | 뮤턴트 | 결과 |
      |---|---|
      | 모달 가드 제거 | **3 RED** |
      | 툴바 마커 검사 제거 | **2 RED** |
      | 툴바를 raw substring 으로 교체 | **2 RED** — 오탐 캐너리(`***bold***`)가 잡는다 |
      | 마커 보존 제거 (`ExecutionsService` ⑥) | **RED** — `outputData` 먼저, 무력화 후 `inputData` 단독도 |
      | 마커 보존 제거 (`background-runs` 노드 레벨) | **RED** `:339` (inputData 단독) |
      | 깊이 상한 제거 | **2 RED** — 경계 + 스택 회귀 |
      | 값 검사/깊이 검사 **순서 교환** | **1 RED** — 상한 지점 마커(off-by-one = fail-open) |
      | 배열 분기 `depth+1` → `depth` (과소) | **RED** — 깊은 회귀가 잡는다 |
      | 배열 분기 `depth+1` → `depth+2` (**과다**) | **수정 전 생존** → 수정 후 **RED** |
      | 차단 판정을 값-단독으로 되돌리기 | **1 RED** — boolean 캐너리만 |
      | 재오픈 리셋 한 줄 제거 | **1 RED** — 재오픈 캐너리만 |
      | `inputData: null` (필드 비우기) | **5 RED** — ①②⑥⑧⑧-b |
      | 노드 레벨 `inputData: null` (background-runs) | **2 RED** — 마스킹 + 마커 보존 |
      | orphan 타입 추론 제거(`"string"` 고정) | **1 RED** — 구조값 렌더 캐너리만 |

      **세 번째·아홉 번째가 핵심이다** — 전자는 경계를 양방향으로 관측하고, 후자는
      *"지적된 전제가 틀렸다"* 로 끝냈으면 덮였을 fail-open 을 드러냈다
- [x] 트래커 항목 종결
- [x] TEST WORKFLOW 4단계 PASS (라운드마다 재실행, 아래는 **최종 실측**) — lint /
      unit(backend **427 suites · 8,832** · frontend **6,072** · web-chat **23 · 451**) /
      build + 타입체크 ratchet(**199건/38파일**) / e2e **276** + playwright **51**
- [x] `/ai-review` **8라운드** — `14_08_45`(C2·W7) → `14_44_08`(C0·W8) → `15_10_25`(C0·W2)
      → `15_32_34`(C0·W2) → `15_59_17`(C0·W9, 전부 LOW) → `16_25_35`(C0·W3) →
      `16_51_19`(C0·W2, 1건 트래커) → `17_13_19`(C0·W1) → `17_38_33`(C0·W4 — 2 수정,
      2 트래커) → `18_03_01`(C0·W3 — 신규 1건) → `18_23_54`(C0·W3 — **신규 1건은 문서
      편집 잔여물**, 2건은 트래커 이월). 마지막 두 라운드는 SUMMARY 가 이월분을
      "머지를 막을 사유 아님" 으로 명시했다. 발견의 성격이 **동작 → 구조 → 문서 자리 →
      견고성 → 캐너리 자매 → 단언 강도 → 엣지 케이스 교착 → 내 fix 의 부작용**으로
      내려와 수렴
      > **"자매 중 하나만" 이 이 브랜치에서 네 번** 나왔다 — 마커 보존 캐너리 · 양성 단언 ·
      > 노드 레벨 vacuous 단언 · swagger JSDoc 형식. 매번 **내가 한쪽만 고친** 것이다.
      > 그리고 라운드10 의 유일한 신규 발견은 **직전 라운드 내 fix 의 부작용**이었다
      > (orphan 을 string 으로 강제 → `[object Object]`). 고치는 편집이 새 결함을 만든다는
      > 사실 자체가 라운드를 더 도는 이유다 — 라운드11 의 신규 발견도 **이 문단을 쓰다
      > 생긴 중복**이었다(`18_23_54` W1).
      > (이 워크트리의 `11_01_55` 는 이 작업이 아니라 #1186 `token` 패턴 세션 것이다 —
      > 라운드 수에 세지 않는다.)
      > **가장 아팠던 것**: `hasMaskedMarkerLeaf` 를 이 PR 에서 만들어 놓고 모달에 안 써서
      > 중첩 마커가 뚫렸다(C1). 그리고 그 fix 로 넣은 터치 기반 판정이 **반대쪽으로** 뚫려
      > (건드린 뒤 마커 복귀) 두 조건의 합으로 좁혔고, 그것도 **무효 JSON** 에 뚫려
      > (`15_32_34` W1) 구조 필드의 coerce 실패까지 **세 조건**이 됐다.
      > **문서 쪽은 같은 패턴이 다섯 번** 재발했다 — 아래에 캐비엇만 덧붙이고 위 주제문은
      > 옛 값에 두는 형태. ①DTO JSDoc ②spec.ts 소제목 ③`ResponseExecution` 주제문
      > ④"두 조건" 문서 4곳(`15_59_17` W1·W2) ⑤`blockedByMaskedInput` JSDoc 소제목+표.
      > ⑤ 는 리뷰어가 아니라 **④ 를 고친 직후 내가 전수 스캔해** 찾았고, 같은 스캔이
      > 1라운드 술어("비어 있는 동안")가 두 번의 개정을 지나 살아남은 곳도 4군데 더
      > 드러냈다 — 그 라운드에 정정한 서술 자리는 합쳐 **9곳**이다.
      > **재발이 멎은 지점**은 "훑겠다" 는 다짐이 아니라 **산출물**이었다: JSDoc 의 조건
      > 표에 *"이 조건이 빠지면 뚫리는 경로"* 열을 두어, 조건이 늘면 표를 고쳐야 한다는
      > 사실이 표 안에서 보이게 했다.
- [x] `--impl-done` **10라운드** 전부 **BLOCK: NO** (`14_44_42` · `15_10_56` · `15_33_05` ·
      `15_59_50` · `16_26_26` · `16_52_12` · `17_14_02` · `17_39_11` · `18_03_37` ·
      `18_24_31`). 마지막 라운드의 WARNING 1건은 §R17 에 "UI 한정 폐쇄" 경계 문장을
      넣으라는 것으로, **spec 쓰기라 developer 권한 밖**이다 — checker 자신이 트래커
      등재를 확인하고 "이번 PR 을 막을 사유 아님" 으로 판정했다. `16_26_26`~`17_14_02`
      세 라운드는 5 checker 전원 위험도 **NONE**·WARNING **0**, 마지막 `17_39_11` 은
      swagger JSDoc 길이 규약 WARNING 1건(같은 턴 수정). `18_03_37` 은 다시 **CRITICAL·
      WARNING 0**. 그 앞에 `--spec` 2회(`12_29_59` · `12_41_29`) ·
      `--impl-prep` 2회(`12_08_46` · `12_58_14`)
      > **이 카운트는 직전 라운드가 stale 로 지적한 바로 그 항목**(`16_25_35` W3)이라,
      > 라운드가 늘 때마다 같은 커밋에서 갱신한다.
- [x] push → PR — https://github.com/worker-ants/clemvion/pull/1188 (2026-08-20)
