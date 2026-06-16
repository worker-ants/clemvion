# Code Review 통합 보고서

## 전체 위험도
**LOW** — 의존성 업그레이드(otplib v12→v13 메이저, plugin-react v4→v6, jsdom v25→v29, dayjs 패치) 및 Node.js 버전 정책 통일 작업. 테스트 11/11 PASS, build PASS 확인. CRITICAL 발견 없음; 테스트 커버리지 갭·레이트 리밋 미확인·vite peerDep 확인 필요 등 WARNING 6건 존재.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / 인증인가 | TOTP verify 엔드포인트에 레이트 리밋(brute-force 방지) 적용 여부가 이 diff 범위에서 확인되지 않음. 6자리 코드는 최대 10^6 조합 | `totp.service.ts` — `verifyAndEnable`, `verifyForLogin` 호출 컨트롤러 | 컨트롤러 엔드포인트에 `@Throttle()` 데코레이터(NestJS throttler) 적용 여부 확인·미적용 시 추가 |
| 2 | Security / 로깅 | TOTP 검증 실패 시 `logger.warn` 에 `(err as Error).message` 포함 — otplib 내부 에러 타입이 로그 집계 시스템에 유입될 수 있음(OWASP A09 경계) | `totp.service.ts` `verifyCode` 메서드 | `err.constructor.name` 또는 사전 정의된 에러 코드만 로깅하거나 log level 을 `debug` 로 낮춰 프로덕션에서 억제 |
| 3 | Testing / 커버리지 | `TotpService.disable()` 메서드에 대한 테스트가 전혀 없음. 2FA 비활성화는 보안 상 중요한 경로 | `totp.service.ts` lines 119-125, `totp.service.spec.ts` | `disable()` 정상 경로·idempotent 동작 테스트 케이스 추가 |
| 4 | Testing / 커버리지 | `verifyAndEnable` 의 `user=null` 분기(findById → null) 테스트 누락. `user.twoFactorSecret=null` 케이스만 커버 | `totp.service.spec.ts` | `usersService.findById.mockResolvedValue(null)` 케이스 추가 |
| 5 | Testing / 커버리지 | `safe-html.test.ts` 에서 `renderTemplateHtml("")`, `renderTemplateHtml("   ", "markdown")` 등 빈/공백 입력 경계값 케이스 미테스트 | `codebase/channel-web-chat/src/lib/safe-html.test.ts` | `renderTemplateHtml("", "html")`, `renderTemplateHtml("", "markdown")` 케이스 추가 |
| 6 | Dependency / peerDep | `@vitejs/plugin-react v6` 은 vite `^8.0.0` 만 peer 로 허용. channel-web-chat 의 vite 직접 버전이 v8 로 맞춰졌는지 diff 에서 미확인. v7 이하 시 경고 발생 가능 | `codebase/channel-web-chat/package.json` | `channel-web-chat/package.json` 의 vite 버전이 `^8` 로 선언되어 있는지 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Type Safety | `verifySync` 반환값 `VerifyResult` 가 TOTP/HOTP 공용 유니온 타입. strategy 생략 시 기본값 `'totp'` 이므로 런타임 문제 없으나 TypeScript 컴파일 타임 보장 명시성 부족 | `totp.service.ts` lines 48-52 | `strategy: 'totp' as const` 명시 추가 |
| 2 | SPEC-DRIFT | `spec/7-channel-web-chat/4-security.md` §1.1 sanitize 정책 매트릭스 업데이트(deny-by-default DOMPurify ALLOWED_TAGS/ATTR/URI_REGEXP 구체화)에 대응하는 `codebase/channel-web-chat` 실제 코드 변경이 이번 diff 에 없음. 기존 구현이 이미 충족하는지 별도 검증 필요 | `spec/7-channel-web-chat/4-security.md`, `codebase/channel-web-chat` DOMPurify 설정 | 구현이 spec 기술과 일치하는지 확인. 미달 시 별도 task |
| 3 | SPEC-DRIFT | NODE.js 버전 정책(내부 `>=24` / 외부 SDK `>=20`) 이 PROJECT.md 에 추가됐으나 `spec/0-overview.md` 나 `spec/conventions/` 에 공식 위치가 없음 | `PROJECT.md` 버전 정책 섹션 | 현행 PROJECT.md 위치는 프로젝트 관행과 일치. `spec/0-overview.md` 에 cross-ref 추가 고려 |
| 4 | Documentation | `packages/sdk` 의 engines 필드가 "외부 SDK `>=20`" 정책을 실제로 반영했는지 이번 diff 에서 확인되지 않음 | `PROJECT.md` + `codebase/packages/sdk/package.json` | `packages/sdk` engines 필드 확인·미반영 시 갱신 |
| 5 | Scope / Dependency | `@vitejs/plugin-react v6` 업그레이드로 vite v8 이 묵시적 포함되어 esbuild→rolldown·lightningcss 번들러 전환이 발생. plan 에 vite 메이저 업그레이드 명시 없음 | `codebase/channel-web-chat/package-lock.json` | build+test PASS 로 실제 위험 낮음. 차기 plan 에 vite 메이저 버전 명시 권장 |
| 6 | Security / 암호화 | 복구 코드가 SHA-256 으로만 해시 저장. bcrypt/argon2 같은 KDF 아님. 72비트 엔트로피·일회성 특성으로 현재는 수용 가능 | `totp.service.ts` 복구 코드 저장 로직 | 장기적으로 KDF 전환 검토 가능. 현재 설계 허용 |
| 7 | Maintainability | `auth.service.spec.ts` 에서 `revokeAllFamilies.mock` 은 캐스팅 없이 접근하나 `(jwtService.sign as jest.Mock).mock` 은 캐스팅 유지 — 일관성 불일치 | `auth.service.spec.ts` lines 586-590 | `jwtService.sign.mock` 으로 통일 |
| 8 | Maintainability | `verifyCode` 내 `logger.warn` 메시지가 영문, 서비스 예외 메시지는 한국어 — 로그 언어 혼재 | `totp.service.ts` | 프로젝트 로그 언어 컨벤션 확립 후 일괄 정리 |
| 9 | Testing | `verifyForLogin` 의 6자리가 아닌 입력(7자리·문자 포함) → 복구 코드 경로만 탄 후 `false` 반환 케이스 미테스트 | `totp.service.spec.ts` | 해당 경계값 케이스 추가 |
| 10 | Testing | `totp.service.spec.ts` `bootstrapSecret` 헬퍼가 파일 맨 끝에 위치, 사용 위치보다 훨씬 뒤 | `totp.service.spec.ts` lines 775-786 | 헬퍼를 describe 블록 상단 또는 helpers 섹션으로 이동 |
| 11 | Dependency | `uglify-js` lockfile 의 `"dev": true` 플래그 제거 — npm install 재실행의 부수 결과. optional 유지 | `codebase/backend/package-lock.json` | 허용. optional 이므로 런타임 영향 없음 |
| 12 | Security / 공급망 | `thirty-two@1.0.2`(마지막 업데이트 2014년) 및 deprecated otplib v12 플러그인 제거 — 공급망 보안 개선 | `backend/package-lock.json` | 이상 없음 (긍정적 변화) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TOTP 레이트 리밋 미확인(WARNING), 에러 메시지 로깅(WARNING). otplib v13 noble/scure 전환 보안 개선 |
| requirement | LOW | spec §1.4 핵심 요구사항 충족. SPEC-DRIFT 2건(spec §1.1 코드 검증 필요, NODE 버전 정책 SoT) |
| scope | LOW | 전체 변경 plan 범위 내. vite v7→v8 묵시적 포함이 plan 미명시(WARNING 수준) |
| side_effect | LOW | otplib 전역 공유 상태 제거(개선). generateURI 포맷·verifySync 반환값 테스트로 검증 완료 |
| maintainability | LOW | 로그 언어 혼재, 캐스팅 불일치, 테스트 매직 리터럴 등 소규모 INFO |
| testing | LOW | disable() 완전 미테스트(WARNING), verifyAndEnable user-null 분기 누락(WARNING), safe-html 빈입력 경계값(WARNING) |
| documentation | LOW | setup() JSDoc v13 미반영(INFO), packages/sdk engines 미확인(WARNING) |
| dependency | LOW | 모든 신규 의존성 MIT/BlueOak. @vitejs/plugin-react v6 vite ^8 peer 확인 필요(WARNING) |
| user_guide_sync | NONE | 사용자 가시 동작 불변. README 동반 갱신 완료. 누락 0건 |

---

## 발견 없는 에이전트

- **user_guide_sync** — 동반 갱신 누락 0건, 위험도 NONE

---

## 권장 조치사항

1. **[필수] TOTP verify 컨트롤러 레이트 리밋 확인** — `verifyAndEnable`·`verifyForLogin` 엔드포인트에 `@Throttle()` 적용 여부 확인, 미적용 시 즉시 추가 (보안 위험).
2. **[권장] 테스트 커버리지 갭 해소** — `TotpService.disable()` 테스트 추가 (보안 경로), `verifyAndEnable` user-null 분기 추가, `safe-html` 빈입력 경계값 추가.
3. **[권장] vite peerDep 확인** — `codebase/channel-web-chat/package.json` 의 vite 버전이 `^8` 로 선언되어 있는지 확인.
4. **[권장] packages/sdk engines 필드 확인** — PROJECT.md "외부 SDK `>=20`" 정책이 `packages/sdk/package.json` 에 반영되었는지 검증.
5. **[권장] spec §1.1 구현 정합성 확인** — `channel-web-chat` DOMPurify 설정이 `spec/7-channel-web-chat/4-security.md §1.1` 의 ALLOWED_TAGS/ALLOWED_URI_REGEXP 기술과 실제 일치하는지 별도 검증. 미달 시 task 생성.
6. **[선택] 에러 로그 수준 조정** — `totp.service.ts` `verifyCode` 의 `logger.warn` 에서 에러 메시지 대신 에러 타입명만 로깅 또는 log level을 debug 로 낮춤.
7. **[선택] `auth.service.spec.ts` 캐스팅 일관성 정리** — `jwtService.sign.mock` 으로 통일.
8. **[선택] verifySync strategy 명시** — `strategy: 'totp' as const` 추가로 TypeScript 컴파일 타임 의도 명확화.

---

## 라우터 결정

라우터가 선별 실행(`routing_status=done`).

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `user_guide_sync` (9명) — 전원 router_safety 강제 포함
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명 강제, user_guide_sync 추가)
- **제외**: 아래 표 (5명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 의존성 업그레이드·정책 문서화 위주 변경으로 성능 프로파일링 불필요 |
| architecture | 아키텍처 구조 변경 없음 — otplib API 교체는 모듈 내부 구현 변경 |
| database | DB 스키마·마이그레이션 변경 없음 |
| concurrency | 동시성 패턴 변경 없음 |
| api_contract | 외부 API 계약 변경 없음 — 내부 라이브러리 교체 |