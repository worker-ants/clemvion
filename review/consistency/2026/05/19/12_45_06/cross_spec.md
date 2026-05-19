# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 구현: Cafe24 background refresh cron 주기 단축 (24h → 6h) + cutoff 마진 격상 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10일 → 7일)
변경 파일:
- `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts`
- `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`

---

## 발견사항

### **[WARNING]** `spec/2-navigation/4-integration.md` §11.1 — `cafe24-background-refresh` 쿼리 조건 및 Rationale 이 10일 기준으로 고정 기술

- **target 위치**: plan `plan/in-progress/cafe24-bg-refresh-tuning.md` §"변경 범위" — `REFRESH_PROACTIVE_THRESHOLD_DAYS` 10 → 7 코드 변경
- **충돌 대상**: `spec/2-navigation/4-integration.md`
  - §11.1 스캐너 잡 표: `last_rotated_at < now-10d OR IS NULL` (line 842)
  - §11.1 본문: `Cron: 0 0 * * *` UTC (line 835) — 4개 잡 모두 일일로 기술
  - Rationale 절 `### cafe24-background-refresh 10일 임계 (2026-05-16)` (line 1207–1222): 10일 임계의 근거(`14일 - 4일 안전 마진 = 10일`)와 일일 잡 결정 문장이 명시
  - line 821: `lastRotatedAt < now - 10d OR IS NULL` 인라인 참조
  - line 1384: 동일 조건 반복
- **상세**: 구현이 `REFRESH_PROACTIVE_THRESHOLD_DAYS`를 7로 바꾸면 실제 스캔 조건은 `last_rotated_at < now-7d`가 되지만, spec 본문은 곳곳에 `now-10d`, `10일 임계`, `14일 - 4일 안전 마진 = 10일`로 고정 기술되어 있다. 구현과 spec 이 diverge되며, spec을 읽는 다음 개발자가 잘못된 수치를 따를 위험이 있다.
- **제안**: 구현 완료 후 `project-planner`를 통해 해당 spec 절을 7일 기준으로 갱신 (`now-7d`, `14일 - 7일 안전 마진`, Rationale 수치 업데이트). plan §후속 항목에 이미 기록되어 있으므로 본 구현 자체는 차단 불필요.

---

### **[WARNING]** `spec/data-flow/5-integration.md` §1.4 — 스케줄 기술 및 쿼리 조건이 모두 일일 + 10일 기준

- **target 위치**: plan — `cafe24-background-refresh` 잡의 cron 패턴을 `'0 */6 * * *'`으로 분리
- **충돌 대상**: `spec/data-flow/5-integration.md`
  - line 130: "네 개의 독립 BullMQ 스케줄러**가 매일 00:00 UTC 에 각자 job 을 enqueue 한다**" — 4개를 동일 주기로 묶어 기술
  - line 137: `cafe24-background-refresh` 행에 `임계 근거: refresh_token 14일 - 4일 안전 마진` (10일 함의)
  - line 144: mermaid 다이어그램 `participant CR as cafe24-background-refresh-daily (cron)` — daily 라는 이름으로 표현
  - line 181: `last_rotated_at < now-10d OR last_rotated_at IS NULL` 쿼리 조건 hard-code
  - line 215: Redis 표에서도 `cafe24-background-refresh-daily` 스케줄러 ID로 기재
- **상세**: data-flow 문서가 4개 스케줄러를 "모두 매일 00:00 UTC" 단일 주기로 묶어 기술하고, mermaid 다이어그램도 동일 `par` 블록 안에 동등 배치한다. 구현이 cafe24 잡만 6h로 분리되면 이 문서의 cron 기술이 부정확해진다. 동시에 `now-10d` 조건도 명시되어 있어 threshold diverge도 포함된다.
- **제안**: 구현 완료 후 `project-planner`를 통해 §1.4 본문, 잡 표, mermaid 다이어그램을 갱신 (매일 → cafe24 잡만 `'0 */6 * * *'`, 쿼리 조건 `now-7d`). plan §후속 항목에 이미 포함. 본 구현 차단 불필요.

---

### **[INFO]** `spec/0-overview.md` §6.2 — "10일 임계 백그라운드 갱신" 문구

- **target 위치**: 상수 변경 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10 → 7)
- **충돌 대상**: `spec/0-overview.md` line 90
  - "BullMQ 기반 cross-pod refresh 직렬화 + **10일 임계 백그라운드 갱신** (refresh_token 14일 만료 전 자동 갱신)"
- **상세**: 아키텍처 개요 문서의 요약 문구에 `10일 임계`가 하드코딩되어 있다. 구현 변경 후 `7일 임계`가 정확한 표현이 된다. 직접 작동 오류를 유발하지는 않으나 신뢰 단일 진실 원칙에 어긋난다.
- **제안**: 구현 완료 후 `project-planner`를 통해 해당 문구를 `7일 임계`로 갱신 (또는 "N일 임계" 추상화). plan §후속 항목에 명시적으로 포함되어 있음.

---

### **[INFO]** `spec/4-nodes/4-integration/_product-overview.md` INT-ST-02 — cron 주기가 일일로 기술

- **target 위치**: `integration-expiry-scanner.service.ts` cafe24 잡 cron 분리 변경
- **충돌 대상**: `spec/4-nodes/4-integration/_product-overview.md` line 48
  - `INT-ST-02`: "매일 00:00(워크스페이스 타임존) 만료 스캐너 Cron 실행 — 임계치 7일/3일/당일에 상태·알림 생성"
- **상세**: 요구사항 ID INT-ST-02가 만료 스캐너를 통틀어 "매일 00:00" 단일 주기로 기술한다. cafe24 잡만 6h로 분리되어도 이 요구사항이 직접 깨지지는 않으나 (다른 3개는 여전히 daily), cafe24 잡의 실제 주기가 spec 요구사항 기술과 달라진다. 다만 INT-ST-02는 만료 알림 스캐너 (connected-expiry) 위주의 요구사항으로, cafe24 background-refresh는 별개 목적의 잡이므로 충돌의 실질 영향은 낮다.
- **제안**: 구현 완료 후 `project-planner`를 통해 INT-ST-02 또는 별도 항목에 cafe24 background-refresh의 6h 주기를 명시하면 정합성이 향상된다. 차단 불필요.

---

### **[INFO]** scheduler ID `'cafe24-background-refresh-daily'` 보존 — 이름과 실제 주기의 의미 불일치

- **target 위치**: `integration-expiry-scanner.service.ts` — scheduler ID를 변경하지 않기로 결정 (BullMQ orphan 회피)
- **충돌 대상**: `spec/data-flow/5-integration.md` line 137 (`cafe24-background-refresh-daily`), line 215 (동일), line 144 mermaid `participant CR as cafe24-background-refresh-daily (cron)`. `spec/2-navigation/4-integration.md` §11.1 본문은 scheduler ID를 명시하지 않아 영향 없음.
- **상세**: scheduler ID `cafe24-background-refresh-daily`의 `-daily` suffix가 6h 주기와 의미가 어긋난다. 코드 주석으로 실제 주기를 명시하는 결정(plan §결정 사항)은 타당하나, spec 문서가 동일 ID를 "daily" 주기의 스케줄러로 기재하면 독자 혼란이 생긴다.
- **제안**: 구현 완료 후 `project-planner`가 spec 갱신 시 해당 ID에 "historical 이름, 실제 주기 6h" 주석을 inline으로 추가. 차단 불필요.

---

## 충돌하지 않는 영역 (확인 완료)

- **데이터 모델 충돌 없음**: `Integration` 엔티티 컬럼 정의(`last_rotated_at`, `status`, `service_type`)는 변경되지 않는다. threshold 변경은 쿼리 조건의 수치이며 스키마 변경 없음.
- **API 계약 충돌 없음**: 변경 대상 파일은 모두 backend internal scheduler/constant이며, REST API endpoint·request/response shape에 영향 없음.
- **요구사항 ID 충돌 없음**: 신규 요구사항 ID를 부여하지 않는다.
- **상태 전이 충돌 없음**: `connected → error(auth_failed)` 등 Integration 상태 머신은 변경되지 않는다.
- **권한·RBAC 충돌 없음**: 권한 구조 변경 없음.
- **계층 책임 충돌 없음**: 변경은 `integrations` 모듈 내부이며, 기존 `IntegrationExpiryScanner` + `Cafe24TokenRefreshProcessor` 분리 구조를 유지한다. `cafe24-token-refresh` 큐 enqueuer/worker 분리도 그대로다.
- **BullMQ upsert 동작 확인**: scheduler ID 보존으로 BullMQ `upsertJobScheduler`가 기존 `cafe24-background-refresh-daily` 항목을 갱신(새 `pattern`으로 덮어씀)한다. orphan 잔류 위험 없음. 이 결정은 `spec/data-flow/5-integration.md` §1.4의 "마이그레이션: 옛 단일 `integration-expiry-daily` 스케줄러는 `removeJobScheduler`로 제거" 패턴과 일관된다(ID가 바뀌지 않으므로 별도 remove 불필요).

---

## 요약

본 구현(cron 주기 6h 분리 + cutoff 7일 격상)은 기존 spec과 직접 작동이 불가능한 모순을 일으키지 않는다. `REFRESH_PROACTIVE_THRESHOLD_DAYS` 및 cron 패턴은 codebase 내부 상수로, API 계약·데이터 모델·상태 전이·RBAC에 영향을 주지 않기 때문이다. 다만 `spec/2-navigation/4-integration.md` §11.1·Rationale, `spec/data-flow/5-integration.md` §1.4, `spec/0-overview.md` §6.2 등 세 문서에 걸쳐 `10일 임계`·`일일 cron` 수치가 hard-code되어 있어, 구현 완료 후 해당 spec 갱신이 필요하다. 이 갱신 작업은 plan의 §후속 항목에 이미 명시(project-planner 위임)되어 있으므로 현재 구현 착수는 차단되지 않는다.

---

## 위험도

LOW

STATUS: OK
