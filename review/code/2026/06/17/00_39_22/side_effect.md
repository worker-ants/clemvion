# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] otplib v12→v13: 생성자 전역 옵션 설정 방식 변경 — 공유 상태 제거
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` (생성자 → `verifyCode` private 메서드)
- 상세: 기존 코드는 `authenticator.options = { window: 1 }` 로 otplib `authenticator` 싱글톤의 전역 상태를 변경했다. v13 에서 `generateSecret`, `generateURI`, `verifySync` 를 함수형으로 직접 호출하면서 전역 공유 상태 변경이 사라졌다. 이는 **부작용 감소** 관점에서 긍정적 변화이나, 기존에 동일 프로세스 내에서 `authenticator` 싱글톤을 의존하는 코드가 있다면 `window: 1` 기본값 보장이 사라진다. 현재 코드베이스에서 `authenticator` 를 직접 import 하는 다른 경로가 없다면 문제 없다.
- 제안: `grep -r "from 'otplib'" codebase/backend/src/` 로 다른 import 경로 없음을 확인. 테스트 파일(`totp.service.spec.ts`)에서 `generateSync` 를 직접 import 하므로 스펙 파일에서도 전역 상태에 의존하지 않는 구조가 확인된다.

### [WARNING] `generateURI` 호출 시 otpauth URI label 포맷 변화 가능성 — QR 코드 이중 인코딩
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` 라인 ~72
- 상세: v12 의 `authenticator.keyuri(user.email, ISSUER, secret)` 는 `otpauth://totp/<ISSUER>:<email>?issuer=<ISSUER>&secret=<SECRET>` 포맷을 생성했다. v13 의 `generateURI({ issuer: ISSUER, label: user.email, secret })` 는 label 에 issuer prefix 를 자동으로 붙이지 않을 수 있으며(`otpauth://totp/<email>` vs `otpauth://totp/Clemvion:<email>`), 스펙 파일의 검증 `expect(res.otpauthUrl).toContain('otpauth://totp/Clemvion:')` 이 통과하는지 여부가 런타임 동작의 단일 진실이다. 만약 v13 `generateURI` 가 label 에 issuer prefix 를 붙이지 않는다면, 기존에 QR 코드를 스캔해서 등록한 사용자의 계정명 표시가 달라지나(보안 기능 유지는 됨) 새로 등록하는 사용자의 Authenticator 앱 표시 이름이 변경된다.
- 제안: 테스트에서 `res.otpauthUrl.toContain('otpauth://totp/Clemvion:')` 이 통과한다고 plan에 기록되어 있으므로(11/11 pass) 실제 포맷이 기대와 일치함을 확인. 기존 사용자(이미 등록된 TOTP) 는 secret 이 DB에 저장되어 있으므로 재등록 없이 동작한다.

### [INFO] `verifySync` API 변경: `.valid` 프로퍼티 접근 — 런타임 안전성
- 위치: `codebase/backend/src/modules/auth/totp.service.ts`, `verifyCode` 메서드
- 상세: v13 의 `verifySync(...)` 가 `{ valid: boolean }` 객체를 반환한다고 가정하고 `.valid` 를 접근한다. v12 의 `authenticator.check()` 는 `boolean` 직접 반환이었다. 코드가 `return verifySync({...}).valid` 로 작성되어 있으므로 v13 API 가 예상과 다른 타입을 반환하면 `undefined` (falsy) 가 되어 TOTP 검증이 항상 실패할 수 있다. try-catch 로 감싸져 있으나 타입 오류는 예외를 발생시키지 않으므로 silent failure 위험이 있다.
- 제안: 테스트가 11/11 통과했으므로 실제 동작은 정상. `verifySync` 반환값 타입을 TypeScript 레벨에서 명시적으로 검증하거나 구조 분해 `const { valid } = verifySync(...)` 패턴으로 코드 의도를 명확히 할 수 있다.

### [INFO] `EPOCH_TOLERANCE_SECONDS = 30` 상수: 전역 상수로 module-scope에 추가
- 위치: `codebase/backend/src/modules/auth/totp.service.ts` 라인 ~18
- 상세: 모듈 최상단에 `const EPOCH_TOLERANCE_SECONDS = 30` 이 추가된다. 이 값은 export 되지 않으므로 모듈 외부에서 접근 불가. 공유 상태 오염 없음. 단, 이 값이 하드코딩되어 있어 테스트에서 다른 tolerance 로 오버라이드할 방법이 없다. 현재 테스트는 `epochTolerance` 를 주입하지 않고 서비스 전체를 테스트하므로 적절한 설계다.
- 제안: 문제 없음.

### [INFO] `@types/node` ^22 → ^24 로 업그레이드: TypeScript 타입 정의 변화
- 위치: `codebase/backend/package.json`, `codebase/channel-web-chat/package-lock.json`
- 상세: `@types/node` 메이저 버전 업그레이드로 `undici-types` 의존이 `~6.21.0` → `~7.18.0` 으로 변경된다. Node.js 24 API 신규 타입이 추가되고 일부 deprecated API 타입이 제거될 수 있다. 기존 코드가 제거된 타입을 사용하면 TypeScript 컴파일 오류가 발생하며, 이는 런타임 부작용이 아닌 빌드 단계 오류로 나타난다. build PASS 확인되었으므로 현재 문제 없음.
- 제안: 문제 없음.

### [INFO] `eslint-disable-next-line @typescript-eslint/no-unused-vars` 제거 — `jwtService` 변수 lint 경고 변화
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` 라인 ~32
- 상세: `// eslint-disable-next-line` 주석이 제거되고 빈 줄로 교체된다. 만약 `jwtService` 가 실제로 사용되지 않는다면 ESLint 경고/오류가 발생할 수 있다. 그러나 이 변경은 코드가 실제로 사용되도록 refactor 되었음을 시사한다(같은 diff에서 cast 없이 `.mock` 직접 접근).
- 제안: 문제 없음. lint PASS 확인.

### [INFO] `(sessionsService.revokeAllFamilies as jest.Mock).mock` → `sessionsService.revokeAllFamilies.mock` 직접 접근
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` 라인 ~584
- 상세: 테스트 코드에서 불필요한 `as jest.Mock` cast가 제거되었다. `sessionsService` 가 이미 `jest.Mocked<SessionsService>` 타입이므로 `.mock` 에 직접 접근할 수 있다. 타입 정확도가 향상되어 미래에 sessionsService 타입이 바뀌면 컴파일 오류로 조기 포착된다. 기능적 부작용 없음.
- 제안: 문제 없음.

### [INFO] `production-guards.ts` 함수 시그니처 포맷팅 변경 — 기능 동일
- 위치: `codebase/backend/src/common/config/production-guards.ts` 라인 ~74
- 상세: `isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean` 이 멀티라인으로 포맷팅되었다. 타입, 기본값, 반환 타입 모두 동일하며 호출자 영향 없음.
- 제안: 문제 없음.

### [INFO] `engines.node` 필드 신규 추가 (advisory) — CI/배포 환경 경고 가능성
- 위치: `codebase/backend/package.json`, `codebase/packages/*/package.json`
- 상세: `engines: { "node": ">=24" }` 추가는 `engine-strict` 미사용 시 advisory 로만 동작한다(PROJECT.md 에도 명시). npm install 시 Node 버전이 낮으면 경고만 발생하고 설치는 계속된다. 그러나 `engine-strict=true` 가 `.npmrc` 에 설정되어 있다면 설치가 차단된다.
- 제안: `.npmrc` 에 `engine-strict` 설정 여부 확인 권고. 현재 프로젝트는 Node 24 에서만 테스트/운영하므로 advisory 수준으로도 충분.

### [INFO] `package-lock.json` 의 `uglify-js` dev 플래그 제거
- 위치: `codebase/backend/package-lock.json` 라인 ~18920
- 상세: `uglify-js` 의 `"dev": true` 가 제거되었다. npm lock 파일에서 `dev` 필드는 패키지가 devDependencies 에만 필요한지를 표시하는 메타데이터다. 실제 사용되는 패키지 자체는 변경되지 않으며 `optional: true` 는 유지된다. 프로덕션 번들에는 포함되지 않을 수 있으나, npm ci 동작(--production 없이)에는 영향 없음.
- 제안: 문제 없음. lock 파일 자동 재생성 결과로 예상되는 변화.

## 요약

이번 변경의 가장 핵심적인 부작용 관련 변화는 `totp.service.ts` 의 otplib v12→v13 마이그레이션으로, **전역 싱글톤 `authenticator` 의 공유 상태 변경(`authenticator.options = {...}`)을 함수형 호출로 교체**하여 의도치 않은 전역 상태 오염을 제거했다. 이는 부작용 관점에서 개선이다. `generateURI` 의 otpauth URI 포맷 및 `verifySync` 반환값 구조가 v12 API 와 다를 수 있으나, 테스트 11/11 통과 및 build PASS 로 기능적 동등성이 검증되었다. 나머지 변경(package.json engines 필드 추가, 포맷팅 변경, lock 파일 갱신, 문서 업데이트)은 런타임 부작용이 없는 구성/메타 변경으로, 전반적으로 부작용 위험이 낮은 변경 집합이다.

## 위험도

LOW
