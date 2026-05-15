# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (spec/6-brand.md §8 정식 개정 draft)
검토 모드: `--spec`
검토 시각: 2026-05-15

---

### 발견사항

- **[INFO]** 현행 spec/6-brand.md §8.2 타이포그래피 정의와 draft §8.3의 워드마크 폰트 정의 차이
  - target 위치: draft §8.3 타이포그래피 표 (워드마크 base 행)
  - 충돌 대상: `spec/6-brand.md` §8.2 "워드마크 | Geist Sans Medium / 자간 `-0.01em`"
  - 상세: 현행 §8.2는 워드마크 폰트를 "Geist Sans Medium"으로 정의하지만, draft §8.3은 `system sans-serif (Helvetica Neue, Helvetica, Arial)` weight 200/600 스택으로 전면 대체한다. 이는 의도된 변경(R-11)이며, drop-in 대체 범위에 명시되어 있다. 충돌이 아닌 대체이므로 INFO로 분류.
  - 제안: 채택 시 §8.3가 §8.2를 완전히 대체함을 확인. 별도 조치 불필요.

- **[INFO]** spec/2-navigation/10-auth-flow.md §1의 배경 기술 "제품 브랜드 색상 또는 그래디언트" 잔존
  - target 위치: draft S1-B 갱신안 (§426-438)
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §1 "배경: 제품 브랜드 색상 또는 그래디언트"
  - 상세: 현행 `spec/2-navigation/10-auth-flow.md` §1은 "배경: 제품 브랜드 색상 또는 그래디언트"로 기술되어 있다. Draft는 이를 `soil-50 단색 + 그라데이션 금지`로 구체화하는 S1-B 갱신안을 포함하고 있다. 충돌이 아닌 동기화 대상이며, Stage 1 안에서 함께 처리하도록 draft에 명시되어 있어 처리 경로가 명확하다.
  - 제안: 채택 시 S1-B를 동일 turn에 `spec/2-navigation/10-auth-flow.md` §1에 반영. 별도 조치 불필요.

- **[INFO]** spec/2-navigation/_layout.md §2.1 로고 행에 expanded/collapsed 변종 규칙 미정의
  - target 위치: draft §8.4.6 사이드바 행, S1-A 갱신안
  - 충돌 대상: `spec/2-navigation/_layout.md` §2.1 로고 행 "제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동"
  - 상세: 현행 `_layout.md` §2.1 로고 행에는 expanded/collapsed 변종 규칙이 없다. Draft §8.4.6은 "expanded → Full logo (light) / collapsed → Icon mark"를 명시하고, S1-A 갱신안이 동기화 텍스트를 제공한다. 충돌이 아닌 추가·구체화이며, Stage 1 동기화 대상으로 명확히 표시되어 있다.
  - 제안: 채택 시 S1-A를 동일 turn에 `spec/2-navigation/_layout.md` §2.1에 반영.

- **[INFO]** spec/6-brand.md §8.3 "단색 또는 단색 반전만 허용" 조항의 명시적 무효화
  - target 위치: draft §8.4.4, R-3
  - 충돌 대상: `spec/6-brand.md` §8.3 "금지: ...단색 또는 단색 반전만 허용한다"
  - 상세: 현행 §8.3은 워드마크에 단색/단색 반전만 허용한다. Draft §8.4.4는 2-tone 처리를 정식 허용하며 이 조항을 명시적으로 무효화한다. Drop-in 대체 범위에 §8.3 폐기가 명시되어 있고, Rationale R-3에 근거가 기술되어 있다. 의도된 대체이며 충돌이 아니다.
  - 제안: 채택 후 현행 §8.3 전체가 삭제·대체됨을 확인. 별도 조치 불필요.

- **[INFO]** 폐기 토큰 grep 명령의 spec/ 검색 범위와 `spec/6-brand.md` 자체 잔존 가능성
  - target 위치: draft §8.2.5 "잔재 검출 명령"
  - 충돌 대상: `spec/6-brand.md` §8.1 현행 컬러 토큰 정의 (`#1F8A4C`, `#A8D86F`, `#0F3D2A` 등)
  - 상세: Draft §8.2.5의 grep 명령은 `spec/` 폴더 전체를 대상으로 한다. `spec/6-brand.md` §8 자체가 drop-in 교체될 경우 잔재가 자동 해소되지만, Stage 2 마무리 시점까지 spec/6-brand.md에 현행 §8.1이 남아 있으면 grep 명령이 false positive를 반환할 수 있다. Drop-in 교체가 Stage 1에서 이루어지고 Stage 2 grep은 그 이후에 실행되므로 실질적 문제는 없다.
  - 제안: Stage 1 spec 반영이 완료된 이후에 grep 검증을 수행하도록 Stage 2 plan에 순서 명시 권장.

- **[INFO]** spec/0-overview.md §3.4 상태 표시 "Active(초록)" 색상과 vine ramp 토큰 매핑 미명시
  - target 위치: draft §8.2 전체 토큰 정의
  - 충돌 대상: `spec/0-overview.md` §3.4 "Badge/Tag: Active(초록), ... Success state"
  - 상세: spec/0-overview.md §3.4는 success/active 상태를 "초록"으로만 기술하고 구체적 HEX/토큰을 명시하지 않는다. Draft §8.2에서 `vine-400 (Sprout)` = success state로 정의한다. 직접 모순은 아니나 향후 구현 시 어느 vine 토큰이 success state인지 두 문서를 교차 확인해야 한다.
  - 제안: Stage 2 CSS 토큰 매핑 시 `vine-400` → success state 매핑을 명시. spec/0-overview.md §3.4에는 변경 불필요 (상세는 §8에 위임).

---

### 요약

Cross-Spec 일관성 관점에서 이번 draft는 전반적으로 충돌 위험이 낮다. CRITICAL 또는 WARNING 등급의 직접 모순은 발견되지 않았다. 현행 `spec/6-brand.md` §8.1~§8.4, `spec/2-navigation/10-auth-flow.md` §1 배경 기술, `spec/2-navigation/_layout.md` §2.1 로고 행과의 차이는 모두 draft 내에서 명시적 drop-in 대체 범위 및 S1-A/S1-B 갱신안으로 처리 경로가 확보되어 있다. 6건 모두 INFO 수준의 동기화 확인 사항이며, Stage 1에서 3개 파일을 동시 반영하면 잔존 불일치가 해소된다. Stage 2 grep 검증의 실행 순서(Stage 1 spec 반영 완료 후)만 plan에 명시하면 추가 리스크가 없다.

---

### 위험도

LOW
