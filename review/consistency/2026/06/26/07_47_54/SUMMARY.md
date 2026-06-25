# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/WARNING 없음. naming_collision 이 LOW, 나머지 4개는 NONE. 모든 발견사항은 구현 착수 전 설계 주의사항(INFO) 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | timestamp/nonce 가드 helper 추출 시 에러코드·HMAC 빌더 주입 설계 | `handleInstall` L1317–1326, `handleMakeshopInstall` L1622–1631 | `replayErrorCode`·`hmacMessageBuilder` 를 caller 주입 인자로 받도록 helper 시그니처 설계 |
| 2 | cross_spec | post-install redirect helper — redirect URL 반환만, logger.log 는 각 메서드 유지 | `handleInstall` L1436–1451, `handleMakeshopInstall` L1715–1726 | helper 가 URL 문자열만 반환하고 `this.logger.log(...)` 는 caller 에 잔류 |
| 3 | cross_spec | reauthorize state 생성 helper — PKCE verifier 는 `providerMeta` 로 caller 주입 | `handleInstall` L1461–1484, `handleMakeshopInstall` L1785–1812 | `createReauthorizeState({ ..., providerMeta })` 시그니처로 PKCE 분기를 caller 에서 결정 |
| 4 | cross_spec | HMAC 빌더 격리 — cafe24용 `buildHmacMessage`를 makeshop 경로에서 공유 호출 금지 | HMAC 빌더 호출 경로 | `hmacMessageBuilder: (rawQuery: string) => string` 주입 인자 유지, 공용 직접 호출 구조 금지 |
| 5 | rationale_continuity | HMAC 빌더 주입 분리 — `buildMakeshopHmacMessage` `VERIFY` 마킹 invariant 유지 | `integration-oauth.service.ts` HMAC 빌더 호출부 | helper 구현 후 빌더를 내부에서 직접 import/선택하면 invariant 파괴; 코드 리뷰에서 주입 경로 재확인 |
| 6 | rationale_continuity | reauthorize state makeshop PKCE verifier(`code_verifier`) 누락 위험 | `handleMakeshopInstall` reauthorize state 생성부 | 공통 helper 추출 후 `providerMeta` 경로로 `code_verifier` 가 반드시 전달되는지 확인 |
| 7 | convention_compliance | 추출 helper 명명 — 의미 기반 동사+명사, 호출 위치를 이름에 박지 않음 | 계획 단계 (미작성) | `checkTimestampWindow`, `checkNonceReplay`, `buildPostInstallRedirectUrl`, `saveReauthorizeState` 류 권장 |
| 8 | convention_compliance | `buildMakeshopHmacMessage` 의 `VERIFY` 주석 — 추출 후에도 반드시 유지 | `buildMakeshopHmacMessage` 함수 본문 | 추출이 VERIFY 마킹을 제거하면 안 됨 |
| 9 | convention_compliance | 에러 코드 문자열 값 변경 없는 추출 — 발행 위치 이동은 무방하나 코드 값 변경은 breaking | 각 `throw BadRequestException({ code: '...' })` 호출부 | PR diff 에서 에러 코드 문자열 통과 여부 확인 |
| 10 | naming_collision | `IntegrationInstallConfig` 타입 신규 도입 — 기존 `*InstallQuery` DTO 와 역할 혼동 방지 | `integration-oauth.service.ts` 타입 선언 예정 | (본 구현은 config 타입 미도입 — 4종 focused helper 만 추출) |
| 11 | naming_collision | `authorizeUrlBuilder` config 필드 — M-2 에서 도입된 `resolveOAuthStrategy` 와 중복 추상화 위험 | config 설계 단계 | provider 식별자를 config 에 받고 파이프라인 내부에서 `resolveOAuthStrategy` 직접 호출 권장 (본 구현은 authorize URL 빌드를 각 caller 에 유지) |
| 12 | naming_collision | nonce 가드 helper — `mallId` 파라미터에 makeshop `shop_uid` 흡수 시 명칭 중립화 필요 | `Cafe24InstallNonceCache.isReplay({ mallId, ... })` 호출부 | 공통 helper 파라미터를 `identifier` 로 중립화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 4종 보일러플레이트 추출은 기존 spec(`4-cafe24.md §9.8`, `5-makeshop.md §9.7`, `error-codes.md §2`)과 충돌 없음. 에러코드·HMAC 빌더·로그를 caller 주입/잔류로 유지하는 설계 확인 사항 6건(INFO) |
| rationale_continuity | NONE | 기존 Rationale 4개(error-codes §2 rename, HMAC raw-encoded, makeshop VERIFY 격리, OAuthState.mode='reauthorize' 재사용) 모두 scope 기술이 명시 준수. HMAC 빌더 주입·PKCE verifier 누락 주의 2건(INFO) |
| convention_compliance | NONE | 정식 규약 직접 위반 없음. 추출 helper 명명·VERIFY 주석 유지·에러 코드 값 보존 3건(INFO) |
| plan_coherence | NONE | `03-maintainability.md §M-1` 추출 대상 4종·HMAC 격리·에러코드 prefix·callback 경계 분리와 완전 정합. 선행 미해소 항목(`C-3` API 클라이언트) 파일 범위 교차 없음 |
| naming_collision | LOW | 신규 외부 계약 식별자 없음. 내부 helper 명 미확정 상태의 설계 주의 4건(INFO) |

## 권장 조치사항 (구현 반영)

1. **BLOCK 해소**: 없음 — 즉시 구현 착수 가능.
2. helper 시그니처: `replayErrorCode: string`·`providerMeta` 를 caller 주입 인자로 유지. HMAC 빌더는 **이미 모듈 함수로 분리**(`buildHmacMessage`/`buildMakeshopHmacMessage`)돼 있어 각 caller 가 직접 호출 — helper 가 HMAC 경로를 흡수하지 않음.
3. `buildMakeshopHmacMessage` 의 `VERIFY` 주석 유지 (본 추출은 HMAC 빌더 미변경).
4. post-install redirect helper(`buildIntegrationDetailRedirectUrl`)는 URL 문자열만 반환, `this.logger.log(...)` 는 각 메서드에 잔류.
5. reauthorize state helper(`persistReauthorizeState`)에서 makeshop `code_verifier` 가 `providerMeta` 로 누락 없이 전달.
6. helper 명: 의미 기반 동사+명사 — `assertInstallTimestampFresh`·`assertInstallNonceNotReplayed`·`buildIntegrationDetailRedirectUrl`·`persistReauthorizeState`.
7. authorize URL 빌드는 각 caller 에서 `resolveOAuthStrategy` 직접 호출 유지(config·authorizeUrlBuilder 미도입).
8. nonce 가드 helper 파라미터 `identifier` 로 중립화.
