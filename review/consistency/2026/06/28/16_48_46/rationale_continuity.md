# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 범위: autoRefresh attention 술어 제외 구현 (frontend `needsAttention` 가드 + backend `findAll` expiring/attention 쿼리에 `supportsTokenAutoRefresh` service_type 제외) + subLabel 'next in' 문구 spec §4.1 정합
Target 문서: (없음 — 구현 착수 전)

---

## 발견사항

- **[WARNING]** backend `findAll` 쿼리에서 service_type 하드코딩 위험 — Rationale "왜 derived 필드인가" 위반 가능성
  - target 위치: 구현 범위 설명 "backend findAll expiring/attention 쿼리에 supportsTokenAutoRefresh service_type 제외"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` § Rationale "자동 갱신 통합을 attention 술어에서 제외" — **왜 derived 필드인가** 항
  - 상세: Rationale 는 "옛 attention 술어 SQL 에 `service_type IN ('cafe24', 'google')` 같은 하드코딩을 두는 안도 검토했으나 (a) 신규 OAuth provider 추가 시마다 SQL 술어를 손대야 하고, (b) 의도가 SQL 에 묻혀 사라지므로 derived 플래그를 한 단계 거치게 했다" 고 명시하고 기각했다. 구현 범위의 "supportsTokenAutoRefresh service_type 제외" 라는 표현이 SQL WHERE 절에 `i.service_type IN ('cafe24', 'google', 'makeshop')` 같은 static 하드코딩으로 구현될 경우 이 결정과 직접 충돌한다. 현재 코드(`integrations.service.ts` lines 493-514)의 `expiring`/`attention` 쿼리 빌더에는 autoRefresh 제외 로직이 전혀 없으므로 구현 방식이 결정되지 않은 상태다.
  - 제안: backend 구현은 service registry(`findAllServices()` 또는 `getAllServiceTypes()` 유틸)에서 `supportsTokenAutoRefresh === true` 인 serviceType 목록을 동적으로 수집한 뒤 `i.service_type NOT IN (:...autoRefreshTypes)` 파라미터 바인딩으로 주입해야 한다. `service-registry.ts` 를 직접 호출해 목록을 만들면 Rationale "왜 derived 필드인가" 원칙(코드 한 곳 결정, 영속화 없음)을 그대로 유지한다. SQL 리터럴 하드코딩은 명시적으로 기각된 대안이므로 피해야 한다.

- **[INFO]** frontend `needsAttention` 가드 — `TODO` 주석이 이미 불일치를 인정하고 있음, 구현 범위와 정합
  - target 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` line 148~161
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` § Rationale "자동 갱신 통합을 attention 술어에서 제외"
  - 상세: 기존 코드에 `TODO(autoRefresh 가드)` 주석이 달려 있고, `needsAttention()` 가 `autoRefresh=true` 통합도 `isExpiringSoon` 분기로 true 를 반환한다. 이번 구현에서 `if (integration.status === "connected") return isExpiringSoon(integration.tokenExpiresAt)` 를 `if (integration.status === "connected") return isExpiringSoon(integration.tokenExpiresAt) && !integration.autoRefresh` 로 교정하는 것이 spec §2.4·§11.4 결정과 정확히 일치한다. Rationale 위반이 아니라 Rationale 이행. `computeStatus()` (line 80) 는 이미 `expiresSoon && !integration.autoRefresh` 가드가 있어 선례 패턴도 일관된다.
  - 제안: TODO 주석 제거 + 가드 추가 후 `status-badge.test.tsx` 에 `autoRefresh=true + expiringSoon` 케이스 커버리지 추가.

- **[INFO]** subLabel 문구 `"Auto-renews · in …"` → `"Auto-renews · next in …"` — spec §4.1 정합
  - target 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` line 92
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §4.1` 헤더 정책 — "보조 라벨 `Auto-renews · next in <duration>` 을 회색 톤(muted)으로 노출한다 (예: `Auto-renews · next in 1h 24m`)"
  - 상세: 현재 구현 문구는 `"Auto-renews · in ${humanizeUntil(…)}"` 으로 "next" 가 빠져 있다. Spec 이 "next in" 을 명시하고 있으므로 이는 spec 과 일치하지 않는 구현이다. 이는 Rationale 를 번복하는 것이 아니라 단순 spec 텍스트 정합 누락이며, Rationale 의 어떤 결정과도 충돌하지 않는다. 이번 구현 범위에 포함되어 있으므로 같이 수정하면 된다.
  - 제안: line 92 를 `` `Auto-renews · next in ${humanizeUntil(integration.tokenExpiresAt)}` `` 로 교정. `status-badge.test.tsx` 스냅샷/assertion 도 함께 갱신.

---

## 요약

Target 구현(--impl-prep)은 spec/2-navigation/4-integration.md 의 이미 확정된 Rationale 결정("자동 갱신 통합을 attention 술어에서 제외", "왜 derived 필드인가")을 이행하는 작업이다. 전반적으로 Rationale 와 방향이 일치하고 기각된 대안을 재도입하는 항목은 없다. 다만 backend `findAll` 쿼리의 `expiring`/`attention` 분기에서 `supportsTokenAutoRefresh` 제외를 SQL 하드코딩(`service_type IN (...)` 리터럴)으로 구현하면 Rationale 가 명시적으로 거부한 "하드코딩 안"의 재도입이 된다. 이 경로를 service registry 의 동적 목록 조회(파라미터 바인딩)로 반드시 대체해야 한다. frontend `needsAttention` 가드와 subLabel "next in" 정합은 spec 이행이며 Rationale 충돌 없음.

---

## 위험도

LOW
