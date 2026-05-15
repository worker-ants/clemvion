# Cross-Spec 일관성 검토 — spec/6-brand.md

검토 모드: `--impl-prep` (구현 착수 전, scope=spec/6-brand.md)
검토 시각: 2026-05-15

---

### 발견사항

- **[INFO]** `spec/0-overview.md` §3.4 상태 배지 색상과 brand 토큰의 명시적 연결 없음
  - target 위치: `spec/6-brand.md` §8.2.1 — `vine-400` (Sprout) `#4ab868` 을 "success state" 로 정의
  - 충돌 대상: `spec/0-overview.md` §3.4 공통 UI 패턴 — "Badge/Tag: Active(초록), Error(빨강), Processing(파랑 스피너)"
  - 상세: `0-overview.md`의 상태 표시 패턴은 "초록"이라는 추상 서술만 있고 구체 토큰을 참조하지 않는다. 충돌은 아니나 구현 시 `vine-400`이 success/active 상태에 매핑된다는 사실을 참조 링크로 명시하면 developer 가 즉흥 결정 없이 구현 가능하다.
  - 제안: `spec/0-overview.md` §3.4 에 "색 토큰은 `spec/6-brand.md §8.2.1` 참조" 각주 추가 (동기화 권장, 차단 불필요).

- **[INFO]** `spec/2-navigation/_layout.md` §2.1 로고 변종 서술이 brand spec 보다 약간 선행 표현
  - target 위치: `spec/6-brand.md` §8.4.6 — "사이드바 상단: expanded → Full logo (light) / collapsed → Icon mark"
  - 충돌 대상: `spec/2-navigation/_layout.md` §2.1 — "사이드바 expanded 상태에서는 **Full logo (light)**, collapsed 상태에서는 **Icon mark**를 표시. 자세한 변종·색은 `spec/6-brand.md §8.4` 참조"
  - 상세: 내용이 일치하고 단일 진실 참조도 이미 명시되어 있다. 다만 `_layout.md`의 "Icon mark" 표기가 brand spec의 "Icon mark (light, 96px master)" 전체 명칭과 약칭 차이가 있어 오독 가능성이 낮다. 실질 충돌 없음.
  - 제안: 현행 유지. 필요 시 `_layout.md`에서 "Icon mark (light)" 로 소폭 정교화.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §1 배경 색 토큰 인라인 기술과 brand spec §8.4.4의 관계
  - target 위치: `spec/6-brand.md` §8.4.4 및 §8.4.6 — 인증 화면 배경은 `soil-50` 단색, 그라데이션 금지
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §1 — "배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지. 색 토큰·예외 정의는 `spec/6-brand.md §8.4.4` 참조"
  - 상세: HEX 값 `#f7f8f6` 을 인라인으로 박아 두었다. brand spec §8.2.2에서 `soil-50` = `#f7f8f6` 로 동일하게 정의되어 있어 현재는 일치. 그러나 향후 brand spec에서 `soil-50` HEX가 조정될 경우 `10-auth-flow.md` 의 HEX 하드코딩이 불일치 원인이 된다.
  - 제안: `10-auth-flow.md` §1 에서 HEX 값 하드코딩을 제거하고 토큰명(`soil-50`)만 유지하도록 brand spec 개정 시 함께 정리 권장 (동기화 권장).

---

### 요약

`spec/6-brand.md` §8 정식 개정안은 기존 spec 영역과 직접 모순되는 항목이 없다. 데이터 모델(`spec/1-data-model.md`)·API 계약·RBAC·상태 전이 영역에는 brand spec 이 개입하지 않으므로 해당 충돌 범주는 해당 없다. 요구사항 ID 체계(`NAV-*`, `ED-AI-*` 등)와도 겹치지 않는다. 라우트 spec(`_layout.md`, `10-auth-flow.md`)은 brand spec 발효 이전에 이미 단일 진실 참조 구조로 정비되어 있고, §8.4.6의 우선권 선언과도 정합한다. 발견된 3건은 모두 INFO 등급으로, 구현 시 즉흥 결정을 예방하기 위한 동기화 권장 사항이며 채택 자체를 차단하는 요소는 없다.

### 위험도

LOW
