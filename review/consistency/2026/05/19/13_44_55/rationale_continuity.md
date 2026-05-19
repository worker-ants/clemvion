# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-followup-cron-7d-statemachine.md`
검토 일시: 2026-05-19

---

## 발견사항

### [INFO] A-1. 10일 임계 결정을 7일로 번복 — Rationale 갱신 제안 동반, 형식 적절

- target 위치: plan 문서 §A-1, `spec/2-navigation/4-integration.md` §1.4 Rationale 갱신 계획 (line 53-72)
- 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale — "`cafe24-background-refresh` 10일 임계 (2026-05-16)"
- 상세: 기존 Rationale(2026-05-16)은 "14일 - 4일 안전 마진 = 10일"과 "더 짧게 잡으면 Cafe24 leaky bucket에 불필요한 부담"을 근거로 10일 임계를 채택했다. target plan은 이를 7일(50% 마진 + cron 6h)로 번복한다. plan 문서는 새 Rationale 항목("7일 임계 + 6h cron 근거, 2026-05-19 갱신")을 함께 제시하고 있으며, 옛 결정의 폐기 사유(cron 누락 1회 시 마진 압박)와 검토된 대안(1h cron, 14일 cutoff)을 명시적으로 기재하고 있다. Rationale 연속성 관점에서 요구되는 형식(폐기 사유 + 새 근거 + 대안 검토)을 충족한다.
- 제안: Rationale 항에 "더 짧은 주기 cron의 leaky bucket 부담 우려" 라는 옛 결정의 반론(기존 Rationale의 "더 짧게 잡으면 부담" 항목)이 1h cron 기각 사유로 재활용되고 있다. 6h 주기도 "짧은 cron"의 일종이므로, "6h 는 부담 역치 아래임을 어떻게 판단했는가"에 대한 추가 근거(예: 쿼리 대상 행 수, Cafe24 rate limit 여유)를 한 줄 보완하면 기존 Rationale과의 정합성이 더 명확해진다.

---

### [INFO] A-2. scheduler ID `cafe24-background-refresh-daily` 보존 — 근거 제시 충분, 추가 언급 권장

- target 위치: plan 문서 §A-1 Rationale 초안, §A-2 Redis 표 주석 항 (line 64-65, line 88)
- 과거 결정 출처: `spec/data-flow/5-integration.md` §1.4 표, §2.2 Redis 표 — scheduler ID `cafe24-background-refresh-daily` 로 현행 명세됨
- 상세: 기존 spec에서 scheduler ID는 `cafe24-background-refresh-daily`로 명명되어 있다. target plan은 "BullMQ idempotent upsert 활용 — ID 변경 시 옛 Redis entry가 orphan으로 잔존해 daily/6h가 동시 fire되는 회귀 위험"을 이유로 ID를 보존하기로 했다. 이는 합리적인 operational invariant이며, 기존 Rationale에 이 ID를 변경해야 한다는 결정이 없었으므로 번복이 아니다. 다만 spec 본문에 "historical 보존"이라는 표기를 넣으면 나중에 ID가 `daily`임에도 6h로 동작하는 혼동이 생길 수 있다.
- 제안: `spec/data-flow/5-integration.md` §1.4 표의 Scheduler ID 컬럼 설명에 "ID 보존 배경: orphan entry 회귀 방지 — Rationale 참조"를 명시적으로 연결하거나, §2.2 Redis 표 주석에 근거 링크를 포함하면 미래 독자의 혼동을 줄일 수 있다.

---

### [INFO] B-1. `waiting_for_input → failed` 전이 추가 — 기존 전이 표에 기재되지 않았던 경로, Rationale 신규 작성 형식 적절

- target 위치: plan 문서 §B-1, `spec/5-system/4-execution-engine.md` §1.1 상태 전이 표 및 Rationale 신규 항 (line 104-123)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 "허용되는 상태 전이" 표 (현행 — `waiting_for_input` 종료는 `running` / `cancelled` 두 경로만 명시)
- 상세: 현행 전이 표에 `waiting_for_input → failed` 경로가 존재하지 않는다. target plan은 이 경로를 추가하면서 새 Rationale 항("waiting_for_input → failed 전이 추가, 2026-05-19")에 (a) 운영 보고 배경, (b) 전이 부재 시 frontend 모순 상태, (c) 원자성 보장 방식, (d) WS 이벤트 순서를 함께 제시하고 있다. 기존 전이 표에 이 경로를 "기각"한 명시적 결정이 없으므로 "기각된 대안 재도입"에 해당하지 않으며, "암묵적으로 허용되지 않는 전이로 설계됐다가 새로 허용"하는 형태다. Rationale 작성 형식은 요건을 충족한다.
- 제안: plan의 Rationale 초안에 "원자성 보장 — running ↔ waiting_for_input 전이와 동일하게 NodeExecution.status=FAILED save + WS 이벤트 발사가 단일 트랜잭션"이라 기술되어 있다. 기존 §1.1 본문의 "원자성 보장" 주석(line 43)은 `running ↔ waiting_for_input`만 언급하므로, 새 전이를 추가할 때 이 주석도 "및 `waiting_for_input → failed`" 포함 범위로 함께 확장해야 원자성 guarantees의 일관성이 유지된다. spec 작성 시 누락 방지 체크리스트 항목으로 추가 권장.

---

### [INFO] B-2. `waiting_for_input` 종료를 RUNNING으로만 가정한 기존 invariant — 명시적 가정이 아닌 묵시적 설계

- target 위치: plan 문서 §B-1 Rationale 초안 (line 112: "옛 정책은 `waiting_for_input` 종료를 RUNNING 으로만 가정했다")
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 허용 전이 표 (현행)
- 상세: plan이 "옛 정책은 RUNNING으로만 가정"이라 표현했으나, 현행 spec §1.1 전이 표에는 `waiting_for_input → cancelled`도 이미 허용 경로로 존재한다. 따라서 실제 invariant는 "RUNNING 또는 CANCELLED 두 경로만"이었다. 이 표현의 부정확성이 새 Rationale의 근거 서술을 약화시킬 수 있다.
- 제안: plan Rationale 초안의 해당 문장을 "옛 정책은 `waiting_for_input` 종료를 `running` (재개) 또는 `cancelled` 두 경로로만 정의했다"로 정정하면 기존 spec과 정합하며 Rationale의 신뢰성이 높아진다.

---

## 요약

target 문서(`spec-followup-cron-7d-statemachine.md`)는 두 개의 과거 결정을 번복한다: (A) `cafe24-background-refresh` 임계 10일 → 7일 + cron daily → 6h, (B) `waiting_for_input → failed` 전이 신규 허용. 두 변경 모두 새 Rationale 초안을 함께 제시하며, 폐기 사유와 검토된 대안을 명시하고 있어 Rationale 연속성 요건을 실질적으로 충족한다. 명시적으로 기각된 대안을 이유 없이 재도입하거나, 합의된 invariant를 우회하는 설계는 발견되지 않았다. 다만 세 가지 보완 권장 사항이 있다: (1) 6h cron의 leaky bucket 부담 역치 근거 추가, (2) scheduler ID 보존 배경의 spec 내 명시 연결, (3) `waiting_for_input` 종료 경로 표현 정정 및 원자성 주석 확장 범위. 모두 INFO 수준이며 spec 작성을 차단하는 사항은 없다.

---

## 위험도

LOW
