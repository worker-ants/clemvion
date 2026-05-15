# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — catch 블록 내 `await` 예외 처리 누락으로 OAuth 팝업 무응답 장애 가능성 존재; 컨트롤러 에러 경로에 테스트 전무. 나머지는 타입 안전성·인덱스·아키텍처 개선 과제.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 에러 처리 | `markIntegrationCallbackError` await가 throw하면 catch 블록 내 `res.send(renderCallbackHtml(...))` 미실행 → OAuth 팝업 무응답 hang | `integrations.controller.ts` catch 블록 | `markIntegrationCallbackError` 호출을 별도 try-catch로 감싸거나 `.catch(() => logger.error(...))` 체이닝으로 HTML 응답 경로 보호 |
| 2 | 테스트 | 컨트롤러 에러 핸들러 경로(callbackContextOf + markIntegrationCallbackError 분기) 테스트 파일 부재 — 변경 0 핵심 로직이 완전히 미검증 | `integrations.controller.spec.ts` (미존재) | context 유/무, errorCode fallback, markIntegrationCallbackError throw 시 응답 전송 여부 등 신규 spec 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입·API 계약 | `lastError` DTO 타입이 `Record<string, unknown>`이고 Swagger도 `additionalProperties: true` — 실제 `{code, message, at}` 구조가 계약에 반영 안 됨 | `integration-response.dto.ts:38-46` | `lastError?: { code: string; message: string; at: string } \| null`로 구체화, `@ApiPropertyOptional`에 `properties` 명시 또는 별도 DTO 클래스 추출 |
| 2 | 아키텍처 | 서비스가 error에 context 첨부 → 컨트롤러가 `callbackContextOf(err)`로 추출 → 다시 서비스 호출. Service→Controller→Service 역방향 제어 흐름, 레이어 경계 위반 | `integrations.controller.ts:52`, `integration-oauth.service.ts` export | 서비스 내부에서 기록까지 완결(`handleCallbackError` 메서드)하거나, typed 예외 클래스로 컨트롤러가 `instanceof` 분기하도록 개선 |
| 3 | 아키텍처 | 에러 코드 추출·기록 여부 결정·HTML 렌더링 분기 등 비즈니스 결정 로직이 컨트롤러 catch 블록에 위치 | `integrations.controller.ts` catch 블록 | 에러 처리 로직을 서비스 레이어로 이동 |
| 4 | 보안 | `FRONTEND_URL`/`APP_URL` 미설정 시 `postMessage` targetOrigin이 `'*'`로 폴백 — 팝업 오픈 임의 오리진이 OAuth 콜백 페이로드(previewToken, integrationId, 에러 메시지) 수신 가능 | `integrations.controller.ts:277` | 환경 변수를 서버 시작 시 필수 검증하거나, 미설정 시 postMessage 차단 |
| 5 | 데이터베이스 | `install_token` 컬럼에 인덱스 없음 — "단일 row 조회 O(1)" 설계 근거가 실제로는 full table scan | `integration.entity.ts`, V042 migration | `WHERE install_token IS NOT NULL` 부분 UNIQUE 인덱스 추가 |
| 6 | 데이터베이스 | `pending_install` 중복 방지가 애플리케이션 레벨에만 의존 — 동시 요청 시 race condition으로 중복 행 삽입 가능 | `integrations.controller.ts`, service | DB UNIQUE 제약 또는 `INSERT ... ON CONFLICT DO NOTHING` 적용 |
| 7 | 데이터베이스 | TTL 스캐너의 `WHERE status='pending_install' AND created_at < now - 24h` 쿼리에 적합한 인덱스 없음 — 테이블 규모 증가 시 full scan | TTL 스캐너 구현, `integration.entity.ts` | `(status, created_at)` 복합 인덱스 또는 `WHERE status='pending_install'` 부분 인덱스 추가 |
| 8 | 유지보수성 | `errorCode = e.response?.code`가 NestJS `HttpException` 표준 구조(`{statusCode, message, error}`)에 `code` 필드가 없어 항상 `'OAUTH_CALLBACK_FAILED'` 폴백 → 진단 코드가 의미 없는 값으로 고정 | `integrations.controller.ts:308` | 서비스 커스텀 예외에 `errorCode` 전용 필드 추가 후 `callbackContextOf`로 추출하거나, 서비스 throw 경로에서 `response.code` 실제 설정 여부 확인 |
| 9 | 유지보수성 | `errorCode` 케이싱 미정규화 — `OAUTH_CALLBACK_FAILED`(UPPER_SNAKE)가 기존 `status_reason` 컨벤션(snake_case: `auth_failed`, `token_expired`)과 불일치하여 DB 저장값 혼재 | `integrations.controller.ts:308`, `integration-oauth.service.ts:528` | 저장 전 `errorCode.toLowerCase()` 정규화 또는 서비스 내부에서 정규화 처리 |
| 10 | 유지보수성 | 매직 스트링·숫자 산재: `'OAUTH_CALLBACK_FAILED'`, `"install_timeout"`, `4000`(ms)이 컨트롤러·FE·템플릿에 하드코딩 | `integrations.controller.ts`, `status-badge.tsx`, `oauth-callback.template.ts` | 공유 상수 파일 추출 또는 `const ERROR_CLOSE_DELAY_MS = 4000` 등 명명된 상수로 정의 |
| 11 | 유지보수성 | `status` 필드 타입이 `string` — Swagger enum에만 허용값이 문서화되고 컴파일타임 타입 안전성 없음 | `integration-response.dto.ts:35` | 엔티티의 `IntegrationStatus` 유니온 타입을 DTO에도 재사용 |
| 12 | 테스트 | FE `computeStatus` 순수 함수의 신규 분기(`pending_install + statusReason`, `expired + install_timeout`) 테스트 파일 미존재 | `status-badge.tsx`, `status-badge.spec.tsx` (미존재) | `computeStatus` 단위 테스트 신규 작성 |
| 13 | 테스트 | `handleCallback`에서 `exchangeCodeForToken` 실패 시 context 첨부 경로 미검증 (가장 빈번한 실패 시나리오) | `integration-oauth.service.spec.ts` | token exchange 실패 시 `callbackContextOf(err)?.integrationId` 검증 테스트 추가 |
| 14 | 범위 초과 | `status-badge.tsx` `expired + install_timeout` 분기는 변경 4(TTL 정리) 구현 전까지 도달 불가한 dead code — 변경 0 범위 초과 | `status-badge.tsx:46-52` | 해당 분기를 변경 4 PR로 이동하거나 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 외부 OAuth 제공자 에러 메시지가 `lastError.message`에 무검증 저장 후 API 복호화 노출 — 제공자에 따라 민감 힌트 포함 가능 | `integration-oauth.service.ts:520`, `integration-response.dto.ts` | 길이 제한(200자) 및 민감 패턴 필터링 적용, 또는 `lastError.message`를 API 응답에서 제외 |
| 2 | 보안 | `errorCode` 길이 미검증 — `statusReason varchar(64)` 초과 시 DB 에러가 묵살되어 진단 데이터 소실 | `integration-oauth.service.ts:528` | 저장 전 64자 truncate + 안전 문자 정규화: `errorCode.slice(0, 64).replace(/[^\w_-]/g, '_')` |
| 3 | UX·유지보수성 | `statusReason` 기계 코드(`oauth_token_exchange_failed`)가 UI에 그대로 노출 — `lastError.message`가 더 사람 친화적 | `status-badge.tsx:22` | `integration.lastError?.message`를 우선 표시하고 없으면 `statusReason` 폴백 |
| 4 | 요구사항 | `lastError` 필드가 DTO에 추가됐으나 `status-badge`에서 미활용 — `statusReason`(기계 코드)만 표시, `lastError.message` 무시 | `status-badge.tsx`, `integration-response.dto.ts` | plan에 `[ ] FE: lastError.message 노출` 항목 추가 또는 변경 1 범위로 명시 |
| 5 | 아키텍처·의존성 | `callbackContextOf` 서비스 내부 헬퍼가 public export되어 컨트롤러가 서비스 에러 내부 구조에 결합 | `integration-oauth.service.ts` export, `integrations.controller.ts:52` | 서비스 내부로 캡슐화 또는 typed 예외 클래스로 대체 |
| 6 | 테스트 | `callbackContextOf` 헬퍼 자체 단위 테스트 없음 — null·primitive 등 엣지 케이스 암묵적 검증 | `integration-oauth.service.ts` | `callbackContextOf` 단독 단위 테스트 추가 |
| 7 | 테스트 | missing-row context 테스트가 `ctx?.integrationId`만 검증 — `workspaceId`, `mode` 누락 검증 | `integration-oauth.service.spec.ts` | `toEqual({ integrationId, workspaceId, mode })` full shape 검증으로 교체 |
| 8 | 테스트 | template 테스트 정규식이 `function(){}` 형태에 의존, `>= 1000ms` 하한만 있고 상한 없음 | `oauth-callback.template.spec.ts:75` | 상수를 template에서 export해 테스트에서 직접 import, 정확한 값(`4000`) 검증 |
| 9 | 문서 | `setTimeout 4000ms` 선택 근거와 `pending_install` enum 의미가 코드·Swagger에 미기술 | `oauth-callback.template.ts`, `integration-response.dto.ts:35` | 1줄 주석 추가 및 `@ApiProperty description` 보강 |
| 10 | 스타일·범위 | `integration.entity.ts` `@Column` 포맷팅 전용 변경 — 기능 무관, diff 노이즈 | `integration.entity.ts:58-62` | 별도 chore 커밋으로 분리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | catch 블록 HTML 응답 차단(Critical), lastError UI 미활용, errorCode 케이싱 |
| testing | MEDIUM | 컨트롤러 에러 경로 테스트 전무(Critical), FE computeStatus 미검증 |
| concurrency | MEDIUM | catch 블록 await 예외 → 팝업 hang |
| side_effect | MEDIUM | catch 블록 await 예외 → 응답 차단, errorCode-NestJS 구조 불일치 |
| database | MEDIUM | install_token 인덱스 누락, pending_install race condition, TTL 스캐너 인덱스 누락 |
| architecture | LOW | 역방향 에러 흐름, 컨트롤러 비즈니스 로직, lastError 타입 약화 |
| maintainability | LOW | 느슨한 타입, 매직 값 산재, 인라인 에러 타입 중복 |
| api_contract | LOW | lastError Swagger 스키마 불투명, pending_install additive 변경 |
| documentation | LOW | lastError Swagger 스키마, callbackContextOf JSDoc 누락 |
| security | LOW | postMessage wildcard 폴백(환경 변수 미설정 시 MEDIUM), OAuth 에러 메시지 노출 |
| scope | LOW | expired+install_timeout dead code(변경 4 범위 초과), entity 포맷팅 노이즈 |
| dependency | NONE | 신규 외부 의존성 없음, callbackContextOf export 결합만 INFO |
| performance | NONE | 에러 경로 DB write 추가는 팝업 4초 지연 내 완료, 실질 영향 없음 |

---

## 발견 없는 에이전트
없음 — 모든 에이전트가 최소 1건 이상 발견사항을 보고함.

---

## 권장 조치사항

1. **[즉시·필수]** `markIntegrationCallbackError` 호출을 별도 try-catch로 감싸 HTML 응답 경로 보호 — DB 기록 실패가 팝업 무응답으로 이어지는 경로 차단
2. **[즉시·필수]** `integrations.controller.spec.ts` 신규 작성 — callbackContextOf context 유/무, errorCode fallback, 응답 전송 경로 각각 테스트
3. **[이번 PR]** `lastError` DTO 타입을 `{ code: string; message: string; at: string } | null`로 구체화, Swagger `properties` 명시
4. **[이번 PR]** `errorCode` NestJS 예외 구조 불일치 해소 — 서비스 throw 경로에서 `response.code` 실제 설정 여부 확인 및 케이싱 정규화(`.toLowerCase()`)
5. **[이번 PR]** `status-badge.tsx` `expired + install_timeout` 분기 제거 또는 변경 4 PR로 이동 (현재 dead code)
6. **[마이그레이션 추가]** `install_token` UNIQUE 부분 인덱스(`WHERE install_token IS NOT NULL`), TTL 스캐너용 `(status, created_at)` 인덱스 추가
7. **[이번 PR 또는 후속]** `postMessage` targetOrigin 환경 변수 미설정 시 서버 시작 실패 처리 (`'*'` 폴백 제거)
8. **[후속]** `callbackContextOf` export + 컨트롤러 재호출 패턴을 서비스 `handleCallbackError` 메서드로 캡슐화 (아키텍처 정리)
9. **[후속]** `pending_install` 중복 방지를 DB UNIQUE 제약으로 강화 (race condition 근본 해소)
10. **[후속]** `status-badge.tsx` FE computeStatus 단위 테스트 추가, `lastError.message` 우선 표시 검토