# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/2-navigation/4-integration.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 시각**: 2026-05-18

---

### 발견사항

- **[INFO]** `pending_install` 상태 노드 실행 차단 코드 — `INTEGRATION_INCOMPLETE` vs `INTEGRATION_NOT_CONNECTED`
  - target 위치: `spec/2-navigation/4-integration.md` §14.1 에러 코드 vocabulary 표, §9.1 `/api/integrations/:id/test` 비고
  - 충돌 대상: `spec/2-navigation/4-integration.md` §14.1 자체
  - 상세: §9.1 `/api/integrations/:id/test` 의 비고는 `pending_install` 행에 대해 `INTEGRATION_INCOMPLETE` 코드를 반환한다고 명시한다. 그런데 §14.1 에러 코드 vocabulary 표에서 `INTEGRATION_NOT_CONNECTED` 는 "Integration 상태가 `expired`/`error`" 인 경우로 정의되어 있고, `INTEGRATION_INCOMPLETE` 는 "credentials JSONB 에 필수 필드 누락" 케이스로 정의되어 있다. `pending_install` 의 의미("토큰 미발급")는 자격증명 자체가 비어 있다는 뜻이지만, 상태 값(`status='pending_install'`) 기준으로 거부하는 로직에 credentials 부재 오류 코드(`INTEGRATION_INCOMPLETE`)를 재사용하는 것이 의미상 모호하다. `status='pending_install'` 전용 에러 코드나 `INTEGRATION_NOT_CONNECTED` 적용이 더 직관적일 수 있으나, target 문서 §9.1 Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식 (2026-05-18)"이 기존 코드 재사용 이유를 설명하고 있으므로 의도적 결정임을 확인. 양 코드 정의가 target 문서 내 두 섹션 간 명시적 연결 없이 분산되어 있어 구현자가 혼동할 여지가 있다.
  - 제안: §14.1 `INTEGRATION_INCOMPLETE` 행 설명에 "credentials JSONB 필수 필드 누락 외에 `pending_install` 상태(토큰 미발급)도 포함" 이라는 주석을 추가하거나, `INTEGRATION_NOT_CONNECTED` 에 `pending_install` 케이스를 명시적으로 포함.

- **[INFO]** `notify_integration_expiry_by_email` 채널명 — 알림 발사 정책 범위 불일치 가능성
  - target 위치: `spec/2-navigation/4-integration.md` §11.2 "채널" 항
  - 충돌 대상: `spec/1-data-model.md` §2.19 Notification 엔티티
  - 상세: target §11.2 는 `notifyIntegrationExpiryByEmail` 채널이 `integration_action_required` 에도 적용된다고 명시하면서 "옛 이름 그대로 재사용" 이라고 설명한다. 데이터 모델 §2.19 는 `integration_expired` 와 `integration_action_required` 두 타입을 명확히 분리하고 있으나, 해당 이메일 옵션 필드명이 `notifyIntegrationExpiryByEmail` 로 `expiry` 에 한정된 의미를 암시하는 반면 `action_required` 알림에도 동일 설정이 적용된다는 사실이 데이터 모델 문서에는 언급되어 있지 않다. 사용자 프로필 설정 UI 를 구현할 때 혼란이 생길 수 있다.
  - 제안: `spec/1-data-model.md` §2.19 또는 User 엔티티의 `notifyIntegrationExpiryByEmail` 필드 설명에 "integration_expired 및 integration_action_required 양쪽에 모두 적용됨" 을 명시.

- **[INFO]** `auth_type` Enum 목록 — `none` 값 포함 여부 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §5 서비스별 인증 스키마 (전반)
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.auth_type
  - 상세: 데이터 모델 §2.10 의 `auth_type` Enum 은 `oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none` 을 명시한다. target §5 서비스별 스키마에서 HTTP/REST 서비스(§5.3)의 `auth_type` 은 `none / api_key / bearer / basic` 으로 기술되어 있는데, 데이터 모델의 `bearer_token` vs target 의 `bearer` 라는 명칭 차이가 있다. 또한 target §2.2 항목 요소 표의 "인증 유형 표시" 항에서 `Bearer Token` 이라고 표기하는 반면 §5.3 에서는 `bearer` 로 표기한다. 동일 값을 지칭하지만 표기가 혼재되어 있다.
  - 제안: target §5.3 의 `bearer` 를 `bearer_token` (데이터 모델 Enum 값) 으로 통일하거나, 데이터 모델에 표시 레이블과 저장값의 매핑을 명시.

- **[INFO]** `request-scopes` 응답 shape 정의 중복 — §9.2 표와 §4.4 분기 설명
  - target 위치: `spec/2-navigation/4-integration.md` §4.4 `[Request scopes]` 버튼 분기 설명 vs §9.2 `POST /api/integrations/:id/request-scopes` 행
  - 충돌 대상: target 문서 내 §4.4 와 §9.2 — 동일 문서 내 중복 정의
  - 상세: §4.4 의 "분기 ② — Cafe24 Private" 응답 shape 는 `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }` 로 `scopesAdded` 필드를 포함한다. §9.2 의 `request-scopes` 설명에서는 `scopesAdded` 필드가 응답에 포함됨을 언급하지만 shape 의 완전한 정의가 분산되어 있다. §9.2 응답 형식의 SoT 를 명확히 지정하거나 §9.2 표의 "응답 분기" 설명을 §4.4 와 동기화해야 한다.
  - 제안: §9.2 표의 Cafe24 Private 분기 설명에 완전한 응답 shape (`scopesAdded` 포함) 를 명시하고 §4.4 가 그 상위 정의를 참조하도록 링크 추가.

- **[WARNING]** `connected-expiry` 잡 — `refresh_token` 없는 provider 의 `expired` 상태 전이와 §6 상태 전이 다이어그램 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 잡 동작 설명 및 의사코드
  - 충돌 대상: `spec/2-navigation/4-integration.md` §6 상태 전이 다이어그램 및 표
  - 상세: §6 상태 전이 표에서 "refresh 실패 시 (2026-05-16 갱신)" 노트는 "optionally `expired` 상태는 이제 `install_timeout` (Cafe24 Private 24h TTL) 한 경로만 남는다" 고 명시한다. 그런데 §11.1 `connected-expiry` 잡 의사코드 중 `else:` 분기 (`service_type='cafe24'` 이 아닌 provider 또는 refresh_token 없는 케이스) 는 `→ status=expired, 알림` 으로 `connected → expired` 전이를 여전히 포함한다. §6 의 Rationale 인용("cafe24 의 `expired` 상태는 사실상 `install_timeout` 한 가지 경로만 남는다") 은 cafe24 한정이지만, 다른 provider(예: GitHub PAT) 에서의 `connected → expired` 전이 경로가 §6 다이어그램에서 명시적으로 표현되지 않아 다이어그램이 불완전해 보인다. `expiring` 상태 칩(§2.3)에서 GitHub 같은 refresh 미지원 provider 가 `autoRefresh=false` 이고 토큰이 만료 임박이면 `Expiring` 칩에 표시되고 `connected-expiry` 잡이 `expired` 로 전이시킬 수 있는데, §6 다이어그램은 이 경로를 누락하고 있다.
  - 제안: §6 상태 전이 다이어그램에 "refresh_token 없는 provider 의 `connected → expired` (token_expires_at 만료 시 스캐너가 전이)" 화살표를 명시 추가. `expired` 가 cafe24 외 provider 에서도 여전히 도달 가능한 상태임을 다이어그램에 반영.

- **[WARNING]** `IntegrationDto.autoRefresh` — `spec/1-data-model.md` §2.10 응답 DTO 파생 필드 정의와 target 의 정의 간 backend service registry 위치 기술 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `autoRefresh` 설명
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration "응답 DTO 전용 derived 필드" 항
  - 상세: 두 문서 모두 `autoRefresh` 를 `ServiceDefinition.supportsTokenAutoRefresh` 에서 도출되는 derived 필드로 정의하고 "현재 `cafe24` / `google` 만 true" 임을 명시한다. target §9.1 은 서비스 레지스트리 코드 경로를 `codebase/backend/src/modules/integrations/services/service-registry.ts` 로 구체적으로 명시하는 반면, 데이터 모델 §2.10 은 경로를 명시하지 않는다. 두 문서가 동일한 파생 필드를 각자 정의하고 있어 향후 하나가 갱신될 때 다른 문서와 불일치할 위험이 있다.
  - 제안: `spec/1-data-model.md` §2.10 의 `autoRefresh` 설명에서 target 문서 §9.1 을 정식 SoT 로 교차 참조 링크 추가. 또는 target §9.1 이 `spec/1-data-model.md §2.10` 을 SoT 로 명시하고 자신은 UI 행동 기술만 담도록 책임 분리.

- **[WARNING]** `pending_install → pending_install` (callback 실패 보존) 전이 — §6 다이어그램과 §10.4 에러 매핑 표 간 `reauthorize` mode 처리 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §10.4 에러 매핑 표 "코드 교환 실패 (mode=`reauthorize`, status=`pending_install`)" 행, §6 상태 전이 표 "pending_install → pending_install (callback 실패 보존)" 행
  - 충돌 대상: `spec/2-navigation/4-integration.md` §10.2 처리 플로우 step 4 "reauthorize" 설명
  - 상세: §10.2 step 4 의 "reauthorize" 모드 설명은 "기존 `integrationId` 의 credentials 를 새 토큰으로 교체, status 를 `connected` 로 복귀" 라고 기술한다. 동시에 §10.4 에서는 `mode='reauthorize'` + `status='pending_install'` 조합에서 "실패 시 `pending_install` 유지" 를 별도 분기로 명시한다. §10.2 의 `reauthorize` 설명은 `pending_install` 케이스를 포함하는 예외 분기를 step 4 에서 바로 기술하지 않고 "※ 단, integration 현재 status 가 `pending_install` 이면..." 이라는 주석으로 처리하고 있어 구조적으로는 이상 없으나, §6 다이어그램의 `pending_install → pending_install` 전이 항에서 trigger 이벤트가 "callback 실패" 라고만 표현되어 `mode='reauthorize'` 이라는 콘텍스트가 누락되어 있다. 이 전이는 일반적인 `reauthorize` callback 이 아닌, Cafe24 Private 초기 install 흐름(`mode='reauthorize'` 로 재사용)에서만 발생하는 특수 케이스이다.
  - 제안: §6 다이어그램 `pending_install → pending_install (callback 실패 보존)` 행의 설명에 "Cafe24 Private 초기 install 흐름(`OAuthState.mode='reauthorize'` 재사용) 에서 callback 처리 실패 시" 를 명확히 기술하여 일반 reauthorize callback 실패와의 혼동을 방지.

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드 — `spec/1-data-model.md` 와 target 간 적용 범위 기술 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 항
  - 충돌 대상: `spec/1-data-model.md` §2.10 `mall_id` 컬럼 설명, `spec/2-navigation/4-integration.md` §9.2 `oauth/begin` 비고
  - 상세: target §9.4 는 "동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration (`app_type` 무관 — public/private 모두)이 존재" 일 때 반환된다고 정의하고, "코드 이름의 `PRIVATE` 토큰은 historical artifact" 임을 명시한다. 그런데 §9.2 `oauth/begin` 설명에서는 begin 단계에서 "**connected row 만** 사전 차단" 한다고 명시하고, `expired`/`error` 상태는 begin 단계에서 차단하지 않고 finalize 단계의 V045 partial UNIQUE 가 backstop 으로 처리한다고 설명한다. 이 논리는 내부적으로 일관하지만 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 의미를 "상태 무관 중복 차단" 으로 외부에 노출하면서, 실제 begin 단계의 사전 차단은 "connected 한정" 이라는 내부 구현 세부가 에러 코드 설명과 겉으로 어긋나 보인다. 데이터 모델 §2.10 `mall_id` 설명은 "같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행" 이라는 정책을 명확히 선언하므로 정책 자체는 일치한다. 다만 에러 코드 문서가 "begin 단계에서는 connected 만 차단, finalize 단계에서 전체 status 차단" 이라는 두 레이어를 명시적으로 구분하지 않으면 구현 시 오해 소지가 있다.
  - 제안: §9.4 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 설명에 "begin 단계에서는 connected row 한정 SELECT 차단, finalize 단계에서 SQL UNIQUE 가 전체 status 에 대해 backstop 으로 동작" 이라는 두 레이어 구분 설명을 추가.

---

### 요약

`spec/2-navigation/4-integration.md` (통합 관리 화면 spec) 는 `spec/1-data-model.md` (데이터 모델), 동일 문서 내 여러 섹션과의 내부 일관성 모두에서 **직접 작동 불가를 초래하는 Critical 모순은 발견되지 않았다**. 발견된 이슈 대부분은 동일 개념을 두 문서 또는 한 문서의 두 섹션에 걸쳐 중복 정의하면서 기술 범위나 표현이 미묘하게 다른 INFO/WARNING 수준이다. 주요 관심 사항은 두 가지다: (1) `connected-expiry` 잡의 `connected → expired` 전이가 cafe24 이외 provider(refresh_token 없는 provider)에 대해 §6 상태 전이 다이어그램에 누락되어 있어, GitHub PAT 등의 상태 전이 경로가 다이어그램상 불완전한 점, (2) `IntegrationDto.autoRefresh` derived 필드의 정의가 target과 `spec/1-data-model.md` 양쪽에 분산되어 있어 향후 sync 탈락 위험이 있는 점. 두 항목 모두 구현 코드에는 영향이 없지만 문서를 SoT 로 사용하는 개발자의 혼동을 방지하기 위해 보강 권장.

---

### 위험도

LOW
