# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `statusReason = 'token_expired'` 이 spec 에서 명시적으로 폐기된 설계를 부활시키며 DB 에 spec 외 값이 기록됨. 나머지 변경(isRefreshCapable 일반화, 큐 레지스트리 추가, 문서 동기화)은 전반적으로 양호.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `statusReason = 'token_expired'` 이 spec `data-flow/5-integration.md §1.4 Rationale` 에서 명시적으로 폐기(deprecated)된 설계를 부활시킴. spec §3.2 표는 0d 격하 시 `status_reason=NULL`, 시퀀스 다이어그램도 `status_reason=NULL` 로 명문화. `integration-status-reason.ts` 에 `'token_expired'` union 추가까지 포함해 DB 에 spec 외 값이 기록됨 | `integration-expiry-scanner.service.ts` 0d 격하 분기; `integration-status-reason.ts`; `integration-expiry-scanner.service.spec.ts` 어설션 다수 | `statusReason = null` 로 되돌리고 `'token_expired'` union 항목 제거. union 에 추가하려면 `project-planner` 에게 spec Rationale 폐기 해제 + §3.2 표·§1.4 시퀀스 갱신 위임 후 구현 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec `2-navigation/4-integration.md §11.1` pseudocode·표가 refresh-capable 알림 제외 정책을 미반영. §11.1 표에 `+ 알림` 표기가 남아있고 MakeShop 블록도 알림 제외를 명시하지 않음. 코드 구현(§11.2 기반 알림 제외)이 올바르며 spec §11.1 이 낡아 있는 것 | `spec/2-navigation/4-integration.md §11.1` 표 동작 열 첫 번째 분기, pseudocode line 968, MakeShop 블록 | 코드 유지. `spec/2-navigation/4-integration.md §11.1` 에서 `+ 알림` 표기를 제거하고 "refresh-capable provider 는 claim·알림 모두 스킵 (§11.2 참조)" 로 갱신 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/5-integration.md §1.4` 의 "알려진 구현 갭" callout 과 표·시퀀스 다이어그램이 `isCafe24RefreshCapable` 기준으로 기술돼 있어 `isRefreshCapable`(cafe24+makeshop) 로 확장된 코드와 불일치. CRITICAL #1 이 해소되면 §1.4 갱신이 필요 | `spec/data-flow/5-integration.md §1.4` 표, 시퀀스 다이어그램, Rationale "폐기" 섹션 | CRITICAL #1 확정 후 `data-flow/5-integration.md §1.4` 의 callout 제거, 표·시퀀스를 `isRefreshCapable` 기반으로 갱신 |
| 3 | Requirement | spec §11.1 표의 `connected-expiry` 동작에 makeshop refresh-capable 분기 누락. 테스트가 spec 본문에 없는 동작을 검증하는 형태 | `integration-expiry-scanner.service.spec.ts` V-01 테스트; `spec/2-navigation/4-integration.md §11.1` | spec §11.1 갱신 후 해소됨. 테스트 코드는 그대로 유지 |
| 4 | Maintainability | `isRefreshCapable` 의 부정형 OR 조건(`serviceType !== 'cafe24' && serviceType !== 'makeshop'`)은 새 provider 추가 시 묵시적으로 `false`(비-refresh-capable) 처리되는 확장 취약성. 누락이 런타임 버그로 이어짐 | `integration-expiry-scanner.service.ts` `isRefreshCapable` 함수 | `REFRESH_CAPABLE_SERVICE_TYPES = new Set(['cafe24', 'makeshop'])` 상수 허용 목록(allowlist)으로 교체 |
| 5 | Maintainability | `§11.2 의도적 설계` 블록 주석 8줄이 `run()` 루프 흐름 중간에 삽입돼 핵심 제어 흐름(`continue`) 가독성 저해 | `integration-expiry-scanner.service.ts` diff +419~+425 | `continue` 직전 한 줄 요약 주석만 남기고 나머지는 `isRefreshCapable` JSDoc 과 통합 |
| 6 | Documentation | `spec/data-flow/5-integration.md` Rationale 절의 "폐기된 옛 서술" 단락이 이력 중심 서술로 처음 독자에게 현행 동작보다 과거 상황 비중이 높아 가독성 저하 | `spec/data-flow/5-integration.md` Rationale | "2026-06-10 V-01·V-07 fix: `isCafe24RefreshCapable` → `isRefreshCapable` 일반화, `status_reason='token_expired'` 추가됨. §1.4 가 현행 SoT." 형태로 간결하게 재작성 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `credentials` 필드를 `as Record<string, unknown>` 타입 캐스팅으로 접근. 기존 패턴 계승이며 null-check·타입 가드 존재 시 추가 위험 없음 | `integration-expiry-scanner.service.ts` `isRefreshCapable` | `creds` null-check + `refresh_token` 타입 검사가 명시적으로 수행됨을 확인할 것 |
| 2 | Security | 테스트 픽스처에 `access_token: 'a'`, `refresh_token: 'mk-refresh'` 등 짧은 플레이스홀더 사용. 실 토큰이 아닌 명백한 더미이나 향후 명칭 표준화 권장 | `integration-expiry-scanner.service.spec.ts` | 향후 `test-access-token`, `test-refresh-token` 형식으로 표준화 |
| 3 | Security | `token_expired` 슬러그가 JWT REST 에러 코드 `TOKEN_EXPIRED` 및 WS 이벤트와 표기 유사. 현재 주석·spec 에 명시됐으며 `normalizeStatusReason` fallback 존재 | `integration-status-reason.ts` `token_expired` 추가 | API 응답 DTO 클라이언트 파싱에서 케이스 처리가 명확히 구분됨을 확인 |
| 4 | Security | 에러 로그에 `integration.id`(UUID) 노출. 내부 운영 로그이며 외부 API 응답에 미노출. `err instanceof Error ? err.message : String(err)` 패턴으로 안전 처리 | `integration-expiry-scanner.service.ts` logger.warn | 로그 집계 시스템에서 integration ID가 PII와 결합되지 않도록 접근 권한 제한 권장 |
| 5 | Side Effect | `statusReason` 값이 기존 `null` → `'token_expired'` 로 바뀌어 API 응답 소비자(프론트엔드 switch 분기)가 `'token_expired'` 수신 가능. `normalizeStatusReason` 이 흡수하나 UI 분기 누락 잠재 위험 | `integration-expiry-scanner.service.ts` 0d 격하 분기 | 프론트엔드 `statusReason` 표시 로직에 `'token_expired'` fallback이 존재하는지 확인 |
| 6 | Side Effect | `integration_expiry_dispatch` 테이블에 refresh-capable provider(cafe24·makeshop)의 claim 이 생성되지 않음. diff 범위 내 다른 consumer 미확인이나 확인 권장 | `integration-expiry-scanner.service.ts` `run()` 루프 | `integration_expiry_dispatch` 의 다른 consumer 부재 확인 |
| 7 | Requirement | user-facing docs 에서 갱신 실패 시 `integration_action_required` 알림 발송 기술. spec §11.2 가 makeshop auth_failed 전이 시 notifier 호출 여부를 명시하지 않아 docs 가 overpromise 가능성 | `makeshop.en.mdx`, `makeshop.mdx`, `integration-management.mdx` | `spec/2-navigation/4-integration.md §11.2` `integration_action_required` 발사 정책이 makeshop 을 명시적으로 커버하는지 확인 후 필요 시 spec 갱신 |
| 8 | Testing | 0d makeshop+refresh_token 케이스에서 dedup claim 미생성 단언(`dispatchRepo.__insertBuilder.values` not.toHaveBeenCalled) 누락. 7d·3d 임계 테스트에는 있으나 0d 케이스에만 빠짐 | `integration-expiry-scanner.service.spec.ts` V-01 makeshop+refresh_token 0d 테스트 | `expect(dispatchRepo.__insertBuilder.values).not.toHaveBeenCalled()` 추가 |
| 9 | Testing | `integration-status-reason.ts` 에 대한 직접 단위 테스트 없음. `normalizeStatusReason('token_expired')` → `'token_expired'`, `normalizeStatusReason('unknown_slug')` → `'unknown_error'` 등 직접 검증 부재 | `integration-status-reason.ts` | `integration-status-reason.spec.ts` 신설해 normalizeStatusReason 3케이스 검증 권장 |
| 10 | Testing | `hasSavedExpired` 헬퍼가 `save(Array<{status?}>)` 구조를 가정. `call[0]` 이 객체 단건일 때 `false` 를 반환해 오탐 가능 | `integration-expiry-scanner.service.spec.ts` `hasSavedExpired` 함수 | 헬퍼 내부 주석에 `save(array)` 구조 의존 명시. 방어 분기 추가 고려 |
| 11 | Testing | `system-status.constants.spec.ts` 신설 spec 이 cafe24·makeshop 두 큐에 집중하며 `INTEGRATION_EXPIRY_QUEUE` 등 다른 큐의 포함 여부 미검증. e2e `EXPECTED_QUEUE_NAMES` 와 3-point sync 부담 남음 | `system-status.constants.spec.ts` | MONITORED_QUEUES 길이 단언 또는 전체 큐 이름 스냅샷 테스트 추가 고려 |
| 12 | Maintainability | 테스트 내 `5 * 24 * 60 * 60 * 1000`, `2 * 24 * 60 * 60 * 1000` 반복 매직 넘버 | `integration-expiry-scanner.service.spec.ts` diff +272, +311 | `MS_PER_DAY = 24 * 60 * 60 * 1000` 상수 추출 |
| 13 | Maintainability | `userRepo.find.mockResolvedValue([{ id: 'user-1', notificationPreferences: {} }])` 패턴이 신규 4개 테스트에 반복 | `integration-expiry-scanner.service.spec.ts` 신규 케이스 | `beforeEach` default mock 으로 이동 또는 `userFixture()` 헬퍼 추출 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `token_expired` slug 가 spec 에서 명시 폐기된 설계 부활(CRITICAL); spec §11.1 pseudocode·§1.4 표 SPEC-DRIFT 2건 |
| security | NONE | credentials 접근 패턴 안전, 테스트 픽스처 더미값 적절, 로그 패턴 적절 |
| scope | NONE | 18개 변경 파일 전체 V-01·V-07·V-15 범위 내 |
| side_effect | LOW | statusReason null→token_expired 로 인한 API 소비자 영향 잠재, integration_expiry_dispatch consumer 확인 권장 |
| maintainability | LOW | isRefreshCapable 부정형 OR 조건 확장 취약성(WARNING), 블록 주석 가독성 저해(WARNING) |
| testing | LOW | 0d 케이스 dedup claim 미단언, normalizeStatusReason 직접 테스트 부재, hasSavedExpired 구조 가정 미명시 |
| documentation | LOW | spec Rationale 이력 단락 가독성 저하(WARNING); 나머지 JSDoc·MDX·plan 문서 품질 우수 |
| user_guide_sync | NONE | 매트릭스 19개 트리거 중 integration-provider-change 1개 매칭, MDX 4파일 ko/en 패리티 충족, 동반 갱신 누락 0건 |

## 발견 없는 에이전트

- **user_guide_sync**: 동반 갱신 누락 0건. MDX ko/en 패리티 충족.
- **scope**: 범위 이탈 없음.
- **security**: Critical/Warning 발견 없음.

## 권장 조치사항
1. **[필수 — CRITICAL]** `integration-expiry-scanner.service.ts` 의 `statusReason = 'token_expired'` 를 `statusReason = null` 로 되돌리고, `integration-status-reason.ts` 에서 `'token_expired'` 를 union 및 배열에서 제거한다. 테스트의 `statusReason: 'token_expired'` 어설션을 `statusReason: null` 로 수정한다.
2. **[필수 — spec 갱신 위임]** `project-planner` 에게 위임: `spec/2-navigation/4-integration.md §11.1` 의 `+ 알림` 표기 제거 + "refresh-capable provider 는 claim·알림 모두 스킵 (§11.2 참조)" 갱신 (SPEC-DRIFT WARNING #1).
3. **[필수 — spec 갱신 위임]** CRITICAL #1 해소 후 `project-planner` 에게 위임: `spec/data-flow/5-integration.md §1.4` 의 갭 callout 제거 + 표·시퀀스를 `isRefreshCapable`(cafe24+makeshop) 기반으로 갱신 (SPEC-DRIFT WARNING #2).
4. **[권장]** `isRefreshCapable` 의 부정형 OR 조건을 `REFRESH_CAPABLE_SERVICE_TYPES = new Set(['cafe24', 'makeshop'])` 허용 목록으로 교체해 확장 취약성 제거 (Maintainability WARNING).
5. **[권장]** `integration-expiry-scanner.service.ts` 의 8줄 블록 주석을 `continue` 직전 한 줄 요약으로 압축하고 나머지를 `isRefreshCapable` JSDoc 으로 이동 (Maintainability WARNING).
6. **[권장]** 0d makeshop+refresh_token 테스트에 `expect(dispatchRepo.__insertBuilder.values).not.toHaveBeenCalled()` 추가 (Testing INFO).
7. **[선택]** `integration-status-reason.spec.ts` 신설해 `normalizeStatusReason` 3케이스 직접 검증 (Testing INFO).
8. **[선택]** `spec/data-flow/5-integration.md` Rationale 이력 단락을 간결하게 재작성 (Documentation WARNING).

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명, 전부 router_safety 강제 포함)
- **제외**: 아래 표 (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |