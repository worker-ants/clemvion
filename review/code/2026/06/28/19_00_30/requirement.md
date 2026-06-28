# Requirement Review — webhook-hardening-cleanup

## 발견사항

### **[INFO]** A-1: `extractClientIpFromHeaders` 직접 호출 전환 — 헤더 타입 불일치 잠재 위험
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` line 874, 982
- 상세: `HooksService`의 `WebhookInput.headers` 타입은 `Record<string, string>`이며, `extractClientIpFromHeaders`의 시그니처는 `Record<string, string | string[] | undefined>`를 받는다(client-ip.ts 내부). 이 변환은 TypeScript에서 자동으로 허용되고 런타임에도 문제없으나, `handleChatChannelWebhook`의 동일 호출 경로(line 982)에서 `input.headers`가 동일 타입(`Record<string, string>`)이므로 일관성 있다. 삭제된 래퍼 함수(`extractClientIp`) 역시 동일 패턴이었으므로 동작 변화 없음. INFO 수준.

### **[INFO]** A-2: `UNKNOWN_ERROR_MESSAGE` vs `UNHANDLED_ERROR_MESSAGE` — 두 상수의 차이가 주석에만 존재
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` lines 216–223
- 상세: 두 상수를 의도적으로 다르게 유지한다는 설명이 JSDoc과 plan에 명기돼 있다. `UNKNOWN_ERROR_MESSAGE = 'An unexpected error occurred'`는 비-`Error` fallthrough용, `UNHANDLED_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'`는 매핑되지 않은 `Error` 인스턴스 마스킹용이다. 두 문자열이 거의 유사해 향후 혼동 여지가 있으나, 의도적으로 분리된 설계이므로 문서화로 충분. INFO 수준.

### **[INFO]** B-4/B-7: `process.env = envSnapshot` 복원 패턴 — Node.js 보장 여부
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` lines 483, 566; `public-webhook-throttle.guard.spec.ts` line 970
- 상세: `process.env = { ...process.env }` 스냅샷 후 `process.env = envSnapshot`으로 교체하는 패턴은 Jest 단위 테스트 환경(단일 프로세스)에서 일반적으로 동작하나, `process.env` 참조(기존 코드에서 `process.env.TRUST_CF_CONNECTING_IP`를 직접 읽는 경우)가 교체된 객체를 바라보지 않을 수 있다. 현재 코드는 `shouldTrustCfConnectingIp(process.env)` 식으로 매 호출 시 `process.env`를 읽으므로 문제없다. 단, Node.js 내부(native addon 등)가 원본 `process.env` 객체에 대한 참조를 캐시하는 경우 복원이 무효가 될 수 있다. 현재 테스트 범위에서는 실용적으로 안전하다. INFO 수준.

### **[INFO]** A-3: `PublicWebhookReqShape` 와 `WebhookInput` 타입 이원화
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` lines 2238–2243; `hooks.service.ts` line 765
- 상세: Guard가 읽는 `PublicWebhookReqShape.headers`는 `Record<string, unknown>`이고, `WebhookInput.headers`는 `Record<string, string>`이다. 두 타입이 다른 것은 Guard의 Express Request 타입 반영(헤더는 `string | string[]` 가능)과 서비스의 좁은 계약 차이 때문으로, 의도된 분리다. 단일 타입으로 통합하지 않은 설계가 맞지만, 두 타입이 같은 `headers` 필드를 가리키는 문서가 없어 유지보수 시 혼동 여지가 있다. INFO 수준.

### **[INFO]** spec fidelity — `spec/5-system/1-auth.md §2.3` IP 추출 순서 vs 구현
- 위치: `spec/5-system/1-auth.md` line 321 / `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`
- 상세: spec §2.3 표 "클라이언트 IP" 행은 `CF-Connecting-IP`(TRUST_CF=true) → `X-Forwarded-For` 첫 IP → `req.ip`(trust proxy) → `req.socket.remoteAddress` 순이라고 정의한다. `extractClientIpFromHeaders`는 헤더 기반(CF → XFF)만 처리하고 `req.ip`/`req.socket.remoteAddress` 폴백은 `extractClientIp(req)` 함수가 담당한다. 그런데 `hooks.service.ts`는 이번 변경으로 `extractClientIpFromHeaders`만 호출하고 `req.ip`/`req.socket.remoteAddress` 폴백을 적용하지 않는다. spec Rationale 2.3.B에서 **"`ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정"** 이며 `req.ip` 대안은 기각됐다고 명시하고 있다. 코드 주석도 이 설계를 반영 중이다. 따라서 `req.ip` 폴백 미적용은 spec-conformant 동작이다. 그러나 spec §2.3 본문 표(line 321)는 여전히 `req.ip` → `req.socket.remoteAddress` 를 포함한 4단계 순서를 기재하고 있어 구현과 표의 범위가 일치하지 않는다. 이 불일치는 코드 버그가 아니라 spec 2.3 표 행의 scope 명확화 필요(webhook/ip_whitelist 경로는 헤더 기반 2단계만 적용)로 본다.
- **[SPEC-DRIFT]** spec 갱신 필요: `spec/5-system/1-auth.md §2.3` 표 "클라이언트 IP" 행에 "webhook/rate-limit/ip_whitelist 경로는 Rationale 2.3.B에 따라 헤더 기반(CF → XFF)만 적용, `req.ip` 폴백 없음"을 명시. 코드 유지 + spec 반영.
- 심각도: WARNING (spec-drift)

### **[INFO]** B-6: 비-413 4xx 테스트에 `requestId` 단언 추가 — spec §5.3 일치
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` line 144
- 상세: `spec/5-system/2-api-convention.md §5.3`은 "requestId: 모든 에러 응답에 항상 포함"이라고 명시한다. 비-413 4xx(`maps a non-413 4xx http-error`) 케이스에 `requestId` 단언이 추가됨으로써 spec 요구사항을 검증하는 테스트가 완성됐다. 413 케이스의 기존 단언(line 112)과 대칭을 이룸. 올바른 추가.

### **[INFO]** `handleFormStep` 내 `MAX_FIELDS_HEURISTIC` — 임시 설계 (기존 코드, 참고)
- 위치: `hooks.service.ts` line 1540-1541
- 상세: `MAX_FIELDS_HEURISTIC = 10` 하드코딩과 `field_<idx>` 키 패턴이 TODO 성격 주석과 함께 남아 있다("v1 stub: ... PR-E 보강 사항"). 이번 변경 범위 밖이나, 기존 미완성 코드가 잔존함을 기록한다.

---

## 요약

이번 변경은 4개 영역(A-1 래퍼 함수 제거, A-2 상수화, A-3 named interface, B-4/5/6/7 테스트 격리)의 순수한 코드 정리 및 테스트 견고성 강화다. 동작 변경 없이 `extractClientIpFromHeaders` 직접 호출 통합, 매직 문자열 named 상수화, 테스트 spy/env 복원 패턴 통일이 올바르게 구현됐다. 기능 완전성 관점에서 누락·오류는 발견되지 않았다. `requestId` 단언 추가(B-6)는 spec §5.3 "모든 에러 응답에 항상 포함"을 테스트로 검증하는 긍정적 변경이다. SPEC-DRIFT 항목으로 `spec/5-system/1-auth.md §2.3` 표의 IP 추출 순서 행이 webhook/rate-limit 경로에서의 헤더 전용 동작을 명시하지 않는 점을 확인했으나, 이는 코드 fix 대상이 아니라 spec 반영 대상이다.

## 위험도

LOW
