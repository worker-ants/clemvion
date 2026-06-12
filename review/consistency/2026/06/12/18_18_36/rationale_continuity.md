# Rationale 연속성 검토 결과

검토 모드: --impl-done  
scope: `spec/conventions/`  
diff-base: origin/main

---

## 발견사항

변경된 파일은 3개다.

- `spec/conventions/cafe24-api-catalog/_generator.py` — 컨테이너(obj/arr) 필드에 대한 cross-map fallback 제한 추가
- `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — 응답 래퍼 ↔ 요청 파라미터 이름 충돌 회귀 검증 절차 명문화
- `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 래퍼 행 설명 수정 (`정렬 순서 asc…` → `(응답 객체)`)

### 발견사항 1

- **[INFO]** `_overview.md §7.2` 의 기존 wrapper 처리 원칙과 신규 §7.3 추가 사항이 정합하나, Rationale 항목 미신설
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §7.3 (신규 불릿) + `_generator.py` docstring/코드 수정
  - 과거 결정 출처: 해당 spec 의 `## Rationale` 이 없음 (`_overview.md` 자체에 Rationale 섹션 부재)
  - 상세: `_overview.md §7.2` 는 "어디에도 없거나 공통 base 없이 의미가 충돌하는 generic 명은 빈칸으로 둔다(추측 주입 금지). property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`" 로 기존 원칙을 이미 명시하고 있다. 이번 변경은 그 원칙을 generator 코드 레벨에서 실제로 보강(컨테이너에 대해 cross-map fallback 적용 금지)하고, §7.3 에 회귀 검증 레시피를 추가한 것이다. 기각된 대안 재도입 · 합의 원칙 위반 · invariant 우회 어느 것도 해당하지 않는다. 다만 `_overview.md` 에 Rationale 섹션이 없어서, 이번 bug-fix 성격의 결정("왜 cross-map fallback 을 컨테이너에서 제한했는가"의 명시적 근거)이 docstring 과 §7.3 불릿에만 기록됐고 `## Rationale` 항목으로 정식 등재되지 않았다.
  - 제안: 필수 수정은 아니다. `_overview.md` 에 `## Rationale` 섹션을 추가하고 "R-7.3: 응답 래퍼 ↔ 요청 파라미터 이름 충돌 시 cross-map fallback 컨테이너 제외" 항을 작성하면 결정 근거가 spec 내에서 추적 가능해진다. 현재는 `_generator.py` 주석에만 이유가 기술돼 있어 spec 독자가 놓칠 수 있다.

### 발견사항 2

- **[INFO]** `appstore-orders.md` 의 `order` 래퍼 행 수정 — 기존 원칙을 실제로 적용한 데이터 정정이며 Rationale 충돌 없음
  - target 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` (GET·POST 응답 파라미터 표의 `order` 행)
  - 과거 결정 출처: `_overview.md §7.2` "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
  - 상세: `order` 응답 래퍼가 `정렬 순서 asc : 순차정렬 · desc : 역순 정렬` 로 잘못 채워진 것은 generator 의 cross-map fallback 버그로 인해 `order` 라는 이름이 동명 요청 파라미터 설명을 가져온 결과다. 이번 변경은 그 결과물을 §7.2 원칙에 맞게 `(응답 객체)` 로 교정했다. 기존 Rationale 결정과의 충돌이 아니라 기존 결정을 올바르게 반영한 수정이다.
  - 제안: 없음. 수정이 §7.2 원칙과 완전히 정합한다.

---

## 요약

이번 `spec/conventions/` 변경 3건은 모두 동일 맥락에 속한다: `_overview.md §7.2` 에 이미 합의된 "응답 래퍼는 `(응답 객체)`/`(목록)` 라벨을 사용한다" 원칙이 generator 의 cross-map fallback 로직에서 컨테이너 타입에 대해 지켜지지 않던 버그를 수정하고, 그 수정 결과물을 명문화하며, 버그로 잘못 생성된 `appstore-orders.md` 의 래퍼 행 설명을 정정한 것이다. 기각된 대안의 재도입, 합의 원칙 위반, 근거 없는 결정 번복, 시스템 invariant 우회 어느 항목에도 해당하지 않는다. 단, `_overview.md` 에 별도 `## Rationale` 섹션이 없어 이번 결정 근거가 코드 주석·§7.3 불릿에만 분산 기록된 점이 장기 유지보수 관점에서 보완 가능한 INFO 수준 사항이다.

---

## 위험도

NONE
