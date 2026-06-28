# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 변경셋(webhook-hardening-cleanup A-1~A-3, B-4~B-7)은 동작 보존 리팩터링 및 테스트 격리 강화로 구성되며, CRITICAL 발견 없음. 신규 보안 취약점·API 계약 변경·DB 스키마 변경 없음. LOW 등급 발견은 기존 구조적 부채(상수명 유사성, `?? undefined` 패턴 반복, env 스냅샷 참조 교체 방식)로 이번 PR이 신규 도입한 문제가 아님.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | IP 미식별 시 rate-limit fail-open 동작 — `extractClientIpFromHeaders` 가 null 반환 시 Guard 가 rate-limit 없이 통과시킴. 이번 변경이 신규 도입한 문제 아님. `webhook-public-ip-failopen-hardening.md` 에 후속 결정 위임됨 | `public-webhook-throttle.guard.ts` `canActivate` `if (!ip) return true` 분기 | `webhook-public-ip-failopen-hardening.md` 세 가지 결정 중 하나 조기 확정 권고. 단기 완화: `unknown-ip` 별도 버킷 적용 |
| 2 | 아키텍처 | `PublicWebhookReqShape extends PublicWebhookReqExtension` 상속 방향 의미 역전 — "입력 형태"가 "Guard 주입 출력 확장"을 상속. JSDoc 으로 의도 명시되어 차단급 아님 | `public-webhook-throttle.guard.ts` 신규 interface | `PublicWebhookReqShape & PublicWebhookReqExtension` intersection 또는 내부 assertion cast 패턴으로 변경 검토 |
| 3 | 아키텍처 | `extractClientIpFromHeaders` 반환형 `string\|null` vs 호출부 기대 `string\|undefined` 불일치 — 모든 호출부에 `?? undefined` 변환 보일러플레이트 강제(4회 반복) | `hooks.service.ts` 호출부 전체 | 유틸 반환형을 `string\|undefined` 로 변경 또는 공유 래퍼를 `auth/utils/client-ip` 에 추가 (별도 후속 태스크) |
| 4 | 아키텍처 | `getActiveExecutionStatus` 내 `this.executionsService['executionRepository']` private 필드 브래킷 접근 — DIP 위반, 기존 코드 | `hooks.service.ts` L1606 (이번 diff 외 기존 코드) | `ExecutionsService` 에 `getStatusById(id)` 공개 메서드 추가 (별도 리팩터링 태스크) |
| 5 | 유지보수성 | `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` 상수명 유사성 — 이름만으로 `UNKNOWN` vs `UNHANDLED` 구분이 직관적이지 않음. JSDoc 으로 완화됨 | `http-exception.filter.ts` 신규 상수 | 장기: `NON_ERROR_THROW_MESSAGE` / `UNHANDLED_EXCEPTION_MESSAGE` 로 명칭 개선 검토 |
| 6 | 유지보수성 | `handleChatChannelWebhook` 메서드 순환 복잡도 과도(약 410라인, command kind 분기 7개+) — 기존 구조적 부채, 이번 PR 신규 도입 아님 | `hooks.service.ts` `handleChatChannelWebhook` 메서드 | command kind 별 private 핸들러 분리 리팩터링 백로그 등록 |
| 7 | 테스트 | `process.env = envSnapshot` 참조 교체 방식 — 모듈 로드 시 env 캐싱 코드 추가 시 격리 보장 안 됨. 현재 대상 함수가 동적 read 라 실질 문제 없음 | `client-ip.spec.ts`, `public-webhook-throttle.guard.spec.ts` `afterEach` | `Object.assign(process.env, ...)` 동일 객체 변이 또는 `jest.replaceProperty(process, 'env', ...)` 검토 |
| 8 | 테스트 | `requestId` 단언이 5xx 및 일부 4xx 케이스에 누락 — 비-413 4xx 에만 추가됨, 다른 에러 경로 불일치 | `http-exception.filter.spec.ts` 5xx 및 나머지 4xx 케이스 | 모든 에러 응답 케이스에 `requestId` 단언 추가 검토 (비차단) |
| 9 | 테스트 | `QueryFailedError`(unique violation) 및 nested error shape 경로 테스트 미커버 — 기존 갭 | `http-exception.filter.ts` `isUniqueViolation` 분기, nested `{ error: { code, message, details } }` 분기 | 별도 테스트 보강 계획 수립 (비차단) |
| 10 | 테스트 | `__publicWebhookTrigger` 첨부 동작 단언 부재 — `PublicWebhookReqShape` 이 `PublicWebhookReqExtension` 상속으로 구조적 기반 마련됐음에도 검증 없음 | `public-webhook-throttle.guard.spec.ts` | trigger 존재/null 케이스에서 `req.__publicWebhookTrigger` 값 단언 추가 (비차단) |
| 11 | 테스트 | env 스냅샷 선언 패턴이 `client-ip.spec.ts` 내 두 describe 블록에 중복 선언 | `client-ip.spec.ts` 두 describe 블록 `beforeEach`/`afterEach` | 파일 레벨 `beforeEach`/`afterEach` 이동 또는 `withEnvSnapshot()` 헬퍼 추출 (nice-to-have) |
| 12 | 문서화 | `PublicWebhookReqShape.headers`(`Record<string, unknown>`) vs `WebhookInput.headers`(`Record<string, string>`) 타입 이원화 설명 주석 없음 | `public-webhook-throttle.guard.ts` `PublicWebhookReqShape` JSDoc, `hooks.service.ts` 호출부 | 두 타입 이원화 이유("Express Request headers 는 unknown, 내부 계약은 string 으로 좁힘") 한 줄 주석 추가 |
| 13 | 성능 | `handleChatChannelWebhook` 초반부 `clientIp` 조기 추출 — early-return 경로에서 무용 연산. 단, `extractClientIpFromHeaders` 가 O(1) 이라 실질 비용 없음 | `hooks.service.ts` `handleChatChannelWebhook` 도입부 | 성능 임계점 진단 시 사용 직전으로 이동 검토; 현재 우선순위 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | IP fail-open 은 기존 설계·후속 plan 위임. CWE-209 상수화는 긍정적 변경 |
| performance | NONE | 래퍼 제거로 호출 스택 1단계 감소 외 신규 성능 이슈 없음 |
| architecture | NONE | `ReqShape extends ReqExtension` 상속 방향 의미 역전, `?? undefined` 반복, private 브래킷 접근 모두 기존 부채 |
| requirement | NONE | A-1~A-3, B-4~B-7 모두 plan 과 1:1 대응, spec 일치 확인 |
| scope | NONE | 변경 범위 내 정상 구현, 무관 파일 수정 없음 |
| side_effect | NONE | breaking change 없음, 외부 인터페이스 보존, `process.env` 참조 교체는 현재 무해 |
| maintainability | LOW | 상수명 유사성, `?? undefined` 반복, env 스냅샷 중복, 기존 private 브래킷 접근 및 메서드 복잡도 |
| testing | LOW | `process.env` 참조 교체 잠재적 취약성, 기존 커버리지 갭(QueryFailedError, nested error, `__publicWebhookTrigger`) |
| documentation | LOW | `headers` 타입 이원화 설명 주석 미비. 이전 WARNING 2건(W2 주석 불균형, W3 WH-SC-05 참조) 해소 확인 |
| dependency | NONE | 외부 패키지 변경 없음, 내부 의존 관계 단순화 |
| database | NONE | DB 관련 변경 없음 |
| concurrency | NONE | 공유 가변 상태·비동기 흐름 변경 없음 |
| api_contract | NONE | 공개 API 엔드포인트·응답 형식 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix trigger 0건 매칭, 동반 갱신 불필요 |

## 발견 없는 에이전트

- **database**: DB 관련 변경 없음
- **concurrency**: 공유 가변 상태·비동기 흐름 변경 없음
- **api_contract**: API 계약 변경 없음
- **user_guide_sync**: doc-sync trigger 미해당

## 권장 조치사항
1. (비차단 — 후속 태스크) `webhook-public-ip-failopen-hardening.md` 세 가지 결정(인프라 레벨 차단, `req.socket.remoteAddress` 폴백, fail-closed 전환) 중 하나 조기 확정
2. (비차단 — 후속 태스크) `extractClientIpFromHeaders` 반환형을 `string | undefined` 로 변경해 `?? undefined` 패턴 4곳 제거
3. (비차단 — 후속 태스크) `process.env` 테스트 격리를 동일 객체 변이(`Object.assign`) 또는 `jest.replaceProperty` 방식으로 전환
4. (비차단 — nice-to-have) `PublicWebhookReqShape.headers` vs `WebhookInput.headers` 이원화 이유 주석 한 줄 추가
5. (비차단 — nice-to-have) `http-exception.filter.spec.ts` 5xx 케이스 등 나머지 에러 경로에 `requestId` 단언 추가
6. (비차단 — 리팩터링 백로그) `handleChatChannelWebhook` command kind 별 private 핸들러 분리
7. (비차단 — 리팩터링 백로그) `ExecutionsService` 에 `getStatusById` 공개 메서드 추가해 private 브래킷 접근 제거

## 라우터 결정

라우터 미사용 — 사유: `routing=skipped`. 전체 reviewer 실행.

강제 포함(router_safety): documentation, maintainability, requirement, scope, security, side_effect, testing