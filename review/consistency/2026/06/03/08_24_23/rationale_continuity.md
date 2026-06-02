# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-system-status-recent-failed.md`
참조 spec:
- `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md`
- `/Volumes/project/private/clemvion/spec/2-navigation/15-system-status.md`

---

## 발견사항

### [WARNING] §2 구현/비용 노트 — "상수 비용" 원칙의 무근거 번복
- **target 위치**: `A. 16-system-status-api.md 변경안 / §2 구현/비용 노트 변경`
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md §2` 본문 — "추가 Redis 비용은 **큐 수에 비례하는 상수** (job 처리량과 무관 — getJobCounts 는 카운터 조회)." 이 문장은 단순 서술이 아니라 API 설계 결정의 근거로 기능하며, Rationale R-2 ("throughput 시계열을 v1 에서 제외")의 전제 중 하나이기도 하다 — 추가 비용 없는 상수 조회라는 점이 v1 범위 설정의 암묵적 근거였다.
- **상세**: target 은 `getFailed()` 스캔 도입으로 "더 이상 상수 비용이 아니라 윈도우 내 실패 수 + 스캔 캡에 비례"로 번복한다. 번복 자체는 정당화 가능하나, 기존 Rationale 에 이 비용 특성이 왜 중요했는지 명시된 항목이 없고 (R-1 ~ R-4 어디에도 없음) target 의 R-5 역시 트레이드오프를 인정하나 "왜 상수 비용을 중요하게 봤는가 / 그 이유가 지금은 해소됐는가" 를 기존 Rationale 항목과 연결해 논증하지 않는다.
- **제안**: R-5 에 "기존 상수 비용 전제가 성립했던 배경(getJobCounts 는 Redis counter 조회, job 목록 스캔 없음)과, 이번 변경에서 그 전제를 포기하는 이유(현재 상태 반영 우선, 스캔 캡으로 상한 보장)" 를 명시적으로 연결하는 한 문장을 추가한다.

### [WARNING] §3 health 파생 규칙 변경 — R-3 워커 미가동 판정과의 연관 언급 누락
- **target 위치**: `A. 16-system-status-api.md 변경안 / §3 health 파생 규칙 변경`
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md §3` 규칙 3 및 Rationale R-3 — health 파생 규칙의 설계 맥락이 R-3 에서 워커 미가동 판정의 한계로 기술되어 있고, 규칙 2(waiting>0 && active===0) + 규칙 3(failed/delayed 임계) 가 한 세트로 정의되어 있다.
- **상세**: target 은 규칙 3만 교체하지만, 규칙 2(워커 미가동 판정)와의 우선순위 관계·상호작용에 대한 언급이 없다. `recentFailed`를 규칙 3에 넣으면 "최근 실패 없음 + waiting 적체" 상황에서의 health 판정이 변화하는지 (규칙 2가 먼저 발화하므로 실제로는 동일) 를 독자가 추론해야 한다. R-3 에 정의된 "단일 스냅샷 휴리스틱" 맥락이 recentFailed 도입 후에도 동일하게 적용된다는 명시가 없다.
- **제안**: target §3 변경 설명 또는 R-5 에 "규칙 1·2 는 변경 없음. 규칙 2의 워커 미가동 판정(R-3)은 recentFailed 와 독립적으로 동작한다" 는 한 줄을 추가해 R-3 와의 연속성을 명시한다.

### [INFO] R-2 "throughput 시계열 v1 제외" 와의 관계 명시 보완
- **target 위치**: `A. 16-system-status-api.md 변경안 / Rationale R-5 (신규)`
- **과거 결정 출처**: `spec/5-system/16-system-status-api.md Rationale R-2` — "throughput 추이는 BullMQ metrics(job hot-path 의 per-job 오버헤드) 또는 샘플링 cron(별도 저장·구성요소)이 필요하다. ... 후속에서 샘플링 cron 을 우선 검토한다."
- **상세**: `recentFailed`는 "최근 N분 내 실패 수"를 getFailed() 스캔으로 구하는 방식이다. R-2 가 throughput 시계열을 v1 제외한 이유(job hot-path 오버헤드 / 별도 저장·구성요소 필요)와 이번 recentFailed 접근법이 어떤 점에서 다른지(별도 저장소 불필요, 스캔 캡 상한 보장)를 한 줄로 대조하면 독자가 R-2 와 충돌하는지 아닌지를 명확히 알 수 있다.
- **제안**: R-5 에 "R-2 의 throughput 시계열(별도 저장·샘플링 구성요소 필요) 과 달리, recentFailed 는 기존 보관 failed 잡 목록의 시각 필터링만으로 별도 저장소 없이 구현 가능하다" 는 1~2문장을 추가하면 완결성이 높아진다.

### [INFO] 15-system-status.md Rationale 보강 — "R-3 류로 추가" 방향 불명확
- **target 위치**: `B. 15-system-status.md (UI) 변경안 / Rationale 보강`
- **과거 결정 출처**: `spec/2-navigation/15-system-status.md Rationale R-1, R-2`
- **상세**: target 은 "R-3 류로 최근 실패가 주 지표인 이유 한 줄 추가 또는 R-1 인근에 노트" 라고 기술하나, 기존 R-1·R-2 는 이미 채번되어 있어 R-3 를 신설하는 것인지 R-1 에 inline 추가하는 것인지 모호하다. Rationale 항 번호 혼용이 발생하면 향후 참조("R-2 에 따르면")가 불명확해질 수 있다.
- **제안**: "R-3 신설 (UI 실패 지표 주/부 분리 이유)" 로 명시적으로 확정하거나, R-1 의 특정 문장에 붙이는 경우 "R-1 마지막에 note 추가" 로 구체화한다.

---

## 요약

target 문서(`spec-draft-system-status-recent-failed.md`)는 기존 spec 에서 명시적으로 기각된 대안을 재도입하거나 핵심 invariant 를 위반하는 CRITICAL 수준의 충돌은 없다. 다만 두 건의 WARNING 이 존재한다. 첫째, `getFailed()` 스캔 도입으로 "상수 비용" 원칙을 번복하면서 기존 Rationale 에 해당 원칙이 왜 중요했는지 설명된 항목이 없고, 신규 R-5 도 그 맥락을 연결하지 않아 번복의 근거가 불완전하다. 둘째, §3 health 파생 규칙 3만 교체하면서 R-3(워커 미가동 판정 휴리스틱)와의 연속성 및 규칙 2와의 상호작용을 명시하지 않아 독자가 추론을 요구받는다. 두 WARNING 모두 R-5 에 문장을 추가하는 수준으로 해소 가능하다. INFO 2건은 완결성 보완 제안이다.

---

## 위험도

LOW
