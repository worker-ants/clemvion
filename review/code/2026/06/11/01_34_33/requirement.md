# 요구사항(Requirement) Review

## 발견사항

---

### 1. **[CRITICAL]** `statusReason = 'token_expired'` 가 spec 명세와 직접 충돌

- **위치**: `integration-expiry-scanner.service.ts` 변경 (+line): `integration.statusReason = 'token_expired';`  
  `integration-status-reason.ts`: `'token_expired'` 신규 추가  
  `integration-expiry-scanner.service.spec.ts`: `statusReason: 'token_expired'` 어설션 다수

- **상세**: `spec/data-flow/5-integration.md §1.4 Rationale ("2026-06 재작성에서 폐기된 옛 서술")` 이 이 동작을 **명시적으로 폐기(deprecated)** 처리한다.

  spec 원문 (line 438–441):
  > **"refresh_token 없는 provider 는 `status_reason='token_expired'` 로 격하" — 폐기.** `token_expired` 문자열은 백엔드 어디에도 없고 `INTEGRATION_STATUS_REASONS` union 에도 없다. 실제 0d 격하 분기는 `statusReason = null` 을 설정한다 — expired 행은 `install_timeout` 외엔 reason 이 비어 진단 단서가 없다. union 에 격하 사유를 추가해 채우는 것은 코드 측 개선 후보로 남긴다 (타 spec 의 `token_expired` 표기 정리 포함).

  spec §3.2 상태 이유 매핑 표 (line 382):
  > `expired` 상태의 status_reason: `install_timeout` 또는 **NULL** (connected-expiry 0d 격하 — scanner 가 reason 을 채우지 않음)

  spec §1.4 `connected-expiry` 표 (line 251):
  > "그 외 모든 행 ... 은 `status='expired', status_reason=NULL` 로 격하 + 알림"

  spec §1.4 시퀀스 다이어그램 (line 284):
  > `Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL`

  이 코드 변경은 spec 이 명시적으로 폐기한 `token_expired` slug 를 union 에 추가하고 DB 에 기록한다. spec 이 권위를 갖는다 — 코드가 틀림.

  또한 이 변경이 반영되기 위해서는 spec 의 Rationale "폐기" 서술을 먼저 revive/수정하고, §3.2 상태 이유 매핑 표와 §1.4 시퀀스 다이어그램을 동기화하는 작업이 선행되어야 한다. 현재는 코드가 폐기된 설계를 부활시키는 상태.

- **제안**: `statusReason = null` 로 되돌린다. `integration-status-reason.ts` 에서 `'token_expired'` 를 제거한다. 테스트에서 `statusReason: 'token_expired'` 어설션을 `statusReason: null` (또는 `statusReason: undefined`) 로 수정한다. `token_expired` 를 union 에 추가하려면 `project-planner` 에게 spec Rationale 의 폐기 서술을 해제하고 §3.2 표·§1.4 시퀀스를 갱신하도록 위임한 뒤 구현한다.

---

### 2. **[WARNING] [SPEC-DRIFT]** spec §11.1 pseudocode·표가 refresh-capable 알림 제외 정책을 미반영

- **위치**: `integration-expiry-scanner.service.ts` 변경 — `isRefreshCapable(integration)` 분기에서 claim 을 생성하지 않고 `continue` 처리 (알림 미발사)

- **상세**: 코드의 동작 — refresh-capable provider (cafe24·makeshop, 7d/3d/0d 모두) 는 `integration_expiry_dispatch` claim 을 만들지 않고 passive `integration_expired` 알림도 발사하지 않는다. 이는 `spec/2-navigation/4-integration.md §11.2` "**발사 정책**: refresh_token 없는 provider 의 token_expires_at 만료(status_reason='token_expired') 에만 발사" 와 일치한다.

  그러나 **같은 파일의 §11.1** 은 아직 옛 동작을 기술하고 있다:
  - §11.1 표 (line 955): cafe24+refresh_token 0d → `cafe24-token-refresh 큐 enqueue ... + 알림`
  - §11.1 pseudocode (line 968): `→ 알림 (status 변경 없음 — worker 가 결과에 따라 connected 유지/error 전이)`
  - spec 의 `> MakeShop:` 블록 (line 976)도 연장선상에서 makeshop 에 대한 알림 제외를 명시하지 않음

  코드 구현(§11.2 기반 알림 제외)이 합리적이고 의도적이며 되돌리는 것이 오답이다. spec §11.1 의 `+ 알림` 표기가 §11.2 의 발사 정책과 내부 모순 상태로 낡아 있는 것이다.

- **제안**: 코드 유지. `spec/2-navigation/4-integration.md §11.1` 의 `connected-expiry` 표·pseudocode 에서 `+ 알림` 표기를 제거하고 "refresh-capable provider 는 claim·알림 모두 스킵 (§11.2 참조)" 으로 갱신해야 한다. 갱신 대상: §11.1 표 동작 열 첫 번째 분기(`remain ≤ 0d: service_type='cafe24'...`), pseudocode line 968, MakeShop 블록.

---

### 3. **[WARNING] [SPEC-DRIFT]** `data-flow/5-integration.md §1.4` 의 "알려진 구현 갭" callout 이 이번 코드 수정 후에도 갱신되지 않음

- **위치**: `spec/data-flow/5-integration.md §1.4` (line 256)

- **상세**: 해당 callout 은 다음을 기술한다:
  > **⚠ 알려진 구현 갭 — MakeShop 행의 0d 격하 (2026-06 audit)**: ... 그러나 **현재 스캐너 코드의 refresh-capable 판별은 cafe24 한정** (`isCafe24RefreshCapable` 이 `serviceType !== 'cafe24'` 면 무조건 false — `integration-expiry-scanner.service.ts`) 이라, access_token TTL 이 ~1h 인 makeshop 통합이 하루 이상 idle 이면 다음 daily 스캔의 0d 분기에서 `expired` 로 잘못 격하된다. 코드 측 수정 ... 이 결정될 때까지 본 문서는 **실제 코드 동작**을 기준으로 기술한다.

  또한 §1.4 표 (line 251) 와 시퀀스 다이어그램 (line 284) 이 `isCafe24RefreshCapable` 과 `status_reason=NULL` 을 기준으로 기술되어 있으며, `isRefreshCapable` (makeshop 포함) 로 확장된 코드와 더 이상 일치하지 않는다.

  이번 코드 변경으로 갭이 해소됐으므로 (단, 위 §1번 CRITICAL 이 해소된 경우) callout 제거 + 표·시퀀스 갱신이 필요하다. 단, CRITICAL 이슈(`token_expired` vs `null`)가 먼저 해소되지 않으면 §1.4 갱신은 시기상조다.

- **제안**: 코드 유지. 단, CRITICAL #1 이 확정된 뒤 `spec/data-flow/5-integration.md §1.4` 의 "알려진 구현 갭" callout 을 제거하고, 표·시퀀스 다이어그램을 `isRefreshCapable` (cafe24+makeshop) 기반 동작으로 갱신한다. 갱신 대상: §1.4 표 `connected-expiry` 동작 열, 시퀀스 다이어그램 pseudocode, Rationale "폐기" 섹션.

---

### 4. **[WARNING]** spec §11.1 표의 `connected-expiry` 동작에 makeshop refresh-capable 분기가 누락 — 신규 테스트 케이스는 구현 사실에 앞서 작성됨

- **위치**: `integration-expiry-scanner.service.spec.ts` 의 V-01 테스트들 (makeshop + refresh_token 면제 케이스들)

- **상세**: 테스트에서 `// V-01: makeshop + refresh_token 은 refresh-capable provider` 주석이 붙은 케이스들은 올바른 의도를 검증한다. 그러나 위 §2 SPEC-DRIFT 에서 확인했듯이 spec §11.1 pseudocode 가 아직 cafe24 전용으로 기술되어 있어, 테스트가 스펙 본문에 없는 동작을 검증하는 형태다. 테스트 자체의 구현 로직은 정확하므로 코드 버그는 아니나, spec 갱신 전까지는 테스트와 spec 이 불일치한다.

- **제안**: spec §11.1 갱신 후 해소됨. 테스트 코드는 그대로 유지.

---

### 5. **[INFO]** `system-status.constants.ts` 주석에서 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 갱신 권고 — 실제로 e2e 도 갱신됨

- **위치**: `system-status.constants.ts` 주석 (신규 추가), `test/system-status.e2e-spec.ts` 변경

- **상세**: 주석에 "e2e-spec 의 `EXPECTED_QUEUE_NAMES` 목록도 함께 갱신할 것" 안내가 추가됐고, 실제로 e2e 파일도 `makeshop-token-refresh` 를 추가하고 하드코딩된 카운트("13개")를 `${EXPECTED_QUEUE_NAMES.length}개` 동적 표현으로 교체했다. 일관성 있게 처리됨.

- **제안**: 추가 조치 불필요.

---

### 6. **[INFO]** user-facing docs (MDX) 의 refresh-capable 알림 정책 기술이 `integration_action_required` 에 대한 spec §11.2 설명과 일부 불일치

- **위치**: `makeshop.en.mdx`, `makeshop.mdx`, `integration-management.en.mdx`, `integration-management.mdx` 의 갱신 텍스트

- **상세**: docs 에서 갱신 실패 시 `integration_action_required` 알림 발송이라고 기술하나, spec §11.2 의 `integration_action_required` 발사 정책(line 1007)은 "Cafe24ApiClient.markAuthFailed ... 와 recordNetworkFailure ... 안에서 발사" 로 한정하며, makeshop auth_failed 전이 시 동일 notifier 가 호출되는지 여부가 spec 본문에 명시되어 있지 않다. 기능 자체가 makeshop 에도 동작한다면 info 수준 갭이고, 그렇지 않다면 docs 가 overpromise 한 것이다.

- **제안**: `spec/2-navigation/4-integration.md §11.2` `integration_action_required` 발사 정책이 makeshop 을 명시적으로 커버하는지 확인 후, 필요 시 spec 갱신을 `project-planner` 에 위임.

---

## 요약

변경의 핵심인 `isRefreshCapable` 확장(cafe24+makeshop) 과 passive 알림 제외 정책은 `spec/2-navigation/4-integration.md §11.2` 의 발사 정책과 일치하며 기능 완전성 측면에서 올바르다. 그러나 **가장 심각한 문제는 `statusReason = 'token_expired'` 추가**다 — `spec/data-flow/5-integration.md §1.4 Rationale` 이 이 설계를 명시적으로 폐기(deprecated)했고, 0d 격하 시 `statusReason = null` 로 기록해야 한다고 명문화했음에도 코드가 이를 부활시킨다. `integration-status-reason.ts` 에 `'token_expired'` 를 union 에 추가한 것도 같은 이유로 spec 위반이다. 이 외에도 spec §11.1 pseudocode 와 `data-flow §1.4` 표/시퀀스가 이번 변경을 반영하지 못한 SPEC-DRIFT 가 다수 존재하나, 이는 코드 버그가 아니라 spec 갱신 누락이다.

## 위험도

**HIGH** — `statusReason = 'token_expired'` 이 spec 에서 명시적으로 폐기된 설계를 부활시키며, DB 에 spec 외 값이 기록되고 `normalizeStatusReason` 이 더 이상 이 값을 `unknown_error` 로 정규화하지 않게 된다. 이는 이후 spec 동기화 없이 진행되면 status_reason 데이터 정합성 문제로 이어질 수 있다.
