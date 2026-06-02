# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/package-lock.json

- **[INFO]** `ws` 패키지 버전 업그레이드 (8.18.3 → 8.20.1)
  - 위치: `node_modules/ws`, `node_modules/engine.io`, `node_modules/socket.io-adapter`
  - 상세: `engine.io`(6.6.6 → 6.6.8)와 `socket.io-adapter`(2.5.6 → 2.5.7)가 모두 `ws ~8.20.1`을 참조하도록 변경. ws는 WebSocket 실시간 통신의 핵심 라이브러리로, 마이너 패치 업그레이드이므로 API 하위호환은 유지되나, 메시지 프레이밍·핸드셰이크 동작이 미세하게 바뀔 가능성이 존재.
  - 제안: 기존 WebSocket 연결 동작(연결 수립, 재연결, 메시지 순서)에 대한 회귀 테스트 확인 권장.

- **[INFO]** `chokidar` 및 `readdirp`의 `dev` → `devOptional` 플래그 변경
  - 위치: `node_modules/chokidar`, `node_modules/readdirp`
  - 상세: 기존 `"dev": true` 에서 `"devOptional": true` 로 변경됨. 이는 npm이 이 패키지들을 선택적 설치 대상으로 처리하게 하여, 특정 환경(CI, 최소화 설치)에서 설치 여부가 달라질 수 있음. `chokidar`는 파일 시스템 감시(watcher), `readdirp`는 재귀 디렉터리 읽기용 라이브러리로, 주로 dev/CLI 도구에 사용됨.
  - 제안: `devOptional` 변경이 운영 배포 환경에서 누락을 유발하지 않는지 확인. 배포 이미지 빌드 시 `npm ci --omit=optional` 옵션을 사용하는 경우 이 패키지들이 설치되지 않을 수 있음.

- **[INFO]** `uglify-js`의 `"dev": true` 제거
  - 위치: `node_modules/uglify-js`
  - 상세: 이전에는 dev 전용이었으나 이번 변경으로 `"dev"` 플래그가 제거되어 일반 의존성처럼 취급됨. `optional: true`는 유지되므로 실제 설치 강제는 없으나, lockfile 의미상 위치가 변경됨.
  - 제안: 빌드 파이프라인에서 `uglify-js` 경로 참조 여부 확인.

- **[INFO]** `@nestjs-modules/mailer`의 중첩 의존성 제거 (chokidar 3.x, glob-parent 5.x, readdirp 3.x)
  - 위치: `node_modules/@nestjs-modules/mailer/node_modules/`
  - 상세: mailer 패키지 내 `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` 로컬 복사본이 제거됨. 이는 상위 레벨의 더 최신 버전으로 deduplication된 것으로, 의도된 동작임. mailer 기능(템플릿 감시 등)에 영향이 없는지 확인 권장.
  - 제안: 메일 전송 기능 및 템플릿 로딩 회귀 테스트 확인.

- **[WARNING]** `preview-email/node_modules/uuid@9.0.1` 및 `typeorm/node_modules/uuid@11.1.1` 중첩 복사본 제거 + uuid override 추가
  - 위치: `node_modules/preview-email/node_modules/uuid`, `node_modules/typeorm/node_modules/uuid`
  - 상세: 두 패키지의 로컬 uuid 복사본이 제거되고, package.json `overrides`에 `"uuid": "^13.0.2"` 가 추가됨으로써 단일 버전으로 통합됨. uuid v9 → v13 또는 v11 → v13 은 메이저 버전 점프이므로 API 변경이 있을 수 있음. typeorm의 내부적 uuid 생성 로직이 영향을 받을 가능성 존재.
  - 제안: TypeORM 엔티티의 UUID 자동 생성 컬럼 동작 확인. `uuid` v13 릴리스 노트에서 브레이킹 체인지 검토 필수.

- **[INFO]** `brace-expansion` 다중 위치 버전 업그레이드
  - 위치: 다수 (`@jest/reporters`, `jest-config`, `jest-runtime`, `mjml-cli`, `typeorm` 하위, `glob` 하위, `@typescript-eslint/typescript-estree` 하위 등)
  - 상세: brace-expansion 1.x → 1.1.15, 2.x → 2.1.1, 5.x → 5.0.6 으로 패치 버전 업그레이드. 모두 dev 의존성 맥락.
  - 제안: 영향 없음. 패치 수준 보안/버그픽스.

- **[INFO]** `liquidjs` 버전 업그레이드 (10.25.7 → 10.27.0)
  - 위치: `node_modules/liquidjs`
  - 상세: 이메일 템플릿 렌더링에 사용되는 liquidjs가 마이너 버전 업그레이드됨. 마이너 버전 변경이므로 기존 Liquid 템플릿 문법은 유지되나, 새로운 필터/태그가 추가될 수 있음.
  - 제안: 이메일 템플릿 렌더링 테스트 확인.

- **[INFO]** `qs` 패키지 버전 업그레이드 (6.15.0 → 6.15.2)
  - 위치: `node_modules/qs`
  - 상세: query string 파싱 라이브러리의 패치 업그레이드. 하위 호환 유지.
  - 제안: 영향 없음.

---

### 파일 2: codebase/backend/package.json

- **[WARNING]** `overrides`에 `"uuid": "^13.0.2"` 추가
  - 위치: `overrides` 섹션
  - 상세: npm overrides 로 uuid를 전체 의존성 트리에서 v13으로 강제 통일. typeorm, preview-email 등이 내부적으로 다른 uuid 메이저 버전을 기대할 경우, API 브레이킹 체인지(예: 함수 시그니처 변경, named export 구조 변경 등)가 문제를 일으킬 수 있음. 특히 TypeORM은 데이터베이스 PK 자동 생성에 uuid를 사용하므로 uuid 동작이 바뀌면 운영 데이터 무결성에 영향을 줄 수 있음.
  - 제안: uuid v13 release notes에서 v9, v11 대비 브레이킹 체인지 확인. TypeORM `@PrimaryGeneratedColumn('uuid')` 및 관련 엔티티의 UUID 생성이 정상 동작하는지 통합 테스트 실행 필수.

- **[INFO]** `liquidjs` override 버전 업그레이드 (^10.25.7 → ^10.27.0)
  - 위치: `overrides.liquidjs`
  - 상세: 마이너 업그레이드. package-lock.json 변경과 일치하며 의도된 변경.
  - 제안: 영향 없음.

---

### 파일 3: codebase/channel-web-chat/package-lock.json

- **[WARNING]** `vitest` 메이저 버전 업그레이드 (3.2.4 → 4.1.8) — Node.js 최소 버전 상향
  - 위치: `node_modules/vitest` 및 모든 `@vitest/*` 서브패키지
  - 상세: 테스트 프레임워크의 메이저 버전 업그레이드. Node.js 최소 요구 버전이 `^18 || ^20 || >=22` → `^20 || ^22 || >=24` 로 변경 (Node 18 드롭). vite 최소 요구 버전도 `^5 || ^6 || ^7` → `^6 || ^7 || ^8` 로 변경. chai v5 → v6 업그레이드 포함(assertion 라이브러리 API 변경 가능). `tinypool` 제거, `vite-node` 제거 등 내부 구조 변경.
  - 제안: CI 환경의 Node 버전이 20 이상인지 확인. chai v6 API 변경으로 인한 기존 테스트 실패 가능성 검토. `@testing-library/react`, `@testing-library/jest-dom`과의 호환성 확인.

- **[INFO]** `postcss` 버전 업그레이드 (8.4.31 → 8.5.15)
  - 위치: `node_modules/postcss`
  - 상세: CSS 후처리 라이브러리 패치/마이너 업그레이드. `vite/node_modules/postcss` 중첩 복사본이 제거되고 최상위 버전으로 통합됨.
  - 제안: 영향 없음.

- **[INFO]** `es-module-lexer` 버전 업그레이드 (1.7.0 → 2.1.0)
  - 위치: `node_modules/es-module-lexer`
  - 상세: ES 모듈 파싱 라이브러리의 메이저 버전 업그레이드. vitest 내부에서만 사용되므로 애플리케이션 코드에 직접 영향 없음.
  - 제안: 영향 없음.

- **[INFO]** `std-env` 버전 업그레이드 (3.10.0 → 4.1.0)
  - 위치: `node_modules/std-env`
  - 상세: 환경 감지 라이브러리 메이저 업그레이드. vitest 내부에서 사용. 환경 변수 감지 동작이 변경될 수 있으나 테스트 실행 환경에만 영향.
  - 제안: CI 환경에서 테스트 실행 동작 확인.

- **[INFO]** `@standard-schema/spec` 신규 의존성 추가
  - 위치: `node_modules/@standard-schema/spec`
  - 상세: vitest 4.x의 `@vitest/expect` 의존성으로 신규 추가됨. 표준 스키마 명세 패키지로, 코드 실행에 직접 영향 없는 타입 수준 명세.
  - 제안: 영향 없음.

- **[INFO]** `cac`, `strip-literal`, `tinypool`, `tinyspy`, `loupe`, `pathval`, `check-error`, `deep-eql` 등 의존성 제거
  - 위치: 해당 `node_modules/*`
  - 상세: vitest 3 → 4 업그레이드 과정에서 불필요해진 간접 의존성들이 제거됨. 모두 dev 의존성 맥락. `vite-node` 도 별도 패키지에서 vitest 내장으로 변경됨.
  - 제안: 이 패키지들을 직접 import하는 테스트 코드가 있다면 확인 필요. 통상적으로 vitest 내부용이므로 일반 테스트 코드에는 영향 없음.

---

## 요약

이번 변경은 npm audit 취약점 수정을 위한 의존성 버전 업그레이드 모음으로, 코드 로직 변경 없이 package-lock.json 및 package.json의 오버라이드 섹션만 수정되었다. 전반적으로 부작용 위험은 낮으나, 두 가지 사항에 주의가 필요하다. 첫째, backend의 `uuid` override로 인한 typeorm 내부 UUID 생성 동작 변경 가능성(uuid v9/v11 → v13 메이저 점프)이 운영 엔티티 PK 생성에 영향을 줄 수 있으므로 통합 테스트가 필수적이다. 둘째, channel-web-chat의 vitest 3 → 4 메이저 업그레이드는 Node.js 18 미지원, chai v6 API 변경, vite 최소 버전 상향 등을 수반하므로 CI 환경 및 기존 테스트 통과 여부를 확인해야 한다. 그 외 ws, brace-expansion, liquidjs, qs, postcss 등은 패치/마이너 수준 업그레이드로 하위 호환이 유지된다.

## 위험도

MEDIUM
