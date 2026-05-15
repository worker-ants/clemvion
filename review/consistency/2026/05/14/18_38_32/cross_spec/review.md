관련 파일들을 모두 읽었습니다. Cross-Spec 분석 결과를 정리합니다.

---

## 발견사항

---

### **[WARNING]** §11.1 스캐너 잡 pseudo-code — `pending_install` 스캔 누락

- **target 위치**: `spec/2-navigation/4-integration.md §11.1 스캐너 잡`
- **충돌 대상**: `spec/data-flow/integration.md §1.4 OAuth 만료 스캐너`
- **상세**:
  - `§11.1` 의 pseudo-code 는 `대상: Integration WHERE token_expires_at IS NOT NULL` 만 표현하고 로직도 `token_expires_at` 기반 알림만 기술한다.
  - 그러나 같은 §11 상단 주석("Cafe24 Private 의 `pending_install` 24h TTL 만료 처리도 동일 만료 스캐너가 dispatch 한다")과 `data-flow §1.4` 시퀀스 다이어그램은 동일 Cron 잡이 두 번째 쿼리(`SELECT integration WHERE status='pending_install' AND created_at < now - INTERVAL '24h' AND install_token IS NOT NULL`)도 dispatch 함을 명시한다.
  - 구현자가 `§11.1`만 읽으면 `pending_install` timeout 처리를 누락할 수 있다.
- **제안**: `§11.1` 스캐너 잡 pseudo-code에 아래 두 번째 쿼리 블록과 처리 로직을 추가한다:
  ```
  for each pending_install (created_at < now - 24h):
    status=expired, status_reason='install_timeout', install_token=NULL
    알림 (선택)
  ```

---

### **[WARNING]** §10.3 `mall_id` 저장 위치 불일치 — `oauth_preview` vs. `provider_meta`

- **target 위치**: `spec/2-navigation/4-integration.md §10.3 provider별 설정`
- **충돌 대상**: `spec/data-flow/integration.md §2.1 Postgres schema 매핑`
- **상세**:
  - `§10.3`은 "oauth/begin 시점에 사용자가 입력한 `mall_id` 를 **oauth_preview** 임시 저장소에 함께 저장하여 callback 의 token 교환에서 사용한다 (new/reauthorize/request-scopes 분기에 모두 적용)" 라고 기술한다.
  - `data-flow §2.1`은 V041로 `integration_oauth_state` 테이블에 **`provider_meta (encrypted JSONB)`** 컬럼을 추가하여 "cafe24 private 의 mall_id/client_id/client_secret 을 callback 까지 캐리"한다고 설명한다.
  - `oauth_preview`는 `§10.2 step 4`에서 "callback **이후** 교환된 token을 임시 저장"하는 용도로 정의되어 있는데, `§10.3`은 callback **이전**에 mall_id가 oauth_preview에 있어야 한다고 설명한다 — 타이밍 역전.
  - 두 spec은 "callback 시 token exchange에 필요한 mall_id를 어디에 두는가"에 대해 다른 답을 제시한다.
- **제안**: `§10.3`의 "oauth_preview 임시 저장소" 언급을 `data-flow §2.1`과 일치하도록 `integration_oauth_state.provider_meta` (V041 추가 컬럼)으로 수정한다. `oauth_preview`는 `mode=new` callback 이후 token을 저장하는 용도로만 기술한다.

---

### **[WARNING]** Rate Limit 429 sleep 공식 불일치 — `Call-Remain` vs. `max(Call-Remain, Time-Remain)`

- **target 위치**: `spec/2-navigation/4-integration.md §5.8 Rate Limit 정책`
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §4.1 Rate Limit 처리 상세`
- **상세**:
  - `4-integration.md §5.8`: "429 응답 시 **`X-Cafe24-Call-Remain`** 값만큼 sleep 후 최대 2회 재시도"
  - `4-cafe24.md §4.1`: "429 응답 시 정책: **`max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)`** 만큼 sleep. 최대 2회 재시도"
  - 두 문서가 동일한 `Cafe24ApiClient` wrapper의 sleep 공식을 다르게 정의한다. `4-cafe24.md`는 `X-Cafe24-Time-Remain`도 고려하는 반면, `4-integration.md §5.8`은 `Call-Remain`만 사용한다.
- **제안**: `4-cafe24.md §4.1`이 더 상세하므로 권위적 소스로 취급. `4-integration.md §5.8`의 429 처리 설명을 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 으로 동기화한다.

---

### **[WARNING]** §13 데이터 모델 영향 요약 — `install_token` 필드 및 인덱스 누락

- **target 위치**: `spec/2-navigation/4-integration.md §13 데이터 모델 영향 요약`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration`, `§3 인덱스 전략`
- **상세**:
  - `§13`은 Integration 엔티티 변경으로 `status_reason, last_used_at, last_rotated_at, last_error` 4개 필드만 나열한다.
  - 그러나 `spec/1-data-model.md §2.10`에는 `install_token (String?, Cafe24 private 전용)` 필드가 존재하고, `§3`에는 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스도 추가돼 있다.
  - `data-flow §2.1`도 V042에서 `install_token` 컬럼이 추가됐다고 명시한다.
  - `§13`의 인덱스 목록도 `(workspace_id, name) UNIQUE, (workspace_id, status), (token_expires_at), IntegrationUsageLog (integration_id, at DESC)` 4개뿐으로, `install_token` 부분 인덱스가 누락된 상태다.
- **제안**: `§13`에 `install_token (String?)` 필드 추가와 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스를 명시적으로 추가한다.

---

### **[INFO]** §6 `pending_install → pending_install` 전이 — `install_token` 보존 여부 명시 누락

- **target 위치**: `spec/2-navigation/4-integration.md §6 상태 전이` (pending_install → pending_install 행)
- **충돌 대상**: `spec/data-flow/integration.md §1.2.1` (callback 실패 분기 코드 주석)
- **상세**:
  - `§6`의 해당 전이 설명은 "`status_reason` + `last_error` 만 갱신된다"라고만 기술한다. `install_token` 보존 여부는 명시하지 않는다.
  - `data-flow §1.2.1`은 토큰 교환 실패 분기에서 `status_reason='oauth_token_exchange_failed', last_error=... (status 는 pending_install 유지, **install_token 도 유지**)` 라고 명확히 주석으로 설명한다.
  - `install_token` 이 유지돼야 Cafe24 "테스트 실행" 재시도가 가능하므로 이는 중요한 동작 규약이다.
- **제안**: `§6` 해당 전이 설명에 "`install_token` 도 유지 (Cafe24 재시도를 위해 소거하지 않음)"를 명시한다.

---

## 요약

`spec/2-navigation/4-integration.md`는 다른 spec과 직접 모순되는 **Critical 수준의 충돌은 없다**. 다만 세 개의 WARNING이 존재한다: (1) §11.1 스캐너 pseudo-code에서 `pending_install` timeout 스캔이 누락되어 구현 착수 시 오구현 위험이 있고, (2) Cafe24 callback 경로에서 `mall_id` 저장 위치(`oauth_preview` vs. `provider_meta`)가 `data-flow`와 어긋나며, (3) Rate Limit 429 sleep 공식이 `4-integration.md`와 `4-cafe24.md` 사이에 불일치한다. 이 세 항목은 구현 전 조정이 권장된다.

## 위험도

**MEDIUM** — Critical 수준 충돌은 없으나 §11.1 누락과 §10.3 저장 위치 불일치가 Cafe24 Private 앱 흐름 구현에서 오구현을 유발할 수 있다.