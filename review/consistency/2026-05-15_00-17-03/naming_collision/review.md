`spec/1-data-model.md`의 변경 내용을 검토합니다. 새로 추가된 식별자(`install_token_issued_at`, `mall_id` plain 컬럼, 관련 인덱스, `pending-install-ttl` job 참조)를 대상 코퍼스와 교차 검증합니다.

---

## 발견사항

### [INFO] `mall_id` 컬럼 — JSONB 경로와 동일 이름

- **target 신규 식별자**: `Integration.mall_id` (top-level plain String? 컬럼, V045)
- **기존 사용처**: `Integration.credentials` JSONB 내부의 `credentials.mall_id` 경로. `spec/conventions/cafe24-api-metadata.md` §5 에서도 `mall_id` 를 Cafe24 상점 식별자로 참조.
- **상세**: 동일 엔티티 내에서 top-level `mall_id`와 `credentials.mall_id`(JSONB 경로)가 공존하여, ORM 코드 작성 시 `entity.mallId` ↔ `entity.credentials.mallId` 혼동 가능성이 있음. 단, spec 본문에 "credentials.mall_id 와 동일 값을 plain 컬럼으로 복제"라고 명시되어 있어 의도적 설계임.
- **제안**: 의도적 설계이므로 이름 변경 불필요. 단, ORM entity 파일에 JSDoc 또는 주석으로 "credentials.mall_id 의 plain projection" 임을 명시하면 혼동 방지에 도움됨.

---

### [INFO] `pending-install-ttl` job 이름 — 기존 expiry scanner 큐와의 관계 미명시

- **target 신규 식별자**: `install_token_issued_at` 설명에서 참조되는 BullMQ job 이름 `pending-install-ttl`
- **기존 사용처**: 커밋 메시지 `refactor(integration): integration-expiry 3 개 pass 별 BullMQ job 분리`에서 expiry scanner가 3개 pass로 분리된 것이 확인됨. 기존 `token-expiry` 류 job과 별개로 신규 job이 추가된 것으로 보임.
- **상세**: spec 본문은 `pending-install-ttl` job을 참조하지만, 분리된 3개 pass의 전체 이름 목록이 spec 어디에도 명시되지 않아 코드-spec 간 이름 일치 여부를 spec만으로 검증할 수 없음. 실제 코드(`integration-expiry-scanner.service.ts`)와의 일치 확인이 필요.
- **제안**: `spec/1-data-model.md` 또는 `spec/data-flow/integration.md`에 3개 BullMQ job 이름(예: `token-expiry`, `pending-install-ttl`, 나머지 1개)을 한 줄로 열거하면 향후 일관성 검증이 용이함.

---

### 이상 없음

| 식별자 | 검토 결과 |
|--------|-----------|
| `install_token_issued_at` | 기존 `*_at` timestamp 패턴(`token_expires_at`, `last_used_at`, `last_rotated_at`)과 일치. 타 엔티티와 충돌 없음 |
| Partial UNIQUE index `(workspace_id, mall_id) WHERE service_type='cafe24'` | 기존 `(install_token) WHERE install_token IS NOT NULL` 인덱스와 동일 패턴. 인덱스 설명 중복 없음 |
| V044, V045 마이그레이션 번호 | 현재 최신 번호(V043 이후)로 단조 증가. `spec/conventions/migrations.md` 규약 충족 |

---

## 요약

CRITICAL·WARNING 수준의 명명 충돌은 없습니다. `mall_id` plain 컬럼이 동일 엔티티의 `credentials.mall_id` JSONB 경로와 이름이 겹치나 spec에 의도적 설계로 문서화되어 있으며, 두 INFO 항목 모두 구현 차단 사유가 아닙니다.

## 위험도

**LOW**