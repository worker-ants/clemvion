# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `GET /api/health` 의 HTTP 200→503 breaking change 가 존재하며 기존 소비자(외부 모니터링·알람 시스템)에 영향을 줄 수 있음. 코드 구현 품질 자체는 높고, spec 두 곳이 구현보다 낡은 상태(SPEC-DRIFT 2건). CHANGELOG 공지·k8s manifest 동반 갱신 등 완화 조치는 충분히 이루어짐.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/9-observability.md §1.1` — liveness/readiness 분리·503·HEALTH_CHECK_LOG 미반영. mermaid 시퀀스가 단일 경로로 남아 있고, 503 응답코드·`/api/health/live`·HEALTH_CHECK_LOG 규칙이 본문에 없음. Rationale 도 구현과 역전된 방향으로 서술 | `spec/data-flow/9-observability.md §1.1`, `## Rationale` | 코드 유지 + spec 갱신: §1.1 mermaid 2분기, 200/503 의미 명문화, HEALTH_CHECK_LOG 규칙, Rationale S3 재서술 반영 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/3-error-handling.md §7.2` — "/api/health 는 liveness probe 용" 진술이 구현과 역전. 구현은 `/api/health`=readiness(503), `/api/health/live`=liveness 로 분리 완료했으나 spec 이 낡은 상태 | `spec/5-system/3-error-handling.md §7.2` Note | 코드 유지 + spec 갱신: §7.2 Note 를 "readiness(`/api/health`): 의존성 장애 시 HTTP 503 / liveness(`/api/health/live`): 항상 HTTP 200" 으로 교체 |
| 3 | API_CONTRACT | `GET /api/health` HTTP 200→503 breaking change. 기존 HTTP 상태 코드 기반 모니터링·알람 시스템이 503 을 장애로 오탐할 수 있음. CHANGELOG 에 명시됨. | `health.controller.ts`, `CHANGELOG.md` | CHANGELOG 공지 충분. 배포 전 운영팀에 공지하고, 로드밸런서·업타임 체커 규칙에서 503 수용 여부 확인 |
| 4 | SIDE_EFFECT | `HEALTH_CHECK_LOG` 미설정 시 기존 배포 환경에서 health probe 성공 로그가 묵시적으로 억제됨. 로그 기반 알림·모니터링 규칙이 probe 성공 로그를 참조하면 신호 끊김 | `logging.interceptor.ts`, `k8s/base/configmap.yaml` | 배포 전 로그 기반 알림 규칙에서 `/api/health 200` 패턴 사용 여부 확인. 필요 시 `HEALTH_CHECK_LOG=true` 로 일시 설정 후 점진 전환 |
| 5 | SIDE_EFFECT | `LoggingInterceptor` 생성자 시그니처 변경(`ConfigService` 의존성 추가) — DI 외부 직접 `new LoggingInterceptor()` 호출 코드가 있으면 런타임 오류 | `logging.interceptor.ts` constructor | `grep -r "new LoggingInterceptor" codebase/` 로 직접 인스턴스화 위치 확인. 존재 시 mock `ConfigService` 주입 패턴으로 수정 |
| 6 | SIDE_EFFECT | `HealthController.check()` 시그니처 변경(`@Res({ passthrough: true })` 추가) — DI 외부 직접 호출 코드 존재 시 런타임 오류 | `health.controller.ts` `check()` | `grep -r "controller.check\|HealthController" codebase/` 로 직접 호출 위치 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `/api/health` 응답 body 의 `checks` 필드에 DB·Redis 상태·latency 등 인프라 정보 노출. `@Public()` 으로 인증 없이 공개 | `health.controller.ts` | k8s Ingress/NetworkPolicy 로 외부 접근 차단 또는 외부 응답에서 `checks` 상세 제거 검토 |
| 2 | SECURITY | `LoggingInterceptor` 로그 메시지에 쿼리스트링 포함된 원본 `url` 사용 — 민감 파라미터 로그 유출 가능 | `logging.interceptor.ts` L49 | 로그 메시지 작성 시 `url` 대신 `path`(`url.split('?')[0]`) 사용 또는 민감 파라미터 마스킹 |
| 3 | SECURITY | `HEALTH_CHECK_LOG` 환경변수 대소문자 미처리 — `'True'`, `'TRUE'` 등이 `false` 로 처리됨 (이전 리뷰 이월) | `logging.interceptor.ts` L328 | `config.get<string>('HEALTH_CHECK_LOG')?.toLowerCase() === 'true'` 로 변경 |
| 4 | ARCHITECTURE | e2e 테스트의 `data ?? body` 조건 분기 — TransformInterceptor 적용 여부 불확실성을 테스트가 흡수. API 계약 검증보다 구현 불확실성 용인 | `health.e2e-spec.ts` L854 | e2e 환경에서 TransformInterceptor 적용 여부 확정 후 단일 경로로 단순화 |
| 5 | ARCHITECTURE | `live()` 응답 DTO 미추출 — `check()` 는 `HealthCheckDto` 사용, `live()` 는 인라인 리터럴 타입 (이전 리뷰 이월) | `health.controller.ts` `live()` | 응답 필드 확장 시 `LivenessResponseDto` 추출. 현재는 유지 가능 |
| 6 | ARCHITECTURE | `HEALTH_PROBE_PATHS` 하드코딩 및 SRP 혼합 — 경로 추가 시 두 곳(컨트롤러 prefix, 인터셉터 상수) 수정 필요 (이전 리뷰 이월) | `logging.interceptor.ts` 모듈 상수 | 경로 3개 이상 또는 환경별 차이 발생 시 `health.constants.ts` 추출 및 ConfigService 주입 검토 |
| 7 | TESTING | `HealthService.check()` 예외 throw 시 컨트롤러 레벨 동작 미커버 (이전 리뷰 이월) | `health.controller.spec.ts` | `Promise.reject(new Error('DB connection failed'))` 케이스 추가해 500 반환 여부 확인 |
| 8 | TESTING | HTTP wire 테스트에서 healthy 케이스의 `checks` 필드 검증이 얕음 (`toBeDefined()` 만). unhealthy 케이스는 `checks.database.status` 까지 검증해 비대칭 | `health.controller.spec.ts` L585 | `expect(res.body.checks.database.status).toBe('healthy')` 추가해 대칭 유지 |
| 9 | TESTING | `HEALTH_CHECK_LOG` 대소문자 처리 테스트 미검증. `buildConfig('True')`, `buildConfig('TRUE')` 케이스 없음 (이전 리뷰 이월) | `logging.interceptor.spec.ts` | `'True'`, `'TRUE'` 케이스 추가해 현재 동작(false 처리) 문서화 또는 `.toLowerCase()` 적용 후 테스트 |
| 10 | TESTING | `ConfigService` mock 이 단일 키 고정값(`mockReturnValue`) — 향후 다른 키 추가 시 잘못된 값 반환 가능 (이전 리뷰 이월) | `logging.interceptor.spec.ts` `buildConfig` 헬퍼 | `mockImplementation((key) => key === 'HEALTH_CHECK_LOG' ? value : undefined)` 로 키별 분기 |
| 11 | MAINTAINABILITY | e2e 테스트 `BASE_URL` 기본값 `'http://backend-e2e:3011'` 하드코딩 (이전 리뷰 이월) | `health.e2e-spec.ts` L839 | `test/helpers/constants.ts` 에 `BASE_URL` 중앙화 |
| 12 | DOCUMENTATION | `readinessProbe` 블록에 대응 주석 없음 — `livenessProbe` 블록에는 역할 분리 3줄 주석이 있으나 readiness 측은 비대칭 (이전 리뷰 이월) | `k8s/base/backend-deployment.yaml` readinessProbe | readinessProbe 위에 1줄 주석 추가: "readiness: 의존성(DB/Redis) 점검, 비정상 시 HTTP 503 반환" |
| 13 | SIDE_EFFECT | k8s 롤링 업데이트 중 구 Pod 에서 `/api/health/live` 404 → liveness 실패 이벤트 발생 가능. `initialDelaySeconds: 30`, `failureThreshold: 5` 로 실제 재시작까지는 이어지지 않을 수 있음 | `k8s/base/backend-deployment.yaml` | 배포 시 `kubectl get events` 모니터링해 liveness 실패 이벤트 과도 여부 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `/api/health` 인프라 정보 노출(INFO), 로그 쿼리스트링 유출 가능(INFO), HEALTH_CHECK_LOG 대소문자 미처리(INFO) |
| architecture | LOW | e2e `data??body` 조건 분기(INFO), `live()` DTO 미추출(INFO), HEALTH_PROBE_PATHS 하드코딩(INFO) |
| requirement | LOW | SPEC-DRIFT 2건(WARNING) — `9-observability.md §1.1`, `3-error-handling.md §7.2` 갱신 필요. 코드 구현 자체는 HP-C-1~4 전 항목 충족 |
| scope | NONE | 변경 범위 이탈 없음 — 모든 파일이 목표에 직접 귀속 |
| side_effect | LOW | 200→503 breaking change(WARNING), HEALTH_CHECK_LOG 묵시적 로그 억제(WARNING), DI 외부 직접 호출 코드 확인 필요(WARNING) |
| maintainability | LOW | 모든 항목 INFO 수준, 이전 리뷰 이월 항목들 |
| testing | LOW | 모든 항목 INFO 수준, 커버리지 전반적으로 양호 |
| documentation | LOW | readinessProbe 주석 비대칭(INFO), 이전 리뷰 이월 항목들 |
| api_contract | MEDIUM | `GET /api/health` 200→503 breaking change(WARNING) — CHANGELOG 공지됨, 소비자 업데이트 필요 |
| user_guide_sync | NONE | 매칭된 trigger 3개 모두 동반 갱신 완료. 누락 0건 |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 이탈 없음 (NONE)
- **user_guide_sync**: 동반 갱신 누락 없음 (NONE)

---

## 권장 조치사항

1. **(SPEC-DRIFT — project-planner 위임)** `spec/data-flow/9-observability.md §1.1` 갱신: mermaid 시퀀스를 readiness/liveness 2분기로 분리, 200/503 의미 명문화, HEALTH_CHECK_LOG 규칙 추가, Rationale S3 재서술.
2. **(SPEC-DRIFT — project-planner 위임)** `spec/5-system/3-error-handling.md §7.2` Note 갱신: "/api/health 는 liveness probe 용" 진술을 readiness/liveness 분리 후 현행 구현 기준으로 교체.
3. **(배포 전 확인)** `HEALTH_CHECK_LOG` 미설정 시 기존 배포 환경에서 health probe 성공 로그 억제 여부 운영팀 공지. 로그 기반 알림 규칙에서 `/api/health 200` 패턴 사용 여부 점검.
4. **(배포 전 확인)** `GET /api/health` 200→503 breaking change 에 대해 외부 모니터링·업타임 체커·로드밸런서 규칙이 503 을 수용하는지 운영팀 확인.
5. **(배포 전 one-time 확인)** `grep -r "new LoggingInterceptor\|controller\.check\|HealthController" codebase/` 로 DI 외부 직접 호출 코드 존재 여부 확인. 존재 시 mock 주입 패턴으로 수정.
6. **(후속 개선 — INFO)** e2e `data??body` 조건 분기 단순화: TransformInterceptor 적용 여부를 확정하고 명시적 단언으로 교체.
7. **(후속 개선 — INFO)** `HEALTH_CHECK_LOG` 대소문자 정규화 (`.toLowerCase()`) 및 대소문자 케이스 테스트 추가.
8. **(후속 개선 — INFO)** HTTP wire 테스트 healthy 케이스 `checks` 내부 구조 검증 추가 (`checks.database.status`).
9. **(후속 개선 — INFO)** `readinessProbe` 블록 위에 1줄 설명 주석 추가해 `livenessProbe` 와 대칭 맞춤.
10. **(후속 개선 — INFO)** `test/helpers/constants.ts` 생성해 `BASE_URL` 하드코딩 중앙화.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행** (10명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **제외** (4명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | health probe 경로 분리 변경 — 성능 임계 경로 없음 |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | DB 스키마·마이그레이션 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)