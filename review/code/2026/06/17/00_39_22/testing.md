# Testing Review

## 발견사항

### [WARNING] `totp.service.spec.ts`: `disable()` 메서드 미커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/backend/src/modules/auth/totp.service.ts` lines 119-125
- 상세: `TotpService.disable()` 는 `twoFactorEnabled=false`, `twoFactorSecret=null`, `totpRecoveryCodes=null` 세 필드를 업데이트하는 로직인데, 신규 spec 파일 `totp.service.spec.ts` 에 이에 대한 테스트가 전혀 없다. 2FA 비활성화 흐름은 보안 상 중요한 경로(사용자 인증 상태 변경)이므로, 이미 존재하는 v13 재작성 컨텍스트에서 테스트 누락은 회귀 위험을 내포한다.
- 제안: `disable()` 에 대한 테스트 케이스 추가 — 정상 경로(update 호출 검증, 인수 확인), 사용자가 이미 비활성 상태일 때의 idempotent 동작 확인.

### [WARNING] `totp.service.spec.ts`: `verifyForLogin` 의 "6자리 패턴이 아닌 코드로 TOTP 경로를 건너뛰는" 경로 미커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/backend/src/modules/auth/totp.service.ts` lines 134-137
- 상세: `verifyForLogin` 는 입력이 `/^\d{6}$/` 에 일치하지 않으면 TOTP 검증을 건너뛰고 복구 코드 경로만 탄다. 예를 들어 7자리 숫자나 문자 포함 토큰을 넣었을 때의 동작(복구 코드로만 처리, 결국 `false` 반환)을 검증하는 케이스가 없다.
- 제안: `verifyForLogin` 에 대해 "6자리가 아닌 숫자 코드 → TOTP 경로 스킵 → 복구 코드도 없을 때 false" 케이스 추가.

### [WARNING] `totp.service.spec.ts`: `verifyAndEnable` 의 `user` 가 없고 `twoFactorSecret` 도 없는 두 가지 `BadRequestException` 경로를 단일 케이스로 합산 가능성
- 위치: `totp.service.spec.ts` lines 706-712 (secret 미발급 케이스)
- 상세: `verifyAndEnable` 의 `!user || !user.twoFactorSecret` 가드는 두 가지 케이스(사용자 없음 / secret 없음)를 모두 처리하는데, 현재 테스트는 `secret=null` 케이스(`makeUser()`)만 커버하고 `user=null` 케이스(findById → null 반환)는 커버하지 않는다. `setup` 에는 user-not-found 케이스가 있으나 `verifyAndEnable` 에는 없다.
- 제안: `usersService.findById.mockResolvedValue(null)` 케이스를 `verifyAndEnable` 에도 추가해 분기 완전성 보장.

### [WARNING] `safe-html.test.ts`: `renderTemplateHtml` 에 빈 문자열 입력 케이스 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/channel-web-chat/src/lib/safe-html.test.ts`
- 상세: `renderTemplateHtml("")` 또는 `renderTemplateHtml("   ", "markdown")` 같은 빈/공백 입력 케이스가 없다. LLM 응답이 빈 문자열로 올 수 있으며, 이때 DOMPurify 나 marked 의 동작이 예상 범위 내(null 또는 빈 string 반환)인지 검증되지 않았다.
- 제안: `renderTemplateHtml("", "html")`, `renderTemplateHtml("", "markdown")` 케이스를 추가해 null/empty-string 반환 동작 고정.

### [WARNING] `auth.service.spec.ts`: `(jwtService.sign as jest.Mock)` 와 `sessionsService.revokeAllFamilies.mock` 캐스팅 불일치
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/deps-backlog-residual/codebase/backend/src/modules/auth/auth.service.spec.ts` lines 586-590 (변경 후)
- 상세: 변경 후 `revokeOrder` 는 `sessionsService.revokeAllFamilies.mock`(캐스팅 없이 직접 접근)으로 참조하는 반면, `signOrder` 는 `(jwtService.sign as jest.Mock).mock` 형태를 유지한다. 타입 일관성 측면에서 혼용은 혼란을 주고, `jwtService` 가 `jest.Mocked<JwtService>` 로 선언돼 있다면 `jwtService.sign.mock`도 캐스팅 없이 접근 가능하다.
- 제안: `const signOrder = jwtService.sign.mock.invocationCallOrder[0];` 로 통일해 코드 스타일 일관성 및 불필요한 캐스팅 제거.

### [INFO] `totp.service.spec.ts`: cross-version 호환성 테스트가 `generateSync` 를 직접 import — mock 격리 위험 없음 확인 필요
- 위치: `totp.service.spec.ts` line 12 (`import { generateSync } from 'otplib'`)
- 상세: `verifyAndEnable` 테스트에서 `generateSync({ secret })` 를 직접 호출해 현재 시각 기준 코드를 생성하고 `service.verifyAndEnable` 에 전달한다. 이 방식은 otplib 의 실제 시간 함수에 의존하므로 시스템 시각 drift 가 클 경우(CI 환경 NTP 지연 등) flaky 할 수 있다. `EPOCH_TOLERANCE_SECONDS = 30` 이 ±1 step 허용이므로 실질 위험은 낮지만, `epoch` 옵션을 고정해 deterministic 하게 만들 수 있다.
- 제안: 필수는 아니지만, `verifyAndEnable` 의 코드 생성 부분에도 `generateSync({ secret, epoch: Date.now() })` 처럼 명시적으로 epoch 를 넣어 의도를 문서화하는 것을 고려.

### [INFO] `totp.service.spec.ts`: `bootstrapSecret` 헬퍼의 `usersService.update` mock 상태를 `beforeEach` 재설정과 교차 사용
- 위치: `totp.service.spec.ts` lines 775-786 (`bootstrapSecret` helper)
- 상세: `bootstrapSecret` 는 `usersService.findById.mockResolvedValueOnce` 를 호출하고 내부에서 `service.setup` 을 실행한다. `setup` 은 `usersService.update` 를 호출하므로 `update.mock.calls` 에 호출 기록이 쌓인다. 이후 `verifyAndEnable` 테스트에서 `update.mock.calls.at(-1)` 로 마지막 호출을 확인하는데, `bootstrapSecret` 가 앞서 남긴 `setup` 의 update 호출이 먼저 들어가 있어 인덱스 계산이 올바른지 확인이 필요하다. 현재 코드는 `.at(-1)` 로 마지막을 가져오므로 실질적 문제는 없지만 명시성 부족.
- 제안: `expect(usersService.update).toHaveBeenLastCalledWith(...)` 형태로 리팩토링해 의도 명확화.

### [INFO] `production-guards.spec.ts`: 코드 포맷 변경만, 테스트 로직 무변경 — 회귀 없음
- 위치: `codebase/backend/src/common/config/production-guards.spec.ts` lines 185-528
- 상세: `isSwaggerEnabled` 테스트의 인라인 오브젝트를 멀티라인으로 포맷한 변경만. 논리 변경 없어 회귀 위험 없음.

### [INFO] `jest.config.ts`: `transformIgnorePatterns` 에 `@otplib|@scure|@noble` 패턴 추가 — 누락 패키지 없음 확인
- 위치: `codebase/backend/jest.config.ts` line 96
- 상세: `otplib v13` 의 ESM-only 하위 패키지(`@otplib/*`, `@scure/base`, `@noble/hashes`)가 모두 포함됐다. `@noble/hashes` 의 경우 `@otplib/plugin-crypto-noble/node_modules/@noble/hashes` 에 중첩 설치되는데, `node_modules/(?!...)` 패턴은 최상위 경로에만 적용되므로 중첩된 경우는 이미 변환 대상으로 분류된다 — 문제 없음.

## 요약

이번 변경의 핵심 테스트 관련 작업은 두 가지다: otplib v12→v13 마이그레이션에 대응한 `totp.service.spec.ts` 신규 작성, 그리고 channel-web-chat `safe-html.test.ts` 추가. 두 테스트 파일 모두 정상 경로·예외 경로·보안 벡터·cross-version 호환 게이트를 포괄하는 수준 높은 커버리지를 보여 전반적으로 양호하다. 주요 갭은 `TotpService.disable()` 경로 완전 미테스트, `verifyAndEnable` 의 user-null 분기 누락, 빈 입력에 대한 safe-html 경계값 테스트 부재 세 건이다. `auth.service.spec.ts` 의 mock 캐스팅 불일치는 기능 이상은 아니나 가독성 개선 여지가 있다.

## 위험도

LOW
