# 신규 식별자 충돌 검토 — `spec/6-brand.md`

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/6-brand.md)

---

## 발견사항

### [WARNING] 컬러 토큰 `vine-border` — Tailwind/Shadcn `--border` CSS 변수와의 이름 유사성

- **target 신규 식별자**: `vine-border` (`spec/6-brand.md` §8.2.2)
- **기존 사용처**: `frontend/src/app/globals.css` 의 `--border` CSS 변수 (Shadcn 기본 컨벤션). plan/in-progress/brand-refresh-impl.md §2 에서 매핑 예정 (`--border` ← `vine-border`)
- **상세**: brand spec 자체가 §8.2.2 에서 "`vine-border` 로 명명 — Tailwind/Shadcn `--border` 와 충돌 방지 위해"라고 이유를 명시하고 있으므로, 토큰 이름 자체의 충돌은 회피되어 있다. 그러나 구현 시 `--border: <vine-border HEX>;` 형태로 직접 매핑되므로, 개발자가 `vine-border` 와 `--border` 를 동일 개념으로 혼동할 수 있다. 혼동 시 CSS 변수를 spec 토큰 이름으로 잘못 참조하는 오류가 발생할 수 있다.
- **제안**: brand spec §8.2.4 (코드 토큰 매핑) 에서 `vine-border → --border` 대응을 이미 권장 방향으로 명시하고 있으므로 실제 충돌은 낮다. 구현 시 CSS 변수 옆 주석 (`/* vine-border from spec/6-brand.md §8.2.2 */`) 을 반드시 추가하도록 plan/in-progress/brand-refresh-impl.md §2 에 체크리스트 항목으로 명기하면 충분하다.

---

### [WARNING] 컬러 토큰 `text-on-dark` — Tailwind `text-{shade}` 유틸리티·`dark:` variant와의 이름 유사성

- **target 신규 식별자**: `text-on-dark` (`spec/6-brand.md` §8.2.3)
- **기존 사용처**: Tailwind CSS 의 `text-*` 유틸리티 클래스 계열 (예: `text-gray-900`, `dark:text-white`), 코드베이스 전반에서 사용 중인 Tailwind `dark:` variant
- **상세**: brand spec 자체가 §8.2.3 에서 "`text-on-dark` 로 명명 — Tailwind `text-{shade}` 및 `dark:` variant 와 충돌 방지 위해"라고 이유를 명시하므로, Tailwind 유틸리티 클래스와의 직접 충돌은 회피되어 있다. 그러나 `text-on-dark` 라는 이름이 Tailwind 클래스처럼 읽혀 구현자가 `className="text-on-dark"` 로 직접 Tailwind 유틸리티로 사용하려는 시도를 유발할 수 있다. 이 토큰은 CSS 변수 값(`--foreground` 다크 모드 페어)으로 사용되는 것이지, Tailwind 유틸리티 클래스가 아니다.
- **제안**: brand spec §8.2.4 에서 `text-on-dark → --foreground (다크 모드)` 대응이 이미 명시되어 있다. 구현 시 `tailwind.config` 에 `text-on-dark` 를 별도 색상 키로 등록하지 말고, 오직 CSS 변수 값으로만 사용하도록 plan §2 에 주의사항을 명시하면 충분하다.

---

### [INFO] 파일 경로 `frontend/public/logo-dark.svg` — 기존 파일 없는 신규 추가이지만 명명 컨벤션 확인 권장

- **target 신규 식별자**: `frontend/public/logo-dark.svg`, `frontend/public/logo-mark-dark.svg`, `frontend/public/logo-wordmark.svg` (`spec/6-brand.md` §8.4.1)
- **기존 사용처**: `frontend/public/logo.svg`, `frontend/public/logo-mark.svg` 가 기존 파일로 존재 (옛 자산, 교체 대상으로 §8.6 에 명시). `frontend/src/app/icon.svg`, `frontend/src/app/favicon.ico` 도 교체 대상.
- **상세**: 신규 추가 파일 3종(`logo-dark.svg`, `logo-mark-dark.svg`, `logo-wordmark.svg`)은 기존 파일과 충돌하지 않는다. 교체 파일 6종(`logo.svg`, `logo-mark.svg`, `favicon.ico`, `icon.svg`, `apple-icon.png`, `opengraph-image.png`)은 §8.6 에서 폐기 대상으로 명시적으로 선언되어 있으므로, 경로 충돌이 아닌 의도된 덮어쓰기다.
- **제안**: 별도 조치 불필요. 구현 시 §8.6 의 폐기 목록과 실제 파일 작업이 1:1 대응하는지 확인만 하면 된다.

---

### [INFO] 폐기 토큰 이름 대소문자 (`Vine Green`, `Bud Lime`, `Deep Forest`, `Bark`, `Soil`, `Ink`) — 코드베이스 잔재 검출 필요

- **target 신규 식별자**: §8.2.5 에서 폐기 선언된 옛 토큰명 (`Vine Green`, `Deep Forest`, `Bud Lime`, `Bark`, `Soil`, `Ink`) 및 HEX 값 6개
- **기존 사용처**: `frontend/` 및 `spec/` 코드베이스에 잔재 가능 (이전 임시 가이드 시절)
- **상세**: 폐기 토큰은 신 토큰과 대소문자가 달라 grep 패턴으로 구별 가능하도록 설계되어 있다 (§8.2.5 의 grep 명령 명시). 이 자체가 충돌 방지 조치다. 단, 구현 착수 전 grep 0건 확인을 plan 체크리스트에 명시적으로 포함해야 한다.
- **제안**: `plan/in-progress/brand-refresh-impl.md` §2 의 검증 항목에 §8.2.5 의 grep 명령 실행 및 0건 확인을 체크리스트로 추가하면 충분하다 (§8.2.5 에 명령이 이미 제시되어 있음).

---

### [INFO] Tailwind 컬러 키 `vine-300 ~ vine-900`, `vine-dark-*` — `tailwind.config` 기존 colors 키와 충돌 가능성

- **target 신규 식별자**: `vine-300`, `vine-400`, `vine-500`, `vine-600`, `vine-700`, `vine-800`, `vine-900`, `vine-dark-bg-base`, `vine-dark-bg-elevated`, `vine-dark-mid`, `vine-dark-spine`, `vine-dark-primary`, `vine-dark-leaf`, `vine-dark-accent`, `vine-dark-glow` (`spec/6-brand.md` §8.2.1~§8.2.3)
- **기존 사용처**: `tailwind.config` 의 `theme.colors` (현재 상세 내용은 코퍼스 외이지만, Tailwind/Shadcn 기본 설정은 `primary`, `secondary`, `muted` 등 Shadcn 키를 사용). `vine` prefix 를 가진 기존 색상 키는 코퍼스에서 발견되지 않음.
- **상세**: `vine-*` prefix 는 기존 Tailwind 기본 색상 팔레트나 Shadcn 컨벤션에 존재하지 않으므로 직접 충돌 가능성은 낮다. 단, `vine-dark-primary` 는 Tailwind 의 `dark:` prefix 와 결합 시 `dark:vine-dark-primary` 같은 불필요하게 중복된 표현이 나올 수 있다.
- **제안**: brand spec §8.2.4 에서 구현은 `developer` 에 위임되어 있으므로, `tailwind.config` 에 실제 추가 시 `vine-dark-*` 를 별도 키로 등록하기보다 CSS 변수 페어(`dark:root`)로만 처리하는 것이 Tailwind/Shadcn 컨벤션과 더 정합하다. 이는 구현 단계에서 결정하면 충분하다 (R-10 에서 이미 의도된 위임).

---

## 요약

`spec/6-brand.md` §8 이 도입하는 신규 식별자(컬러 토큰 22개, 파일 경로 9종, 폐기 토큰 6개)는 기존 spec·데이터모델·API endpoint·이벤트명·환경변수와의 **직접 충돌은 발견되지 않는다**. 주목할 부분은 `vine-border` 와 `text-on-dark` 두 토큰이다. 이들은 Tailwind/Shadcn 의 `--border` CSS 변수 및 `text-{shade}` 유틸리티 클래스와 이름이 유사하지만, brand spec 자체가 §8.2.2~§8.2.3 에서 그 이유와 회피 방안을 명시적으로 설명하고 있어 설계상 의도된 명명이다. `vine-300 ~ vine-900` Tailwind 키도 기존 팔레트와 겹치지 않는다. 폐기 토큰 6개는 대소문자 차이로 grep 구별이 가능하며 §8.2.5 에 검출 명령이 제시되어 있다. 충돌 우려가 있는 두 WARNING 항목은 구현 시 CSS 변수 주석과 plan 체크리스트 보강으로 충분히 해소 가능하다.

## 위험도

LOW
