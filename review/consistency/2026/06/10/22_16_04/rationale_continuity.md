# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-health-probe-status.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-10

---

## 발견사항

### 1. [WARNING] `/api/health` 를 liveness 용으로 기술한 기존 결정의 번복 — 새 Rationale 필요

- **target 위치**: `spec-draft-health-probe-status.md` §HP-C-1 및 §영향받는 문서 > `spec/5-system/3-error-handling.md` 항목
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §7.2` 참고(Note) — "`/api/health` 는 liveness probe 용 binary 판정(`unhealthy`)을 쓴다"; `spec/data-flow/9-observability.md §1.1` mermaid 액터 라벨 `외부 (k8s liveness / 사용자)`; `spec/data-flow/9-observability.md ## Rationale` "S3 ping 은 미구현 (Planned)" 항 — "liveness probe 는 빠르게 끝나야 하므로 S3 는 readiness 단계 또는 별도 endpoint 로 분리하는 것을 권장한다"
- **상세**: 기존 spec 에서 `/api/health` 는 명시적으로 **liveness probe 용**으로 기술되어 있었다. target 은 이를 **readiness 전용**으로 재정의하고 liveness 는 신규 `/api/health/live` 로 분리한다. 이는 기존 결정의 번복이다. target 스스로도 "Critical #2 — 정정 필수" 로 인식하고 있으며, `3-error-handling.md §7.2` 정정 계획을 제시한다. 다만 target 의 `## Rationale (draft 결정 근거)` 에는 이 번복의 동기(readiness 시맨틱 + 크래시루프 방지)가 명시되어 있고 9-observability.md Rationale 의 S3 분리 권고("liveness 는 빨라야")와 방향이 일관한다고 설명한다. 번복 자체는 올바르게 판단되었으나, **구 결정("liveness 용" 진술)을 명시적으로 폐기하는 갱신 Rationale 이 `9-observability.md §Rationale` 와 `3-error-handling.md §7.2` 양쪽에 기록되어야** 한다 — 구 항목 text 를 삭제·덮어쓰는 것만으로는 왜 번복됐는지의 이력이 사라진다.
- **제안**: target 의 `## 영향받는 문서 > spec/data-flow/9-observability.md §Rationale` 항목에 "기존 S3 ping Rationale 의 liveness 언급(`liveness probe 는 빠르게…`)을 readiness 기준으로 재서술" 이라고 명시되어 있고, `spec/5-system/3-error-handling.md §7.2` 정정도 명시한다 — 이를 구현 시 실제 spec 갱신에서 "**기존 liveness 진술은 probe 역할 분리 이전의 설계 결정으로, HP-C-1/HP-C-2 변경에 의해 번복됨**" 이라는 ADR 스타일 한 줄을 새 Rationale 항목에 추가하면 연속성이 완성된다. 특히 `3-error-handling.md §7.2` 참고 Note 를 단순 교체가 아니라 "이전 결정의 명시적 폐기 + 신규 결정" 패턴으로 작성할 것.

---

### 2. [INFO] 9-observability.md Rationale "S3 ping (Planned)" 항목의 재서술 범위 불명확

- **target 위치**: `spec-draft-health-probe-status.md` §영향받는 문서 > `spec/data-flow/9-observability.md §Rationale` 하위 — "liveness 가 빨라야 하니 S3 는 readiness/별도 endpoint 로 분리 권장이라고 적고 있다. probe 역할이 분리됐으므로 readiness(`/api/health`) 기준으로 재서술"
- **과거 결정 출처**: `spec/data-flow/9-observability.md ## Rationale` "Health check 의 S3 ping 은 미구현 (Planned)" — "S3 ping 은 외부 네트워크 의존이 강해 health check 가 느려질 수 있다. liveness probe 는 빠르게 끝나야 하므로 S3 는 readiness 단계 또는 별도 endpoint 로 분리하는 것을 권장한다."
- **상세**: 기존 Rationale 에서 "S3 는 liveness probe 가 아닌 readiness 단계 또는 별도 endpoint 로" 라는 권고가 이미 있었다. target 의 HP-C-1(readiness = `/api/health`) + HP-C-2(liveness = `/api/health/live`) 분리는 이 기존 권고와 **정합한다** — 기각된 대안이 아니라 기존 Rationale 이 권고한 방향을 구조적으로 실현한다. 단, 재서술 후 기존 문항의 "Planned" 상태 표기("S3 ping 은 미구현(Planned)")가 여전히 미구현 상태이므로, 재서술 시 S3 ping 자체의 구현 상태(여전히 Planned)가 혼동되지 않도록 명확히 보존해야 한다.
- **제안**: 재서술 시 "S3 ping 자체는 여전히 미구현(Planned)이며, 구현 시 readiness(`/api/health`)에 추가할 수 있다" 라는 현행 미구현 사실을 보존할 것. 기존 "Planned" 표기를 삭제하거나 모호하게 만들지 않도록 유의.

---

### 3. [INFO] 16-system-status-api.md R-4 의 "기존 `/health` 는 binary `healthy|unhealthy`" 진술 유효성

- **target 위치**: `spec-draft-health-probe-status.md` §영향받는 문서 > `spec/5-system/16-system-status-api.md` — "R-4 의 '기존 `/health` 엔드포인트는 binary `healthy | unhealthy`' 진술은 body status 기준이라 여전히 참"
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md ## Rationale R-4` — "기존 `/health` 엔드포인트는 binary `healthy | unhealthy` 다. 큐 상태는 … `unhealthy` 를 심각도 2단계로 분리했다."
- **상세**: target 의 분석은 옳다 — R-4 가 말하는 binary 는 body 의 `status` 어휘(healthy/unhealthy)를 가리키므로, HTTP status code 가 추가되어도 body 어휘는 불변이라 R-4 진술은 사실상 계속 유효하다. cross-ref 1줄 추가는 적절하다. 실질 충돌 없음.
- **제안**: 조치 계획 그대로 진행 가능. cross-ref 추가 시 "body status 어휘는 여전히 binary" 임을 명시하면 독자 혼동을 최소화할 수 있다.

---

## 요약

target 문서는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하지 않으며, 기존 합의된 invariant(S3 분리 권고, binary body 어휘 유지, single-endpoint 헬스 체크)를 직접 위반하지도 않는다. 다만 `/api/health` 를 liveness 용으로 정의한 기존 결정(`3-error-handling.md §7.2`, `9-observability.md §1.1`)을 readiness 전용으로 번복하면서, target 내 draft Rationale 에 번복 근거가 기록되어 있고 spec 갱신 계획도 제시된다 — 연속성 자체는 인식되어 있다. 개선점은 실제 spec 반영 시 구 결정이 명시적으로 폐기·갱신됨을 Rationale 이력으로 남기는 것(단순 텍스트 교체가 아닌 ADR 형태 갱신)이며, S3 ping "Planned" 상태의 재서술 시 미구현 사실 보존이 필요하다. 전반적으로 Rationale 연속성 관점의 위험도는 낮다.

---

## 위험도

LOW
