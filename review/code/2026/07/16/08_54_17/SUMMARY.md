# AI 코드 리뷰 통합 보고서 — node-linker hoisted→isolated 전역 전환 (plan §3)

대상: `origin/main..HEAD` (구현 커밋 `19252b21e`) — 9 files (`.npmrc`·`pnpm-workspace.yaml`·
`pnpm-lock.yaml`·backend `package.json`·backend/frontend `Dockerfile`·`next.config.ts`·
`docker-compose.e2e.yml`·plan §3).

실행 reviewer 5개(build/deps 성격에 맞춘 부분집합): **dependency · security · scope · documentation ·
architecture**. (correctness/perf/db/concurrency/api/testing 등은 애플리케이션 소스 무변경이라 미해당.)

## 종합 판정: **0 Critical / 0 Warning** — 머지 가능

전 reviewer 가 CRITICAL·WARNING 0. 발견은 전부 INFO/LOW. 애플리케이션 소스는 한 줄도 바뀌지 않았고,
4개 backend 신규 direct 의존은 모두 diff 이전 lockfile 에 **동일 버전으로 이미 해소**돼 있던 것을 직접
선언으로 승격한 것(신규 패키지·버전 0)임을 dependency·security·architecture 가 각각 origin/main lockfile
대조로 교차 확인했다.

## Reviewer별 결과

| Reviewer | 위험도 | Critical | Warning | 요지 |
|---|---|---|---|---|
| dependency | clean | 0 | 0 | 4개 dep 배치레벨·caret range·라이선스(전부 MIT/BSD-2)·override 정합 OK. `ip-address` override 와 direct 선언 일치. INFO: 로컬 `pnpm audit` 이 npm registry 410(legacy endpoint retirement)로 실패 — 본 diff 무관 사전 인프라 이슈 |
| security | clean | 0 | 0 | 4개 dep 모두 install lifecycle script 없음(onlyBuiltDependencies 우회 없음). override 핀 lockfile byte-identical(picomatch `4.0.4→4.0.5` 는 `^4.0.4` 범위 내 patch, 약화 아님). isolated 는 phantom fail-fast 로 공급망 위생 순이득 |
| scope | LOW | 0 | 0 | 의도 4축(linker flip / phantom 선언 / 주석 동기화 / plan 기록)에 정확 대응, 소스 0줄. INFO: plan §3 "변경 요약" 에 lockfile 부수 churn 미명시 → **본 라운드 반영(plan §3 보강)** |
| documentation | clean | 0 | 0 | hoisted→isolated 주석 동기화가 기술적으로 정확·완전. live repo grep 결과 잔여 stale 참조 없음. plan §1 historical 보존 확인 |
| architecture | LOW | 0 | 0 | Docker 토폴로지(deps→builder→deploy→runner·injected deploy·standalone COPY·playwright 사전빌드)가 isolated 레이아웃에 robust. k8s 무결합. INFO 4건(아래 처분) |

## INFO 처분

**반영(본 resolution):**
- **[architecture]** `codebase/backend/jest.config.ts:20-22` 주석이 "project standardizes on npm" 이라
  사실과 반대 + isolated 전환으로 `.pnpm/<pkg>@<ver>/node_modules/` 가 이 regex 의 live path 가 됨 →
  주석을 isolated 사실로 정정 + 인접 stale `npm test`→`pnpm test`(line 40) 동반 정정. (comment-only)
- **[scope]** plan §3 "변경 요약" 에 lockfile 부수 churn(eslint-plugin-import peer 재전개·picomatch patch)
  한 문장 보강.

**연기(별개 후속, 본 diff 회귀 아님):**
- **[architecture]** `docker-compose.e2e.yml` anonymous-volume 마스킹 목록이 Dockerfile COPY 클로저와
  달리 fail-fast 가드 없이 수동 동기화 — 사전 존재 구조 debt. plan §4 후속 성격의 CI 대조 가드 후보로만 기록,
  본 PR 범위 아님(현재 frontend `@workflow/*` 4개와 정확 일치 확인됨).
- **[architecture]** mixed-linker(in-place hoisted↔isolated) 하이브리드 리스크 — plan 에 문서화됨,
  자동 postinstall 가드는 저가치(node_modules 는 derived·gitignore, `rm -rf && install` 자가치유,
  CI 는 lockfile-keyed store 캐시라 무영향). 문서 완화로 충분.
- **[dependency]** 로컬 `pnpm audit` 410 실패 — npm registry legacy endpoint retirement, 본 변경 무관.
  CI(`deps-security-checks.yml`)의 audit 는 별개 실행 경로.

## 검증(본 resolution 재수행)
fix(comment-only jest.config.ts + plan §3) 반영 후: lint PASS · unit(14) PASS · build PASS.
e2e 는 delta 가 주석 전용(jest.config.ts) + plan-only 이라 면제(PROJECT.md 화이트리스트) —
실질 변경(`19252b21e`)은 이미 both-stack e2e(backend 254 · frontend playwright 46) + standalone 런너
스모크로 green 확인됨.
