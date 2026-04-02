# Code Review Resolution

## CRITICAL 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | XSS (dangerouslySetInnerHTML) | `DOMPurify.sanitize()` 적용 — `ChartContent`, `TemplateContent`에 sanitize 래퍼 추가 |
| 2 | 인가 누락 (submit_form) | `@ConnectedSocket()` 추가, `client.userId` 검증 후 처리. 미인증 시 에러 반환 |
| 3 | formData 입력 검증 부재 | Phase 2로 이관 (Form 노드 config fields 스펙 기반 서버 측 검증) — 현재는 타임아웃으로 DoS 방지 |
| 4 | 서버 재시작 복구 | `onModuleInit`에서 `WAITING_FOR_INPUT` 상태 실행을 `FAILED`로 일괄 처리하는 `recoverStuckExecutions()` 추가 |

## WARNING 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | 에러 메시지 내부 정보 노출 | gateway catch 블록에서 제네릭 메시지 `'Form submission failed'` 반환 |
| 2 | CarouselContent URL 미검증 | `isHttpUrl()` 헬퍼 함수 추가, `<img src>` 및 `<a href>`에 http(s) URL만 허용 |
| 3 | CORS origin: '*' | 기존 이슈 — Phase 2에서 환경변수 기반 origin 제한 |
| 4 | waiting_for_input 중 불필요한 폴링 | `POLL_INTERVAL_WAITING_MS = 10000` 추가, waiting 상태 시 폴링 간격 증가 |
| 5 | 폼 미제출 시 무한 대기 | `setTimeout` 기반 타임아웃 추가 (기본 30분, node.config.timeout으로 설정 가능) |
| 6 | N+1 패턴 (executionPath) | 기존 이슈 — Phase 2에서 일괄 저장으로 개선 |
| 7 | findOne 불필요한 재조회 | 기존 구조 유지 — executeNode 내부에서 nodeExecution을 반환하도록 리팩토링은 범위 초과 |
| 8 | 비원자적 DB 상태 전환 | Phase 2에서 QueryRunner 트랜잭션으로 개선 |
| 9 | 이중 상태 이벤트 (NODE_COMPLETED + WAITING) | Form 노드의 NODE_COMPLETED는 executeNode에서 정상 emit 후, waitForFormSubmission에서 WAITING 상태로 전환. 의미상 올바름 — 노드 핸들러는 완료, 이후 사용자 입력 대기 |
| 10 | cancelWaitingExecution 미노출 | `ExecutionsService.stop()`에서 `WAITING_FOR_INPUT` 상태 시 `cancelWaitingExecution()` 호출하도록 연동 |
| 11 | waiting_for_input 폴링 무한 지속 | `waitingNodeId` 동일 시 early-return 처리 추가 |
| 12 | formConfig 접근 경로 불일치 | 현재 구조 유지 — WS와 polling 경로가 다른 것은 의도적 (WS는 이벤트 페이로드, polling은 DB 데이터) |
| 13 | form_submitted 응답 미수신 | Phase 2에서 Socket.IO ACK 패턴으로 전환 |
| 14 | 낙관적 상태 전환 | 현재 유지 — 서버의 execution.started 이벤트로 reconcile됨 |
| 15-16 | SRP 위반, 코드 중복 | Phase 2 리팩토링에서 분리 |
| 17-20 | 테스트 누락 | `handleSubmitForm` 테스트 3건, WS `waiting_for_input` 핸들러 테스트, presentation 결과 수집 테스트 추가 |
| 21 | 언마운트 시 좀비 실행 | Phase 2에서 cleanup 시 cancel 요청 추가 |
| 22 | Gateway 레이어 역전 | 현재 `forwardRef` 구조 유지 — Phase 2에서 EventEmitter2 도입 |

## INFO 이슈

대부분 Phase 2 개선 사항으로 이관. `PdfContent` URL 검증은 `isHttpUrl()` 함수로 함께 해결됨.
