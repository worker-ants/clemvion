# Rationale 연속성 검토

## 검토 대상 확인 경위

prompt payload 는 컨텍스트 예산 초과로 `spec/conventions/node-cancellation.md`(본 diff 의 핵심
대상) 자체가 생략 목록(256개)에 포함돼 있었다. 이 문서는 diff·plan 을 근거로 관련성이 명백해
워크트리 절대경로로 직접 열어 확인했다(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-signal-b4d1/spec/conventions/node-cancellation.md`,
`spec/5-system/4-execution-engine.md §11 + Rationale`, `spec/conventions/execution-context.md`).
실제 diff(`git diff origin/main`)는 `spec/conventions/*.md` 를 전혀 건드리지 않고, 코드
(`cafe24-api.client.ts`/`cafe24.handler.ts`/`makeshop-api.client.ts`/`makeshop.handler.ts`)와
`plan/in-progress/*` 2건만 변경한다.

본 라운드(22_28_51)는 동일 PR 에 대한 재검토다. 직전 라운드(`review/consistency/2026/07/25/21_58_52`)
가 지적한 Critical(handler 가 client 의 재throw `AbortError` 를 다시 삼켜 §5.1 `cancelled` 분류에
도달 못함)은 이후 커밋(`0cfd547a8` "handler 가 AbortError 를 삼켜 cancelled 분류에 도달하지
못하던 문제")으로 해소됐고, 관련 plan/RESOLUTION 문서(`f575671fc`, `3b075dd5c`)도 이미 커밋됐다.
현재 워킹트리 HEAD 는 이 수정을 모두 포함한 상태다(`cafe24.handler.ts`/`makeshop.handler.ts`
inner+outer catch 에 `if (err instanceof Error && err.name === 'AbortError') throw err;` 가드
확인함).

## 발견사항

- **[INFO]** SIGTERM/workflow-timeout abort 의 `failed` vs `cancelled` 분류 충돌 — 여전히 적절히 격리·위임된 상태 유지
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` 잔여 항목 4번째(`⛔ BLOCKED`) · `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 전체
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §11-4`("미완료 시 … `failed` + `error.code='SERVER_INTERRUPTED'`", 기 구현·기 테스트 완료 계약, `ShutdownStateService`) — 단 이 절 자체에는 "왜 `cancelled` 가 아니라 `failed` 인가" 를 명시한 별도 `## Rationale` 서브섹션은 없음(§11 은 계약을 본문에 직접 기술).
  - 상세: `node-cancellation.md §5.1`(`AbortError` → `cancelled`)을 문면 그대로 SIGTERM/workflow-timeout 경로에 적용하면 이미 구현된 `failed`+`SERVER_INTERRUPTED` bulk UPDATE 와 같은 row 를 두고 경합해 **결정 번복**이 될 뻔했다. 이번 PR 은 이 배선을 구현하지 않고 잔여 항목을 `⛔ BLOCKED — project-planner 결정 대기`로 명시적으로 분리했으며, 별도 plan 에 두 대안((a) 기존 `failed` 유지 / (b) `cancelled` 로 재정의 + `execution-engine.md`·`1-data-model.md`·`data-flow/3-execution.md`·`shutdown-state.service.spec.ts` 동반 갱신)을 택일 항목으로 올려 `developer` 권한 밖임을 명시했다. 이 상태는 직전 라운드 이후 변경되지 않았다 — 검토 관점 3("결정의 무근거 번복")을 정확히 회피 중.
  - 제안: 조치 불요(이미 올바르게 처리됨, 신규 커밋에서도 유지됨). planner 가 (a)/(b) 중 하나를 택할 때 `execution-engine.md §11`(Rationale 서브섹션 신설 포함)·`data-flow/3-execution.md` 상태 다이어그램·`1-data-model.md` 에러코드 표를 동반 갱신하도록 재확인.

- **[INFO]** cafe24/makeshop cascade 최종 구현이 §5.1 "cancelled ≠ failed" invariant 를 위반 없이 준수, 인용된 선례도 실사 확인됨
  - target 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`, `.../cafe24.handler.ts`, `.../makeshop/makeshop-api.client.ts`, `.../makeshop.handler.ts` (diff)
  - 과거 결정 출처: `spec/conventions/node-cancellation.md §5.1` + §2.1 표의 `database-query.handler.ts` 선례
  - 상세: 코드 주석이 반복 인용하는 "Same shape as `database-query.handler.ts`" 를 `database-query.handler.ts:320` 에서 직접 확인 — `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 가 D4 매핑 이전에 실제로 존재한다(지어낸 선례 아님). 최초 구현(1차 리뷰 이전)은 `AbortError` 를 `recordNetworkFailure` + `*TransportFailedError` 로 감싸 취소를 네트워크 장애로 오분류할 뻔했고, 이어 handler 계층에서 다시 삼켜졌으나(직전 라운드 Critical) 이번 라운드 확인 시점엔 client+handler 양쪽 모두 재throw 가드가 존재해 §5.1 invariant 가 실제로 엔드투엔드 성립한다.
  - 제안: 없음(정합 확인 기록).

- **[INFO]** §4 예시 코드 리스너 누수 정정 — spec 예시 미변경 상태 지속, SPEC-DRIFT 위임 경로 유지
  - target 위치: `spec/conventions/node-cancellation.md §4`(cascade 예시, 여전히 미변경) vs 실제 구현(cafe24/makeshop client, `finally` 기반 cleanup)
  - 과거 결정 출처: 없음(§4 예시 자체가 이번 리뷰 사이클에서 처음 결함이 실측·mutation 으로 확인된 사례)
  - 상세: §4 예시는 여전히 "cleanup 의무는 fetch API 가 보장"이라는, 이제는 반증된 문장을 담고 있다. 그러나 이번 PR 은 spec 문서를 직접 고치지 않고 코드만 올바른 패턴(`finally` 기반)으로 구현했으며, spec 갱신은 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #2"에 위임돼 있다 — `developer` 의 `spec/` read-only 경계, SPEC-DRIFT 정식 경로를 그대로 따른다. 이번 라운드 신규 커밋(`f575671fc`)이 추가한 "추가 위임 #3"(기존 ✓ 행 `http-request`/`text-classifier` 도 §5.1 propagate 미검증 상태로 재확인 필요)도 같은 위임 문서 안에서 일관되게 관리되고 있다.
  - 제안: 없음. planner 가 §4 예시를 위임안대로 교체하고 문장을 정정하면 종결.

- **[INFO]** 상태 라벨 번복(`implemented → partial`)에 명시적 Rationale 이 동반된 모범 사례
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "왜 spec 이 `partial` 로 되돌아가는가" 절
  - 과거 결정 출처: `spec-status-lifecycle` 가드 규칙 (b)/(c), 2026-06-28/07-24 완료 이동으로 `implemented` 로 승격됐던 이력
  - 상세: 라벨이 `implemented` → `partial` 로 되돌아가는 것은 표면적으로 "결정 번복"처럼 보이지만, 문서가 "되돌림이 아니라 누락됐던 추적을 복원하는 것"이라는 근거를 함께 제공해 관점 3 위반을 피한다. 검토 관점상 문제 없음, 오히려 반대 사례(무근거 번복 방지)의 예시로 기록.
  - 제안: 없음.

## 요약

이번 diff(cafe24/makeshop 노드의 `context.abortSignal` cascade 배선)와 그 위임 plan 들은
`node-cancellation.md` §4/§5.1 이 정의한 기존 계약(cascade 패턴, `AbortError`→`cancelled` 분류,
cancelled 를 네트워크 장애로 오집계하지 않을 것)을 위반하지 않는다. 직전 라운드가 발견한
handler-swallow Critical(코드 정합성 이슈, rationale 관점의 위반이라기보다 §5.1 계약의 미완성
배선)은 이후 커밋으로 해소됐고, 그 해소 과정에서 인용된 선례(`database-query.handler.ts`)도
실사로 진위가 확인됐다(지어낸 이력 아님). 유일하게 긴장이 남은 지점 — SIGTERM/workflow-timeout
abort 를 기존 `failed` 계약으로 유지할지 §5.1 일반 규칙대로 `cancelled` 로 통일할지 — 은 이번
PR 이 실제로 구현하지 않았고, 결정을 `project-planner` 에 명시적으로 위임하면서 두 대안 각각의
동반 spec 갱신 대상을 미리 열거해뒀다. §4 예시의 리스너 누수 정정도 같은 SPEC-DRIFT 위임 경로를
유지 중이다. 기각된 대안의 무단 재도입, 합의 원칙의 조용한 위반, 무근거 결정 번복 사례는
발견되지 않았다.

## 위험도
LOW
