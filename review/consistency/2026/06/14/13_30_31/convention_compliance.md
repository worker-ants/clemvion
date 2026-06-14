# 정식 규약 준수 검토 결과

**target**: `spec/5-system/_product-overview.md`
**검토 모드**: 구현 완료 후 검토 (--impl-done)
**검토 일시**: 2026-06-14

---

## 발견사항

### [CRITICAL] `spec/5-system/_product-overview.md` §5 — NF-OB-07 항목 부재 (코드→spec dangling reference)

- **target 위치**: `## 5. 관측성(Observability)` 테이블 (lines 65–75). 현재 NF-OB-01 ~ NF-OB-06 까지만 존재하며 NF-OB-07 행이 없다.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2–§3` — spec 은 구현이 약속한 surface 의 단일 진실이다. 구현 코드 diff 전체에서 `NF-OB-07` ID 가 17회 이상 코드 주석·JSDoc 에 등장하며, `business-metrics.service.ts` 의 클래스 JSDoc 은 `(spec/5-system/_product-overview.md §5)` 를 직접 SoT 로 명시한다. 그러나 해당 §5 테이블에 NF-OB-07 행이 없어 코드→spec 참조가 dangling reference 상태다.
- **상세**: `app.module.ts` 주석 `// NF-OB-07 도메인 메트릭`, `continuation-dlq-monitor.service.ts` 주석 `NF-OB-07 'clemvion.queue.depth'`, `execution-engine.service.ts` 주석 `NF-OB-07 'clemvion.queue.depth' / 'clemvion.execution.total' / ... `, `llm-usage-log.service.ts` 주석 `NF-OB-07 'clemvion.llm.tokens'`, `business-metrics.service.ts` JSDoc 전체가 존재하지 않는 spec ID 를 가리킨다. `spec-impl-evidence` 가드는 `_*.md` 파일을 frontmatter 의무에서 면제하지만, spec 본문에 요구사항 행이 없으면 코드가 참조하는 SoT 자체가 공백이다.
- **제안**: `spec/5-system/_product-overview.md` §5 테이블에 NF-OB-07 행을 추가한다.

  ```
  | NF-OB-07 | 도메인/비즈니스 커스텀 메트릭 — 워크플로 실행 수·큐 깊이·LLM 토큰 사용량을 OTel Counter/Histogram/ObservableGauge 로 Prometheus 노출 (`OTEL_ENABLED=true` 활성 시). 관측·알람용 보조 노출이며 제품 분석 SoT 는 DB 집계 기반 Statistics API (이원화 정책) | 권장 | ✅ (`BusinessMetricsService` + `MetricsModule` — `clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.llm.tokens`, `clemvion.node.duration`, `clemvion.queue.depth`) |
  ```

---

### [WARNING] `spec/5-system/_product-overview.md` §5 NF-OB-02 — "비즈니스 커스텀 메트릭은 후속" 문구 stale

- **target 위치**: line 70, `NF-OB-02` 상태 셀 끝 부분.
- **위반 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — spec 은 현재 구현 상태의 단일 진실이어야 한다.
- **상세**: NF-OB-02 상태 셀에 "비즈니스 커스텀 메트릭(실행 수·큐 깊이·LLM 사용량)은 본 파이프라인 위 **후속**" 이라는 문구가 남아 있다. 이번 diff 에서 해당 비즈니스 메트릭이 `BusinessMetricsService` + `MetricsModule` 로 구현 완료됐으므로 "후속" 표현은 stale 이며, spec 독자에게 미구현으로 오인하게 한다.
- **제안**: NF-OB-02 상태 셀의 해당 문구를 "→ NF-OB-07 로 구현 완료" 로 교체하거나 제거한다.

---

### [INFO] `spec/5-system/_product-overview.md` — frontmatter 없음 (면제 대상, 정상)

- **target 위치**: 파일 최상위 (frontmatter 없음).
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` 제외 목록 — `spec/<영역>/_*.md` (밑줄 prefix)는 frontmatter 의무에서 제외된다.
- **상세**: `_product-overview.md` 는 `_` prefix 로 면제 대상이므로 frontmatter 부재는 규약 위반이 아니라 설계 의도다.
- **제안**: 변경 불필요.

---

### [INFO] `spec/5-system/_product-overview.md` — `## Rationale` 섹션 부재

- **target 위치**: 파일 전체 (Rationale 섹션 없음).
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장.
- **상세**: 본 파일은 PRD 요구사항 레지스트리 성격으로 Rationale 이 인라인 산문으로 흩어져 있다. `_*.md` 면제 파일이며 다른 NF 항목들과 일관되므로 즉각 수정 의무 없음. NF-OB-07 의 "이원화 정책" 근거(`business-metrics.service.ts` JSDoc 참조)가 spec 에는 없어 코드 주석에만 존재한다.
- **제안**: NF-OB-07 행 추가 시 해당 설계 결정(운영 메트릭 vs DB 집계 Statistics API 이원화)을 §5 하단 산문이나 별도 Rationale 섹션에 한 줄 추가하면 추적성이 개선된다. 강제사항 아님.

---

### [INFO] 명명 규약 — 코드 파일·식별자 이상 없음

- `business-metrics.service.ts` / `BusinessMetricsService`, `metrics.module.ts` / `MetricsModule` — NestJS PascalCase/kebab-case 관례 준수.
- OTel instrument 이름(`clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.llm.tokens`, `clemvion.node.duration`, `clemvion.queue.depth`) — 이번 diff 에서 코드와 (미존재) spec NF-OB-07 서술 사이에 일관성 있음.
- `spec/conventions/audit-actions.md §1` 금지 패턴(hyphens/camelCase) 해당 없음.
- `spec/conventions/error-codes.md §2` rename 금지 — 기존 에러코드 변경 없음.

---

### [INFO] 출력 포맷·API 문서 규약 — 비해당

- `BusinessMetricsService` 는 내부 서비스 계층이라 `spec/conventions/swagger.md §2-5` 응답 wrapping·DTO 명명 패턴 적용 대상이 아니다.
- diff 내 신규 HTTP controller/DTO 없으므로 Swagger 데코레이터 규약 검토 대상 없음.

---

## 요약

`spec/5-system/_product-overview.md` 는 `_` prefix 면제 파일로 frontmatter 의무 가드 대상에서 벗어나 있다. 그러나 이번 구현 diff 가 신규 도입한 `BusinessMetricsService` + `MetricsModule`(NF-OB-07)은 코드 전체에서 `NF-OB-07` ID와 `spec/5-system/_product-overview.md §5` 를 SoT 로 참조하는 반면, 해당 spec §5 테이블에 NF-OB-07 행이 존재하지 않는다. 이는 코드→spec 참조가 dangling 인 CRITICAL 위반이다. 추가로 NF-OB-02 상태 셀의 "비즈니스 커스텀 메트릭은 후속" 문구가 구현 완료 후에도 갱신되지 않아 stale 상태(WARNING)다. 파일 명명·식별자·OTel instrument 이름·Swagger 규약 등 나머지 관점은 이상 없다.

## 위험도

HIGH
