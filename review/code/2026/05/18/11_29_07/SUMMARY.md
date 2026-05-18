# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 설계와 구현 품질은 전반적으로 양호하나, `tryRecoverExpired`의 DB 재조회 race condition(TOCTOU)과 non-auth 오류의 skipReason 의미 충돌, 테스트 커버리지 갭이 복수 reviewer 에서 중복 지적.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | Testing | 핵심 성공 테스트 (`enqueues cafe24-token-refresh at 0d`) 에서 `scanner.run(now)` 완료 단언 누락 | RESOLUTION 평가 — blocker 아님 (`await` 단독으로도 throw 시 jest fail). graceful 케이스는 `.resolves.toBeDefined()` 사용. |
| 2 | Side Effect | `tryRecoverExpired` 의 refresh → DB 재조회 race window | RESOLUTION 평가 — `refreshViaQueue.waitUntilFinished` 가 worker DB commit 종료 후 반환. 재조회 실패 시 `expired_refresh_failed` 로 graceful skip. follow-up 모니터링 등재. |

## 경고 (WARNING) — 처리 17건

| ID | 카테고리 | 처리 |
|----|----------|------|
| W-1 (req) | non-auth 오류의 별도 skipReason vocabulary | follow-up (운영 신호 발생 시 spec §6.2 갱신) |
| W-2 (req) | `isCafe24RefreshCapable` AES transformer 경유 명시 | 코멘트 추가 불필요 — entity 경유라 transformer 자동 |
| W-3 (req) | enqueue 실패 알림 발사 단언 누락 | **FIX** scanner spec 에 `notificationsService.createMany` 단언 추가 |
| W-4 (req) | `not_capable` 미사용 | follow-up — 외부 MCP provider 가 자기 summary push 가 정합 |
| W-5 (req) | 0d cafe24 알림 발사 spec 명시 | follow-up |
| W-6 (maint) | `hasRefreshToken` 유틸 통합 | follow-up (2 사이트 inline 유지, 3 사이트째 시 추출) |
| W-7~9 (maint) | 테스트 ctx 리터럴 / savedExpired / guard clause | follow-up (style refactor) |
| W-10 (arch) | `ProviderBuildCtx.mcpDiagnostics` push-only 강화 | follow-up (인터페이스 재설계) |
| W-11 (arch) | buildTools 책임 범위 (refresh enqueue 수행) | follow-up (`precheck(ctx)` hook 도입) |
| W-12 (test) | `refreshTokenViaQueue` 전용 unit 미보유 | **FIX** sub-describe 추가 (큐 바인딩 / 폴백) |
| W-13 (test) | refresh 후 두 번째 조회 실패 `lookup_failed` 미테스트 | **FIX** 케이스 추가 |
| W-14 (test) | `buildMcpDiagnosticsMeta` 핸들러 통합 검증 | follow-up |
| W-15 (sec) | refresh 큐 미바인딩 폴백 silent | **FIX** logger.warn 추가 |
| W-16 (doc) | 0-common CHANGELOG 2026-05-18 누락 | **FIX** CHANGELOG 행 추가 |
| W-17 (doc) | JSDoc PR 브랜치명 하드코딩 | **FIX** 날짜 표기로 변경 |

## 참고 (INFO) — 21건

I-1/I-2 (sec): trim / 접근 제어 — defensive coding 가치 작음, 접근 제어는 노드 실행 결과 권한과 동일.
I-3/I-4 (perf): O(N) 직렬 / addBulk — follow-up (현 범위 허용).
I-5/I-6/I-7 (arch): 판별 복제 / 큐 주입 / 알림 정책 — follow-up (RefreshCapableProvider registry 패턴 spec 권장).
I-8/I-9/I-10/I-11 (req): plan 체크박스 / §9.6 진입점 / source 라벨 / mcpDiagnostics 미시동 필드 — **FIX 처리** (plan/spec 갱신 + follow-up 등재).
I-12/I-13/I-14 (test): non-AuthFailed / 빈 string RT / mcpDiagnostics undefined — **FIX 모두 추가**.
I-15/I-16/I-17 (maint): magic string / pushSummary 헬퍼 / rename — follow-up.
I-18/I-19 (db): 인메모리 필터 / replica lag — follow-up.
I-20/I-21 (doc): 예제 toolCount 추가 (이미 포함) / 주석 명확화 — **I-21 FIX**.

## 처리 요약

**본 PR 내 fix (12건)**: W-3, W-12, W-13, W-15, W-16, W-17, I-8, I-9, I-12, I-13, I-14, I-21

**Follow-up (plan 의 Follow-up 섹션 등재)**: W-1, W-2, W-4~11, W-14, I-1~7, I-10, I-11, I-15~20

405 tests passed (cafe24/ai-agent/expiry-scanner 범위), 3887 full suite — 회귀 0. cafe24 outbound mock 부담 큰 e2e 는 `cafe24-backlog-residual.md` B-5-8 alt 정책 그대로 unit 대체.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | 폴백 silent (FIX), 접근 제어 / trim 가드 (INFO) |
| performance | LOW | tryRecoverExpired O(N) / addBulk (INFO) |
| architecture | LOW | mcpDiagnostics out-parameter 패턴 / buildTools 책임 (follow-up) |
| requirement | MEDIUM | non-auth skipReason / credentials 가드 / 알림 단언 (FIX 3건 + follow-up) |
| scope | NONE | 변경 범위 집중, 회귀 없음 |
| side_effect | MEDIUM | race (follow-up) + 폴백 silent (FIX) + non-auth (FIX) |
| maintainability | LOW | 헬퍼 통합 / 테스트 헬퍼 (follow-up) |
| testing | MEDIUM | refreshTokenViaQueue / lookup_failed / non-auth / undefined ctx (FIX 4건) |
| documentation | LOW | CHANGELOG 누락 / JSDoc / 주석 명확화 (FIX 3건) |
| database | LOW | JSONB 캐스팅 / replica lag (follow-up) |
| concurrency | LOW | TOCTOU 윈도우 (follow-up 모니터링) |

자세한 처리 내역: [`RESOLUTION.md`](./RESOLUTION.md)

## 라우터 결정

- **실행 11명**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency
- **제외 2명**: dependency (lockfile 무변경), api_contract (외부 계약 무변경)
