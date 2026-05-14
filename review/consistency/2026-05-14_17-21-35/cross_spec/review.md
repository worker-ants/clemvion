이제 전체 데이터를 확보했습니다. Cross-spec 분석을 완료하겠습니다.

---

## 발견사항

---

### **[WARNING] W1 — data-flow §1.2 OAuth 시작 엔드포인트 명칭이 navigation spec §9.2 와 불일치 (기존 문제 + 신규 서브다이어그램 충돌)**

- **target 위치**: DRAFT 3C — `spec/data-flow/integration.md §1.2.1` 신규 서브다이어그램
- **충돌 대상**: `spec/data-flow/integration.md §1.2` (기존 부모 다이어그램, line 49)
- **상세**: 부모 §1.2 다이어그램은 `GET /api/integrations/oauth/:service/start` 를 표기하나, navigation spec §9.2 (line 652) 는 `POST /api/integrations/oauth/begin` 을 정의한다. Draft 3C 의 신규 서브다이어그램은 `POST /oauth/begin` 을 사용해 두 표기가 같은 문서에 공존한다. 부모 §1.2 자체는 draft scope 밖이므로 수정 누락 상태가 된다.
- **제안**: DRAFT 3C 적용 시, 부모 §1.2 의 `GET /api/integrations/oauth/:service/start` → `POST /api/integrations/oauth/begin` 도 함께 정정한다. 또는 §1.2 상단에 "상세 흐름은 §1.2.1 참고" 주석을 추가해 독자 혼란을 방지한다.

---

### **[WARNING] W2 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(400)` 에러 코드의 발생 지점이 명시된 spec 없음**

- **target 위치**: DRAFT 2F — `spec/2-navigation/4-integration.md §9.4` 에러 코드 추가
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2` (POST `/oauth/begin` 엔드포인트 설명), `spec/data-flow/integration.md §1.2` (OAuth 연결 시퀀스)
- **상세**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(400)` 는 `POST /oauth/begin` 내부의 앱 레벨 중복 체크에서 발생하지만, §9.2 의 `oauth/begin` 엔드포인트 설명과 data-flow §1.2 시퀀스 다이어그램 어디에도 이 체크가 반영되지 않는다. 에러 코드만 §9.4에 존재하고 발생 조건·흐름이 spec 에서 추적 불가능하다.
- **제안**: DRAFT 2F-bis (§9.2 `oauth/begin` 보강) 범위에 "Cafe24 Private — 동일 `(workspaceId, mall_id, app_type='private')`의 `connected` Integration 존재 시 `400 CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 즉시 반환" 한 줄을 추가한다. data-flow §1.2.1 서브다이어그램에도 앱 레벨 중복 체크 분기를 추가하면 완결된다.

---

### **[WARNING] W3 — spec/4-nodes/4-integration/4-cafe24.md §9.4 step 3 URL 이 DRAFT 2J-1 대상으로 명시됐으나 spec/2-navigation/4-integration.md §3.2 step 3 과 동일 내용이 양쪽에 존재**

- **target 위치**: DRAFT 2J-1 — `spec/4-nodes/4-integration/4-cafe24.md §9.4` line 383
- **충돌 대상**: DRAFT 2C — `spec/2-navigation/4-integration.md §3.2` steps 3–4
- **상세**: 두 spec 문서(navigation §3.2 와 cafe24.md §9.4)가 같은 Private 앱 흐름을 각각 기술하며 URL이 동일하게 구버전(`/oauth/install/cafe24`)으로 남아있다. draft 는 두 곳 모두 업데이트하므로 적용하면 일관성이 유지된다. 단, **두 diff 가 독립적으로 적용되어야 하며 하나라도 누락되면 교차 충돌이 발생**한다는 점을 적용 시 명시해야 한다.
- **제안**: 별도 이슈 없음 — draft 적용 checklist 에 "두 파일의 URL 교체를 원자적으로 처리" 를 기재한다.

---

### **[WARNING] W4 — 기존 spec/2-navigation/4-integration.md §6 의 `pending_install → (삭제)` 화살표는 `번복 대상`이나 spec/4-nodes/4-integration/4-cafe24.md §9.4 텍스트와의 참조 정합 확인 필요**

- **target 위치**: DRAFT 2D — §6 상태 전이 다이어그램 + 전이 표
- **충돌 대상**: 현재 `spec/2-navigation/4-integration.md §6` line 565: `└── install timeout / manual delete ──▶ (삭제)`
- **상세**: Draft 는 `install timeout → (삭제)` 를 `install timeout → expired(status_reason='install_timeout')` 로 번복하며 Rationale 에 근거를 명시한다. 다른 spec 에서 이 자동 삭제 경로를 참조하는 곳은 없으므로 cross-spec 충돌은 없다. 단, §6 note 텍스트(line 578–579)의 현재 표현 "사용자가 Cafe24 에서 '테스트 실행' 을 완료해야 `connected` 로 전이한다" 뒤에 TTL 만료 경로 설명이 없으므로, DRAFT 2D 의 note replace 가 적용되지 않으면 §6 다이어그램-note 간 불일치가 된다.
- **제안**: DRAFT 2D 의 `§6 본문 마지막 노트 (replace + 1줄 추가)` 를 다이어그램 변경과 동시에 적용한다. 누락 없음.

---

### **[WARNING] W5 — `status_reason='install_timeout'` expired 행의 reauthorize 비활성 규칙이 §2.2 더보기(⋮) 정의에만 있고 §4.2 Overview Quick actions 에 미반영**

- **target 위치**: DRAFT 2D-pre + DRAFT 2A — §2.2 더보기(⋮) 규칙
- **충돌 대상**: `spec/2-navigation/4-integration.md §4.2` (Overview 탭 Quick actions): `Reauthorize(OAuth)` 버튼 — 비활성 조건 미기술
- **상세**: §4.2 Quick actions (line 244)에 `Reauthorize(OAuth)` 버튼이 있으나, 비활성 조건이 전혀 명시되지 않았다. Draft 2A 는 §2.2 더보기(⋮) 메뉴에서 `pending_install` 및 `expired AND status_reason='install_timeout'` 시 재인증 비활성을 명시하지만, 상세 페이지의 `Reauthorize` 버튼(§4.2)은 갱신되지 않는다. UI 구현 시 양쪽이 불일치할 수 있다.
- **제안**: §4.2 Quick actions 의 `Reauthorize(OAuth)` 행에 비활성 조건 (`status='pending_install'` 및 `status='expired' AND status_reason='install_timeout'` 인 Cafe24 Private 행은 비활성) 을 한 줄 추가한다.

---

### **[INFO] I1 — `status_reason` DB 저장값 snake_case vs API 에러 코드 UPPER_SNAKE_CASE 이중 표기**

- **target 위치**: DRAFT 1C — `spec/1-data-model.md §2.10` status_reason 갱신
- **충돌 대상**: `spec/2-navigation/4-integration.md §10.4` (에러 매핑, DRAFT 2G)
- **상세**: Draft 가 "DB 저장값 = `snake_case`, API/callback HTML 에러 코드 = `UPPER_SNAKE_CASE`" 이중 표기를 의도적으로 설계하고 §10.4 에서 매핑을 제공한다. 이 분리 자체는 일관성이 있으며 Rationale 에도 기술된다. 단, `spec/conventions/` 하위에 공통 에러 코드 컨벤션 문서가 있다면 거기에도 이 이중 표기 정책을 기재해야 한다. 현재 draft 범위에 `spec/conventions/` 업데이트가 빠져 있다.
- **제안**: 커스텀 에러 코드 컨벤션 문서(`spec/conventions/error-codes.md` 또는 기존 문서)가 있다면 "OAuth callback 에러: API = UPPER_SNAKE_CASE, DB status_reason = snake_case" 규칙을 추가한다. 없으면 생략 가능.

---

### **[INFO] I2 — data-flow §1.2 부모 OAuth 시퀀스에 Cafe24 Private 경우가 없음 (DRAFT 3C 가 서브다이어그램으로 추가)**

- **target 위치**: DRAFT 3C — §1.2.1 신규 서브다이어그램
- **충돌 대상**: 현재 data-flow §1.2 (Cafe24 Private 흐름 전혀 없음)
- **상세**: DRAFT 3C 는 §1.2.1 로 서브다이어그램을 추가하며, 부모 §1.2 상단에 "Cafe24 Private 는 §1.2.1 참고" 같은 forward-reference 가 없다. 독자가 §1.2 만 읽으면 Cafe24 Private 흐름의 존재를 알 수 없다.
- **제안**: DRAFT 3C 에서 §1.2 다이어그램 직후 한 줄: `> Cafe24 Private 앱의 install_token 기반 흐름은 §1.2.1 참고.` 를 추가한다.

---

### **[INFO] I3 — credentials JSONB 스키마의 `access_token`/`refresh_token` required 표기가 `pending_install` 상태를 반영하지 않음 (기존 문제)**

- **target 위치**: `spec/2-navigation/4-integration.md §5.8` (draft 미수정)
- **충돌 대상**: `pending_install` 상태의 Integration 은 `access_token`/`refresh_token` 이 없음
- **상세**: §5.8 credentials JSONB 에서 두 토큰이 `✓` (필수)로 표기되나, `pending_install` Integration 은 토큰 없이 생성된다. 이는 draft 이전부터 존재하는 pre-existing 이슈이며 이번 draft 가 상태를 악화시키지는 않는다. 단, install_token 이 credentials 가 아닌 별도 컬럼이라는 사실도 §5.8 에 명시되지 않는다.
- **제안**: §5.8 credentials 스키마 마지막에 주석 한 줄: `> app_type='private' + status='pending_install' 인 신규 생성 시에는 access_token, refresh_token 이 NULL 이다 — install_token 은 Integration 컬럼에 별도 저장 (§1-data-model §2.10).`

---

### **[INFO] I4 — spec/conventions/cafe24-api-metadata.md §6 용어 명시 위치**

- **target 위치**: DRAFT 2H — §6 첫 단락 inline 보강
- **충돌 대상**: 현재 §6 는 allowlist 설명으로 시작하며 첫 단락에 용어 정의 없음
- **상세**: Draft 가 §6 첫 단락에 "UI grouping 단위 = '카테고리'" 용어 정의를 inline 추가한다. 내용 자체는 현재 §6 본문(line 159)의 "카테고리 단위 grouping" 표현과 일관성이 있으며 충돌 없다.
- **제안**: 이슈 없음 — 적용 권장.

---

### **[INFO] I5 — `spec/4-nodes/4-integration/4-cafe24.md §8.3` 의 `Resource 단위 grouping` 표현 (line 337)**

- **target 위치**: DRAFT 2H (§14.2 수정 대상) + 별도로 cafe24.md §8.3 line 337
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md §6` — "카테고리 단위 grouping"
- **상세**: Draft 2H 가 `spec/2-navigation/4-integration.md §14.2` 의 "Resource 단위" → "카테고리 단위" 를 수정하고, `spec/4-nodes/4-integration/4-cafe24.md:337` 도 수정 대상으로 명시한다. 그러나 §8.3 헤더 아래 실제 line 337 텍스트는 `UI 에서는 Resource 단위 grouping 으로 사용성 보강` — draft 가 정확히 이 줄을 타깃으로 하고 있으므로 적용하면 일관성이 복원된다. 이슈 없음.

---

## 요약

draft 내용은 전반적으로 내부 일관성이 높고, 기존 spec 과의 충돌 대부분을 직접 해소하거나 Rationale 에서 명시적으로 번복 선언한다. 블로킹 CRITICAL 이슈는 없다. 주요 주의 사항은 두 가지: **(a)** data-flow §1.2 부모 다이어그램의 엔드포인트 명칭 불일치가 DRAFT 3C 적용 후 더 두드러질 수 있으므로 §1.2 도 함께 보정해야 하고(W1), **(b)** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러의 발생 지점이 `oauth/begin` 엔드포인트 설명이나 data-flow 플로우 어디에도 드러나지 않아 구현자가 체크 위치를 spec 만으로 추론할 수 없다(W2). 나머지는 일부 비활성 조건 미반영(W5)과 정보성 용어·참조 보강(I1–I5) 수준이다.

## 위험도
**LOW** — Critical 0건, Warning 5건(모두 추가 보강 권장 수준, 구현 차단 없음), Info 5건.