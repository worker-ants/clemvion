# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성

- **[INFO]** 새 외부 npm 패키지 없음 — 모든 핵심 기능을 Node.js 내장 `crypto` 모듈로 구현
  - 위치: `codebase/backend/src/modules/secret-store/secret-crypto.ts`
  - 상세: AES-256-GCM 암복호화, IV 생성, 해시 유도 모두 `import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'` 로 처리. `pgcrypto` PostgreSQL extension 도 채택하지 않음. 전적으로 런타임 내장 모듈 의존이므로 npm 의존성 증가 없음.
  - 제안: 현재 방향 유지. 다만 보안 감사 목적으로 `crypto` 모듈 버전(=Node.js 버전)에 대한 엔진 명세(`engines.node`)를 `package.json`에 명시하는 것을 권장.

### package-lock.json 변경 분석

- **[INFO]** `codebase/backend/package-lock.json` — `@nestjs-modules/mailer` 의 비호환(peer/optional) 전이 의존성 추가
  - 위치: `package-lock.json` lines 35–102
  - 상세: `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` 3개 패키지가 `node_modules/@nestjs-modules/mailer/node_modules/` 아래 추가됨. 모두 `"optional": true, "peer": true` 로 표시되어 있어 **직접 기능 변경이 아니라 npm lockfile 재생성 과정에서 peer tree 가 확장된 것**임. `uglify-js`는 `"dev": true` 플래그가 추가되었고 그 외 변경은 없음.
  - 제안: 의도된 lockfile 변경인지 확인 필요. 실제 의존성 추가가 아닌 `npm install` 재실행 부작용일 수 있음. CI에서 `npm ci` 로 재현성 확보 중이라면 영향 없음.

- **[INFO]** `codebase/frontend/package-lock.json` — `fsevents@2.3.2` 에 `"dev": true` 플래그 추가
  - 위치: `package-lock.json` line 6864
  - 상세: 기존에 없던 `"dev": true` 속성이 `fsevents` 항목에 추가됨. `fsevents`는 macOS 전용 optional 패키지로 실제 의존성 변화는 없음.
  - 제안: git status 상 `codebase/frontend/package-lock.json`이 `M(modified)`로 표기되어 있고(커밋되지 않은 변경), `package.json`에 대응 변경이 없으므로 의도치 않은 로컬 환경 변경 가능성이 있음. 커밋 전 `npm ci` 클린 환경에서 재생성하여 의도한 변경인지 확인 권장.

### 버전 고정

- **[INFO]** 신규 `SecretStoreModule`은 외부 패키지를 추가하지 않아 버전 고정 이슈 없음. 기존 `@nestjs/common`, `typeorm`, `@nestjs/typeorm`, `@nestjs/config` 버전 그대로 활용.

### 라이선스

- **[INFO]** `chokidar@3.6.0` (MIT), `glob-parent@5.1.2` (ISC), `readdirp@3.6.0` (MIT) — 모두 허용적 라이선스. 프로젝트와 충돌 없음.

### 취약점

- **[INFO]** 새로 추가된 `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0`에 대해 알려진 CVE 없음 (2025년 8월 기준). 단, 이들은 `@nestjs-modules/mailer`의 peer 의존성으로 실제 런타임에서 직접 로드될 가능성은 낮음.
- **[INFO]** 암호화 구현이 Node.js 내장 `crypto` 모듈을 사용하므로 외부 crypto 라이브러리 취약점에 노출되지 않음.

### 불필요한 의존성

- **[INFO]** 신규 `secret-crypto.ts` 구현에서 `createHash('sha256')` 를 통해 짧은 키를 32 byte로 derive하는 fallback 로직이 있음
  - 위치: `codebase/backend/src/modules/secret-store/secret-crypto.ts` line 47
  - 상세: NIST 권고 key derivation 은 PBKDF2/HKDF를 사용하는 것이 적절하나, 여기서는 단순 SHA-256 1회 해시로 처리. 다만 이는 e2e 테스트 환경 호환을 위한 fallback으로, 실 운영 환경은 64-char hex 키를 사용하도록 되어 있어 실질적 위험은 낮음. 향후 보안 강화 시 HKDF 전환 검토 권장.
  - 제안: `parseMasterKey`의 SHA-256 fallback은 `NODE_ENV !== 'production'` 제한이나 경고 로그 추가를 고려.

### 의존성 크기 / 번들 영향

- **[INFO]** 신규 `SecretStoreModule`은 `@nestjs/common`, `@nestjs/config`, `typeorm`, `@nestjs/typeorm`만 의존 — 모두 이미 프로젝트에 존재하는 패키지. 추가 번들 크기 영향 없음.

### 호환성

- **[INFO]** `chokidar@3.6.0`은 `node >= 8.10.0`, `readdirp@3.6.0`은 `node >= 8.10.0`, `glob-parent@5.1.2`는 `node >= 6`를 요구. 프로젝트가 Node 18+ 환경이라면 문제없음.

### 내부 의존성

- **[WARNING]** `SecretStoreModule` 이 5개 모듈에 동시 추가됨 — 순환 의존성 가능성 점검 필요
  - 위치: `chat-channel.module.ts`, `external-interaction.module.ts`, `hooks.module.ts`, `triggers.module.ts`, `app.module.ts`
  - 상세: `SecretStoreModule`은 `ConfigModule` + `TypeOrmModule.forFeature([SecretStore])`만 import하고 외부 도메인 모듈에 의존하지 않음. 단방향 의존 구조가 확인되어 실질적 순환 위험은 없음. 그러나 `HooksModule`이 이미 `ChatChannelModule`을 import하고 `ChatChannelModule`이 `SecretStoreModule`을 import하므로, `HooksModule`에서 `SecretStoreModule`을 직접 import하는 것은 중복(transitive)이 될 수 있음.
  - 제안: `HooksModule`이 `SecretStoreModule`을 직접 inject 하는 서비스가 있는지 확인하여 실제 필요성을 검증. 불필요하면 transitive 의존 제거로 모듈 그래프 단순화 권장.

- **[INFO]** `SecretStoreModule`이 `SecretResolverService`를 `exports`로 공개하고, 사용 모듈들이 이를 DI로 주입받는 구조는 NestJS 모듈 경계에 부합함.

- **[INFO]** `secret-ref.ts`와 `buildSecretRef` 유틸리티가 `triggers.service.ts` 및 `chat-channel.controller.ts`에서 직접 import됨 — 도메인 모듈이 secret-store 내부 유틸을 직접 참조. `SecretStoreModule`의 `exports` 목록에 헬퍼가 포함되지 않아 모듈 경계를 약간 우회하는 패턴이나, NestJS에서 non-provider 유틸 파일의 직접 import는 관례적으로 허용 범위.

## 요약

이번 변경은 새로운 외부 npm 패키지를 전혀 추가하지 않고, Node.js 내장 `crypto` 모듈과 기존 NestJS/TypeORM 스택만으로 AES-256-GCM secret store 인프라를 구현한 점이 의존성 관점의 핵심 강점이다. `package-lock.json` 변경은 `@nestjs-modules/mailer`의 peer 전이 의존성 자동 확장과 `fsevents`의 플래그 변화로 실질적 위험이 없으나, 특히 frontend `package-lock.json`의 커밋되지 않은 변경(`codebase/frontend/package-lock.json`, git status: M)은 의도치 않은 로컬 환경 변경일 수 있으므로 커밋 전 클린 재생성이 필요하다. 내부 모듈 의존 구조는 단방향으로 설계되어 순환 위험이 없으며, `HooksModule`의 `SecretStoreModule` 직접 import가 transitive 중복인지 실제 직접 사용인지 검토하면 충분하다.

## 위험도

LOW
