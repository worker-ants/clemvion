# Code Review Resolution — `review/code/2026/05/15/19_07_13`

대상: brand-refresh-7a3f12 (Stage 1 spec 개정 + Stage 2 자산·코드).
SUMMARY 결과: Critical 0건, Warning 17건, Info 20건. BLOCK 없음.

본 문서는 Warning 17건 + 주요 Info 7건 의 조치 내역과, 의도적으로 follow-up 으로 분리한 항목을 기록한다.

조치 후 검증: lint(0), vitest 1328/1328, next build 그린.

---

## Warning — 조치 내역

### W-1, W-6. OG/Twitter SVG → 비활성화 (PNG follow-up)

**파일**: `frontend/src/app/layout.tsx`

`openGraph.images` 와 `twitter.images` 선언을 제거하고 본문(`title`/`description`) 만 유지. SVG OG 카드는 X/Twitter, Slack, Facebook 크롤러가 안정적으로 렌더하지 않아 소셜 미리보기가 깨질 위험이 큼.

PNG 변환 도구(sharp/ImageMagick/Inkscape) 가 갖춰지면 §1.3 follow-up 에서 `summary_large_image` 카드와 `/opengraph-image.png` 를 복원한다. `plan/in-progress/brand-refresh-impl.md §1.3` 와 §4.3 에 반영.

`apple-icon.svg` 는 modern iOS ≥ 12 가 SVG apple-touch-icon 을 지원하므로 그대로 유지.

### W-2. 인증 화면 다크 모드 로고 가시성

**위치**: `frontend/src/app/(auth)/layout.tsx`

리뷰어 보고는 "theme=light 고정" 이라 적었으나 실제 구현은 처음부터 `theme="auto"` 사용. 배경도 `bg-[hsl(var(--background))]` 로 light/dark 자동 전환. **false positive — 조치 불필요**. 새로 추가한 `(auth)/__tests__/layout.test.tsx` 에서 이 동작을 회귀로 잠금.

### W-3. CSS 토큰 이중 정의 명시

**파일**: `frontend/src/app/globals.css`

`:root` HSL 변수(Shadcn 용) + `@theme` HEX 변수(Tailwind utility 용) 가 같은 brand 색을 두 형식으로 보유. 두 레이어가 drift 하지 않도록 파일 상단 블록 주석에 이중 정의 의도와 동기화 책임 명시.

### W-4. `--destructive-foreground` 다크 모드 복원

**파일**: `frontend/src/app/globals.css`

다크 모드 `--destructive-foreground` 가 `text-on-dark` (pale green) 로 매핑되어 있었음. red 배경 위 pale green text 는 WCAG 대비 + 색조 충돌 위험. 다크 모드도 라이트와 같은 near-white (`210 40% 98%`) 로 복원하고 인라인 주석 추가.

### W-5. `<Logo />` size 기본값 명세 정정

**파일**: `plan/in-progress/brand-refresh-impl.md §3`

기존 명세 "full=160 / mark=32 / wordmark=120" 은 구현이 채택하지 않은 가설값. 실제 구현은 **기본값 없음** (caller 가 사용 자리에 맞게 결정). plan §3 본문을 실제 동작 + caller 들의 채택 사이즈 (sidebar=150, auth=200, README inline=280) 로 정정.

### W-7. `vine-dark-*` Tailwind 키 등록 정책 명시

**파일**: `plan/in-progress/brand-refresh-impl.md §2`

impl-prep consistency-check INFO 10 + spec R-10 에 따라 `vine-dark-*` 은 별도 Tailwind 키로 등록하지 않고 `:root` / `.dark` CSS 변수 페어로만 처리한다는 결정을 plan 체크리스트에 명시.

### W-8, W-9. Playwright 시각 회귀

**조치**: 대신 unit/integration 레이어로 회귀 안전망 보강. Playwright 시각 회귀(pixel snapshot) 는 별도 follow-up.

- `frontend/src/components/ui/__tests__/logo.test.tsx` — `theme="auto"` 듀얼 렌더, 접근성, wordmark+auto 케이스, size 기본/명시 케이스로 7건 추가.
- `frontend/src/app/(auth)/__tests__/layout.test.tsx` — 신규. 인증 레이아웃의 로고 슬롯·배경(no-gradient)·링크 경로 회귀 잠금.
- sidebar.tsx 의 본격 단위 테스트는 zustand store/react-query/i18n 의존성이 무거워 e2e 영역으로 위임. 별도 follow-up 으로 분리.

전역 CSS 변수 전면 교체에 따른 Shadcn 컴포넌트 시각 회귀는 plan §6 마무리 검증에 인용 — 사용자 수동 확인 권장.

### W-10. sidebar / auth 단위 테스트 추가

**파일**: `frontend/src/app/(auth)/__tests__/layout.test.tsx` (신규 — 3 케이스)

sidebar.tsx 자체는 위 W-9 에서 follow-up. auth layout 은 3 case 추가 — 로고 슬롯 존재, no-gradient 배경, 링크 경로.

### W-11. theme="auto" 접근성 명시

**파일**: `frontend/src/components/ui/logo.tsx` (auto 분기 주석), `logo.test.tsx`

`display:none` 이 a11y tree 에서 제거하므로 hidden img 에 `aria-hidden` 을 추가하지 않는다는 결정을 코드 주석과 테스트(`aria-hidden == null` assertion) 로 명시. 두 img 가 동일 alt 를 가져 다크 모드에서도 스크린리더가 visible variant 를 announce 한다.

### W-12. theme="auto" + wordmark 케이스 테스트

**파일**: `frontend/src/components/ui/__tests__/logo.test.tsx`

`wordmark` 변종은 현재 light/dark 동일 자산을 사용 — 양쪽 모두 `/logo-wordmark.svg` 로 매핑됨을 회귀로 잠금. 별도 dark wordmark 자산이 추가되면 ASSET_PATHS 수정 + 이 테스트 분기.

### W-13. CSS 변수 동일값 중복 주석

**파일**: `frontend/src/app/globals.css`

`--card`, `--popover`, `--secondary`, `--muted`, `--accent` 가 동일 토큰을 공유하는 이유를 Shadcn 기본 패턴 명시로 주석화.

### W-14. `brand-refresh-impl.md` 체크박스 동기화

**파일**: `plan/in-progress/brand-refresh-impl.md`

§0, §1.1, §1.2 (16/32px 부분), §2, §3, §4.1, §4.2, §4.3, §4.4 모든 체크박스를 실제 구현 상태로 갱신. §1.2 의 48px+.ico 합성, §1.3 PNG 자산은 그대로 미체크 유지 (follow-up).

### W-15. spec §9 변경 이력 행 추가 확인

`spec/6-brand.md §9` 의 2026-05-15 행은 Stage 1 commit (`feat(brand): spec/6-brand.md §8 정식 개정`) 에 이미 포함됨. `git show HEAD~1 -- spec/6-brand.md` 로 확인.

### W-16. `theme="auto"` 트레이드오프 주석

**파일**: `frontend/src/components/ui/logo.tsx`

auto 분기 진입 직전에 "두 SVG 모두 fetch — 정적 1–2KB 자산이라 허용 가능" 트레이드오프 주석 추가. 항상 단일 모드인 페이지에서는 `theme="light"` 권장도 함께 명시.

### W-17. `plan/complete/spec-draft-brand-refresh.md` `git mv` 누락

draft 가 untracked 상태에서 plain `mv` 로 옮겨졌음 (Stage 1 turn 안에서 일어났던 일). git history 상 add-from-complete 가 되어 in-progress 의 history 가 보존되지 않음. 본 PR 의 단발성 영향이며 향후 재발 방지 위해 `project-planner` skill 의 draft 처리 흐름에 git add → git mv 시퀀스를 명시하는 보강이 필요 — `plan/in-progress/spec-update-brand-followup.md` 에 별도 항목 추가 가능 (현재는 RESOLUTION 만 기록).

---

## Info — 조치 내역 (선택 적용)

| # | 조치 | 비고 |
| --- | --- | --- |
| I-1 | 조치 불필요 (W-11 에서 명시 결정) | `display:none` + alt 동일이 의도된 접근성 패턴 |
| I-2 | 조치 불필요 | `<Link aria-label>` 은 mouse hover tooltip, `<img alt>` 은 screen reader — 역할 다름 |
| I-3 | 조치 보류 | `<picture>` 패턴 전환은 SSR + Tailwind dark variant 결합 시 추가 검증 필요. 현재 듀얼 fetch 비용 < 2KB 합 |
| I-6 | 후속 | `_retry_state.json` 의 절대 경로는 review/ 산출물 특성상 PR 마다 새로 생성됨. .gitignore 화는 별도 결정 사안 |
| I-15 | 적용 | `apple-icon.svg` 임시 사용 명시는 layout.tsx metadata 주석에 이미 포함 |
| 기타 | 보류 | I-9 (size 상수 추출), I-10/I-11 (metadata 상수화) 는 코드 가독성 개선 차원. follow-up |

---

## Follow-up 항목 (별도 PR 또는 작업)

1. **PNG 자산 생성** — `apple-icon.png` (180×180), `opengraph-image.png` (1200×630). raster 도구(sharp/ImageMagick/Inkscape) 필요. 생성 후 `layout.tsx` 의 `openGraph.images` + `twitter.card: summary_large_image` 복원.
2. **`favicon.ico` multi-size 합성** — 16/32/48 PNG → multi-size .ico 생성 (`png-to-ico` 등).
3. **Playwright 시각 회귀** — sidebar collapsed/expanded, auth 5 화면, 다크 모드 토글 pixel snapshot.
4. **sidebar.tsx 단위 테스트** — zustand store / react-query mock 작성 후 로고 슬롯 회귀 추가.
5. **spec follow-up** (project-planner 위임) — `plan/in-progress/spec-update-brand-followup.md` 참고: `# PRD:` prefix 제거, `0-overview.md §3.4` 상태 색 토큰 명시, `10-auth-flow.md §1` HEX 하드코딩 제거.

---

## 검증

- `npm run lint` — 0 errors / 0 warnings
- `npm test` (vitest) — **1328/1328 통과** (이전 1321 → +7 새 케이스: logo 4 + auth-layout 3)
- `npm run build` — `✓ Compiled successfully`, 80 static pages 생성
- e2e (`make e2e-test`) — skip ([skip-e2e]). UI/자산 변경, 인프라 의존 없음. spec ↔ 코드 정합은 unit 레이어로 검증됨.

---

세션 산출물 경로:

- SUMMARY: `review/code/2026/05/15/19_07_13/SUMMARY.md`
- 본 RESOLUTION: `review/code/2026/05/15/19_07_13/RESOLUTION.md`
- 13 reviewer 상세: `review/code/2026/05/15/19_07_13/<role>/review.md`
