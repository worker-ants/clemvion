# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-followup-cron-7d-statemachine.md`

---

## 발견사항

### [INFO] `cafe24-background-refresh-daily` — scheduler ID historical 보존 명시는 적절하나 표기 불일치 잔존

- target 신규 식별자: 없음 (기존 ID 보존 선언)
- 기존 사용처:
  - `spec/data-flow/5-integration.md` line 137, 141, 144, 215 — `cafe24-background-refresh-daily` 를 scheduler ID (BullMQ repeatable key) 로 4곳 사용
  - `spec/2-navigation/4-integration.md` line 835 — "네 개의 일일 BullMQ 잡 (`Cron: 0 0 * * *` UTC)"
- 상세: target 은 `cafe24-background-refresh-daily` ID 를 historical 보존하고 실제 주기만 6h 로 바꾸겠다고 명시한다. 이 전략은 충돌을 발생시키지 않으며 오히려 orphan 방지를 위한 올바른 선택이다. 그러나 target 이 `spec/data-flow/5-integration.md §1.4 mermaid participant` (line 144) 에서 `cafe24-background-refresh-daily (cron)` → `cafe24-background-refresh (6h cron, ID historical)` 로 표기를 변경하겠다고 기술하는 반면, 같은 파일 line 215 의 Redis 표와 line 141~143 의 다른 세 participant (`connected-expiry-daily` / `pending-install-ttl-daily` / `usage-log-prune-daily`) 는 변경 대상으로 명시되지 않아 문서 내부 불일치가 남을 수 있다.
- 제안: target §A-2 에서 `§1.5 Redis 표 (line 215)` 에 주석 추가 계획이 이미 명시되어 있으므로 단순 누락 가능성이 낮다. 다만 line 141~143 의 mermaid 다른 세 participant 표기와의 일관성(모두 `-daily` suffix 유지)을 명시적으로 언급해 두면 혼선 방지에 도움이 된다. 이 발견은 식별자 충돌이 아닌 문서 내 표기 일관성 보완 제안이다.

---

### [INFO] `INT-ST-02` — 요구사항 문구가 현행 코드와 부분 불일치하며 target 이 보완

- target 신규 식별자: 없음 (기존 ID INT-ST-02 의 문구 갱신)
- 기존 사용처: `spec/4-nodes/4-integration/_product-overview.md` line 48
  - 현재: `매일 00:00(워크스페이스 타임존) 만료 스캐너 Cron 실행 — 임계치 7일/3일/당일에 상태·알림 생성`
- 상세: INT-ST-02 ID 자체는 변경되지 않는다. target 은 이 행의 문구에 Cafe24 6h 분기 정보를 추가한다. ID 충돌 없음. 기존 문구의 "워크스페이스 타임존" 표현은 `spec/2-navigation/4-integration.md §11.1` 의 실제 구현 ("daily 00:00 UTC") 과 이미 불일치하나, 이는 본 spec-followup 작업 이전부터 존재하던 선행 문제이며 target 의 제안 문구("00:00 UTC")로 수정하면 오히려 정합성이 개선된다.
- 제안: 현황 자체는 INFO 수준. target 변경 후 "워크스페이스 타임존" → "00:00 UTC" 로의 수정이 포함되어 있어 기존 불일치가 해소된다. 변경 후 INT-ST-02 의 의미 충돌은 없다.

---

### [INFO] `waiting_for_input → failed` 전이 — 기존 상태머신 표에 없는 신규 전이이며 충돌 없음

- target 신규 식별자: `waiting_for_input → failed` 전이 행 (spec/5-system/4-execution-engine.md §1.1 허용 전이 표에 삽입)
- 기존 사용처: `spec/5-system/4-execution-engine.md` line 30~41
  - 현재 허용 전이 표: `waiting_for_input → running`, `waiting_for_input → cancelled` 두 가지만 존재
  - `waiting_for_input → failed` 전이 행은 현재 표에 없음
- 상세: 신규 전이를 추가하는 것이므로 기존 식별자(상태명·전이 pair)와 충돌하지 않는다. `waiting_for_input` / `failed` 모두 기존 상태 Enum 에 이미 정의되어 있으며 (`spec/1-data-model.md §2.13 Execution.status`, `spec/5-system/4-execution-engine.md §1.1 상태 표`) 동일 의미로 사용된다.
- 제안: 충돌 없음. 신규 행 삽입으로 기존 행의 의미나 식별자가 오염되지 않는다.

---

### [INFO] `spec/0-overview.md §6.2 Cafe24 통합` 항목 — "10일 임계 백그라운드 갱신" 문구 중복 잔존 가능성

- target 신규 식별자: 없음 (기존 문구 갱신)
- 기존 사용처:
  - `spec/0-overview.md` line 90 (corpus 기준) — "10일 임계 백그라운드 갱신" 문구
  - `spec/2-navigation/4-integration.md` Rationale §1.4 (line 1207) — "### `cafe24-background-refresh` 10일 임계 (2026-05-16)"
- 상세: target §A-3 에서 `spec/0-overview.md §6.2` 의 해당 문구를 "7일 임계 + 6h cron 백그라운드 갱신"으로 교체하겠다고 명시한다. target §A-1 에서는 `spec/2-navigation/4-integration.md` Rationale 절 제목도 새 절로 교체("`cafe24-background-refresh` 7일 임계 + 6h cron (2026-05-19 갱신)")하겠다고 명시한다. 두 곳 모두 변경 대상으로 올바르게 식별되어 있다.
- 제안: 충돌 없음. 다만 `spec/0-overview.md §6.2` 의 Cafe24 통합 항목에 링크된 참조 문구(`spec: [Cafe24 노드]... + 10일 임계 백그라운드 갱신` 인라인 표현)도 동일 line 에 존재하며, target 이 이를 변경 대상에 명시하고 있어 누락 위험은 낮다. 완료 후 grep으로 `now - 10d` / `10일 임계` 잔여 참조를 확인하는 것이 side-effect 점검 항목 §의 권장 내용과 일치한다.

---

### [WARNING] `spec/data-flow/5-integration.md §1.4 잡 표` — `now-10d` 잔여 참조가 line 181 외에 line 137 에도 존재

- target 신규 식별자: 없음 (기존 값 갱신)
- 기존 사용처:
  - `spec/data-flow/5-integration.md` line 137 — `last_rotated_at < now-10d` (잡 표 설명 셀)
  - `spec/data-flow/5-integration.md` line 181 — mermaid 쿼리 `now-10d` (target §A-2 에서 변경 대상으로 명시됨)
- 상세: target §A-2 는 line 137 의 잡 표를 변경 대상으로 명시하고 있으나, line 137 의 구체 설명 셀(`14일 - 4일 안전 마진` 텍스트)도 `7일 임계 + 14일의 50% 마진` 으로 교체해야 완전히 정합된다. 이를 빠뜨리면 같은 파일 안에서 두 위치(표 셀 vs mermaid)가 다른 값을 기술하는 일시 불일치가 생긴다. target 의 §A-2 설명에 "after: `last_rotated_at < now-7d` … `14일의 50% 마진 (cron 6h 와 짝)`. scheduler ID 가 historical 보존 명시."라고 적혀 있어 의도는 분명하나, 실제 편집 시 line 137 의 셀 내 안전 마진 문구(`14일 - 4일 안전 마진`)가 교체되지 않으면 충돌이 남는다.
- 제안: target §A-2 대로 변경할 때 line 137 설명 셀 전체(임계값 수치 + 안전 마진 근거 문구 모두)를 함께 교체. 이미 target 이 이를 의도하고 있으므로 편집 범위 확인만 필요.

---

## 요약

target 이 도입하는 신규 식별자는 없다. 이 spec-followup 은 기존 식별자(상태명, scheduler ID, 요구사항 ID, 수치 값)를 갱신·보완하는 작업이므로, 새로운 이름이 기존 의미와 충돌하는 사례는 발견되지 않았다. `waiting_for_input → failed` 전이는 기존 상태 Enum 을 재조합한 신규 전이 행으로 정의 충돌 없이 스펙에 추가될 수 있다. `cafe24-background-refresh-daily` scheduler ID 보존 전략은 BullMQ orphan 위험을 올바르게 회피하는 결정이다. 주의 사항은 `spec/data-flow/5-integration.md` line 137 의 잡 표 설명 셀(임계값 수치 + 안전 마진 문구)이 line 181 mermaid 와 함께 반드시 동시 교체되어야 한다는 점(WARNING), 그리고 mermaid participant 표기 일관성과 `spec/0-overview.md` 잔여 참조에 대한 편집 후 검증(INFO) 이다.

---

## 위험도

LOW
