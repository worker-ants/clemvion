# 코드 리뷰 SUMMARY — playwright-runner 사전 빌드 이미지 (§4 item2)

- 범위: `--range HEAD~1..HEAD` (커밋 `cdcb9b9cb` — Dockerfile.playwright-e2e 신규 · docker-compose.e2e.yml)
- reviewer 2종 (focused): dependency, side-effect

## 종합 위험도: **MEDIUM** (Critical 0 / Warning 2 → **모두 fix**)

| reviewer | 위험도 | Critical | Warning | 핵심 |
|---|---|---|---|---|
| dependency | MEDIUM | 0 | 2 | base 태그(1.59.1) vs @playwright/test(1.61.0) 불일치 · COPY closure 미최적화 |
| side_effect | LOW | 0 | 0 (echo COPY WARNING) | anonymous volume·--build·chromium 경로·--with-deps 제거 모두 정상 확인 |

## Warning 처분 (2건 모두 fix — 커밋 `f809c715d`)

1. **[dependency] base 이미지 태그 v1.59.1-jammy vs 실제 @playwright/test 1.61.0(caret ^1.59.1 drift) 불일치** — build-time `playwright install` 이 자가치유해 46건 통과하나, base 의 OS 공유 라이브러리가 낡아 향후 실패 잠재. → **FIX**: base 를 `v1.61.0-jammy`(존재 확인)로 정렬 + 주석 실제 버전 반영.
2. **[dependency/side_effect] `COPY codebase/packages`(6개) vs frontend closure 4개** — sdk/web-chat-sdk 변경 시 불필요 캐시 무효화(item1 컨벤션 불일치). → **FIX**: 4개 per-package COPY(expression-engine·node-summary·chat-channel-validation·graph-warning-rules), manifest 6개 유지.

## Info 처분 (비차단)
- `--with-deps` 제거: 현재 안전(46건 통과), base 정렬로 OS-lib drift 리스크도 완화. INFO.
- 익명 볼륨 baked node_modules 보존·`--build` 재빌드·chromium 비마스킹: 정상 확인.
- **후속(저우선)**: `@playwright/test` 해석 버전 vs base 태그 major.minor 일치 CI 가드 — caret drift 재발 방지(RESOLUTION 기록).

## 검증
이미지 빌드(base 1.61.0 + closure 4) 성공 · playwright-runner 단독 **46 tests 통과**(fix 전후 모두, 45.7s) · chromium-1228 baked · backend e2e·app 빌드 미변경.
