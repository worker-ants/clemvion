# 보안(Security) 리뷰 결과

## 발견사항

### 의존성 보안

- **[INFO]** `dompurify` 3.4.7 → 3.4.11 업그레이드 (channel-web-chat, frontend)
  - 위치: `codebase/channel-web-chat/package.json`, `codebase/frontend/package-lock.json`
  - 상세: DOMPurify는 XSS 방어 핵심 라이브러리다. 3.4.7에서 3.4.11로의 업그레이드는 보안 패치를 포함할 가능성이 높다. 버전이 올라간 방향이므로 긍정적 변경이다.
  - 제안: 문제 없음. 오히려 권장되는 업그레이드.

- **[INFO]** `nodemailer` ^8.0.4 → ^9.0.1 메이저 버전 업그레이드 (backend)
  - 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json`
  - 상세: nodemailer v9는 메이저 버전 bump이다. 메일 전송 라이브러리의 메이저 버전 변경은 SMTP 인증 처리 방식, TLS 설정 기본값 변경 등이 동반될 수 있다. 보안 측면에서 개선된 TLS 처리가 포함될 수 있으나, 기존 SMTP 연결 옵션이 그대로 동작하는지 검증이 필요하다.
  - 제안: 메일 전송 기능의 통합 테스트 실행 및 nodemailer v9 마이그레이션 가이드에서 보안 관련 변경사항 확인 권장.

- **[INFO]** `@nestjs-modules/mailer` ^2.3.4 → ^2.3.7 업그레이드 (backend)
  - 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json`
  - 상세: 마이너 버전 패치 업그레이드로, `handlebars` ^4.7.8 → ^4.7.9, `liquidjs` ^10.25.1 → ^10.25.7을 함께 업데이트한다. handlebars는 과거 prototype pollution 취약점 이력이 있는 템플릿 엔진으로, 패치 버전 업데이트는 보안 개선으로 해석된다.
  - 제안: 문제 없음. 보안상 유리한 방향.

- **[INFO]** `@grpc/grpc-js` 1.14.3 → 1.14.4 패치 업그레이드 (backend)
  - 위치: `codebase/backend/package-lock.json`
  - 상세: gRPC-js 패치 버전 업그레이드. 패치 수준의 보안 수정이 포함될 수 있다.
  - 제안: 문제 없음.

- **[INFO]** `protobufjs` ^7.5.6 → ^7.6.3 업그레이드 (backend)
  - 위치: `codebase/backend/package.json`
  - 상세: protobufjs는 과거 prototype pollution 및 ReDoS 취약점(CVE-2023-36665 등) 이력이 있다. 7.6.3으로의 업그레이드는 해당 CVE 수정 범위를 포함할 가능성이 있다.
  - 제안: 업그레이드 자체는 긍정적. `npm audit` 결과로 이 변경이 triggered 되었는지 확인 필요.

- **[INFO]** OpenTelemetry 전체 스택 0.218.x / 2.7.x → 0.219.x / 2.8.x 업그레이드 (backend)
  - 위치: `codebase/backend/package-lock.json` 전반
  - 상세: 관측성 라이브러리 일괄 업그레이드. 보안 취약점 직접 영향은 낮으나, trace/metrics 데이터를 외부 collector에 HTTP/gRPC로 전송하는 경로이므로 TLS 처리 개선이 포함될 수 있다.
  - 제안: 문제 없음.

- **[INFO]** 신규 직접 의존성 추가: `ws` ^8.21.0, `@grpc/grpc-js` ^1.14.4, `multer` ^2.2.0, `form-data` ^4.0.6 (backend package.json overrides/resolutions로 추정)
  - 위치: `codebase/backend/package.json` overrides 섹션
  - 상세: `multer`는 파일 업로드 미들웨어로, 이미 간접 의존성으로 존재하던 것을 명시적으로 버전 고정한 것으로 보인다. `ws` ^8.21.0 고정은 ws 라이브러리의 알려진 DoS 취약점(CVE-2024-37890 등, ws < 8.17.1에서 발생)에 대한 대응으로 보인다. `nodemailer` ^9.0.1이 overrides 섹션에 중복 등장한다.
  - 제안: overrides 섹션의 `nodemailer` 중복 항목을 정리할 것. `ws` 버전 고정은 보안상 올바른 조치이다.

- **[INFO]** `@opentelemetry/instrumentation-host-metrics` 0.2.0 신규 추가 (backend)
  - 위치: `codebase/backend/package-lock.json`
  - 상세: 새로 추가된 패키지로, `systeminformation` ^5.31.6 의존성을 포함한다. `systeminformation`은 시스템 리소스 정보를 수집하는 라이브러리로, 민감한 시스템 정보(CPU, 메모리, 네트워크 인터페이스 등)에 접근한다. 이 정보가 외부 Telemetry exporter를 통해 전송될 경우 정보 노출 위험이 있다.
  - 제안: systeminformation으로 수집되는 데이터 항목이 외부 OTLP collector로 전송되는 범위를 확인하고, 민감 정보(IP 주소, 호스트명, MAC 주소 등)가 필요 이상으로 수집·전송되지 않도록 OpenTelemetry SDK의 필터링 설정을 검토할 것.

- **[INFO]** `@opentelemetry/propagator-aws-xray` 2.2.0 신규 추가 (backend)
  - 위치: `codebase/backend/package-lock.json`
  - 상세: AWS X-Ray 전파자 신규 추가. X-Ray 트레이스 헤더(X-Amzn-Trace-Id)가 HTTP 요청에 주입되는 범위가 확장될 수 있다. 트레이스 ID가 외부 사용자에게 노출되면 내부 인프라 정보 추론에 활용될 수 있다.
  - 제안: X-Ray 헤더가 외부 응답에 포함되지 않도록 propagation 설정을 확인할 것.

## 요약

이번 변경은 `npm audit` 대응을 위한 의존성 보안 업그레이드 PR로, 전체적으로 보안 상태를 개선하는 방향이다. `dompurify` XSS 방어 라이브러리 업그레이드, `ws` DoS 취약점 버전 고정, `protobufjs`·`handlebars` 패치가 포함되어 있어 공급망 보안 측면에서 긍정적이다. 신규 추가된 `@opentelemetry/instrumentation-host-metrics`(systeminformation 의존)와 `@opentelemetry/propagator-aws-xray`는 시스템 메타데이터 및 트레이스 헤더 노출 범위를 검토할 필요가 있으나 즉각적인 차단 사유는 아니다. 코드 인젝션, 하드코딩된 시크릿, 인증/인가 우회 등 고위험 보안 문제는 이 diff 범위 내에서 발견되지 않았다.

## 위험도

LOW
