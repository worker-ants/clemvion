# Cross-Spec 일관성 검토 — `spec/2-navigation/4-integration.md`

검토 모드: `--impl-prep` (구현 착수 전)
구현 대상: `integration-attention-filter` — `attention` 합집합 필터 도입

---

## 발견사항

- **[WARNING]** `status='attention'` 가상 값이 spec §9.1 API 계약과 불일치
  - target 위치: `plan/in-progress/integration-attention-filter.md` §백엔드 — `INTEGRATION_STATUSES` 에 `'attention'` 추가, `GET /api/integrations?status=attention`
  - 충돌 대상: `spec/2-navigation/4-integration.md §9.1` — `GET /api/integrations` 의 `status` 쿼리 파라미터가 `q`, `scope`, `serviceType`, `status` 라고만 서술하며 유효 status 값 목록을 명시하지 않음. 그러나 §2.3 상태 칩 정의(`Connected / Expiring / Expired / Error` 단일 선택)와 §6 상태 전이 다이어그램이 `Integration.status` Enum (`connected / expired / error / pending_install`) 에서 직접 파생된 필터를 전제로 설계되어 있어, 실제 DB 컬럼값이 아닌 가상 집계값(`attention`)을 같은 `status` 파라미터로 수용하는 설계가 spec 어디에도 기술되어 있지 않음.
  - 상세: 기존 필터 칩은 `Connected / Expiring / Expiry / Error` 4종으로 각 값이 `Integration.status` (또는 `token_expires_at`) 와 1:1 대응한다. `attention` 은 복수 status 의 OR 합집합으로 성격이 다르다. 이 두 종류의 값이 동일 `status` 쿼리 파라미터 공간에 혼재할 경우, 다른 클라이언트 또는 외부 연동이 `status=attention` 의 의미를 추론하기 어렵고 Swagger 스키마가 혼란스러워진다.
  - 제안: spec §9.1 의 `GET /api/integrations` 설명을 확장해 `status` 의 유효값 목록과 가상 집계값의 의미를 명시하거나, 별도 쿼리 파라미터(`filter=attention`)로 분리하는 방안을 spec 갱신 단계에서 확정한 뒤 구현해야 함. 현재 계획의 spec 갱신 항목(§65-74)이 이를 포함하도록 보강 필요.

- **[WARNING]** 배너 클릭 동작 정의가 spec §2.4 와 충돌
  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "클릭 시 `updateParam("status", "attention")`"
  - 충돌 대상: `spec/2-navigation/4-integration.md §2.4` — "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환"
  - 상세: 현행 spec §2.4 는 배너 클릭이 세 상태를 **동시에** 활성화하는 멀티 선택 전환(`Expiring | Expired | Error`)이라고 명시한다. 그러나 §2.3 은 상태 칩이 **단일 선택**이라고 정의한다. 이 두 문장은 현재 스펙 내부에서도 이미 모순이다. 구현 계획은 `attention` 단일 가상값으로 이 모순을 해소하는 것인데, spec이 먼저 개정되지 않은 상태에서 구현하면 구현이 spec과 다른 동작을 하게 된다.
  - 제안: 구현 착수 전 spec §2.3 (상태 칩 목록) 과 §2.4 (배너 동작) 을 먼저 개정해 `Attention` 칩 추가 + 배너 클릭 = `?status=attention` 전환으로 일치시킨다. 계획의 "Spec 갱신 (project-planner 위임 예정)" 항목이 이 순서를 지켜야 함.

- **[WARNING]** `Expiring` 상태 칩이 `expiring` 이라는 실제 DB Enum 값을 전제하고 있으나 `Integration.status` Enum에 해당 값 부재
  - target 위치: `spec/2-navigation/4-integration.md §2.3` — 상태 칩 `Expiring (7일 이내)` 및 §11.4 UI 배지 조건 `token_expires_at <= now() + 7d`
  - 충돌 대상: `spec/1-data-model.md §2.10 Integration.status` Enum — `connected / expired / error / pending_install` 4종. `expiring` 값이 없음.
  - 상세: 스펙 §2.3 은 `Expiring` 칩을 서술하지만, 이는 `status='expiring'` DB 값이 아니라 `status='connected' AND token_expires_at <= now() + 7d` 조건의 별칭이다. 구현 계획의 `INTEGRATION_STATUSES` 에 `'expiring'` 이 이미 포함되어 있을 가능성이 있으며, 신규 `attention` 도입 시 동일 가상 필터 패턴이 두 개 생겨 일관성 규약이 필요해진다. 이 쟁점은 신규 `attention` 도입 전에 이미 존재하던 것이나, attention 구현 과정에서 같은 패턴을 재사용하므로 명시적 규약이 spec에 없다는 점이 위험으로 부각된다.
  - 제안: spec §9.1 (또는 §2.3) 에 "가상 필터값" 규약 항목 신설 — `expiring`, `attention` 이 DB Enum 아닌 백엔드 쿼리 빌더 내부 집계 조건임을 명시. 데이터 모델 §2.10 의 status Enum 목록과 API 필터 파라미터의 status 값이 어떻게 다른지 단일 진실 지점에 기술.

- **[INFO]** 분해 카운트 표시 형식이 spec §2.1 ascii diagram 및 §2.4 본문과 동기화 필요
  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "분해 카운트 표시: 통합 N건이 주의가 필요해요 — 만료 X · 만료 임박 Y · 오류 Z"
  - 충돌 대상: `spec/2-navigation/4-integration.md §2.1 ascii diagram` — 배너 문구 `"⚠ 3 integrations need attention  (expiring / error)"`. `pending_install` 제외 근거만 §2.4 에 서술되어 있으며 분해 카운트 포맷 정의 없음.
  - 상세: 구현 계획에서 배너 문구가 상세화되었으나 spec §2.1 ascii 와 §2.4 본문은 갱신 전이다. 실제로 이는 spec 갱신 예정 항목이나, 갱신 전에 구현이 먼저 진행되면 구현과 spec이 불일치하는 기간이 생긴다.
  - 제안: spec 갱신이 구현보다 선행하도록 순서 준수. 계획 체크리스트의 "spec 갱신" 항목이 "developer 구현" 항목보다 앞에 배치되어 있는 것은 적절하나 실제 실행 순서를 지켜야 한다.

- **[INFO]** 단일 건 배너 클릭 시 detail 페이지 직접 점프 — spec §2.4 에 부재
  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "단일 건일 때: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프"
  - 충돌 대상: `spec/2-navigation/4-integration.md §2.4` — 배너 클릭 동작이 "필터 전환" 으로만 기술되어 있고 단일 건 예외 흐름 없음.
  - 상세: 기능상 개선이나, spec §2.4 에 이 동작이 없으므로 구현이 spec 보다 앞서간다. 단일 건이 필터 대신 detail로 점프하는 동작은 `mostUrgentId` 필드를 필요로 하며 이는 새로운 UI 상태 기계를 뜻한다.
  - 제안: spec §2.4 갱신 시 이 분기도 명시적으로 포함. 구현 착수 전 spec 갱신에 포함할 것.

---

## 요약

`integration-attention-filter` 구현은 기존 spec `spec/2-navigation/4-integration.md` 에서 이미 미진한 부분(§2.3 단일 선택 칩 vs. §2.4 멀티 상태 전환 모순)을 해소하려는 올바른 방향이다. 그러나 핵심 API 계약 — `GET /api/integrations?status=` 파라미터에 가상 집계값 `attention` 을 수용하는 것 — 이 spec 어디에도 정의되어 있지 않으며, `Integration.status` DB Enum 과 API 필터 파라미터 값 공간의 의도적 분리 규약도 없다. 구현 전 spec §2.3 / §2.4 / §9.1 을 개정해 가상 필터값 규약을 명시하는 것이 필수다. 모순 항목 두 건(WARNING)은 구현 착수를 막아야 하는 수준이며, spec 갱신(project-planner 위임)이 선행되어야 한다.

---

## 위험도

MEDIUM
