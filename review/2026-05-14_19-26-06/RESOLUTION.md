# AI Review Resolution — 2026-05-14_19-26-06 (Batch 1 / 구현 코드)

`review/2026-05-14_19-26-06/SUMMARY.md` 의 Critical 2건 + Warning 14건 + Info 10건 처리 결과.

## Critical

| # | 항목 | 조치 |
|---|------|------|
| 1 | `markIntegrationCallbackError` await throw → catch 블록 HTML 응답 미실행 (popup hang) | **조치 완료** — `integrations.controller.ts` 의 catch 블록에서 호출을 `.catch(() => {})` 로 감싸 defense-in-depth. markIntegrationCallbackError 자체도 이미 내부 try/catch 로 best-effort 동작. controller spec 신규 케이스 "still renders HTML response even if recording throws unexpectedly" 가 회귀 보호. |
| 2 | 컨트롤러 에러 경로 테스트 전무 | **조치 완료** — `backend/src/modules/integrations/integrations.controller.spec.ts` 신규 작성. 5 케이스: (a) context 있을 때 markIntegrationCallbackError 호출 + HTML 응답 (b) context 없을 때 호출 안 함 (c) recording throw 해도 HTML 응답 (d) errorCode fallback `OAUTH_CALLBACK_FAILED` (e) FRONTEND_URL/APP_URL 미설정 시 500. |

## Warning (변경 0 PR 내 조치)

| # | 항목 | 조치 |
|---|------|------|
| W4 | postMessage `'*'` 폴백 보안 | **조치 완료** — FRONTEND_URL/APP_URL 둘 다 미설정 시 500 fail-closed. wildcard 폴백 제거. controller spec 의 "fails closed when FRONTEND_URL and APP_URL are both missing" 가 회귀 보호. |
| W11 | DTO `status: string` 타입 약화 | **조치 완료** — `IntegrationStatus` 유니온을 `dto/responses/integration-response.dto.ts` 에서 재사용. 컴파일타임 안전성 확보. |
| W12 | FE `computeStatus` 신규 분기 테스트 부재 | **조치 완료** — `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` 신규. 6 케이스 (connected / pending_install default / pending_install + statusReason 진단 노출 / error / needs_reauth / expired). |
| W13 | exchangeCodeForToken 실패 시 context 부착 미검증 | **조치 완료** — `integration-oauth.service.spec.ts` 에 "attaches callback context on token exchange failure" 케이스 추가. global.fetch 모킹으로 401 강제 → context shape 검증 + `OAUTH_TOKEN_EXCHANGE_FAILED` 코드 동시 검증. |
| W14 | `expired + install_timeout` 분기 dead code (변경 4 범위 초과) | **조치 완료** — `status-badge.tsx` 의 분기 제거. 변경 4 (TTL 정리) 구현 시 다시 추가하도록 plan 변경 4 에 등재 예정. |

## Warning (후속 위임)

| # | 항목 | 위임 대상 |
|---|------|----------|
| W1 | `lastError` DTO 타입 `Record<string, unknown>` | 별도 type-tightening PR 또는 변경 5 테스트 보강 시 — plan 후속 항목. 본 PR 의 `markIntegrationCallbackError` 가 `{code, message, at}` shape 으로 일관 저장하므로 런타임 안전성은 확보. |
| W2 / W3 | Service→Controller→Service 역방향 흐름 / 컨트롤러 catch 비즈니스 로직 | 본 PR 은 minimum-viable 으로 service 의 export 헬퍼 + controller catch 분기 구조 유지. typed exception 클래스 또는 service `handleCallbackWithErrorCapture` 래퍼로 캡슐화하는 리팩토링은 별도 PR — plan 후속 항목으로 등재. 현재 구조는 callbackContextOf + markIntegrationCallbackError 가 명시적 public API 라 호출자가 명시 적용 — 동작 정합성은 보장. |
| W5 | install_token 인덱스 부재 | 변경 2 구현에서 V0XX 마이그레이션으로 추가 — plan 변경 2 의 인덱스 추가 체크박스. |
| W6 | pending_install 중복 방지 race condition | 변경 3 (중복 방지) 구현 범위 — plan 변경 3. |
| W7 | TTL 스캐너 쿼리 인덱스 부재 | 변경 4 구현 시 `(workspace_id, status)` 가 이미 커버 (spec 1-data-model §3 갱신 완료). 본 PR 추가 작업 없음. |
| W8 | errorCode `e.response?.code` NestJS 표준 미부합 | service 가 throw 하는 BadRequestException 은 `new BadRequestException({code, message})` 형태로 생성되어 `response.code` 가 설정됨. 신규 spec 의 "attaches callback context on token exchange failure" 테스트가 `response.code === 'OAUTH_TOKEN_EXCHANGE_FAILED'` 를 명시적으로 검증 — 회귀 보호 확보. controller spec 의 (d) 케이스가 fallback 도 검증. |
| W9 | errorCode 케이싱 비정규화 | service `markIntegrationCallbackError` 는 UPPER_SNAKE_CASE 입력을 받아 `last_error.code` 는 그대로 유지, `status_reason` 은 `errorCode.toLowerCase()` 적용. spec §10.4 의 정책과 일치. |
| W10 | 매직 스트링·숫자 산재 | 별도 cleanup PR — plan 후속 항목. `ERROR_CLOSE_DELAY_MS = 4000`, `OAUTH_CALLBACK_FAILED` 등 상수화. |

## Info — 후속 처리

| # | 항목 | 처리 |
|---|------|------|
| 1 | 외부 provider 에러 메시지 무검증 저장 | 변경 5 보강 시 길이 제한·민감 패턴 필터링 추가 — plan 후속 항목. |
| 2 | errorCode 길이 미검증 (`varchar(64)` 초과) | 동일. |
| 3 | UX: 기계 코드 노출 — `lastError.message` 우선 표시 | 변경 1 (FE 폴링) 구현 시 함께 처리 — plan 변경 1 에 추가. |
| 4 | `lastError` FE 미활용 | 동일 (변경 1). |
| 5 | `callbackContextOf` export 결합 | W2/W3 와 동일 — 별도 리팩토링 PR. |
| 6 | `callbackContextOf` 자체 단위 테스트 | 신규 spec 의 "does NOT attach context for state-mismatch" 가 간접 검증 (undefined 반환 경로). |
| 7 | missing-row context 테스트 partial shape | 본 PR 에서 보강 — `toEqual({ integrationId, workspaceId, mode })` full shape. |
| 8 | template 테스트 정규식 (function(){} 의존, 상한 없음) | template export 상수화는 W10 cleanup 과 함께 후속. 현재는 `>= 1000ms` 하한 확인으로 회귀 방지 충분. |
| 9 | setTimeout 4000ms 근거·pending_install enum 의미 docstring | template 의 `closeScript` 직전 주석으로 사유 명시 완료. enum 의미는 DTO 의 `@ApiProperty description` 갱신 완료. |
| 10 | `integration.entity.ts` @Column 포맷팅 chore | eslint --fix 부산물. 별도 분리 비용 > 가치라 본 커밋에 동봉. |

