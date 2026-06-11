# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 부작용(side_effect)·API 계약 양쪽에서 WARNING 5건 식별. Critical 없음. 기능 요건(HP-C-1~C-4) 전 항목 spec 일치 확인.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | SIDE_EFFECT | `LoggingInterceptor` 생성자에 `ConfigService` 의존성 추가 — DI 외 `new LoggingInterceptor()` 직접 인스턴스화 코드가 존재하면 런타임 오류 | `logging.interceptor.ts` constructor | `grep -r "new LoggingInterceptor" codebase/` 로 직접 인스턴스화 위치 확인; 존재 시 mock `ConfigService` 주입 패턴으로 수정 |
| W-2 | SIDE_EFFECT | `HealthController.check()` 에 `@Res({ passthrough: true }) res: Response` 추가 — 테스트·유틸에서 `controller.check()` 를 인수 없이 직접 호출하면 `res.status` undefined → 런타임 오류 | `health.controller.ts` `check()` | `grep -r "controller\.check\|HealthController.*check\b" codebase/` 확인; 존재 시 `mockRes = { status: jest.fn().mockReturnThis() }` 패턴으로 수정 |
| W-3 | SIDE_EFFECT | `HEALTH_CHECK_LOG` 미설정(기본 `false`) 배포 환경에서 기존에 존재하던 `/api/health 200` 성공 로그가 묵시적으로 소멸 — 로그 기반 모니터링·알람 오탐 가능 | `logging.interceptor.ts`, `k8s/base/configmap.yaml` | 배포 전 로그 기반 알림 규칙 점검; 점진 전환이 필요하면 일시적으로 `HEALTH_CHECK_LOG=true` 설정 후 알림 규칙 먼저 갱신 |
| W-4 | SIDE_EFFECT | k8s `livenessProbe` 경로 변경(`/api/health` → `/api/health/live`) 롤링 업데이트 중 구 Pod 에 404 반환 → liveness 실패 이벤트 누적 가능(캐스케이드 재시작 위험) | `k8s/base/backend-deployment.yaml` `livenessProbe` | 이미지 버전 업그레이드(코드 변경)와 deployment manifest(경로 변경)를 동일 `kubectl apply` 로 함께 적용; 배포 중 `kubectl get events --watch` 로 모니터링 |
| W-5 | API_CONTRACT | `GET /api/health` HTTP 200 → 503 breaking change — 기존 클라이언트·모니터링·로드밸런서가 HTTP 200 기준 건강 판정 시 503 오탐 가능. CHANGELOG 명시됨. | `health.controller.ts` `check()` | 배포 전 외부 모니터링·업타임 체커·로드밸런서 헬스체크 규칙이 503 을 수용하는지 운영팀 확인; 배포 계획에 팀 공지 포함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | SECURITY | `GET /api/health` 응답 `checks` 필드에 DB·Redis latency 등 인프라 정보가 `@Public()` 으로 외부 노출 가능 | `health.controller.ts` `check()` | k8s Ingress/NetworkPolicy 로 클러스터 외부 접근 차단, 또는 외부용 응답에서 `checks` 상세 제거 검토 |
| I-2 | SECURITY | `LoggingInterceptor` 로그 메시지에 쿼리스트링 포함 원본 `url` 사용 — 민감 파라미터 로그 유출 가능 | `logging.interceptor.ts` `tap()` 콜백 | `message` 생성 시 `path`(`url.split('?')[0]`) 사용 또는 민감 파라미터 마스킹 추가 |
| I-3 | ARCHITECTURE | `HEALTH_PROBE_PATHS` 상수에 컨트롤러 라우트·전역 prefix 하드코딩 — 경로 변경 시 두 곳 수정 필요 | `logging.interceptor.ts` 모듈 상수 | 경로 3개 이상이 되거나 prefix 변경 시 `health.constants.ts` 에 추출해 단일 진실 유지 |
| I-4 | ARCHITECTURE | `@Res({ passthrough: true })` 로 Express `Response` 직접 의존 — Fastify 전환 시 `.status()` vs `.code()` 충돌 | `health.controller.ts` `check()` | Fastify 전환 시 이 메서드 검증 테스트 필수 추가 |
| I-5 | ARCHITECTURE | `live()` 응답 인라인 리터럴 타입 vs `check()` DTO — 응답 추상화 수준 비대칭 | `health.controller.ts` `live()` | 응답 필드 확장 시 `LivenessResponseDto` 추출 |
| I-6 | ARCHITECTURE | e2e 테스트 `res.body.data ?? res.body` 분기 — TransformInterceptor 적용 여부를 테스트가 흡수해 API 계약 단언 모호 | `test/health.e2e-spec.ts` | e2e 환경에서 TransformInterceptor 적용 여부 확정 후 단일 경로 단언으로 단순화 |
| I-7 | REQUIREMENT | `HealthService.check()` 가 예외를 throw 할 경우 `res.status()` 호출 전 propagate → GlobalExceptionFilter body shape 로 응답 변형 가능(503 body 보존 보장 깨짐) | `health.controller.ts` `check()` | `check.mockRejectedValue(new Error('unexpected'))` 케이스 추가해 동작 문서화 또는 `try/catch` 로 보호 |
| I-8 | TESTING | healthy HTTP wire 케이스의 `checks` 내부 구조 검증이 없어 unhealthy 케이스와 비대칭 — healthy 응답 `checks` 필드 누락/오구조 시 테스트 통과 | `health.controller.spec.ts` | `expect(res.body.checks.database.status).toBe('healthy')` 등 추가해 대칭 맞춤 |
| I-9 | TESTING | e2e `BASE_URL` 하드코딩 — 중앙화 부재 | `test/health.e2e-spec.ts` L691 | `test/helpers/constants.ts` 에 `BASE_URL` 추출 |
| I-10 | MAINTAINABILITY | `readinessProbe` 블록 주석 누락 — `livenessProbe` 3줄 주석 대비 비대칭 | `k8s/base/backend-deployment.yaml` | `# readiness: 의존성(DB/Redis) 점검 — 비정상 시 HTTP 503 (spec/data-flow/9-observability.md §1.1)` 한 줄 추가 |
| I-11 | MAINTAINABILITY | `healthCheckLog` 생성자 시점 고정 — `HEALTH_CHECK_LOG` ConfigMap 변경 후 Pod 재시작 없이는 미반영 | `logging.interceptor.ts` `constructor` | CHANGELOG 또는 운영 가이드에 "HEALTH_CHECK_LOG 변경 시 Pod 재시작 필요" 명시 |
| I-12 | DOCUMENTATION | `HEALTH_CHECK_LOG` 변수명 모호 — `configmap.yaml` 주석이 동작을 충분히 설명하지 않음 | `k8s/base/configmap.yaml` | 주석에 `=true 시 probe 성공 로그 출력` 보완 (선택) |
| I-13 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/9-observability.md §1.1` — 이전 리뷰 세션이 SPEC-DRIFT 로 표시했으나 현재 워크트리 내 spec 이 갱신 완료된 상태. 코드·spec 일치 확인 | `spec/data-flow/9-observability.md §1.1` | 추가 조치 불필요 |
| I-14 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/3-error-handling.md §7.2` — 이전 리뷰 세션이 SPEC-DRIFT 로 표시했으나 현재 워크트리 내 spec 이 갱신 완료된 상태. 코드·spec 일치 확인 | `spec/5-system/3-error-handling.md §7.2` | 추가 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `/api/health` checks 필드 외부 노출(INFO), 로그 쿼리스트링 노출(INFO) — 신규 취약점 없음 |
| architecture | LOW | HEALTH_PROBE_PATHS 하드코딩 결합도(INFO), Express 직접 의존(INFO) — 중대 위반 없음 |
| requirement | LOW | HP-C-1~C-4 전 항목 spec §1.1 완전 일치; 이전 SPEC-DRIFT 2건 갱신 완료 확인 |
| scope | NONE | 변경 파일 전부 HP-C-1~C-4 귀속, 범위 이탈 없음 |
| side_effect | MEDIUM | 생성자·메서드 시그니처 변경(직접 호출 파괴 위험), 로그 소멸 모니터링 오탐, k8s 롤링 업데이트 liveness 실패 이벤트 — WARNING 4건 |
| maintainability | LOW | 전반 가독성 양호; HEALTH_PROBE_PATHS 하드코딩·주석 비대칭·e2e 상수 중앙화 후속 개선 권장 |
| testing | LOW | 커버리지 전반 양호; healthy wire 케이스 비대칭·예외 경로 미커버·e2e 계약 모호성 INFO 3건 |
| documentation | LOW | 문서화 전반 양호; readinessProbe 주석 비대칭·configmap 주석 보완 INFO |
| api_contract | MEDIUM | `GET /api/health` 200→503 breaking change — CHANGELOG 공지 존재하나 배포 전 외부 규칙 확인 필요 |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 (RISK=NONE)

## 권장 조치사항

1. **(배포 전 필수)** `grep -r "new LoggingInterceptor" codebase/` 및 `grep -r "controller\.check\|HealthController.*check\b" codebase/` 실행 — 직접 인스턴스화·호출 코드 존재 시 즉시 수정 (W-1, W-2)
2. **(배포 전 필수)** 외부 모니터링·로드밸런서·업타임 체커 헬스체크 규칙이 HTTP 503 을 수용하는지 운영팀 확인; 배포 팀 공지 (W-5)
3. **(배포 시 필수)** 이미지 버전 업그레이드와 k8s deployment manifest 경로 변경을 동일 `kubectl apply` 로 함께 적용; 롤링 업데이트 중 liveness 이벤트 모니터링 (W-4)
4. **(배포 전 권장)** 로그 기반 알림 규칙 점검 — `/api/health 200` 패턴 의존 여부 확인; 점진 전환 필요 시 `HEALTH_CHECK_LOG=true` 선행 후 알림 규칙 갱신 (W-3)
5. **(후속 개선)** `health.controller.spec.ts` healthy HTTP wire 케이스에 `checks.database.status` / `checks.redis.status` 검증 추가 (I-8)
6. **(후속 개선)** e2e `res.body.data ?? res.body` 이중 분기 → TransformInterceptor 적용 여부 확정 후 단일 단언으로 단순화 (I-6)
7. **(후속 개선)** `k8s/base/backend-deployment.yaml` `readinessProbe` 블록에 1줄 주석 추가 (I-10)
8. **(후속 개선)** `test/helpers/constants.ts` 에 `BASE_URL` 추출 (I-9)
9. **(후속 개선)** k8s Ingress/NetworkPolicy 로 `/api/health` 외부 접근 차단 검토 (I-1)

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: 아래 표 (5명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |