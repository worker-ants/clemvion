# 요구사항(Requirement) 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — Fix 1: error-port 라우팅 처리
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — Fix 1 테스트 3종
- `codebase/backend/src/modules/integrations/integrations.service.ts` — Fix 2: email SMTP verify
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — Fix 2 테스트 3종
- `plan/in-progress/fix-mail-send-status.md` — plan 문서

---

## 발견사항

### [INFO] spec §5.5 "NOOP" vs 구현 `verify()`
- 위치: `spec/2-navigation/4-integration.md` §5.5 line 485 / `integrations.service.ts` `testEmailTransport`
- 상세: spec §5.5는 "테스트: SMTP 핸드셰이크 + `NOOP` 명령. 실제 메일은 전송하지 않음."으로 기술한다. 구현은 `nodemailer.transporter.verify()`를 사용하는데, `verify()`는 내부적으로 SMTP 연결+인증+EHLO를 수행하지만 `NOOP` 명령을 명시적으로 발행하지는 않는다. 기능적으로는 동등하거나 더 광범위한 검증이므로 회귀를 유발하지는 않으나, spec의 "NOOP" 표현은 구현과 정확히 일치하지 않는다.
- 제안: spec에서 "`NOOP` 명령" 을 "`verify()` (연결+인증)" 로 갱신하거나, 구현에서 `verify()` 후 NOOP를 명시적으로 발행. 단 기능적으로 차이는 없으므로 낮은 우선순위. project-planner에 위임 가능.

### [INFO] spec §5.5 test 기술이 `testConnection`에만 적용되는지 `previewTest`에도 적용되는지 모호
- 위치: `spec/2-navigation/4-integration.md` §5.5 line 485
- 상세: spec §5.5 "테스트: SMTP 핸드셰이크 + `NOOP` 명령"이 `testConnection`(저장된 통합 테스트)만을 지칭하는지, 또는 등록 전 `previewTest`(`POST /api/integrations/preview-test`)에도 적용되는지 spec에서 명시하지 않는다. 구현 상 `previewTest → dispatchTest → testEmailTransport`가 실제 SMTP 연결을 수행하므로 등록 전에도 외부 네트워크 호출이 발생한다. 이는 Cafe24를 기술한 §9 line 608의 "사전 검증: 구조적 유효성만 검증하며, 외부 네트워크 호출은 수행하지 않는다"와 비교했을 때 Cafe24 전용 맥락으로 해석된다(OAuth 토큰이 이미 교환된 후라 재호출 불필요하다는 근거 명시). email의 경우 등록 전 실제 SMTP 연결은 오히려 올바른 사전 검증으로 보이나, spec에서 email 항목에 명시되지 않아 gray area이다.
- 제안: spec §5.5에 "테스트(`testConnection` 및 `previewTest` 공통): SMTP 핸드셰이크 + 인증 검증" 형태로 명확히 기술하도록 project-planner에 위임.

### [WARNING] `outgoingEdgeMap` 미전달 시 error-port 폴백 판정 건너뜀 — ForEach/Loop 컨테이너 내 노드
- 위치: `execution-engine.service.ts` line 4560-4565 / containers
- 상세: `executeNode`의 `outgoingEdgeMap` 파라미터는 optional이며, "미전달 시 노드 FAILED 만 반영하고 Execution은 계속"이라고 주석에 명시된다. ForEach/Loop 컨테이너는 `executeNode`를 직접 호출하지 않고 메인 루프 재진입 패턴을 사용하므로 문제가 없다. 그러나 이 옵셔널 계약은 향후 신규 호출자가 `outgoingEdgeMap`을 누락할 경우 error-port 노드가 Execution을 계속 진행시키는 동작(폴백 없음)을 야기한다. 현재 5개 호출부 모두 `outgoingEdgeMap`을 전달하므로 즉각적 버그는 없다.
- 제안: 파라미터를 optional에서 required로 변경하고 컨테이너 executors가 별도 `outgoingEdgeMap`을 구성하여 전달하도록 강제하면 더 안전하다. 단 현재 구현에서는 문제가 없으므로 후속 PR 고려 사항.

### [INFO] `nodeOutputCache`에 error-port finalOutput(`_selectedPort: 'error'` 포함)이 저장됨 — 다운스트림 표현식 참조 시 `_selectedPort` 노출 가능
- 위치: `execution-engine.service.ts` line 4500 (`this.contextService.setNodeOutput(executionId, node.id, finalOutput)`) / spec §3.2 "다운스트림 노드는 `$node["X"].output.error?.code`로 분기"
- 상세: `finalOutput`은 `_selectedPort: 'error'`를 포함한 채 `nodeOutputCache`에 저장된다. spec §3.2는 다운스트림이 `$node["X"].output.error?.code`를 참조한다고 명시하며, `_selectedPort`는 라우팅 전용 내부 메타데이터로 downstream strip 정책이 있다(engine spec §4.3 "엣지 전달 시 자동 제거"). 현재 구현에서는 엣지를 통해 다음 노드로 전달될 때 `_selectedPort`가 strip되므로 기능적 문제는 없다. 그러나 `nodeOutputCache`에는 strip 전 값이 남아 있어 표현식에서 `$node["X"]._selectedPort`로 직접 접근 시 내부 메타데이터가 노출될 수 있다. 이는 기존 동작으로 이번 변경이 새로 도입한 것은 아니다.
- 제안: 해당 동작 자체는 기존 코드베이스 전반의 패턴이므로 본 PR 범위 밖이나, spec §3.2에 "캐시에 저장된 값의 `_selectedPort`는 표현식 참조 가능하나 미정의 동작" 경고를 추가하는 것을 검토.

### [INFO] 테스트에서 `errHandler()` 팩토리가 매 호출 시 새 mock 인스턴스를 생성 — 두 번째 describe에서 동일 인스턴스 미공유
- 위치: `execution-engine.service.spec.ts` line 42-50 (`errHandler()` 팩토리 함수)
- 상세: `errHandler()`가 describe block 상단에 팩토리로 정의되어 테스트마다 `handlerRegistry.register('err_node', errHandler())`로 다른 mock 인스턴스가 등록된다. 첫 번째 테스트(`it('marks the node FAILED...')`), 두 번째 테스트(`it('stops the workflow...')`)가 각자 독립 인스턴스를 사용하므로 execute spy 호출 검증을 크로스-테스트 할 수 없다. 이는 의도된 설계이나, 두 테스트에서 execute 호출을 별도로 verify하지 않아 "정말 핸들러가 호출됐나"에 대한 어썰션이 없다. 기능 검증은 side-effect(NodeExecution save, event emit)로 충분히 커버된다.
- 제안: 낮은 우선순위. 현재 구조는 기능적으로 충분하다.

### [INFO] `testEmailTransport`가 실패해도 `transporter.close()`가 finally에서 호출되는지 테스트 검증 범위 확인
- 위치: `integrations.service.spec.ts` line 2037 (`expect(close).toHaveBeenCalled()`)
- 상세: 실패 시 close 호출을 검증하는 테스트(`it('returns failure with EMAIL_CONNECT_FAILED when verify() rejects...')`에서 `expect(close).toHaveBeenCalled()`가 있다. 구현의 `finally` 블록도 올바르다. 검증 완료.

---

## 기능 완전성 평가

### Fix 1 (엔진 error-port 처리)

spec/5-system/3-error-handling.md §3.2 의 동작 규칙 세 가지가 구현에 반영됐는지:

1. "NodeExecution.status는 `failed`로 기록하되, Execution은 계속 진행" → **구현됨.** `nodeExecution.status = NodeExecutionStatus.FAILED` + `errorPortFallbackMessage`가 null인 경우(error 포트 연결됨) Execution 계속.
2. "error 포트에 엣지가 연결되어 있으면 → `output.error`를 포함한 `output` 전체를 해당 엣지로 전달, 다음 노드 실행" → **구현됨.** `nodeOutputCache`에 finalOutput(error payload 포함)이 저장되고 그래프 순회가 error 포트 엣지를 통해 계속된다.
3. "error 포트에 엣지가 없으면 → `ERROR_PORT_FALLBACK` 에러 로깅 후 Stop Workflow 폴백" → **구현됨.** `ErrorPortFallbackError`를 throw하여 top-level catch가 `Execution.status=FAILED`, `error.code='ERROR_PORT_FALLBACK'`으로 처리.

spec §1.4의 `ERROR_PORT_FALLBACK` 코드 보존(Execution.error.code) → **구현됨.** `savedExecution.error` 패치에서 `error.code` 전파.

### Fix 2 (email SMTP verify)

plan에 명시된 요구사항:
- `transportTesters`에 `email` 등록 → **구현됨.**
- `nodemailer verify()`로 접속+인증 검증 → **구현됨.**
- 실패 시 `EMAIL_CONNECT_FAILED` → **구현됨.**
- preview-test/testConnection/rotate 공통 → **구현됨.** `dispatchTest`를 공통으로 사용.
- unit test 3종(verify resolve→success / reject→fail / 구조검증 우선) → **구현됨.**

### 엣지 케이스 처리

- `output.error.code`가 없는 경우(메시지만 있음): `errorCode = undefined`로 처리, `NodeExecution.error.code`에 key 자체가 없음. 정상.
- `output.error.message`가 없는 경우: fallback 값 `'Node routed to error port'` 사용. 정상.
- `outgoingEdgeMap`이 undefined인 경우: error-port 판정 skip, 노드는 FAILED로 마킹. 동작 정의 있음.
- `secure` 값이 `'none'`인 경우: `secure=false`, `requireTLS=false`. 즉 일반 평문 SMTP 연결. 정상.
- `password` 누락 시: `validateCredentials`가 먼저 걸러 `createTransport` 호출 없음. 테스트로 검증됨.

### TODO/FIXME

변경된 코드 내에서 TODO, FIXME, HACK, XXX 주석은 없음. "후속(선택, 본 PR 범위 밖)" 항목은 plan 문서에 명시적으로 기록되어 있으며 코드 주석이 아니다.

---

## 요약

Fix 1(엔진 error-port 처리)과 Fix 2(email SMTP verify)는 모두 의도한 기능을 완전히 구현한다. spec/5-system/3-error-handling.md §3.2의 세 가지 동작 규칙(NodeExecution FAILED 마킹, error 엣지 연결 시 다운스트림 계속, 미연결 시 ERROR_PORT_FALLBACK + Stop Workflow)이 코드에 line-level로 반영됐으며, email SMTP transport tester도 올바르게 등록됐다. 발견된 INFO 항목 중 "NOOP vs verify()" spec 불일치는 기능적 차이가 없는 명세 갱신 대상이고, 가장 중요한 spec fidelity 쟁점인 "preview-test의 외부 네트워크 호출 금지" 조항은 Cafe24 전용 맥락임이 확인되어 email 구현에는 해당하지 않는다. WARNING 한 건(outgoingEdgeMap 옵셔널 계약의 미래 호출자 위험)은 현재 5개 호출부가 모두 전달하므로 즉각적 결함이 아니다.

---

## 위험도

LOW
