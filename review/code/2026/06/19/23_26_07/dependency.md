# 의존성(Dependency) 리뷰 결과

## 발견사항

### 새 의존성 / 신규 전이 의존성

- **[INFO]** `@opentelemetry/instrumentation-host-metrics@0.2.0` 신규 추가
  - 위치: `codebase/backend/package-lock.json` (node_modules/@opentelemetry/instrumentation-host-metrics)
  - 상세: `@opentelemetry/auto-instrumentations-node@0.77.0` 업그레이드로 인해 자동으로 당겨진 새 전이 의존성. `systeminformation@^5.31.6`을 추가로 요구함. 직접 의존성은 아니지만 번들에 포함됨.
  - 제안: `systeminformation` 패키지의 라이선스(MIT)와 크기를 확인하고 필요 없는 경우 `auto-instrumentations-node` 대신 개별 instrumentation 패키지를 선택적으로 사용하는 것을 장기적으로 검토.

- **[INFO]** `@opentelemetry/propagator-aws-xray@2.2.0` 신규 추가
  - 위치: `codebase/backend/package-lock.json` (node_modules/@opentelemetry/propagator-aws-xray)
  - 상세: `@opentelemetry/instrumentation-aws-lambda@0.71.0` 업그레이드로 인해 신규 전이 의존성 추가. 라이선스 Apache-2.0.
  - 제안: 프로젝트가 AWS Lambda를 사용하지 않는 경우 불필요한 의존성이지만, `auto-instrumentations-node`를 통해 간접 포함되므로 현재는 수용 가능.

### 버전 고정 / 핀 전략

- **[INFO]** `overrides` 섹션에 취약점 해소 목적의 전이 의존성 강제 핀이 추가됨 (backend: `ws`, `@grpc/grpc-js`, `multer`, `form-data`, `nodemailer`; frontend: `ws`, `form-data`, `undici`, `vite`, `@babel/core`)
  - 위치: `codebase/backend/package.json` lines 70–87, `codebase/frontend/package.json` lines 1823–1835
  - 상세: `//security-overrides` 주석으로 의도가 명확히 문서화되어 있음. 전이 의존성 취약점을 직접 forward 할 수 없을 때 `overrides`로 강제하는 표준적인 패턴임. 범위 지정자(`^`)를 사용하여 과도하게 좁은 핀은 피함.
  - 제안: 향후 부모 패키지가 이미 안전 버전을 요구하게 되면 `overrides` 항목을 제거하고 clean-up하는 것을 권장. `npm audit` 정기 실행으로 override 필요성 재검토.

- **[WARNING]** `nodemailer`가 `overrides`에도 `^9.0.1`로 중복 선언됨 (직접 dep도 동일 버전)
  - 위치: `codebase/backend/package.json` lines 62, 87
  - 상세: `preview-email`/`mailparser`가 `nodemailer@8`(취약)을 중첩 설치하는 문제를 해결하기 위해 의도적으로 overrides에도 선언함. 주석으로 설명되어 있어 이중 선언의 의도는 명확하나, 혼란을 줄 수 있음.
  - 제안: 현재 구현이 올바른 접근 방식. 주석 설명이 충분하므로 현 상태 유지 가능. `preview-email` 사용 여부를 검토하여 해당 패키지 자체를 제거하면 근본 원인 해소 가능.

### 라이선스

- **[INFO]** 신규 추가되거나 버전 업된 모든 주요 패키지의 라이선스 확인
  - `@opentelemetry/*`: Apache-2.0 (프로젝트 호환)
  - `@nestjs-modules/mailer@2.3.7`: MIT
  - `nodemailer@^9.0.1`: MIT
  - `dompurify@^3.4.11`: Apache-2.0 / MIT 듀얼
  - `ws@^8.21.0`: MIT
  - `@grpc/grpc-js@^1.14.4`: Apache-2.0
  - `multer@^2.2.0`: MIT
  - `form-data@^4.0.6`: MIT
  - `undici@^7.28.0`: MIT
  - `vite@^8.0.16`: MIT
  - `@babel/core@^7.29.7`: MIT
  - 제안: 모든 신규/업그레이드 패키지 라이선스가 프로젝트와 호환 가능. 이슈 없음.

### 취약점 해소

- **[INFO]** 이번 변경의 주목적이 npm audit 취약점 해소. 총 5개 overrides 추가 (backend), 5개 overrides 추가 (frontend)
  - `ws@^8.21.0`: WebSocket 관련 CVE 해소
  - `@grpc/grpc-js@^1.14.4`: gRPC 관련 취약점 해소 (1.14.3 → 1.14.4)
  - `multer@^2.2.0`: 파일 업로드 취약점 해소
  - `form-data@^4.0.6`: 폼 데이터 처리 취약점 해소
  - `nodemailer@^9.0.1` (override): 전이 의존성 사본 취약점 해소
  - `undici@^7.28.0` (frontend): HTTP 클라이언트 취약점 해소
  - `vite@^8.0.16` (frontend): 빌드 툴 취약점 해소
  - `@babel/core@^7.29.7` (frontend): Babel 취약점 해소
  - 제안: `npm audit` 결과가 0이 되었는지 CI에서 검증 권장.

- **[WARNING]** `protobufjs` override가 `^7.5.6` → `^7.6.3`으로 상향됨
  - 위치: `codebase/backend/package.json` line 77
  - 상세: protobuf 파싱 관련 취약점(ReDoS 등) 수정 버전. 정상적인 취약점 해소.
  - 제안: 이슈 없음, 적절한 조치.

### 불필요한 의존성

- **[INFO]** `@opentelemetry/auto-instrumentations-node`가 프로젝트에서 실제 사용하지 않는 많은 플랫폼(AWS Lambda, Cassandra, Oracle DB, Memcached 등)용 instrumentation을 포함함
  - 위치: `codebase/backend/package.json` line 47
  - 상세: 전체 bundle 에서 불필요한 코드가 포함됨. 다만 백엔드 Node.js 서버에서는 tree-shaking이 제한적이므로 실제 영향 있음. 이번 변경에서 새 `instrumentation-host-metrics`와 `instrumentation-aws-lambda` 등이 추가됨.
  - 제안: 장기적으로 필요한 instrumentation만 개별 등록하여 번들 크기 최소화 권장. 이번 변경 범위는 아님.

### 의존성 크기 / 번들 영향

- **[INFO]** `@opentelemetry/auto-instrumentations-node` 0.76 → 0.77 업그레이드로 인한 신규 전이 패키지 추가
  - `@opentelemetry/instrumentation-host-metrics` + `systeminformation` (런타임 시스템 정보 수집, 크기 상당)
  - `@opentelemetry/propagator-aws-xray` (상대적으로 경량)
  - 제안: 서버 사이드 백엔드 앱이므로 번들 크기보다 런타임 메모리 영향을 확인. `systeminformation` 패키지는 CPU/메모리 통계 수집을 위한 네이티브 의존성을 포함할 수 있으므로 성능 영향 검토 권장.

### 호환성

- **[INFO]** `@nestjs-modules/mailer@2.3.7`의 `nodemailer` peer dependency가 `>=6.4.6`에서 `>=8.0.5`로 상향됨
  - 위치: `codebase/backend/package-lock.json` lines 3716–3717
  - 상세: 직접 의존성 `nodemailer@^9.0.1`이 이 요구를 충족. 호환성 문제 없음.
  - 제안: 이슈 없음.

- **[INFO]** `@nestjs-modules/mailer@2.3.7`의 `handlebars` peer dependency가 `>=4.7.6`에서 `>=4.7.9`로 상향됨, `liquidjs` peer dependency 역시 상향됨
  - 위치: `codebase/backend/package-lock.json` lines 3716–3717
  - 상세: 버전 lock이 갱신된 버전을 설치하므로 정상적으로 호환됨.
  - 제안: 이슈 없음.

- **[INFO]** `@rolldown/binding-*` 패키지들이 `1.0.0-rc.18` → `1.0.3` (stable release)로 업그레이드됨 (frontend)
  - 위치: `codebase/frontend/package-lock.json` (다수 라인)
  - 상세: RC에서 stable로 전환. API 변경 가능성 있으나 `vitest`가 이 버전을 요구하므로 테스트 실행으로 회귀 여부 확인 가능.
  - 제안: CI 테스트 통과 여부로 호환성 검증.

- **[INFO]** `vite@^8.0.16` override 추가 (frontend)
  - 위치: `codebase/frontend/package.json` line 1833
  - 상세: Vite 8.x는 Vite 5/6/7 대비 breaking change가 있을 수 있음. 실제 설치 버전이 어떤 `vite`를 override하는지 확인 필요.
  - 제안: `npm ls vite`로 실제 사용 버전 및 영향 패키지 확인. 빌드 및 테스트 통과 여부로 호환성 검증 필수.

### 내부 의존성

- **[INFO]** 내부 패키지 (`@workflow/chat-channel-validation: file:../packages/chat-channel-validation`)에 변경 없음
  - 제안: 이슈 없음.

---

## 요약

이번 변경은 신규 외부 의존성 추가 없이, 기존 직접 의존성(`@nestjs-modules/mailer`, `@opentelemetry/*`, `nodemailer`, `dompurify`)의 버전 상향과 `npm audit` 취약점 해소를 위한 `overrides` 추가에 집중되어 있다. `//security-overrides` 주석으로 의도가 명확히 문서화된 점은 긍정적이다. `@opentelemetry/auto-instrumentations-node@0.77.0` 업그레이드로 인해 `@opentelemetry/instrumentation-host-metrics`(`systeminformation` 포함)와 `@opentelemetry/propagator-aws-xray`가 새로운 전이 의존성으로 추가되었으며, 이 중 `systeminformation`의 크기·런타임 영향을 확인하는 것이 권장된다. frontend의 `vite@^8.0.16` override는 Vite 주요 버전 상향이 동반될 수 있어 빌드 및 테스트 검증이 중요하다. 전반적으로 보안 강화 목적이 명확하고 라이선스 호환성 문제는 없으나, OpenTelemetry full-bundle 전략의 번들 크기 증가는 장기적 개선 과제로 남는다.

## 위험도

LOW
