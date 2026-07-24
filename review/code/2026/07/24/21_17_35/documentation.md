# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `RESOLUTION.md` §C1 의 "기전(mechanism)" 설명이 인용한 소스 위치가 실제로는
  적용되지 않는 다른 경로의 가드를 가리킨다 (사실관계 오류 가능성)
  - 위치: `review/code/2026/07/24/20_36_21/RESOLUTION.md:36-41` (특히 38행 —
    ``execution-engine.service.ts:313` 이 그 계약을 명시한다`)
  - 상세: RESOLUTION 은 requirement reviewer 의 CRITICAL(선형 dispatch 경로에서 하류 노드가
    cancel 과 무관하게 dispatch 돼 `completed` 로 끝날 것)을 "실측으로 반증"하며, 그 근거로
    "노드 완료 영속이 무조건 저장이 아니라 **guarded UPDATE**"이고 그 SoT 가
    `execution-engine.service.ts:313` 이라고 적었다. 그러나 해당 라인을 직접 `Read` 로 확인한
    결과, `:307-320` 의 `ResumeClaimExecTerminalError` 클래스는 그 자체 JSDoc 에
    "§7.5 **재개 진입 원자 claim**(06 C-2) 내부 sentinel" 이라고 명시돼 있어, WAITING_FOR_INPUT
    이후 **resume** 경로에서만 쓰이는 가드다. 이번 e2e 시나리오(`manual_trigger → code → code`,
    resume/waiting-for-input 전혀 없음)에는 이 코드가 실행되지 않는다.
    반대로 이 시나리오가 실제로 지나가는 **일반 노드 완료 저장** 지점(`execution-engine.service.ts:5645-5651`,
    `nodeExecution.status = NodeExecutionStatus.COMPLETED; ... await this.nodeExecutionRepository.save(nodeExecution);`)은
    `affected` 체크나 Execution 상태 확인 없이 무조건 저장이다(직접 확인). 또한 메인 dispatch
    루프(`:4251-4454`, `while (pointer < sortedNodeIds.length)`)도 매 반복 `assertActiveTimeWithinLimit(savedExecution)`
    (시간 한도 전용, in-memory 객체 사용)만 부를 뿐 Execution 의 최신 DB 상태를 재조회하지
    않는다(직접 확인, `findOneBy`/`reload` 호출 없음). "guarded UPDATE" 패턴 자체는 실재하지만
    (`:4457-4476`, `:2242-2260` 의 **Execution 레벨** 최종 상태 전이에만 적용 — 이는 실행 전체가
    끝난 뒤 1회 발생), 그것이 하류 개별 노드(B)의 dispatch/저장 자체를 막는다는 근거는 되지
    못한다. 즉 requirement reviewer 가 원래 지적한 "노드 완료는 무조건 저장" 이라는 관찰이
    직접 확인상 더 정확해 보이고, RESOLUTION 이 인용한 특정 라인(`:313`)은 이 시나리오에
    적용되지 않는 별개 메커니즘(resume claim)이다.
  - 이것이 documentation 관점의 발견인 이유: 실측(e2e 3회 PASS + 대조군)이라는 **경험적 사실**
    자체를 반박하는 것이 아니다 — 그 결과는 이 리뷰에서 재실행 검증하지 않았다. 다만 "왜
    통과하는가"를 설명하는 **서술된 근거(인용 라인)** 가 직접 소스 대조로 지지되지 않으므로,
    향후 이 CRITICAL 이 "이미 조사·반증됨"으로 신뢰되어 재조사 없이 넘어갈 위험이 있다 —
    이 저장소가 반복적으로 경고해 온 "확신 주석이 반증되면 물러서라" 클래스와 같은 패턴이다.
  - 제안: RESOLUTION 의 §C1 "기전" 문단을 재검토해 실제로 하류 노드 dispatch 를 막는 메커니즘이
    무엇인지(예: BullMQ 큐 재진입 시 별도 상태 체크, 혹은 requirement reviewer 가 놓친 다른
    경로) 직접 코드로 재확인하거나, 확인이 어렵다면 "기전은 미확인이며 경험적 관찰만 근거"라고
    정정할 것. 인용 라인은 `execution-engine.service.ts:313`(resume claim 전용) 대신 실제 근거
    라인으로 교체하거나 제거.

- **[INFO]** (확인됨, 문제 아님) 이전 라운드(20_36_21) WARNING 5 — 인라인 주석 수치 불일치
  ("창(8s)" vs `INFLIGHT_WINDOW_MS=5_000`) — 가 이번 라운드에서 정확히 수정됨
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:271`
    (`// A 의 완주를 기다리므로 INFLIGHT_WINDOW_MS + 여유를 준다.`)
  - 상세: 하드코딩된 "8s" 문구 대신 상수명을 직접 참조하도록 바뀌어, 향후 값이 바뀌어도 주석이
    자동으로 정확해진다(제안대로 적용됨). JSDoc(파일 47~56행)의 5초 근거 설명과도 일치.

- **[INFO]** (확인됨, 문제 아님) 이전 라운드 W1 — plan 이동이 남긴 dangling 상대경로 링크 3곳 —
  이번 라운드에서 정확히 수정됨
  - 위치: `plan/complete/node-cancellation-infrastructure.md:70,83,90`
  - 상세: `../in-progress/node-cancellation-inflight-followups.md` → same-dir
    `node-cancellation-inflight-followups.md` 로 3곳 모두 정정됐고, 대상 파일이 실제로
    `plan/complete/node-cancellation-inflight-followups.md` 에 존재함을 확인. 링크 깨짐 0.

- **[INFO]** (확인됨, 문제 아님) 이전 라운드 W2 파생 — spec `status: implemented` 승격과 §6
  잔여 미구현 항목의 라벨/본문 불일치 — 신규 plan 신설 + 추적 포인터 갱신으로 정합화됨
  - 위치: `spec/conventions/node-cancellation.md:13`(`pending_plans`), `:44`(§4 AI 표),
    `:123`(§6 legend), `:138-139`(§6 MakeShop/Cafe24 행)
  - 상세: `pending_plans` 가 `node-cancellation-residual-signal-propagation.md` 로 재충전되어
    `status: partial` 이 유지되고(직접 확인), §4/§6 의 4곳 모두 이미 `plan/complete/` 로 이동해
    닫힌 `node-cancellation-infrastructure.md` 대신 신규 잔여 plan 을 가리키도록 갱신됨.
    저장소 전체에서 `node-cancellation-infrastructure.md`/구 `node-cancellation-inflight-followups.md`
    를 추적처로 인용하는 남은 참조가 없음을 grep 으로 확인 — 죽은 포인터 0.

- **[INFO]** 헬퍼 함수 문서화 수준이 파일 내에서 여전히 일관되지 않음 (이전 라운드 지적, 미변경)
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` 의 `execute()`,
    `getStatus()` 함수 (`nodeStatus()` 만 한 줄 JSDoc 보유)
  - 상세: 크리티컬하지 않은 기존 지적이 그대로 남아 있음. 이번 라운드의 새 변경(W3/W4/W5 fix)
    범위 밖.
  - 제안: 우선순위 낮음, 일관성 원하면 한 줄씩 추가.

## 요약

이번 라운드는 직전 리뷰(20_36_21)의 documentation/maintainability/scope WARNING 들
(인라인 주석 수치 오류, plan 이동 dangling 링크, spec 잔여 추적 plan 부재)을 모두 정확하게
수정했다 — 세 항목 모두 직접 소스 대조로 재확인했고 잔존 결함이 없다. 신규 e2e 파일의 모듈
상단 JSDoc·인라인 주석은 여전히 근거(관련 소스 라인·plan)를 동반한 높은 품질을 유지한다.
다만 이번 라운드가 새로 추가한 `RESOLUTION.md` §C1 은 requirement reviewer 의 CRITICAL 을
"실측으로 반증"한다고 서술하면서 그 인과 메커니즘으로 인용한 소스 라인
(`execution-engine.service.ts:313`)이 직접 대조 결과 **다른 경로(resume-entry 전용 가드,
§7.5)** 를 가리키고 있어, 이 e2e 시나리오(단순 선형, resume 없음)에는 적용되지 않는다. 실제로
이 시나리오가 지나가는 일반 노드 완료 저장(`:5645-5651`)은 무조건 저장이고 dispatch 루프도
노드 사이 Execution 상태를 재조회하지 않음을 직접 확인했다 — 즉 requirement reviewer 의 원래
관찰이 더 정확해 보인다. e2e 실측 결과(3회 PASS + 대조군) 자체를 반박하는 것은 아니지만, "왜
통과하는가"에 대한 **서술된 근거**가 소스와 어긋나므로 이 CRITICAL 이 실제로 해소됐다고 안심하기
전에 기전을 재확인할 필요가 있다. README/API 문서/CHANGELOG/환경변수 문서 갱신이 필요한 표면
변경은 없다(신규 e2e 는 자동 discovery 대상, `E2E_BASE_URL` 은 기존 패턴 재사용).

## 위험도

MEDIUM
