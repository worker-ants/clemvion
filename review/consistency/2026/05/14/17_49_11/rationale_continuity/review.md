### 발견사항

---

- **[WARNING] `OAuthState.mode='reauthorize'` 를 Private 앱 초기 install 에 재사용 — Rationale 미제시**
  - target 위치: DRAFT 3C §1.2.1 시퀀스 다이어그램 (`INSERT integration_oauth_state (mode=reauthorize, integration_id=...)`)
  - 과거 결정 출처: 없음 (Rationale 발췌에 해당 결정이 없어 암묵적 설계로 존재)
  - 상세: `mode=reauthorize` 는 의미적으로 "이미 connected 된 통합을 재인증"을 뜻한다. 그런데 draft 는 `status='pending_install'` 인 초기 install 흐름에도 동일한 `mode=reauthorize` 를 사용한다. callback 핸들러가 `integration.status` 를 추가로 확인해 두 케이스를 분기하는 구조이지만 (§10.4 에러 매핑), 이 invariant — "mode=reauthorize 이어도 status=pending_install 이면 error 전이 없이 status 보존" — 는 어디에도 명시된 Rationale 이 없다. 미래 유지보수자가 `mode=reauthorize` callback 을 수정할 때 이 이중 의미를 놓칠 위험이 있다.
  - 제안: DRAFT 2I Rationale 에 "왜 `mode=cafe24_private_install` 같은 전용 mode 를 만들지 않고 `reauthorize` 를 재사용했는지" 한 단락을 추가한다. 또는 `mode` enum 에 `cafe24_private_install` 을 신설하고, callback 분기를 `status` 에 의존하지 않고 `mode` 로 처리하도록 명시한다.

---

- **[WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 앱 레벨 체크의 구현 가능성 미명시**
  - target 위치: DRAFT 2F §9.4 에러 코드 정의, DRAFT 2F-bis `POST /oauth/begin` 중복 가드, DRAFT 2I Rationale "install_token TTL 24h" 단락 내 race condition 설명
  - 과거 결정 출처: `spec/1-data-model.md` §2.10 — `credentials` 컬럼이 encrypted JSONB
  - 상세: draft 는 "`mall_id` 가 암호화 JSONB 안에 있어 DB 유니크 인덱스 불가 → 앱 레벨 체크"라고 설명한다. 그런데 앱 레벨 체크 자체가 `(workspaceId, mall_id, app_type='private')` 로 기존 connected Integration 을 찾아야 하는데, `mall_id` 가 암호화 JSONB 에 있다면 워크스페이스의 모든 Cafe24 Integration 을 decrypt 후 비교해야 한다. 이 구현 방법이 spec 어디에도 명시되지 않았다. 실제로는 `mall_id` 가 별도 plain 컬럼으로 저장되어 있을 수 있으나 (DRAFT 3D `integration_oauth_state.provider_meta` 에는 mall_id 포함이 명시됨), `integration` 테이블의 `mall_id` 저장 방식이 draft 어디에도 서술되어 있지 않다.
  - 제안: DRAFT 1B 또는 DRAFT 2I Rationale 에 "앱 레벨 중복 체크는 begin 요청 페이로드의 `mall_id` 를 워크스페이스 내 `service_type='cafe24' AND status='connected'` 행과 비교한다 — `mall_id` 는 [plain column / credentials 내 특정 path 등] 에서 추출" 한 문장을 추가해 구현 경로를 명확히 한다.

---

- **[WARNING] 기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 정보 노출 방지 통합 정책 번복 — Rationale 부분 제시**
  - target 위치: DRAFT 2E §9.2 install 라인 (replace), DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격"
  - 과거 결정 출처: 기존 spec §9.2 — `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함 — 정보 노출 방지)` — 두 케이스를 403 으로 통합한 이유가 명시됨
  - 상세: 기존 spec 은 "pending 미발견" 과 "HMAC 불일치" 를 같은 403 으로 응답해 공격자가 "이 mall_id 에 pending row 가 있는지" 를 판별하지 못하게 하는 보안 선택이었다. draft 는 이를 번복해 `CAFE24_INSTALL_INVALID_TOKEN(404)` 를 분리하며, Rationale 로 "토큰 추측 불가능 가정" 을 제시한다. 번복 자체는 합리적이나 Rationale 가 "32바이트 hex 는 추측 불가능하므로" 라는 전제만 두고 엔트로피 근거(256^32 경우의 수 등)나 참조 기준(OWASP 등)을 제시하지 않아, 훗날 토큰 길이 단축·생성 방식 변경 시 이 보안 가정이 조용히 깨질 수 있다.
  - 제안: DRAFT 2I 의 해당 Rationale 단락에 "32바이트(256비트) 의 cryptographic random hex 는 brute-force 가 현실적으로 불가능하다 — 이 전제가 깨지면(토큰 길이 단축, PRNG 변경 등) `CAFE24_INSTALL_INVALID_TOKEN` 을 다시 403 으로 통합해야 한다" 한 문장을 명시해 역전 조건을 기록한다.

---

- **[INFO] DRAFT 3A `expired --> [*]: manual delete (install_timeout 케이스)` — 일반 expired 삭제 경로와의 중복·모호성**
  - target 위치: DRAFT 3A §3.1 상태 전이 다이어그램 diff
  - 과거 결정 출처: 기존 `spec/data-flow/integration.md` §3.1 — `connected --> [*]: 삭제` 전이 존재
  - 상세: 추가된 `expired --> [*]: manual delete (install_timeout 케이스)` 는 `install_timeout` 케이스에만 삭제가 가능한 것처럼 읽힌다. 그러나 `token_expired` / `refresh_failed` 로 만료된 행도 수동 삭제가 가능하다. 기존 다이어그램에 일반 `expired --> [*]` 전이가 이미 있다면 중복이고, 없다면 일반 만료 행의 삭제 경로가 누락된다.
  - 제안: `(install_timeout 케이스)` qualifier 를 제거하고 `expired --> [*]: manual delete` 로 단순화한다. install_timeout 특이사항은 `pending_install --> expired` 전이 설명에서 이미 다루고 있으므로 충분하다.

---

- **[INFO] `install_token UNIQUE` 제약 결정 및 legacy 경로 폐기 시점이 plan 에 미추적**
  - target 위치: DRAFT 1D 인덱스 주석, DRAFT 2E deprecated 경로 설명, DRAFT 2I Rationale
  - 상세: (a) `install_token UNIQUE` 제약 여부는 "운영 시점에 결정"으로 유예됐으나 "consistency-check 후 후속 작업" 섹션에 이 후속 항목이 없다. (b) legacy 경로(`/oauth/install/cafe24`) 영구 폐기 시점은 Rationale 에서 "`plan/in-progress/cafe24-pending-polish.md` 후속 항목으로 추가"를 약속했으나 역시 후속 작업 목록에 없다.
  - 제안: "consistency-check 후 후속 작업" 섹션에 두 항목을 명시적으로 추가한다 — `cafe24-pending-polish.md` 에 (a) install_token UNIQUE 제약 운영 검토 항목, (b) legacy 410 경로 영구 폐기 검토 항목을 삽입.

---

### 요약

draft 의 핵심 번복 2건(auto-delete → expired 전이, HMAC 에러 코드 통합 해제)은 모두 `**번복 acknowledgment**` 태그와 DRAFT 2I Rationale 를 통해 명시적으로 기록되어 있어 의사결정 연속성 측면에서 양호하다. 다만 `OAuthState.mode='reauthorize'` 를 초기 private install 에 재사용하는 이유가 Rationale 에 없고, 앱 레벨 중복 체크의 구현 경로(암호화 JSONB 안에 있는 `mall_id` 접근 방법)가 명시되지 않은 두 가지 점이 미래 유지보수 위험으로 남는다. 기존 정보 노출 방지 정책의 보안 가정 역전 조건도 Rationale 에 명문화할 필요가 있다.

### 위험도

**MEDIUM** — 구현 시 `mode` 의미 모호성이 callback 핸들러 버그로, `mall_id` 접근 방법 미명시가 잘못된 구현으로 이어질 수 있다. spec 적용 전 두 WARNING 을 해소하거나 명시적으로 결정을 기록할 것을 권장한다.