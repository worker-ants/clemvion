# 요구사항(Requirement) Review — webhook-hardening-cleanup (19_15_39)

## 발견사항

### [INFO] A-1: `extractClientIp` 래퍼 제거 — 직접 호출 전환 완료
- 위치: `hooks.service.ts` L152, L262
- 상세: `handleWebhook`·`handleChatChannelWebhook` 두 호출부 모두 `extractClientIpFromHeaders(input.headers) ?? undefined` 로 통일 완료. 래퍼 함수 제거로 단일 구현 집중화 완성. spec/5-system/1-auth.md §2.3 "webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated→XFF 첫 IP)만 적용, req.ip/socket 폴백 없음" 정의와 구현 일치.
- 제안: 이상 없음.

### [INFO] A-2: 매직 문자열 상수화
- 위치: `http-exception.filter.ts` L33-40
- 상세: `UNKNOWN_ERROR_MESSAGE`(`'An unexpected error occurred'`)와 `UNHANDLED_ERROR_MESSAGE`(`'An unexpected error occurred. Please try again later.'`) 두 상수가 JSDoc 주석으로 의도적 차이(비-Error throw fallthrough vs. 매핑되지 않은 Error)를 명시. 두 경로 모두 클라이언트에 내부 원문 미노출(CWE-209 준수). 함수 시그니처·반환값 모두 정상.
- 제안: 이상 없음.

### [INFO] A-3: `PublicWebhookReqShape` named interface 도출
- 위치: `public-webhook-throttle.guard.ts` L155-165
- 상세: `canActivate` 의 `getRequest` 인라인 익명 타입을 `PublicWebhookReqShape`(export) 로 추출. 테스트가 `type ReqShape = PublicWebhookReqShape` 로 재사용해 필드 동기화 중복 제거 완료(A-3 계획 일치). `PublicWebhookReqShape extends PublicWebhookReqExtension`으로 `__publicWebhookTrigger` 필드 포함—타입 일관성 유지.
- 제안: 이상 없음.

### [INFO] B-4/B-7: env 스냅샷 복원 패턴 통일
- 위치: `client-ip.spec.ts`·`public-webhook-throttle.guard.spec.ts`
- 상세: `process.env = envSnapshot` 방식은 `client-ip.ts` 가 `shouldTrustCfConnectingIp` 에서 `process.env` 를 매 호출마다 동적으로 읽으므로 테스트 격리 목적에 부합한다. 이전 `const orig = process.env.TRUST_CF_CONNECTING_IP` + `if (orig === undefined) delete ...` 조각 접근보다 간결하고 누설 방지 보장이 강함. RESOLUTION I1 에서 언급한 "대상 함수가 매 호출 동적 read" 확인 일치.
- 제안: 이상 없음.

### [INFO] B-5: afterEach `jest.restoreAllMocks()` 통일
- 위치: `http-exception.filter.spec.ts` L37-40, `public-webhook-throttle.guard.spec.ts` L281-289
- 상세: 개별 테스트 내 `warn.mockRestore()` / `errorLog.mockRestore()` 제거 후 `afterEach(jest.restoreAllMocks)` 로 통일. 테스트 예외 발생 시 spy 누설 방지 완성. 기존 복원 호출 제거 후 주석 처리 방식 명확.
- 제안: 이상 없음.

### [INFO] B-6: `requestId` 대칭 단언 추가
- 위치: `http-exception.filter.spec.ts` L81
- 상세: 비-413 4xx 케이스(`maps a non-413 4xx http-error`)에 `expect(body.error.requestId).toBeDefined()` 추가. spec/5-system/2-api-convention.md §5.3 "requestId: 모든 에러 응답에 항상 포함" 요구사항 커버리지 보강. 413 케이스(L49)와 대칭.
- 제안: 이상 없음.

### [INFO] B-6 추가: `UNKNOWN_ERROR_MESSAGE` 신규 테스트 케이스
- 위치: `http-exception.filter.spec.ts` L130-140
- 상세: 비-Error 값 throw(`'a raw string thrown'`)가 500 `INTERNAL_ERROR` + `'An unexpected error occurred'` 메시지로 응답됨을 검증. `UNHANDLED_ERROR_MESSAGE`(`'An unexpected error occurred. Please try again later.'`)와 구분되는 fallthrough 경로를 커버. RESOLUTION I2 FIXED 항목의 완전한 구현.
- 제안: 이상 없음.

### [INFO] Plan 파일 — `webhook-hardening-cleanup.md`
- 위치: `plan/in-progress/webhook-hardening-cleanup.md`
- 상세: frontmatter `worktree`·`branch` 정상. A-1~A-3·B-4~B-7 전부 `[x]` 체크됨. 워크플로 항목 중 fresh `/ai-review --route=all` 및 `push + PR` 은 미완료(`[ ]`) — 현재 진행 중인 단계와 일치. 범위 밖(C-scope·D-12)을 별도로 명시해 scope creep 방지.
- 제안: 이상 없음.

### [INFO] Plan 파일 — `webhook-public-ip-failopen-hardening.md`
- 위치: `plan/in-progress/webhook-public-ip-failopen-hardening.md`
- 상세: `worktree: (unstarted)` 상태로 미착수 추적 문서. 보안 결정(인프라·앱 폴백·fail-closed) 3항목 명시. spec 반영 대상(`12-webhook.md §6·WH-SC-05·Rationale`) 정확히 기재. 현재 PR 범위 밖 항목을 적절히 분리 추적.
- 제안: 이상 없음.

### [INFO] Spec Fidelity — `1-auth.md §2.3` 클라이언트 IP 표 행
- 위치: `spec/5-system/1-auth.md` L321
- 상세: 현재 spec 본문은 "webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 req.ip/socket 폴백이 없다(extractClientIpFromHeaders 직접 호출)" 를 명시하고 있다. 이는 RESOLUTION W1에서 이미 반영 완료된 상태로, 코드 구현과 line-level 일치 확인됨.
- 제안: 이상 없음.

### [INFO] Spec Fidelity — `2-api-convention.md §5.3` requestId 필드
- 위치: `spec/5-system/2-api-convention.md` L160
- 상세: "requestId: 모든 에러 응답에 항상 포함되는 추적용 UUID. GlobalExceptionFilter 가 매 응답마다 발급한다." — 구현 `http-exception.filter.ts` L45(`const requestId = uuidv4()`)·L103 일치. B-6 의 단언 추가가 이 요구사항 커버리지를 보강함.
- 제안: 이상 없음.

### [INFO] Spec Fidelity — `3-error-handling.md §1.3` `PAYLOAD_TOO_LARGE` 메시지
- 위치: `spec/5-system/3-error-handling.md` L47
- 상세: spec은 "message 는 내부 원문을 echo 하지 않고 고정 문구 'Request payload too large.' 만 반환한다(CWE-209)" 명시. 구현 `http-exception.filter.ts` L132-134 일치. 비-413 4xx 는 `'The request could not be processed.'` — spec L450-455 Rationale 와 일치.
- 제안: 이상 없음.

---

## 요약

이번 변경은 PR #763 이후 INFO 등급 코드 정리·테스트 격리 항목(A-1~A-3, B-4~B-7)을 계획 그대로 동작 보존하며 완료했다. 핵심 기능 요구사항(extractClientIpFromHeaders 단일 구현 통합, CWE-209 고정 문구 상수화, PublicWebhookReqShape 타입 중복 제거, env 스냅샷 격리, afterEach spy 복원 통일, requestId 대칭 단언, UNKNOWN_ERROR_MESSAGE 경로 테스트)이 모두 계획 항목과 1:1 대응하며 구현됐다. 관련 spec 본문(1-auth.md §2.3 클라이언트 IP 표, 2-api-convention.md §5.3 requestId, 3-error-handling.md §1.3 메시지 정책)과 코드 구현이 line-level로 일치한다. 엣지 케이스(비-Error throw, 비-413 4xx, process.env 누설)가 테스트로 커버됐으며 CRITICAL/WARNING 발견사항 없음.

## 위험도

NONE
