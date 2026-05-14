## 발견사항

### [INFO] ✅ O(N) mall_id 스캔 → O(1) install_token 단일 조회로 전환
- **위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.8` 식별 전략 (2026-05-14 갱신)
- **상세**: 기존 방식은 워크스페이스 내 최대 N개의 `pending_install` row를 in-memory 로드한 뒤 trial HMAC을 반복 검증하는 O(N) 구조였다. 새 방식은 URL path의 `:installToken`으로 단일 row를 조회하고 HMAC을 1회만 검증한다. `spec/1-data-model.md §3`에 부분 인덱스 `(install_token) WHERE install_token IS NOT NULL`도 동시 추가되어 O(1) 조회가 보장된다.
- **제안**: 개선 방향이 옳다. 부분 인덱스는 NULL 행을 제외하므로 인덱스 크기도 최소화된다. 추가 조치 불필요.

---

### [WARNING] 스캐너 잡이 단일 쿼리 → 두 쿼리로 확장됨 — 배치 정책 미명시
- **위치**: `spec/data-flow/integration.md §1.4` (DRAFT 3C-bis) / `spec/2-navigation/4-integration.md §11.1`
- **상세**: 기존 스캐너는 `token_expires_at` 기반 쿼리 1개만 실행했다. 변경 후 `pending_install` TTL 만료 쿼리가 추가되어 동일 Cron 주기에 DB 쿼리가 2회 실행된다. 두 쿼리의 실행 순서(순차/병렬), 하나가 실패할 때 다른 쿼리의 처리 여부, 트랜잭션 경계가 spec에 명시되어 있지 않다.
- **제안**: §11.1 pseudo-code 또는 §1.4에 "두 쿼리는 독립적으로 실행 (실패 시 서로 영향 없음)" 또는 "배치 LIMIT 적용 여부" 한 줄을 명시해 구현자가 트랜잭션/배치 경계를 잘못 설계하는 것을 방지한다.

---

### [WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 중복 가드 — encrypted JSONB 내 `mall_id` 조회 성능 미명시
- **위치**: `spec/2-navigation/4-integration.md §9.2` (DRAFT 2F-bis) / `review/consistency/2026-05-14_17-58-37/rationale_continuity/review.md`
- **상세**: `(workspaceId, mall_id, app_type='private')` 조합의 `connected` Integration 존재 여부를 확인해야 하는데, `mall_id`가 암호화 JSONB 컬럼 안에 있다. DB 유니크 인덱스를 걸 수 없으므로 앱 레벨 체크가 불가피하지만, 이 경우 워크스페이스 내 Cafe24 Integration을 모두 decrypt한 뒤 비교하는 O(N) 연산이 발생할 수 있다. rationale 리뷰(17:58 세션)에서도 "구현 방법이 spec 어디에도 명시되지 않았다"고 지적했다.
- **제안**: spec `§9.2` 또는 `§10.2 Rationale`에 "`mall_id` 중복 체크는 begin 요청 페이로드의 `mall_id`를 워크스페이스 내 `service_type='cafe24' AND status='connected'` 행과 비교한다 — `mall_id`는 [plain column / credentials의 특정 path 등]에서 추출" 한 문장을 명시해야 한다. `mall_id`가 plain column으로 따로 저장된다면 인덱스 활용이 가능하므로 우선 확인이 필요하다.

---

### [INFO] `(workspace_id, status)` 복합 인덱스 다목적 재사용 — 용도 확장 기록
- **위치**: `spec/1-data-model.md §3` 인덱스 표 (변경된 설명)
- **상세**: 기존 "만료/에러 상태 배지 카운트" 단일 용도에서 "pending_install TTL 스캐너 조회 + 중복 방지 lookup" 이 추가되었다. 인덱스 설계 자체는 올바르고, 새 용도들도 `status` 조건 필터를 사용하므로 인덱스가 효과적으로 활용된다.
- **제안**: 추가 조치 불필요. 인덱스 재사용으로 추가 인덱스 생성을 피한 것은 적절하다.

---

### [INFO] BullMQ `reason` 필드 추가 — 직렬화 오버헤드 미미
- **위치**: `spec/data-flow/integration.md §1.4` (DRAFT 3C-bis)
- **상세**: `{ integrationId }` → `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 로 메시지 크기가 소폭 증가한다. 큐 메시지 크기 변화가 수십 바이트 수준이므로 성능 영향은 무시 가능하다.
- **제안**: 추가 조치 불필요.

---

## 요약

이번 변경의 핵심 성능 개선은 `install_token` 단일 row 조회(O(1)) + 부분 인덱스 도입으로, 기존 O(N) in-memory 스캔 방식을 명확하게 대체한다. 이는 올바른 방향이다. 주요 잔류 위험은 두 가지다: (1) 스캐너 잡이 쿼리 2개로 확장되었는데 실패 격리·배치 정책이 미명시되어 구현자가 트랜잭션 경계를 잘못 설계할 수 있고, (2) `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 중복 가드에서 encrypted JSONB 내 `mall_id` 접근 방법이 명시되지 않아 O(N) decrypt 반복이 발생할 가능성이 있다. 전자는 spec 1줄 보강으로 해소 가능하며, 후자는 `mall_id` 저장 방식 확인이 선행되어야 한다.

## 위험도

**LOW** — 핵심 hot path(install callback)는 O(N)→O(1)으로 명확히 개선되었고, 나머지 이슈는 스캐너(배치 잡)와 begin 요청(빈도 낮음)에 한정되어 즉각적 성능 위협은 없다.