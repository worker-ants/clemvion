# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/` (구현 착수 전 impl-prep 검토)
주요 변경 의도: `spec/2-navigation/4-integration.md` 의 `autoRefresh` 관련 spec 갱신(commit c4200d51) 후 후속 구현 정합성 확인

---

## 발견사항

- **[INFO]** `autoRefresh` derived 필드 계산 방식 — Rationale 에 명문화됨, 구현 예정과 정합
  - target 위치: "구현 변경 예정 §1 백엔드" — `ServiceDefinition.supportsTokenAutoRefresh` 옵션 필드 추가, `toPublic` 매핑에서 `autoRefresh` 계산
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — "왜 derived 필드인가" 항
  - 상세: spec Rationale 은 `autoRefresh` 를 `ServiceDefinition.supportsTokenAutoRefresh` 에서 매 응답 시점에 계산하는 derived 식별자로 명시하고, DB 영속화하지 않는 이유(신규 OAuth provider 추가 시마다 SQL 변경 방지)를 기록했다. 구현 예정도 동일하게 service registry 에서 계산해 DTO 로 노출하는 방식을 따른다. 정합.
  - 제안: 이슈 없음. 확인 완료.

- **[INFO]** `expiresSoon` 분기 좁힘 — Rationale 에 명문화됨, 구현 예정과 정합
  - target 위치: "구현 변경 예정 §2 프론트엔드" — `computeStatus` 의 `expiresSoon` 분기를 `expiresSoon && !autoRefresh` 로 좁힘
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — §2.4/§11.4/§2.3 attention 술어에서 `autoRefresh=true` 행 만료 임박 분기 제외 결정
  - 상세: 결정 근거(cafe24 access_token 2h 수명으로 인한 거짓 양성)와 구현 방향이 일치한다. 정합.
  - 제안: 이슈 없음.

- **[INFO]** "본 PR 범위 밖" 항목의 `EXPIRING_SOON_INTERVAL` 공유 상수 추출 지연 처리
  - target 위치: "본 PR 범위 밖 (후속 별도 PR)" — `backend EXPIRING_SOON_INTERVAL` 쿼리의 `AND NOT autoRefresh` 가드, `frontend needsAttention()` 가드가 현재 PR 에 포함되지 않음
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — "프론트엔드·백엔드 영향 (구현 PR)" 항: "(a)~(e) 동기 반영한다" 라고 spec Rationale 이 일괄 반영을 요구
  - 상세: Spec Rationale 은 "후속 구현 PR 이 ... (b) ... (c) 목록/사이드바 카운트 쿼리의 `AND NOT autoRefresh` 가드, (d) frontend `_shared/status-badge.tsx::computeStatus` / `needsAttention` 의 동일 가드 ... 를 동기 반영한다" 고 기술한다. 그런데 target 의 "본 PR 범위 밖" 절은 (c)/(d) 를 후속 PR 로 분리해 "20260516-full-review W-32 의 `EXPIRING_SOON_INTERVAL` 공유 상수 추출과 함께 묶어 처리" 하겠다고 기술한다. spec Rationale 이 "동기 반영"을 단일 PR 에서 처리한다고 명문화한 것이 아니라 "후속 구현 PR 이 반영한다"는 의미로도 읽힌다. 하지만 (c)/(d) 없이 (a)/(b)/(e) 만 반영하면 배포 직후 일시적으로 **attention/expiring 상태 가드가 불완전**한 상태가 된다 — 백엔드 `autoRefresh` DTO 는 노출되나 사이드바 카운트·목록 `Expiring` 필터는 여전히 거짓 양성 유지.
  - 제안: plan 문서(`plan/in-progress/integration-token-ui-autorefresh.md`)에 "PR-1 이후 (c)(d) 미반영 시 attention 거짓 양성 일시 지속" 위험을 명시하거나, 혹은 PR-1 범위에 포함시키는 방향을 재검토한다. spec Rationale 을 수정할 필요는 없으나, 구현 plan 에 반쪽 배포 기간 위험이 기재되어야 한다.

- **[WARNING]** 과거 기각된 "SQL 하드코딩 술어" 대안 — 이번 구현이 그 경계를 일부 넘을 가능성
  - target 위치: "구현 변경 예정 §1 백엔드" — `integrations.service.ts` 의 `EXPIRING_SOON_INTERVAL` 사용 부에 `AND NOT autoRefresh` 가드 추가 (본 PR 범위 밖으로 지연되었으나 향후 포함 예정)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — "왜 derived 필드인가" 항: "옛 attention 술어 SQL 에 `service_type IN ('cafe24', 'google')` 같은 하드코딩을 두는 안도 검토했으나 (a) 신규 OAuth provider 추가 시마다 SQL 술어를 손대야 하고, (b) '왜 이 service 가 제외되는가' 의 의도가 SQL 에 묻혀 사라지므로 derived 플래그를 한 단계 거치게 했다" — 명시적으로 기각
  - 상세: spec 이 기각한 것은 `service_type IN (...)` 하드코딩이지, `AND NOT autoRefresh` SQL 조건 자체가 아니다. `autoRefresh` 는 `ServiceDefinition.supportsTokenAutoRefresh` 에서 유도되는 추상화된 플래그이므로 spec 의 derived 원칙과 충돌하지 않는다. 그러나 SQL 쿼리에서 `autoRefresh` 를 JOIN 또는 CASE WHEN 으로 계산해 WHERE 절에 반영하려면 서비스 레이어와 DB 레이어가 혼용되는 구현 패턴이 등장할 수 있다. spec Rationale 이 SQL 에 직접 두지 말라고 기각한 것이 service_type 하드코딩이라면 — 실제 구현이 `CASE WHEN service_type IN ('cafe24', 'google') THEN ...` 형태로 SQL 안에서 autoRefresh 를 재계산한다면 기각된 대안과 실질적으로 동일해지는 위험이 있다.
  - 제안: 후속 PR 에서 (c) 구현 시 SQL 쿼리가 `service_type` 을 직접 참조하지 않고 ORM 쿼리 빌더에서 `ServiceDefinition` registry 의 `supportsTokenAutoRefresh` 를 참조해 `integrationId` 집합을 미리 확보한 뒤 WHERE 절에 넣는 방식을 사용하도록 구현 plan 에 제약 사항을 명시한다. 또는 spec Rationale 에 "SQL 레이어에서도 service_type 직접 참조 금지, 서비스 레이어의 registry 참조를 경유할 것" 을 보강 기술한다.

- **[INFO]** `autoRefresh=true` 통합의 Reauthorize 버튼 활성 유지 — Rationale 과 구현 예정 정합
  - target 위치: "구현 변경 예정 §2 프론트엔드" — `frontend/src/app/(main)/integrations/[id]/page.tsx` 에서 `autoRefresh=true` 통합이 `connected` 상태일 때 Reauthorize 버튼에 hover 안내 추가
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — "Security 탭 Reauthorize 버튼은 비활성화하지 않음" 항
  - 상세: spec 이 "사용자가 scope 정리·credentials 재발급 등 명시 의도로 재인증을 누를 가치가 있기 때문" 으로 활성 유지를 결정했고, 구현 예정도 동일하게 반영한다. 정합.
  - 제안: 이슈 없음.

- **[INFO]** `Attention 가상 필터값` Rationale (2026-05-16) 과 `autoRefresh` 제외 Rationale (2026-05-17) 의 연쇄 일관성
  - target 위치: spec §2.3 / §2.4 / 구현 변경 예정 전반
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)" 및 "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)"
  - 상세: 두 Rationale 모두 "DB Enum 비확장 — 영속화되는 상태와 화면 필터링용 술어를 분리" 원칙을 공유하며, autoRefresh Rationale 이 "과거 결정과의 호환" 항에서 명시적으로 연계를 기술한다. 구현 예정은 `autoRefresh` 를 derived 필드로 DTO 에 담아 클라이언트가 필터링하는 방식으로 이 원칙을 준수한다. 정합.
  - 제안: 이슈 없음.

- **[INFO]** `spec/2-navigation/` 의 다른 문서들(0-dashboard, 1-workflow-list, 10-auth-flow, 11-error-empty-states, 12-workflow-version-history, 13-user-guide, 14-execution-history, 2-trigger-list, 3-schedule) 에는 이번 구현 변경과 관련된 Rationale 항목이 없으며 충돌 없음
  - target 위치: 해당 각 spec 파일
  - 과거 결정 출처: 해당 없음
  - 상세: 이번 impl-prep 의 구현 범위(`spec/2-navigation/4-integration.md` 의 autoRefresh 관련 변경)는 다른 navigation spec 파일들의 Rationale 에 기록된 결정과 교차 충돌하지 않는다.
  - 제안: 이슈 없음.

---

## 요약

이번 impl-prep 검토 대상 구현(integration token UI autoRefresh)은 `spec/2-navigation/4-integration.md` 의 Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" 에서 명문화된 결정들을 전반적으로 잘 따르고 있다. `autoRefresh` 를 derived 필드로 처리하는 방침, Reauthorize 버튼 활성 유지, `expiresSoon` 분기 좁힘 모두 기존 Rationale 과 정합한다. 주요 주의점은 두 가지다. 첫째, 구현을 두 PR 로 분리(백엔드 DTO + 프론트 기본 변경을 PR-1, 사이드바 카운트·`needsAttention` 가드를 후속 PR)하는 과정에서 일시적으로 attention 거짓 양성이 지속되는 위험을 plan 문서에 명시해야 한다. 둘째, 후속 PR 의 SQL 쿼리 구현이 Rationale 이 기각한 `service_type IN (...)` SQL 하드코딩 패턴을 무의식 중에 재도입하지 않도록 구현 제약을 plan 에 기재해야 한다. CRITICAL 이나 명시적 기각 대안 재도입은 발견되지 않았다.

---

## 위험도

LOW
