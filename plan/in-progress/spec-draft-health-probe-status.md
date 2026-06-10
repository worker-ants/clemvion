---
name: spec-draft-health-probe-status
status: in-progress
worktree: health-probe-status-d9a184
started: 2026-06-10
owner: project-planner
summary: /api/health 의 HTTP status code 의미(healthy→200, unhealthy→503) 명문화 + liveness 전용 /api/health/live 신규 + HEALTH_CHECK_LOG 로그 게이팅. k8s liveness/readiness probe 분리.
target_specs:
  - spec/data-flow/9-observability.md        # SoT (substantive 변경)
  - spec/5-system/3-error-handling.md        # §7 헬스 체크 — "liveness probe 용" 진술 정정 (Critical #2)
  - spec/5-system/16-system-status-api.md    # R-4 대조 진술 — cross-ref 1줄만
---

# Spec draft: Health probe status code + liveness/readiness 분리

## 배경 (문제)

`/api/health` 는 DB/Redis 가 죽어도 응답 body 의 `status: 'unhealthy'` 로만 표기하고
**HTTP 200 을 반환**한다 (`health.controller.ts` → `health.service.ts` 가 내부 catch).
k8s manifest(`k8s/base/backend-deployment.yaml`)는 readinessProbe·livenessProbe **둘 다**
`/api/health` 를 `httpGet` 으로 찌른다. httpGet probe 는 2xx/3xx 를 성공으로 보므로:

- **readinessProbe 가 무력화**: 의존성 장애에도 200 → Pod 가 Service endpoint 에서 빠지지 않음.
- 의존성 장애 시 적절한 HTTP 신호가 없어 LB/probe 가 상태를 구분 못 함.

그리고 정상 운영 시 probe 가 주기적으로(readiness 10s·liveness 30s) `/api/health` 를 찔러
`LoggingInterceptor` 가 `GET /api/health 200` 성공 로그를 대량 생성 → 로그 노이즈.

> **기존 spec 의 전제 충돌 (consistency-check Critical #2)**: `spec/5-system/3-error-handling.md §7.2`
> 는 `/api/health` 를 **"liveness probe 용 binary 판정"** 으로 명시한다. 본 변경은 `/api/health` 를
> **readiness 전용**으로 재정의하고 liveness 는 신규 `/api/health/live` 로 분리하므로, 이 진술을
> 반드시 정정해야 한다 (아래 §영향받는 문서).

## 변경 요지

### HP-C-1. `/api/health` status code 의미 명문화 (readiness)
- `status === 'healthy'` → **HTTP 200**
- `status !== 'healthy'`(`unhealthy` / redis `unconfigured` 포함) → **HTTP 503 (Service Unavailable)**
- 응답 **body 구조는 불변** (`{ status, version, uptime, checks }`). status code 만 추가로 의미를 갖는다.
  (구현 시 throw 가 아닌 응답 status 설정으로 body 보존 — GlobalExceptionFilter 의 error shape 로 변형되지 않게.)
- 용도: **readinessProbe** 전용. 의존성 장애 시 503 → Pod 가 Service 에서 제외(트래픽 차단)되며,
  의존성 복구 시 자동 200 복귀 → 재투입.

### HP-C-2. liveness 전용 엔드포인트 `/api/health/live` 신규
- 의존성(DB/Redis) 점검 없이 **프로세스 생존만** 확인 → **항상 HTTP 200** (`{ status: 'ok' }`).
- 용도: **livenessProbe** 전용.
- 근거: liveness 가 외부 의존성을 검사하면 DB 장애 시 전 replica 의 liveness 가 동시 실패 →
  kubelet 이 전 Pod 를 동시 재시작(크래시루프). 재시작은 외부 DB 를 복구하지 못하므로 해롭다.
  liveness 는 "프로세스가 살아있고 응답하는가" 만 답해야 한다 (k8s 표준 패턴).

### HP-C-3. k8s probe 분리
- `livenessProbe.httpGet.path`: `/api/health` → **`/api/health/live`**
- `readinessProbe.httpGet.path`: `/api/health` 유지
- backend 만 적용. frontend 는 health 가 의존성을 검사하지 않으므로(외부 의존 없음) 현행 유지.

### HP-C-4. `HEALTH_CHECK_LOG` 환경변수 (로그 게이팅)
- boolean, **기본 `false`**.
- `LoggingInterceptor` 가 health probe 경로(`/api/health`, `/api/health/live`)에 대해:
  - 성공(HTTP < 400): `HEALTH_CHECK_LOG === true` 일 때만 로그 (level `log`/INFO).
  - 실패(HTTP ≥ 400, 즉 readiness 503): **항상** 로그 (level `warn`).
  - 그 외 모든 경로: 기존 동작(항상 `log`) 유지.
- 효과: 기본은 실패만 보이고(노이즈 제거), 설정 시 성공·실패 모두 표시.

## 영향받는 문서

### spec/data-flow/9-observability.md (substantive — SoT)
- §Overview "System role" 의 Health check 한 줄에 liveness/readiness 분리 언급.
- §1.1 Health check:
  - mermaid 액터 라벨 `외부 (k8s liveness / 사용자)` → readiness probe·사용자 가 `/api/health`,
    liveness probe 가 `/api/health/live` 로 분기되게 시퀀스/설명 갱신 (WARNING #1).
  - 본문에 status code 의미(200/503) + `/api/health/live`(항상 200) 명문화.
  - `HEALTH_CHECK_LOG` 환경변수 + 로그 게이팅 규칙 명문화.
- §Rationale:
  - 기존 "S3 ping 미구현(Planned)" 항목은 "liveness 가 빨라야 하니 S3 는 readiness/별도 endpoint 로 분리 권장"
    이라고 적고 있다. probe 역할이 분리됐으므로 이 문장을 **readiness(`/api/health`) 기준**으로 재서술
    — S3 ping 은 (구현 시) readiness 에 추가 가능하고 liveness(`/api/health/live`)는 의존성 미점검 (WARNING #4).
  - 새 Rationale 항목으로 (a) 503 의 readiness 시맨틱, (b) liveness 가 의존성 미검사하는 이유,
    (c) body 보존(throw 안 함) 결정, (d) HEALTH_CHECK_LOG 기본 false 의 노이즈/관측성 트레이드오프를 기록.

### spec/5-system/3-error-handling.md (Critical #2 — 정정 필수)
- §7.2 의 **`참고` Note** ("`/api/health` 는 liveness probe 용 binary 판정") 를 다음으로 교체:
  - `/api/health` = **readiness probe 용** (binary body status 유지). 의존성 장애 시 **HTTP 503**, 정상 **HTTP 200**.
  - `/api/health/live` = **liveness probe 용**, 의존성 미점검, **항상 HTTP 200**.
  - HTTP status code·probe 역할 분리의 SoT 는 `9-observability.md §1.1` 로 cross-ref (WARNING #2/#5).
- §7.2 본문 body 는 binary(`healthy|unhealthy`) 유지 — status code 가 추가 의미를 가질 뿐 body schema 불변.
- §6 로깅 정책: `HEALTH_CHECK_LOG` 의 상세 규칙은 9-observability §1.1 에 두고, §6 에는 cross-ref 만(선택).

### spec/5-system/16-system-status-api.md (cross-ref 1줄 — WARNING #3)
- R-4 의 "기존 `/health` 엔드포인트는 binary `healthy | unhealthy`" 진술은 body status 기준이라 여전히 참.
  단, probe 역할 전환 후 독자 혼동 방지를 위해 R-4 에
  "HTTP status code 및 liveness/readiness probe 역할 분리는 `9-observability.md §1.1` 참조" cross-ref 1줄 추가.

## Rationale (draft 결정 근거)

- **왜 503 인가**: readiness 실패의 표준 신호. httpGet probe 는 2xx/3xx 성공·그 외 실패로 판정하므로
  비정상 시 5xx 가 명확. 503(Service Unavailable)이 "일시적으로 처리 불가"의 의미에 부합.
- **왜 body 를 유지(throw 안 함)하는가**: 기존 소비자(모니터·사용자)가 `{status,checks}` 구조에 의존.
  NestJS 에서 throw 하면 GlobalExceptionFilter 가 `{error:{...}}` 로 감싸 구조가 깨진다. 응답 status 만
  설정하면 body 와 status code 를 동시에 만족.
- **왜 liveness 를 분리하는가**: 위 HP-C-2 근거(크래시루프 방지). 기존 9-observability Rationale 의
  S3 분리 권고("liveness 는 빨라야")와 방향이 일관 — 그 권고를 본 변경이 구조적으로 실현한다.
- **왜 HEALTH_CHECK_LOG 기본 false 인가**: probe 는 고빈도(10~30s)라 성공 로그가 지배적 노이즈.
  기본은 실패만 노출해 신호 대 잡음비를 높이고, 디버깅 필요 시 env 로 전체 활성화. 실패는 항상
  노출해 장애를 놓치지 않는다.
- **scope = backend only**: frontend health 는 외부 의존성을 검사하지 않으므로 liveness/readiness 분리가
  불필요(사용자 확인). dev 에서 Redis 는 사실상 필수(docker-compose `service_healthy` 의존)라
  `unconfigured → 503` 특수 처리 불필요 — 정상 셋업 환경에선 항상 Redis 존재.

## 후속 (구현 — developer)

구현 착수 시 체크리스트:

- [x] spec 이식 완료: `9-observability.md §1.1`+Rationale, `3-error-handling.md §7.2`, `16 R-4` (commit ef367de1)
- [x] 테스트 선작성(TDD): health.controller 단위+HTTP wire(200/503/live), logging.interceptor 단위(3분기+env)
- [x] backend: `health.controller.ts` — unhealthy 시 503(`@Res({passthrough:true})`로 body 보존) + `/live` 추가
- [x] backend: `logging.interceptor.ts` — `HEALTH_CHECK_LOG`(ConfigService) + health 경로 분기
- [x] k8s: `k8s/base/backend-deployment.yaml` livenessProbe path → `/api/health/live`
- [x] `.env.example`: `HEALTH_CHECK_LOG=false` + 주석
- [x] e2e: `health.e2e-spec.ts` — `/api/health` 200·`/api/health/live` 200 (작성)
- [x] TEST WORKFLOW: lint PASS, unit PASS (health/interceptor 15 tests green; frontend schedules-page 는 pre-existing order-flake, 재실행 통과)
- [x] TEST WORKFLOW: build PASS, e2e PASS (181 tests, health.e2e-spec 포함; docker 가용)
- [x] `/ai-review` 1차: CRITICAL=0, WARNING=4 → resolution-applier 4/4 fix (경계값·body·Swagger DTO·JSDoc), e2e pass
- [x] `/ai-review` 2차: CRITICAL=0, WARNING=3 → resolution-applier 3/3 fix (breaking-change CHANGELOG·/live Swagger·HEALTH_CHECK_LOG configmap+README), e2e pass
- [x] `/ai-review` 3차(최종): CRITICAL=0. WARNING 은 SPEC-DRIFT 2건(stale-baseline 오탐 — 내 spec 실제 갱신됨)·운영공지 2건(CHANGELOG/configmap 완화 완료)·DI 2건(grep 검증 안전). 코드 수정 불요.
- [x] `--impl-done` (3-error-handling.md `code:` glob 매칭): 1차 BLOCK:NO. 최종회차 BLOCK:YES 는 **stale baseline 오탐** — 아래 NOTE.

## ⚠️ NOTE: stale origin/main baseline (게이트 BLOCK 의 유일 원인)

- 본 워크트리 base = #521(e3f8b719). 작업 중 origin/main 이 #524(c07b2768)로 **3 PR 전진**(#522~524 머지).
- `--impl-done`/`/ai-review` 의 diff-base=origin/main 이라, #522~524(타인 머지분: 1-auth·audit-logs·dead-code·parallel-executor 등)를 "내가 삭제/변경"한 것으로 오인 → false Critical(cross-worktree 충돌)·false SPEC-DRIFT.
- **내 실제 변경(`ef367de1^..HEAD`)은 health-probe 35파일로 깨끗**하고 모든 테스트 통과·리뷰 CRITICAL=0.
- 게이트를 clean 하게 통과하려면 **origin/main(#524) 위로 rebase 후 재실행** 필요 (overlapping spec 파일 충돌 해소 동반). → 사용자 결정 대기.

### 잔여 선택적 INFO (코드 수정 불요, 후속 가능)
- `HEALTH_CHECK_LOG` 대소문자 정규화(`.toLowerCase()`), readinessProbe 주석 대칭, e2e BASE_URL 상수화, ConfigService mock key 분기.
- [ ] **수동 감사 노트**: `spec/data-flow/9-observability.md` 는 `spec-impl-evidence` 가드 적용 범위
      (`spec/conventions/spec-impl-evidence.md §1`) 밖이라 frontmatter `code:` 자동 커버리지가 없다 →
      이 변경의 spec↔구현 정합은 수동 확인 (consistency-check INFO #6/WARNING #6).
