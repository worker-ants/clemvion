# Code Review 통합 보고서

> 대상 커밋: 웹채팅 미리보기 첫 노드 race 해소 — SSE replay(lastEventId) + getStatus 표면 복구 + CORS 분리배포 문서
> 리뷰 일시: 2026-06-25

## 전체 위험도

**MEDIUM** — 데이터베이스 인덱스 누락(node_execution 복합 인덱스)이 운영 부하 증가 시 쿼리 성능 저하로 이어질 수 있음. 그 외 아키텍처·보안·동시성 경고는 중기 리팩터링 과제이며 즉각적 장애 위험은 낮음.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| - | — | 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스 | `node_execution` 테이블에 `(execution_id, status)` 복합 인덱스 미선언. `WHERE execution_id=$1 AND status='waiting_for_input' ORDER BY started_at DESC` 쿼리가 풀스캔으로 실행될 위험. 동시 세션 증가 시 누적 부하 발생 | `interaction.service.ts` — `getStatus()` 내 `nodeExecutionRepository.findOne(...)` / `node-execution.entity.ts` | `node-execution.entity.ts` `@Entity` 데코레이터에 `@Index(['executionId', 'status'])` 또는 커버링 인덱스 `(execution_id, status, started_at)` 를 마이그레이션으로 추가 |
| 2 | 보안 | `getStatus` 응답에 `NodeExecution.outputData` 전체를 `nodeOutput` 으로 클라이언트에 동봉. 향후 실행 엔진이 민감 중간 결과를 동일 컬럼에 기록할 경우 전체 노출 위험 — 현재는 `withInteractionMeta` 관례에 의존하는 암묵적 보안 가정 | `interaction.service.ts` — `getStatus()` 반환 `buttonConfig: { buttons, nodeOutput: out }` 및 `context: { ..., nodeOutput: out }` | `nodeOutput` 에 동봉할 필드를 명시적 pick 으로 제한하거나, `outputData.interactionMeta` 서브키로 분리. 단기: JSDoc 에 "outputData 민감 필드 기록 금지" 제약 명기 |
| 3 | 아키텍처 | `ExternalInteractionModule` 이 `NodeExecution` 엔티티를 직접 `TypeOrmModule.forFeature` 등록 — 소유권이 `NodeExecutionsModule` 에 있어야 하는 엔티티를 외부 모듈이 직접 소유해 모듈 경계 침범. `outputData` 내부 구조에 `InteractionService` 가 직접 의존해 결합도 증가 | `external-interaction.module.ts` L66–71 / `interaction.service.ts` L65–66 | `NodeExecutionsModule` 에 `findWaitingNodeExecution(executionId)` 전용 메서드를 추가하고 간접 접근으로 전환 |
| 4 | 아키텍처 | `getStatus` 내 `outputData` 파싱·context 조립 로직 50줄 이상이 `InteractionService` 에 인라인 — 단일 책임 원칙 위반. 동일 변환 로직이 위젯 `parseWaitingForInput` 에도 이중 존재 | `interaction.service.ts` — `getStatus()` 내 waiting 복원 블록 | `mapNodeExecToWaitingContext(nodeExec)` 순수 함수로 분리 |
| 5 | 동시성 | `seedWaitingFromStatus` dispatch 와 SSE replay dispatch 간 순서 역전 가능성. seq 비교 없이 무조건 dispatch 하므로, 느린 네트워크에서 getStatus 결과가 최신 SSE replay 결과를 덮어쓸 수 있음 | `use-widget.ts` — `seedWaitingFromStatus` 콜백 + start/restore 경로 | reducer 내 `action.seq <= state.seq` guard 추가 또는 `seedWaitingFromStatus` 내 seq 비교 후 조건부 dispatch |
| 6 | 유지보수성 | `getStatus` waiting 복원 블록이 45줄 인라인으로 집중. `it` 변수명이 너무 짧아 의미 파악에 추가 읽기 필요 | `interaction.service.ts` — `getStatus()` WAITING_FOR_INPUT 블록 | `private resolveWaitingContext(nodeExec)` private 메서드로 추출. `it` → `rawInteractionType` 변경 |
| 7 | 유지보수성 | "race fix" 테스트에서 fetchMock 을 `installFetch` 헬퍼 없이 인라인으로 중복 선언 — 동일 파일 내 EventSource stub 3가지 변형 분산 | `use-widget-eager-start.test.ts` — race fix 테스트 케이스 내부 | `installFetch({ statusResponse: {...} })` 확장 또는 `urlCapturingEventSource()` 팩터리 헬퍼 분리 |
| 8 | 부작용 | `openStream` 에 `lastEventId="0"` 하드코딩으로 restore 경로에서 이미 수신한 이벤트가 재전달될 수 있음. widgetReducer 의 seq dedup 처리 여부 확인 필요 | `use-widget.ts` — `openStream(session, "0")` (start·restore 양쪽) | `handleEiaEvent` 가 이미 수신한 seq 이벤트를 중복 처리하지 않는지 seq dedup 로직 존재 여부 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] EIA spec §5.2/§3.5 에 `lastEventId=0` 첫 연결 시 seq≥1 전부 replay 동작이 §5.3 노트 하단에만 언급되고 §5.2(EIA-IN-07) 본문에 미기재 | `spec/5-system/14-external-interaction-api.md` §5.2 | §5.2 SSE replay 절에 "첫 연결 시 `?lastEventId=0` 으로 buffer 내 seq≥1 이벤트 전체 replay" 1줄 보강 |
| 2 | 문서 | `ExternalInteractionModule` JSDoc 의존성 목록에 `NodeExecution` 미갱신 — 주석이 `[Trigger, Execution]` 으로 남아 있음 | `external-interaction.module.ts` JSDoc (L105–120) | JSDoc 의존성 줄을 `[Trigger, Execution, ExecutionToken, NodeExecution]` 로 갱신 |
| 3 | 문서 | `seedWaitingFromStatus` 함수에 독립적 JSDoc 없음. start/restore 양쪽 호출, soft 실패 정책, `parseWaitingForInput` 재사용 근거가 인라인 주석에만 흩어져 있음 | `use-widget.ts` — `seedWaitingFromStatus` useCallback 블록 | JSDoc 블록(`@param client`, `@param session`, 실패 정책, 호출 시점) 추가 |
| 4 | 문서 | plan 파일의 `검증` 항목이 `[~]`(진행 중), `리뷰·PR` 항목이 `[ ]`(미완) 상태로 커밋됨. 커밋 메시지에 `sse-adapter.spec(lastEventId=0)` 테스트 추가 선언이 있으나 실제 파일 변경 없음 | `plan/in-progress/web-chat-preview-eia-race-fix.md` | 검증 완료 후 `status: completed`, 마감 항목 `[x]` 갱신 및 `plan/complete/` 이동. 커밋 메시지·plan 의 미구현 항목 교정 |
| 5 | 문서 | k8s/README CORS 안내 블록에 구조적 소제목 없음. Placeholder 체크리스트 Secret 테이블에 `WEB_CHAT_WIDGET_ORIGINS` 항목 누락 | `k8s/README.md` — CORS blockquote 신규 추가 블록 | `#### 분리 배포 시 CORS 설정` 소제목 추가 또는 Secret 테이블에 항목 보강 |
| 6 | 문서 | spec EIA §5.3 의 `conversationThread` 생략 결정 근거(Rationale) 미기록 | `spec/5-system/14-external-interaction-api.md` §5.3 주석 블록 | §5.3 또는 Rationale 절에 생략 이유 한 단락 추가 |
| 7 | 아키텍처 | `useCallback` 의존성 배열 `[]` 의 의도가 불명확. `[dispatch]` 명시 또는 주석으로 빈 배열의 이유 표기 필요 | `use-widget.ts` L207 `seedWaitingFromStatus` | 주석 `// dispatch is stable(useReducer), parseWaitingForInput/threadToMessages are pure imports` 추가 |
| 8 | 성능 | `executionRepository.findOne` 에 `select` 절 없이 Execution 전체 컬럼 로드. `outputData` 가 대용량 JSON 일 경우 불필요한 전송 | `interaction.service.ts` L214 | `select: ['id', 'workflowId', 'status', 'outputData', 'startedAt', 'finishedAt']` 명시 |
| 9 | 성능 | `relations: ['node']` 로 Node 전체 컬럼을 JOIN 로드. 실제 사용 필드는 `node.type` 하나 | `interaction.service.ts` L236 | `select: { node: { type: true } }` 조합 또는 QueryBuilder 로 `node.type` 만 SELECT |
| 10 | 성능 | start/restore 경로마다 무조건 `getStatus` HTTP 왕복 추가 — 대부분 `running` 상태라 무의미한 왕복이 될 수 있음 | `use-widget.ts` L249, L296 | SSE 연결 후 일정 시간 내 `waiting_for_input` 이벤트 없을 때 lazy fallback 으로 최적화 검토 |
| 11 | 테스트 | `nodeExec` 존재하나 `.node` relation 이 null 인 케이스, `interactionType === 'buttons'` 이지만 `buttonConfig` 누락 케이스, legacy flat `buttonConfig` fallback 경로, `form`/`ai_conversation` 분기, unknown `interactionType` 방어 경로가 미테스트 | `interaction.service.spec.ts` | 각 엣지 케이스별 it 블록 추가 |
| 12 | 테스트 | `seedWaitingFromStatus` soft-fail 케이스, 복원(RESTORED) 경로 getStatus 시드, `subscribe(lastEventId=0)` seq≥1 전부 replay, eia-client `getStatus` 응답 `context`/`currentNode` 필드 검증 미테스트 | `use-widget-eager-start.test.ts`, `sse-adapter.service.spec.ts`, `eia-client.test.ts` | 각 시나리오별 it 블록 추가 |
| 13 | API 계약 | `ExecutionStatusDto.context` 가 `interactionType` 에 따라 다른 필드를 가지나 discriminated union 타입 명세 없음 | `ExecutionStatusDto` — context 필드 타입 정의 | OpenAPI oneOf 스키마 또는 DTO 레벨 union 타입 주석 추가 |
| 14 | 유지보수성 | `seq: 0` 매직 넘버. 주석은 있으나 named constant 로 의도를 코드 자체에 표현하면 더 명확 | `interaction.service.ts` — `getStatus()` 반환부 | `SSE_SEQ_PLACEHOLDER = 0` 파일 상단 named constant 로 추출 |
| 15 | 유지보수성 | `status.context as WaitingForInputEvent` 타입 단언 — 런타임 타입 불일치 무언 통과 위험 | `use-widget.ts` — `seedWaitingFromStatus` 내 캐스팅 | `EiaClient.getStatus` 응답 `context` 필드 타입을 `WaitingForInputEvent` 호환으로 강화 또는 runtime type guard 적용 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | MEDIUM | `(execution_id, status)` 복합 인덱스 미선언 — 쿼리 풀스캔 위험 |
| security | LOW | `nodeOutput` 으로 `outputData` 전체 동봉 — 암묵적 보안 가정 |
| architecture | LOW | 모듈 경계 침범(NodeExecution 직접 소유), 인라인 파싱 로직 SRP 위반 |
| maintainability | LOW | getStatus 45줄 인라인, 테스트 fetchMock 중복, 변수명·매직넘버 |
| concurrency | LOW | seedWaitingFromStatus vs SSE replay dispatch 순서 역전 가능성 |
| side_effect | LOW | getStatus DB 쿼리 추가, restore 경로 이미 수신 이벤트 재전달 가능 |
| performance | LOW | Execution 전체 컬럼 로드, Node JOIN 필요 컬럼 미제한, 무조건 getStatus 왕복 |
| testing | LOW | 엣지 케이스·예외 경로 다수 미테스트(INFO 9건) |
| documentation | LOW | JSDoc 미갱신, plan 완료 상태 미반영, k8s README 구조 미비 |
| requirement | NONE | 핵심 요구사항 완전 충족. SPEC-DRIFT 1건(§5.2 replay 동작 명시 보강) |
| scope | NONE | 모든 파일 변경이 의도된 목표와 직접 대응. 범위 외 변경 없음 |
| api_contract | LOW | context discriminated union 타입 명세 누락(INFO). breaking change 없음 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항 보고)

---

## 권장 조치사항

1. **[즉시/필수]** `node-execution.entity.ts` 에 `@Index(['executionId', 'status'])` 추가 및 마이그레이션 생성 — 인덱스 없이 운영 트래픽 증가 시 getStatus 쿼리가 풀스캔 실행됨
2. **[단기]** `nodeOutput` 동봉 필드를 명시적 pick 으로 제한하거나 JSDoc 에 "outputData 민감 필드 기록 금지" 제약 명기 — 향후 outputData 스키마 확장 시 정보 노출 방지
3. **[단기]** `seedWaitingFromStatus` dispatch 전 seq guard 추가 — SSE replay 결과가 getStatus 결과로 역방향 덮어써지는 edge case 방지
4. **[단기]** `ExternalInteractionModule` JSDoc 의존성 목록 `NodeExecution` 추가 갱신
5. **[단기]** plan 파일 `status: completed`, 마감 항목 `[x]`, `plan/complete/` 이동 및 커밋 메시지 미구현 테스트 항목 교정
6. **[중기]** `NodeExecutionsModule` 에 `findWaitingNodeExecution(executionId)` 전용 메서드 추가 후 `ExternalInteractionModule` 간접 접근 전환 — 모듈 경계 복원
7. **[중기]** `mapNodeExecToWaitingContext()` 순수 함수 분리 — InteractionService SRP 위반 해소 + 테스트 가능성 향상
8. **[중기]** 테스트 coverage gap 해소: form/ai_conversation 분기, legacy flat buttonConfig fallback, nodeExec-without-node, soft-fail, restore 경로, `subscribe(lastEventId=0)` 케이스 추가
9. **[중기]** spec EIA §5.2 SSE replay 절에 `?lastEventId=0` 동작 1줄 보강 (SPEC-DRIFT §3.5/§5.2 명시 완성)
10. **[중기]** k8s README CORS 블록에 소제목 추가 및 Placeholder Secret 테이블에 `WEB_CHAT_WIDGET_ORIGINS` 항목 추가
11. **[장기]** `Execution` 전체 컬럼 로드 → 필요 컬럼 `select` 명시, Node JOIN → `node.type` 만 SELECT 최적화

---

## 라우터 결정

routing_status=done (router 가 선별):

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (12명)
- **제외**: 표 참조 (2명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 신규 외부 패키지 추가 없음으로 라우터가 제외 판정 |
| user_guide_sync | 사용자 안내 문서 동기화 대상 없음으로 라우터가 제외 판정 |