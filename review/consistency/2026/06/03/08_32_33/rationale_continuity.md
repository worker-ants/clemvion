# Rationale 연속성 검토 결과

검토 모드: spec draft (--spec)
Target: `plan/in-progress/spec-draft-system-status-recent-failed.md`
관련 spec:
- `/Volumes/project/private/clemvion/.claude/worktrees/system-status-recent-failed-86831b/spec/5-system/16-system-status-api.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/system-status-recent-failed-86831b/spec/2-navigation/15-system-status.md`

---

## 발견사항

- **[WARNING]** `상수 비용` 원칙 번복 — 새 Rationale 작성됨, 그러나 원본 본문 문장과의 대조 명시 필요
  - target 위치: §A §2 구현/비용 노트 변경 및 R-5 "상수 비용 전제 포기 근거(연속성)"
  - 과거 결정 출처: `spec/5-system/16-system-status-api.md §2` 구현 노트 — "추가 Redis 비용은 **큐 수에 비례하는 상수** (job 처리량과 무관 — getJobCounts 는 카운터 조회)."
  - 상세: 기존 본문에 명시된 "상수 비용" 원칙은 API spec §2 에 사실적 기술로 박혀 있다. target 이 이를 삭제하고 비상수 비용 모델로 전환하는 것은 의도된 번복이며 R-5 에 근거를 작성했다. 그러나 R-5 의 "연속성" 항목은 "기존 구현 노트(§2)가 상수성을 이점으로 들었다" 고만 서술하고, **spec 어느 버전에서 그 결정이 이루어졌는지**(최초 v1 spec 시 명시적으로 상수성이 설계 원칙으로 채택됐는지, 아니면 단순 구현 사실 기술이었는지)를 Rationale 원항(R-? 형태)으로 참조하지 않는다. R-4 수준의 결정 근거로 명문화되어 있지 않던 관계로 엄밀히 "기각된 대안"의 재도입은 아니지만, 설계 원칙이 변경되는 것이므로 R-5 에 "기존 본문의 상수 비용 표현은 설계 원칙이 아닌 구현 관찰이었으며, 이번 개정에서 비상수 비용이 수반되는 `getFailed()` 스캔을 도입해 그 표현을 명시적으로 폐기한다"는 문장을 한 줄 추가하면 연속성이 완성된다.
  - 제안: R-5 "상수 비용 전제 포기 근거(연속성)" 항에 "기존 §2의 상수 비용 문장은 설계 원칙이 아닌 구현 관찰이었음을 명시하고, 이번 개정으로 해당 문장을 삭제·대체함을 Rationale에 추가한다."

- **[INFO]** health 판정 기준 변경 — 운영자 경고는 있으나 Rationale 에 대안 검토 내역 부재
  - target 위치: §A §3 health 파생 규칙 변경, R-5 마지막 항 "health 를 윈도우로 옮긴 이유"
  - 과거 결정 출처: `spec/5-system/16-system-status-api.md §3` — "3. `failed >= FAILED_DEGRADED_THRESHOLD` 또는 `delayed >= DELAYED_DEGRADED_THRESHOLD` → degraded"
  - 상세: 기존 규칙 3 의 `failed` 는 `getJobCounts('failed')` 즉 "보관 중 누적 실패 수"를 비교했다. target 은 이를 `recentFailed`(최근 윈도우)로 바꾸면서 운영자에게 설정값 재검토를 요청하는 의미 변경 주의 노트를 §3에 추가했다. R-5 에 "오탐 제거"라는 근거가 있다. 다만 R-5는 "영구 degraded → 오탐" 을 문제점으로 들면서도 "그러면 실제 의미 있는 누적 실패가 많은 큐에서 degraded 가 사라질 수 있다"는 트레이드오프(누락 신호 위험)를 명시하지 않는다. 이 결정은 번복 자체는 근거가 있으나 트레이드오프 기록이 불완전하다.
  - 제안: R-5 의 "health 를 윈도우로 옮긴 이유" 항에 "보관 중 누적 실패가 많은 큐에서 모든 실패가 윈도우 밖으로 벗어나면 degraded 신호가 자동 소멸할 수 있다는 트레이드오프를 인지하고 채택했다"는 한 줄을 추가하면 Rationale 정합이 완성된다.

- **[INFO]** R-2 (throughput 시계열 v1 제외) 와의 관계 — target 에서 자체 설명했으나 충분
  - target 위치: §A R-5 "R-2(throughput 시계열 v1 제외)와의 대조"
  - 과거 결정 출처: `spec/5-system/16-system-status-api.md ## Rationale R-2`
  - 상세: R-5 가 R-2 와의 비모순성을 명시적으로 설명하고 있다. "시계열이 아닌 단일 윈도우 스냅샷"이라는 구별로 R-2 의 "샘플링 cron·별도 저장소 필요" 전제와 충돌하지 않음을 논리적으로 연결했다. 이 부분은 Rationale 연속성이 양호하다. 추가 조치 불필요.

- **[INFO]** UI spec R-3 가 API spec R-5 를 참조 링크로만 위임
  - target 위치: §B Rationale R-3 마지막 줄 "산정 방식·비용·health 연동 근거는 [API spec R-5] 참조"
  - 과거 결정 출처: `spec/2-navigation/15-system-status.md ## Rationale`
  - 상세: 기존 UI spec 의 Rationale(R-1, R-2)는 UI 특유의 결정 근거를 자급자족으로 기술하고 API spec 을 cross-ref 하는 방식이다. 신규 R-3 가 산정·비용·health 근거를 API spec R-5 로 위임하는 구조는 동일 패턴을 따르므로 연속성 위반이 아니다. 문제 없음.

---

## 요약

target spec draft 는 기존 `spec/5-system/16-system-status-api.md` 의 Rationale(R-1~R-4)에서 명시적으로 기각된 대안을 재도입하지 않는다. 핵심 변경인 "상수 비용 원칙 폐기"와 "health 판정 기준 이동"은 모두 신규 Rationale(R-5)을 작성해 근거를 제공했고, R-2(throughput 시계열 v1 제외)와의 비모순성도 명시적으로 서술했다. 다만 상수 비용 문장이 기존 spec 에서 설계 원칙 수준의 Rationale 항목으로 채택된 것인지 단순 구현 관찰인지를 R-5 에서 명확히 구별하지 않아 향후 독자가 번복 경위를 오해할 여지가 있으며, health 기준 변경의 트레이드오프(누락 신호 위험)가 Rationale 에 기록되지 않았다. 두 항목 모두 CRITICAL 수준은 아니며 R-5 문장 보완으로 해소 가능한 WARNING/INFO 수준이다.

---

## 위험도

LOW
