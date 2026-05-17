# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/2-navigation/` 전 파일 + 관련 Rationale 발췌
기준 Rationale 출처: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/4-ai-assistant.md`

---

### 발견사항

- **[INFO]** `autoRefresh` 파생 필드 — spec 정의 위치와 구현 의도의 불일치 가능성
  - target 위치: `변경 의도` 섹션 §구현 변경 예정 1번 — `ServiceDefinition` 에 `supportsTokenAutoRefresh?: boolean` 옵션 추가, `IntegrationDto` 에 `autoRefresh: boolean` 계산 필드 노출
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §9.1` 및 `§2.2`, `§2.3`, `§2.4` 전반에서 `autoRefresh` 를 Integration 엔티티 속성처럼 사용; `spec/1-data-model.md §2.10` 보조 주석에 "autoRefresh derived" 명시
  - 상세: spec 본문 §9.1 (truncate 로 본문 확인 불가)과 `1-data-model.md §2.10` 에는 `autoRefresh` 가 파생(derived) 속성임이 명시되어 있고, 구현 의도에서도 DB 컬럼 추가 없이 `service-registry.ts` 기반 런타임 계산으로 확정된 것은 spec 의 방향과 일치한다. 그러나 `IntegrationDto` 에 `autoRefresh: boolean` 이라는 이름으로 노출되는 것과 내부 서비스 레지스트리 필드명 `supportsTokenAutoRefresh` 가 다른 점은, spec 에 기록된 외부 노출 명칭이 `autoRefresh` 로 통일되어 있으므로 구현도 이를 따른다는 전제가 맞지만, spec 이 이 이름 결정의 Rationale 을 명시적으로 기록하지 않은 상태다. 향후 유지보수 시 `supportsTokenAutoRefresh` (서비스 레지스트리 내부) vs `autoRefresh` (DTO/UI) 두 이름이 혼용될 위험이 있다.
  - 제안: `spec/2-navigation/4-integration.md` Rationale 에 "내부 서비스 레지스트리 필드명은 `supportsTokenAutoRefresh`, 외부 DTO/UI 노출명은 `autoRefresh` — 이름이 다른 이유(서비스 설계 계층 분리)" 한 문장을 추가해 향후 drif 를 예방.

- **[INFO]** `expiring` 가상 필터값에서 `autoRefresh=true` 통합 제외 — Rationale 명시적 기록 권장
  - target 위치: `spec/2-navigation/4-integration.md §2.3` — `Expiring` 칩 정의 `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh`, §2.4 배너 포함 조건 동일
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.3` 인라인 주석 — "자동 갱신 통합(§9.1)은 만료 임박 분기에서 제외" 라는 근거가 현재 주석 수준으로만 존재; Rationale 섹션에 별도 항목은 없음(파일이 truncate 되어 Rationale 절 전체 확인 불가)
  - 상세: 구현 변경 예정에서 `computeStatus` 의 `expiresSoon` 분기를 `expiresSoon && !autoRefresh` 로 좁히는 것은 spec §2.3 과 일치한다. 그러나 이 정책이 "짧은-수명 토큰(예: cafe24 access_token 2h)의 거짓 양성 방지"라는 근거는 spec 본문 §2.4 배너 설명 안에만 산재해 있고 Rationale 섹션에 집약되지 않은 것으로 추정된다. 구현 착수 시 이 조건을 잘못 이해해 `autoRefresh` 와 무관하게 `expiresSoon` 을 평가하는 회귀가 발생할 수 있다.
  - 제안: spec Rationale 에 "자동 갱신 통합을 attention/expiring 술어에서 제외" 항이 있다면 구현 의도와 정합된 상태이므로 추가 조치 불필요. 없다면 해당 항을 추가할 것.

- **[INFO]** `pending_install` 상태를 attention/expiring 에서 제외하는 정책 — 구현 의도 내 일관성 확인 필요
  - target 위치: `변경 의도 §본 PR 범위 밖` — `needsAttention()` 가드는 후속 PR 로 미룸; 구현 변경 예정에는 `needsAttention` 로직 변경이 포함되지 않음
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.4` 배너 포함 조건 — `pending_install` 은 정상 전환 상태로 배너에서 제외; `§2.3` 상태 칩에 `pending_install` 미포함; `더보기(⋮)` 메뉴에서 `pending_install` 행은 "상세 열기 + 삭제만 활성"
  - 상세: 본 PR 의 구현 범위가 `status-badge.tsx` 의 `computeStatus` 내 `expiresSoon && !autoRefresh` 변경에 집중되어 있고, `needsAttention()` 는 후속 PR 로 명시적으로 분리되어 있다. 이는 기존 spec §2.4 의 `pending_install` 제외 원칙을 깨지 않는다. 단, 현재 프론트엔드의 `needsAttention()` 구현이 `pending_install` 을 이미 올바르게 제외하는지 여부가 본 PR 에서 검증되지 않는 구조이므로, 후속 PR 에서 해당 가드가 spec §2.4 를 정확히 반영하는지 확인이 필요하다.
  - 제안: 후속 PR 의 plan 문서(`plan/in-progress/`) 에 "spec §2.4 `pending_install` 제외 조건 + `autoRefresh` 제외 조건 동시 반영"을 체크 항목으로 명시.

- **[INFO]** `Reauthorize` 버튼 비활성 조건 — `autoRefresh=true` + `connected` 케이스 정책 명시
  - target 위치: `spec/2-navigation/4-integration.md §4.2` Overview 탭 Quick actions — `autoRefresh=true` 통합이 `status='connected'` 인 동안 버튼은 활성 유지하되 hover 시 "Auto-renewing — manual reauthorization is not required" 안내
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §4.3` Security 탭 `Reauthorize` 비활성 조건 목록 — `status='pending_install'`, `status='expired' AND status_reason='install_timeout'`, `service_type='cafe24' AND credentials.app_type='private'` 케이스는 명시되어 있음
  - 상세: §4.2 에는 `autoRefresh=true` + `connected` 상태에서 버튼을 disabled 가 아닌 "활성 유지하되 hover 안내"로 처리한다고 명시되어 있다. 그런데 §4.3 비활성 조건 목록에는 이 케이스가 포함되지 않는다 — spec 상 의도적 차이(활성이지만 hover 안내)다. 구현 변경 예정에 §4.3 Reauthorize 버튼 처리에 관한 언급이 없으므로, 본 PR 에서 이 부분이 구현되지 않을 가능성이 있다.
  - 제안: 구현 변경 예정 목록에 "§4.3 Security 탭 `Reauthorize` 버튼 hover tooltip 추가 (`autoRefresh=true + connected` 케이스)" 를 명시하거나, 해당 케이스를 본 PR 범위에 포함할지 후속 PR 으로 분리할지 plan 에 기록.

---

### 요약

`spec/2-navigation/` 전체를 대상으로 한 본 검토에서, 구현 의도(`변경 의도` 섹션)가 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사례는 발견되지 않았다. `autoRefresh` 파생 필드를 DB 컬럼 없이 서비스 레지스트리 기반으로 계산하는 설계, `expiring`/`attention` 가상 필터값에서 `autoRefresh=true` 통합을 제외하는 정책, `pending_install` 의 attention 배너 제외 정책, Cafe24 Private 앱에서 우리 서버가 OAuth 를 시작하지 않는 원칙 모두 기존 spec 과 일치한다. 발견된 4건은 모두 INFO 수준으로, 주로 Rationale 기록의 보완 및 구현 변경 예정 목록의 명시성 강화에 해당한다. 특히 내부 식별자(`supportsTokenAutoRefresh`) 와 외부 노출명(`autoRefresh`) 의 의도적 분리를 spec Rationale 에 남겨두는 것이 향후 유지보수 혼란을 예방하는 데 도움이 된다.

### 위험도

LOW
