이제 전체 분석을 완료할 수 있습니다. 결과를 정리합니다.

---

## 발견사항

---

### **[WARNING]** `spec/2-navigation/4-integration.md §9.2` — API 표 경로 오타 (`:provider` 앞 `/` 누락)

- **target 위치**: `spec/2-navigation/4-integration.md` Line 667 (`§9.2 인증/회전/Scope` 표)
- **충돌 대상**: 동일 문서 §10.1 · §3.2 · §3.2(Cafe24 Public 5번 항)
- **상세**: Line 667 의 API 표에 `/api/3rd-party:provider/callback` 으로 기재돼 있으나 `:provider` 앞 `/` 가 누락됨. 문서 내 다른 모든 위치(§3.2, §10.1, §10.2)는 정확하게 `/api/3rd-party/:provider/callback` 으로 표기함. 구현 시 표를 먼저 보는 개발자가 잘못된 경로를 등록할 위험.
- **제안**: Line 667 을 `/api/3rd-party/:provider/callback` 으로 수정.

---

### **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 설명이 실제 SQL UNIQUE 제약 범위와 불일치

- **target 위치**: `spec/2-navigation/4-integration.md §9.4` (에러 코드 목록) · `§9.2 oauth/begin` 설명
- **충돌 대상**: `spec/1-data-model.md §3 인덱스 전략` — `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE`
- **상세**: `§9.2`·`§9.4` 는 이 에러가 "동일 `(workspaceId, mall_id, app_type='private')` 에 이미 `connected` Integration 존재" 할 때 발화한다고 설명한다. 그러나 data model 인덱스는 `app_type` 무관 — 즉 `public` app 이 이미 연결된 상태에서 같은 `mall_id` 로 `private` 등록을 시도해도 SQL UNIQUE 위반이 발생해 **동일 에러 코드가 반환**된다. 에러 코드명 `…PRIVATE_APP…` 과 description "app_type='private'" 은 public-private 혼재 케이스를 포함하지 않아, 사용자·구현자 모두 오해할 수 있다. (data model Rationale 은 "한 mall 에 public·private 을 동시에 보유 불가" 라고 명시하지만 에러 코드명·설명에 반영이 안 됨.)
- **제안**: 에러 코드 description 을 "동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration 이 존재(`public`/`private` 무관)" 로 수정하거나, 에러 코드명을 `CAFE24_MALL_ALREADY_CONNECTED` 로 변경해 범위를 명확히 할 것. 어느 쪽을 택하든 §9.2 `oauth/begin` 본문 설명도 함께 갱신.

---

### **[INFO]** `spec/1-data-model.md §3 인덱스 표` — path 표기 오타 (`:installToken` 앞 `/` 누락)

- **target 위치**: `spec/1-data-model.md` Line 645 (인덱스 전략 표)
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` — `/api/3rd-party/cafe24/install/:installToken`
- **상세**: 인덱스 목적 컬럼에 `/3rd-party/cafe24/install:installToken` 으로 표기 (`:installToken` 앞 `/` 누락). 실제 경로와 표기 불일치.
- **제안**: `/3rd-party/cafe24/install/:installToken` 으로 수정.

---

### **[INFO]** `spec/data-flow/integration.md` 시퀀스 다이어그램 — endpoint 를 `/api/` prefix 없이 축약 표기

- **target 위치**: `spec/data-flow/integration.md` Lines 75, 80
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` — 전체 경로는 `/api/integrations/oauth/begin`, `/api/3rd-party/cafe24/install/:installToken`
- **상세**: 시퀀스 다이어그램에서 `POST /oauth/begin` (full: `/api/integrations/oauth/begin`), `GET /3rd-party/cafe24/install/:installToken` (full: `/api/3rd-party/...`) 으로 `/api/` prefix 를 생략해 표기. data-flow 다이어그램의 관용적 축약일 수 있으나, 신규 구현자가 prefix 를 누락하고 라우트를 등록할 가능성.
- **제안**: 다이어그램 내 경로를 full path (`/api/...`) 로 통일하거나, 파일 상단에 "경로는 `/api/` prefix 생략" 주석을 추가.

---

### **[INFO]** `spec/2-navigation/4-integration.md §4.3` — `rotate` API path 오타

- **target 위치**: `spec/2-navigation/4-integration.md` Line 256 (Security 탭 Rotate credentials 행)
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` — `POST /api/integrations/:id/rotate`
- **상세**: `POST /api/integrations:id/rotate` 로 `:id` 앞 `/` 가 누락됨. §9.2 표는 정확하게 작성돼 있음.
- **제안**: `POST /api/integrations/:id/rotate` 로 수정.

---

## 요약

`spec/2-navigation/4-integration.md` 의 최신 변경(`/api/3rd-party/` namespace 도입 · install_token 22자 base64url 단축)은 `spec/1-data-model.md` · `spec/4-nodes/4-integration/4-cafe24.md` · `spec/data-flow/integration.md` 와 실질적으로 일관성을 유지하고 있다. CRITICAL 충돌은 없다. 다만 두 가지 WARNING 이 구현 전 명확히 해야 할 사항이다 — (1) §9.2 API 표의 `/api/3rd-party:provider/callback` 오타는 구현자가 잘못된 경로를 등록할 직접적 위험이고, (2) `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 설명이 실제 SQL UNIQUE 제약의 범위(public-private 혼재 케이스 포함)를 커버하지 않아 운영 시 혼란이 예상된다. INFO 3건은 문서 표기 오타로 기능 영향은 없다.

## 위험도
**LOW** — CRITICAL 충돌 없음. WARNING 2건은 구현 전 spec 수정으로 해소 가능한 수준.