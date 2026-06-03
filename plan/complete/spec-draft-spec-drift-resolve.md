---
worktree: spec-drift-resolve-efb608
started: 2026-06-03
owner: project-planner
---

# spec-draft: spec-drift 2건 해소 (parallel count 복원 + WS buttonConfig 예시 정정)

> 본 draft 는 이미 spec/ 본문에 적용된 변경을 consistency-check 대상으로 기술한 것이다.
> 출처 plan: [`spec-drift-parallel-count.md`](./spec-drift-parallel-count.md), [`spec-drift-ws-button-config.md`](./spec-drift-ws-button-config.md).
> 기존 drift 출처: `review/consistency/2026/05/23/10_28_45/SUMMARY.md` (C1/C2/C3).

## 변경 1 — Parallel `done` 출력에 `count` 복원 (결정 B)

**대상**: `spec/4-nodes/1-logic/10-parallel.md` §5.2 / §5.7 / Rationale.

- 기존 §5.2 의 "**`count` 필드는 제거됨** (P1.1 직교성 — `branches.length` 가 SSOT)" 노트가 **drift** 였다. 이는 다음 셋과 모순:
  - `spec/4-nodes/1-logic/0-common.md` §5·§9.1·§11 — 모든 컨테이너(loop/foreach/map/parallel)가 `{ <컬렉션>, count }` 방출 명시.
  - `spec/conventions/node-output.md` Principle 9.2 — 동일 (`parallel` → `{ branches, count }`).
  - 엔진 구현 `execution-engine.service.ts` — `done` 오버라이트가 `{ branches, count: branchResults.length }` 부여.
- **결정 B**: §5.2 에 `count` 복원. §5.2 JSON 예시·필드 표·노트·expression 예시·§5.7 완료 shape 에 `count` 추가. 공통 규약·node-output.md 9.2 는 **변경 없음**(이미 count 명시 = 정답).
- Rationale 에 결정 B 근거(코드·공통규약·다른 컨테이너와 정합, 컨테이너 출력 균일성 우선) + 기각된 대안(A: Parallel 만 count 예외) 기록.

## 변경 2 — WS §4.4 `buttonConfig` 예시 정정 (C2=A, C3=A)

**대상**: `spec/5-system/6-websocket-protocol.md` §4.4 예시 + 필드 표 + Rationale.

- **C2**: 예시의 `timeout: 300` / `timeoutAction: "cancel"` 제거. 근거: `spec/4-nodes/6-presentation/0-common.md` §3·§6.1 (버튼 클릭까지 무제한 대기, 타임아웃 없음) + 엔진 `waitForButtonInteraction` 무한 await(타이머 없음, `timeoutAction` 코드 부재). 예시만 stale.
- **C3**: `nodeOutput: { "type": "carousel", ... }` 판별자를 실제 `NodeHandlerOutput` 5필드 shape(`{ config, output, meta?, port?, status }`)으로 교체. 근거: `0-common.md` §4 Principle 1.1.4 (`type` 판별자 래퍼 금지) + 엔진 `nodeOutputForEvent = structured ?? flatNodeOutput`. 노드 종류는 상위 `payload.nodeType` 로 식별.
- 필드 표의 `buttonConfig`(타임아웃 언급 제거), `buttonConfig.nodeOutput`(NodeHandlerOutput shape 명시) 행 갱신. Rationale 에 C2/C3 정정 근거 + 기각 대안 기록.

## Rationale

두 변경 모두 **신규 정책이 아니라 기존 drift 해소** — spec 예시/노트가 SoT(공통 규약·Principle·실제 코드)와 어긋난 것을 SoT 방향으로 정정. 새로운 요구사항·데이터 모델·API·상태 전이 변경 없음. 다운스트림 영향: `output.count`(이미 코드가 방출 중이라 신규 노출 아님), WS 예시 정정(런타임 payload 형태 불변, 문서만 일치화).

## consistency-check 결과 (`review/consistency/2026/06/03/08_37_18`)

- **BLOCK: YES — 단, 검증된 worktree-vs-main false positive**. Cross-Spec checker 가 main 작업본(`/Volumes/project/private/clemvion/spec/…`, 미커밋이라 stale)을 읽어 "draft 의 '이미 적용됨' 전제와 불일치"를 Critical 로 올림. 동일 SUMMARY 의 Naming-Collision checker 는 **worktree 파일을 읽어 "C2/C3 이미 정정 완료"** 를 확인 — 두 결론이 정면 충돌하며 SUMMARY 가 직접 주석으로 "워크트리 수정이 main 에 반영되기 전까지 BLOCK 유지"라 설명.
- **substantive checker 전원 통과**: Rationale-Continuity NONE, Naming-Collision NONE, Convention-Compliance LOW(INFO 3건), Plan-Coherence LOW(WARNING 1건). Cross-Spec 의 권고사항 #1·#2 는 정확히 "본 worktree 에 이미 적용된 변경을 적용하라"이며, worktree 파일 grep 으로 §5.2/§5.7 count·§4.4 timeout 제거·nodeOutput shape 모두 적용 확인됨.
- **처리**: Critical 은 커밋/머지로 해소되는 아티팩트 — 재실행해도 cross-spec 이 main 을 읽는 한 동일 결과라 재실행 무의미. WARNING(node-output-redesign/parallel.md stale)·INFO(source plan 이동) 는 본 작업에서 해소.
