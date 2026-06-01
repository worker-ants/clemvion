# RESOLUTION — A-3 cafe24 install rate limiting (Layer 2)

SUMMARY: `review/code/2026/06/02/08_02_32/SUMMARY.md` (위험도 HIGH, Critical 1 / Warning 9 / Info 16).
수동 처리 (resolution-applier 미사용 — Critical 이 false positive 라 nuanced 판단 필요).

## 조치 항목

| SUMMARY # | 분류 | 판단 | 조치 | commit |
|---|---|---|---|---|
| CRITICAL 1 | 요구사항/문서화 | **false positive** | spec 은 이미 갱신·커밋됨 (`f7840ca1`: 4-cafe24.md §9.8 Rate limiting note+상수표+Rationale, 2-navigation §9/§10.3 CAFE24_INSTALL_RATE_LIMITED). reviewer 가 diff 에 포함된 consistency-check 의 **사전(pre-impl) W1-W3 경고**("구현 전 spec 갱신하라")를 미갱신으로 오판. install 에러는 §9 형제 코드 옆에 등재했고 §10 vocabulary(L998)는 OAuth 콜백용이라 무관. 실제 sub-issue 는 W7(상수명) → 아래 fix | 본 커밋 |
| WARNING 7 | 요구사항 | 유효 | 코드 상수 `FAIL_THRESHOLD`/`FAIL_WINDOW_SEC` → `INSTALL_FAIL_THRESHOLD`/`INSTALL_FAIL_WINDOW_SEC` 로 rename 해 spec/plan 과 일치 | 본 커밋 |
| WARNING 2 | 보안 | 유효 | `isPlausibleIp` 가드 추가 — IP charset(IPv4/IPv6) 검증, 비정상값(개행 등) Redis 키 공간 오염 차단. `isLockedOut`/`recordFailure` 진입 가드 | 본 커밋 |
| WARNING 6 | 아키텍처 | 유효 | enumeration 분류 로직을 `Cafe24InstallRateLimitService.isEnumerationFailureCode(code)` 정적 메서드로 추출 — 컨트롤러 catch 인라인 제거, 단일 진실화 | 본 커밋 |
| WARNING 8 | 유지보수성 | 부분 조치 | 위 정적 메서드 추출로 컨트롤러 인라인 분류 로직 제거. 메서드 전체 분해(handleCafe24Install 위임)는 A-3 이전부터 있던 복잡도라 별 리팩토링으로 분리 | 본 커밋(부분) |
| INFO 5 | 테스트 | 유효 | `close()`/`onModuleDestroy()` 4 케이스 추가 (quit 호출·에러 흡수·no-redis no-op) | 본 커밋 |
| INFO 6 | 테스트 | 유효 | recordFailure Lua 스크립트 `EXPIRE`/`if c == 1` 조건부 실행 검증 추가 | 본 커밋 |
| INFO 7 | 테스트 | 유효 | `isLockedOut` 비정수 GET 값(NaN) 경계 케이스 추가 | 본 커밋 |
| INFO 9 | 테스트 | 유효 | controller `req.ip === undefined` 케이스 추가 (서비스에 undefined 전달·정상 진행) | 본 커밋 |

## 보류·후속 항목 (근거)

| SUMMARY # | 판단 | 근거 |
|---|---|---|
| WARNING 1 (req.ip trust proxy) | 보류(이미 충족) | `main.ts:66` 에서 `expressInstance.set('trust proxy', 1)` 이미 설정됨 → req.ip 신뢰 전제 충족. 기존 `UserThrottlerGuard` 도 동일 req.ip 사용. 신규 조치 불요 |
| WARNING 3 (e.message 클라이언트 노출) | 후속 분리 | `third-party-oauth.controller.ts` 의 `e.response?.message ?? e.message ?? 'Install failed'` 는 **A-3 이전부터 있던** 코드(본 PR 미변경 라인). 응답 메시지 노출 정책 변경은 install 에러 전반에 영향 → 별 보안 cleanup PR. 본 PR scope(rate limiting) 밖 |
| WARNING 4·5 (SRP/DIP — Redis factory provider·인터페이스 추출) | 후속 분리 | 본 서비스는 동일 모듈의 기존 `Cafe24InstallNonceCache` 패턴(생성자 Redis init + Optional 주입 + duck-typed 테스트)을 **의도적으로 동일 적용**. 인터페이스/팩토리 분리는 두 서비스(+throttler 가드)에 걸친 codebase-wide 리팩토링이라 단독 적용 시 일관성 저해. 패턴 전환은 별 아키텍처 PR |
| WARNING 9 (recordFailure await 레이턴시) | 미조치(의도) | reviewer 도 "현재 await 유지 권장 — 보안 정확성 우선, 저빈도 endpoint 라 운영 영향 없음" 으로 동의. 변경 없음 |
| INFO 14 (user guide cafe24.mdx 429) | 보류(비적용 판단) | 429 `CAFE24_INSTALL_RATE_LIMITED` 는 enumeration(대량 실패) 시에만 발동하는 anti-abuse lockout 으로, **정상 사용자의 install 흐름에 등장하지 않는다**. end-user 가이드에 추가하면 정상 사용자에게 혼란을 주는 운영 노이즈 → 의도적 미반영 (SoT 는 spec §9.8) |
| INFO 1·3·4·8·10·11·12·13·15·16 | 미조치 | 메트릭 수집 권고/의도적 설계 확인(원자성·TOCTOU·exports)/cosmetic(warn 헬퍼·Lua 백틱·mock 타이핑)/현행 유지 확인. 기능·보안 영향 없음 |

## TEST 결과

- lint: 통과 (eslint --fix 가 매 실행마다 무관한 6개 기존 파일을 자동 수정 → 매번 revert. 본 PR scope 유지)
- unit: 통과 (backend 5409+ / 신규 서비스·컨트롤러 케이스 61 pass)
- build: 통과 (backend+frontend build + docker 이미지 검증)
- e2e: 통과 (140 e2e)

## 비고

- consistency-check `--impl-prep` (BLOCK:NO) 의 W4·W5 (`send_email` 포트 id / `database_query` SSRF 에러코드) 는 A-3 무관 기존 노드 컨벤션 이슈 → `cafe24-backlog-residual.md` 후속으로 분리(SUMMARY 보류 절 기재).
- Layer 1 (분산 throttle store) 은 전역 blast radius 라 별 infra PR 로 deferred (사용자 결정 2026-06-02).
