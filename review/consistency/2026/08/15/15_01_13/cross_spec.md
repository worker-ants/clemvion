# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 발견사항

- **[CRITICAL]** `spec/conventions/node-cancellation.md` 가 `finalizeCancelledExecution` 의 0행-매칭 처리 극성을 실제 구현과 반대로 서술 — 자신이 방금 고친 "Stop 침묵" 버그를 다시 부르는 문구
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.5 (`execution.cancelled` `durationMs`), §9.3 EIA-RL-06 — 이 요구사항들이 의존하는 종결-emit 경로가 `execution-engine.service.ts` 의 `finalizeCancelledExecution` 이다.
  - 충돌 대상: `spec/conventions/node-cancellation.md` §2.4 구현 상태 표 197행(신규 추가) 및 바로 아래 `## Rationale` "왜 취소 시각 보존 메커니즘이 두 가지인가" 첫 불릿(같은 diff 에서 함께 수정됨).
  - 상세:
    - 표 신규 행: "조건부 UPDATE(`status IN (non-terminal)`)가 0행이면 **CANCELLED 재마킹·`EXECUTION_CANCELLED` emit 을 모두 skip**. 자매 `finalizeFailedExecution` 과 **동형**".
    - Rationale 불릿: "guarded UPDATE 가 이미 terminal 인 행에 0행으로 매칭되고, 그 결과를 읽어 종결 이벤트 emit 을 **skip 한다**."
    - 두 문장 모두 "0행 매칭 = 무조건 emit skip" 으로 서술하고, `finalizeFailedExecution` 과 "동형(isomorphic)" 이라고 단언한다.
    - 그러나 실제 구현(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `finalizeCancelledExecution`, 이 PR 의 diff)은 0행 매칭 시 **DB 를 재조회**해 분기한다:
      - DB 가 이미 `CANCELLED` → **emit 한다** (이 경로가 `stop()` 의 RUNNING/PENDING 케이스에서 **유일한 알림 지점**이라 skip 하면 사용자가 누른 Stop 이 외부에 영영 통지되지 않는다).
      - DB 가 `FAILED`/`COMPLETED` → skip 한다 (다른 종결자가 이미 이겼다).
    - 이 비대칭은 코드 주석에 명시적으로 적혀 있다: "⚠️ `!persisted` 이후는 극성이 반대다... 이 함수를 본떠 새 guarded 경로를 만들 때 무조건 skip 을 기본으로 가정하지 말 것 — 실제로 그렇게 복사해 사용자가 누른 Stop 이 무음이 됐다 (2026-08-15, `13_58_27` W3)." 즉 "0행이면 무조건 skip" 이라는 바로 이 오해가, 이번 PR 히스토리에서 실제로 코드에 들어갔다가 발견·수정된 버그(`b4d0ca27e fix(eia): 내 첫 수정이 사용자가 누른 Stop 을 침묵시켰다`)의 원인이다. `execution-engine.service.spec.ts` 에 추가된 회귀 테스트 `finalizeCancelledExecution — 0행 매칭의 두 의미`(a) 케이스도 "DB 가 이미 cancelled — **emit 한다**" 를 명시적으로 단언해 이 극성을 고정하고 있다.
    - `node-cancellation.md` 표/Rationale 은 이 diff 에서 함께 편집됐음에도 정정되지 않아, 문서 SoT(§2.4 구현 상태 표)가 코드·테스트·자기 파일의 다른 서술(코드 주석에서 인용해 옮긴 "동형" 주장 자체가 틀렸다는 것)과 모순된 채 남아 있다. 이는 EIA §6.5/§9.3(`execution.cancelled` 종결 통지의 신뢰성 계약)이 실제로 의존하는 함수의 정본 서술이 잘못됐다는 뜻이라 cross-spec 영향이 크다 — 다음 리팩터가 이 표를 근거로 "0행이면 무조건 skip" 을 재구현하면 EIA-RL-01(at-least-once)·EIA-RL-06 인접 계약을 다시 깬다.
  - 제안: `node-cancellation.md` §2.4 표 197행과 Rationale 첫 불릿을 코드 주석과 동형으로 재작성 — "0행 매칭 시 DB 재조회 → CANCELLED 면 emit(유일한 알림 지점 보존), 그 외 terminal 이면 skip. `finalizeFailedExecution` 과는 **극성이 반대**(그쪽은 0행이면 무조건 skip)" 로 명시. "자매와 동형" 문구는 삭제하거나 "guarded UPDATE 메커니즘만 동형, 0행 이후 분기는 반대 극성" 으로 한정.

- **[INFO]** `spec/data-flow/15-external-interaction.md` §1.2 의 `GET /:id` 필드 열거가 `durationMs` 추가를 반영하지 못해 더 불완전해짐
  - target 위치: `spec/5-system/14-external-interaction-api.md` EIA-IN-04, §5.3 (`durationMs` 필드 신규 추가)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §1.2 "**단발 상태 조회**: `GET /:id` 는 `execution` row 의 status/result/error 만 반환하는 SSE 보정용 read-only 경로"
  - 상세: 이 서술은 이번 diff 이전부터 `currentNode`/`context` 를 이미 누락하고 있던 비-망라적 요약이라 이번 변경이 "새로 깨뜨린" 것은 아니다. 다만 `durationMs` 가 추가되며 필드 목록의 실제 shape 과 문서 요약의 간극이 한 칸 더 벌어졌다. data-flow 문서 자신도 "API 필드 계약의 단일 진실은 5-system/14 문서" 라고 명시하므로 CRITICAL 은 아니다.
  - 제안: 여유 있을 때 §1.2 문장을 "status/currentNode/context/result/error/durationMs" 로 갱신하거나, 아예 "필드 목록은 EIA §5.3 참조" 로 바꿔 향후 필드 추가마다 두 곳을 동기화할 필요를 없앤다.

## 요약

이번 diff 의 핵심 변경(EIA `GET /:id` 응답에 `durationMs` 추가, `finalizeCancelledExecution`/`retry-turn` 의 취소-경로 `durationMs` 정합성 수정)은 `spec/5-system/14-external-interaction-api.md` 본문·`spec/1-data-model.md`·`CHANGELOG.md` 사이에서는 서로 정합적이다. 그러나 같은 diff 에서 함께 수정된 `spec/conventions/node-cancellation.md` 가 이번 수정의 핵심 로직(`finalizeCancelledExecution` 0행-매칭 시 emit 여부)을 실제 구현·회귀 테스트·코드 주석과 반대로 서술하고 있다 — 하필 이 문서가 방금 고친 "Stop 침묵" 버그의 원인이 됐던 바로 그 오해를 다시 정본으로 적어 놓았다. target 영역(`spec/5-system/`) 자체의 API 계약은 깨지지 않았지만, 그 계약이 의존하는 인접 영역(`spec/conventions/`) 문서의 자기모순이 향후 리그레션의 직접 원인이 될 수 있어 CRITICAL 로 판정한다.

## 위험도
CRITICAL
