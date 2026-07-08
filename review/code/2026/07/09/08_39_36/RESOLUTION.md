# RESOLUTION — 슬러그 라우팅 ai-review round 4 (2026-07-09 08_39_36, 수렴)

대상: round-3 fix 커밋(`865e6b939`). 위험도 LOW · Critical 0 · Warning 2. **본 라운드로 수렴.**

## 조치 항목

| SUMMARY # | 카테고리 | 결정 | 근거 |
|---|---|---|---|
| W1 | architecture | **defer (후속)** — `useWorkspaceRouter()` 래핑 훅 또는 `no-restricted-syntax` ESLint 룰로 slug 부착을 API/린터 레벨에서 강제 | 리포지토리 전역 패턴 변경(`router.push`/`replace` 직접 호출부 ~30곳 영향) → phase-1 scope 밖. 현재 코드는 4라운드 리뷰 + e2e + 유닛으로 정합 확인됨. 강제 장치는 별도 하드닝 트랙 |
| W2 | maintainability | **defer (후속)** — `buildExecutionHref(slug, workflowId, executionId)` 로 rerun-modal 내 경로 템플릿 2곳 통합 | 저비용이나, 코드 변경 → 추가 리뷰 라운드 유발. Critical 0 이 4연속 확인된 시점이라 수렴 원칙(구조/coverage WARNING defer) 적용. **핵심**: 이번 real bug(재실행 slug 누락)는 이미 slug-case 회귀 테스트로 lock 됨 → 세 번째 사용처 추가 시에도 테스트가 재발을 포착. INFO#18 인라인 주석 권장도 동일 트랙 |

두 WARNING 모두 **현재 결함이 아니라 "동일 defect class 미래 재발 방지" 구조 제안**이다(review 본문 명시). 잔여
후속은 아래 §후속 트랙에 통합 기록.

## 수렴 선언 (convergence)

- ai-review **4라운드 전부 Critical 0** (round1 6W→round2 4W→round3 6W[real bug 1건 fix]→round4 2W[구조 제안]).
  위험도·발견 심각도가 단조 수렴했고, round-4 는 신규 실제 결함 0.
- `--impl-done` consistency **BLOCK:NO** (0 Critical).
- 마지막 코드 커밋(`865e6b939`)이 본 리뷰 세션의 검토 대상이며, 남은 2 WARNING 은 defer(구조 후속).
  추가 코드 변경 없이 수렴하므로 신규 리뷰 라운드 불요.

## 리뷰 커버리지 갭 (파이프라인)

`requirement` reviewer 가 manifest success 이나 output 미산출(disk-write 갭, 라운드마다 반복). 단:
- round-3(08_18_37)에서 requirement 가 정상 산출돼 바로 이 rerun-modal 버그(W1)를 잡았고, 본 커밋이 그 fix + spec §10.2 정합 갱신이다 → requirement 관점(spec 대비 정합)은 자명히 충족.
- `--impl-done` consistency(BLOCK:NO)가 spec-code 정합을 독립 검증.
- 산출된 나머지 7 reviewer(security/architecture/scope/side_effect/maintainability/testing/documentation) 전부 Critical 0.
→ 저위험으로 판단, 단독 재실행 생략(limit-conscious).

## TEST 결과

- **lint**: 통과 (0 err) · **unit**: 통과 (260 files, 5114 pass/1 skip) · **build**: 통과(route 충돌 0)
- **e2e**: 통과 — backend supertest **243**(`_test_logs/e2e-20260709-084022.log`, 마지막 코드 커밋 이후) + FE Playwright slug-routing 4/4(라우팅 불변 확인)

## 후속 트랙 (본 PR 범위 밖)

- **slug 라우팅 하드닝**: W1(`useWorkspaceRouter()`/ESLint 룰)·W2(`buildExecutionHref` 헬퍼)·INFO#18(인라인 주석) — raw `router.push`/`replace` slug 강제.
- **W3**(open-redirect 유틸 `buildWorkspaceHref`↔`isSafeRedirectPath` 통합, redirect 파라미터 소비 기능 추가 시)·**W4**(store↔resolve-fallback 순환 lint 강제) — round-3 defer 유지.
- **editor(`/workflows/[id]`) slug화 = phase 2**.
