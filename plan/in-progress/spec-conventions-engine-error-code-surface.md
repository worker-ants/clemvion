---
title: "`error-codes.md` §Overview 가 대표 surface 를 `ErrorCode` 단수로 서술한다 — `EngineErrorCode` 병기"
worktree: easy-a-harness-hygiene
started: 2026-08-31
owner: project-planner
status: in-progress
priority: P3
---

## Overview

`codebase/backend/src/nodes/core/error-codes.ts` 에 자매 const `EngineErrorCode` 가 신설됐는데
(`plan/complete/exec-intake-followups.md` ARCH#5, 2026-08-31), 규약 문서
[`spec/conventions/error-codes.md`](../../spec/conventions/error-codes.md) §Overview 의
"적용 범위" 문단은 여전히 **`ErrorCode` 하나**를 "명명이 중앙화된 대표 surface" 로 서술한다.

`spec/` 쓰기라 **planner 트랙**이다 — developer 턴에서 처리하지 않고 분리 등재한다.

## 왜 이 항목이 developer 턴에서 안 닫혔나

그 PR 은 **코드 전용**(`spec_impact: none`)이었다. 값 문자열이 하나도 바뀌지 않았으므로
그 판정은 맞고, consistency `--impl-done`(`review/consistency/2026/08/31/21_34_02`)도
**BLOCK: NO** 를 냈다. 이 항목은 그 라운드가 **INFO** 로 낸 것이고, checker 스스로
*"코드 전용 PR 범위 밖이라 이번 PR 필수 조치 아님"* 이라 적었다.

developer 가 `spec/` 을 고칠 수 있는 좁은 예외(자기-반증형 소정정)에도 해당하지 않는다 —
그 문장은 예고·트리거가 아니라 **규약 서술**이고, developer 가 쓴 문장도 아니다.

## 할 일

- [x] **`spec/conventions/error-codes.md` §Overview 두 surface 병기 — 완료 (2026-09-01).**
      **같은 파일**에 있다는 점도 함께 적을 것 — "파일은 하나, const 는 둘" 이 그 설계의
      핵심이고, 문서가 두 파일로 읽히면 오해가 된다.

      > **접근이 바뀌었다 (2026-09-01, `--spec` 4라운드).** 원래 이 항목은 목적지 필드를
      > 괄호로 적었다 — *"`ErrorCode`(노드 핸들러 `output.error.code`) / `EngineErrorCode`
      > (엔진이 싣는 `Execution.error`·`NodeExecution.error`)"*. **그 서술이 반증됐다**:
      > `Execution.error` 는 두 family 가 공존하는 필드이고(`EXECUTION_TIME_LIMIT_EXCEEDED`
      > 는 `ErrorCode` 소속인데 엔진이 싣는다), `EngineErrorCode` 는 코드마다 목적지가 다르다.
      >
      > 그리고 목적지 매핑은 애초에 §Overview 의 책임이 아니라 `3-error-handling.md §1`
      > 카탈로그 SoT 에 위임돼 있다. **최종 접근: 존재·자매 관계·키 disjoint 만 적고 목적지는
      > SoT 로 보낸다.** 경위는
      > [`spec-draft-error-code-two-surfaces.md`](../complete/spec-draft-error-code-two-surfaces.md)
      > §"세 번 고쳤다" 참조.
- [x] **`/consistency-check --spec` — 완료 (2026-09-01).** **6라운드**를 돌았고 마지막이
      **BLOCK: NO · Critical 0 · WARNING 0**(`review/consistency/2026/09/01/21_56_30`).
      매 라운드가 실재하는 오류를 잡았고 전부 내가 방금 쓴 문장에서 나왔다 — 경위는
      [`spec-draft-error-code-two-surfaces.md`](../complete/spec-draft-error-code-two-surfaces.md)
      §"세 번 고쳤다".
- [x] **후속 — 인접 문서의 선재 drift: spec 쪽 2건 반영 완료 (2026-09-04)**
      (`spec-draft-scope-and-anchor-drift.md` ④). `1-data-model.md` 는 6종의 등재처를 함께
      적고 "복사가 유일한 채움 경로" 오독을 끊었으며, `3-error-handling.md` §1.4 는 앵커
      열을 얻었다. **이 항목이 "삼분법" 이라 적은 전제는 실측이 정정했다** — 그 6종에
      앵커 없는 맨 문자열은 하나도 없고 `RehydrationError.code` 클래스 필드 유니온이
      세 번째 앵커 종류다.
- [ ] **잔여 (developer 트랙) — `error-codes.ts` `EngineErrorCode` JSDoc 의 이분법 프레이밍.**
      spec 이 아니라 코드 주석이라 planner 권한 밖이다. 위 spec 정정이 착지했으므로
      대조 대상이 명확해졌다. 종전 서술: (`--spec` `21_39_47` cross_spec).
      이 병기가 만든 것이 아니고, 층 기반으로 쓰면서 충돌 주장도 사라졌다. 다만 같은 오독을
      계속 재생산하는 자리라 등재한다:
      - `spec/1-data-model.md:474` — 엔진 인프라 코드 6종을 **소속 구분 없이** 나열한다.
        실제로는 `EngineErrorCode` / `ErrorCode` / 둘 다 아님(raw literal) **삼분법**이다.
        `:562` "복사" 서술도 `EXECUTION_QUEUE_WAIT_TIMEOUT` 의 admission-gate 직접 갱신 경로를
        빠뜨려 "복사만이 유일한 채움 경로" 처럼 읽힌다.
      - `codebase/backend/src/nodes/core/error-codes.ts` — `EngineErrorCode` JSDoc(앵커:
        `**엔진 레이어** 에러 코드`)이
        **"엔진 레이어" 이분법**으로 프레이밍한다. 이 병기가 반증한 그 분류가 **소스 주석에는
        그대로 남는다**(6차 `--spec` cross_spec INFO #1). spec 이 아니라 코드 주석이라
        developer 트랙이다.
      - `spec/5-system/3-error-handling.md` §1.4 — "엔진 수준 에러" 10종을 단일 집합처럼
        나열하는데 named const 등재는 **2종뿐**이다. 두 surface 병기를 읽은 사람이 "이 카탈로그가
        두 surface 로 다 설명된다" 고 오독할 수 있다.
- [x] **"판단 기준을 함께 적을지" 에 대한 답 (2026-09-01)** — §함께 볼 것이 "이 항목의 실제
      무게" 라 부른 질문이다. **답: 이번에는 안 쓴다.** 규약 문서에 기준을 쓰면 그 형태가
      규약으로 굳는데, 근거인 ARCH#5 ⑤ 가 스스로 *"의식적 이탈"·"해석의 여지가 있다"* 고
      유보를 남긴 상태다. 유보 중인 결정을 기준으로 승격시키면 다음 사람은 유보를 못 보고
      규약만 본다 — ARCH#5 ⑤ 가 막으려던 그 독법이다.

      **기준을 쓰려면 먼저 그 유보를 닫아야 한다** — `RETRY_*` 가 왜 자매 const 가 되지
      않았는지, 그 결정이 WS ack 경계에 한정된 맥락이었는지를 판정하는 별도 planner 항목이다.
      재개 신호: 세 번째 자매 const 가 생길 때(그때는 형태가 관례가 되므로 기준이 필요해진다).

      > **그 신호는 이미 모호하다** (`--spec` `21_49_21` plan_coherence W3). `WsErrorCode` 가
      > **`EngineErrorCode` 보다 먼저**(2026-07-07, `daaae64c2`, #843) 별도 const 로 신설돼
      > 있다. 다만 **다른 파일**이라, "세 번째" 를 *같은 파일 안의* 자매로 세는지 저장소 전체
      > 별도 const 로 세는지에 따라 이미 충족일 수도 있다. 재개 판정 때 **그 정의부터** 정할 것
      > — 여기 적어 두는 이유는 draft 가 `complete/` 로 가면 이 사실이 소실되기 때문이다.

## 나란히 가는 plan

`spec-update-node-cancellation-shutdown-classification.md` §3 이 같은 파일
(`spec/conventions/error-codes.md`)에 `AbortError` 등재를 위임해 두었다 — 두 편집이 같은
문서를 겨누므로 착수 순서가 겹치면 서로의 문단을 덮을 수 있다(6차 `plan_coherence` INFO #7).

## 함께 볼 것 (착수 전 읽기)

이 병기를 쓸 때 **왜 자매 const 인가**를 함께 판단해야 한다. 그 근거와 **선례와의 이탈**이
[`exec-intake-followups.md` ARCH#5 ⑤](../complete/exec-intake-followups.md) 에 정리돼 있다 —
요지는 2026-06-14 사용자 결정이 기각한 것은 **값 레벨 prefix**(`EXEC_*`, 이중 표기)이고 이
변경은 값을 바꾸지 않았으나, `RETRY_*` 선례("레이어가 달라도 한 enum")와는 **형태가 의식적으로
어긋난다**는 것이다.

규약 문서에 한 줄을 쓰면 그 형태가 **규약으로 굳는다.** 그래서 병기만 하지 말고,
*"언제 central enum 을 확장하고 언제 자매 const 를 만드는가"* 의 판단 기준을 함께 적을지를
planner 가 결정해야 한다 — 그게 이 항목의 실제 무게다.

## 관련

- 발생 맥락: [`plan/complete/exec-intake-followups.md`](../complete/exec-intake-followups.md) ARCH#5
- 검출: `review/consistency/2026/08/31/21_34_02` INFO 1 (cross_spec · rationale_continuity ·
  convention_compliance · naming_collision **4명 중복 지적**)
- 같은 라운드의 별건 INFO 2 — repo-guard 3파일 패턴(`*-guard.ts`/`*-fixture.ts`/`*.spec.ts`)에
  소유 규약 문서가 없다. `spec/conventions/repo-guards.md` 신설 검토는 이 항목과 **독립**이며
  더 큰 결정이라 여기 묶지 않는다(포인터만 남긴다).

  > **수치 갱신 (2026-09-04 실측)**: 종전 "5쌍 이상" 이었다. 지금은 `*-guard.ts` **7** ·
  > `*.spec.ts` **8** 이고, 그 사이 `entity-nullable-column-type-mismatch.md` 작업이 walker
  > 사본 5개를 `collectTsFiles` 하나로 통합해 **공유 인프라가 생겼다**(`.spec.ts`/`.d.ts`
  > 제외 · vendor skip · 정렬 4규칙). 규약 문서를 쓴다면 이제 그 공유 축도 대상이다.
  >
  > 이 갱신은 `--impl-done`(`05_05_14` plan_coherence W4)이 stale 수치를 지적해 이뤄졌다.
