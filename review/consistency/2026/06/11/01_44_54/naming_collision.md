# 신규 식별자 충돌 검토 결과

검토 대상: `spec/2-navigation/4-integration.md` (diff vs `origin/main`)
검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] `isRefreshCapable` — 코드베이스의 `isCafe24RefreshCapable` 과 명칭 불일치

- **target 신규 식별자**: `isRefreshCapable` (§11.1 의사코드 및 §Rationale 텍스트에 도입)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts:515` — 현재 구현 함수명은 `isCafe24RefreshCapable`
- **상세**: spec target 은 "만료 스캐너의 refresh-capable 판별 함수를 `isRefreshCapable` 로 지칭"하는 반면, 실제 구현은 `isCafe24RefreshCapable` 이라는 Cafe24-전용 이름으로 남아 있다. spec 이 `isRefreshCapable` 을 service-agnostic 개념으로 일반화한 것이므로 의미 충돌은 아니지만, 구현 이름이 spec 이름과 다르다. `spec-coverage` 리뷰 산출물(`/Volumes/project/private/clemvion/review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md:15`)도 동일 이름 변경을 권고했다.
- **제안**: 구현 함수를 `isCafe24RefreshCapable` → `isRefreshCapable` 로 rename 하거나, spec 에 "현재 구현명은 `isCafe24RefreshCapable`" 주석을 추가해 추적성을 명시.

---

### [WARNING] `unknown_error` vs `unknown` — §5.4 DB 연결 테스트 에러코드와 데이터 모델 간 불일치

- **target 신규 식별자**: `unknown_error` — §5.4 Database 연결 테스트 에러코드 정규화 목록에 `unknown` 대신 `unknown_error` 로 교체 (`spec/2-navigation/4-integration.md:488`)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/1-data-model.md:293` — `status_reason` 허용값 목록에서 `error` 상태의 fallback 을 여전히 `unknown` (현행)으로 기재
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.service.ts:880,898` — `error.code ?? 'unknown'` 패턴이 usage log / `last_error.code` fallback 에 `'unknown'` 문자열 사용
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.service.spec.ts:1891` — 테스트 픽스처에서 `'unknown'` 사용
- **상세**: `integration-status-reason.ts:34` 의 `INTEGRATION_STATUS_REASONS` union 은 `unknown_error` 를 올바르게 포함한다. 따라서 spec §5.4 의 변경은 union SoT 와 정합하는 방향이다. 그러나 `spec/1-data-model.md §2.10` 의 `status_reason` 허용값 설명은 `unknown` (현행) 으로 남아 있어 spec 내부 모순이 생긴다. 또한 `integrations.service.ts` 의 fallback (`'unknown'`) 은 아직 `unknown_error` 로 갱신되지 않아, 두 값이 동시에 DB 에 저장될 수 있는 상태다.
- **제안**:
  1. `spec/1-data-model.md §2.10` 의 `unknown` 표기를 `unknown_error` 로 갱신해 spec 내 단일 진실 확보.
  2. `integrations.service.ts:880,898` 의 `'unknown'` fallback 을 `'unknown_error'` 로 교체.
  3. `integrations.service.spec.ts:1891` 테스트 픽스처 동일 교체.

---

### [INFO] `integration_action_required` 알림 타입 — 기존 정의 재확인

- **target 신규 식별자**: `integration_action_required` 를 "active 알림"으로 명시적 분리하며 `error(*)` 전이 시 발사 계약으로 확정
- **기존 사용처**: 이미 `spec/1-data-model.md:679`, `spec/2-navigation/_layout.md:114`, `spec/2-navigation/4-integration.md §11.2`, `spec/data-flow/8-notifications.md:71`, 코드베이스 다수 파일에 동일 의미로 정의되어 있음
- **상세**: 충돌 없음. target 이 이 타입을 새로 생성하는 것이 아니라 기존 정의에 passive/active 분리 원칙을 명문화하고 "신설 검토" 상태에서 "결정·구현 완료"로 격상한 것이다.
- **제안**: 없음.

---

### [INFO] `token_expired` as `status_reason` 값 — 충돌 없음

- **target 신규 식별자**: `status_reason='token_expired'` 를 `expired` 전이의 유일한 passive 알림 발사 경로로 명시
- **기존 사용처**: `spec/1-data-model.md:293` 에 `expired → token_expired` 로 이미 정의됨
- **상세**: 충돌 없음. 기존 값의 의미를 강화한 것.
- **제안**: 없음.

---

## 요약

target 이 도입하는 주요 신규 식별자 2종 중 실질적 충돌이 있는 항목은 없으나, 두 개의 정합 갭이 존재한다. 첫째, spec 의 `isRefreshCapable` 이라는 개념명이 코드베이스의 `isCafe24RefreshCapable` 함수명과 불일치한다 — 의미 충돌이 아닌 추적성 문제이며, 구현 rename 또는 spec 주석 추가로 해소 가능하다. 둘째, §5.4 의 `unknown_error` 교체가 `spec/1-data-model.md` 및 `integrations.service.ts` fallback 에 반영되지 않아 spec 내부 모순과 DB 에 두 값이 혼재할 위험이 있다 — 이는 향후 `status_reason` 집계·필터 쿼리에서 silent miss 를 유발할 수 있어 빠른 후속 정합이 필요하다.

## 위험도

MEDIUM
