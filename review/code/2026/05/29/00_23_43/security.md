# 보안(Security) 리뷰 — triggers auth column

리뷰 일시: 2026-05-29
리뷰 대상: 파일 1–6 (triggers-page.test.tsx, page.tsx, en/ko i18n, plan md 2건)

---

## 발견사항

### [INFO] 프론트엔드 — `authConfigId` 기반 인증 상태 판별이 클라이언트 사이드에서만 수행됨
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` diff +514 `authConfigId: t.authConfigId ?? null`
- 상세: 목록 페이지는 `authConfigId == null` 여부를 클라이언트에서 판단해 보안 경고 아이콘을 렌더링한다. 이는 UI 가시성 목적의 표시 로직이므로 클라이언트 판단 자체는 문제가 없다. 그러나 실제 webhook 인증 강제는 `hooks.service.ts:112–122`의 `trigger.authConfigId` 분기에서 백엔드가 수행하며, 프론트엔드 경고 표시 유무가 서버 측 보안 결정에 영향을 주지 않는 구조가 올바르게 분리되어 있다. 보안 결함은 아니나 명시적으로 확인된 사항.
- 제안: 해당 없음 (현 구조 양호).

### [INFO] `useAuthConfigs` 훅 — `authConfigById` 맵이 클라이언트 캐시에만 존재
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` diff +202–204
- 상세: `authConfigById = new Map(authConfigs.map((c) => [c.id, c]))` 는 렌더 시마다 재생성된다. 보안 이슈는 없으나, 해당 맵에는 `{id, name, type}` 만 포함되며 민감한 자격증명(key/token/secret)은 포함되지 않는다 — `AuthConfigSelect.tsx:25–28`의 `useAuthConfigs` 훅이 `/auth-configs` 엔드포인트를 호출하고, 백엔드(`auth-configs.service.ts:70`)가 목록 응답에서 secret 류 필드를 마스킹하므로 클라이언트 측 캐시에 평문 자격증명이 노출되지 않는다.
- 제안: 해당 없음 (마스킹 처리 확인됨).

### [INFO] i18n 딕셔너리 — `authUnauthenticatedWarning` 문자열에 민감 정보 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` +604–606, `ko/triggers.ts` +920–921
- 상세: 새로 추가된 i18n 키(`authConfigured`, `authUnauthenticatedWarning`)는 순수 UI 레이블이며 내부 경로·토큰·자격증명을 포함하지 않는다. `authUnauthenticatedWarning`은 사용자에게 보안 위험을 고지하는 정보 문구로 적절하다.
- 제안: 해당 없음.

### [INFO] 테스트 픽스처 — 하드코딩된 ID 값이 실제 자격증명이 아님
- 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` 전체
- 상세: 픽스처에 사용된 `"ac-1"`, `"wfk_..."` 패턴 없음, `"t1"`, `"w1"` 등은 테스트 전용 UUID-형태 더미 ID이며 실제 비밀값이 아니다. `apiGetMock`은 실제 API 호출을 mock 처리해 네트워크 요청이 발생하지 않는다.
- 제안: 해당 없음.

---

## 백엔드 관련 선행 코드 교차 검증 결과

이번 PR 의 직접 변경은 프론트엔드(표시 레이어)에만 해당하나, 보안 관점에서 연관 백엔드 코드를 함께 검토하였다.

### [WARNING] `ipWhitelist` — CIDR 매칭 미구현, exact match 만 적용 중
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:219–223`
- 상세: 코드 주석에 "exact match — CIDR 매칭은 follow-up"으로 명시되어 있다. `ac.ipWhitelist.includes(ctx.clientIp)` 는 문자열 완전 일치만 수행하므로, IP 화이트리스트를 `10.0.0.0/8` CIDR 형태로 설정한 관리자는 실제 IP(`10.x.x.x`)가 차단된다. 이는 보안 설정이 의도대로 동작하지 않는 오작동 — 이미 알려진 미구현이나, 사용자가 CIDR를 입력하면 화이트리스트 설정이 무력화되어 "설정했다는 착각" 하에 모든 IP를 차단하는 fail-closed 거동이 발생한다. (이번 PR 에서 새로 도입된 코드는 아님.)
- 제안: `ipWhitelist` 항목에 CIDR 포함 여부를 검사해 CIDR이면 범위 매칭 라이브러리(`ipaddr.js` 등)를 사용하거나, 현재 UI/API에서 CIDR 입력을 허용하지 않도록 validation 을 강화한다.

### [INFO] `verifyWebhookRequest` — `fail-closed` 설계 확인
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:204–247`
- 상세: `ac` 가 null이거나 `isActive` 가 false일 때 즉시 401을 반환한다. `ip_whitelist` 가 설정되어 있으나 `clientIp` 를 알 수 없으면 거부(fail-closed)한다. 모든 인증 실패는 type 무관하게 단일 `AUTH_FAILED` 코드를 반환해 열거(enumeration) 공격을 차단한다. 긍정적 설계 확인.

### [INFO] 타이밍 공격 방어 — `constantTimeEquals` 적용 확인
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:324–329`
- 상세: Bearer / API Key / Basic Auth / HMAC 검증에 모두 `crypto.timingSafeEqual` 기반의 `constantTimeEquals`를 사용한다. 길이 불일치 시 즉시 `false`를 반환하여 `timingSafeEqual`의 RangeError를 방지한다. 올바른 구현 확인.

### [INFO] HMAC 알고리즘 화이트리스트 — `HMAC_ALLOWED_ALGORITHMS` 확인
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:21, 296–298`
- 상세: `sha256` / `sha512` 만 허용한다. `crypto.createHmac`에 외부 입력이 전달되기 전에 화이트리스트 검사를 통과해야 하므로 임의 알고리즘 주입이 차단된다.

### [INFO] 평문 자격증명 응답 — 마스킹 적용 확인
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:331–345`
- 상세: 목록/단건 조회 응답에서 `key`/`token`/`secret`/`password` 키를 `***<last4>` 로 마스킹한다. 평문 노출은 `create`/`regenerate`/`reveal` 응답으로만 제한된다. `reveal`은 Admin 권한 + 비밀번호 재확인 + audit_log 기록을 모두 요구한다.

### [INFO] AuthConfig 암호화 저장 확인
- 위치: `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:35–40`
- 상세: `config` 컬럼에 `encryptedJsonTransformer` (AES-256-GCM)가 적용되어 DB에 평문 저장되지 않는다. 주석에 "production 에서 반드시 `INTEGRATION_ENCRYPTION_KEY` 설정 필요"가 명시되어 있다 — 환경 변수 누락 시 평문 fallback이 있음을 명시적으로 경고한 것으로, 운영 배포 시 반드시 키 설정이 필요하다.

---

## 요약

이번 PR 의 변경 범위는 트리거 목록 페이지에 인증(AuthConfig) 컬럼을 추가하고, 무인증 webhook 에 경고 아이콘을 표시하는 순수 UI 증분이다. 새로 추가된 코드 자체에는 인젝션·하드코딩 시크릿·인증 우회·OWASP Top 10 해당 취약점이 발견되지 않았다. 인증 판단 로직은 올바르게 백엔드(`hooks.service.ts`)에 위임되어 있으며, 클라이언트에서의 경고 표시 유무가 서버 측 보안 결정에 영향을 주지 않는다. 연관 백엔드 코드에서는 CIDR IP 화이트리스트 미구현이 WARNING 수준으로 존재하나, 이는 이번 PR 에서 도입된 코드가 아니다. 전체적으로 보안 설계(타이밍 공격 방어, fail-closed, 마스킹, 암호화 저장, 역할 기반 접근 제어)는 양호하게 구현되어 있다.

---

## 위험도

LOW

> 이번 PR 변경 범위(프론트엔드 표시 레이어)에서는 직접적인 보안 결함이 없다. CIDR 화이트리스트 미구현 Warning 은 선행 코드 이슈이므로 별도 추적이 권장된다.
