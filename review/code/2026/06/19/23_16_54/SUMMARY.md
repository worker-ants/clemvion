# Code Review 통합 보고서

## 전체 위험도
**LOW** — npm audit 대응 의존성 업그레이드 PR. 보안 방향은 긍정적이나 `nodemailer` 중복 선언 오류와 OTel peer dependency 상한 제약 2건이 수정 권장 수준(WARNING)으로 식별됨.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | `backend/package.json` 에 `nodemailer` 중복 선언 — `dependencies` 상단에서 `^8.0.4` → `^9.0.1` 로 이미 변경되어 있음에도 `overrides` 이후 `dependencies` 말미에 `"nodemailer": "^9.0.1"` 가 재추가됨. 마지막 선언이 승리하므로 기능 문제는 없으나 의도치 않은 중복 | `codebase/backend/package.json` — `dependencies` 말미 + `overrides` 섹션 | `dependencies` 말미에 추가된 `"nodemailer": "^9.0.1"` 항목 제거. `dependencies` 상단의 선언 하나로 충분 |
| 2 | Dependency | `@opentelemetry/propagator-aws-xray@2.2.0` 의 peer dependency 상한이 `"@opentelemetry/api": ">=1.0.0 <1.10.0"` 으로 선언됨. 현재 `^1.9.x` 는 범위 내이나 `1.10.0` 이상 업그레이드 시 peer 불일치 발생. 프로젝트가 AWS Lambda 환경이 아니라면 이 instrumentation 자체가 불필요 | `codebase/backend/package-lock.json` — `node_modules/@opentelemetry/propagator-aws-xray` | Lambda 비사용 확인 시 `@opentelemetry/instrumentation-aws-lambda` 비활성화 검토; `@opentelemetry/api` 업그레이드 전 재확인 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `ws` ^8.21.0 overrides 고정은 CVE-2024-37890 (DoS, ws < 8.17.1) 대응으로 올바른 조치 | `codebase/backend/package.json` overrides | 문제 없음 |
| 2 | Security | `dompurify` 3.4.7 → 3.4.11 업그레이드 (XSS 방어 라이브러리 패치) | `codebase/channel-web-chat/package.json`, `codebase/frontend/package-lock.json` | 긍정적 변경 |
| 3 | Security | `protobufjs` ^7.5.6 → ^7.6.3 업그레이드 — CVE-2023-36665 등 이력 있는 라이브러리 패치 | `codebase/backend/package.json` | 업그레이드 방향 긍정적 |
| 4 | Security | `@opentelemetry/instrumentation-host-metrics` 신규 추가로 `systeminformation` 경유 호스트 메타데이터(IP·MAC·호스트명 등)가 OTLP collector 로 전송될 수 있음 | `codebase/backend/package-lock.json` | OTel SDK 필터링 설정 검토; 불필요 시 `OTEL_NODE_DISABLED_INSTRUMENTATIONS=host-metrics` 적용 |
| 5 | Security | `@opentelemetry/propagator-aws-xray` 추가로 X-Ray 트레이스 헤더(X-Amzn-Trace-Id)가 외부 HTTP 응답에 포함될 수 있음 | `codebase/backend/package-lock.json` | propagation 범위 확인; 외부 응답에 트레이스 헤더 미포함 설정 |
| 6 | Security | `nodemailer` ^8.0.4 → ^9.0.1 메이저 업그레이드 — SMTP/TLS 처리 변경 동반 가능 | `codebase/backend/package.json` | 메일 전송 통합 테스트 실행 및 v9 마이그레이션 가이드 보안 변경사항 확인 |
| 7 | Dependency | `dompurify` 버전 핀 방식 불일치 — `channel-web-chat` 은 exact pin(`3.4.11`), `frontend` 는 range(`^3.4.11`) | `codebase/channel-web-chat/package.json`, `codebase/frontend/package.json` | 보안 핵심 라이브러리이므로 exact pin 통일 여부 검토 |
| 8 | Dependency | `systeminformation` (~2.5 MB) 신규 간접 의존성 추가 — host metrics 불필요 시 불필요한 번들 크기 증가 | `codebase/backend/package-lock.json` | host metrics 미사용 시 instrumentation 명시적 제외 |
| 9 | Dependency | `frontend/package.json` overrides 에 `ws`, `form-data`, `undici`, `vite`, `@babel/core` 추가 | `codebase/frontend/package.json` | overrides 의도(npm audit 취약점 해소)를 주석으로 명시 권장 |
| 10 | Documentation | `backend/package.json` `overrides` 섹션에 보안 취약점 수정 목적임을 설명하는 주석 부재 | `codebase/backend/package.json` — `overrides` 섹션 | `"//security-overrides"` 패턴으로 사유 주석 추가 (`channel-web-chat` 의 `"//pin"` 패턴 참고) |
| 11 | Documentation | `nodemailer` 가 `dependencies` 와 `overrides` 양쪽에 중복 선언되어 있어 overrides 추가 사유가 불명확 | `codebase/backend/package.json` | 전이 의존성 버전 충돌 해결 목적이라면 주석 명시 또는 overrides 필요성 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 전체적으로 보안 개선 방향. systeminformation 메타데이터 노출 및 X-Ray 헤더 범위 검토 권장 (INFO) |
| dependency | LOW | nodemailer 중복 선언(WARNING), OTel propagator-aws-xray peer 상한 제약(WARNING) |
| documentation | NONE | overrides 섹션 주석 부재 및 nodemailer 중복 문서화 이슈 (INFO만) |

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 발견사항 보고)

## 권장 조치사항
1. **[즉시]** `codebase/backend/package.json` 의 `dependencies` 말미에 중복 추가된 `"nodemailer": "^9.0.1"` 항목 제거.
2. **[단기]** 프로젝트가 AWS Lambda 환경이 아님을 확인하고, `@opentelemetry/instrumentation-aws-lambda`(및 이를 통해 추가되는 `@opentelemetry/propagator-aws-xray`) 비활성화 검토.
3. **[단기]** nodemailer v9 메이저 업그레이드에 대한 메일 전송 통합 테스트 실행 확인.
4. **[권장]** `backend/package.json` overrides 섹션에 보안 취약점 수정 목적 주석 추가.
5. **[권장]** OTel SDK 에서 `instrumentation-host-metrics` 의 수집 데이터 범위 검토 및 필요 시 민감 정보 필터링 설정.
6. **[권장]** `dompurify` 버전 핀 방식을 `channel-web-chat`(exact pin)과 `frontend`(range) 간 통일 여부 결정.

## 라우터 결정

라우터가 선별하여 실행함.

- **실행**: `security`, `documentation`, `dependency` (3명, 그 중 `dependency`, `documentation` 은 router_safety 강제 포함)
- **제외**: 11명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 의존성 버전 업데이트 PR — 성능 영향 코드 변경 없음 |
| architecture | 아키텍처 변경 없는 의존성 업그레이드 |
| requirement | 기능 요구사항 변경 없음 |
| scope | 범위 명확한 audit 수정 PR |
| side_effect | 사이드 이펙트 분석 불필요 (의존성만 변경) |
| maintainability | 소스 코드 변경 없음 |
| testing | 테스트 코드 변경 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| api_contract | API 계약 변경 없음 |
| user_guide_sync | 사용자 가이드 영향 없음 |

- **강제 포함(router_safety)**: `dependency`, `documentation`
