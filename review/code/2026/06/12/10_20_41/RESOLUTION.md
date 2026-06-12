# RESOLUTION — 그룹3 ai-review (10_20_41, 올바른 base origin/main..HEAD)

10_07_06 의 stale-base 재실행. RISK=LOW, 0 Critical, 7 Warning — 전부 본 PR 실제 6파일 diff 대상.

| # | 카테고리 | 발견 | 판정 | 조치 |
|---|----------|------|------|------|
| W1 | SPEC-DRIFT | 2-code §4 step2 래퍼가 2단 구조 미반영 | **FP / OUT OF SCOPE** | 본 PR diff 에 `2-code.md` 없음. #551(그룹2a, 머지됨)이 이미 step2 를 2단(outer IIFE + inner __user) 으로 갱신함. reviewer 의 stale/오독. |
| W2/W5 | 부작용/유지보수 | `process.env.ALLOW_PRIVATE_HOST_TARGETS` try/finally 변이 (jest.replaceProperty 권장) | **KEEP (consistency)** | 동 파일 기존 none opt-out 테스트가 쓰는 동일 패턴을 그대로 따름. env-read-once 는 미채택(선택 follow-up). 단일 PR 에서 파일 전역 패턴만 바꾸는 건 churn — 일관성 유지. |
| W3 | 부작용 | dry-run 테스트 `global.fetch` 교체 후 afterEach 복원 없음 | **KEEP (no leak)** | 파일 `beforeEach` 가 매 테스트 `global.fetch` 를 재설정하므로 누수 없음. reviewer 도 "기존 관행과 동일, 신규 문제 아님" 명시. |
| W4 | 유지보수 | 신규 테스트의 inline `makeService`+`new Handler` 중복 | **KEEP (consistency)** | 동 파일 모든 기존 테스트가 inline setup 사용 — 파일 컨벤션 일치. |
| W6 | 테스트 | `$vars` copy-out fallback 이 catch 분기 spy 미검증 (행동 검증) | **FIXED (주석)** | 핸들러 구조상 spy 주입 불가 → behavioral 검증임을 테스트 주석에 명시. copy-out 거부가 isolated-vm 동작 의존이며 버전업 시 본 테스트가 먼저 깨져 회귀를 드러냄을 기록. |
| W7 | 문서 | `ALLOW_PRIVATE_HOST_TARGETS` .env.example/운영가이드 미문서화 | **OUT OF SCOPE (기존 follow-up)** | 본 PR diff 밖, 이전 리뷰(그룹1/2b)에서도 follow-up 으로 등재. reviewer 도 "이번 PR 차단 사유 아님". |

## INFO 처리(선택)
- **I5 (FIXED)**: configEcho strip 테스트 `config.url ?? ''` → `expect(config.url).toBeDefined()` 선행 단언 추가(undefined 시 무의미 통과 방지).
- I4(IPv6 bracket SSRF), I8(타입단언 헬퍼), I9(매직넘버 5), I10(it.each label), I12(null 중복), I13(console 엣지) 등 — 선택 개선, 본 PR 범위 밖/저우선.
- I1(__dryRun 외부주입 감사), I2(SSRF opt-out SPOF), I3(_retry_state 절대경로) — 보안 관찰/환경 항목, 별도 follow-up.

## 비고 — 첫 리뷰(10_07_06) stale-base
10_07_06 은 로컬 `main` ref stale(a1ad25f6, #549) 로 #550/#551/#553 머지분을 본 PR 변경으로
오인한 148파일 거대 diff 였다(Critical 2건 전부 그 FP). `--range origin/main..HEAD` 로 재실행한
본 10_20_41 이 authoritative. 상세 `../10_07_06/RESOLUTION.md`.

## 최종 상태
build PASS · backend lint PASS · code 67 + http 72 backend unit + frontend i18n 17 green · 0 Critical.
in-scope Warning(W6) + INFO(I5) fix, 나머지 Warning 은 파일 컨벤션 일관성 유지/범위 밖으로 문서화.
push 후속 코드 변경 없음(W6/I5 는 본 RESOLUTION 과 동일 commit).
