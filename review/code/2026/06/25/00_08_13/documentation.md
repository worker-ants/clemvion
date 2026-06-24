# Documentation Review

## 발견사항

### [INFO] ExternalInteractionModule JSDoc 의존성 목록 미갱신
- 위치: `/codebase/backend/src/modules/external-interaction/external-interaction.module.ts` — 모듈 JSDoc 블록 (라인 105-120)
- 상세: 모듈 주석의 `의존성:` 라인이 `TypeOrmModule.forFeature([Trigger, Execution])` 으로 표기되어 있다. 이번 변경으로 `NodeExecution` 이 추가됐으나 JSDoc 의존성 목록에 반영되지 않아 주석이 실제 코드와 불일치한다.
- 제안: 주석의 의존성 목록을 `TypeOrmModule.forFeature([Trigger, Execution, ExecutionToken, NodeExecution])` 로 갱신.

### [INFO] InteractionService 클래스 JSDoc 에 getStatus 표면 복원 설명 미포함
- 위치: `/codebase/backend/src/modules/external-interaction/interaction.service.ts` — 클래스 레벨 JSDoc (라인 976-989)
- 상세: 클래스 레벨 주석은 `interact`, `cancel`, `refreshToken` 의 dispatch 매핑을 명시하지만, `getStatus` 의 `waiting_for_input` 표면 복원 동작(NodeExecution 조회, currentNode/context 구성)은 언급하지 않는다. `nodeExecutionRepository` 가 새로운 주요 의존성으로 추가됐음에도 클래스 요약에 반영되지 않았다.
- 제안: 클래스 JSDoc 에 `getStatus` 가 `WAITING_FOR_INPUT` 상태일 때 `NodeExecution.outputData` 에서 SSE wire 형식으로 표면을 복원한다는 설명을 한 줄 추가.

### [INFO] `seedWaitingFromStatus` 함수에 JSDoc 미비
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` useCallback 블록
- 상세: 새로 추가된 `seedWaitingFromStatus` 는 race 보정의 핵심 경로(getStatus 시드)인데, 함수 자체에 JSDoc/독스트링이 없다. 인라인 주석(`// getStatus 로 현재 waiting 표면을 시드한다…`)이 있으나, 이 함수가 start/restore 양쪽 경로에서 호출된다는 사실, `parseWaitingForInput` 을 재사용하는 이유, soft 실패 정책의 근거가 모두 주석 안에만 흩어져 있어 독립적으로 읽기 어렵다.
- 제안: 함수 위에 JSDoc 블록(`@param client`, `@param session`, 실패 정책, 호출 시점)을 추가하거나 기존 인라인 주석을 JSDoc 형식으로 격상.

### [INFO] plan 파일의 검증 상태 불일치
- 위치: `/plan/in-progress/web-chat-preview-eia-race-fix.md` — "마감" 섹션
- 상세: `검증` 항목이 `[~]`(진행 중) 이고 `리뷰·PR` 항목이 `[ ]`(미완)으로 표기되어 있다. 본 커밋이 바로 이 PR 로 이어지는 리뷰 대상 커밋이므로, plan 이 최종 완료 상태(`[x]`)로 갱신되지 않은 채 커밋에 포함됐다. plan 파일은 `status: in-progress` 이고 마감 체크박스가 부분 완료 상태로 남아 있어 문서가 실제 완료 상태를 반영하지 않는다.
- 제안: 검증 완료 후 plan 의 `status` 를 `completed` 로, 마감 항목 전체를 `[x]` 로 갱신하거나 `plan/complete/` 로 이동. 최소한 현재 커밋에서 build/test green 이 확인됐으므로 `[~] 검증` 을 `[x]` 로 갱신.

### [INFO] `sse-adapter.spec` 테스트 커버 커밋 메시지 선언과 실제 변경 대상 미일치
- 위치: 커밋 메시지 "테스트: … sse-adapter.spec(lastEventId=0 replay) …" 문구 vs 실제 리뷰 대상 파일
- 상세: 커밋 메시지에 `sse-adapter.spec(lastEventId=0 replay)` 테스트가 추가됐다고 기술하나, 리뷰 대상 파일 목록에 `sse-adapter.spec` 변경은 없다. plan 파일에도 해당 테스트가 마감 목록에 포함돼 있는데 실제로 변경되지 않은 경우 문서(커밋 메시지·plan)가 사실과 다르다. `eia-client.test(getStatus)` 도 동일하게 리뷰 파일 목록에 없다.
- 제안: 커밋 메시지 또는 plan 의 테스트 목록을 실제 변경된 파일 기준으로 교정하거나, 해당 spec 파일이 별도 커밋에 이미 포함됐다면 plan 에 그 커밋을 참조로 명시.

### [INFO] k8s/README.md 의 `WEB_CHAT_WIDGET_ORIGINS` 설명과 §6 배치 위치
- 위치: `/k8s/README.md` — `### 6. NEXT_PUBLIC_*` 섹션과 새로 추가된 CORS 블록 사이
- 상세: 신규 CORS 안내 블록이 `### 6. NEXT_PUBLIC_*` 섹션의 "동봉 위젯" 설명 다음 단락으로 추가됐는데, 이 위치는 제목이 없는 블록으로 들어가 있다. 독자가 `WEB_CHAT_WIDGET_ORIGINS` 가 어느 섹션에 속하는지 구조적으로 식별하기 어렵다. 또한 "Placeholder 체크리스트" 의 `### 2. Secret 실 값` 테이블에 `WEB_CHAT_WIDGET_ORIGINS` 항목이 없어 운영자가 누락하기 쉽다.
- 제안: CORS 블록에 `#### 분리 배포 시 CORS 설정` 같은 소제목을 달거나, Placeholder 체크리스트의 Secret 테이블에 `WEB_CHAT_WIDGET_ORIGINS` 항목을 추가(또는 별도 `### 7.1 CORS` 하위항목 신설).

### [INFO] spec EIA §5.3 의 "conversationThread 생략" 근거 미서술
- 위치: `/spec/5-system/14-external-interaction-api.md` — §5.3 구현 상태 주석 블록
- 상세: 갱신된 §5.3 주석은 `conversationThread snapshot` 을 생략한다고 명시했지만, 생략 이유("SSE replay 가 권위이며 만료 전 5분 buffer 에서 보정한다"만 언급)는 있으나 "왜 getStatus 응답에서 생략하는가"를 결정한 트레이드오프(복원 비용·stale 위험 vs 보정 경로)는 spec 본문 어디에도 Rationale 로 기록되지 않았다. 다른 생략 이유(예: conversationThread 는 다수 NodeExecution 에 걸쳐 분산돼 있어 단일 쿼리 복원이 어려움)가 있다면 spec 에 남겨야 한다.
- 제안: §5.3 또는 Rationale 절에 conversationThread 생략 결정의 근거를 한 단락 추가.

---

## 요약

이번 변경은 EIA spec(§5.3·§3.5), 보안 spec(4-security §2), 운영 콘솔 spec(5-admin-console §6), k8s/README, plan 파일까지 문서 범위를 폭넓게 갱신했으며, 구현과 spec 의 동기화 상태는 전반적으로 양호하다. 다만 `ExternalInteractionModule` JSDoc 의 의존성 목록에 `NodeExecution` 이 빠져 있고, `seedWaitingFromStatus` 함수에 독립적인 JSDoc 이 없으며, plan 파일의 검증·완료 상태가 부분적으로 업데이트되지 않았다. k8s README 의 CORS 안내 블록은 구조적 제목이 없어 Placeholder 체크리스트와 연결이 끊어져 있다. 이 모두 운영·유지보수 관점에서 오해를 유발할 수 있는 INFO 수준 사항이며, 기능 동작과 핵심 API 문서는 올바르게 갱신돼 있다.

---

## 위험도

LOW
