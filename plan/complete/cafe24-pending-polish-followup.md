---
worktree: (none — PR #18 머지 후 새 worktree 에서 진행)
started: 2026-05-14
owner: developer (다음 진입자)
---

# Cafe24 Pending Install 정비 — Follow-up

## PR 진행 상황 (2026-05-14)

- **PR #18** (cafe24 pending_install 정비 본진): https://github.com/worker-ants/clemvion/pull/18 — 머지 대기
- **PR #19** (그룹 D + F 일부: swagger 데코레이터 + `(변경 N)` 마커 cleanup): https://github.com/worker-ants/clemvion/pull/19 — stacked on PR #18
- **PR #20** (그룹 C: `callbackContextOf` 캡슐화 + reauthorize 유틸 분리): https://github.com/worker-ants/clemvion/pull/20 — stacked on PR #19
- **PR #21** (그룹 E + 그룹 C item 4: `useCafe24PendingPolling` 훅 추출 + `buildIntegrationMeta` + 폴링 RTL 테스트): https://github.com/worker-ants/clemvion/pull/21 — stacked on PR #20

stacked PR 들이라 머지 순서는 #18 → #19 → #20 → #21. 각 PR 의 base 가 이전 PR 의 브랜치이므로, 앞 PR 이 머지되면 다음 PR 의 base 가 자동으로 main 으로 바뀐다 (GitHub 기본 동작) — 또는 수동 rebase.

## Context

PR #18 (`claude/cafe24-pending-polish-7fdb7e` 브랜치) 에서 cafe24 private "Pending install" 멈춤 사례 분석 → 변경 0~5 + ai-review 조치까지 일괄 처리했다. PR 본문의 핵심 사용자 가치는 모두 본 PR 에 포함된다.

본 follow-up plan 은 그 과정에서 두 round 의 ai-review (`review/2026-05-14_19-26-06`, `review/2026-05-14_19-30-49`, `review/2026-05-14_21-40-03`) 가 짚었지만 본 PR 범위 외로 미룬 항목 모음. 각 항목은 독립적으로 별도 PR 로 진행 가능하다.

본 plan 진입 시점에는 PR #18 이 머지된 main 기준으로 새 worktree 를 만든다 (`git worktree add .claude/worktrees/cafe24-followup-<slug> -b claude/cafe24-followup-<slug>`).

---

## 그룹 A — 운영 안전망 (별도 PR 로 분리, hotfix 가능성)

- [x] ~~**레거시 `/oauth/install/cafe24` 영구 폐기 시점 결정.**~~ — **무효화 (2026-05-15, cafe24-3rdparty-url-503aa0 PR)**: namespace 자체가 `/api/integrations/oauth/` → `/api/3rd-party/cafe24/` 로 이전되며 옛 prefix 전체 (토큰 있/없 양쪽) 가 자연 404. 410 Gone hint 라우트는 코드에 존재한 적이 없음. 기존 Private 앱 등록자 대상 App URL 재등록 안내는 본 PR 의 운영 작업 체크리스트에 포함.
- [ ] **`install_token` URL path 로그 유출 방어.** nginx access log 에서 `:installToken` segment 마스킹 또는 query parameter 이동 검토. (ai-review W6 / W11)
- [ ] **install endpoint IP 기반 rate limiting 추가.** 현재 30 req/min throttle 적용 중이나, token oracle enumeration 방어를 위해 IP 기반 추가 layer 검토. (ai-review W7)

## 그룹 B — 데이터 모델·동시성 강화

- [x] **TTL 기준 분리.** (`cafe24-data-model-strengthen` / PR #24) `install_token_issued_at` 컬럼을 V044 로 신설하고 스캐너 WHERE 절을 `COALESCE(install_token_issued_at, created_at) < cutoff` 로 옮겼다. 재사용 분기에서 `install_token` 재발급과 동시에 갱신되어 조기 만료 회귀 없음. NULL 인 V044 이전 행은 `created_at` fallback. (ai-review W5)
- [x] **TOCTOU 동시성 방어 — `mall_id` plain 컬럼 + partial UNIQUE.** (`cafe24-data-model-strengthen` / PR #24) V045 로 `mall_id VARCHAR(50)` plain 컬럼 + 부분 UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 추가. 동시 INSERT race 는 PG `23505` 위반으로 변환되어 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 로 일관 처리. in-memory 중복 가드는 `row.mallId ?? row.credentials?.mall_id` fallback 으로 V045 이전 행도 정확 비교. advisory lock 옵션은 unnecessary 로 폐기. (ai-review W4, I11)
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
- [ ] **신규 에러 코드 2종 `@ApiResponse` 데코레이터.** `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 를 swagger doc 에 명시. (ai-review I19. ~~`CAFE24_INSTALL_LEGACY_PATH(410)`~~ 은 2026-05-15 namespace 이전으로 무효화 — 옛 prefix 전체가 자연 404.)
- [ ] **`process()` 에러 격리 정책 spec 명시.** 현재 `.catch(logger.error)` 로 BullMQ 재시도가 안 일어남 — 의도된 설계라면 spec/data-flow/5-integration.md §1.4 에 명문화 + Sentry / Datadog 연동 검토. (ai-review W7)
- [ ] **`verifyHmacWithMessage` timing-safe 구현 확인.** `crypto.timingSafeEqual` 사용 여부 점검. (ai-review I15)

## 그룹 E — 테스트 보강

- [ ] **`buildIntegrationMeta` 직접 단위 테스트.** cafe24 외 serviceType / unreadable credentials 경계 케이스. (ai-review batch 2 W14)
- [ ] **FE `Cafe24PrivatePendingStep` RTL 테스트.** mock useQuery 로 pending_install → connected 전이 시뮬레이션 + `router.replace` 호출 검증 + 10분 timedOut 동작. (ai-review batch 2 W15)
- [ ] **`callbackContextOf` 단독 단위 테스트.** null / primitive 등 엣지 케이스. (이전 review Info 6)
- [ ] **e2e 보강.** `cafe24-private-install.e2e-spec.ts` 를 다시 작성 — 본 PR 에서는 Docker rebuild 환경 이슈로 제외됐으나, 단위 테스트 수준에서 모든 케이스 검증됨. e2e 추가 시: (a) happy path / (b) NULL 전환 후 재호출 → 404 / (c) TTL 만료 후 NULL 확인 / (d) replay 방어 / (e) ~~legacy 410~~ → 옛 prefix 자연 404 (2026-05-15 이후) / (f) 중복 begin 재사용. (이전 review W14)

## 그룹 F — 문서 동기화

- [x] **§13 데이터 모델 요약에 `install_token` 누락 보완.** spec/2-navigation/4-integration.md §13. `install_token`/`install_token_issued_at`/`mall_id` 행 + 신규 인덱스 3종 행 추가 완료 (2026-05-15, cafe24-3rdparty-url-503aa0 PR). (이전 review W10)
- [ ] **§6 mermaid `install_token` 보존 정책 명시.** callback 실패 시 install_token 유지 → 재시도 가능 (data-flow §1.2.1 에는 이미 명시). (이전 review I3)
- [ ] **`spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정.** (이전 review I5)
- [ ] **`(변경 N)` 마커 cleanup** (그룹 C 항목과 중복) — spec / 테스트 명칭에서 제거.

---

## 진행 시 권장 순서

A (운영 안전망) → D 의 신규 에러 코드 swagger 문서화 → C (코드 정리) → B (데이터 모델) → E (테스트) → F (문서) 순으로, 한 PR 당 한 그룹 또는 작은 분리 단위로 진행. 그룹 B 의 advisory lock / installTokenIssuedAt 은 spec 갱신을 동반하므로 project-planner 위임 필요.

각 PR 진입 시 `consistency-check --impl-prep spec/2-navigation/4-integration.md` 의무 호출.
