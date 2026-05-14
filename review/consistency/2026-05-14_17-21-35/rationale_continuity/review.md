target 문서 `plan/in-progress/spec-draft-cafe24-pending-polish.md` 를 제공된 Rationale 발췌본과 대조해 분석합니다.

---

### 발견사항

**[INFO] `mode=reauthorize` 모드명의 의미 모호성 — 초기 install 흐름에도 동일 모드 재사용**

- **target 위치**: DRAFT 3C 시퀀스 다이어그램 (`INSERT integration_oauth_state (mode=reauthorize, ...)`) / DRAFT 2G §10.4 에러 매핑 표
- **과거 결정 출처**: 기존 OAuthState mode 설계 Rationale 미제공 (제공된 발췌본에 부재)
- **상세**: `mode=reauthorize` 는 기존 재인증 흐름을 위한 값인데, Cafe24 Private 초기 install 흐름도 동일 mode 로 삽입된다. 결과적으로 DRAFT 2G §10.4 에서 callback 처리 분기가 `(mode=reauthorize, status=connected)` 와 `(mode=reauthorize, status=pending_install)` 로 쪼개져, mode 하나로 의도를 구분할 수 없고 status 를 추가로 확인해야 한다. 이는 기존 설계 선택의 의도적 계승인지, 신규 mode 값 도입을 검토했다 기각한 것인지 draft 에서 명시되지 않았다.
- **제안**: DRAFT 2I Rationale 에 "초기 install 도 reauthorize mode 를 재사용한 이유 (예: 신규 mode 신설 대비 구현 비용·호환성)" 한 문장 추가. 또는 `mode=cafe24_private_install` 신설을 명시적으로 검토·기각하는 문장 포함.

---

**[INFO] `integration_oauth_state.provider_meta` 의 client_secret 중복 저장 정당성 미명시**

- **target 위치**: DRAFT 3D §2.1 `integration_oauth_state` 행 ("provider_meta 컬럼 V041 추가 — cafe24 private 의 mall_id/client_id/client_secret 을 callback 까지 캐리")
- **과거 결정 출처**: V041 도입 Rationale 미제공 (제공된 발췌본에 부재)
- **상세**: DRAFT 2J-2 의 새 식별 전략에서 App URL 핸들러는 `install_token → integration row → credentials.client_secret` 경로로 HMAC 검증에 필요한 값을 읽는다. OAuthState 에 `integration_id` FK 도 있으므로 callback 시 integration row 를 다시 조회해 client_secret 에 접근 가능하다. provider_meta 에 client_secret 을 별도 복사하는 실제 필요 시점이 draft 에서 설명되지 않아, V041 의 설계 의도가 지금 흐름에도 여전히 유효한지 불분명하다.
- **제안**: V041 이 provider_meta 에 client_secret 을 싣도록 결정한 배경(예: integration row 를 재조회하지 않고 callback 을 자급하는 시나리오)을 DRAFT 2I 또는 data-flow spec 의 Rationale 에 한 문장으로 명시. 불필요한 복사라면 mall_id/client_id 만 남기고 client_secret 은 생략하는 방향 검토 권장 (단명 OAuthState 의 attack surface 최소화).

---

### 요약

target 문서는 제공된 Rationale 발췌본(data-model, workflow-list, user-profile, ai-assistant)과 도메인이 완전히 분리되어 직접 충돌이 없다. 핵심 설계 번복 2건 — `install timeout 자동삭제 → expired 전이` (DRAFT 2D "번복 acknowledgment") 와 `HMAC 에러 코드 단일화 → 분리` (DRAFT 2I Rationale §install_token 승격) — 은 draft 자체에서 명시적으로 acknowledge 하면서 새 Rationale 를 함께 제공하고 있어 의사결정 연속성 요건을 충족한다. INFO 2건은 기존 결정과의 충돌이 아니라 pre-existing 설계(mode=reauthorize, V041 provider_meta)의 재사용 의도가 draft 에서 설명되지 않은 데 따른 보완 제안이다.

### 위험도

**LOW**