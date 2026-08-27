STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `system_error` 배너 라이브 WS 경로 복구 (5라운드, 02_39_10)

## 검증 방법

이 diff(`origin/main`→`HEAD`, 48개 파일)는 실질적으로 4개 이전 리뷰 라운드
(`01_26_11`→`01_44_22`→`02_02_18`→`02_21_19`)의 산출물(누적 WARNING 0/CRITICAL 0로 수렴)과
그 라운드들이 이미 반영한 최종 코드 상태를 포함한다. 이번 라운드는 최종 상태를
독립적으로 재검증했다:

- 실제 소스 3파일을 직접 `Read` — `use-execution-events.ts`(1~140, 760~980행),
  `use-execution-events.test.ts`(1964~2430행 부근), `plan/in-progress/system-error-banner-live-ws.md`,
  `CHANGELOG.md`(1~25행)
- 관련 spec 을 직접 대조 — `spec/5-system/6-websocket-protocol.md` §4.1-a(239~262행),
  `spec/conventions/node-output.md` Principle 0(20~50행), `spec/conventions/conversation-thread.md`
  §9.10 CT-S9/S10/S15(670~677행)
- 백엔드 emit 4곳을 직접 열어 대조 — `execution-engine.service.ts:6284-6307`(pre-flight,
  `output` 키 없음), `:6339-6386`(`finalizeErrorPortNode`, `error` 문자열 + `output: nodeExecution.outputData`
  래퍼), `:7982-8024`(container 실패, `output` 키 없음), `ai-turn-orchestrator.service.ts:1449-1543`
  (AI turn FAILED, `error` 문자열 + `output: nodeExec.outputData` 래퍼, 백엔드 자신도
  `nodeExec.outputData?.output?.error` 로 읽음)
- `pnpm vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 직접 실행 —
  **92/92 GREEN** (plan 문서의 "86→92" 주장과 일치)
- `pnpm exec tsc --noEmit` 직접 실행 — **클린**(exit 0)
- `.bak` 등 잔여 파일 유무 확인 — 없음

## 발견사항

- **[INFO]** `errorPayload.details` 캐스트가 배열을 배제하지 않는다 (`asRecord` 와 비대칭)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` 함수
    `extractNodeErrorPayload` 내 `details` 산출 라인(`source.details && typeof source.details === "object" ? ... : undefined`)
  - 상세: 같은 함수가 쓰는 `asRecord`(51-56행 정의)는 명시적으로 `!Array.isArray(v)` 로
    배열을 배제하는데, 바로 아래 `details` 캐스트는 `typeof === "object"` 만 검사해
    배열도 통과시킨다. 실질 영향은 없다 — 소비부(`makeSystemErrorItem` 직전)가
    `typeof errorPayload.details?.retryable === "boolean"` 식으로 named-property 접근만
    하므로 배열이 오더라도 `undefined`로 안전히 떨어진다. 또한 백엔드 타입상 `details`
    는 항상 object literal(`{code, message, details}`)이라 배열이 실릴 wire 경로가 없다
    (emit 4곳 실측 재확인 완료). 기능 결함은 아니고, 같은 파일의 `asRecord` 배열-배제
    원칙과의 근소한 비대칭일 뿐이다.
  - 제안: 조치 불요. 여유가 있으면 `!Array.isArray(source.details)` 를 조건에 추가해
    같은 원칙을 함수 전체에 일관 적용할 수 있다.

- **[INFO]** `handleNodeCompleted` 분기(`port:'error'`+`node.completed`)의 production
  도달 가능성 — 재확인 결과 여전히 100% 확증 안 됨 (4라운드 연속 carry-over, 신규 결함
  아님)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813-835`
    (`handleNodeCompleted` 의 `extractNodeErrorPayload(payload.output)` 호출)
  - 상세: 이번 라운드에서 백엔드 `execution-engine.service.ts:6085`
    (`if (!isBlocking && this.isErrorPortRouted(finalOutput))`)를 직접 열어 대조한 결과,
    `_selectedPort === 'error'` 로 라우팅된 노드는 **항상** `finalizeErrorPortNode` 를 거쳐
    `NODE_FAILED` 로 emit 되고(`:6372`), `NODE_COMPLETED` 경로로는 가지 않는다. AI turn
    오케스트레이터의 `NODE_COMPLETED` emit(`:1625`, `isFailed`가 아닐 때만 도달)도 정상
    종결 경로라 도메인 `output.error` 가 실릴 것으로 기대되지 않는다. 즉 이 프런트 분기가
    실제 backend 이벤트로 도달하는 구체 경로를 이번 조사에서도 찾지 못했다 — 다만 이는
    diff 밖(백엔드 미변경) 별건 조사이고, 이 PR 이 그 경로를 **고쳤을 뿐**(공유 헬퍼를
    통해 자동으로 정정됨, `02_02_18`/`02_21_19` 뮤테이션이 RED 로 확인) 새로 만든 것은
    아니다. 회귀도 신규 결함도 아니다.
  - 제안: 조치 불요. 도달성 자체를 확정하려면 별도 백엔드 조사(planner 턴)가 필요하며
    이 결함(`12_24_55`)과 직교하다.

## 핵심 요구사항 충족 재확인

- **버그 수정 정확성**: `extractNodeErrorPayload(rawOutput)` 이 `asRecord(rawOutput)?.output`
  → `asRecord(domain)?.error` 로 래퍼를 정확히 한 겹 통과하고, `handleNodeFailed`/
  `handleNodeCompleted` 양쪽 호출부 모두 `payload.output` 을 실제로 전달한다
  (`use-execution-events.ts:89-90, 813, 909`). `direct`(객체 `rawError`) 분기와 그 파라미터는
  삭제되어 시그니처가 `extractNodeErrorPayload(rawOutput)` 단일 인자로 좁혀졌다 — 이 결함을
  낳았던 계약을 코드에서 완전히 제거했다.
- **spec 일치 (line-level)**: `6-websocket-protocol.md` §4.1-a(239-262행)의 "`error` 는
  문자열", "구조화 객체는 `output.output.error`", "`output` 은 2경로만 동봉" 서술과
  `node-output.md` Principle 0(20-50행)의 "wire `output` = 래퍼 전체, 도메인 값은 한 겹
  아래" 서술이 코드 주석·구현과 정확히 일치. 백엔드 emit 4곳 실측(코드 직접 열람)도
  spec 서술과 일치 — spec 결함 없음, SPEC-DRIFT 아님(spec 이 이미 옳고 코드가 그것을
  뒤늦게 따라잡은 정상 케이스).
- **엣지 케이스**: `code`/`message` 각각 단독 부재(`||` 양쪽 discriminating fixture,
  `02_21_19` W1 로 분리됨), `details` 키 부재, `output` 배열/undefined/null, single-turn
  (이전 대화 없음) 양쪽 핸들러 대칭 케이스까지 각각 전용 테스트로 고정됨. 뮤테이션
  실측으로 각 가드가 공허하지 않음을 여러 라운드에 걸쳐 확인.
- **반환값**: `extractNodeErrorPayload` 는 모든 경로(래퍼 아님/도메인 아님/에러 없음/
  code·message 부재)에서 `null` 을 명시적으로 반환하고, 유효 시에만 완전한 객체를
  반환 — 부분 객체나 `undefined` 를 암묵 반환하는 경로 없음.
- **TODO/FIXME/HACK/XXX**: diff 대상 파일에 없음.
- **CHANGELOG/plan 문서 정확성**: `CHANGELOG.md` Unreleased 항목이 결함 원인·운영 영향
  ("처음 노출, 회귀 아님")을 정확히 서술하며 실제 코드 상태와 불일치 없음. plan 체크리스트의
  테스트 개수("86→92")가 실측(92/92)과 일치.

## 요약

라이브 WS 경로에서 `system_error` 재시도 배너가 한 번도 뜨지 않던 CRITICAL 결함과 그 원인
(정정 전 spec 문구를 그대로 믿은 얕은 unwrap + `handleNodeFailed` 의 `undefined` 인자 배선
누락)이 정확히 식별·수정됐다. 이번 5라운드에서 최종 코드 상태를 독립적으로 재검증한 결과
— 소스 직접 열람, 백엔드 emit 4곳 실측 재대조, spec 3개 절 line-level 대조, 테스트 스위트
직접 실행(92/92 GREEN), `tsc --noEmit` 클린 — 기능·spec 정합·엣지 케이스·에러 시나리오
모두 요구사항을 충족한다. 4개 이전 라운드가 지적한 CRITICAL/WARNING 은 전부 반영되어 있고
이번 라운드에서 새로 발견한 CRITICAL/WARNING 은 없다. 남은 두 건은 모두 INFO — (1) `details`
캐스트가 `asRecord` 의 배열-배제 원칙과 근소하게 비대칭이나 실질 영향 없음, (2)
`handleNodeCompleted` 분기의 production 도달성이 diff 밖 백엔드 조사 없이는 100% 확증되지
않으나 회귀·신규 결함이 아니며 이 PR 이 오히려 그 경로를 고쳤다.

## 위험도

NONE
