# 변경 범위(Scope) 리뷰

**리뷰 대상**: brand-refresh-7a3f12 worktree 변경 전체 (파일 1~41+)
**작업 의도**: Brand Refresh Stage 2 — 신 brand spec(spec/6-brand.md §8) 기반 시각 자산·코드 통합
**검토 일시**: 2026-05-15

---

## 발견사항

### [INFO] 주석 추가 — 코드 변경과 직접 연관된 설명으로 적절
- 위치: `frontend/src/app/(auth)/layout.tsx` 상단 블록 주석 (lines 66-70), `frontend/src/app/globals.css` `:root` 앞 블록 주석 및 각 CSS 변수 인라인 주석
- 상세: auth layout 주석은 spec 참조(`spec/6-brand.md §8.4.6`, `spec/2-navigation/10-auth-flow.md §1`)와 구현 결정 근거(그라데이션 금지 이유)를 담고 있어 변경 의도와 직결된다. globals.css 의 CSS 변수 인라인 주석은 brand 토큰명·HEX·spec 섹션 참조를 포함하며 SDD 원칙상 권장 패턴이다. 불필요한 주석 추가에 해당하지 않는다.
- 제안: 해당 없음.

### [INFO] `frontend/src/app/layout.tsx` metadata 확장 — 요청 범위 내 기능 추가
- 위치: `frontend/src/app/layout.tsx` 라인 263-302
- 상세: `plan/in-progress/brand-refresh-impl.md` §4.3 "Next.js metadata (favicon, apple-icon, OG)" 에 `icons`, `openGraph`, `twitter` 명시 추가가 명시적으로 요청되어 있다. 단, 구현에서 `apple-icon.svg`·`opengraph-image.svg` 를 SVG 타입으로 등록했으나, plan §4.3 원문은 `.png` 를 참조하고 있다(`apple-icon.png`, `opengraph-image.png`). 또한 plan 원문의 `icons` 명세와 실제 구현의 `icons` 명세에 미묘한 차이가 있다: plan 은 `favicon.ico` + `icon.svg` 를 등록하도록 하고 있으나, 실제 구현은 `favicon-16.svg` + `icon.svg` 로 교체하고 `favicon.ico` 를 생략했다.
- 제안: SVG vs PNG 차이와 favicon.ico 생략은 의도된 변경이라면 주석에 기재된 "Stage 2 follow-up" 안내로 충분하다. 그러나 plan §4.3 원문과의 불일치가 관리되고 있는지 명시적으로 확인이 필요하다.

### [INFO] `frontend/src/components/layout/sidebar.tsx` 변경 범위 확인
- 위치: sidebar.tsx 라인 321-361
- 상세: `Logo`, `LogoMark` 임포트 추가와 사이드바 로고 슬롯 교체는 plan §4.1 에 정확히 기술된 범위다. 기존 `t("sidebar.productName")` 텍스트와 단순 "C" 문자 → `<Logo>` / `<LogoMark>` 컴포넌트 교체는 의도된 변경이다. `aria-label` 추가는 접근성 개선으로 변경 범위와 무관하지 않으나 작업 의도와 직접 연관되어 허용 범위 내다.
- 제안: 해당 없음.

### [WARNING] `plan/complete/spec-draft-brand-refresh.md` 위치 — `plan/in-progress/` 가 아닌 `plan/complete/` 에 신규 생성
- 위치: 파일 8, `plan/complete/spec-draft-brand-refresh.md`
- 상세: CLAUDE.md §PLAN 문서 라이프사이클에 따르면 새 plan 문서는 **항상** `plan/in-progress/` 에서 생성하고, 모든 항목이 완료된 후 `git mv` 로 `plan/complete/` 로 이동해야 한다. 그러나 이 파일은 신규 생성(`new file mode`)으로 `plan/complete/` 에 직접 만들어졌다. diff 상 `git mv` 흔적이 없으며, `plan/in-progress/spec-draft-brand-refresh.md` 의 삭제 diff 도 보이지 않는다. 즉, `in-progress` 생성 후 `complete` 이동이 아닌 `complete` 에 직접 생성된 것으로 보인다. brand-refresh-impl.md (Stage 2) 가 존재하므로 Stage 1 완료로 판단하여 `complete` 에 직접 생성했을 가능성이 있으나, 절차상 규약 위반이다.
- 제안: 별도의 `git log` 또는 `git log --follow` 로 `in-progress` 에서 이동된 이력이 있는지 확인한다. 이력이 없다면 규약 위반이며, 향후에는 `in-progress` 에서 생성 후 `git mv` 로 이동해야 한다.

### [WARNING] `review/consistency/` 하위 3개 세션 전체가 변경 범위에 포함 — 작업 부산물로 정상이나 범위 추적 필요
- 위치: 파일 11~34+, `review/consistency/2026/05/15/18_25_10/`, `18_36_51/`, `18_49_57/` 세 consistency-checker 세션
- 상세: 변경 범위에는 3회의 consistency-check 세션 산출물이 모두 포함되어 있다(`_prompts/`, `_retry_state.json`, 5개 checker 별 `review.md`, `meta.json`, `SUMMARY.md`). 이는 brand-refresh 작업 전 의무 절차(`/consistency-check --spec`, `--impl-prep`)에 의해 생성된 정상 부산물이다. 그러나 동일 PR 에 `review/consistency/` 세션 3개가 일괄 포함되면 실제 구현 변경과 리뷰 산출물이 섞여 리뷰 부담이 높아진다. scope 관점에서는 작업 의도와 연관된 필수 절차 산출물이므로 CRITICAL 은 아니다.
- 제안: PR 설명에 consistency-check 세션들이 의도적으로 포함된 것임을 명시한다. 필요하다면 리뷰 산출물과 구현 변경을 별도 commit 으로 분리하면 리뷰가 용이해진다.

### [INFO] `frontend/src/app/globals.css` 의 `@theme` 블록 신규 추가 — 요청 범위 내 기능 확장
- 위치: globals.css 라인 221-241
- 상세: plan §2 CSS 토큰 매핑에서 "Tailwind theme 갱신 — tailwind.config 의 colors 에 `vine-300 ~ vine-900` ramp 와 `vine-dark-*` 추가" 가 명시되어 있다. Tailwind v4 에서는 `tailwind.config` 대신 `@theme` 지시어를 사용하므로 `globals.css` 에 `@theme` 블록을 추가한 것은 적절하다. `vine-dark-*` 시리즈를 `@theme` 에 등록하지 않고 CSS 변수(`:root`/`.dark`)로만 관리한 것은 spec R-10 및 impl-prep INFO-10 을 반영한 의도된 선택이다.
- 제안: 해당 없음.

### [INFO] `README.md` 변경 — 변경 의도와 직결, 단 링크 경로 수정이 별도 변경처럼 보임
- 위치: README.md 라인 34-43
- 상세: 로고 이미지 삽입(`<img src="frontend/public/logo.svg">`)은 plan §4.4 에 명시된 변경이다. `prd/brand.md` → `spec/6-brand.md` 링크 수정은 docs-consolidation(2026-05-12) 이후 경로 정리로, 엄밀히는 brand-refresh 작업 범위는 아니나 README 가 옛 경로를 참조하던 잔재를 함께 수정한 것이다. CLAUDE.md 의 README 갱신 규칙("변동 사항이 있을 경우 spec 을 참고해 다시 정리")에 부합하므로 허용 범위 내다.
- 제안: 해당 없음.

### [INFO] `frontend/src/components/ui/logo.tsx` 및 `logo.test.tsx` 신규 생성 — plan 명시 범위 내
- 위치: 파일 7 (`logo.tsx`), 파일 6 (`logo.test.tsx`)
- 상세: plan §3 에서 `<Logo />` 컴포넌트 생성이 명시되어 있다. `eslint-disable @next/next/no-img-element` 지시어와 그 근거 주석은 구현 결정의 투명한 문서화로 scope 이탈이 아니다. 테스트 파일 생성도 TDD 원칙상 필수로, 범위 내다. `LogoMark` 편의 컴포넌트 추가는 plan §3 에서 직접 언급하지는 않으나 plan §4.1 의 collapsed 상태 구현을 위해 자연스럽게 파생된 최소 확장이다.
- 제안: 해당 없음.

### [INFO] `plan/in-progress/spec-update-brand-followup.md` 신규 생성 — 작업 중 발견된 spec 수정 위임 노트로 적절
- 위치: 파일 10
- 상세: developer 가 Stage 2 구현 중 spec 수정이 필요하다고 판단한 항목(P-1, P-2, P-3)을 project-planner 로 위임하기 위한 노트로, CLAUDE.md "구현 중 스펙 수정이 필요해지면 developer 는 작업을 멈추고 project-planner 호출 또는 사용자에게 위임" 절차에 부합한다. scope 이탈이 아니라 협업 워크플로 산출물이다.
- 제안: 해당 없음.

---

## 요약

변경 범위(Scope) 관점에서 이번 brand-refresh-7a3f12 PR 은 대체로 `plan/in-progress/brand-refresh-impl.md` 에 명시된 작업 범위(자산·CSS 토큰·Logo 컴포넌트·UI 자리 통합·metadata·README) 안에서 이루어졌다. 불필요한 리팩토링이나 요청하지 않은 기능 확장, 무관한 파일 수정은 발견되지 않았다. 주요 지적 사항은 두 가지다. 첫째, `plan/complete/spec-draft-brand-refresh.md` 가 `plan/in-progress/` 에서 생성 후 `git mv` 로 이동된 것이 아니라 `plan/complete/` 에 직접 신규 생성된 것으로 보이는데, 이는 CLAUDE.md 의 plan 라이프사이클 규약(`git mv` 의무) 위반 가능성이 있다. 둘째, 동일 PR 에 3회의 consistency-check 세션 산출물이 일괄 포함되어 있어 리뷰 부담이 있으나, 이는 의무 절차 산출물로 scope 이탈이 아니다. `frontend/src/app/layout.tsx` 의 SVG favicon/OG 이미지 사용이 plan 원문의 PNG 참조와 다른 점은 의도된 변경이라면 명시적으로 기록될 필요가 있다.

---

## 위험도

LOW
