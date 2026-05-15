# e2e Bisect Notes — `review/code/2026/05/15/19_07_13`

`make e2e-test-full` 결과의 bisect 기록. SUMMARY 의 W-8/W-9 (Playwright 시각 회귀 follow-up) 에 더해, 본 PR 시행 중 발견한 실제 e2e fail 의 원인을 좁히고 fix #1 만 적용한 사유를 정리한다.

조치 후 현재 상태:
- **fail #1 (a11y smoke — forgot-password 첫 Tab)**: **fix 적용 + 회귀 잠금**. commit `3af19e21`.
- **fail #2 (password-reset — 유효 토큰 제출 → /login redirect)**: **root cause 미확정, CI 검증 대기**. 본 문서에 bisect 결과 기록.

---

## Fail #1: a11y smoke — forgot-password 키보드 진입

`frontend/e2e/a11y/smoke.spec.ts:109` — *"첫 Tab 이 email 입력으로 직접 도달"* 을 enforce.

**원인**: brand-refresh 가 `(auth)/layout.tsx` 의 카드 컨테이너 위에 `<Link href="/" aria-label="Clemvion"><Logo .../></Link>` 를 추가하면서 첫 Tab 이 로고 링크에 잡혀 e2e 회귀.

**Fix**: 인증 화면 로고를 **non-link 이미지** 로 변경 (sidebar 의 home link 변종과 역할 분리). 인증 흐름은 인증 의도가 1차이므로 home nav 가치 낮음. `(auth)/__tests__/layout.test.tsx` 에 non-link 회귀 잠금 케이스 추가. commit `3af19e21`.

**검증**: 35 → 34 → 35 passed (1 추가 케이스 + a11y fix).

---

## Fail #2: password-reset — 유효 토큰 제출 → /login redirect

`frontend/e2e/auth/password-reset.spec.ts:51` — submit 후 3s setTimeout → `router.push("/login")` 으로 URL 이 `/login` 으로 바뀌어야 통과. 본 PR 에서 URL 이 영구히 `/reset-password?token=...` 로 머물러 timeout fail.

### 관측

- API 호출은 정상 (trace 에서 `POST /api/auth/reset-password` 200 OK 4ms 확인)
- assertion 1 (`success Card 의 '로그인으로 이동' 링크 toBeVisible`) → 통과
- assertion 2 (`URL toMatch /login` poll 10s) → fail
- 페이지 스냅샷 (t=10s) 은 **원본 form** 으로 되돌아간 상태 — success Card 가 사라지고 폼이 다시 표시됨
- toast.error 없음 (catch 안 일어남)
- 같은 코드 main 에서는 CI 직전 통과 이력

### Bisect 결과 (`make e2e-test-full` 반복 실행)

| # | globals.css `:root` | globals.css `.dark` | `@theme` directive | `(auth)/layout.tsx` | Result |
|---|---|---|---|---|---|
| 1 | mine | mine | mine | mine (with `<Link>`) | 2 fail (a11y + reset) |
| 2 | mine | mine | mine | mine (non-link, fix #1) | 1 fail (reset) |
| 3 | mine | mine | mine | main | 1 fail (reset) |
| 4 | **main** | **main** | **없음** | main | **0 fail** ✓ |
| 5 | **main** | mine | 없음 | mine (fix #1) | **0 fail** ✓ |
| 6 | mine | mine | 없음 | mine (fix #1) | 1 fail (reset) |
| 7 | main + only `--primary` mine | main | 없음 | mine (fix #1) | 1 fail (reset) |
| 8 | main + only `--background` mine | main | 없음 | mine (fix #1) | 1 fail (reset) |
| 9 | mine | mine | mine | mine (fix #1) + test timeout 15s | 1 fail (reset, 11.8s 만에 fail) |
| 10 | mine | mine | mine | mine (fix #1) + test 진단 split | 1 fail (URL poll 에서) |
| 11 | **main** | **main** | **mine** (만 추가) | mine (fix #1) | 1 fail (reset) ★ |
| 12 | mine | mine | 없음 (제거) | mine (fix #1) | 1 fail (reset) ★ |

### 결론

- **fail #2 의 트리거는 globals.css 의 CSS 변경 그 자체**. `(auth)/layout.tsx` 의 로고 추가/제거는 fail #2 와 무관 (fix #1 만 영향).
- **`:root` HSL 값 ANY 단일 변경** (`--background` 만, `--primary` 만 모두 재현) → fail.
- **`@theme` directive 단독 추가** (`:root/.dark` 는 main 그대로) → fail (#11).
- **두 가지 모두 독립적으로 fail 을 트리거** — bisect 가 단일 원인으로 좁히지 못함.

### 추정 root cause

CSS 변경이 form 동작을 깨는 것은 비합리적 → **Next.js dev mode 의 HMR + 환경 타이밍** 가능성 높음:
1. 제출 click → `setIsSuccess(true)` → success Card 렌더 (검증됨)
2. Tailwind v4 JIT 또는 webpack 의 CSS 재처리가 mid-test 에 트리거됨
3. React Fast Refresh 가 컴포넌트를 remount → `isSuccess=false` 초기 상태로 복귀
4. setTimeout(3s, router.push) 은 stale closure 가 되거나 cancel
5. 결과: URL 영구히 `/reset-password`, snapshot 은 원본 form

본 가설은 `bd5rnpu1l` (진단 split) 의 *assertion 1 통과 + assertion 2 fail + snapshot=원본form* 패턴과 일관됨.

**환경 종속성**: 본 fail 은 Mac ARM 의 docker emulation 에서 **결정적으로 재현**. CI 는 Ubuntu x86 (더 빠름) — race window 가 다르므로 통과할 수 있음.

### 본 PR 의 결정

1. **fix #1** (a11y first-Tab) — 적용 + 잠금 (`3af19e21`).
2. **fail #2** — CI 검증 대기. CI 가 통과하면 local docker timing flake 로 분류, 통과 못 하면 본격 fix 진입.
3. `(auth)/layout.tsx` 의 로고는 **유지** (브랜드 가시성 + spec §8.4.6 요구사항).
4. `@theme` directive 는 **유지** (Stage 3 follow-up 에서 `bg-vine-700` 등 utility 사용 예정).
5. `:root`/`.dark` HSL 매핑은 **유지** (Stage 2 의 본질).

### CI 가 만약 fail 하면 시도할 fix 후보

- 우선순위 1: `reset-password-form.tsx` 의 `setTimeout(...router.push)` 패턴을 `useEffect` 안의 cleanup 가능한 timer 로 전환 (HMR 에 강건). 단 spec 변경 외 form 로직 변경은 별도 PR 분리.
- 우선순위 2: `frontend/e2e/auth/password-reset.spec.ts:51` 테스트 자체를 더 결정적으로 — assertion 1 (success Card 가시) 까지만 검증하고, URL redirect 는 별도 폴링·재시도 없이 click-driven 으로 명시.
- 우선순위 3: CSS 변경을 다단계로 분리 (`@theme` 만 먼저, `:root` 매핑 별도 PR).

### Stage 2 plan 갱신

`plan/in-progress/brand-refresh-impl.md §5/6` 에 본 follow-up 명시. CI 검증 후 후속 작업 분기.

---

세션 산출물: `review/code/2026/05/15/19_07_13/` 전체.
