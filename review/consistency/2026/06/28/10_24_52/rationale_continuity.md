# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/16-system-status-api.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-28

---

## 발견사항

### 요약

target 문서(`spec/5-system/16-system-status-api.md`)는 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의 원칙을 우회하는 설계를 포함하지 않는다. 주요 변경 사항인 `recentFailed` 도입 및 health 규칙 3의 비교 대상 전환은 R-5 에서 충분한 Rationale 과 트레이드오프를 함께 명시했으며, 기존 R-2(throughput 시계열 v1 제외)·R-3(heartbeat 불필요)·R-4(어휘 분리) 결정과도 정합하다. "상수 비용 전제 포기" 역시 R-5 에서 과거 관찰이 원칙이 아니었음을 명시하고 스캔 캡으로 상한을 보장하는 방식으로 연속성을 유지했다. Rationale 연속성 관점에서 차단 수준의 문제는 발견되지 않았으나, 두 가지 보완 제안 사항이 있다.

---

- **[INFO]** `SYSTEM_STATUS_FAILED_THRESHOLD` 의미 변경 — 기존 Rationale 갱신 미작성
  - target 위치: `spec/5-system/16-system-status-api.md` §3 "의미 변경 주의" 항 및 R-5
  - 과거 결정 출처: 동 문서 이전 버전의 암묵적 Rationale — 규칙 3 비교 대상이 "보관 중 누적 `failed`" 로 설계됐던 원래 결정
  - 상세: §3 은 `SYSTEM_STATUS_FAILED_THRESHOLD` 비교 대상이 "보관 중 누적 `failed`" 에서 `recentFailed` 로 바뀜을 본문에 "의미 변경 주의" 로 명시한다. R-5 의 "health 를 윈도우로 옮긴 이유" 항이 이 번복의 근거를 기술하고 있어 Rationale 형식 요건을 대부분 충족한다. 다만 R-5 는 `recentFailed` 도입 전체를 다루는 복합 항이라, "왜 기존 `failed` 기반 규칙이 오탐을 냈는가" 와 "왜 이번에 번복하는가" 가 인라인 설명에 녹아 있어 별도 항 제목으로 분리되지 않았다. 향후 해당 spec 을 처음 읽는 독자가 threshold 의미 변경의 의도를 R-5 전체에서 파악해야 해 가독성이 다소 저하될 수 있다.
  - 제안: R-5 내에 `SYSTEM_STATUS_FAILED_THRESHOLD 의 비교 대상 전환` 같은 소항목을 추가하거나 §3 의 "의미 변경 주의" 주석에서 R-5 세부 항목을 직접 인용해 연결 고리를 명시하면 연속성 추적이 개선된다. 현재도 정보가 R-5 에 존재하므로 비차단.

- **[INFO]** `recentFailed` 스캔 비용 상한 보장 전제 — 기각된 "상수 비용" 원칙의 명시적 철회 완료, 추가 보완 없음
  - target 위치: `spec/5-system/16-system-status-api.md` §2 비용 설명, R-5 "상수 비용 전제 포기 (연속성)" 항
  - 과거 결정 출처: 동 문서 이전 버전의 "큐당 상수 비용" 구현 관찰 (R-5 에서 "설계 원칙이 아니라 구현 관찰" 임을 명시하며 철회)
  - 상세: R-5 는 "상수 비용 전제 포기" 를 명시하고, 스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP`)으로 비용 상한을 보장한다고 기술한다. 이 철회는 Rationale 연속성 요건을 충족한다. 단, 스캔 캡이 비용 상한을 보장하는 전제는 "윈도우 내 실패 수 + 캡" 에 비례한다는 것이므로, 캡을 환경 변수로 조정할 때 Redis 메모리·응답 지연 영향이 커질 수 있다는 운영 주의 사항이 R-5 에 부재하다. R-2 의 "throughput 추이는 별도 저장소·비용이 필요" 기각 근거와 비교할 때, 이번 `getFailed()` 스캔도 캡 설정에 따라 상당한 비용이 발생할 수 있음을 인지할 항목이 있으면 좋다.
  - 제안: R-5 에 "캡 값이 클수록 getFailed 스캔 비용·Redis memory 영향이 커지므로 운영 환경에서 캡 재조정 시 Redis 운용 여유를 확인한다" 류의 한 줄 트레이드오프 메모 추가를 권장한다. 현재도 캡 환경 변수 자체가 §3 에 명시돼 있으므로 비차단.

---

## 요약

`spec/5-system/16-system-status-api.md` 는 Rationale 연속성 관점에서 전반적으로 건전하다. `recentFailed` 도입·health 규칙 3 변경·상수 비용 전제 철회 모두 R-5 에서 명시적으로 근거와 트레이드오프를 기술했으며, 기존 R-1(개별 job 미노출)·R-2(throughput 시계열 제외)·R-3(heartbeat 범위 외)·R-4(어휘 3단계) 결정과 충돌하지 않는다. auth spec(§1-auth.md §13.5)·API 컨벤션(§2.3) 과의 정합도 확인됐다. 발견된 두 항목은 모두 INFO 수준으로, Rationale 가독성·운영 주의 보강 제안에 해당하며 설계 차단 요인은 없다.

## 위험도

NONE
