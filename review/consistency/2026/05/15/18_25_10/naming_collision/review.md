# 신규 식별자 충돌 검토 — spec-draft-brand-refresh

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-15

---

## 발견사항

### [WARNING] `border` — 기존 CSS 변수 `--border` 와 이름 공간 혼동 가능

- **target 신규 식별자**: `border` (Neutral 토큰, `#e4e8e0`, 카드 보더 역할 — §8.2.2)
- **기존 사용처**: `frontend/src/app/globals.css` 라인 24 / 51 — `--border: 214.3 31.8% 91.4%` (라이트), `--border: 217.2 32.6% 17.5%` (다크). `frontend/src/components/layout/sidebar.tsx` 라인 272 / 278 에서 `border-[hsl(var(--border))]` 클래스로 활성 사용 중.
- **상세**: target 의 §8.2.2 는 새 Neutral 토큰 이름을 `border` 로 명명하고 있다. 기존 코드베이스에서 `--border` 는 Shadcn/Tailwind 체계의 시맨틱 CSS 변수로 이미 운영 중이다. Stage 2 `developer` 가 이 토큰을 CSS 변수로 매핑할 때 신규 브랜드 `border` 토큰과 기존 `--border` 변수가 같은 이름 공간에서 충돌할 위험이 있다. 브랜드 토큰 `border` → CSS 변수 `--border` 로 1:1 매핑하면 라이트/다크 의미가 달라지고, 두 이름을 구분 없이 사용하면 혼란을 초래한다.
- **제안**: target 의 Neutral 토큰 이름을 `border` 대신 `vine-border` 또는 `border-default` 처럼 브랜드 네임스페이스를 명시하도록 변경한다. 아니면 §8.2.4 코드 토큰 매핑 절에 "Neutral `border` 토큰은 기존 `--border` CSS 변수로 매핑되어 재정의된다"는 명시적 선언을 추가해 의도적 덮어쓰기임을 문서화한다.

---

### [WARNING] `ink` — 기존 CSS `--foreground` / `--card-foreground` 와 역할 중복·혼동 가능

- **target 신규 식별자**: `ink` (`#0e1a12`, 본문 텍스트·워드마크 base — §8.2.2)
- **기존 사용처**: `frontend/src/app/globals.css` 라인 6 `--foreground: 0 0% 3.9%` (라이트), `frontend/src/app/icon.svg` 내부에도 임시 브랜드 자산으로 존재하지 않음. `spec/6-brand.md` §8.1 기존 토큰 중 `Ink: #111111` 이 동일 역할로 이미 정의되어 있음.
- **상세**: `ink` 는 기존 §8.1 의 `Ink (#111111)` 을 계승·재정의한 것이므로 이름 재사용 자체는 의도적이다. 그러나 §8.2.5 폐기 토큰 매트릭스에 `Ink → ink` 교체가 명시되어 있는 반면, CSS 레이어에서 기존 `--foreground` 와의 관계가 명확히 정의되지 않았다. `developer` 가 Stage 2 매핑 시 `ink` 를 별도 변수로 추가할지, `--foreground` 를 재정의할지 스펙에서 결정하지 않으면 두 이름이 병존할 수 있다. 심각도는 CRITICAL 에 미치지 않지만 매핑 명세가 부재해 구현 즉흥화 위험이 있다.
- **제안**: §8.2.4 에 `ink` → CSS 변수 매핑 방향(예: `--foreground` 재정의 또는 `--ink` 신규 변수 추가 중 선택)을 간략히 주석으로 추가한다. 현재 스펙은 "코드 토큰 이름은 구현 시 결정"으로 위임하고 있으나, `ink` 처럼 기존 변수와 겹칠 수 있는 케이스는 방향성 힌트가 있으면 충돌을 방지한다.

---

### [WARNING] `text-dark` — Tailwind `text-*` 유틸리티 클래스 패턴과 혼동 가능

- **target 신규 식별자**: `text-dark` (다크 모드 본문 텍스트·워드마크 base, `#e8f5ec` — §8.2.3)
- **기존 사용처**: Tailwind CSS 는 `text-{color}` 패턴을 텍스트 색상 유틸리티 클래스로 예약한다(예: `text-gray-900`, `text-white`). 기존 코드베이스(`frontend/src`) 에서 `text-dark` 클래스 사용 사례는 발견되지 않았으나, Tailwind 의 `text-{shade}` 관례와 이름 구조가 동일하다.
- **상세**: `text-dark` 를 Tailwind 테마 색상 키로 등록하면 `text-dark` 클래스가 텍스트 색상 유틸리티로 활성화된다. Tailwind 에서 `dark` 는 다크 모드 변형자(variant)로도 사용되므로 `text-dark` 클래스가 `dark:text-*` 패턴과 구분 없이 읽힐 수 있고, 코드 리뷰 시 의미 혼동을 유발한다. CSS 변수로 직접 노출할 경우에도 `--text-dark` 이름은 "dark 테마의 텍스트" 와 "dark 라는 이름의 텍스트 토큰" 중 어느 것인지 불명확하다.
- **제안**: `text-dark` 를 `text-on-dark` 또는 `wordmark-dark` 처럼 역할을 명시하거나, Vine 네임스페이스를 일관 적용해 `vine-text-dark` 로 변경한다. 기존 `vine-dark-*` 시리즈와 정렬도 맞춰지는 이점이 있다.

---

### [INFO] 폐기 토큰 `Bark` — 대체 지정 없이 `ink opacity 변종` 으로 처리되나 토큰명 미정

- **target 신규 식별자**: §8.2.5 폐기 매트릭스에서 `Bark` → "제거. 텍스트 보조는 `ink` 의 opacity 변종(0.6 / 0.4) 으로 처리"
- **기존 사용처**: `spec/6-brand.md` §8.1 `Bark (#6B5544)` — 텍스트 보조·보더 역할.
- **상세**: `Bark` 를 폐기하고 opacity 변종으로 대체하는 전략 자체는 명확하지만, 해당 opacity 변종의 토큰 이름이 본 draft 어디에도 정의되어 있지 않다. Stage 2 `developer` 가 `ink/60`, `--muted-foreground`, `text-[rgba(...)]` 등 제각각으로 구현할 수 있다.
- **제안**: §8.2.2 Neutral 섹션에 `ink-60` (`ink` at 60% opacity) 와 `ink-40` (`ink` at 40% opacity) 토큰을 명시적으로 추가하거나, 기존 `--muted-foreground` CSS 변수를 `ink` opacity 변종으로 재정의한다는 매핑 방향을 §8.2.4 에 기록한다.

---

### [INFO] 파일 경로 — `logo-wordmark.svg` 신규 추가, 기존 파일 목록과의 중복 확인

- **target 신규 식별자**: `frontend/public/logo-wordmark.svg` (Wordmark only 변종 — §8.4.1)
- **기존 사용처**: `frontend/public/` 에는 `logo.svg`, `logo-mark.svg` 존재. `logo-wordmark.svg` 는 현재 없음.
- **상세**: 신규 파일이므로 직접 충돌은 없다. 그러나 §8.6 임시 자산 마이그레이션 항목에 `logo-wordmark.svg` 가 명시되어 있지 않아(기존 4개 자산 교체만 언급), Stage 2 인수인계 목록과 §8.6 이 불일치한다. 누락 발견 시 누락된 자산으로 오인할 수 있다.
- **제안**: §8.6 의 "신규 추가" 목록에 `logo-wordmark.svg` (및 `logo-dark.svg`, `logo-mark-dark.svg`) 도 명시적으로 포함시켜 Stage 2 항목과 정합성을 맞춘다.

---

### [INFO] `spec/2-navigation/_layout.md` §2.1 — 사이드바 로고 슬롯 기술이 expanded/collapsed 변종을 미정의

- **target 신규 식별자**: §8.4.6 "사이드바 상단 — expanded → Full logo (light) / collapsed → Icon mark"
- **기존 사용처**: `spec/2-navigation/_layout.md` §2.1 "로고 — 상단. 제품 로고. 클릭 시 `/dashboard`로 이동". 현재 `sidebar.tsx` 라인 280–290 은 `collapsed` 시 텍스트 "C" 를 렌더링.
- **상세**: `_layout.md` §2.1 은 현재 로고 슬롯을 단순 텍스트 링크로만 기술하며 expanded/collapsed 구분이 없다. target 의 §8.4.6 이 이를 보완하는 정식 사양으로 기능하므로, 두 문서가 같은 슬롯을 다루면서 서로 다른 수준의 명세를 제공한다. 직접적인 식별자 충돌은 아니나, 구현자가 어느 쪽을 우선해야 할지 혼동할 수 있다.
- **제안**: target §8.4.6 에 "본 규정은 `spec/2-navigation/_layout.md` §2.1 보다 우선한다" 는 명시를 추가하거나, 반영 시 `_layout.md` §2.1 을 expanded/collapsed 표현으로 갱신한다.

---

## 요약

target draft 가 도입하는 신규 색상 토큰(`vine-300~vine-900`, `vine-dark-*`, Neutral 시리즈) 은 코퍼스 전체에서 선점 충돌이 없다. 폐기 토큰 6종과 신 토큰의 1:1 매핑도 §8.2.5 에 정의되어 있어 충돌보다는 교체 의도가 명확하다. 다만 Neutral 토큰 `border` 가 기존 `--border` CSS 변수와, `text-dark` 가 Tailwind `text-{color}` 관례와 이름 구조상 혼동을 일으킬 수 있어 WARNING 2건을 발행한다. `ink` 는 기존 `--foreground` 와의 매핑 방향이 스펙에서 위임되어 있어 구현 즉흥화 위험이 있다. 전반적으로 CRITICAL 수준의 식별자 충돌은 없으며, WARNING 사항을 해소하면 Stage 2 구현 시 충돌 없이 진행 가능하다.

---

## 위험도

LOW
