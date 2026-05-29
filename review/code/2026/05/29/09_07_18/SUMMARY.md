# Code Review SUMMARY — workflow-resumable Phase 3 (변경 2.3 + Phase 3.1)

- 세션: `review/code/2026/05/29/09_07_18`
- 변경 규모: 16개 파일 (+708 / -52), base=origin/main, staged
- 전체 위험도: **MEDIUM** (테스트 커버리지 갭) — 기능 정확성 자체는 양호
- **BLOCK: NO** (Critical 0)
- Router: 12 reviewer 실행, 2 skip (dependency=의존성 변경 없음, database=migration/schema 변경 없음)

## Critical
없음.

## Warning
| # | 카테고리 | 발견 | 위치 | 제안 |
|---|----------|------|------|------|
| W-1 | 테스트 | WS gateway 4개 중 `handleSubmitForm` 만 errorCode ack 테스트; 나머지 3개 미검증 | websocket.gateway.spec.ts | 3개 핸들러 테스트 추가 (it.each) |
| W-2 | 테스트 | interaction.service click_button/submit_message/end_conversation 의 409 매핑 미검증 | interaction.service.spec.ts | 3개 명령 테스트 또는 dispatchContinuation 단위 테스트 |
| W-3 | 요구사항 | `onFailed.maxAttempts` fallback=1 (spec 기본 3). 첫 실패가 DEAD-LETTER 오분류 가능 (로그만, 큐 무영향) | continuation-execution.processor.ts | `?? 3` 또는 RESUME_BULLMQ_ATTEMPTS 참조 |
| W-4 | 요구사항/문서 | WS ack `errorCode` 구조가 spec §4.2 (`payload.error.code`)와 불일치 — 구현은 `data.errorCode` 최상위 | gateway + 6-websocket-protocol.md | spec 정렬 또는 구현 정렬 (project-planner) |
| W-5 | 보안 | `InvalidExecutionStateError.message` 내부정보(executionId, rows.length)가 REST 422/WS ack 원문 노출 | controller/interaction/gateway | 고정 문자열로 대체, 상세는 서버 로그 |
| W-6 | 보안 | `CONTINUATION_DLQ_MONITOR_ENABLED !== 'false'` — 'FALSE'/'0'/'no' 시 활성 유지 | continuation-dlq-monitor.service.ts | toLowerCase/허용값 명세 |
| W-7 | 아키텍처/유지보수 | `InvalidExecutionStateError` 서비스 파일 내 export — 3 레이어 직결 (workflow-errors.ts 미활용) | execution-engine.service.ts | 별도 errors 파일로 이동 |
| W-8 | 아키텍처/유지보수 | WS gateway catch 블록 errorCode 변환 4중 복사 | websocket.gateway.ts | private 헬퍼 추출 |
| W-9 | 아키텍처 | DLQ 모니터가 process.env 직접 읽기 — SHUTDOWN_GRACE_MS useFactory 패턴과 불일치 (DIP) | continuation-dlq-monitor.service.ts | useFactory/ConfigService 주입 |
| W-10 | 동시성 | setInterval + void checkOnce 겹침 시 lastAlarmAt race (기본 60s 에선 극저확률) | continuation-dlq-monitor.service.ts | in-flight 플래그 또는 setTimeout 재귀 |
| W-11 | 문서 | WS ack 신설 `errorCode?` 가 6-websocket-protocol.md 미반영 | spec/5-system/6-websocket-protocol.md | 필드 명시 |
| W-12 | 테스트 | `timer.unref?.()` 호출 미검증 (graceful shutdown 핵심) | continuation-dlq-monitor.service.spec.ts | unref mock + assertion |

## Info (요약)
I-1/I-2/I-3 (spec 미명세: DLQ env, removeOnFail:false, EIA 409 — project-planner), I-4 (parsePositiveInt 공학표기 1e10 통과), I-5 ((executionId,status) 인덱스 확인), I-6 (다중 인스턴스 polling 중복), I-7 (parsePositiveInt 중복), I-8 (로그 언어 혼용), I-9 (terminal→isDeadLetter), I-10 (ack 타입 리터럴 중복), I-11 (Promise<unknown>→void), I-12 (테스트 env 복원 try/finally), I-13 (continueAiConversation/endAiConversation 0건 throw 테스트), I-14 (controller 테스트 분리), I-15 (JSDoc Phase 태그), I-16 (422 Swagger DTO), I-17 (유저가이드 — frontend 미소비라 가시변화 없음).

## 권장 즉시 조치
1. W-1/W-2 — WS 3핸들러 + EIA 3명령 테스트 추가
2. W-5 — 클라이언트 응답 내부정보 제거
3. W-3 — onFailed maxAttempts fallback `?? 3`
4. W-6 — env falsy 판정 개선
5. W-10/W-12 — race 가드 + unref 테스트
6. W-4/W-11 — WS errorCode spec 반영 (project-planner)

## 에이전트별 위험도
testing=MEDIUM, security/architecture/maintainability/requirement/side_effect/concurrency/documentation/performance/api_contract=LOW, scope=NONE, user_guide_sync=INFO.
