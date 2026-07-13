# 코드 리뷰 SUMMARY — pnpm overrides/onlyBuiltDependencies 정규 위치 이전

- 범위: `--range HEAD~1..HEAD` (커밋 `6331d539` — `package.json`, `pnpm-workspace.yaml`, `PROJECT.md`, `plan/in-progress/pnpm-migration-followups.md`)
- reviewer 2종 (focused — 보안핀 이전이라 dependency·security 가 핵심): dependency, security
  - 순수 설정 위치 이전(코드/런타임 변경 없음)이라 나머지 reviewer 미실행.

## 종합 위험도: **LOW** (Critical 0 / Warning 2 / Info 다수)

| reviewer | 위험도 | Critical | Warning | 독립 검증 |
|---|---|---|---|---|
| dependency | LOW | 0 | 1 | js-yaml 파싱 + 이전 package.json 1:1 대조 + lockfile grep → 20 overrides·5 onlyBuilt 전건 보존·quoting 정확 확인 |
| security | LOW | 0 | 1 | 1:1 diff 대조 → 공급망 통제(CVE 핀·build 허용목록) 누락/추가 없음, fail-open→fail-closed |

**차단 사유 없음.** 2 Warning 모두 code fix 불요:

1. **[dependency WARNING]** `@nestjs/swagger` 11.2.7 exact pin 이 보안 패치 차단 — **승계(inherited)**. 이 diff 는 핀 위치만 이동, 값·리스크 불변. §2(deep-import → openapi3-ts 교체 후 11.4.x 상향)가 이미 추적 중. → **조치 불요, §2 추적 유지.**
2. **[security WARNING]** `pnpm-workspace.yaml` overrides/onlyBuiltDependencies **내용** 검증 CI 가드 + 상시 취약점 스캔(pnpm audit/Dependabot/OSV) 부재 — "설정이 읽히는가"(본 PR 해결)와 별개인 "내용이 계속 올바른가". reviewer 가 명시적으로 본 PR 스코프 밖으로 판단. → **plan §4 에 신규 후속으로 기록.**

## 핵심 검증 결과 (긍정)
- overrides 20건 · onlyBuiltDependencies 5건 **전건 보존**(누락·추가·오타·quoting 오류 0) — 양 reviewer 독립 재현.
- `pnpm-lock.yaml` 재해소 byte-identical → **버전 drift 0**, 핀이 실제로 읽혀 재적용됨 증명.
- 직전 라운드(00_33_41)의 "핀 거버넌스 공백" WARNING 을 **근본 해소**(fail-open→fail-closed).
