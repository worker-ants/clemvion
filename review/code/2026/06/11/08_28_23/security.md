# 보안(Security) 리뷰 결과

## 발견사항

### C-1: jsonwebtoken devDeps → deps 이동

- **[INFO]** `jsonwebtoken` 9.0.3 프로덕션 의존성 등록 — 버전 고정 핀 적절
  - 위치: `codebase/backend/package.json` line 1424, `package-lock.json` line 35
  - 상세: `jsonwebtoken` 9.0.3은 현재 알려진 CVE 없음(9.0.x 계열은 CVE-2022-23529, CVE-2022-23540, CVE-2022-23541 이후 패치 완료). devDependencies에 놓여 `npm prune --omit=dev` 후 `@nestjs/jwt` 전이 패키지에 암묵적으로 기대던 fragile 상태를 해소한 것은 보안 위생상 올바른 조치.
  - 제안: 현재 조치 유지. 다만 `interaction-token.service.ts`가 저수준 `jsonwebtoken` API를 직접 호출하는 구조이므로, 추후 `@nestjs/jwt` JwtService로 교체(plan의 C-1 옵션 B)를 장기 백로그로 유지할 것을 권장. 직접 호출 시 알고리즘 지정(`algorithms` 옵션) 누락이나 `none` 알고리즘 허용 여부를 별도 소스 코드 리뷰 시 확인 필요.

- **[INFO]** `@types/jsonwebtoken` devDependencies 유지 — 올바름
  - 위치: `package.json` devDependencies, `package-lock.json` line 43
  - 상세: 타입 패키지는 런타임 영향 없음. 적절한 배치.

### C-2: hono override `^4.12.18` → `^4.12.21` 상향

- **[WARNING]** hono override 하한선 `^4.12.21` — CVE 패치 확보, 단 실제 resolve 버전 확인 필요
  - 위치: `package.json` overrides 섹션 line 1578, `package-lock.json` line 63–65 (`hono` 4.12.25 resolve 확인됨)
  - 상세: plan 문서에 언급된 hono CVE 4건(IP restriction bypass, Set-Cookie header injection, JWT middleware bypass, path routing bypass)은 `>=4.12.21`에서 패치됨. lock 파일에서 4.12.25로 resolve된 것을 확인했으므로 패치된 버전이 실제 설치됨. `^` 범위 pin이므로 향후 4.13.x 이상 릴리스 시 자동으로 resolve될 수 있으나, override floor이므로 취약 버전 재유입 차단은 유효함.
  - 제안: 현재 조치 유지. backend가 MCP client로만 hono를 경유 사용(hono 서버 미기동)이라 실노출면이 제한적이지만, 4건 중 JWT middleware bypass CVE는 이미 `@nestjs/jwt`와 jsonwebtoken을 직접 사용하는 backend의 인증 흐름과 논리적으로 독립적임을 코드 레벨에서 재확인 권장.

- **[INFO]** `chokidar` / `readdirp` `devOptional` → `dev` 변경
  - 위치: `package-lock.json` line 51–52, 73–74
  - 상세: lock 파일 메타데이터 정정. 보안 영향 없음. 두 패키지 모두 devDeps 범주에만 존재하는 것이 명확화됨.

### 기타 의존성 검토

- **[INFO]** `bcrypt ^6.0.0` — 패스워드 해시에 bcrypt 사용, 적절
  - 상세: 코드 변경 범위 외이나 의존성 목록 전체 확인 시 평문 패스워드 저장 위험성 없음.

- **[INFO]** `@simplewebauthn/server ^13.3.0`, `otplib ^12.0.1`, `passport-jwt ^4.0.1` 등 인증 관련 라이브러리 — 현재 변경 대상 아님
  - 상세: 이번 변경과 직접 관련 없으나, 의존성 목록에 MFA·WebAuthn 지원이 포함되어 있어 인증 체계가 다층화되어 있음을 확인.

- **[INFO]** `undici ^6.21.3` — HTTP 클라이언트. 6.x 계열에서 SSRF 관련 이슈가 있었으나 현재 선언 버전(^6.21.3)은 알려진 활성 CVE 없음. 모니터링 유지 권장.

## 요약

이번 변경은 순수 의존성 위생(security hygiene) 조치 2건이다. `jsonwebtoken`을 devDependencies에서 dependencies로 이동한 것은 프로덕션 빌드(`npm prune --omit=dev`) 후 암묵적 전이 의존에 기대던 fragile 상태를 해소하며, 9.0.3 버전 자체에 알려진 CVE가 없어 보안 수준을 저하시키지 않는다. `hono` override 하한선을 4.12.21 이상으로 상향한 것은 IP restriction·Set-Cookie·JWT middleware·path routing 관련 CVE 4건을 결정적으로 차단하며, lock 파일에서 4.12.25로 실제 resolve됨을 확인했다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등 주요 보안 취약점은 이번 변경 범위에서 발견되지 않았다. 다만 `jsonwebtoken` 직접 API 사용 코드(`interaction-token.service.ts`)에서 `algorithms` 옵션 지정 여부를 소스 코드 리뷰에서 별도 확인할 것을 권장한다.

## 위험도

LOW
