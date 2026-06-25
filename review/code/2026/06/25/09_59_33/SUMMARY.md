# Code Review 통합 보고서

대상: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
커밋: `b72f634` — refactor(websocket): C-4 명령 핸들러 5종 인증+소유권 보일러플레이트 helper 추출
리뷰 일시: 2026-06-25 09:59:33

---

## 전체 위험도

**LOW** — behavior-preserving 리팩토링. 보안·API 계약·동시성·요구사항 모두 변경 없이 보존됨. 수정 필요 항목 2건(WARNING) 모두 범위가 좁고 즉시 해결 가능.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `workspaceId` 누락 토큰 수용 후 빈 문자열로 정규화 — `executionsService.verifyOwnership`이 빈 workspaceId를 소유 불일치로 처리함을 이 파일만으로 보장 불가. 합법적 workspaceId-absent JWT가 user 단위 채널에 대해 의도치 않게 통과할 수 있는 서비스 계층 위험 | `getCommandAuthContext` (line 743), `handleSubscribe` (line 567) | `executionsService.verifyOwnership`이 빈 workspaceId 입력에 대해 반드시 거부하도록 단위 테스트로 명시 보장. Gateway 레벨에서 `workspaceId` 빈 문자열 시 명령 핸들러 조기 거부 추가 검토 |
| 2 | Maintainability | `handleSubscribe` 내 `const enriched = client as AuthenticatedSocket` 이 라인 566과 651 두 곳에 중복 선언됨 — 동일 함수 스코프 내 불필요한 재선언으로 `no-shadow` lint 경고 가능 | `handleSubscribe` 함수 내 line 566, line 651 | line 651의 재선언 제거 후 line 566의 `enriched`를 재사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `WebsocketGateway` 클래스가 여전히 6종 책임(연결 생명주기·구독 관리·5종 명령·인증 보조·ack 빌더·브로드캐스트)을 담음 — C-4 자체는 악화시키지 않았으나 성장 경로 존재 | 전체 클래스 (1246라인) | 후속 슬라이스에서 `ExecutionCommandHandler` 류 별도 서비스/파사드로 명령 핸들러 5종 + helper 추출 고려 |
| 2 | Architecture | `emitExecutionSnapshot` 내 `verifyOwnership` 직접 호출이 `verifyExecutionOwnership` helper와 별도 `try/catch → boolean` 패턴을 재구현 — 구독 경로 IDOR 이중 방어로 의미가 다르므로 오류는 아니나 인지 부하 발생 | line 665-691 | 주석에 "구독 경로의 IDOR 이중 방어 — verifyExecutionOwnership helper와 의도적 분리" 한 줄 추가 권장 |
| 3 | Testing | `handleClickButton` 전용 describe 블록 부재 — 미인증 거부·IDOR 거부·성공·`queued=false` 케이스 미검증 | `websocket.gateway.spec.ts` 전체 | `handleClickButton` 전용 describe 블록 및 4개 케이스 추가 |
| 4 | Testing | `handleSubmitMessage` / `handleEndConversation` 에 인증 거부·IDOR 거부 케이스 미검증 (`handleSubmitForm`·`handleRetryLastTurn`과 비대칭) | `websocket.gateway.spec.ts:1024-1102` | 두 핸들러 각각에 unauthenticated·ownership 거부 케이스 추가 |
| 5 | Testing | `getCommandAuthContext` `workspaceId` undefined 정규화 엣지 케이스(빈 문자열 정규화 → `verifyOwnership` 호출) 미검증 | `websocket.gateway.ts:148-153` | `userId` 있고 `workspaceId` undefined인 소켓으로 명령 핸들러 호출 시 ownership 거부 ack 반환 케이스 추가 |
| 6 | Testing | `handleRetryLastTurn` W3 보상 경로: `markSpawnedRowFailedOnPublishError` 호출 검증 없음 (`queued=false` 및 publish throw 케이스) | `websocket.gateway.spec.ts:1008-1021` | `expect(mockEngine.markSpawnedRowFailedOnPublishError).toHaveBeenCalledWith(...)` 검증 추가 |
| 7 | Testing | `handleConnection` invalid token 경로(JWT verify throw)의 `emit('error', { message: 'Invalid token' })` + `disconnect()` 검증 부재 | `websocket.gateway.spec.ts:645-668` | invalid token 케이스 추가 |
| 8 | Maintainability | `handleRetryLastTurn` 내 `'Execution not found'` 문자열이 상수화 없이 리터럴 사용 — 나머지 4종 핸들러의 `MSG_NOT_AUTHORIZED_EXECUTION` 패턴과 불일치 | `handleRetryLastTurn` line 1099 | `const MSG_EXECUTION_NOT_FOUND = 'Execution not found'` 추가 후 적용 검토 |
| 9 | Maintainability | `getCommandAuthContext` JSDoc이 함수 본문(9줄) 대비 22줄로 주석 비율 역전 — OCP 설명은 클래스 레벨로 이동 가능 | `getCommandAuthContext` JSDoc | 필수 정보(`null` 반환 조건, `workspaceId` 정규화)만 남기고 설계 배경은 클래스 레벨로 이동 (강제 사항 아님) |
| 10 | Maintainability | `handleSubscribe`의 구독 한도 초과 에러 메시지(`Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`)가 세 곳에 미상수화 중복 | `handleSubscribe` 내 line 558-560, 617-622, 630-636 | `MSG_MAX_SUBSCRIPTIONS_REACHED` 상수 추출 (다음 유지보수 시) |
| 11 | Documentation | `AuthenticatedSocket`·`getCommandAuthContext`·`verifyExecutionOwnership` JSDoc에 `refactor 03 C-4` 작업 레이블이 영구 주석으로 삽입 — 향후 독자에게 노이즈 가능 | JSDoc 블록 전반 | 레이블 제거하고 내용 설명만 유지 검토 (저장소 관행이면 수용 가능) |
| 12 | Documentation | `handleSubmitMessage`에만 subscription 체크 관련 괄호 주석 잔류 — 다른 continuation 핸들러와 불일치 | line 921-922 | 제거하거나 모든 continuation 핸들러에 동일하게 추가 |
| 13 | Security | `handleUnsubscribe`에 인증 가드 없음 — spec §3.3/§3.4 요구사항 없으므로 위반 아님, 비인증 소켓은 `handleConnection`에서 disconnect 보장 | `handleUnsubscribe` 핸들러 | 해당 없음 |
| 14 | Security | `data.executionId` 등 핸들러 입력값의 UUID 포맷 검증 부재 — `verifyOwnership` DB 조회 기반 차단으로 실질 위험 LOW | 5개 명령 핸들러 진입부 | 해당 없음 (현 수준 spec 기대 범위 내) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `workspaceId` 빈 문자열 정규화 경로의 서비스 계층 보장 필요 (WARNING) |
| architecture | LOW | `WebsocketGateway` 클래스 6종 책임 병존 (기존 부채, C-4 미악화) |
| requirement | NONE | spec §7.1/§7.2/§4.2/§3.3 모두 일치. 발견사항 없음 |
| maintainability | LOW | `handleSubscribe` 내 `enriched` 중복 선언 (WARNING); `'Execution not found'` 미상수화 (INFO) |
| testing | LOW | `handleClickButton` describe 블록 부재; `handleSubmitMessage`/`handleEndConversation` 인증·IDOR 케이스 미검증; `workspaceId` 정규화 엣지 케이스 미검증 |
| documentation | NONE | 모든 신규 항목 문서화 충분. 레이블 노이즈·잔류 주석 INFO 수준 |
| concurrency | NONE | 신규 helper가 공유 가변 상태 미접근. 경쟁 조건 없음 |
| api_contract | NONE | wire 문자열·ack payload·이벤트명·인가 흐름 전부 불변 보존 |
| scope | — | 재시도 필요 (output_file 부재) |
| side_effect | — | 재시도 필요 (output_file 부재) |

---

## 발견 없는 에이전트

- **requirement**: spec §7.1/§7.2/§4.2/§3.3 완전 일치, CRITICAL/WARNING 없음
- **documentation**: 신규 항목 모두 문서화 완비, README/CHANGELOG 갱신 불필요
- **concurrency**: 신규 helper 동시성 중립, 경쟁 조건·데드락·이벤트 루프 블로킹 없음
- **api_contract**: breaking change 없음, wire shape 완전 보존

---

## 권장 조치사항

1. **(WARNING — 즉시)** `handleSubscribe` 내 line 651의 `const enriched = client as AuthenticatedSocket` 중복 선언 제거 — line 566 변수 재사용으로 1줄 삭제.
2. **(WARNING — 단기)** `executionsService.verifyOwnership`이 빈 workspaceId 입력에 대해 반드시 거부하는 단위 테스트 추가 — 보안 계약 명시 보장.
3. **(INFO — 테스트 보강)** `handleClickButton` describe 블록 신설 및 4개 케이스(미인증·IDOR·성공·queued=false) 추가.
4. **(INFO — 테스트 보강)** `handleSubmitMessage`/`handleEndConversation`에 unauthenticated·ownership 거부 케이스 추가하여 5개 핸들러 커버리지 대칭성 확보.
5. **(INFO — 테스트 보강)** `workspaceId` undefined 정규화 엣지 케이스 테스트 추가 — 향후 `verifyOwnership` 구현 변경 시 IDOR 회귀 방지.
6. **(INFO — 선택)** `handleRetryLastTurn`의 `'Execution not found'` 리터럴을 `MSG_EXECUTION_NOT_FOUND` 상수로 추출하여 나머지 핸들러 패턴과 일관성 확보.
7. **(INFO — 선택)** `emitExecutionSnapshot` 주석에 "구독 경로 IDOR 이중 방어 — verifyExecutionOwnership helper와 의도적 분리" 한 줄 추가.
8. **(INFO — 향후)** scope·side_effect 리뷰어 재시도 후 보고서 보완.

---

## 라우터 결정

라우터가 선별(`routing=done`):

- **실행**: security, architecture, requirement, maintainability, testing, documentation, concurrency, api_contract (10명)
- **강제 포함 (router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명 지정 — scope·side_effect는 output_file 부재로 재시도 필요)
- **제외**: performance, dependency, database, user_guide_sync (4명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단에 의해 생략 |
| dependency | 라우터 판단에 의해 생략 |
| database | 라우터 판단에 의해 생략 |
| user_guide_sync | 라우터 판단에 의해 생략 |

재시도 필요: scope, side_effect (output_file 없음 — 2건)
