# Documentation Review

## 발견사항

### [INFO] audit-action.const.ts — 주석 정확성 업데이트 (파일 1)
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 모듈 JSDoc (line 35–39)
- 상세: `llm_config.*` / `rerank_config.*` / `password_change` / `2fa_*` 라는 구버전 명칭을 `model_config.*` / `user.password_changed` / `user.2fa_enabled` / `user.2fa_disabled` 로 수정하고, spec 참조 출처(`1-auth §4.1 + §Rationale 4.1.A`)도 명시했다. 변경된 코드와 주석이 완전히 일치한다.
- 제안: 현재 상태로 적절. 추가 조치 불필요.

### [INFO] client-ip.ts — 신규 공개 함수 `extractClientIpFromHeaders` JSDoc 완비 (파일 4)
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`의 `extractClientIpFromHeaders` 함수 JSDoc
- 상세: 새로 export 된 공개 함수에 목적·사용 맥락(webhook rate-limit guard, ip_whitelist 검증)·단일화 근거·`@returns` 태그가 모두 기재되어 있다. `extractClientIp` 에도 `@remarks` 로 암묵적 env 의존 사항이 추가되었다.
- 제안: 현재 상태로 적절.

### [INFO] refresh-cookie.ts — `setRefreshTokenCookie` JSDoc 신규 추가 (파일 6)
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`의 `setRefreshTokenCookie` 함수
- 상세: 이전에는 JSDoc 없이 구현만 존재하던 공개 함수에 `@param`, `@remarks`, spec 참조(`§2.3/Rationale 2.3.B`)가 추가되었다. `clearRefreshTokenCookie` 의 기존 JSDoc도 path 패리티 경고를 담고 있어 set/clear 쌍 문서가 대칭적으로 완성된다.
- 제안: 현재 상태로 적절.

### [INFO] condition-evaluator.util.ts — `MAX_REGEX_LENGTH` 상수 설명 보강 (파일 11)
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` line 36–40
- 상세: `{@link compileRegexCache}` 참조에 `{@link compileUserRegex}`가 추가되고, 200자 기준의 근거(기존 노드 규약 계승)와 이중 방어 구조(`safe-regex` 1차, 길이 상한 2차)가 설명되었다. 주석이 실제 구현 전략과 정확히 일치한다.
- 제안: 현재 상태로 적절.

### [INFO] hooks.service.ts — 내부 헬퍼 `extractClientIp` 주석 업데이트 (파일 7)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 파일 말미 `extractClientIp` 함수 JSDoc
- 상세: "추후 공용 util 추출 후보" 라는 TODO 성 문구가 삭제되고 실제로 수행된 단일화 내용("공유 코어 `extractClientIpFromHeaders` 에 위임")으로 교체되었다. req.ip trust-proxy 폴백 미적용 이유도 인라인 주석으로 명시되었다.
- 제안: 현재 상태로 적절.

### [INFO] public-webhook-throttle.guard.ts — 내부 `extractClientIp` 주석 업데이트 (파일 8)
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 말미 `extractClientIp` 함수 JSDoc
- 상세: "hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보." 라는 구버전 TODO가 제거되고 실제 통합 결과를 반영하는 설명으로 교체되었다.
- 제안: 현재 상태로 적절.

### [INFO] websocket.module.ts — 인라인 주석 의도 설명 충분 (파일 10)
- 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` `secret` fallback 라인
- 상세: `'fallback'` → `'dev-jwt-secret'` 변경 이유(dev sentinel 통일, production 부팅 가드가 차단하는 값)가 3줄 주석으로 명확히 설명되어 있다.
- 제안: 현재 상태로 적절.

### [INFO] 테스트 파일 인라인 주석 품질 (파일 2, 3, 5, 9, 12)
- 위치: 신규 추가된 테스트 케이스 전반
- 상세: 각 테스트 케이스 앞에 `// 04 후속 —` 형태로 추가 배경·보안 의도·회귀 시나리오가 설명되어 있다. 테스트 설명 문자열도 의도를 충분히 담고 있어 별도 외부 문서 없이 테스트 의도를 파악할 수 있다.
- 제안: 현재 상태로 적절.

### [WARNING] 환경변수 `COOKIE_DOMAIN` 문서화 확인 필요 (파일 5, 6)
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.ts`의 `setRefreshTokenCookie`/`clearRefreshTokenCookie` — `cookieDomain` 옵션
- 상세: `cookieDomain` 옵션과 함께 domain set/clear 패리티 테스트가 추가되었다. 이 값이 어떤 환경변수(예: `COOKIE_DOMAIN`)에서 공급되는지는 해당 파일 내에서 확인되지 않는다. 호출 측(auth.controller.ts 등)에서 env를 주입한다면 해당 env 변수가 운영 문서(README 또는 spec 설정 섹션)에 기재되어 있는지 별도 확인이 권장된다.
- 제안: `COOKIE_DOMAIN` 등 관련 환경변수가 실제로 사용된다면 `spec/` 또는 운영 가이드에 해당 변수의 기본값·목적·예시 값을 명시할 것.

### [INFO] CHANGELOG/README 업데이트 필요성
- 위치: 프로젝트 루트 레벨
- 상세: 이번 변경은 보안 하드닝 후속(security-hardening-followups) 작업으로 기존 동작을 깨지 않는 리팩터링·테스트 보강이 주를 이룬다. 새 공개 API(`extractClientIpFromHeaders`)가 추가되었으나 내부 모듈 전용이고 외부 API 엔드포인트 변경은 없다. 프로젝트가 CHANGELOG를 별도 관리하지 않고 plan/spec 체계로 변경 이력을 추적하는 구조이므로 CHANGELOG 항목 추가 부담은 낮다.
- 제안: plan/complete로 이동 시 plan 문서에 `extractClientIpFromHeaders` 공개 export 및 보안 강화 내용이 기록되면 충분.

---

## 요약

12개 파일 전반에 걸쳐 문서화 상태는 전반적으로 양호하다. 신규 export 함수(`extractClientIpFromHeaders`)에는 목적·맥락·반환값이 명시된 JSDoc이 완비되었고, 리팩터링으로 제거된 중복 구현의 구버전 TODO 주석들이 실제 통합 결과를 반영하는 내용으로 정확히 교체되었다. 보안 관련 상수(`MAX_REGEX_LENGTH`)의 방어 계층 근거도 인라인에 명시되어 있다. 주의가 필요한 부분은 `cookieDomain` 옵션에 대응하는 환경변수(예: `COOKIE_DOMAIN`)의 운영 문서 존재 여부 확인이며(WARNING 1건), 이는 해당 env가 실제로 외부 환경변수로 노출될 경우에 한해 spec 또는 운영 가이드에 추가 기재가 권장된다.

## 위험도

LOW
