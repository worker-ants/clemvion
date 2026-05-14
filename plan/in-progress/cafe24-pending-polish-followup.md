---
worktree: (none — PR #18 머지 후 새 worktree 에서 진행)
started: 2026-05-14
owner: developer (다음 진입자)
---

# Cafe24 Pending Install 정비 — Follow-up

## Context

PR #18 (`claude/cafe24-pending-polish-7fdb7e` 브랜치) 에서 cafe24 private "Pending install" 멈춤 사례 분석 → 변경 0~5 + ai-review 조치까지 일괄 처리했다. PR 본문의 핵심 사용자 가치는 모두 본 PR 에 포함된다.

본 follow-up plan 은 그 과정에서 두 round 의 ai-review (`review/2026-05-14_19-26-06`, `review/2026-05-14_19-30-49`, `review/2026-05-14_21-40-03`) 가 짚었지만 본 PR 범위 외로 미룬 항목 모음. 각 항목은 독립적으로 별도 PR 로 진행 가능하다.

본 plan 진입 시점에는 PR #18 이 머지된 main 기준으로 새 worktree 를 만든다 (`git worktree add .claude/worktrees/cafe24-followup-<slug> -b claude/cafe24-followup-<slug>`).

---

## 그룹 A — 운영 안전망 (별도 PR 로 분리, hotfix 가능성)

- [ ] **레거시 `/oauth/install/cafe24` 영구 폐기 시점 결정.** 운영 데이터·외부 Cafe24 Developers 등록 URL 잔존 여부 확인 후, 410 Gone 라우트 자체를 제거하거나 더 명확한 hint 로 강화. **기존 Private 앱 등록자 대상 App URL 재등록 안내 가이드** 작성 (sales / docs 채널) 도 함께.
- [ ] **`install_token` URL path 로그 유출 방어.** nginx access log 에서 `:installToken` segment 마스킹 또는 query parameter 이동 검토. (ai-review W6 / W11)
- [ ] **install endpoint IP 기반 rate limiting 추가.** 현재 30 req/min throttle 적용 중이나, token oracle enumeration 방어를 위해 IP 기반 추가 layer 검토. (ai-review W7)

## 그룹 B — 데이터 모델·동시성 강화

- [ ] **TTL 기준 분리.** 현행: `createdAt < now - 24h`. 재사용 시 (변경 3) installToken 만 갱신되고 createdAt 은 그대로라 신규 토큰 발급 직후에도 조기 만료 위험. `installTokenIssuedAt` 컬럼 (V0XX 마이그레이션) 추가 후 TTL 기준을 옮긴다. 또는 재사용 분기에서 createdAt 을 갱신한다 (간단). 트레이드오프 비교 후 결정. (ai-review W5)
- [ ] **TOCTOU advisory lock 또는 `mall_id` plain 컬럼 분리.** 변경 3 의 begin 시점 중복 가드는 in-memory 비교 → 동시 폼 제출 race window 가 좁지만 존재. `pg_advisory_xact_lock(hashtext(workspaceId || mallId))` 적용 또는 `mall_id` plain 컬럼 분리 후 partial UNIQUE 인덱스. mall_id O(N) decrypt 비용 측정 결과와 함께 결정. (ai-review W4, I11)
- [ ] **install_token DB UNIQUE 제약 V0XX 결정.** 부분 UNIQUE 인덱스가 V043 으로 이미 추가됨 — 별도 UNIQUE 제약은 deferred. 운영 시점에 필요성 재평가. (이전 review W13)

## 그룹 C — 코드 품질·아키텍처 정리

- [ ] **`callbackContextOf` export 캡슐화.** 현재 service 의 내부 에러 컨텍스트가 controller 로 public export 됨 (service → controller → service 역방향 결합). service `handleCallbackWithErrorCapture` 메서드로 옮겨 controller catch 가 단순 HTML 렌더만 담당하도록 리팩토링. (ai-review batch 1 W2/W3)
- [ ] **`buildIntegrationMeta` 레지스트리 패턴.** 현재 cafe24 만 하드코딩 — 두 번째 provider 추가 시 OCP 위반. `Map<serviceType, (entity) => IntegrationMeta>` 패턴으로 변경 (두 번째 provider 추가 직전 시점). (ai-review I5)
- [ ] **`isReauthorizeDisabled` 위치 이동.** badge UI 컴포넌트에서 export 중 — `lib/integrations/utils.ts` 등 도메인 모듈로. (ai-review I6)
- [ ] **`Cafe24PrivatePendingStep` 커스텀 훅 분리.** 폴링·타임아웃·전이·라우팅·캐시 무효화를 모두 담당. `useCafe24PendingPolling(integrationId)` 커스텀 훅으로 상태 기계 분리. (ai-review I7)
- [ ] **매직 상수 추가 추출.** `'install_timeout'` 문자열이 3곳 분산, `OAUTH_CALLBACK_FAILED` 등 — 공유 상수 파일. (ai-review I18, plan W10 cleanup)
- [ ] **`(변경 N)` 마커 · review 아티팩트 경로 cleanup.** 프로덕션 코드·테스트 명칭의 `(변경 0)`, `(변경 4)` 등 마커와 review 디렉토리 참조 제거. 커밋 메시지·PR description 에서만 유지. (ai-review I11)
- [ ] **`samMall` → `sameMall` 같은 minor naming cleanup.** 이미 본 PR 에서 일부 정리되었으나 추가 발견 시.

## 그룹 D — 보안·관측성

- [ ] **`lastError.message` 길이 제한·민감 패턴 필터링.** `markIntegrationCallbackError` 저장 시 `message.slice(0, 200)` + 토큰 / 비밀번호 패턴 마스킹. (이전 review Info 1-2)
- [ ] **신규 에러 코드 3종 `@ApiResponse` 데코레이터.** `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_INSTALL_LEGACY_PATH(410)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 를 swagger doc 에 명시. (ai-review I19)
- [ ] **`process()` 에러 격리 정책 spec 명시.** 현재 `.catch(logger.error)` 로 BullMQ 재시도가 안 일어남 — 의도된 설계라면 spec/data-flow/integration.md §1.4 에 명문화 + Sentry / Datadog 연동 검토. (ai-review W7)
- [ ] **`verifyHmacWithMessage` timing-safe 구현 확인.** `crypto.timingSafeEqual` 사용 여부 점검. (ai-review I15)

## 그룹 E — 테스트 보강

- [ ] **`buildIntegrationMeta` 직접 단위 테스트.** cafe24 외 serviceType / unreadable credentials 경계 케이스. (ai-review batch 2 W14)
- [ ] **FE `Cafe24PrivatePendingStep` RTL 테스트.** mock useQuery 로 pending_install → connected 전이 시뮬레이션 + `router.replace` 호출 검증 + 10분 timedOut 동작. (ai-review batch 2 W15)
- [ ] **`callbackContextOf` 단독 단위 테스트.** null / primitive 등 엣지 케이스. (이전 review Info 6)
- [ ] **e2e 보강.** `cafe24-private-install.e2e-spec.ts` 를 다시 작성 — 본 PR 에서는 Docker rebuild 환경 이슈로 제외됐으나, 단위 테스트 수준에서 모든 케이스 검증됨. e2e 추가 시: (a) happy path / (b) NULL 전환 후 재호출 → 404 / (c) TTL 만료 후 NULL 확인 / (d) replay 방어 / (e) legacy 410 / (f) 중복 begin 재사용. (이전 review W14)

## 그룹 F — 문서 동기화

- [ ] **§13 데이터 모델 요약에 `install_token` 누락 보완.** spec/2-navigation/4-integration.md §13. (이전 review W10)
- [ ] **§6 mermaid `install_token` 보존 정책 명시.** callback 실패 시 install_token 유지 → 재시도 가능 (data-flow §1.2.1 에는 이미 명시). (이전 review I3)
- [ ] **`spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정.** (이전 review I5)
- [ ] **`(변경 N)` 마커 cleanup** (그룹 C 항목과 중복) — spec / 테스트 명칭에서 제거.

---

## 진행 시 권장 순서

A (운영 안전망) → D 의 신규 에러 코드 swagger 문서화 → C (코드 정리) → B (데이터 모델) → E (테스트) → F (문서) 순으로, 한 PR 당 한 그룹 또는 작은 분리 단위로 진행. 그룹 B 의 advisory lock / installTokenIssuedAt 은 spec 갱신을 동반하므로 project-planner 위임 필요.

각 PR 진입 시 `consistency-check --impl-prep spec/2-navigation/4-integration.md` 의무 호출.
