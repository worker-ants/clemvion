# Code Review 통합 보고서

## 전체 위험도
**LOW** — 코드 정리(래퍼 제거·상수화·인터페이스 추출)·테스트 격리 강화 위주의 변경. 동작 변경 없음. spec-drift 1건(WARNING), 문서 불균형 2건(WARNING), 기존 테스트 커버리지 갭 다수(INFO) 확인.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md §2.3` 표 "클라이언트 IP" 행이 webhook/rate-limit 경로에서의 헤더 전용 동작(CF → XFF만, `req.ip` 폴백 없음)을 명시하지 않음. 구현은 Rationale 2.3.B에 따라 올바르나 spec 표가 4단계 순서를 유지해 불일치 발생. 코드 변경 대상 아님 — spec 갱신 대상. | `spec/5-system/1-auth.md §2.3` | spec 표 "클라이언트 IP" 행에 "webhook/rate-limit/ip_whitelist 경로는 Rationale 2.3.B에 따라 헤더 기반 2단계만 적용, `req.ip` 폴백 없음"을 명시 |
| 2 | Documentation | `hooks.service.ts` 두 호출부 간 `req.ip` 폴백 후속 컨텍스트 설명 수준 불균형. 첫 번째 호출부(:152)에는 4줄 인라인 주석 + plan 링크가 있으나, 두 번째 호출부(`handleChatChannelWebhook`, :260)에는 `// §A.3 소스 IP — …` 한 줄뿐. | `hooks.service.ts` L868-873 / L981 | 두 번째 호출부에 `plan/in-progress/webhook-public-ip-failopen-hardening.md` 포인터 한 줄 추가, 또는 `extractClientIpFromHeaders` JSDoc에 폴백 후속 설명 추가 후 호출부 주석 단순화 |
| 3 | Documentation | `plan/in-progress/webhook-public-ip-failopen-hardening.md`의 "후속" 섹션에 `spec(12-webhook.md §6·WH-SC-05)` 참조가 있으나 WH-SC-05 식별자가 현재 spec에 존재하는지 미검증. 존재하지 않으면 후속 작업자 혼란. | `plan/in-progress/webhook-public-ip-failopen-hardening.md` 후속 섹션 | `spec/5-system/12-webhook.md`에서 WH-SC-05 존재 여부 확인 후 미존재 시 `(신규 추가 예정)` 등 표기 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `process.env = envSnapshot` 참조 교체 방식은 모듈 로드 시 env 값을 캐싱한 경우 격리 실패 위험. 현재 대상(`shouldTrustCfConnectingIp`, `extractClientIpFromHeaders`)은 매 호출 시 동적으로 읽으므로 실질 문제 없음. | `client-ip.spec.ts` L482, L565 / `public-webhook-throttle.guard.spec.ts` L969 | 향후 안전성을 위해 동일 객체 변이 방식(`Object.assign` + `delete`) 또는 `jest.replaceProperty`(Jest 29+) 검토 |
| 2 | Testing | `GlobalExceptionFilter.UNKNOWN_ERROR_MESSAGE`(비-Error fallthrough) 경로 테스트 미커버. 현재 `defaults unknown errors to 500 INTERNAL_ERROR` 테스트는 `new Error('boom')`으로 `UNHANDLED_ERROR_MESSAGE` 경로만 검증. | `http-exception.filter.spec.ts` | `throw 'string literal'` 또는 `throw { custom: 'object' }` 케이스 추가해 UNKNOWN_ERROR_MESSAGE 경로 검증 |
| 3 | Testing | `QueryFailedError`(unique violation, `isUniqueViolation`) 경로 테스트 미커버. 409/RESOURCE_CONFLICT 중요 분기. | `http-exception.filter.ts` L327-L332 | `QueryFailedError` 인스턴스(`driverError.code = '23505'`)로 409 응답 검증 테스트 추가. 타 code 시 500 fallthrough도 추가. |
| 4 | Testing | Nested error shape(`{ error: { code, message, details } }`) 경로 테스트 미커버. 주석에 interaction 모듈 패턴으로 명시돼 있으나 테스트 없음. | `http-exception.filter.ts` L310-L322 | `new BadRequestException({ error: { code: 'NESTED_CODE', message: 'Nested message' } })` 케이스 추가 |
| 5 | Testing | `req.__publicWebhookTrigger` 첨부 여부(W14 기능) 검증 단언 없음. `canActivate` 후 req에 trigger가 올바르게 첨부되는지 미검증. | `public-webhook-throttle.guard.ts` L327 | trigger 존재/null 케이스에서 `req.__publicWebhookTrigger` 값 검증 단언 추가 |
| 6 | Testing | `makeGuard`의 `configService` 반환 누락. 현재 동작 검증에는 문제없으나 `configService.get` 호출 단언 추가 시 장벽. | `public-webhook-throttle.guard.spec.ts` L1952 | `makeGuard` 반환 타입에 `configService` 포함 또는 별도 검증 테스트 추가 |
| 7 | Maintainability | `getActiveExecutionStatus`에서 `private` 멤버를 브래킷 표기(`this.executionsService['executionRepository']`)로 접근. TypeScript 접근 제어 우회, 리팩터링 시 컴파일 타임 미검출. `.catch(() => null)` 방어로 런타임 안전 확보. | `hooks.service.ts` L1606 | `ExecutionsService`에 `getStatusById(id)` 등 좁은 공개 메서드 추가 |
| 8 | Maintainability | `extractClientIpFromHeaders(...) ?? undefined` 패턴 4회 반복. 반환형이 `string \| null`이어서 변환 필요하나 반복이 눈에 띔. | `hooks.service.ts` L683, L693, L981, L1351 | `extractClientIpFromHeaders` 반환형을 `string \| undefined`로 변경하거나 공유 유틸 래퍼 검토 |
| 9 | Maintainability | `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` 이름 유사성으로 혼동 여지. 이름만으로 차이 구분 어려움(JSDoc 보완 중). | `http-exception.filter.ts` L282-L289 | `NON_ERROR_THROW_MESSAGE` / `UNHANDLED_EXCEPTION_MESSAGE` 등 throw 값 종류 반영한 이름 검토(현행도 허용) |
| 10 | Maintainability | env 스냅샷 패턴(`envSnapshot` + `beforeEach`/`afterEach`)이 동일 파일 내 두 describe 블록에 중복 선언. | `client-ip.spec.ts` L433-441, L451-459 | 파일 레벨 `beforeEach`/`afterEach` 이동 또는 `withEnvSnapshot()` 헬퍼 추출 |
| 11 | Requirement | `extractClientIpFromHeaders` 직접 호출 전환 — `WebhookInput.headers`(`Record<string, string>`) vs 시그니처(`Record<string, string \| string[] \| undefined>`) 타입 불일치 잠재 여지. 자동 허용, 동작 변화 없음. | `hooks.service.ts` L874, L982 | 필요 시 명시적 캐스팅 검토 |
| 12 | Requirement | `PublicWebhookReqShape.headers`(`Record<string, unknown>`)와 `WebhookInput.headers`(`Record<string, string>`) 이원화. 의도된 분리이나 문서 없어 유지보수 혼동 여지. | `public-webhook-throttle.guard.ts` L2238-2243 / `hooks.service.ts` L765 | 두 타입 차이(Express Request 반영 vs 좁은 계약) 주석으로 설명 |
| 13 | Scope | plan `branch` 필드(`claude/webhook-extractip-consolidation`)가 실제 작업 브랜치(`claude/competent-mirzakhani-34a96a`)와 불일치. | `plan/in-progress/webhook-hardening-cleanup.md` frontmatter | plan 규약이 "실제 커밋 브랜치" 기록이라면 업데이트 |
| 14 | Scope | `export interface ReqShape` 제거로 외부 소비자 있을 경우 breaking 가능. 실질 소비자 없는 것으로 추정. | `public-webhook-throttle.guard.spec.ts` diff L-1769~-1775 | 실제 import 소비자 없는지 확인 권장(저위험) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | (출력 파일 미생성) | — |
| architecture | (출력 파일 미생성) | — |
| requirement | LOW | SPEC-DRIFT 1건: `spec/5-system/1-auth.md §2.3` IP 추출 순서 표가 webhook 경로의 헤더 전용 동작 미반영 |
| scope | NONE | 선언 범위와 실제 변경 일치. 소폭 확대(JSDoc 추가) 허용 범위 내 |
| side_effect | NONE | 런타임 동작 보존. process.env 참조 교체 방식 잠재 위험 INFO |
| maintainability | LOW | private 필드 브래킷 접근, 높은 순환 복잡도(기존 코드), 상수 유사 명명 |
| testing | LOW | process.env 교체 패턴 주의, UNKNOWN_ERROR_MESSAGE·QueryFailedError·nested error shape 커버리지 갭(기존 갭) |
| documentation | LOW | hooks.service.ts 두 호출부 설명 불균형(WARNING), WH-SC-05 참조 유효성 미확인(WARNING) |

---

## 발견 없는 에이전트

- **scope**: NONE 위험도 — 변경 범위 완전 일치, 실질 발견사항 없음
- **side_effect**: NONE 위험도 — 의도치 않은 부작용 없음

---

## 권장 조치사항

1. **(SPEC-DRIFT — spec 갱신 필수)** `spec/5-system/1-auth.md §2.3` 표 "클라이언트 IP" 행에 webhook/rate-limit/ip_whitelist 경로는 헤더 기반 2단계만 적용됨(Rationale 2.3.B 참조)을 명시. 코드 변경 불필요.
2. **(WARNING — 문서)** `hooks.service.ts` 두 번째 `extractClientIpFromHeaders` 호출부(`handleChatChannelWebhook`)에 `req.ip` 폴백 후속 plan 링크 한 줄 추가.
3. **(WARNING — 문서)** `plan/in-progress/webhook-public-ip-failopen-hardening.md` WH-SC-05 참조 유효성 확인 및 미존재 시 `(신규 추가 예정)` 표기.
4. **(INFO — 테스트)** `http-exception.filter.spec.ts`에 비-Error fallthrough(`UNKNOWN_ERROR_MESSAGE`) 케이스, `QueryFailedError` unique violation 케이스, nested error shape 케이스 추가(기존 커버리지 갭 보강).
5. **(INFO — 테스트)** `public-webhook-throttle.guard.spec.ts`에 `req.__publicWebhookTrigger` 첨부 여부 단언 추가.
6. **(INFO — 유지보수)** `getActiveExecutionStatus`의 private 필드 브래킷 접근(`['executionRepository']`)을 `ExecutionsService` 공개 메서드로 대체 검토 (별도 리팩터링 태스크).
7. **(INFO — 유지보수)** `extractClientIpFromHeaders` 반환형을 `string | undefined`로 통일해 `?? undefined` 패턴 반복 제거 검토.
8. **(주의 — security/architecture 미수집)** `security.md`, `architecture.md` 출력 파일이 디스크에 생성되지 않아 두 reviewer 결과 미반영. 보안·아키텍처 관점 검토가 필요하다면 재실행 권장.

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

**실행 (8명)**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation

**강제 포함 (router_safety, 7명)**: documentation, maintainability, requirement, scope, security, side_effect, testing

**제외 (6명)**:

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단 — 이번 변경(코드 정리·상수화·테스트 격리)에 성능 영향 없음 |
| dependency | 라우터 판단 — 신규 외부 의존성 추가 없음 |
| database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
| concurrency | 라우터 판단 — 동시성 관련 변경 없음 |
| api_contract | 라우터 판단 — 공개 API 계약 변경 없음 |
| user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없음 |

> **참고**: `security.md`와 `architecture.md`는 manifest에 `status=success`로 기록됐으나 실제 출력 파일이 디스크에 존재하지 않아 내용을 반영하지 못했습니다.