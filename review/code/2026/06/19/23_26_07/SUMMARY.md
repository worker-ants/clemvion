# Code Review 통합 보고서

## 전체 위험도
**LOW** — npm audit 취약점 해소 목적의 순수 의존성 버전 업그레이드. 소스 코드 변경 없음. 보안적 위험은 해소됐으나 nodemailer 메이저 업그레이드(8→9)와 vite 8.x override의 런타임 회귀 가능성이 낮은 수준으로 존재.

## Critical 발견사항

_해당 없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | CHANGELOG.md 에 보안 패치 항목 없음. `## Unreleased` 섹션이 존재하나 이번 취약점 해소 의존성 상향 핀이 미기재. | `CHANGELOG.md` | `## Unreleased` 최상단에 nodemailer, ws, @grpc/grpc-js, multer, form-data, protobufjs, @opentelemetry/*, dompurify 업그레이드 항목 추가. |
| 2 | Dependency | `nodemailer`가 직접 의존성(`^9.0.1`)과 `overrides` 에 중복 선언됨. 의도는 주석으로 설명되어 있으나 혼란 가능. | `codebase/backend/package.json` lines 62, 87 | 현재 접근 방식이 올바름. `preview-email` 패키지 자체 제거 시 근본 원인 해소 가능; 단기 유지 가능. |
| 3 | Dependency | `vite@^8.0.16` override 추가 — Vite 8.x는 5/6/7 대비 breaking change 가능성. 실제 영향 패키지 및 버전 미확인. | `codebase/frontend/package.json` override 섹션 | `npm ls vite` 로 실제 해결 버전 확인. 빌드 및 테스트 통과 여부로 호환성 검증 필수. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 취약 버전 제거 확인 — ws, @grpc/grpc-js, multer, form-data, protobufjs, nodemailer, dompurify 등 보안 버전 상향. overrides 블록에 의도 주석 명시. | `codebase/backend/package.json`, `codebase/frontend/package.json` | 현 상태 적절. |
| 2 | Security | `nodemailer` overrides 로 preview-email/mailparser 중첩 설치(취약 nodemailer@8) 강제 해소. preview 기능은 프로덕션 미사용이므로 breaking change 위험 낮음. | `codebase/backend/package.json` overrides | 향후 preview-email 이 nodemailer@9 직접 지원 시 override 제거 권장. |
| 3 | Security | `@opentelemetry/propagator-aws-xray ^2.1.4` peerDependency 가 `@opentelemetry/api >= 1.0.0 < 1.10.0` 로 제한. 현재 사용 버전 `^1.9.0` 이 경계에 해당. | `codebase/backend/package-lock.json` | `npm ls @opentelemetry/api` 로 실제 해결 버전 확인. >=1.10.0 지원 버전 출시 시 업그레이드 추적. |
| 4 | Security | `jsonwebtoken` exact pin(`9.0.3`) — 이번 PR 범위 외이나 CVE 추적 필요. | `codebase/backend/package.json` | 다음 보안 점검 시 semver range 또는 Dependabot/Renovate 모니터링 전환 검토. |
| 5 | Testing | 소스 코드 변경 없으므로 신규 테스트 추가 의무 없음. | 전체 | 해당 없음. |
| 6 | Testing | `nodemailer` 8→9 메이저 업그레이드 — ESM-only 전환 가능성. NestJS(CJS) 환경에서 런타임 import 오류 위험. | `codebase/backend/package.json` | 메일 모듈 관련 통합/e2e 테스트를 CI 에서 통과 확인 후 머지. `jest.mock('nodemailer')` 방식 CJS 호환 여부 점검. |
| 7 | Testing | OTel 전 스택(30+개) 동시 업그레이드 + 신규 패키지 추가 — 런타임 초기화 실패 배포 후 발견 위험. | `codebase/backend/package.json` `@opentelemetry/*` | OTel SDK 초기화 경로의 smoke/통합 테스트 여부 확인. 없다면 `tracing.ts` `start()` 호출이 throw 하지 않는 최소 smoke 테스트 추가 권고. |
| 8 | Dependency | `@opentelemetry/instrumentation-host-metrics@0.2.0` + `systeminformation@^5.31.6` 신규 전이 의존성. 서버 사이드 런타임 메모리·네이티브 바인딩 영향 가능. | `codebase/backend/package-lock.json` | 런타임 메모리 영향 확인. 장기적으로 auto-instrumentations-node 대신 개별 instrumentation 선택적 사용 검토. |
| 9 | Dependency | `@opentelemetry/propagator-aws-xray@2.2.0` 신규 전이 의존성. 프로젝트가 AWS Lambda 미사용 시 불필요하나 auto-instrumentations-node 경유 포함. | `codebase/backend/package-lock.json` | 현재 수용 가능. 장기적으로 불필요한 instrumentation 제거 검토. |
| 10 | Dependency | `@rolldown/binding-*` RC → stable(1.0.3) 전환. API 변경 가능성. | `codebase/frontend/package-lock.json` | CI 테스트 통과로 호환성 검증. |
| 11 | Dependency | `protobufjs` override `^7.5.6` → `^7.6.3` 상향. ReDoS 등 취약점 정상 해소. | `codebase/backend/package.json` | 이슈 없음. 적절한 조치. |
| 12 | Documentation | `//security-overrides` 주석이 override 의도를 충분히 설명하나 CVE 번호 미기재. | `codebase/backend/package.json` | 선택적 개선: CVE 번호를 plan/ 문서 또는 CHANGELOG 에 기록하면 향후 추적 용이. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 취약 의존성 전부 안전 버전 상향. 신규 위험 요소 없음. |
| side_effect | — | 출력 파일 부재 (재시도 필요 1건) |
| testing | LOW | nodemailer 8→9 ESM interop 회귀 + OTel 스택 smoke 테스트 미확인 |
| documentation | LOW | CHANGELOG.md Unreleased 섹션에 보안 패치 항목 누락 |
| dependency | LOW | vite 8.x override 호환성 미검증, nodemailer 이중 선언(의도적), 신규 전이 의존성 번들 영향 |

## 발견 없는 에이전트

- **security** — Critical/Warning 발견 없음. 전체 발견사항이 INFO 수준.

## 권장 조치사항

1. **CI 회귀 검증 (필수)**: nodemailer 8→9 메이저 업그레이드에 대해 메일 모듈 통합/e2e 테스트를 CI 에서 통과 확인 후 머지. `jest.mock('nodemailer')` CJS 호환 여부 점검.
2. **vite 8.x 호환성 검증 (필수)**: `npm ls vite` 로 실제 해결 버전 확인. 프론트엔드 빌드 및 테스트 통과로 breaking change 부재 확인.
3. **CHANGELOG.md 업데이트 (권장)**: `## Unreleased` 최상단에 이번 보안 패치 의존성 상향 내역 기재.
4. **OTel 초기화 smoke 테스트 (권장)**: OTel SDK `start()` 가 throw 하지 않는 최소 smoke 테스트 추가. 없다면 배포 후 런타임 오류 위험.
5. **npm audit 0건 검증**: CI 에서 `npm audit` 결과가 0이 됐는지 확인.
6. **장기 과제**: `@opentelemetry/auto-instrumentations-node` 대신 필요한 instrumentation 만 개별 등록하여 번들 크기·메모리 최소화. `preview-email` 패키지 제거 시 nodemailer override 이중 선언 근본 해소.

## 라우터 결정

라우터 결정(`routing=done`):

- **실행**: `security`, `side_effect`, `testing`, `documentation`, `dependency` (5명)
- **강제 포함(router_safety)**: `dependency`, `documentation`
- **제외**: 9명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 의존성 전용 변경 — 성능 코드 없음 |
| architecture | 소스 코드 변경 없음 — 아키텍처 영향 없음 |
| requirement | 요구사항 변경 없음 |
| scope | 순수 보안 패치 범위 |
| maintainability | 소스 코드 변경 없음 |
| database | DB 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| api_contract | API 변경 없음 |
| user_guide_sync | 사용자 가이드 영향 없음 |

---
_생성: 2026-06-19 23:26:07_
