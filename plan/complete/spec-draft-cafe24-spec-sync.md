---
worktree: cafe24-spec-sync-e2a8b9
started: 2026-05-16
owner: project-planner
---

# Cafe24 spec drift 정리 (PR #56·#67 머지 후 후속)

PR #56 (BullMQ refresh queue + 백그라운드 갱신) + PR #67 (Critical 11 + High 11 follow-up) 머지 결과, 구현이 spec 보다 ahead 인 4건과 spec ↔ 구현 용어 충돌 1건 (총 5건) 을 spec 에 반영한다.

**v2 (2026-05-16 갱신)** — consistency-check (`review/consistency/2026/05/16/10_59_52`) 결과 BLOCK: YES 였던 Critical 4건 + Warning 5건을 본 draft 에 흡수.

## 변경 대상

### 1. `spec/2-navigation/4-integration.md`

#### §6 상태 전이 표 (REQ HIGH-2)

refresh 실패 전이를 `connected → expired` 에서 `connected → error(auth_failed)` 로 정정.

- 옛: `connected → expired | 매일 스캐너 또는 노드 실행 중 토큰 갱신 실패 (refresh fail)`
- 새: `connected → error(auth_failed) | 노드 실행 중 401/403 또는 매일 스캐너 / 노드 실행 중 토큰 갱신 실패 (refresh_token invalid_grant)`
- **삭제**: `connected → expired` 행 자체를 삭제. `expired` 는 이제 `pending_install → expired (install_timeout)` 한 경로만 사용.
- `connected → error(network)` 추가 — 노드 실행 중 transport 실패 3회 연속 (PR #67 의 REQ-C2 V049 컬럼 + counter).
- `connected → error(insufficient_scope)` 기존 행 유지 — 노드 실행 중 403 + scope 시그널 (PR #67 의 REQ-C3 구현 명시 부분).
- 변경 노트: refresh_token 없는 provider (Google/GitHub 등) 는 본 변경 영향 없음 — 그 경우 `expired` 가 아니라 `error(auth_failed)` 로 떨어지는 점에는 차이 없음 (refresh 자체가 없음).

#### §9.2 인증 / 회전 / Scope (SPEC-4 부속)

install 엔드포인트 에러 목록에 `CAFE24_INSTALL_MISSING_PARAMS (400)` 추가 (consistency check info-2).

#### §9.4 공통 응답 포맷 (SPEC-4)

`CAFE24_INSTALL_MISSING_PARAMS (400)` 코드 추가.
- 위치: `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_INSTALL_REPLAY` 와 같은 그룹.
- 의미: App URL 의 `mall_id` / `timestamp` / `hmac` 중 하나라도 누락.

#### §10.5 토큰 자동 갱신

REQ HIGH-2 부수 갱신 + SPEC-2 cross-link.
- "갱신 실패 시: 상태 `expired`" → "갱신 실패 시: `refresh_token` 자체가 무효 (`invalid_grant`) 면 `error(auth_failed)`, transport 실패 3회 연속이면 `error(network)`. `expired` 로의 전이는 더 이상 일어나지 않는다 (§6 참고)."
- Cafe24 한정 항목 하단에 "백그라운드 갱신은 §11.1 의 `cafe24-background-refresh` 잡 참조" 노트 추가.

#### §11 진입 블록쿼트 (consistency check warning-3)

"세 개의 독립 BullMQ job (`connected-expiry` / `pending-install-ttl` / `usage-log-prune`)" → "네 개의 독립 BullMQ job (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`)" 로 갱신.

#### §11.1 스캐너 잡 (SPEC-2)

4번째 잡 `cafe24-background-refresh` 추가.
- 빈도: daily 00:00 UTC.
- 대상: `status='connected' AND service_type='cafe24' AND (last_rotated_at < now - 10d OR last_rotated_at IS NULL)`.
- 동작: 각 통합을 `cafe24-token-refresh` 큐로 enqueue (`jobId = integrationId` dedup). 실제 refresh 는 worker (Cafe24TokenRefreshProcessor) 가 수행.
- 임계 근거: refresh_token 14일 유효 - 4일 안전 마진.
- 본문 노트: "잡은 enqueuer 역할이며 실제 갱신은 `cafe24-token-refresh` 큐의 worker 가 수행" (consistency check info-8 의 혼동 방지).
- 잡 4개의 표 갱신.

#### §11.2 알림 메시지 (consistency check warning-4)

`Reauthorize to continue.` 의 실제 구현 메시지 (`using it.` 추가) 와 일치하도록 갱신. 추가로 `connected → error(auth_failed)` 전이에서도 동일한 `integration_expired` 알림이 발사되는지 정책 명시 — 현재 구현: `error` 전이는 별도 알림 (없음 — UI 배지로만 표시). spec 본문에 "refresh 실패로 `error(auth_failed)` 전이 시에는 `integration_expired` 알림을 발사하지 않으며 UI 배지로만 표시" 명시.

#### ## Rationale 추가 항목

> **C-4 직렬화 합의 (plan_coherence)**: `spec-update-cafe24-install-recovery.md`(worktree `cafe24-install-recovery-8b3c4d`) 의 미완 체크박스 `[ ] spec 갱신 (Rationale 추가)` 항목과 동일 섹션 충돌. **본 plan 이 SPEC-1 Rationale 작성을 인수**하고, 그 plan 의 체크박스는 본 plan 머지 후 "spec-draft-cafe24-spec-sync.md 에서 처리됨" 으로 mark 후 plan/complete 로 이동시킨다. (구현은 이미 main 에 머지 — 머지 commit `30f68b39`).

추가할 Rationale 항목:

**[Rationale 섹션 신규 항목 1]** "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" (SPEC-3):
- §9.6 (`spec/4-nodes/4-integration/4-cafe24.md`) 의 미결 사항 (Redis 분산 mutex) 이 BullMQ `jobId = integrationId` dedup 으로 해소됨.
- 비교: PostgreSQL advisory lock vs Redis redlock vs BullMQ — BullMQ 채택 이유 (이미 스택, 백그라운드 스캐너와 같은 인프라 공유, jobId 자연 dedup).
- 작동 원리: 두 pod 이 같은 통합 refresh 를 enqueue 하면 BullMQ 가 같은 job 참조 반환 → 모두 동일 worker 의 결과 공유 (`waitUntilFinished` + DB 재로드).

**[Rationale 섹션 신규 항목 2]** "`cafe24-background-refresh` 10일 임계" (SPEC-2):
- refresh_token 14일 유효 - 4일 마진 = 10일.
- 매일 호출하지 않는 이유: Cafe24 leaky bucket 부담 vs 안전 마진 trade-off.
- 신규 통합 처리: `lastRotatedAt = create() 시점 new Date()` (PR #67 의 DB-1 fix) + `Or(IsNull(), LessThan(cutoff))` (belt-and-suspenders) 로 14일 idle 통합도 자동 갱신.

**[Rationale 섹션 신규 항목 3]** "Cafe24 install_token mismatch 회복 흐름" (SPEC-1):
- `tryRecoverByMallId` 가 production 에 존재하는 이유 — 사용자가 Cafe24 Developers 에 등록한 App URL 이 stale token (옛 row 삭제 후 재등록, 폼 재제출로 token 재발급 등) 일 때 mall_id 매칭 + HMAC trial 1회 (client_secret 으로 서명 자체 검증) 로 회복 가능.
- 보안 전제 — HMAC trial 통과는 client_secret 보유의 증명이므로 별도 권한 escalation 없음. **HMAC 검증을 유지하므로 본 회복 흐름은 §9.8 Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 의 capability-token 가정을 깨지 않는다** (consistency check info-3 반영).
- DoS 방지 — `RECOVERY_CANDIDATE_LIMIT=5` 로 후보 상한, overflow 시 회복 포기 (404).
- 옛 spec 의 "100건 스캔 + trial HMAC 폐기" 와 본 회복 흐름의 관계: 옛 흐름은 install_token 자체가 없던 시절의 모든 호출에 적용되는 식별 전략이었고, 새 회복 흐름은 단일 row 조회 실패 시에만 fall-back 으로 작동하는 좁은 보정 경로다 (정상 흐름은 install_token 단일 row 조회 그대로).

**[Rationale 섹션 신규 항목 4]** "refresh 실패 시 status_reason 통일" (REQ HIGH-2):
- spec 의 `expired` (terminal) 와 구현의 `error(auth_failed)` 가 충돌했었음.
- 결정: `error(auth_failed)` 채택. 이유: (a) UI 가 reauthorize 액션을 권장하기에 더 자연스러움 (expired 는 자동 재발급 시도 후 만료 의미가 강함), (b) refresh_token 자체 만료 (terminal — Cafe24 가 14일 후 invalidate) 와 access_token 만료 (자동 회복 가능) 를 의미적으로 구분 보존. expired status 는 이제 install_timeout 한 경로만 사용.
- 데이터 모델 변경 없음 — status_reason 컬럼 값 정의만 갱신 (`spec/1-data-model.md §2.10` 참고).
- 부수 갱신: 기존 Rationale 항 "Cafe24 Private 의 `connected → expired` 복구 경로 (2026-05-14)" 에 `(2026-05-16 갱신: refresh_fail 경로는 error(auth_failed) 로 변경 — REQ HIGH-2)` 주석 추가 (consistency check info-4).

### 2. `spec/4-nodes/4-integration/4-cafe24.md`

#### §4 step 6 (consistency check critical-1)

refresh 실패 시 status 전이 표기 갱신. 옛: "갱신 실패 시 status 를 `expired` 로 전이". 새: "갱신 실패 시 `refresh_token invalid_grant` 면 `error(auth_failed)`, transport 3회 연속 실패면 `error(network)` 로 전이 ([§통합 §6 상태 전이](../../2-navigation/4-integration.md#6-상태-전이)). `INTEGRATION_NOT_CONNECTED` throw 동작은 동일."

#### §9.6 Rate Limit 의 범위 한정 (SPEC-3)

- "Redis 기반 분산 mutex 도입은 별도 spec 으로 — 운영 부하 vs 호출 효율의 trade-off 가 도입 시점에 결정." 문장을:
- "**(2026-05-16 갱신)** PR #56 의 BullMQ `cafe24-token-refresh` 큐 (`jobId = integrationId` dedup) 로 cross-pod refresh 직렬화는 해소됨. 본 §9.6 의 `Cafe24ApiClient` in-memory mutex 는 **API 호출의 leaky-bucket 직렬화**만 담당 (cross-pod 직렬화는 Cafe24 leaky bucket 자체가 per-mall quota 라 backoff 신호로 처리 가능 — 별도 분산 mutex 불필요)." 로 갱신.
- 자세한 큐 도입 배경은 `spec/2-navigation/4-integration.md ## Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소"` 항으로 cross-link.

#### §9.8 Private 앱 App URL HMAC 검증

두 부분 갱신:
- 코드 예제의 `encodeURIComponent` 를 `formUrlEncode` (Java URLEncoder 호환 — 공백 `+` 인코딩) 로 갱신 (PR #67 의 SEC H-1 fix). 알고리즘 step 2 "URL-encoded query string" 도 "**form-urlencoded** query string (Java `URLEncoder.encode(value, UTF-8)` 호환)" 으로 명시.
- "옛 in-memory 100건 스캔 + trial HMAC 방식은 폐기" 문장 뒤에 "단, install_token 단일 row 조회 실패 시 install_token mismatch recovery (`tryRecoverByMallId`) 가 좁은 보정 경로로 작동 — 자세한 내용은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) 'Cafe24 install_token mismatch 회복 흐름' 항 참조." 노트 추가.
- **ENV 표 추가 (consistency check info-9)**: `RECOVERY_CANDIDATE_LIMIT` 기본값 5, 의미 (회복 흐름 HMAC trial 상한), 환경변수로 노출되지 않고 상수 — backend code 상수로 고정.

#### §10 CHANGELOG

2026-05-16 entry 추가: 본 spec drift 정리 + PR #56/#67 의 구현 변경 반영.

### 3. `spec/data-flow/5-integration.md`

#### §1.4 OAuth 만료 스캐너 (SPEC-2)

4번째 잡 `cafe24-background-refresh` 추가.
- 잡 표에 한 행 추가.
- mermaid 다이어그램 보강: 4번째 par 분기 추가 또는 노트로 간단화.
- 격리 정책 노트 유지.

**`connected-expiry` 분기 동작 갱신 명시 (consistency check warning-1)**:
- 옛 mermaid: `else 만료 처리만 → UPDATE status='expired', status_reason='token_expired'`
- 새 mermaid: `else refresh_token invalid_grant → UPDATE status='error', status_reason='auth_failed' / transport 실패 3회 → status='error', status_reason='network'`
- expired 분기 자체를 제거 (refresh 실패 → error 통합).

#### §2.2 Redis (consistency check warning-2)

`cafe24-token-refresh` 큐 행 추가:
- producer: `cafe24-background-refresh` 잡 + `Cafe24ApiClient` proactive
- consumer: `Cafe24TokenRefreshProcessor` worker
- payload: `{ integrationId, source: 'background' | 'proactive' }`
- dedup: `jobId = integrationId`
- 보존: `removeOnComplete: { age: 60 }`, `removeOnFail: { age: 300 }`

#### §3.1 stateDiagram + §3.2 status_reason 매핑 표 (consistency check critical-2)

- §3.1 stateDiagram:
  - 삭제: `connected --> expired: refresh 실패`
  - 추가: `connected --> error: refresh_token invalid / transport 3회 실패` (또는 통합으로 기존 401/403 화살표에 병합)
- §3.2 status_reason 매핑 표:
  - `expired` 행: `refresh_failed` 제거. `install_timeout` 만 유지.
  - `error` 행: `auth_failed` 사유에 "refresh_token invalid (이전엔 expired/refresh_failed 였음)" 노트 추가.

### 4. `spec/1-data-model.md` (consistency check critical-3)

#### §2.10 Integration.status_reason 컬럼

- `expired` 열거에서 `refresh_failed` 제거. 결과적으로 `expired` 의 유효 사유는 `install_timeout` 만 남는다.
- `token_expired` 도 함께 검토 — refresh_token 자체 없는 provider (Google/GitHub) 의 만료 경로는 여전히 `expired(token_expired)` 가능한가? 검토 결과: 그렇다. spec §6 가 명시하지 않은 일반 OAuth provider 의 `connected → expired` 경로는 refresh_token 미보유 시 가능하므로 `token_expired` 는 유지.
- `error` 열거에 `network` 추가 (PR #67 REQ-C2 의 새 statusReason 값).

## 의사결정 — 이미 결정됨

- **REQ HIGH-2 선택지 (a) vs (b)** — 사용자 직접 권장 (a) `error(auth_failed)`. 본 plan 은 (a) 적용.
- **C-4 직렬화**: 본 plan 이 SPEC-1 Rationale 작성 인수. `spec-update-cafe24-install-recovery.md` 의 미완 체크박스는 본 plan 머지 후 처리.

## 변경 대상 파일 (최종)

1. `spec/2-navigation/4-integration.md` — §6, §9.2, §9.4, §10.5, §11 진입블록쿼트, §11.1, §11.2, ## Rationale (4건 신규 + 1건 갱신)
2. `spec/4-nodes/4-integration/4-cafe24.md` — §4 step 6, §9.6, §9.8 (코드 + 회복 흐름 노트 + ENV 표), §10 CHANGELOG
3. `spec/data-flow/5-integration.md` — §1.4 (4번째 잡 + connected-expiry 분기 갱신), §2.2 Redis 큐 표, §3.1 stateDiagram, §3.2 status_reason 매핑 표
4. `spec/1-data-model.md` — §2.10 status_reason 컬럼 값 갱신

## 진행 순서

- [ ] 1. 본 draft v2 commit (현재).
- [ ] 2. `/consistency-check --spec plan/in-progress/spec-draft-cafe24-spec-sync.md` 재실행.
- [ ] 3. Critical 0 건 확인 후 spec 파일들 실제 수정 (4개 파일).
- [ ] 4. 본 draft 를 `plan/complete/spec-draft-cafe24-spec-sync.md` 로 git mv.
- [ ] 5. `spec-update-cafe24-install-recovery.md` 의 "spec 갱신 (Rationale 추가)" 체크박스를 본 plan 에서 처리 처리한 것으로 mark.
- [ ] 6. PR 생성.

## 후속 follow-up

- `spec/data-flow/5-integration.md` 파일명 규약 위반 (consistency check warning-8) — `spec/data-flow/1-integration.md` 로 git mv. 본 plan 범위 초과로 별도 plan 으로 분리.

## 참고: spec-update-cafe24-install-recovery.md 와의 관계

해당 plan 의 구현 부분 (`backend/src/modules/integrations/integration-oauth.service.ts` 의 `tryRecoverByMallId`) 은 commit `30f68b39` 로 이미 main 에 머지 완료. spec 갱신 부분만 남아있었고, 본 plan 이 그 항목을 인수해 SPEC-1 Rationale 로 처리.
