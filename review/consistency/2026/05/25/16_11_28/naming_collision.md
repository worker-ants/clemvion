# 신규 식별자 충돌 Check — naming_collision

검토 대상: `plan/in-progress/spec-fix-presentation-common-frontmatter.md`
검토 일시: 2026-05-25

---

## 발견사항

### 발견사항 없음 — INFO 수준 관찰 1건

- **[INFO]** `id: presentation-common` 는 현재 spec 전체에서 사용된 적 없는 신규 식별자
  - target 신규 식별자: `id: presentation-common` (현행 `id: common` 에서 변경)
  - 기존 사용처: 없음. `grep -r "presentation-common" spec/` 결과 0건. 코드베이스(`codebase/`) 에서도 0건.
  - 상세: 충돌 위험 없음. 신규 식별자가 기존에 다른 의미로 쓰인 사례가 없다.
  - 제안: 변경을 그대로 진행해도 무방.

- **[INFO]** `id: common` 중복 해소 맥락 확인
  - target 신규 식별자: `presentation-common` (기존 `common` 을 대체)
  - 기존 사용처: `id: common` 은 현재 7개 spec 파일에 중복 사용 중 — `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md`, `spec/4-nodes/6-presentation/0-common.md`
  - 상세: `spec-frontmatter.test.ts` 가드는 `id` 의 uniqueness 를 강제하지 않는다 (비어 있지 않은 string 이기만 하면 통과). 따라서 기존 `id: common` 중복은 현재 guard 위반이 아니다. target 이 `id: presentation-common` 으로 변경하면 `spec/4-nodes/6-presentation/0-common.md` 만 유일한 식별자를 갖게 되어 나머지 6개 `id: common` 파일과 더 이상 충돌하지 않는다 — 방향이 올바르다.
  - 제안: 향후 나머지 6개 `0-common.md` 도 카테고리 prefix 를 포함한 고유 id 로 정비하는 것을 권장하지만, 본 target 변경의 범위는 아니다.

---

## 점검 항목별 결과

| 점검 관점 | 결과 | 비고 |
|-----------|------|------|
| 1. 요구사항 ID 충돌 | 이상 없음 | target 은 새 요구사항 ID 를 부여하지 않음. CHANGELOG 항목은 ID 가 없는 자유 텍스트. |
| 2. 엔티티/타입명 충돌 | 이상 없음 | 새 엔티티·DTO·인터페이스 도입 없음. frontmatter 메타 변경만. |
| 3. API endpoint 충돌 | 이상 없음 | 새 endpoint 없음. |
| 4. 이벤트/메시지명 충돌 | 이상 없음 | 새 이벤트명 없음. |
| 5. 환경변수·설정키 충돌 | 이상 없음 | 새 ENV var / config key 없음. |
| 6. 파일 경로 충돌 | 이상 없음 | 기존 파일 `spec/4-nodes/6-presentation/0-common.md` 를 수정하는 것이며 새 파일 경로를 신설하지 않음. `plan/in-progress/spec-fix-presentation-common-frontmatter.md` 파일명도 기존 plan 파일과 중복 없음. |
| 7. spec frontmatter `id` 충돌 | 이상 없음 | `presentation-common` 은 현재 전체 spec 에서 사용된 적 없는 신규 값. |

---

## 요약

target 문서(`spec-fix-presentation-common-frontmatter.md`)가 도입하는 신규 식별자는 `id: presentation-common` 단 하나이며, 이 값은 spec 전체(`spec/**/*.md`) 및 코드베이스(`codebase/`) 어디에도 기존에 사용된 적이 없다. 다른 관점(요구사항 ID, 엔티티명, API endpoint, 이벤트명, ENV var, 파일 경로)에서도 신규 식별자를 도입하지 않으므로 충돌이 발생하지 않는다. 현행 `id: common` 이 7개 파일에 중복 존재하는 상황에서 presentation 노드 공통 spec 만 고유 식별자로 정비하는 방향은 타당하다. 식별자 충돌 관점에서 차단 사유가 없다.

## 위험도

NONE
