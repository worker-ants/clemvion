# RESOLUTION — 2026-05-14_13-57-48

ai-review 이슈 조치 결과.

## Critical 조치

| # | 발견사항 | 조치 |
|---|----------|------|
| C1 | 테스트 `mode` 단언 `'reconnect'` → CI 즉시 실패 | 서비스 코드와 일치하는 `'reauthorize'` 로 수정 |
| C2 | `handleInstall` O(n) 전수 스캔 / `install_token` 미활용 | `.take(100)` guard 추가; `buildHmacMessage` 를 루프 외부로 추출해 후보당 1× HMAC 연산으로 최적화. `install_token` 은 Cafe24 App URL 특성상(Cafe24가 표준 파라미터 외 커스텀 파라미터를 pass-through 하지 않음) 활용 불가 — 코드에 사유 주석 추가, 컬럼은 유지(이미 V042 마이그레이션 배포 대상) |
| C3 | `handleCallback` pending_install 분기 테스트 전무 | `mode='reauthorize'` + `status='pending_install'` 픽스처로 테스트 추가; `installToken=null` · `status='connected'` 전이 검증 |

## Warning 조치

| # | 발견사항 | 조치 |
|---|----------|------|
| W2 | `OAuthState.providerMeta` `client_secret` 평문 저장 가능성 | 엔티티 확인 결과 `encryptedJsonTransformer` 이미 적용 — false alarm |
| W3 | `reauthorize`/`requestScopes` 경로에서 Private 앱 중복 `pending_install` 생성 | `begin()` private 분기에 `mode !== 'new'` 차단 추가 (`CAFE24_PRIVATE_APP_USE_TEST_RUN` 400) |
| W4 | 프론트엔드 `reauthorize()`/`requestScopes()` 반환 타입 `{ authUrl, state }` 고정 | `OAuthBeginResult` 유니온 타입으로 통일; call-site 두 곳 `"authUrl" in res` 가드 추가 |
| W5 | `/oauth/install/cafe24` rate limiting 없음 | `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 추가 |
| W7 | `verifyHmac` 루프마다 `rawQuery` 재파싱 | `buildHmacMessage` / `verifyHmacWithMessage` 로 분리; `handleInstall` 진입 시 메시지 1회 계산 후 재사용 |
| W11 | spec API 표 `CAFE24_INSTALL_NO_PENDING`(404) 가 실제와 다름 | `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 으로 수정 |
| W13 | i18n `cafe24PrivatePendingViewList` 레이블이 라우트(`/integrations/:id`)와 불일치 | ko: "통합 상세 보기" / en: "View integration details" 로 수정 |

## Info 조치

| # | 발견사항 | 조치 |
|---|----------|------|
| I1 | spec changelog `pending_install → active` 오기 | → `connected` 로 수정 (4-cafe24.md + 4-integration.md 두 곳) |
| I2 | `APP_URL` 환경변수 문서 누락 | ko/en 사용자 가이드 환경변수 표에 추가 |

## 미조치 항목 (사유)

| # | 발견사항 | 미조치 사유 |
|---|----------|-------------|
| W6 | `pending_install` TTL 스캐너 없음 | 별도 cron job 또는 migration 필요 — follow-up 이슈로 등록 권장 |
| W8 | `handleInstall` TOCTOU race | 단일 프로세스 환경에서 Cafe24 테스트 실행은 수동이므로 실제 충돌 가능성 미미. 분산 환경 확장 시 트랜잭션 잠금 추가 |
| W9 | `BeginResult` discriminant 없음 | 현재 3개 call-site 모두 `"authUrl" in result` 패턴으로 안전하게 동작. 타입 리팩토링은 별도 PR로 분리 |
| W10 | 컨트롤러/프론트 컴포넌트 테스트 공백 | `needsAttention` 단위는 이미 status-badge 파일 내 exported function — status 테스트 확장 가능. 컨트롤러 핸들러 테스트는 e2e 범위로 위임 |
| W12 | `reauthorize`/`requestScopes` 반환 타입이 실제보다 넓음 | W4 에서 `BeginResult` 로 통일. 실제로 `cafe24_private_pending` 은 이 경로에서 반환되지 않으므로 W3 수정(mode='new' 차단)으로 구조적으로 방지됨 |
| W14 | `cafe24Install` 에러 응답이 글로벌 필터 우회 | 현재 `@Public()` 엔드포인트라 `@Res()` 직접 제어가 필수. 별도 리팩토링 PR 필요 |
| W15 | Swagger 응답 스펙 200 vs 302 | Swagger 어노테이션만의 문서 수정 — 별도 PR |
| W16 | 마이그레이션 `ACCESS EXCLUSIVE` 락 | 이미 merged된 V042. 운영 배포 시 메인터넌스 윈도우에서 실행 권장 — ops 노트 |
| I3 | `ListStatusFilter` 에 `pending_install` 미포함 | 백엔드 목록 API에서 `pending_install` 필터를 지원할지 미결정 — product 결정 후 추가 |
| I4 | QueryBuilder 원시 SQL 컬럼명 | 기능 영향 없음, 별도 리팩 PR |
| I5 | `(service_type, status)` 복합 인덱스 부재 | `pending_install` 행 수가 적으므로 현재 영향 미미. 스케일 시 추가 |
| I6 | HMAC 로직 테스트 헬퍼 중복 | W7 에서 `buildHmacMessage` 분리. 테스트 헬퍼를 export 함수로 재사용하는 리팩토링은 별도 PR |
| I7 | `APP_URL` 폴백 중복 | 리팩토링 범위 — 별도 PR |
| I8 | `pending_install` UI 페이지 이탈 시 소실 | Integration 상세 페이지에서도 표시 필요 — 별도 구현 |
| I9 | `stateRecord.mode = 'reauthorize'` 의미론적 혼동 | 인라인 주석으로 의도 설명 추가 가능 — 별도 PR |
| I10 | JSDoc 에 pending 미발견 시 403 통합 처리 미기재 | 코드 주석 보강 — 별도 PR |
