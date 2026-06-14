# Code Review 통합 보고서

## 전체 위험도
**LOW** — 보안 개선 목적 리팩터링으로 spec 요구사항 완전 충족. Critical 발견사항 없음. 6건의 WARNING 은 외부 클라이언트 호환성 확인, 문서 보완, 구식 주석 수정으로 모두 단기 해소 가능.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `ExecutionError.serverDetail` 이 `public readonly` 로 노출되어 `buildContinuationErrorAck` 외 다른 catch 경로(REST 컨트롤러, 글로벌 필터 등)가 이를 응답 body에 포함할 경우 내부 정보 누출 위험 | `workflow-errors.ts` `ExecutionError` 추상 클래스; deprecated `detail` getter | (1) 전체 코드베이스에서 `err.detail` / `err.serverDetail` 을 응답 body/ack에 직접 포함하는 패턴 검색·감사. (2) deprecated `detail` getter 빠른 제거. (3) NestJS 글로벌 예외 필터의 `ExecutionError` 처리 시 `serverDetail` 미포함 테스트 보증 |
| 2 | 보안 | 프론트엔드 `localizeAckError` 의 fallback 경로가 백엔드 "모든 ack는 client-safe message" 불변식에 의존 — 다른 continuation handler가 `buildContinuationErrorAck`를 거치지 않고 직접 `error.message` 를 ack에 넣으면 정보 누출 발생 | `use-execution-interaction-commands.ts` `localizeAckError` 함수 | 모든 continuation ack 생성 경로가 반드시 `buildContinuationErrorAck`를 통하도록 아키텍처 레벨 강제 또는 테스트 보증, 신규 handler 추가 시 체크리스트에 명시 |
| 3 | 아키텍처 | `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 코드가 `nodes/core/error-codes.ts`에 위치 — 이 파일은 노드 핸들러 수준 공통 상수용이나 해당 코드는 execution-engine/websocket 도메인 전용 개념으로 모듈 경계가 어긋남 | `codebase/backend/src/nodes/core/error-codes.ts` | 단기: `error-codes.ts` 내 "WS continuation ack 코드" 섹션 블록 주석으로 의도 명시. 중장기: `EXECUTION_*` 코드를 `execution-engine` 모듈 범위 상수로 이동 후 re-export |
| 4 | 문서화 | `buildContinuationErrorAck` JSDoc 첫 줄의 "변경 2.3 (review W-8)" 레이블이 이전 리팩터 단계의 히스토리 태그로 남아 신규 독자에게 맥락 없는 레퍼런스가 됨 | `codebase/backend/src/modules/websocket/websocket.gateway.ts` JSDoc 첫 줄 | 레이블을 `A-1 typed-error (§7.5.2)` 기준으로 교체하거나 "변경 2.3" 태그 제거 |
| 5 | API 계약 | 비-typed Error ack의 `error` 필드 값이 `error.message` 원문에서 고정 fallback 문자열로 변경되고, 이전에 없던 `errorCode` 필드가 항상 포함 — `channel-web-chat` 위젯 등 외부 WS 클라이언트가 `error` 문자열을 직접 비교하거나 `errorCode` 부재를 조건으로 사용했다면 동작 변경 | `websocket.gateway.ts` `buildContinuationErrorAck`; 모든 continuation ack 소비 클라이언트 | `frontend/`, `channel-web-chat/`에서 `errorCode` 부재 판별 로직 또는 `error` 문자열 직접 비교 로직 유무 확인, 있을 경우 동시 배포 또는 클라이언트 방어 코드 적용 |
| 6 | 유저 가이드 동기화 | `buildContinuationErrorAck` 에러 표면화 정책 변경(plain Error 차단 + errorCode 필드 신규 의미론)이 `05-run-and-debug/error-handling.{mdx,en.mdx}` 갱신 없이 merge되면 사용자 가이드가 실제 동작과 diverge | `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` + `.en.mdx` (미갱신) | 두 파일에 continuation ack 에러 표면화 정책 설명 섹션 추가 — `errorCode` 세 값(`INVALID_EXECUTION_STATE`, `EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_INTERNAL_ERROR`)과 각 의미, 사용자 노출 고정 문자열 기술 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(긍정) | `buildContinuationErrorAck` 가 `ExecutionError` 계층만 `message+code` 를 surface하고 나머지는 generic fallback + `EXECUTION_INTERNAL_ERROR`로 축약 — OWASP A05/A09 관점 명확한 개선 | `websocket.gateway.ts` `buildContinuationErrorAck` | 없음 |
| 2 | 보안(긍정) | `MessageTooLongError` 의 `actualLength`/`maxLength`를 `serverDetail`에만 기록, `message`는 고정 문자열 유지 | `workflow-errors.ts` `MessageTooLongError` 생성자 | 없음 |
| 3 | 보안(긍정) | `getExecutionInteractionErrorI18nKey` 에서 `Object.prototype.hasOwnProperty.call` 로 프로토타입 오염 방어, 테스트로 검증됨 | `frontend/src/lib/websocket/execution-error-codes.ts` | 없음 |
| 4 | 아키텍처 | `ExecutionTimeLimitError` 가 `ExecutionError` 계층 밖에 의도적으로 남아 있으며 JSDoc 설계 경계 주석으로 명시 | `workflow-errors.ts` `ExecutionTimeLimitError` 블록 주석 | 없음 |
| 5 | 아키텍처 | 이중 i18n 경로(`backend-labels.ts` + `dict/*/executions.ts`)가 "defense-in-depth" 의도로 중복 관리 — 향후 불일치 위험 | `backend-labels.ts` + `dict/en/executions.ts` + `dict/ko/executions.ts` | 두 경로 중 canonical 명시 또는 장기적으로 `backend-labels.ts` 경로를 `dict/*/executions.interactionError.*`으로 통합 위임 |
| 6 | 유지보수 | `@deprecated detail` getter에 마이그레이션 기한(PR/milestone 식별자) 미명시 — 기한 없는 deprecated는 영구 잔존 위험 | `workflow-errors.ts` `InvalidExecutionStateError.detail`, `RetryLastTurnError.detail` getter | `@deprecated` 주석에 제거 목표 태스크/milestone 추가 (예: `remove in refactor-04-a2 cleanup`) |
| 7 | 유지보수 | `ExecutionTimeLimitError` 앞에 JSDoc 블록 2개 연속 배치 — IDE가 마지막 블록만 hover 노출하여 기존 문서 숨김 | `workflow-errors.ts` L415–424 | 두 JSDoc 블록을 하나로 병합 |
| 8 | 유지보수 | `buildContinuationErrorAck` 비-typed 분기 `logger.warn(...)` 템플릿 리터럴 내 복합 삼항 표현식 인라인 삽입으로 가독성 저하 | `websocket.gateway.ts` `buildContinuationErrorAck` | 지역 변수 추출: `const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)` |
| 9 | 테스트 | `continueAiConversation` 테스트에서 동일 입력으로 서비스를 두 번 호출 — mock 상태 누적 시 두 번째 assertion 영향 가능성 | `execution-engine.service.spec.ts` 10000자 초과 테스트 | Promise를 변수에 저장 후 재사용하거나 `it` 블록 분리 |
| 10 | 테스트 | `handleEndConversation` 에서 plain Error / typed `ExecutionError` throw 시 누출 차단 동작 테스트 없음 | `websocket.gateway.spec.ts` 신규 describe 블록 | `handleEndConversation` plain Error → `EXECUTION_INTERNAL_ERROR` + fallback 검증 케이스 최소 1개 추가 |
| 11 | 테스트 | `clickContinue`·`endConversation`의 localization 경로 테스트 없음 — `endConversation`은 독립 ack 이벤트(`execution.end_conversation.ack`) 사용 | `use-execution-interaction-commands.test.ts` 신규 describe 블록 | `endConversation` EXECUTION_INTERNAL_ERROR → internalError i18n 키 케이스 1개 추가 |
| 12 | 테스트 | i18n map 값이 실제 dict에 존재하는지 런타임 교차 검증 없음 (TypeScript 타입이 컴파일 타임 강제하므로 실질 위험 낮음) | `execution-error-codes.test.ts` | 선택적: 실 i18n dict 키 목록 import 후 교차 검증 테스트 추가 |
| 13 | 요구사항 | `endConversation` errorCode localization 테스트 커버리지 없음 (기능 구현은 올바름, 테스트 격차) | `use-execution-interaction-commands.test.ts` I-12 섹션 | `endConversation errorCode localization` 케이스를 I-12 describe 블록에 추가 |
| 14 | 부작용 | `error` 필드 값 변경(내부 message → 고정 fallback)이 `channel-web-chat` 등 외부 WS 클라이언트에 잠재 영향 | `buildContinuationErrorAck` 비-typed 분기 | 외부 WS 클라이언트에서 `error` 문자열 하드코딩 비교 여부 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `serverDetail` public 노출 경로 잔여 위험(W), 프론트엔드 fallback 불변식 의존(W) |
| architecture | LOW | `EXECUTION_*` 코드가 `nodes/core/`에 혼재(W), 이중 i18n 경로 장기 불일치 가능성(I) |
| requirement | NONE | spec §7.5.2 line-level 완전 충족, 발견사항 전부 INFO |
| scope | NONE | 변경 범위 plan 항목과 정확히 일치, 발견사항 전부 INFO |
| side_effect | LOW | WS ack `error` 필드 값 변경 및 `errorCode` 신규 추가로 외부 클라이언트 잠재 영향(I) |
| maintainability | LOW | deprecated 기한 미명시, JSDoc 이중 블록, 로그 인라인 삼항 — 모두 INFO |
| testing | LOW | `handleEndConversation` 보안 게이트 테스트 부재, `endConversation` localization 경로 미커버 — 모두 INFO |
| documentation | LOW | "변경 2.3 (review W-8)" 구식 레이블 잔존(W), 나머지 문서화 품질 우수 |
| api_contract | LOW | 비-typed ack 형식 변경(error 값 + errorCode 신규)으로 외부 클라이언트 하위 호환 확인 필요(W) |
| user_guide_sync | LOW | `05-run-and-debug/error-handling.{mdx,en.mdx}` 동반 갱신 누락(W) |

## 발견 없는 에이전트

없음 — 전 에이전트가 발견사항 보고.

## 권장 조치사항

1. **(WARNING-5, api_contract) 외부 WS 클라이언트 호환성 확인**: `channel-web-chat/` 및 `frontend/` 전체에서 continuation ack의 `error` 문자열 직접 비교 또는 `errorCode` 부재 조건 사용 여부 검색. 있을 경우 방어 코드 추가 또는 동시 배포 계획 수립.
2. **(WARNING-6, user_guide_sync) 유저 가이드 동반 갱신**: `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.{mdx,en.mdx}` 에 continuation ack errorCode 세 값과 각 의미, 사용자 노출 메시지 기술 섹션 추가.
3. **(WARNING-1, security) `serverDetail` 누출 경로 감사**: 전체 코드베이스에서 `err.serverDetail` / `err.detail` 을 HTTP 응답 body 또는 WS ack에 직접 포함하는 패턴 검색. NestJS 글로벌 예외 필터에서 `ExecutionError` 처리 시 `serverDetail` 미포함 여부를 테스트로 보증.
4. **(WARNING-2, security) continuation ack 생성 경로 강제**: 모든 continuation ack가 `buildContinuationErrorAck`를 경유하는지 테스트 또는 아키텍처 가드로 보증. 신규 handler 추가 체크리스트에 항목 추가.
5. **(WARNING-4, documentation) 구식 JSDoc 레이블 수정**: `buildContinuationErrorAck` JSDoc 첫 줄 "변경 2.3 (review W-8)" → "A-1 typed-error (§7.5.2)" 로 교체 (1줄 수정).
6. **(WARNING-3, architecture) `nodes/core/error-codes.ts` 모듈 경계 명시**: 단기 조치로 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 코드 블록에 "WS continuation ack 전용 코드" 섹션 주석 추가.
7. **(INFO-10,11,13 testing) `endConversation` 테스트 보강**: `handleEndConversation` plain Error 누출 차단 케이스 및 `endConversation` localization 경로 케이스 각 1개 추가.
8. **(INFO-6, maintainability) deprecated 기한 명시**: `detail` getter의 `@deprecated` 주석에 제거 목표 태스크/milestone 참조 추가.
9. **(INFO-8, maintainability) 로그 인라인 삼항 추출**: `buildContinuationErrorAck` 내 `logger.warn` 인자의 복합 삼항을 지역 변수로 추출.
10. **(INFO-9, testing) 중복 서비스 호출 제거**: `continueAiConversation` 테스트에서 Promise를 변수에 저장 후 두 assertion에서 재사용.

## 라우터 결정

routing_status=done — 라우터가 선별 실행:

**실행** (10명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`

**강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (4명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 선별 제외 |
| dependency | router 선별 제외 |
| database | router 선별 제외 |
| concurrency | router 선별 제외 |