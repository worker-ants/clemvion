관련 spec 파일들을 확인했습니다. Cross-Spec 분석을 진행합니다.

---

## 발견사항

---

### **[CRITICAL] `status_reason` 저장값 case 규칙 불일치 — DRAFT 1C vs DRAFT 3B/3C**

- **target 위치**: DRAFT 1C (`spec/1-data-model.md §2.10`), DRAFT 3B (`spec/data-flow/integration.md §3.2`), DRAFT 3C (`§1.2.1 sequence diagram`)
- **충돌 대상**: 동일 `Integration.status_reason` 컬럼의 값 표기

**상세**:

DRAFT 1C는 `pending_install` 상태의 `status_reason` 값을 명시적으로 `snake_case` 로 정의한다:
> `oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired` / `resource_not_found` … (모두 `snake_case`)

같은 값이 DRAFT 2D §6 전이 표에도 `snake_case` 로 일관되며, DRAFT 2G §10.4 에러 매핑에도 `status_reason='oauth_token_exchange_failed'` (snake_case) 로 쓰인다.

그런데 DRAFT 3B (`data-flow/integration.md §3.2`) 는 동일 값을 **`UPPER_SNAKE_CASE`** 로 기재한다:
```
| `pending_install` | callback 실패 분기 코드 (예: `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`) |
```

DRAFT 3C 시퀀스 다이어그램도 동일하게 UPPER_SNAKE_CASE 를 사용한다:
```
Svc->>PG: UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, ...
```

DB 저장값이 두 spec 문서에서 다른 case 규칙을 따르게 된다. 구현 시 어느 값으로 저장해야 하는지 모호해져 데이터 불일치가 발생한다.

**제안**: DRAFT 3B 와 DRAFT 3C 시퀀스 다이어그램의 `pending_install` 케이스 값을 전부 `snake_case` 로 통일한다(`OAUTH_TOKEN_EXCHANGE_FAILED` → `oauth_token_exchange_failed` 등). DRAFT 1C 의 "DB 저장값은 `snake_case`, API 응답 에러 코드는 `UPPER_SNAKE_CASE`" 원칙이 명확하게 관철되어야 한다.

---

### **[WARNING] `integration_oauth_state` 스키마에 `integration_id` 누락 — DRAFT 2G/3C vs `data-flow §2.1`**

- **target 위치**: DRAFT 2G (`spec/2-navigation/4-integration.md §10.2`), DRAFT 3C (시퀀스 다이어그램 INSERT 문)
- **충돌 대상**: `spec/data-flow/integration.md §2.1` — `integration_oauth_state` 테이블 스키마

**상세**:

DRAFT 2G §10.2 에서는 callback 실패 시 `OAuthState.integrationId` 컨텍스트로 해당 Integration row 를 갱신한다고 명시한다:
> "state 소비 이후의 예외는 `OAuthState.integrationId` 컨텍스트가 살아있으므로 백엔드가 해당 row 의 `last_error` + `status_reason` 을 갱신한다"

DRAFT 3C 시퀀스 다이어그램 역시 다음을 포함한다:
```
Svc->>PG: INSERT integration_oauth_state (mode=reauthorize, integration_id=...)
```

그러나 현행 `data-flow/integration.md §2.1` 의 `integration_oauth_state` 스키마는:
```
state, service_type, workspace_id, user_id, expires_at
```

`integration_id` 컬럼이 없다. DRAFT 3 의 어떤 섹션도 이 스키마에 `integration_id` 추가를 명시하지 않는다.

**제안**: `integration_id` 가 이미 기존 코드/마이그레이션에 존재한다면(reauthorize 흐름이 동작하려면 필요) `data-flow §2.1` 스키마가 이를 누락하고 있는 것이므로 DRAFT 3 에 `integration_oauth_state` 스키마 row 갱신을 추가한다. 존재하지 않는다면 V042 마이그레이션 범위에 포함해야 한다.

---

### **[WARNING] `4-cafe24.md` CHANGELOG 중복 — DRAFT 2J-2 vs 기존 §10**

- **target 위치**: DRAFT 2J-2 (`spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` 추가 행)
- **충돌 대상**: `4-cafe24.md §10` 기존 CHANGELOG

**상세**:

현재 `4-cafe24.md §10 CHANGELOG` 에는 이미 다음 행이 존재한다:
```
| 2026-05-14 | §9.4 Private 앱 흐름 전면 재정의, §9.8 HMAC 검증 알고리즘 추가 |
```

DRAFT 2J-2 는 동일 날짜 `2026-05-14` 로 다음 행을 추가하려 한다:
```
| 2026-05-14 | §9.4 App URL path 에 install_token 도입 + §9.8 식별 전략을 mall_id 스캔에서 install_token 단일 조회로 재정의... |
```

두 행이 동일 날짜에 같은 섹션(§9.4, §9.8)의 변경을 각각 기술하게 되어 이력이 불명확해진다. 기존 행이 이번 draft 의 변경을 예고하는 플레이스홀더였던 것으로 보인다.

**제안**: DRAFT 2J-2 에서 기존 `2026-05-14 §9.4...` 행을 **replace** 하는 방식(insert 대신 대체)으로 변경한다.

---

### **[WARNING] `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 — 기존 테스트 호환성**

- **target 위치**: DRAFT 2E (`spec/2-navigation/4-integration.md §9.2 install 엔드포인트`), DRAFT 2J-2 (`4-cafe24.md §9.8`)
- **충돌 대상**: 기존 `4-cafe24.md §9.8` 의 에러 코드 의미

**상세**:

기존 spec §9.8 (§9.2) 에서 `CAFE24_INSTALL_INVALID_HMAC(403)` 은 "HMAC 불일치 **및 pending 미발견**" 두 케이스를 통합한다 — "정보 노출 방지" 목적.

draft 개정 후 `install_token` 미존재 케이스는 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리된다. 기존 e2e/통합 테스트가 "pending_install 행 없음" 시나리오에 대해 `403 CAFE24_INSTALL_INVALID_HMAC` 를 기대하고 있다면 `404 CAFE24_INSTALL_INVALID_TOKEN` 으로 예상 에러 코드를 변경해야 한다.

draft Rationale (§9 install_token 승격) 에서 이를 언급하면서 "내부 e2e/통합 테스트는 404 응답에 대응해야 한다 (I7)" 로만 기술한다. spec 상에서는 WARNING이지만 개발자 skill 로 넘어가는 구현 시점에 반드시 테스트 케이스 점검이 필요하다.

**제안**: spec 레벨에서는 큰 문제 없음. 단 `developer` skill 인수 시 기존 `spec/4-nodes/4-integration/4-cafe24.md §9.8` + e2e 테스트에서 `CAFE24_INSTALL_INVALID_HMAC` 를 `CAFE24_INSTALL_INVALID_TOKEN` 으로 대체하는 작업을 plan 에 명시적으로 체크박스로 추가 권장.

---

### **[INFO] `pending_install → (삭제)` vs `→ expired` 번복 — 기존 §6 다이어그램 명시 replace 필요**

- **target 위치**: DRAFT 2D §6 다이어그램 replace, DRAFT 2I Rationale
- **충돌 대상**: 기존 `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램

**상세**:

DRAFT 2I Rationale 는 "기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다" 고 선언한다. DRAFT 2D 에서 §6 다이어그램 전체 replace 가 이뤄지므로 실제 spec 변경은 올바르다. 단 기존 §6 에 해당 삭제 전이가 포함되어 있다는 사실이 Rationale 에만 기술되고 replace 대상임이 명시되므로, 실제 적용 시 해당 화살표(`install_timeout → 삭제`)가 누락 없이 제거되는지 확인이 필요하다.

**제안**: 적용 시 diff 를 통해 `→ (삭제)` 전이 라인이 다이어그램에서 실제로 사라지는지 검증한다. (spec 구조상 문제는 없음)

---

### **[INFO] `expired(install_timeout)` → reauthorize 비활성 — §2.2 더보기(⋮) 표 갱신 불명확**

- **target 위치**: DRAFT 2D-pre, DRAFT 2A (`§2.2 더보기(⋮)`)
- **충돌 대상**: 기존 `§2.2 더보기(⋮)` expired 상태 행

**상세**:

DRAFT 2D-pre 는 `status_reason='install_timeout'` 인 expired 행에서 reauthorize 비활성을 §6 note 로만 추가한다. 그러나 §2.2 더보기(⋮) 표의 기존 `expired` 행은 "reauthorize(OAuth)" 가 활성인 상태로 정의되어 있다. `install_timeout` 케이스에 대한 예외가 §2.2 표에 명시되지 않으면, UI 구현 시 모든 expired 행에 reauthorize 를 표시하게 된다.

**제안**: DRAFT 2A 에서 더보기(⋮) 표에 `expired (status_reason='install_timeout')` 행을 추가하거나, 기존 expired 행에 인라인으로 예외를 명시한다.

---

### **[INFO] `spec/4-nodes/4-integration/4-cafe24.md:337` 줄 번호 고정 취약**

- **target 위치**: DRAFT 2H (`4-cafe24.md §337 줄 교정` 방식)
- **충돌 대상**: 없음 (구조 문제)

**상세**:

DRAFT 2H 는 `spec/4-nodes/4-integration/4-cafe24.md:337` 라는 줄 번호를 특정해 "Resource → 카테고리" 교정을 지시한다. 선행하는 DRAFT 2J-1/2J-2 가 §9.4/9.8 본문을 수정하면 해당 텍스트의 실제 줄 번호가 이동한다.

**제안**: 줄 번호 대신 검색 가능한 패턴("Resource 단위 grouping 으로 사용성 보강") 으로 대상을 식별해 적용한다. 문제 없으나 적용 시 주의 필요.

---

## 요약

draft 의 전체 설계 방향(install_token 경로 식별, callback 실패 시 status 보존, 24h TTL 만료 `→ expired`, 에러 코드 분리)은 기존 spec 과 직접적인 구조 모순 없이 일관성 있게 확장된다. 다만 **`status_reason` 저장값의 case 규칙이 DRAFT 1C/2D/2G 는 `snake_case`, DRAFT 3B/3C 는 `UPPER_SNAKE_CASE` 로 분열**되어 있으며, 이를 방치하면 구현 시 어느 값으로 DB 에 저장할지 모호해진다. 이것이 유일한 CRITICAL 이슈다. WARNING 에 해당하는 `integration_oauth_state.integration_id` 스키마 갭과 CHANGELOG 중복은 spec 적용 전 간단한 수정으로 해소 가능하다.

## 위험도

**MEDIUM** — CRITICAL 이슈(case 불일치)가 있으나 해소 방향이 명확하다(DRAFT 3B/3C 를 snake_case 로 통일). 수정 후 재검토 또는 수정 확인 후 적용 가능.