### 발견사항

이 검토는 `plan/in-progress/spec-draft-data-model-install-token-followup.md` 가 제안하는 `spec/1-data-model.md §2.10` 두 컬럼 설명 정정이 기존 spec Rationale 과 충돌하는지를 검토한다.

검토 대상 변경:
1. `Integration.install_token`: "callback 성공 시 NULL" → "callback 성공 시 보존, expired/삭제 시에만 NULL"
2. `Integration.install_token_issued_at`: "callback 성공 시 NULL" → "callback 성공 시 보존, expired/삭제 시에만 NULL"

---

기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 충돌 — 네 관점 모두에서 충돌 없음.

**근거 추적:**

- `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)": `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로) 을 명시적으로 결정.
- 동 Rationale "install_token TTL 24h (2026-05-16 보강)": `callback 성공 시 install_token 과 install_token_issued_at 모두 보존. 옛 NULL 처리 기술은 "install_token persistent 격상" 결정과 미정합 표기 잔존이었다` 를 명시적으로 인정하고 기록.
- NULL 처리가 유지되는 경로(`pending_install → expired (install_timeout)` 의 24h TTL 만료, 통합 삭제) 도 Rationale 에서 명시 — target 변경이 이 구분을 그대로 반영.
- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` invariant: connected 전이 후 token 이 보존됨으로써 해당 행이 UNIQUE 인덱스 범위에 포함되어 더 강하게 보호됨. invariant 우회 없음.

검출된 이슈 없음.

---

### 요약

target 문서 (`spec/1-data-model.md §2.10` 두 컬럼 설명 정정) 는 2026-05-15 에 `spec/2-navigation/4-integration.md` Rationale 에 기록된 "install_token persistent 격상" 결정과 2026-05-16 보강 기술을 데이터 모델 spec 에 동기화하는 drift 정정이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 invariant 우회 — 네 관점 어느 것에서도 충돌이 발견되지 않는다. 변경 의도(연결 성공 후 token 보존)와 Rationale 에 명시된 결정 방향이 완전히 일치하며, NULL 처리가 유지되는 경로(TTL 만료, 삭제) 도 Rationale 과 정합한다.

### 위험도

NONE
