# 의존성(Dependency) 리뷰 결과

## 발견사항

### [WARNING] backend/package.json에 `nodemailer` 중복 선언
- 위치: `codebase/backend/package.json` — `dependencies` 섹션에 `"nodemailer": "^8.0.4"` (기존), `overrides` 섹션에 추가된 `"nodemailer": "^9.0.1"` 그리고 다시 `dependencies` 끝에 `"nodemailer": "^9.0.1"` (신규)
- 상세: `dependencies`에 `nodemailer`가 두 번 선언되어 있다. package.json 표준 상 마지막 선언이 승리하지만 이는 의도치 않은 중복이며, 이미 `dependencies` 상단에서 `^8.0.4` → `^9.0.1`로 변경하는 diff가 적용되어 있음에도 `overrides` 블록 이후 다시 `dependencies`에 `nodemailer`를 추가하는 것은 오류다.
- 제안: `dependencies` 마지막에 추가된 `"nodemailer": "^9.0.1"` 항목을 제거한다. `dependencies` 상단의 `^9.0.1` 선언으로 충분하다.

### [WARNING] `@opentelemetry/propagator-aws-xray`의 peer dependency 상한 제약
- 위치: `codebase/backend/package-lock.json` — `node_modules/@opentelemetry/propagator-aws-xray` 항목
- 상세: `@opentelemetry/instrumentation-aws-lambda@0.71.0`가 새로 추가한 `@opentelemetry/propagator-aws-xray@2.2.0`의 peer dependency가 `"@opentelemetry/api": ">=1.0.0 <1.10.0"`으로 선언되어 있다. 현재 프로젝트는 `@opentelemetry/api: ^1.9.0`을 사용하므로 `1.9.x`는 범위 내에 있으나, 향후 `@opentelemetry/api`가 `1.10.0` 이상으로 업그레이드될 경우 peer dependency 불일치가 발생한다. 백엔드는 AWS Lambda에서 직접 실행되지 않는 것으로 보이므로 이 instrumentation 자체가 불필요할 수 있다.
- 제안: 프로젝트가 AWS Lambda 환경에서 실행되지 않는다면 `@opentelemetry/instrumentation-aws-lambda`가 불필요하다(auto-instrumentations-node에 번들로 포함되므로 개별 제어 필요 시 비활성화 설정 검토). 당장의 버전 범위는 문제 없으나 `@opentelemetry/api` 업그레이드 시 재확인 필요.

### [INFO] 새 간접 의존성: `chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0` (`@nestjs-modules/mailer` 하위)
- 위치: `codebase/backend/package-lock.json` — `node_modules/@nestjs-modules/mailer/node_modules/` 하위
- 상세: `@nestjs-modules/mailer` 2.3.7 업그레이드로 `chokidar`·`glob-parent`·`readdirp` 가 optional/peer dependency로 새롭게 잠겼다. 이들은 모두 `optional: true, peer: true`이므로 프로덕션 번들에 포함되지 않는다.
- 제안: 별도 조치 불필요. optional peer이므로 파일 감시 기능을 실제로 사용하지 않는 한 설치되지 않는다.

### [INFO] 새 간접 의존성: `systeminformation@^5.31.6` (via `@opentelemetry/instrumentation-host-metrics`)
- 위치: `codebase/backend/package-lock.json` — `node_modules/@opentelemetry/instrumentation-host-metrics`
- 상세: `@opentelemetry/auto-instrumentations-node@0.77.0`부터 `instrumentation-host-metrics@0.2.0`가 추가되었고, 이 패키지는 `systeminformation`(~2.5 MB)을 의존한다. `systeminformation`은 MIT 라이선스이며 알려진 취약점 없음. 그러나 백엔드 번들에 2 MB 이상의 새 의존성이 추가된다.
- 제안: 호스트 메트릭이 필요하지 않다면 `NodeSDK`의 `instrumentations` 옵션에서 `InstrumentationHostMetrics`를 명시적으로 제외하거나, `@opentelemetry/auto-instrumentations-node`에 `OTEL_NODE_DISABLED_INSTRUMENTATIONS=host-metrics` 환경변수를 적용하는 것을 고려한다.

### [INFO] `nodemailer` 메이저 버전 업그레이드: `^8.0.4` → `^9.0.1`
- 위치: `codebase/backend/package.json`, `codebase/backend/package-lock.json`
- 상세: `nodemailer@9.x`는 새로운 메이저 버전으로 API 변경이 있을 수 있다. `@nestjs-modules/mailer@2.3.7`의 peer requirement가 `nodemailer: >=8.0.5`에서 `>=8.0.5`로 여전히 하위 버전도 허용하지만 lock 파일은 9.x로 고정된다. 9.x 릴리스 노트의 breaking change를 검토해야 한다.
- 제안: 메일 발송 관련 통합 테스트가 9.x에서 정상 동작하는지 확인 필요.

### [INFO] `@opentelemetry/propagator-aws-xray` 신규 추가 — 불필요한 의존성 가능성
- 위치: `codebase/backend/package-lock.json`
- 상세: `instrumentation-aws-lambda@0.71.0`이 새로 `@opentelemetry/propagator-aws-xray@2.2.0`를 직접 의존으로 추가했다. 이 패키지 자체는 Apache-2.0 라이선스이나, 프로젝트가 AWS Lambda를 사용하지 않는 경우 불필요한 번들 크기 증가(경미).
- 제안: 인프라 환경 확인 후 Lambda를 사용하지 않는다면 해당 instrumentation 비활성화 검토.

### [INFO] `frontend/package.json` overrides에 `ws`, `form-data`, `undici`, `vite`, `@babel/core` 추가
- 위치: `codebase/frontend/package.json` — `overrides` 섹션
- 상세: 보안 취약점 수정을 위한 overrides 추가로 판단된다. 모두 기존 간접 의존성의 버전 고정이며 직접적인 신규 의존성 추가가 아니다. 라이선스는 MIT/기존 허용 라이선스.
- 제안: overrides 의도가 npm audit 취약점 해소라면 정상적인 처리다. 다만 overrides가 늘어날수록 `npm update` 시 충돌 위험이 커지므로 각 항목이 실제 audit 취약점에 대응하는 것인지 주석 또는 PR 설명으로 명시하면 유지보수에 도움이 된다.

### [INFO] `dompurify` 버전 업그레이드: `3.4.7`/`3.4.2` → `3.4.11`
- 위치: `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json`
- 상세: `dompurify`는 XSS 방어 라이브러리로 버전 고정이 PROJECT.md §버전 핀 정책에 명시된 보안 핵심 경로다. `channel-web-chat`은 exact pin(`3.4.11`)이며, `frontend`는 range(`^3.4.11`)이다. 두 동작 방식이 서로 다르다.
- 제안: channel-web-chat의 exact pin 정책은 적절하다. frontend의 `^3.4.11`도 동일 major 내 minor 업그레이드는 허용하므로 위험은 낮으나, 보안 핵심 라이브러리이므로 exact pin 통일 여부를 검토한다.

### [INFO] `libc` 필드 제거 (`channel-web-chat/package-lock.json`)
- 위치: `codebase/channel-web-chat/package-lock.json` — 여러 native binding 항목
- 상세: `libc` 필드는 npm이 platform-specific 패키지를 필터링할 때 사용한다. 제거는 lock 파일 재생성 시 npm 버전 차이에 의한 것으로 보이며 기능적 영향은 없다.
- 제안: 별도 조치 불필요.

## 요약

이 변경은 npm audit 취약점 해소를 목적으로 한 의존성 버전 업그레이드 작업이다. OpenTelemetry 생태계 전반(`0.218.x`→`0.219.x`, `2.7.1`→`2.8.0`), `@nestjs-modules/mailer`(`2.3.4`→`2.3.7`), `nodemailer`(`8.x`→`9.x`), `dompurify`, `grpc-js` 등이 일관되게 업그레이드되었다. 모든 라이선스(Apache-2.0, MIT, MPL-2.0)는 프로젝트와 호환 가능하다. 주요 우려점은 두 가지다: 첫째, `backend/package.json`에 `nodemailer`가 중복 선언된 것은 수정이 필요한 오류다; 둘째, `@opentelemetry/instrumentation-host-metrics`의 신규 추가로 `systeminformation`(2 MB+) 패키지가 간접 포함되므로 실제 host metrics 수집이 필요 없다면 비활성화를 검토해야 한다. `@opentelemetry/propagator-aws-xray`의 peer 상한(`<1.10.0`)은 현재는 문제없으나 장기적으로 추적이 필요하다.

## 위험도

LOW
