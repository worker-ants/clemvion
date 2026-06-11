# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-health-probe-status.md`
**검토 기준일**: 2026-06-10
**검토 모드**: --spec (spec draft 검토)

---

## 발견사항

### [CRITICAL] `/api/health` probe 역할 라벨 직접 충돌 — 3-error-handling.md §7
- **target 위치**: draft §C-1 "용도: readinessProbe 전용", §C-2 "livenessProbe 전용 `/api/health/live` 신규"
- **충돌 대상**: `spec/5-system/3-error-handling.md §7.1–7.2`
- **상세**: `3-error-handling.md §7` 는 `/api/health` 를 명시적으로 "liveness probe 용 binary 판정(`unhealthy`)을 쓴다" 라고 기술한다 (`§7.2` 마지막 Note). draft 는 `/api/health` 를 **readiness** probe 전용으로 전환하고, 새 `/api/health/live` 를 **liveness** probe 전용으로 분리하는 것이 변경의 핵심이다. 채택 시 `3-error-handling.md §7` 의 probe 역할 서술이 즉시 허위가 된다. 두 문서가 동일 endpoint 의 probe 역할을 반대로 기술하게 되어 어느 하나는 작동 정의로서 무효가 된다. 이 파일은 draft 의 target_specs 목록에 포함되지 않아 갱신 누락 위험이 있다.
- **제안**: `spec/5-system/3-error-handling.md §7` 를 target_specs 에 추가하거나, 해당 파일 §7.2 의 Note 를 다음으로 교체한다: "`/api/health` 는 readinessProbe 전용(의존성 장애 시 HTTP 503). liveness probe 는 `/api/health/live` (항상 200). 상세는 `spec/data-flow/9-observability.md §1.1`."

---

### [CRITICAL] `spec/data-flow/9-observability.md §1.1` mermaid 액터 라벨 직접 충돌
- **target 위치**: draft "§영향받는 문서 — spec/data-flow/9-observability.md (substantive) §1.1"
- **충돌 대상**: `spec/data-flow/9-observability.md §1.1` — `participant K as 외부 (k8s liveness / 사용자)` 라벨, 및 Rationale "liveness probe 는 빠르게 끝나야 하므로 S3 는 readiness 단계 또는 별도 endpoint 로 분리하는 것을 권장한다"
- **상세**: 현행 `9-observability.md` 는 단일 `/api/health` 엔드포인트를 "k8s liveness / 사용자" 가 호출하는 것으로 그린다. draft 채택 후 `/api/health` 는 readiness, `/api/health/live` 가 liveness 가 되므로 mermaid 의 단일 액터 표기는 즉시 허위가 된다. draft 에서 이 파일을 substantive 변경 대상으로 지목했으나, mermaid 외에도 Rationale 의 S3 권고 문장("liveness probe 는 빠르게 끝나야") 이 새 세계에서 다른 endpoint 를 가리키게 되어 재서술이 필요하다.
- **제안**: `9-observability.md §1.1` mermaid 를 liveness(`/api/health/live`) / readiness·사용자(`/api/health`) 두 참여자 경로로 분기하도록 갱신. Rationale 의 S3 문단은 "readiness probe(`/api/health`)에 S3 ping 포함 가능" 방향으로 재서술 (draft 계획에 포함 — 실제 편집 시 확인).

---

### [WARNING] `spec/5-system/3-error-handling.md §7.2` HTTP status code 암묵적 전제
- **target 위치**: draft §C-1 "status !== 'healthy' → HTTP 503"
- **충돌 대상**: `spec/5-system/3-error-handling.md §7.2` — 응답 JSON 예시 및 `status: binary` 서술. HTTP 200/503 응답 코드에 대한 명시 기술 없음.
- **상세**: `3-error-handling.md §7` 는 response body 만 정의하고 HTTP status code 는 서술하지 않는다. draft 채택 후 해당 절이 status code 변경을 반영하지 않으면 헬스 체크 spec 의 단일 진실이 두 문서에 분산된다. 직접 모순은 아니지만 독자 혼동을 유발한다.
- **제안**: draft 채택 시 `3-error-handling.md §7.2` 에 status code 의미 테이블(200/503)과 `/api/health/live` 엔드포인트 항목을 추가하거나, "상세는 `spec/data-flow/9-observability.md §1.1`" cross-ref 1줄을 추가해 SoT 를 명확히 한다.

---

### [WARNING] `spec/5-system/16-system-status-api.md Rationale R-4` probe 역할 참조 혼동 가능성
- **target 위치**: draft §C-1 (HTTP 503 readiness 의미 명문화)
- **충돌 대상**: `spec/5-system/16-system-status-api.md Rationale R-4` — "기존 `/health` 엔드포인트는 binary `healthy | unhealthy` 다" 를 대조 근거로 사용
- **상세**: R-4 의 대조 근거는 body `status` 어휘(binary `healthy|unhealthy`)를 기준으로 하므로 draft 채택 후에도 body 어휘는 불변이라 R-4 의 논리는 여전히 유효하다. 그러나 R-4 가 `/health` 를 암묵적으로 "liveness" 로 읽히는 문맥(현행 `3-error-handling.md §7` 의 liveness 라벨)에 의존하므로, probe 역할 전환 후 독자가 "R-4 가 틀렸다"고 오해할 소지가 있다. draft 의 target_specs 에서 "변경 불요(검토만)"로 분류됐으나 최소 cross-ref 가 필요하다.
- **제안**: R-4 에 "body status 는 binary 유지, HTTP status code 및 probe 역할 분리는 `spec/data-flow/9-observability.md §1.1` 참조" 1줄 cross-ref 를 추가한다.

---

### [WARNING] `spec/data-flow/9-observability.md Rationale` S3 권고 문맥 변경
- **target 위치**: draft Rationale "왜 liveness 를 분리하는가"
- **충돌 대상**: `spec/data-flow/9-observability.md Rationale` — "liveness probe 는 빠르게 끝나야 하므로 S3 는 readiness 단계 또는 별도 endpoint 로 분리하는 것을 권장한다"
- **상세**: 현행 Rationale 은 `/api/health` 가 liveness probe 인 세계를 전제로 "S3 를 readiness 단계로 분리 권장"이라고 쓴다. draft 채택 시 `/api/health` 자체가 readiness probe 가 되므로 S3 ping 을 `/api/health` 에 포함하는 것이 자연스러우며, 기존 권고("별도 endpoint 로 분리")의 근거가 소멸한다. 이 불일치는 미래 S3 ping 구현 시 spec 과 구현의 불일치로 이어질 수 있다.
- **제안**: `9-observability.md Rationale` S3 절을 "readiness probe(`/api/health`)에 S3 ping 을 추가할 수 있으나 외부 네트워크 의존으로 latency 가 길어질 수 있으므로 timeout 을 짧게(예: 2s) 설정하는 것을 권장한다" 방향으로 재서술한다.

---

### [INFO] 요구사항 ID 신규 부여 없음 — 충돌 없음
- **target 위치**: draft 전체
- **충돌 대상**: `spec/**` 전역
- **상세**: draft 는 새로운 요구사항 ID (`NAV-*`, `ND-*`, `SYS-*` 등)를 부여하지 않는다. C-1~C-4 는 draft 내부 레이블로 spec ID namespace 에 등록하는 형식이 아니다. ID 충돌 없음.

---

### [INFO] `HEALTH_CHECK_LOG` 환경변수 — 다른 spec 에서 사용 중인 이름과 충돌 없음
- **target 위치**: draft §C-4 `HEALTH_CHECK_LOG` 환경변수
- **충돌 대상**: `spec/**` 전역 환경변수 목록
- **상세**: `HEALTH_CHECK_LOG` 는 어느 spec 에도 등장하지 않는 신규 env 이름이다. 기존 health 관련 env (`SYSTEM_STATUS_FAILED_THRESHOLD` 등)와 네이밍 충돌 없다. 단, 구현 시 `.env.example` 및 운영 가이드 문서에도 추가 필요 (draft 에 이미 계획됨).

---

## 요약

Cross-Spec 일관성 관점에서 가장 중대한 충돌은 **`spec/5-system/3-error-handling.md §7`** 가 `/api/health` 를 "liveness probe 용" endpoint 로 명시하고 있다는 점이다. draft 의 핵심 변경인 "readiness/liveness probe 역할 분리" 와 직접 모순되며, 이 파일이 draft 의 target_specs 목록에 포함되지 않아 갱신 누락 위험이 높다. `spec/data-flow/9-observability.md §1.1` 의 mermaid 액터 라벨도 동일 모순을 가지나 draft 에서 갱신 예정으로 해결 경로가 있다. `spec/5-system/16-system-status-api.md Rationale R-4` 는 body binary 어휘 대조로서 논리적으로 여전히 유효하나, probe 역할 전환 후 독자 혼동 방지를 위한 최소 cross-ref 추가가 권장된다. 데이터 모델·API 계약·요구사항 ID·RBAC 충돌은 없다. `/api/health/live` 신규 추가는 기존 endpoint 와 독립적이며 기존 어느 spec 과도 API 계약 충돌을 일으키지 않는다.

---

## 위험도

HIGH

`spec/5-system/3-error-handling.md §7` 의 "liveness probe" 라벨 충돌이 CRITICAL 수준이며, 해당 파일이 draft target_specs 에서 누락되어 있어 구현 또는 이후 spec 작성 시 혼란의 원인이 될 수 있다.
