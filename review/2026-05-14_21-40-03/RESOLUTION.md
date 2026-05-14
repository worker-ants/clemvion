# AI Review Resolution — 2026-05-14_21-40-03 (변경 1–5 통합 리뷰)

`review/2026-05-14_21-40-03/SUMMARY.md` 의 Critical 4건 + Warning 18건 + Info 19건 처리. 본 PR 내 즉시 조치 항목과 후속 plan 위임을 분리 기록.

## Critical

| # | 항목 | 조치 |
|---|------|------|
| 1 | `/oauth/install/cafe24` 410 즉시 전환의 운영 앱 장애 위험 | **운영 데이터 없음**(이 worktree 의 사용자가 이 시점까지 cafe24 private 통합을 실제 운영에 등록한 적이 없음) 전제로 그대로 진행. plan/in-progress/cafe24-pending-polish.md 의 "기존 Private 앱 등록자 대상 App URL 재등록 안내 가이드 작성도 본 항목 처리 시 함께" 체크박스가 운영 등록자 발생 시 활성화될 안전망. 외부에 이미 등록된 케이스가 발생하면 본 PR 머지 직후 후속 hotfix 로 별도 PR 분리. |
| 2 | `expirePendingInstalls` 의 find→mutate→save 비원자 race | **조치 완료** — `integration-expiry-scanner.service.ts` 의 `expirePendingInstalls` 를 `createQueryBuilder().update().set().where().andWhere().execute()` 단일 bulk UPDATE 로 교체. DB 레벨 WHERE 검사 + 쓰기 가 한 트랜잭션 내 원자 적용 → 동시 callback 의 `connected` 전이가 덮어쓰여지지 않는다. 테스트 (B-Critical #3) 가 회귀 보호. |
| 3 | `expirePendingInstalls` TTL 경계 미검증 | **조치 완료** — `integration-expiry-scanner.service.spec.ts` 에 `find()` 대신 `createQueryBuilder` chain 인수 (status='pending_install' / created_at < cutoff / cutoff = now - 24h) 를 모두 명시 assertion. 추가로 `affected` undefined 엣지 케이스도 검증. |
| 4 | `process()` 독립 에러 격리 미검증 | **조치 완료** — `expirePendingInstalls` throw 해도 `pruneUsageLogs` 가 실행되고, `run()` throw 해도 `expirePendingInstalls` 가 실행되는 2 케이스 추가. spec/data-flow/integration.md §1.4 의 "독립 실행" 계약을 회귀 보호. |

## Warning (PR 내 조치)

| # | 항목 | 조치 |
|---|------|------|
| W1 / W2 | V043 비-CONCURRENT 인덱스 운영 락 / 중복 install_token 사전 확인 | **조치 완료** — `V043__cafe24_install_token_index.sql` 을 `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` 로 변경, 동봉 `V043__cafe24_install_token_index.conf` 에 `executeInTransaction=false`. COMMENT ON INDEX 는 Flyway mixed-mode 제약으로 제거하고 SQL 주석에 의도 명시. e2e migration 통과 확인. |
| W3 | TypeORM save(array) → N개별 UPDATE | **조치 완료** — Critical #2 의 bulk UPDATE 로 자연스럽게 해소. 단일 왕복. |
| W6 | 팝업 닫힘 감지 stale closure / setTimeout cleanup | **조치 완료** — `new/page.tsx` 의 popup polling effect 가 `oauthWaitingRef` + `previewTokenRef` 로 최신 값 읽도록 변경, return cleanup 에서 `clearTimeout(bailTimer)` 명시. 에러 토스트 이중 발화 차단. |
| W8 | catch block 404 누락 (403 만 특수 처리) | **이미 처리됨** — 컨트롤러 catch 블록이 `e.status ?? 400` 으로 NestJS 예외의 상태 코드(NotFoundException → 404, ForbiddenException → 403)를 그대로 통과시킴. 검토 후 코드상 분기 없음 확인, 한 줄 주석으로 의도 명시. |
| W11 | installToken URL path 로그 유출 | (단기 인프라 작업) — plan 변경 2 의 "nginx access log 마스킹 또는 query param 이동" 체크박스로 등재 (이미 있음). 운영 배포 시 인프라 작업. |
| W12 | installToken 형식·길이 검증 누락 | **조치 완료** — `integrations.controller.ts` 에 `INSTALL_TOKEN_PATTERN = /^[a-f0-9]{64}$/` 상수 + 라우트 진입 직후 형식 가드. 임의 길이 입력이 service / DB 로 흐르는 경로 차단. 4 케이스 테스트 (잘못된 형식 / 길이 / 정상 / legacy 410). |
| W13 | 신규/legacy 라우트 무테스트 | **조치 완료** — 위 W12 와 동시. `integrations.controller.spec.ts` 의 새 describe 블록 "cafe24 install routes (변경 2)" 5 케이스. |
| W14 | `buildIntegrationMeta` 단위 테스트 없음 | (후속) — service.spec.ts 별도 케이스 작성은 plan 변경 5 추가 항목으로 등재. 현 PR 의 e2e + integration-oauth.cafe24.spec 이 간접 검증 (`appUrl` shape + 응답 mock). |
| W15 | FE 폴링·팝업 감지 RTL 무테스트 | (후속) — `Cafe24PrivatePendingStep` 의 `useQuery` polling + `transitionedRef` 가드는 코드 review 로 충분하다고 판단. RTL mock 으로 status 전이 시뮬레이션은 별도 PR 권장 — plan 변경 5 항목. |
| W16 | 폴링 종료 후 UI 공백 (expired/error 안내 없음) | **조치 완료** — `Cafe24PrivatePendingStep` 에 `poll.status !== 'pending_install' && !== 'connected'` 분기 안내 메시지 + i18n 키 `cafe24PrivatePendingExpired` / `cafe24PrivatePendingTerminal` 추가. |
| W17 | handleInstall 시그니처 변경 호출 지점 누락 | **조치 완료** — `grep -rn 'handleInstall' backend/src` 로 단일 production 호출 지점 (controller) 확인. 모든 caller 가 새 signature 사용 중. |
| W18 | hook 의존성 4개 누락 | **조치 완료** — `oauthWaitingRef` / `previewTokenRef` 패턴으로 stale 참조 차단. W6 와 함께 처리. |

## Warning (후속 plan)

| # | 항목 | 위임 |
|---|------|------|
| W4 | `beginCafe24Private` TOCTOU race (advisory lock) | plan 변경 3 의 advisory lock 체크박스가 이미 등재. 본 PR 에서는 race window 매우 좁고(같은 폼 동시 제출), 행 생성 시 unique 제약 (workspace_id + name) 이 backstop. |
| W5 | TTL 기준 `createdAt` vs 재사용 시 신규 토큰 — 조기 만료 | plan 변경 4 추가 항목: `installTokenIssuedAt` 컬럼 도입 또는 reuse 시 createdAt 갱신 트레이드오프. |
| W7 | `process()` 에러 삼킴 → BullMQ 재시도 불가 | spec §1.4 에 "단일 패스 실패 시 재시도 없음, observability 책임 Sentry" 명시 — 의도된 설계. plan 후속 항목 (관측성 보강) 으로 별도. |
| W9 | `meta` required 필드 추가 — codegen 클라이언트 호환 | API 응답에 항상 `meta: { appType }` 으로 객체 보내므로 swagger required 자체는 정확. 기존 호환을 우려한다면 `@ApiPropertyOptional` 로 완화할 수 있으나 응답 보장이 더 명확해서 그대로 유지. plan 의 codegen 도입 시 재검토. |
| W10 | `lastError` strict schema → 기존 응답 검증 실패 | plan 후속 항목: DB 의 기존 lastError 필드 구성 확인 후 `additionalProperties: true` 보강 검토. 현 PR 은 `markIntegrationCallbackError` 가 strict `{code, message, at}` 만 쓰므로 회귀 위험 없음. |

## Info (즉시 조치 + 후속)

| # | 항목 | 조치 |
|---|------|------|
| I1 | `samMall` 오타 → `sameMall` | **조치 완료**. |
| I4 | 중복 가드 `!installToken \|\| installToken.length === 0` | **조치 완료** — `!installToken` 만 남김. |
| I9 | `isUnreadableCredentials` 이중 호출 | **조치 완료** — `toPublic` 의 결과를 변수 캐싱 + `buildIntegrationMeta(entity, credsUnreadable)` 인자 도입. |
| 나머지 (I2/I3/I5–I8/I10–I19) | 매직 상수 / 유틸 추출 / 아키텍처 정리 / 문서 정리 / 보안 nit | (후속) — plan 의 "(W10 cleanup)", "(W2/W3 cleanup)", "(Info 1-2)" 등 cleanup 체크박스들이 이미 등재되어 있어 별도 PR. 본 PR 의 핵심 동작 변경에 영향 없음. |

