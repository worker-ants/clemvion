# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
변경 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

### [INFO] `integration_action_required` 알림을 §11.2 에서 언급하나 Rationale 항목 미신설
- **target 위치**: `spec/2-navigation/4-integration.md` §11 및 `connected-expiry` 잡 표, §11.2
- **과거 결정 출처**: 같은 파일 `## Rationale` → "알림 정책 (§11.2)" 항 — `integration_expired` 는 `token_expired` 경로에만 발사하며, `error(*)` 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토라고 명시.
- **상세**: 이번 diff 는 `error(auth_failed)` 전이 시 `integration_action_required` 알림을 발사하는 것으로 §11.2 표를 이미 완성된 상태로 정의하고 있다(`spec/2-navigation/4-integration.md` §999-1013). 그런데 Rationale "알림 정책 (§11.2)" 는 여전히 "향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토" 라는 미결 표기를 유지하고 있어, 실제 결정(신설 확정)과 Rationale 문구(미결 검토) 가 어긋난다. 기각·번복 충돌이 아니라 Rationale 추적이 완결되지 않은 상태.
- **제안**: Rationale "알림 정책 (§11.2)" 항의 마지막 문장을 "`integration_action_required` 를 refresh 실패(`auth_failed`/`insufficient_scope`/`network`) 전이 시 발사하도록 결정·구현했다 — §11.2 표 참고." 로 갱신하거나, 별도 Rationale 소항 "refresh-capable provider 알림 신설" 를 추가한다.

---

### [INFO] `connected-expiry` 잡의 `remain ≤ 3d / ≤ 7d` 분기가 refresh-capable provider 에 적용되지 않는다는 Rationale 보완 필요
- **target 위치**: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 잡 표, 의사코드
- **과거 결정 출처**: 같은 파일 `## Rationale` → "자동 갱신 통합을 attention 술어에서 제외" 항 — `autoRefresh=true` 통합을 만료 임박 분기에서 제외.
- **상세**: 의사코드 및 표에서 `remain ≤ 3d` / `≤ 7d` 의 알림 분기는 refresh_token 없는 provider 에만 적용된다고 명시하고 있다. 이 결정은 기존 Rationale "자동 갱신 통합을 attention 술어에서 제외" 의 연장선이지만, 해당 Rationale 항은 `autoRefresh` 개념을 기준으로 설명하는 반면 새 로직은 `isRefreshCapable`(`refresh_token 보유 여부`) 를 조건으로 한다. 두 개념이 대체로 겹치지만 정확히 동치인지(예: google 은 `autoRefresh=true` 이지만 `isRefreshCapable` 기준 적용 여부) 에 대한 설명이 없다. 기각·번복은 아니나 Rationale 에 개념 경계 보완이 있으면 향후 구현자 혼동을 막는다.
- **제안**: Rationale "자동 갱신 통합을 attention 술어에서 제외" 항 또는 새 "refresh-capable provider 와 autoRefresh 개념 관계" 소항에서 `isRefreshCapable`(스캐너 로직용) 과 `autoRefresh`(UI 술어·DTO 용) 의 차이 및 적용 범위를 1~2문장으로 명시한다.

---

## 요약

이번 diff 의 핵심은 `connected-expiry` 스캐너 잡에 `isRefreshCapable` 판별 계층을 추가해 cafe24·makeshop 을 `expired` 격하·passive 알림 대상에서 제외하고, makeshop 을 refresh-capable provider 로 명시 편입한 것이다. 기존 Rationale 에서 명시적으로 기각된 대안의 재도입이나 합의된 설계 원칙 위반은 발견되지 않았다. `자동 갱신 통합을 attention 술어에서 제외` 결정의 연장선으로 스캐너 로직에 동일 원칙을 적용했으며, `refresh 실패 시 error(auth_failed)` 채택 결정과도 정합한다. 다만 `integration_action_required` 알림이 "향후 신설 검토" 미결 상태로 Rationale 에 남아있으면서 §11.2 에서는 이미 완성된 계약으로 정의되어 있어 Rationale 추적이 완결되지 않은 INFO 수준 항목이 2건 존재한다. 결정 번복이나 invariant 위반 없음.

## 위험도

LOW
