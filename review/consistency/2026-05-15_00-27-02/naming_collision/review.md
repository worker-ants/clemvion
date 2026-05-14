## Naming Collision Check 결과

**검토 범위**: `spec/1-data-model.md` — `install_token_issued_at`, `mall_id` 신규 필드 및 V044/V045 마이그레이션

---

### 발견사항

- **[INFO]** `mall_id` 평문 컬럼 vs `credentials.mall_id` JSONB 동명 필드 공존
  - target 신규 식별자: `Integration.mall_id` (VARCHAR plain column)
  - 기존 사용처: `Integration.credentials` JSONB 내 `mall_id` 키 (`spec/1-data-model.md` §2.10 credentials 설명)
  - 상세: 동일 이름이 다른 레이어(plain column vs encrypted JSONB 내 키)에 존재. spec 이 "credentials.mall_id 의 plain projection" 으로 명확히 기술하고 있어 혼선 여지는 낮으나, 코드에서 `row.mall_id` 와 `row.credentials?.mall_id` 를 동시에 다룰 때 오타 위험이 남는다.
  - 제안: 현재 spec 의 설명으로 충분. 코드 레벨에서 lint/타입 엄격성으로 보완하면 무관.

---

### 기타 확인 항목 (충돌 없음)

| 식별자 | 판정 | 근거 |
|--------|------|------|
| `install_token_issued_at` | NONE | corpus 에 동명 필드 없음. `install_token` 의 자연 확장 |
| `V044__integration_install_token_issued_at` | NONE | V043 다음 순번. `.sql` 단독 (트랜잭션 안전) |
| `V045__integration_mall_id_plain` | NONE | V044 다음 순번. `CONCURRENTLY` 사용에 따른 `.conf` 페어 동봉 — 규약 준수 |
| `(workspace_id, mall_id) WHERE …` 부분 UNIQUE 인덱스 | NONE | 기존 인덱스 목록과 key 겹침 없음 |

---

### 요약

새로 도입되는 식별자(`install_token_issued_at`, `mall_id` 평문 컬럼, V044/V045 마이그레이션)는 corpus 내 기존 이름과 충돌하지 않는다. `mall_id` 의 dual representation(plain column + JSONB 키) 은 spec 에 명시적으로 기술되어 있어 의미 혼선이 낮다.

### 위험도

**LOW** — Critical/Warning 없음. 구현 착수 가능.