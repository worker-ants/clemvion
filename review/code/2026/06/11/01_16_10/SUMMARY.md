# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 유저 가이드 동반 갱신 누락(makeshop·integration-management 문서 2건)이 사용자 혼란을 유발할 수 있으며, 테스트 헬퍼의 단일 호출 가정 미명시가 잠재적 silent false-negative 위험을 내포함. 기능·보안·아키텍처 관점에서의 Critical 이슈는 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | USER_GUIDE_SYNC | makeshop expiry 정책 변경 — `makeshop.{mdx,en.mdx}` 동반 갱신 누락. refresh_token 보유 시 `expired` 격하·passive 알림 미발사 동작이 문서에 반영되지 않아 "알림이 안 왔는데 왜?" 혼란 유발 가능 | `codebase/frontend/src/content/docs/06-integrations-and-config/makeshop.mdx` / `makeshop.en.mdx` | "토큰 갱신 및 만료" 절 신설 — refresh_token 보유 시 passive 알림 미발사, refresh_token 없는 경우만 expired 전이 + 알림 발사 명기 |
| 2 | USER_GUIDE_SYNC | `integration-management.{mdx,en.mdx}` — "expired 상태 진입 시 알림 발사" 서술이 partial-truth로 stale 상태. cafe24·makeshop + refresh_token 통합은 access_token 만료에도 알림 미발사임이 미반영 | `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` / `integration-management.en.mdx` (L71 callout) | "refresh_token 자동 갱신 지원 통합은 passive 알림 없음, 자동 갱신 실패 시만 error 전이 + active 알림" 문구 보완 |
| 3 | TESTING | `getNotifResourceIds` 헬퍼가 `createMany`의 첫 번째 호출(`mock.calls[0][0]`)만 검사. 단일 호출 가정이 함수명·JSDoc에 명시되지 않아 향후 다중 배치 경로에서 silent false-negative 위험 | `integration-expiry-scanner.service.spec.ts` L44–52 | `mock.calls.flatMap(c => c[0])` 방식으로 전체 호출 통합 검사 또는 JSDoc에 `@remarks Inspects the first createMany call only.` 명시 |
| 4 | TESTING | `hasSavedExpired` 헬퍼도 `save()`의 첫 번째 호출만 검사. 동일한 단일 호출 가정 미명시 | `integration-expiry-scanner.service.spec.ts` L58–66 | `mock.calls.some(call => ...)` 형태로 전체 호출 체크 |
| 5 | TESTING | cafe24 7d·makeshop 3d 임계 알림 면제 테스트가 `getNotifResourceIds` 헬퍼 대신 `mock.calls[0]?.[0]` 직접 접근. 파일 내 패턴 불일치로 W-4 목적(반복 패턴 추출) 퇴색 | `integration-expiry-scanner.service.spec.ts` L306–308, L342–344 | `expect(getNotifResourceIds(notificationsService)).not.toContain(...)` 패턴으로 교체하여 스타일 통일 |
| 6 | MAINTAINABILITY | `integration-status-reason.ts`의 `token_expired` 인라인 주석이 spec 링크·namespace 구분·적용 조건을 한 줄에 담아 라인 길이가 파일 내 다른 항목(`auth_failed`, `install_timeout` 등)과 현저히 불일치. linter `max-len` 규칙 위반 가능성 | `integration-status-reason.ts` L1008 (`token_expired` 항목) | 기본 한 줄 설명만 유지하고 namespace 충돌 경고는 별도 JSDoc 블록 또는 추가 주석 라인으로 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | PERFORMANCE | `resolveRecipients` 선행 루프가 refresh-capable 행에 대해서도 실행된 후 `continue`로 skip되는 순서 비효율. refresh-capable 비율이 높을수록 workspace admin 조회 포함 낭비 증가 | `integration-expiry-scanner.service.ts` `run()` | `resolveRecipients` 루프를 두 번째 루프 안으로 이동하거나, 첫 번째 루프에서 `isRefreshCapable` 선행 체크하여 skip |
| 2 | PERFORMANCE | `enqueueCafe24BackgroundRefresh`에서 `for...of` 순차 `await` Redis enqueue. 수백 건 이상 targets 시 직렬 대기 누적 지연 가능 | `integration-expiry-scanner.service.ts` `enqueueCafe24BackgroundRefresh()` | `Promise.all` 또는 p-limit 기반 제한 병렬화 검토 (운영 규모 파악 후 적용) |
| 3 | ARCHITECTURE | `isRefreshCapable` provider 목록이 3개 이상으로 늘어날 경우 함수 본체 수정 필요. 현재 규모에서는 허용 범위 | `integration-expiry-scanner.service.ts` `isRefreshCapable` 함수 | provider 추가 시 `REFRESH_CAPABLE_SERVICE_TYPES = new Set([...])` 상수 추출 고려 |
| 4 | ARCHITECTURE | 큐 추가 시 (1) `system-status.constants.ts`, (2) `test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES`, (3) spec `data-flow/0-overview.md §4` 세 곳 수동 동기화 필요. 이번 PR에서 `system-status.constants.spec.ts` 신설로 단위 테스트 보강됨 | `system-status.constants.ts`, `test/system-status.e2e-spec.ts` | 장기적으로 e2e spec이 `MONITORED_QUEUES`를 직접 import 가능하도록 모듈 의존 그래프 정리 고려 |
| 5 | DATABASE | 기존 DB의 `status='expired', status_reason=NULL` 레거시 행이 신규 `token_expired` 행과 혼재. 코드 변경만으로 backfill 없음 | `integrations` 테이블 기존 행 | UI 필터링·분석 요건에 따라 `UPDATE integration SET status_reason='token_expired' WHERE status='expired' AND status_reason IS NULL AND service_type NOT IN ('cafe24','makeshop')` 선택적 backfill 검토 |
| 6 | SIDE_EFFECT | 기존 refresh-capable 행에 대해 이미 생성된 `integration_expiry_dispatch` claim이 orphan으로 잔존. 재발사·격하 기능 부작용은 없으나 데이터 누적 | `integration_expiry_dispatch` 테이블 | 별도 prune 패스 고려 (현재 변경 범위 밖) |
| 7 | USER_GUIDE_SYNC | `statusReason: 'token_expired'`의 i18n dict 미등록. 현재 `status-badge.tsx` expired 분기에서 직접 노출 경로는 없으나, 향후 error 상태와 혼용 시 raw 값 노출 가능성 | `codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts` | `statusReasonTokenExpired` 키 예방적 등록 권장 |
| 8 | DOCUMENTATION | 테스트 헬퍼 JSDoc(`getNotifResourceIds`, `hasSavedExpired`)이 구현 이력 서술에 치우쳐 있어 JSDoc 본래 목적(사용법·반환값)을 넘어섬 | `integration-expiry-scanner.service.spec.ts` L35–57 | 약점 설명 제거하고 반환값·주의사항 위주로 압축 |
| 9 | DOCUMENTATION | `isRefreshCapable` JSDoc에 "향후 다른 provider 추가 시 여기에 추가" 확장 지침 포함. 모듈 내부 헬퍼에 공개 API 문서 수준의 서술 | `integration-expiry-scanner.service.ts` `isRefreshCapable` JSDoc | 확장 지침은 `TODO:` 주석 또는 spec 위임, JSDoc에는 현재 동작만 기술 |
| 10 | DOCUMENTATION | `spec/2-navigation/4-integration.md`의 `isRefreshCapable` 결정 섹션이 spec 3섹션 구성 규약(Overview / 본문 / Rationale)상 `## Rationale` 하위가 아닌 §11.2 뒤에 위치 | `spec/2-navigation/4-integration.md` L1927–1933 | 해당 소항목을 문서 말미 `## Rationale` 영역으로 이동 검토 (현 위치도 수용 가능) |
| 11 | TESTING | `isRefreshCapable`에 대한 직접 단위 테스트 없음. `credentials=null`, 신규 `serviceType` 등 경계값이 간접 검증만 됨 | `integration-expiry-scanner.service.ts` `isRefreshCapable` 함수 | 향후 provider 추가 시 경계값 테스트 추가 권장 |
| 12 | TESTING | `system-status.constants.spec.ts`가 `CAFE24_REFRESH_QUEUE`·`MAKESHOP_REFRESH_QUEUE`만 존재·속성 검증. 다른 큐(예: `INTEGRATION_EXPIRY_QUEUE`)의 group/concurrency 정합은 미검증 | `system-status.constants.spec.ts` | 필요 시 전체 큐 속성 정합 검증으로 확장 |
| 13 | MAINTAINABILITY | 테스트 내 밀리초 계산(`5 * 24 * 60 * 60 * 1000` 등)이 여러 곳에 인라인 반복. 서비스 파일의 `DAY_MS` 상수와 중복 | `integration-expiry-scanner.service.spec.ts` L277, L316 | 테스트 파일 최상단에 `const DAY_MS = 24 * 60 * 60 * 1000` 선언하고 참조 일원화 |
| 14 | REQUIREMENT | spec §11.2의 `재인증 실패 → Reauthorization failed` 행과 `integration_action_required` active 알림 간 책임 경계 모호. 코드 직접 결함은 아님 | `spec/2-navigation/4-integration.md` §11.2 표 | project-planner가 §11.2 표의 `재인증 실패` 행 책임을 명확히 할 것 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 모든 DB 쿼리 parameterized binding 정상, 하드코딩 시크릿 없음, normalizeStatusReason whitelist 정상 |
| performance | LOW | resolveRecipients 선행 루프 순서 비효율, enqueueCafe24BackgroundRefresh 순차 enqueue 잠재 병목 |
| architecture | NONE | isRefreshCapable 일반화 OCP 개선, 레이어 책임 분리 적절, MONITORED_QUEUES 동기화 보강 |
| requirement | NONE | spec §11.1/§11.2/§1-data-model 전 항목 line-level 일치, V-01/V-07/V-15 결함 수정 확인 |
| scope | NONE | 선언된 변경 의도(V-01/V-07/V-15 + spec 동기화)와 일치, 불필요 리팩토링 없음 |
| side_effect | LOW | orphan claim 잔존(기능 부작용 없음), statusReason null→token_expired DB 쓰기는 의도된 변경 |
| maintainability | LOW | getNotifResourceIds 제약 미명시, 신규 W-2 테스트의 헬퍼 미사용 패턴 불일치, token_expired 주석 과도한 길이 |
| testing | LOW | getNotifResourceIds/hasSavedExpired 단일 호출 가정 미명시, W-2 테스트 헬퍼 미사용 패턴 불일치 |
| documentation | LOW | 테스트 헬퍼 JSDoc 이력 서술 치중, token_expired 주석 비일관성, isRefreshCapable 결정 섹션 위치 미묘 |
| database | NONE | 스키마 변경 없음, parameterized binding 정상, 레거시 NULL 행 backfill은 선택적 검토 사항 |
| concurrency | NONE | claimThreshold INSERT ON CONFLICT, expirePendingInstalls bulk UPDATE, BullMQ jobId dedup 모두 정상 |
| api_contract | NONE | HTTP 엔드포인트 변경 없음 — API 계약 검토 대상 아님 |
| user_guide_sync | MEDIUM | makeshop.mdx/integration-management.mdx 동반 갱신 누락 (WARNING 2건), token_expired i18n 미등록 (INFO) |

---

## 발견 없는 에이전트

- **api_contract**: 변경 범위가 내부 BullMQ 스캐너로 HTTP 엔드포인트 미포함 — API 계약 검토 해당 없음

---

## 권장 조치사항

1. **[필수] 유저 가이드 동반 갱신** — `makeshop.mdx` / `makeshop.en.mdx` 에 "refresh_token 보유 시 passive 알림 미발사" 동작 설명 절 신설. `integration-management.mdx` / `.en.mdx` callout에 "refresh_token 자동 갱신 지원 통합은 passive 알림 없음" 문구 보완. (WARNING #1, #2)
2. **[권장] 테스트 헬퍼 견고성 개선** — `getNotifResourceIds`를 `flatMap` 기반 전체 호출 통합 검사로 교체하고, cafe24 7d/makeshop 3d 테스트도 동일 헬퍼 사용으로 통일. (WARNING #3, #4, #5)
3. **[권장] `token_expired` 주석 정리** — `integration-status-reason.ts` L1008 인라인 주석을 짧은 설명 한 줄로 압축하고, namespace 경고는 별도 블록 주석으로 분리. (WARNING #6)
4. **[선택] i18n 예방적 등록** — `token_expired` statusReason에 대한 `statusReasonTokenExpired` 키를 `{ko,en}/integrations.ts`에 예방적으로 등록. (INFO #7)
5. **[선택] 레거시 데이터 backfill 검토** — `status='expired' AND status_reason IS NULL AND service_type NOT IN ('cafe24','makeshop')` 행에 대한 `token_expired` backfill 마이그레이션 필요 여부 팀 판단. (INFO #5)
6. **[선택] 테스트 `DAY_MS` 상수 일원화** — 테스트 파일 최상단에 `const DAY_MS` 선언하여 인라인 밀리초 계산 중복 제거. (INFO #13)

---

## 라우터 결정

라우터 선별 실행됨.

- **실행** (13명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync
- **제외** (1명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단에 의해 생략 |

- **강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)