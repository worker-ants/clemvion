# AI Review Resolution — 2026-05-14_19-30-49 (Batch 2 / spec + plan)

이 문서는 `review/2026-05-14_19-30-49/SUMMARY.md` 의 변경 0 PR 내 처리 결과를 기록한다. Critical 3건 + Warning 15건 + Info 11건 중 변경 0 PR 범위 내 조치 가능 항목을 모두 다루었고, 나머지는 후속 변경 (변경 2/3/4) 의 spec/구현으로 위임.

## Critical

| # | 항목 | 조치 |
|---|------|------|
| C1 | App URL breaking change 마이그레이션 안내 | **변경 2 범위 (후속 PR)**. `plan/in-progress/cafe24-pending-polish.md` 변경 2 의 "기존 토큰 없는 `/oauth/install/cafe24` 라우트 410 Gone" 체크박스 옆에 "기존 등록자 App URL 재등록 안내 문서 작성" 후속 항목 추가 예정. 현 변경 0 은 install_token 도입을 포함하지 않으므로 즉시 위험 없음. |
| C2 | HMAC 403→404 분리로 기존 테스트 silent fail | **변경 2 테스트 보강 시 처리**. `plan/in-progress/cafe24-pending-polish.md` 변경 5 의 "기존 e2e — CAFE24_INSTALL_INVALID_HMAC(403) → CAFE24_INSTALL_INVALID_TOKEN(404) 전환" 체크박스가 이미 등재됨. |
| C3 | `statusReason: 'waiting'` 픽스처 | **즉시 조치 완료**. `integration-oauth.service.cafe24.spec.ts` 의 pending_install 픽스처를 `'oauth_token_exchange_failed'` + 정상 `{code, message, at}` shape 의 lastError 로 교체. |

## Warning (변경 0 PR 내 조치)

| # | 항목 | 조치 |
|---|------|------|
| W3 | Frontend `credentials.app_type` 접근 경로 미명시 | **변경 1 범위 (FE polling 후속 PR)**. 현재 변경 0 의 status-badge 는 `credentials.app_type` 을 참조하지 않음 — `pending_install` 상태와 `statusReason` 만 사용. 변경 1 에서 reauthorize 버튼 비활성 조건 구현 시 `meta.appType` 응답 필드를 spec §9.1 에 추가해야 한다 — plan 변경 1 체크박스로 등재 예정. |

## Warning (후속 변경으로 위임)

| # | 항목 | 위임 대상 |
|---|------|----------|
| W1 | `markIntegrationCallbackError` plan 변경 0 "status 유지 for both" 문구 vs spec §10.4 충돌 | **변경 0 PR 내 plan 정정 완료** — `plan/in-progress/cafe24-pending-polish.md` 변경 0 본문에 "pending_install → status 보존 / connected → §10.4 기준 error(auth_failed) / state 단계 실패 → last_error 만" 으로 분리 기술. |
| W2 | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` plan HTTP 400 vs spec 409 | **plan 정정**: plan 의 변경 3 에서 spec 의 409 + `(workspaceId, mall_id, app_type='private')` 조건 사용 명시. plan 의 변경 3 본문에서 인용 갱신. |
| W4 | BullMQ 큐 메시지 하위 호환 plan 미반영 | **변경 4 plan 보강**: "consumer 에 `reason ?? 'token_expiring'` 기본값 처리" + "consumer 먼저 배포 후 producer" 순서 체크박스 추가. |
| W5 | mall_id TOCTOU race | 변경 3 (중복 방지) 구현 시 `advisory lock` 또는 `mall_id` plain 컬럼 분리 옵션 검토 — plan 변경 3 에 추가. |
| W6 | install_token URL path 로그 유출 | 변경 2 (install_token 식별 키 승격) 구현 시 운영 nginx 로그 마스킹 노트 추가 — plan 변경 2 에 추가. |
| W7 | `CAFE24_INSTALL_INVALID_TOKEN` 토큰 존재 오라클 | 변경 2 구현 시 install endpoint 에 IP 기반 rate limiting 추가 — plan 변경 2 에 추가. |
| W8 | App URL UI 노출 흐름 미명시 | spec §3.2 의 "설정 안내 화면" 이 이미 `App URL` 복사 버튼 + Redirect URI 복사 버튼 명시. 변경 2 적용 시 `appUrl` 응답 값이 자동으로 install_token 포함된 형태로 바뀌므로 UI 변경 불필요 — 확인 완료. |
| W9 | TTL 경계 처리 미정의 | 변경 4 (TTL 정리) 구현 시 spec §9.2 에 "install_token 조회 성공 + created_at 24h 초과 → 정상 처리 후 스캐너 정리" 정책 명시 — plan 변경 4 에 추가. |
| W10 | §13 데이터 모델 요약 install_token 누락 | spec §13 의 한줄 보강 — 별도 spec PR 또는 변경 2 spec 갱신 시 동반. plan 후속 항목으로 등재. |
| W11 | 스캐너 잡 두 쿼리 실행 순서·격리 미명시 | 변경 4 구현 시 spec §1.4 또는 §11.1 에 "독립 실행, 실패 격리" 한 줄 추가 — plan 변경 4 에 추가. |
| W12 | V041 provider_meta 적용 여부 plan 미반영 | **plan 변경 2 선행 확인 체크박스 이미 추가 완료**. |
| W13 | install_token UNIQUE 제약 deferred 미추적 | plan 변경 2 의 spec §3 인용에 "UNIQUE 제약 V0XX 결정 체크박스 추가" 명시. |
| W14 | install_token 신규 흐름 4개 케이스 누락 | 변경 5 테스트 보강 항목에 (a) happy path / (b) NULL 전환 후 재호출 404 / (c) TTL 만료 후 NULL 확인 / (d) replay 방어 4건 명시 — plan 변경 5 에 추가. |
| W15 | install_token nullable 컬럼 누적 우려 | 향후 provider 다변화 시 `IntegrationInstallProcess` 엔티티 분리 검토 — spec §2.10 Rationale 한 줄 추가 (별도 spec PR). |

## Info — 모두 후속 처리

| # | 항목 | 처리 |
|---|------|------|
| I1 | PRNG 품질 미명시 | `crypto.randomBytes(32)` 명시 — spec §1-data-model §2.10 install_token 컬럼 설명에 추가 (별도 spec PR). |
| I2 | HMAC 검증 순서 미명시 | spec §9.8 의사코드에 "① timestamp ② install_token ③ HMAC" 순서 명시 (변경 2 spec 갱신 시 동반). |
| I3 | §6 install_token 보존 정책 미명시 | 변경 0 PR 의 spec §6 전이 표 "callback 실패 보존" 행에 "`install_token` 유지" 한 줄 추가. |
| I4 | V0XX 인덱스 마이그레이션 번호 | 변경 2 마이그레이션 작성 시 확정 (`backend/migrations/V0XX__cafe24_install_token_index.sql`). |
| I5 | swagger.md §2-4 실재 확인 | 변경 2 착수 전 확인. |
| I6 | review session ID dead reference | spec/2-navigation/4-integration.md Rationale 의 `2026-05-14_16-48-25` 참조를 실제 BLOCK 해소 세션(`2026-05-14_18-38-32`) 으로 갱신 (별도 spec 정정). |
| I7 | legacy path 영구 폐기 follow-up | plan 변경 2 에 후속 체크박스 등재 완료. |
| I8 | review 파일 trailing newline 누락 | consistency-check / ai-review 스크립트 개선 사항 — 별도 plan. |
| I9 | 에이전트 내부 과정 서술 노출 | 동일. |
| I10 | consistency-check 5회 실행 해소 이력 분산 | 본 RESOLUTION.md 가 단일 진실 역할. |
| I11 | mall_id O(N) decrypt 우려 | 변경 3 구현 시 `mall_id` plain 컬럼 분리 옵션 검토 — plan 변경 3 에 추가. |

