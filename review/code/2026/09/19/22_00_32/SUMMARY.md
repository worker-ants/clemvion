# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 코드 자체(SSRF 가드 판정 로직)는 1라운드 WARNING 7건이 전부 실제로 조치됐고 회귀 없음(security/requirement/scope 확인). 다만 유저 가이드가 Email(SMTP)이 이제 HTTP·DB와 같은 사설망/CGNAT 차단 가드를 공유한다는 사용자 가시적 동작 변화를 반영하지 못해 MEDIUM WARNING, 그 외 아키텍처 일관성·JSDoc 정확성·테스트 커버리지 갭 4건이 LOW WARNING. forced 화이트리스트(7명) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서-동기화(user_guide_sync) | 통합 관리 유저 가이드가 "Database·HTTP만 사설/loopback 차단"이라고 적어, 이번 PR로 Email(SMTP)도 동일 가드(사설망·loopback·CGNAT)를 공유하게 됐다는 사용자 가시 사실이 누락됨. CHANGELOG는 이 동작 변화를 명시하지만 유저 가이드는 갱신되지 않아, 자체 호스팅 SMTP relay 운영자가 연결 테스트 실패 원인을 문서에서 찾을 수 없음 | `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx:80`, `integration-management.en.mdx:69` | 두 문장에 "Email(SMTP)"를 Database·HTTP 목록에 추가하고, `ALLOW_PRIVATE_HOST_TARGETS` 예외가 Email에도 적용됨을 명시 |
| 2 | 아키텍처 | 신규 `SsrfBlockedError` 타입 판별 계약(`instanceof`)이 5개 소비자 중 `smtp-host-guard.ts` 1곳에만 적용됨. 나머지 4곳(`http-request.handler.ts`, `database-connection-tester.ts`, `database-query.handler.ts`, `http-redirect.ts`)은 여전히 "무슨 예외든 SSRF 차단으로 승격"하는 blanket catch — 현재는 두 안전 함수가 그 클래스 외엔 던지지 않아 동작 회귀는 없으나, 새 타입 계약이 코드베이스 전체에 강제되지 않음 | `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts:24-29`(신규 패턴) vs 위 4개 파일(기존 catch-all) | 4개 기존 소비자도 `instanceof SsrfBlockedError` 아니면 rethrow 패턴으로 통일하는 후속 작업을 트래커에 등재 |
| 3 | 문서화 | `http-safety.ts` 모듈 JSDoc에 삽입된 "공용인데 `http-request/` 폴더에 있는 이유" 한국어 문단이 문단 구분(빈 줄) 없이 기존에 이어져 있던 영어 문장(`Blocks URLs...` → `Intended for Integration-backed requests...`) 사이에 끼어들어, 폴더 위치 설명과 목적 설명이 한 문단처럼 오독됨 | `codebase/backend/src/nodes/integration/http-request/http-safety.ts:11-15` | 두 문단 사이에 빈 줄을 넣어 분리하거나, 한국어 문단을 JSDoc 맨 끝으로 이동해 원래 영어 문장 흐름 복원 |
| 4 | 문서화 | 같은 JSDoc 문단이 "중립 위치로 옮기는 것은 트래커에 따로 있다"고 현재형으로 단언하지만, 실제로 그 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에는 해당 항목이 없음(grep 0건) — 등재는 이 plan의 마무리 커밋 시점으로 예정된 상태(`RESOLUTION.md` W2: "트래커 등재(마무리 커밋)", plan 체크리스트 마지막 항목 미완료) | `codebase/backend/src/nodes/integration/http-request/http-safety.ts:11-13` | 문구를 "…트래커에 등재할 예정이다"로 정정하거나, 이 plan을 닫는 커밋에서 실제로 트래커 항목을 추가해 JSDoc 서술과 실제 상태를 일치 |
| 5 | 테스트 | 신규 `canonicalIPv6`의 "파서가 거부하는 입력은 원문 그대로 반환" 폴백(catch 블록) 분기가 스위트 전체에서 한 번도 실행되지 않음(dead-in-tests) — 뮤테이션 검증 결과 `stripped` 대신 `''`을 반환하도록 깨도 관련 52개 테스트가 전부 GREEN | `codebase/backend/src/nodes/integration/http-request/http-safety.ts:94-99`(`canonicalIVv6` catch 블록) | `isBlockedHostname('fe80::1%eth0')`(URL 파서가 거부하는 zone-id 부착 IPv6)처럼 폴백 경로를 실제로 태우는 `true` 단언 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / API 계약 / 부작용 | `testEmailTransport`의 SSRF 가드 호출이 여전히 `try/catch` 밖에 있음. `isSmtpHostBlocked`는 `SsrfBlockedError`가 아닌 오류를 재던지지만, 현재 `assertSafeOutboundHostResolved`는 그 클래스 외엔 던지지 않아 도달 불가능한 이론적 경로 — 1라운드부터 조치 불요로 평가된 잔존 항목, 재지적 아닌 확인 | `codebase/backend/src/modules/integrations/integrations.service.ts` `testEmailTransport` (~1596행) | 이번 스코프 밖. 후속 리팩터 시 넓은 try로 이동하면 방어적으로 더 안전 |
| 2 | 테스트 | `send_email` 노드의 **실제 발송** 경로가 CGNAT/IPv4-mapped 입력으로 차단되는지 검증하는 e2e는 없음 — `preview-test`(연결 테스트)만 e2e로 덮음. unit(가드 자체) + unit(배선) 조합으로 사실상 동치 성립, 비용 대비 효과 낮음 | `codebase/backend/test/integration-connection-test.e2e-spec.ts` B2 케이스(연결 테스트만) | 조치 불요 — 향후 워크플로 실행 e2e 스위트가 생기면 케이스 1개 추가 검토 |
| 3 | 문서-동기화 | `EMAIL_HOST_BLOCKED` 에러코드가 `backend-labels.ts`의 `ERROR_KO` 매핑에 없어 ko 로케일에서 영문 fallback 노출 — 이 코드 자체는 이번 PR 이전(#550/#553)부터 존재해 신규 trigger는 아니나, 이번 PR이 발생 조건(CGNAT SMTP host)을 확장한 당사자 | `codebase/frontend/src/lib/i18n/backend-labels.ts`(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`는 이미 매핑됨) | 이번 PR 범위 포함 또는 후속 plan에 명시적으로 등재 |
| 4 | 부작용 | 공유 판정 함수(`isBlockedHostname`) 차단 범위 확장이 diff 밖 기존 소비자 3곳(`http-request.handler.ts`, `database-query.handler.ts`, `database-connection-tester.ts`)에도 코드 수정 없이 자동 전파됨 — plan이 의도한 "세 노드 동일 메커니즘 공유"의 정확한 결과, 신규 결함 아님 | `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(`isBlockedIPv6`) | 조치 불요 — 기록용 |
| 5 | 프로세스 관찰 | documentation 리뷰어가 `git status --short`를 두 번 실행하는 사이 `http-safety.ts`에 대한 일시적 `M` 플래그(변경 없음, `git diff` 빈 출력)를 관찰 — 동시 실행 중이던 다른 reviewer의 순간적 뮤테이션·자가 원복으로 추정. 최종 상태는 세션 출력 디렉터리 외 변경 없음으로 클린 확인됨 | 세션 전반(병렬 reviewer 워크트리 공유) | 조치 불요 — 최종 상태 클린 확인됨, 기록만 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 1라운드 WARNING 해소 확인, CGNAT/IPv4-mapped 우회 재발 없음, 정보 노출(CWE-209) 방지 일관 확인 |
| architecture | LOW | WARNING 2건: SsrfBlockedError 판별 계약 4곳 미적용, JSDoc 트래커 참조 stale |
| requirement | NONE | 1라운드 WARNING 7건 전부 코드/테스트로 실조치 확인, spec 완전 일치 |
| scope | NONE | diff 37개 파일 전량이 plan/1라운드 RESOLUTION에 근거 소급, 범위 이탈 없음 |
| side_effect | LOW | 에러 타입 변경 호환성 확인, 판정 확장 전파는 의도된 결과, 새 결함 없음 |
| maintainability | LOW | WARNING 1건: JSDoc 문단 삽입으로 가독성 회귀(문서화 WARNING과 동일 사안) |
| testing | LOW | WARNING 1건: canonicalIPv6 폴백 분기 dead-in-tests(뮤테이션 GREEN) |
| documentation | LOW | WARNING 2건: JSDoc 문단 흐름 단절 + 트래커 참조 현재형 단언 stale |
| api_contract | LOW | 1라운드 계약 변경 WARNING이 CHANGELOG/.env.example로 해소 확인, 신규 계약 변경 없음 |
| user_guide_sync | MEDIUM | WARNING 1건: 통합 가이드에 Email(SMTP) 사설/CGNAT 차단 안내 누락 |

## 발견 없는 에이전트

- **requirement** — CRITICAL/WARNING 없음(명시). spec fidelity·정규화 로직·테스트 재실행 전부 일치 확인.
- **scope** — 문제 없음(명시). diff 전량이 plan/RESOLUTION에 근거를 둔 정당한 변경으로 확인.

## 권장 조치사항

1. `integration-management.mdx`/`integration-management.en.mdx`에 Email(SMTP)이 Database·HTTP와 동일한 사설망/CGNAT 차단 가드를 공유한다는 안내 추가 (WARNING #1, 사용자 가시 영향 가장 큼).
2. `http-safety.ts` 모듈 JSDoc의 문단 구분 복원 및 "트래커에 따로 있다" 문구를 실제 상태(등재 예정)에 맞게 정정 — 또는 이 plan 마무리 커밋에서 실제로 트래커에 등재 (WARNING #3, #4).
3. `http-request.handler.ts`·`database-connection-tester.ts`·`database-query.handler.ts`·`http-redirect.ts`의 catch 블록도 `instanceof SsrfBlockedError` 판별 패턴으로 통일하는 후속 작업을 트래커에 등재 (WARNING #2).
4. `canonicalIPv6`의 파서-거부 폴백 분기에 대한 회귀 테스트(zone-id 등 URL 파서 거부 케이스) 추가 (WARNING #5).
5. (선택) `EMAIL_HOST_BLOCKED`의 ko 라벨 매핑을 `backend-labels.ts`에 추가하거나 후속 plan에 명시적으로 등재 (INFO #3).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(diff 특성상 성능 영향 낮음으로 제외, 상세 사유는 라우팅 산출물에 미기재) |
  | dependency | 라우터 판단(신규/변경 의존성 없음으로 제외) |
  | database | 라우터 판단(스키마/쿼리 변경 없음으로 제외) |
  | concurrency | 라우터 판단(동시성 관련 코드 경로 변경 없음으로 제외) |
