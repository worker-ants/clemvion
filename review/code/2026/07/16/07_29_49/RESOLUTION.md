# RESOLUTION — playwright-runner 사전 빌드 이미지 (§4 item2) 리뷰 처분

세션: `review/code/2026/07/16/07_29_49` · reviewer 2종(dependency·side-effect) · 0 Critical / 2 Warning
구현 커밋: `cdcb9b9cb` · fix 커밋: `f809c715d`

## 조치 항목

| # | 출처 | 등급 | 처분 |
|---|---|---|---|
| 1 | dependency | WARNING | base 태그 v1.59.1-jammy vs @playwright/test 1.61.0 불일치 → **base 를 v1.61.0-jammy 로 정렬**(존재 확인). 주석 실제 버전 반영. |
| 2 | dependency / side_effect | WARNING | `COPY codebase/packages`(6개) → **frontend closure 4개** per-package COPY. sdk/web-chat-sdk 소스 변경이 캐시 무효화 안 함. manifest 6개 유지. |

Info(비차단): `--with-deps` 제거는 현재 안전(base 정렬로 OS-lib drift 완화). 익명 볼륨·`--build`·chromium 경로 정상.

## TEST 결과
- **lint / unit / build**: 해당 없음(pass-through) — 변경 set(e2e 전용 Dockerfile + docker-compose.e2e.yml)은 app 빌드 파이프라인·backend e2e 밖.
- **e2e**: **playwright-runner 단독 46 tests 통과**(fix 전 45.7s / fix 후 45.7s 무회귀). baked frontend deps + chromium 으로 런타임 install 없이 동작 실측. backend e2e 는 이 변경과 무관(미변경).
- 이미지 빌드: base v1.61.0 pull + closure 4 COPY 성공, frontend node_modules·@workflow 4개·/ms-playwright/chromium-1228·pnpm 10.23 baked.

## 보류·후속 항목 (저우선)
- `@playwright/test` 해석 버전(`pnpm list @playwright/test`) vs Dockerfile.playwright-e2e / docker-compose.e2e.yml 의 base 태그 major.minor 일치를 검증하는 CI 가드 — caret `^1.59.1` drift 재발을 build 전에 정적으로 포착. (현재는 정렬됨 + 주석으로 안내.)
