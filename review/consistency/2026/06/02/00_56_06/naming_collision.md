# 신규 식별자 충돌 검토 결과

## 검토 대상

- **Target 영역**: `spec/4-nodes/4-integration/` (0-common.md / 1-http-request.md / 2-database-query.md / 3-send-email.md / 4-cafe24.md)
- **검토 모드**: 구현 착수 전 검토 (--impl-prep)
- **신규 도입 식별자**: `plan/in-progress/cafe24-install-ratelimit.md` (A-3) 에서 정의된 상수·Redis 키
  - `INSTALL_FAIL_THRESHOLD` (코드 상수, 값 10)
  - `INSTALL_FAIL_WINDOW_SEC` (코드 상수, 값 600)
  - Redis 키 `cafe24:install:fail:{ip}`
  - (Layer 3 deferred) `cafe24:install:global`

---

## 발견사항

- **[INFO]** `INSTALL_FAIL_THRESHOLD` / `INSTALL_FAIL_WINDOW_SEC` — 기존 상수 어휘와 비충돌, 신규 도입
  - target 신규 식별자: `INSTALL_FAIL_THRESHOLD`, `INSTALL_FAIL_WINDOW_SEC`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/spec/4-nodes/4-integration/4-cafe24.md` §9.8 "관련 코드 상수" 테이블에 `RECOVERY_CANDIDATE_LIMIT` (값 5) 와 nonce key hmac prefix 길이 (값 8) 만 존재. `INSTALL_FAIL_THRESHOLD` / `INSTALL_FAIL_WINDOW_SEC` 명칭은 spec 및 codebase 어느 곳에서도 미사용.
  - 상세: 동일 테이블에 병기 예정이므로 의미 충돌 없음. 다만 기존 상수 2개는 보안 조치를 서술하는 자유형 설명이므로 테이블 형식 통일이 필요한지 편집 시 확인 권장.
  - 제안: 변경 없음. 기존 테이블의 행 추가 형태로 자연스럽게 확장 가능.

- **[INFO]** Redis 키 `cafe24:install:fail:{ip}` — 기존 `cafe24:install:nonce:*` 네임스페이스와 시맨틱 분리 명확
  - target 신규 식별자: `cafe24:install:fail:{ip}`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/spec/4-nodes/4-integration/4-cafe24.md` §9.8 키 구성 — `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}`. 구현 파일 `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts` 에서 `cafe24:install:nonce:` prefix 사용.
  - 상세: `cafe24:install:` 네임스페이스 공유이나 세 번째 세그먼트가 `nonce` vs `fail` 로 구분되어 충돌 없음. nonce 키는 mall_id 기반, fail 키는 IP 기반으로 시맨틱도 직교.
  - 제안: 변경 없음. 단 spec §9.8 에 이 키를 명시할 때 기존 nonce 키 문서와 인접 배치하면 Redis 키 인벤토리 가독성이 높아진다.

- **[INFO]** (Layer 3 deferred) `cafe24:install:global` — 현재 spec/코드 미존재, 예약 공간으로 충돌 없음
  - target 신규 식별자: `cafe24:install:global` (plan 에서 deferred 명시)
  - 기존 사용처: spec 및 codebase 전체 검색 결과 해당 키 미사용.
  - 상세: 본 PR 범위 밖으로 명시됐으나, 추후 도입 시 기존 `cafe24:install:nonce:*` / `cafe24:install:fail:*` 와 시맨틱이 명확히 다르므로 충돌 위험 없음.
  - 제안: 변경 없음. Layer 3 도입 시 spec §9.8 키 목록에 추가.

- **[INFO]** 기존 throttle `@Throttle({ default: { limit: 30, ttl: 60_000 } })` — Layer 1(Redis store 이전)의 대상 식별자로 중복 아님
  - target 신규 식별자: Redis 분산 throttle store 전환 (plan Layer 1)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` L52 — `@Throttle({ default: { limit: 30, ttl: 60_000 } })` (in-memory pod별).
  - 상세: 동일 `@Throttle` decorator 를 유지하되 store 만 교체하는 방식이므로 API 식별자 자체 충돌 아님. spec §9.8 에는 현재 이 throttle 에 대한 명시가 없으므로, spec 갱신 시 `30/min` 상수와 Redis store 전환 사실을 "보안 추가 조치" 에 함께 기술할 필요가 있다.
  - 제안: spec §9.8 에 throttle 상수 (`30req/min`, Layer 1) 를 관련 코드 상수 테이블에 추가하고, Layer 2 의 `INSTALL_FAIL_THRESHOLD` / `INSTALL_FAIL_WINDOW_SEC` 와 함께 문서화.

---

## 요약

target(`spec/4-nodes/4-integration/`) 이 도입하는 신규 식별자(`INSTALL_FAIL_THRESHOLD`, `INSTALL_FAIL_WINDOW_SEC`, `cafe24:install:fail:{ip}`)는 기존 코드·spec 어느 곳에서도 다른 의미로 사용 중인 사례가 없다. Redis 키 네임스페이스 `cafe24:install:` 는 이미 nonce 키가 점유 중이나 세 번째 세그먼트(`fail` vs `nonce`)로 충분히 분리된다. CRITICAL / WARNING 수준의 식별자 충돌은 발견되지 않았으며, INFO 수준의 개선 제안(spec 상수 테이블 병기, 기존 throttle 30/min 상수 문서화)만 도출됐다.

---

## 위험도

NONE
