## Rationale Continuity Check 결과

### 발견사항

대상 문서(`spec/2-navigation/4-integration.md`) 본문이 `(없음)` — 신규 spec 변경 내용이 없어, 해당 spec 의 기존 Rationale 과 타 spec Rationale 간 교차 정합성을 점검합니다.

---

- **[INFO]** install_token "path-format mismatch" 표현의 구현 해석 여지
  - target 위치: `spec/2-navigation/4-integration.md` Rationale §"기존 `pending_install` 행 마이그레이션 생략"
  - 과거 결정 출처: 같은 문서 Rationale §"CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"
  - 상세: "새 라우트로 호출 자체가 path-format mismatch 로 404" 라는 표현은 ① 라우트 레벨 포맷 검증(22자 base64url 여부 명시 거부) 또는 ② DB lookup miss → `CAFE24_INSTALL_INVALID_TOKEN(404)` 자연 반환 두 가지로 해석 가능. Rationale 는 어느 경로인지를 명시하지 않음. 보안 전제 섹션은 "128-bit 이상 random 이면 추측 불가능" 을 전제로 404 분리를 허용하는데, 포맷 검증 없이 DB miss 만으로 404 를 내도 이 전제는 유지되므로 보안 위협은 없음. 다만 구현자가 "별도 regex guard 를 넣어야 하는가" 를 오판할 가능성.
  - 제안: 구현 시 DB lookup miss (no-match → 404) 로 충분함을 plan 코멘트로 명시. 라우트 레벨 format guard 는 불필요.

---

- **[INFO]** TTL 스캐너의 `COALESCE` 패턴 — 구현 의무 명시
  - target 위치: `spec/2-navigation/4-integration.md` Rationale §"install_token TTL 24h" (TTL 기준 2026-05-15 갱신)
  - 과거 결정 출처: 같은 항목 내 "옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback"
  - 상세: 이 `COALESCE` 는 구현 필수 패턴인데 spec 본문(스캐너 쿼리 섹션)에 박혀 있어야 할 내용이 Rationale 에만 있음. 구현자가 Rationale 를 끝까지 읽지 않으면 `install_token_issued_at IS NULL` 인 레거시 행이 스캐너 바깥으로 빠질 수 있음.
  - 제안: 구현 시 TTL 스캐너 SQL 에 `COALESCE(install_token_issued_at, created_at)` 반영 여부를 체크리스트로 확인. spec 본문 스캐너 쿼리 섹션에도 이 패턴이 명시되어 있는지 착수 전 재확인.

---

### 요약

`spec/2-navigation/4-integration.md` 의 Rationale 는 `spec/1-data-model.md` 와 상호 cross-reference 가 정합하며, 명시적으로 기각된 대안들(OAuthState `mode='cafe24_private_install'` 신설 기각, install timeout 시 자동 삭제 기각, Cafe24 Private callback 실패 시 `error` 전이 기각)은 모두 근거와 함께 기록되어 있음. install_token 128-bit 단축은 스스로 세운 보안 전제(96-bit 이상)를 준수하며, mall_id plain 컬럼 + UNIQUE 인덱스 로의 전환도 data-model spec Rationale 와 일치함. 번복 없이 결정이 연속됨. 다만 스캐너 COALESCE 패턴과 token 포맷 검증 여부는 Rationale 가 유일한 정보 출처이므로 구현 착수 전 확인 필요.

### 위험도

**LOW** — Critical/Warning 없음. INFO 2건은 구현 착수 시 확인 사항.