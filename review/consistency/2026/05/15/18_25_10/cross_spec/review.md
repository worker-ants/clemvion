# Cross-Spec 일관성 검토

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (§8 Visual Identity 정식 개정안)
참조 spec: `spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md`, `spec/0-overview.md`

---

## 발견사항

- **[CRITICAL]** 타이포그래피 정의 직접 충돌 — 워드마크 폰트 패밀리
  - target 위치: §8.3 타이포그래피 표, "워드마크 base" 행
  - 충돌 대상: `spec/6-brand.md` §8.2 타이포그래피 현행 정의
  - 상세: 현행 `spec/6-brand.md §8.2` 는 워드마크 폰트를 **"Geist Sans Medium / 자간 `-0.01em`"** 으로 정의한다. draft §8.3 은 동일 자리를 **system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) weight 200, letter-spacing `-0.5px`** 으로 완전히 다르게 재정의한다. 폰트 패밀리·weight·자간 세 항목이 모두 불일치한다. draft 가 발효되기 전까지 두 정의가 동시에 존재하며, 구현자는 어느 쪽을 기준으로 삼을지 결정할 수 없다.
  - 제안: `spec/6-brand.md §8.2` 타이포그래피 섹션 전체를 draft §8.3 내용으로 동시 교체한다. draft §8.3 에 "§8.2 타이포그래피 섹션을 본 내용으로 전면 대체" 문구를 명시적으로 추가해 drop-in 범위를 확정한다.

- **[CRITICAL]** 로고 사용 규정 충돌 — 워드마크 단색 규정 vs 2-tone 허용
  - target 위치: §8.4.4 워드마크 사용 규정
  - 충돌 대상: `spec/6-brand.md §8.3 로고 사용 규정 (초안)` — "단색 또는 단색 반전만 허용한다"
  - 상세: 현행 spec 의 "단색 또는 단색 반전만 허용" 규정은 draft §8.4.4 의 "2-tone 처리 정식 허용, 이전 단색 규정 폐기" 와 직접 모순된다. draft 가 §8 만 대체하더라도, 현행 §8.3 이 같은 파일 안에 남아 있으면 동일 문서 내에 상충 규정이 공존한다.
  - 제안: `spec/6-brand.md §8.3` 전체를 draft §8.4 로 대체하거나, drop-in 범위에 §8.3 명시적 삭제를 포함한다. draft 본문 도입부의 "본 draft 의 §8 이 현 §8 을 대체" 범위에 §8.3 이 포함됨을 명시한다.

- **[WARNING]** 사이드바 로고 변종 규칙 — `_layout.md §2.1` 과의 동기화 필요
  - target 위치: §8.4.6 로고 노출 자리, 사이드바 행
  - 충돌 대상: `spec/2-navigation/_layout.md §2.1 구성` — 로고 영역을 "제품 로고. 클릭 시 대시보드로 이동"으로만 기술하며 expanded/collapsed 변종 분기를 규정하지 않는다.
  - 상세: draft §8.4.6 은 "expanded → Full logo (light) / collapsed → Icon mark" 를 정식 사양으로 선언하며 "_layout.md §2.1 보다 우선" 을 명시한다. 그러나 `_layout.md §2.1` 자체는 이 분기를 언급하지 않아, 추후 `_layout.md` 만 참조한 구현자는 변종 전환 규칙을 누락할 수 있다. 두 문서가 동시에 살아있는 spec 이므로 각자 독립적으로 참조될 때 일관된 구현이 보장되어야 한다.
  - 제안: `spec/2-navigation/_layout.md §2.1` 로고 행의 "내용" 컬럼에 "expanded: Full logo (light), collapsed: Icon mark — 변종 상세는 `spec/6-brand.md §8.4.6` 참조" 를 추가한다.

- **[WARNING]** 인증 화면 로고 변종 규정 — `10-auth-flow.md` 와의 동기화 필요
  - target 위치: §8.4.6, 인증 화면 행
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §1 화면 구성 개요` — `[Logo]` 플레이스홀더만 존재하며 어떤 변종을 사용할지 규정 없음
  - 상세: draft 는 `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` 5개 인증 화면에서 "Full logo (light)" 를 사용하도록 정식 사양화한다. 인증 화면 spec 의 모든 와이어프레임 박스에는 단순히 `[Logo]` 만 표기되어 있어, 두 문서 중 한쪽만 참조하면 사용 변종이 불명확하다. 또한 인증 화면 배경이 "제품 브랜드 색상 또는 그래디언트"로 기술되어 있는데, draft 의 라이트 배경 전용 "Full logo (light)" 만으로 충분한지 배경 색 조합에 따른 예외 여부가 명시되지 않는다.
  - 제안: `spec/2-navigation/10-auth-flow.md §1` 의 `[Logo]` 관련 설명에 "Full logo (light) 사용 — 상세는 `spec/6-brand.md §8.4.6` 참조" 문구를 추가한다. 배경 색이 다크인 경우를 사용할 계획이 있다면 draft §8.4.6 에 예외 절을 추가한다.

- **[WARNING]** 폐기 토큰의 현행 코드 잔존 — 그라운드 트루스 불일치 가능성
  - target 위치: §8.2.5 폐기된 토큰, §8.6 임시 자산 마이그레이션
  - 충돌 대상: `frontend/src/app/globals.css` 및 현행 SVG 자산 (draft 본문 내에서도 언급)
  - 상세: draft 는 `Vine Green #1F8A4C`, `Deep Forest #0F3D2A`, `Bud Lime #A8D86F`, `Bark #6B5544`, `Soil #F4F1EC`, `Ink #111111` 6개 토큰을 폐기 선언한다. 이 값들은 현재 `frontend/src/app/globals.css` 와 로고 SVG 파일에 하드코딩 되어 있을 가능성이 높다. spec 발효 이후 구현 완료 전 기간 동안 spec 과 코드 사이의 불일치가 발생하며, draft 스스로 §8.6 에서 이 일시 불일치를 허용한다고 기술하고 있다. 그러나 Stage 2 인수인계 항목의 grep 검출 안전망이 plan 문서에만 있고 spec 본문에는 없어, 구현 완료 여부를 spec 만으로는 판단할 수 없다.
  - 제안: draft §8.6 또는 §8.2.5 에 "본 §8 발효 후 Stage 2 구현 완료 전까지는 코드와 spec 이 일시 불일치 상태다 — `plan/in-progress/brand-refresh-impl.md` 의 완료 확인 후 불일치 해소" 문구를 추가해 관리 상태를 명시한다.

- **[INFO]** `spec/6-brand.md §8` 섹션 번호 체계 변경
  - target 위치: §8.1 ~ §8.6 (신규), §8.4.5 가 이전 §8.4 어조 가이드를 §8.5 로 밀어냄
  - 충돌 대상: 현행 `spec/6-brand.md §8.1 컬러` / `§8.2 타이포그래피` / `§8.3 로고 사용 규정` / `§8.4 어조와 스타일`
  - 상세: 현행 §8.4 "어조와 스타일" 은 draft 에서 §8.5 로 이동된다. draft 는 "§8.4 였던 기존 어조 가이드. 본 개정에서 변경 없음" 이라고 주석을 달지만, 다른 spec 이나 문서가 §8.4 를 직접 앵커 링크(`#84-...`)로 참조하고 있다면 링크가 깨진다. 현재 코퍼스에서 `spec/6-brand.md#8` 을 명시적으로 링크하는 문서는 확인되지 않으나, markdown 앵커는 암묵적 의존 경로이므로 확인 권장이다.
  - 제안: 개정 적용 전 `grep -r "6-brand.md#8" spec/` 으로 앵커 참조를 확인하고, 발견 시 새 번호로 갱신한다.

- **[INFO]** 인증 화면 배경 서술 — 브랜드 토큰과의 연결 부재
  - target 위치: (해당 없음 — 기존 spec 의 미정의 영역)
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §1` — "배경: 제품 브랜드 색상 또는 그래디언트"
  - 상세: 인증 화면 배경이 "브랜드 색상 또는 그래디언트" 로 열려 있으나, draft 의 §8.2 에서 그라데이션은 "여전히 금지" (§8.4.4 기준) 이다. 인증 화면 배경에 그라데이션을 적용하면 §8.4.4 의 금지 규정과 충돌할 수 있다.
  - 제안: `spec/2-navigation/10-auth-flow.md §1` 의 배경 설명을 "soil-50 (`#f7f8f6`) 또는 vine-700 단색 배경 — 그라데이션 금지 (`spec/6-brand.md §8.4.4`)" 로 구체화한다. 또는 draft §8.4.6 의 인증 화면 행에 "배경 색: soil-50 (라이트)" 를 명시한다.

---

## 요약

target draft 는 `spec/6-brand.md §8` 의 Visual Identity 정식 개정안으로, 기술 범위가 브랜드·시각 자산 영역에 집중되어 있어 데이터 모델·API 계약·RBAC 등 다른 spec 영역과의 직접 교차 충돌은 없다. 그러나 동일 파일(`spec/6-brand.md`) 내에 현행 §8.2~§8.3 과의 직접 모순이 두 건 존재한다(CRITICAL): 워드마크 폰트 패밀리·weight·자간의 전면 재정의, 그리고 단색 전용 규정 vs 2-tone 허용의 정면 충돌이다. 이 두 항목은 draft 가 `spec/6-brand.md §8` 에 적용될 때 현행 §8.2~§8.3 이 반드시 동시에 삭제·교체되어야 해소된다 — drop-in 범위 명시가 핵심이다. `_layout.md` 와 `10-auth-flow.md` 에 대해서는 변종 규칙이 draft 에서 새롭게 추가되는 내용이므로 WARNING 수준 동기화가 필요하다. CRITICAL 2건은 draft 를 `spec/6-brand.md` 에 병합하는 순간 자동 해소될 수 있으나, 병합 범위(삭제되는 구 §8 항목 목록)가 draft 에 명시적으로 기술되어야 한다.

---

## 위험도

MEDIUM
