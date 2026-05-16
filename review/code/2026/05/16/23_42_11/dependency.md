# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성 / 버전 오버라이드

- **[WARNING]** `protobufjs` 와 `fast-uri` 가 `backend/package.json` 의 직접 의존성으로 추가됨
  - 위치: `backend/package.json` +566~+567
  - 상세: 두 패키지는 CVE 해소 목적의 npm `overrides` 로 추가된 것으로 보이나, 추가된 위치가 `overrides` 블록이 아닌 `dependencies` 블록이다. `dependencies` 에 추가하면 이 패키지들이 실제 런타임 번들에 직접 포함된다. 원래 의도가 transitive 버전을 강제하는 것이라면 npm `overrides` 필드를 사용해야 하며, 그렇지 않으면 불필요하게 번들 크기가 늘어나고 향후 직접 의존 필요성이 없어질 때 제거를 잊기 쉽다.
  - 제안: `package.json` 에 별도 `"overrides"` 블록을 신설하고 두 항목을 그곳으로 이동. `dependencies` 에서는 제거.

  ```json
  "overrides": {
    "protobufjs": "^7.5.6",
    "fast-uri": "^3.1.2"
  }
  ```

- **[INFO]** `protobufjs` 7.5.5 → 7.5.8, `fast-uri` 3.1.0 → 3.1.2, `@protobufjs/codegen` 2.0.4 → 2.0.5, `@protobufjs/inquire` 1.1.0 → 1.1.1, `@protobufjs/utf8` 1.1.0 → 1.1.1 패치 버전 업
  - 위치: `backend/package-lock.json` +7086 ~ +7132
  - 상세: 모두 patch 범위 버전 업이며 CVE 해소 목적임. `package-lock.json` 에 변경이 반영되어 있어 실제 설치 버전이 고정된다. 라이선스는 BSD-3-Clause 로 기존과 동일.
  - 제안: 이상 없음. 정기적으로 `npm audit` 으로 잔여 취약점을 확인할 것.

### `@nestjs-modules/mailer` 내 peer/optional 패키지 추가

- **[INFO]** `chokidar` 3.6.0, `glob-parent` 5.1.2, `readdirp` 3.6.0 이 `@nestjs-modules/mailer` 의 peer/optional 의존성으로 lock 파일에 추가됨
  - 위치: `backend/package-lock.json` +3345 ~ +3412
  - 상세: 세 패키지 모두 `"optional": true, "peer": true` 이므로 실제 설치는 옵션 기능(live-reload 등) 을 사용할 때만 일어난다. MIT / ISC 라이선스. 직접 추가한 의존성이 아니라 기존 `@nestjs-modules/mailer` 가 요구하는 peer dep 가 이번 `npm install` 시 lock 파일에 기록된 것.
  - 제안: 무시해도 무방하나, `chokidar` 는 live-reload 목적으로 개발 환경에서만 사용되므로 `devDependencies` 로 분류되어야 한다. lock 파일 항목에 `"dev": true` 가 이미 있는 경우와 없는 경우가 혼재하는지 확인 필요.

### 내부 패키지 의존 방향 명시

- **[INFO]** `packages/expression-engine` 과 `packages/node-summary` 의 README 에 boundary 규칙이 명문화됨
  - 위치: `packages/expression-engine/README.md` +53~54, `packages/node-summary/README.md` +170~171
  - 상세: `expression-engine` 은 다른 `packages/*` 를 참조하지 않으며 backend/frontend 가 단방향으로만 참조한다. `node-summary` 는 `expression-engine` 만 (선택적으로) 참조한다. 이는 순환 의존 방지에 중요한 설계 결정이다.
  - 제안: README 의 boundary 선언에 그치지 않고 실제 `package.json` 의 `dependencies` 필드와 빌드 파이프라인에서도 이 관계가 강제되는지 주기적으로 검증할 것 (예: `madge --circular` 또는 ESLint `import/no-restricted-imports` 규칙 활용).

### 버전 고정 검토

- **[INFO]** `backend/package.json` 의 신규 추가 항목은 `^` (caret) 범위로 지정됨
  - 위치: `backend/package.json` +566~+567
  - 상세: `"protobufjs": "^7.5.6"`, `"fast-uri": "^3.1.2"` 모두 caret 범위다. CI/CD 는 `package-lock.json` 이 있으므로 재현성이 보장되지만, lock 파일을 갱신하지 않는 환경(예: `npm install --no-package-lock`)에서는 최신 minor/patch 버전이 설치될 수 있다.
  - 제안: CVE 해소 패키지이므로 하한을 명확히 할 필요가 있다. 현 caret 범위는 보안 픽스가 포함된 최소 버전 이상만을 허용하므로 기본적으로 무방하다. 다만 `overrides` 로 이동할 것을 권장한다(위 WARNING 참조).

### 표준 라이브러리 활용 확인

- **[INFO]** `crypto.randomBytes` 및 `createHmac` 은 Node.js 내장 `crypto` 모듈에서 가져오며 외부 패키지를 추가하지 않음
  - 위치: `backend/src/modules/hooks/hooks.service.spec.ts` +998, `backend/test/webhook-trigger.e2e-spec.ts` +1854
  - 상세: 기존 `import * as crypto from 'crypto'` 패턴과 일관되며 별도 의존성 추가 없음.
  - 제안: 이상 없음.

---

## 요약

이번 변경에서 의존성 관점의 핵심 사항은 C-13/W-55(CVE 해소를 위한 `protobufjs`/`fast-uri` 버전 강제)다. 보안 취약점 해소 의도는 명확하고 lock 파일에도 반영되었으나, 두 패키지가 `overrides` 블록이 아닌 `dependencies` 블록에 직접 추가된 점은 의도와 다른 결과를 낳을 수 있다. 이 외 `@nestjs-modules/mailer` 의 peer/optional lock 항목 추가는 자동 산출물이며 MIT/ISC 라이선스로 프로젝트와 호환된다. 내부 패키지(`expression-engine`, `node-summary`) 의 boundary 선언은 단방향 의존 원칙을 문서화한 점에서 긍정적이며, 실제 빌드 규칙으로도 강제될 것을 권장한다. 전체적으로 새 외부 의존성의 도입은 없고 기존 transitive 패키지의 보안 업그레이드만 이루어진 변경으로, 라이선스·호환성·취약점 측면에서는 개선 방향이다.

---

## 위험도

LOW
