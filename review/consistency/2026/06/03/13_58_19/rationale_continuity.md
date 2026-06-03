# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/)
검토 대상: spec/0-overview.md, spec/1-data-model.md, spec/2-navigation/0-dashboard.md, spec/2-navigation/1-workflow-list.md
기준 커밋: e133f2dc (전수 코드정합성 동기화)

---

## 발견사항

- **[WARNING]** Flyway rollback 정책 변경 — 기각 근거 Rationale 미기록
  - target 위치: `spec/0-overview.md §2.8` 롤백 정책 행 및 실행 방식 행
  - 과거 결정 출처: `spec/0-overview.md ## Rationale` § "DB 마이그레이션 도구로 Flyway 채택 (§2.8)"
  - 상세: 기존 spec §2.8 에는 "롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`)" 과 "환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`)" 가 채택된 방식으로 기록되어 있었다. 이번 업데이트에서 두 항목 모두 번복됐다 — 롤백은 forward-only + `-- DOWN:` 주석으로, 환경 분리는 "환경별 `flyway-{env}.conf` 분리 파일은 쓰지 않는다"로 변경됐다. `codebase/backend/migrations/README.md §2` 와 실제 코드가 forward-only 를 명시하고 있어 변경 자체는 코드 정합성 회복으로 타당하다. 그러나 기존 Rationale 항목("DB 마이그레이션 도구로 Flyway 채택")은 _prisma-migrate 대비 Flyway 선택 이유_ 만 기록하고 있을 뿐, 롤백 방식(undo 스크립트 vs forward-only + DOWN 주석)과 환경 설정 분리 방식(flyway-{env}.conf vs CLI 인자 주입)에 대한 결정은 기록하지 않는다. 번복 후 두 결정의 근거와 기각 이유가 Rationale 에 전혀 없다.
  - 제안: `spec/0-overview.md ## Rationale` 의 "DB 마이그레이션 도구로 Flyway 채택" 항 또는 별도 하위 항목으로 (1) forward-only 정책을 채택한 이유 (예: Flyway Community edition 에서 undo 파일이 유료 기능 / append-only 원칙과의 일관성), (2) 환경별 conf 분리 대신 CLI 인자 주입을 채택한 이유 (예: Docker 이미지 단일화, secret 주입 통일)를 명시적으로 추가한다.

- **[WARNING]** Dashboard 성공률 계산 공식 변경 — Rationale 섹션 부재 + 변경 근거 미기록
  - target 위치: `spec/2-navigation/0-dashboard.md §3` 요약 카드 테이블 Success Rate 행
  - 과거 결정 출처: 기존 동일 spec 의 Success Rate 정의 ("completed / (completed + failed) × 100")
  - 상세: 기존 공식은 `completed / (completed + failed) × 100` 이었으나 새 공식은 `completed / (최근 7일 전체 실행 건수) × 100` (분모에 running·pending·cancelled 포함)으로 변경됐다. 실제 백엔드 구현(`dashboard.service.ts:104-107`)이 `successCount / runs7dResult` (전체 건수 분모) 로 동작하고 있으므로 코드 정합성 회복이다. 그러나 dashboard spec 에는 `## Rationale` 섹션 자체가 없고, 이 공식 변경에 대한 어떤 설명도 없다. 두 공식의 의미 차이는 크다 — 구 공식은 "결정된 실행의 성공 비율"이고 신 공식은 "전체 실행 중 완료 비율"이다.
  - 제안: `spec/2-navigation/0-dashboard.md` 에 `## Rationale` 섹션을 신설하고, 분모를 `completed + failed` 에서 전체 실행 건수로 바꾼 이유(코드 일치, 의미적 선택의 근거)를 기록한다.

- **[INFO]** Dashboard 요약 카드 구성 변경 — 변경 의도 명시 부재
  - target 위치: `spec/2-navigation/0-dashboard.md §3` 요약 카드 테이블 및 목업
  - 과거 결정 출처: 기존 동일 spec §3 ("Total WF | Runs(7d) | Success | Avg Time" 4카드 구성, Total WF 카드에 Active/Inactive 구분 내장)
  - 상세: 기존 스펙은 "Total WF (Active/Inactive 포함)" + "Runs(7d)" + "Success Rate" + "Avg Time (초 단위)" 로 4카드를 구성했다. 새 스펙은 "Total Workflows" + "Active" + "Runs(7d)" + "Success Rate" 로 재구성하고 `avgExecutionTime` 은 카드에서 제거해 API 응답에만 포함된다. 단위도 초(4.3s) → 밀리초(4300ms)로 변경됐다. 이 변경들은 실제 `DashboardSummaryDto` 와 `page.tsx` 구현을 반영한 코드 정합성 회복이므로 Rationale 위반은 아니나, 어떤 spec 판단으로 Avg Time 카드를 제거했는지가 기록되지 않았다. 의도적 제거인지 미구현 표시인지가 `## Rationale` 없이 불분명하다.
  - 제안: `## Rationale` 신설 시 Avg Time 카드 미노출 결정(§3 note "현재 요약 카드로는 노출하지 않는다" 이유)도 함께 기록해 의도를 명확히 한다.

- **[INFO]** `spec/1-data-model.md §2.13 chain_id` NULLABLE 변경 — 올바르게 cross-reference 처리됨
  - target 위치: `spec/1-data-model.md §2.13 Execution.chain_id`
  - 과거 결정 출처: 기존 동일 spec 의 `chain_id UUID NOT NULL. 원본 자기참조` 정의
  - 상세: 기존 데이터 모델은 `chain_id UUID NOT NULL` (원본은 `chain_id = id` 자기참조)를 명시했으나, 신규 정의는 `chain_id UUID? NULLABLE`로 변경하고 `spec/5-system/13-replay-rerun.md §9.1`(decision F2, 2026-05-31)을 참조한다. 해당 spec 에는 "초기 spec 은 `chain_id NOT NULL` + 원본 자기참조였으나, 복수 INSERT 경로 회귀 위험으로 NULLABLE 로 채택"이라는 명시적 Rationale 기록이 있다. 따라서 Rationale 연속성은 유지됨. 참고 정보로 기록.
  - 제안: 추가 조치 불필요.

---

## 요약

이번 `e133f2dc` 커밋(전수 코드정합성 동기화)은 대부분 구현 현실에 맞게 spec 을 보정한 것으로, 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목은 발견되지 않았다. 다만 두 건의 WARNING 이 존재한다. 첫째, `spec/0-overview.md §2.8` 의 Flyway rollback 정책(forward-only)과 환경 설정 방식(CLI 인자 주입) 변경이 기존 Rationale 항목에서 다루지 않은 결정을 번복하면서 새 Rationale 를 함께 작성하지 않았다. 둘째, `spec/2-navigation/0-dashboard.md §3` 의 성공률 공식이 `completed/(completed+failed)` 에서 `completed/전체` 로 의미 있게 변경됐으나 Rationale 섹션 자체가 없고 변경 근거가 기록되지 않았다. 두 건 모두 코드 현실에 맞춘 spec 정합화이므로 설계 원칙을 위반하지는 않지만, Rationale 기록이 없으면 미래 독자가 해당 결정의 근거를 파악할 수 없다.

---

## 위험도

LOW

STATUS: SUCCESS
