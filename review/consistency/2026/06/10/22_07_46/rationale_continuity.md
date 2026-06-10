# Rationale 연속성 검토 결과

## 발견사항

### 발견사항 없음 — Rationale 연속성 충돌 없음

관련 spec 의 `## Rationale` 항목을 모두 검토한 결과, target 문서(`plan/in-progress/spec-draft-health-probe-status.md`)가 기존 Rationale 에서 기각·폐기된 대안을 재도입하거나 합의된 원칙을 위반하는 사례는 발견되지 않았다.

상세 점검 내용:

**1. `spec/data-flow/9-observability.md` §Rationale "Health check 의 S3 ping 은 미구현 (Planned)"**

기존 Rationale 은 "liveness probe 는 빠르게 끝나야 하므로 S3 는 readiness 단계 또는 **별도 endpoint 로 분리하는 것을 권장**한다"고 명시했다. target 의 C-2(`/api/health/live` 신규)와 C-3(livenessProbe 분리)는 이 권고를 정확히 따르는 방향이다. 기각된 대안이 아니라 이미 권장된 방향의 구체화다.

**2. `spec/5-system/16-system-status-api.md` §Rationale R-4 "health 어휘를 `healthy/degraded/down` 으로 둔 이유"**

R-4 는 "기존 `/health` 엔드포인트는 binary `healthy | unhealthy`"라고 명시하며, 큐 상태에만 3단계 어휘를 쓰는 근거를 설명한다. target 은 `/api/health`(readiness) 의 body `status` 를 binary `healthy|unhealthy` 로 유지하고 HTTP status code 의미만 추가하는 방식을 택했다. R-4 가 확정한 "binary body status" invariant 를 침해하지 않으며, target 의 §영향받는 문서 항목도 "R-4 의 진술은 body status 기준이라 변경 불요"라고 명시해 인식하고 있다.

**3. `spec/5-system/16-system-status-api.md` R-1 "개별 job 미노출 원칙"**

target 은 health probe 관련 내용이라 job payload 노출 문제와 무관하다. 충돌 없음.

**4. 기타 Rationale 항목 (0-overview, 1-data-model, 2-navigation/* 등)**

target 의 변경 범위(health probe, k8s probe 분리, 로그 게이팅)와 무관한 도메인이며 충돌 없음.

**5. C-4 `HEALTH_CHECK_LOG` 환경변수 도입**

기존 Rationale 에 로그 게이팅 접근을 기각한 항목이 없다. 신규 환경변수 도입에 대한 기존 Rationale 충돌 없음.

---

## 요약

target 문서가 참조하는 spec 의 Rationale 에서 기각·폐기된 결정을 재도입하거나 합의된 invariant 를 위반하는 사례가 없다. 특히 `9-observability.md` Rationale 의 S3 probe 분리 권고가 C-2/C-3 설계 방향과 완전히 일치하고, `16-system-status-api.md` R-4 의 `/health` binary status invariant 도 target 이 body 구조를 불변으로 유지하는 결정(C-1)으로 보존된다. 새로 추가되는 Rationale 항목 4개((a) 503 readiness 시맨틱, (b) liveness 의존성 미검사, (c) body 보존, (d) HEALTH_CHECK_LOG 기본 false)는 기존 결정과 상충하지 않으며 적절히 신설 근거로 작성될 예정이다.

## 위험도

NONE
