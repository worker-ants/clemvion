# Rationale 연속성 검토

## 검토 대상 확인 경위

prompt payload 는 컨텍스트 예산 초과로 `spec/conventions/node-cancellation.md`(본 diff 의 핵심 대상)
자체가 생략 목록에 포함돼 있었다. 이 문서는 diff·plan 을 근거로 관련성이 명백해 워크트리
절대경로로 직접 열어 확인했다(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-signal-b4d1/spec/conventions/node-cancellation.md`,
`spec/5-system/4-execution-engine.md` §11 + Rationale, `spec/conventions/execution-context.md`,
`spec/data-flow/3-execution.md`, `spec/1-data-model.md`). 실제 diff(`git diff origin/main`)는
`spec/conventions/*.md` 를 전혀 건드리지 않고, 코드(`cafe24-api.client.ts`/`cafe24.handler.ts`/
`makeshop-api.client.ts`/`makeshop.handler.ts`)와 `plan/in-progress/*` 2건만 변경한다.

## 발견사항

- **[INFO]** SIGTERM/workflow-timeout abort 의 `failed` vs `cancelled` 분류 충돌 — 이미 적절히 격리됨
  - target 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (신설, 전체)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §11-4`("미완료 시 … `failed` + `error.code='SERVER_INTERRUPTED'`") + 동일 결정이 `spec/1-data-model.md:473`, `spec/data-flow/3-execution.md`(상태 다이어그램 3곳, `running --> failed: … SERVER_INTERRUPTED`)에 교차 인용된 **기 구현·기 테스트 완료 계약**
  - 상세: `node-cancellation.md §5.1`(`AbortError` → `cancelled`)을 "Workflow 단위 timeout / graceful shutdown 의 노드 abort" 항목에 그대로 적용하면, 이미 구현된 `ShutdownStateService`(`failed`+`SERVER_INTERRUPTED` bulk UPDATE)와 같은 row 를 놓고 경합해 **결정 번복**이 발생할 뻔했다. 그러나 이번 PR 은 이 배선을 실제로 구현하지 않고 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 해당 항목을 `⛔ BLOCKED — project-planner 결정 대기` 로 명시적으로 분리했고, 별도 plan(`spec-update-node-cancellation-shutdown-classification.md`)에 두 대안((a) 기존 `failed` 계약 유지 / (b) `cancelled` 로 재정의 + 4개 spec 문서 동반 갱신)을 **택일 항목**으로 올려 developer 권한 밖임을 명시했다(`developer 는 spec/ 쓰기 권한이 없어 제안만 남긴다`). 이는 본 검토 관점 3("결정의 무근거 번복")을 정확히 회피한 사례 — 결정을 뒤집지 않았고, 뒤집을 경우의 Rationale 갱신 대상까지 미리 열거했다.
  - 제안: 조치 불요(이미 올바르게 처리됨). planner 가 (a)/(b) 중 하나를 택할 때 반드시 `execution-engine.md §11 Rationale`·`data-flow/3-execution.md` 상태 다이어그램·`1-data-model.md` 에러코드 표를 동반 갱신하도록 재확인만 하면 된다.

- **[INFO]** cafe24/makeshop cascade 구현이 §5.1 "cancelled ≠ failed" invariant 를 정확히 준수
  - target 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (diff), `makeshop-api.client.ts` (diff, 대칭)
  - 과거 결정 출처: `spec/conventions/node-cancellation.md §5.1`("`AbortError` 인 throw 는 노드가 실패한 것이 아니라 중단된 것") + §2.1 표의 `database-query.handler.ts` 선례(취소 driver 에러 → `AbortError` 재throw)
  - 상세: 최초 구현(1차 리뷰 이전)은 `AbortError` 를 `recordNetworkFailure` + `*TransportFailedError` 로 감싸 취소를 네트워크 장애로 오분류할 뻔했으나(리뷰 W1/2 조치 완료), 최종 코드는 `upstream?.aborted` 로 로컬 timeout 과 상위 cancellation 을 구분해 재throw 한다 — §5.1 이 기록한 "cancelled 는 실패가 아니다" invariant 를 우회하지 않고 오히려 강화. 위반 없음.
  - 제안: 없음(정합 확인 목적의 기록).

- **[INFO]** §4 예시 코드 리스너 누수 정정 — spec 예시를 되돌리지 않고 SPEC-DRIFT 경로로 위임
  - target 위치: `spec/conventions/node-cancellation.md §4`(cascade 예시, 미변경) vs 실제 구현(cafe24/makeshop client, `finally` 기반 cleanup)
  - 과거 결정 출처: 없음 — §4 예시 자체가 최근까지 미검증 상태였고, 이번 리뷰가 처음으로 결함(성공 경로에서 `controller.signal` abort 이벤트가 발화하지 않아 리스너 영구 잔존 + 재시도 재귀 시 누적)을 실측·mutation 으로 확인
  - 상세: 관점 3 기준으로 보면 "과거 결정(§4 예시)을 뒤집는" 상황이지만, 이번 PR 은 spec 문서를 직접 고치지 않고 **코드만 올바른 패턴으로 구현**한 뒤 spec 갱신은 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #2" 에 위임했다 — CLAUDE.md 의 developer `spec/` read-only 경계, SPEC-DRIFT 정식 경로를 그대로 따른다. `http-request.handler.ts` 의 동일 선재 누수도 되돌리지 않고 후속으로 명시했다.
  - 제안: 없음. planner 가 §4 예시를 위임안대로 교체하고 "cleanup 의무는 fetch API 가 보장" 문장을 정정하면 종결.

## 요약

이번 diff(cafe24/makeshop 노드의 `context.abortSignal` cascade 배선)는 `node-cancellation.md`
§4/§5.1 이 정의한 기존 계약(cascade 패턴, `AbortError`→`cancelled` 분류, cancelled 를 네트워크
장애로 오집계하지 않을 것)을 위반하지 않고 오히려 §5.1 invariant 를 정확히 재현했다. 유일하게
Rationale 연속성 관점에서 긴장이 있는 지점 — SIGTERM/workflow-timeout abort 를 `failed`(기존,
`execution-engine §11`/`data-flow/3-execution.md`/`1-data-model.md` 교차 확정)로 유지할지
`cancelled`(§5.1 일반 규칙)로 통일할지 — 는 이번 PR 이 실제로 구현하지 않았고, 결정을
`project-planner` 에 명시적으로 위임하면서 두 대안 각각의 동반 spec 갱신 대상을 미리 열거해뒀다.
기각된 대안의 무단 재도입, 합의 원칙의 조용한 위반, 무근거 결정 번복 사례는 발견되지 않았다.
프롬프트 페이로드가 컨텍스트 예산 초과로 `node-cancellation.md` 본문을 생략했던 점은 워크트리
절대경로 직접 열람으로 보완했다.

## 위험도
LOW
