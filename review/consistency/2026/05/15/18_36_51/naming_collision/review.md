# 신규 식별자 충돌 검토 — spec-draft-brand-refresh.md

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (§8 Visual Identity 정식 개정안)
검토 시각: 2026-05-15

---

## 발견사항

### [WARNING] `ink` 토큰명 — 기존 `Ink` 색상 토큰과 동명 재정의
- **target 신규 식별자**: `ink` (`#0e1a12`, §8.2.2 Neutral 라이트 모드)
- **기존 사용처**: `spec/6-brand.md` 현행 §8.1 컬러 표 — 토큰명 `Ink` HEX `#111111` 로 이미 사용 중
- **상세**: 기존 임시 가이드의 `Ink` 를 신규 `ink` 로 재정의한다. 대소문자만 다른 이름(`Ink` vs `ink`)이며 HEX 값도 달라진다(`#111111` → `#0e1a12`). §8.2.5 폐기 토큰 매트릭스에 `Ink #111111 → ink #0e1a12` 로 명시하여 대체 관계가 선언되어 있으므로 의도된 재정의임은 분명하다. 그러나 동일 파일 내에서 동명(케이스 무시) 토큰이 공존하는 기간(Stage 2 완료 전)에 코드나 디자인 도구가 대소문자를 구분하지 않고 참조할 경우 혼동 위험이 있다.
- **제안**: §8.2.5 폐기 매트릭스의 "대체 토큰" 열에 `ink (소문자)` 임을 명시해 케이스 차이를 강조한다. 또는 grep 가드 명령에 `Ink\b` (대문자) 를 추가해 잔재 검출을 명확히 한다.

### [WARNING] `soil-50` / `soil-100` 토큰명 — 기존 `Soil` 색상 토큰과 어근 공유
- **target 신규 식별자**: `soil-50` (`#f7f8f6`), `soil-100` (`#eef5ec`) (§8.2.2 Neutral)
- **기존 사용처**: `spec/6-brand.md` 현행 §8.1 — `Soil #F4F1EC` (라이트 배경)
- **상세**: 폐기 토큰 `Soil` 과 어근(`soil`)이 동일하다. `soil-50` 이 `Soil` 을 대체하는 의도(§8.2.5 매핑 표 확인)는 명확하나, 어근이 같기 때문에 Stage 2 마무리 전 grep `Soil` 로 잔재를 검출할 때 `soil-50` / `soil-100` 이 오탐으로 잡힐 수 있다. §8.2.5 의 grep 명령은 현재 `Soil` 을 대소문자 구분으로 포함하고 있어 소문자 `soil-*` 는 검출 대상이 아니므로 오탐 발생 시 혼동이 남는다.
- **제안**: §8.2.5 의 잔재 검출 grep 명령을 `\bSoil\b` 패턴으로 단어 경계 한정하거나, 대문자로만(`[A-Z]oi`) 한정하여 `soil-50` 신 토큰과 구분한다.

### [INFO] `vine-border` 토큰명 — Tailwind/Shadcn CSS 변수 `--border` 와 의미 중첩
- **target 신규 식별자**: `vine-border` (§8.2.2 Neutral)
- **기존 사용처**: `frontend/src/app/globals.css` — CSS 변수 `--border: 214.3 31.8% 91.4%` (라이트), `--border: 217.2 32.6% 17.5%` (다크)
- **상세**: target 스스로 R-8 에서 이 충돌을 인지하고 prefix `vine-` 를 붙여 회피했음을 명시한다. 명명 충돌 자체는 이미 해소된 상태이나, §8.2.4 의 권장 매핑 방향에서 "`vine-border` → `--border`" 매핑 시 코드에서 `vine-border` 라는 이름의 Tailwind 유틸리티 클래스와 CSS 변수 `--border` 가 동일 색을 가리키게 된다. 구현 시 이 매핑이 명시적 주석 없이 이루어지면 추후 유지보수 담당자에게 혼동의 여지가 있다.
- **제안**: §8.2.4 매핑 힌트에 "CSS 변수 `--border` 에 매핑 시 Tailwind 유틸리티 `border-vine-border` 가 `--border` 를 가리키게 됨 — globals.css 주석 또는 tailwind.config 에 명시 권장" 한 줄을 추가한다.

### [INFO] `text-on-dark` 토큰명 — Tailwind `dark:` variant 및 `text-{color}` 유틸리티와 구문 유사
- **target 신규 식별자**: `text-on-dark` (§8.2.3 Dark Mode)
- **기존 사용처**: `frontend/src/app/globals.css` — Tailwind 기본 유틸리티 패턴 `text-{shade}`, `dark:` variant
- **상세**: target 스스로 R-8 에서 이 충돌 가능성을 인지하고 `on-dark` 로 네이밍했음을 명시한다. Tailwind 컬러 팔레트에 `on-dark` 시리즈가 없으므로 기존 유틸리티와 실제 이름 충돌은 없다. 다만 Tailwind config 에 `text-on-dark` 를 커스텀 색상으로 등록 시 `dark:text-on-dark` 같은 사용이 생겨 "다크 모드에서 다크 용 텍스트 색상" 이라는 중복 표현이 된다.
- **제안**: 구현 시 Tailwind config 에 `colors.vine['text-on-dark']` 처럼 `vine` 네임스페이스 아래 두어 `text-vine-text-on-dark` 형태로 사용하거나, 짧은 별칭(예: `vine-text-dark`)을 검토한다. spec 에는 수정 불요.

### [INFO] `vine-dark-*` 토큰 시리즈 — 기존 Tailwind `dark:` prefix 관습과 구문 유사
- **target 신규 식별자**: `vine-dark-bg-base`, `vine-dark-bg-elevated`, `vine-dark-mid`, `vine-dark-spine`, `vine-dark-primary`, `vine-dark-leaf`, `vine-dark-accent`, `vine-dark-glow` (§8.2.3)
- **기존 사용처**: `frontend/src/app/globals.css` `.dark { ... }` 블록 — 다크 모드 CSS 변수들
- **상세**: `vine-dark-primary` 는 기존 라이트 모드의 `vine-700 (Primary)` 와 의미(1차 액션 컬러)가 같지만 이름이 다르다. 구현자가 "primary" 역할의 토큰을 찾을 때 `vine-700` 과 `vine-dark-primary` 두 곳을 인지해야 한다. 충돌은 아니지만 명명 대응 관계가 문서화되어 있지 않으면 혼동 가능성이 있다.
- **제안**: §8.2.4 매핑 힌트 또는 §8.2.3 표 하단에 light↔dark 페어 대응표(예: `vine-700 ↔ vine-dark-primary`, `vine-300 ↔ vine-dark-leaf` 등)를 한 줄씩 추가하면 구현자의 혼선을 줄일 수 있다. spec 수정은 INFO 등급이므로 필수 아님.

---

## 요약

target `plan/in-progress/spec-draft-brand-refresh.md` 가 도입하는 신규 식별자(컬러 토큰 18종, 파일 경로 9종)는 기존 코퍼스와 CRITICAL 수준의 충돌은 없다. `ink` / `Ink` (대소문자 차이), `soil-50` / `Soil` (어근 공유) 두 케이스는 이미 target §8.2.5 폐기 매트릭스에서 명시적 대체 관계로 선언되어 있어 의미 혼동은 아니지만, Stage 2 이행 기간 중 grep 잔재 검출 또는 디자인 도구 참조 시 오탐·오독 위험이 WARNING 수준으로 남는다. `vine-border`·`text-on-dark` 의 Tailwind/Shadcn 충돌 우려는 target R-8 에서 이미 자인·회피 설계가 완료되어 있어 INFO 수준의 구현 안내 보강으로 충분하다. 전반적으로 target 은 충돌 회피를 명시적으로 설계하고 있어 식별자 충돌 관점의 위험도는 낮다.

---

## 위험도

LOW
