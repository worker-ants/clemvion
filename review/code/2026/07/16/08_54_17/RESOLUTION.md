# RESOLUTION — node-linker hoisted→isolated 전역 전환 (plan §3)

리뷰 세션: `review/code/2026/07/16/08_54_17` (reviewer 5개: dependency·security·scope·documentation·architecture)
구현 커밋: `19252b21e` / fix 커밋: `2ada730f3`

## 판정
**0 Critical / 0 Warning.** 전 reviewer clean. 발견은 INFO/LOW 뿐. 차단 사유 없음.

## 발견 처분

| # | reviewer | 심각도 | 항목 | 처분 |
|---|---|---|---|---|
| 1 | architecture | INFO | `codebase/backend/jest.config.ts:20-22` 주석 "project standardizes on npm" 이 사실과 반대 + isolated 하에서 `.pnpm/.../node_modules/` prefix 가 live path 로 승격 | **FIXED** (`2ada730f3`) — 주석을 isolated 사실로 정정 + 인접 `npm test`→`pnpm test`. comment-only |
| 2 | scope | INFO | plan §3 "변경 요약" 이 lockfile 부수 churn(eslint-plugin-import peer 재전개·picomatch patch) 미명시 | **FIXED** (`2ada730f3`) — §2 선례와 함께 한 문장 보강 |
| 3 | architecture | INFO | `docker-compose.e2e.yml` anonymous-volume 마스킹 목록이 Dockerfile COPY 클로저와 달리 fail-fast 가드 없이 수동 동기화 | **DEFERRED** — 사전 존재 구조 debt(본 diff 회귀 아님). 현재 frontend `@workflow/*` 4개와 정확 일치 확인. CI 대조 가드는 별개 후속 후보(plan §4 성격) |
| 4 | architecture | INFO | mixed-linker(in-place hoisted↔isolated) 하이브리드 리스크 | **DEFERRED** — plan 에 문서 완화 존재. 자동 postinstall 가드는 저가치(node_modules=derived·gitignore, `rm -rf && install` 자가치유, CI 는 lockfile-keyed store 라 무영향) |
| 5 | dependency | INFO | 로컬 `pnpm audit` 이 npm registry 410(legacy endpoint retirement)로 실패 | **NO ACTION** — 본 변경 무관 사전 인프라 이슈. CI `deps-security-checks.yml` audit 는 별개 경로 |
| 6 | security | INFO×4 | 근거 기록용 확인(신규 패키지 0·lifecycle script 0·override byte-identical·isolated 공급망 순이득) | **NO ACTION** (확인성) |

## TEST 결과
- fix(`2ada730f3`, comment-only jest.config.ts + plan-only) 반영 후: **lint PASS · unit(14) PASS · build PASS**.
- **e2e**: 면제 — 마지막 실질(런타임 영향) 변경 이후 delta 가 **주석 전용(`jest.config.ts`) + `plan/**`** 로
  PROJECT.md §e2e 면제 화이트리스트("주석 전용 변경", "`plan/**`")의 부분집합. 실질 변경(`19252b21e`)은
  이미 both-stack e2e — **backend `make e2e-test` 254 PASS · frontend playwright `make e2e-test-full` 46 PASS**
  — 및 frontend standalone 프로덕션 런너 스모크(빌드→기동→홈 307·MODULE_NOT_FOUND 0)로 green 확인됨.
  (자가 발급 아님: 화이트리스트 인용 근거 명시.)

## 결론
node-linker=hoisted→isolated 전역 전환 + backend phantom 의존 4개 선언. 리뷰 clean, 지적 INFO 중
반영 대상 2건 즉시 처리, 나머지는 사전 존재 debt/무관 항목으로 근거와 함께 연기. 머지 준비 완료.
