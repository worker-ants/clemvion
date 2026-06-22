# 보안(Security) Review

대상 커밋: `0413433128321273c32d2ea1d12906ce201e4b2d`
리팩터 범위: `lib/api/triggers.ts` 신설 + `trigger-detail-drawer.tsx` / `triggers/page.tsx` API 레이어 이전

---

## 발견사항

### 1. **[INFO]** `endpointPath`에 `crypto.randomUUID()` 클라이언트 생성값 사용
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `createMutation.mutationFn` 내 `endpointPath: crypto.randomUUID()`
- 상세: webhook endpoint 경로를 클라이언트에서 UUID로 생성해 서버로 전달한다. 서버가 이 값을 그대로 수락·저장하면 공격자가 임의 경로를 지정할 수 있다(경로 충돌 공격, 예측 가능한 경로 지정). Spec consistency check W-1/I-8에서도 "endpoint_path 서버 UUID 강제 미적용" 지적(W1)이 deferred 상태로 남아 있음을 확인.
- 제안: 백엔드에서 `endpointPath`를 서버 측 UUID로 강제 생성하고, 클라이언트 제출값을 무시하거나 금지하도록 수정. 이미 known-deferred 사항(plan `trigger-review-deferred-fixes.md` W1)이므로 해당 fix 추적 트랙에서 처리 필요.

### 2. **[INFO]** `botToken` 및 `inboundSigningPlaintext` 평문 전송 — 범위 내 추가 보호 없음
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `createMutation.mutationFn`의 `chatChannel.botToken`, `chatChannel.inboundSigningPlaintext`
- 상세: 민감 자격증명(봇 토큰, provider-issued signing secret)이 JSON body에 평문으로 실려 `triggersApi.create()`를 통해 전송된다. 이는 기존 코드의 동작을 그대로 보존한 리팩터이며 HTTPS 전제 하에 전송 자체는 보호되지만, 브라우저 메모리·네트워크 로그·미들웨어 로깅에서 평문 노출 가능성이 존재한다. 입력 필드에 `type="password"` / `autoComplete="off"` 처리는 올바르게 적용되어 있음.
- 제안: 이 변경에서 새로 도입된 위험이 아닌 기존 동작 보존이므로 현재 스코프에서 차단 수준은 아님. 추후 보안 강화 단계에서 서버 측 request body 로깅 마스킹(`botToken`, `inboundSigningPlaintext` 필드 redact) 적용 여부를 검토.

### 3. **[INFO]** `TriggerUpdateBody.chatChannel`이 `Record<string, unknown>` 타입 — 금지 키 클라이언트 필터링 없음
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `TriggerUpdateBody` 인터페이스, `update()` 함수
- 상세: `chatChannel` 필드가 `Record<string, unknown>`으로 정의되어 있어 타입 수준에서 `botTokenRef`, `inboundSigningPlaintext` 등 금지 키 전송을 막지 않는다. 주석으로 "backend가 400으로 거부"라고 기술되어 있으나, 클라이언트 측 타입 가드는 없다. 리팩터 이전 코드도 동일 구조였으므로 새로 도입된 위험이 아님.
- 제안: `chatChannel` 타입을 `Omit<ChatChannelConfigView, 'hasBotToken' | 'botIdentity'>` 형태로 좁히거나, 금지 키 목록(`botTokenRef`, `secretTokenRef`, `inboundSigningPlaintext`)을 `never` 타입으로 명시하면 타입 계층에서 오용을 사전 차단할 수 있음.

### 4. **[INFO]** `rotateNotificationSecret` 결과(`secret`)를 컴포넌트 state에 평문 저장 후 렌더링
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `handleRotateSecret()` → `setRotateResult(secret)`
- 상세: rotate 후 반환된 HMAC secret이 React state에 저장되어 UI에 노출된다. 이는 UX 설계 의도(사용자가 복사할 수 있도록)이나, 컴포넌트가 unmount 되어도 state 내 값이 즉시 GC 되지 않을 수 있다. 리팩터 이전에도 동일 패턴이었음.
- 제안: 노출 시간을 제한하는 timeout 초기화(예: 60초 후 `setRotateResult(null)`) 또는 복사 완료 시 state 클리어 로직 추가를 고려.

### 5. **[INFO]** `getById`의 `as` 타입 단언 체인 — 서버 응답 검증 없음
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `getById()` 함수 내 `(body?.data ?? body) as TriggerDetail & {...}`
- 상세: 서버 응답을 런타임 검증 없이 `as` 단언으로 캐스팅한다. 서버가 예상치 못한 shape를 반환해도 타입 오류가 런타임에 조용히 진행된다. 기존 코드와 동일한 패턴이므로 새 취약점은 아님.
- 제안: Zod 또는 유사 스키마 검증 라이브러리 도입을 중장기적으로 고려. 현재 스코프에서 차단 수준 아님.

---

## 요약

이번 변경은 분산된 `apiClient` 직접 호출을 `lib/api/triggers.ts` 카탈로그로 집중시키는 순수 구조 리팩터다. 보안 관점에서 새로 도입된 취약점은 없으며, 하드코딩된 시크릿·SQL/XSS 인젝션·LDAP·경로 탐색·인증 우회·안전하지 않은 암호화 알고리즘 등의 OWASP Top 10 카테고리 문제는 발견되지 않았다. 기존에 존재하던 두 가지 잠재적 위험(클라이언트 생성 `endpointPath` UUID, 민감 자격증명 평문 전송)은 리팩터 이전 코드로부터 동작이 그대로 보존된 것으로, 이 중 `endpointPath` 서버 강제 생성 미적용은 이미 deferred fix 트랙에 등록된 known 사항이다. 에러 처리는 `toast.error`를 통해 일반적 실패 메시지만 노출하며 민감 정보가 에러 메시지에 포함되지 않는다. 사용 의존성 변경도 없어 known-CVE 의존성 위험은 해당 없다.

## 위험도

LOW
