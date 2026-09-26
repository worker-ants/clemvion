# Rationale 연속성 검토 — forbidden-helper-sentences (--impl-prep)

## 검토 범위

target 은 `spec/conventions/swagger.md` 전문 + 연관 spec(주로 `spec/0-overview.md`,
`spec/1-data-model.md` Rationale, 예산 초과로 절단된 다수 파일)의 번들이다. 계획 문서
(`plan/in-progress/forbidden-helper-sentences.md`, `spec_impact: none`)는 §5-4 가 이미
규정한 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole`)를 쓰지 않던 13곳을
헬퍼로 옮기고, 서비스 문장을 잇는 구두점(`, 또는` → ` 또는 `)을 새 헬퍼
`forbiddenWithService(guard, service)` 로 통일하는 작업이다. spec 변경이 없으므로
Rationale 연속성 관점에서는 (a) 현재 spec 번들 자체의 자기 정합, (b) 계획된 구현이
번들의 Rationale 이 이미 내린 결정과 충돌하지 않는지를 확인했다.

교차 확인한 실제 코드/문서 (bundle 에서 예산 초과로 생략된 파일 포함, 직접 Read):
- `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드 (2026-09-25)",
  "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)"
- `spec/5-system/2-api-convention.md` §5.4 및 "검증 층"
- `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (기존 헬퍼 구현)
- `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` (가드 범위)
- `plan/complete/forbidden-desc-codes.md` · `spec-draft-swagger-forbidden-codes.md` (선행 결정 이력)

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** 새 구두점 결정(` 또는 ` 통일)이 swagger.md Rationale 에 아직 없음
  - target 위치: `spec/conventions/swagger.md` §5-4 Rationale
    "§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)"
  - 과거 결정 출처: 같은 절 — "공용 헬퍼로 쓴다" 문단은 코드 삽입까지만 규정하고
    서비스 문장을 잇는 구두점(`, 또는` vs ` 또는 `)은 규정하지 않는다. 실제로
    저장소 8곳(`workspaces.controller.ts` · `integrations.controller.ts` ·
    `workflow-test-datasets.controller.ts`)이 전부 `, 또는` 을 쓰고 있어, 이번
    계획이 그것을 ` 또는 `(헬퍼 내부 구분자와 동일)로 바꾸는 것은 **기존 관행을
    번복**하는 성격이 있다.
  - 상세: 이 번복은 근거가 있다 — `forbiddenForRole` 헬퍼 자체가 이미 ` 또는 ` 을
    쓰고, `/ai-review` INFO15 가 "한 문장 안에서 «A 또는 B, 또는 C» 로 갈린다" 는
    불일치를 지적했다. 계획 문서(`forbidden-helper-sentences.md`)에 이 근거가
    명시돼 있어 "무근거 번복"(관점 3)에는 해당하지 않는다. 다만 이 결정이 spec 의
    `## Rationale` 에는 반영되지 않고 plan 문서에만 남는다 — `spec_impact: none` 이라
    plan 저자도 의도적으로 spec 을 건드리지 않기로 했다(§5-4 자체는 "문장은 공용
    헬퍼로 만든다"는 원칙만 말하고 구두점까지 못박지 않았으므로 이 결정은 §5-4
    범위 밖의 구현 세부로 봐도 무리는 없다).
  - 제안: 구속력 있는 조치는 아니다. 다음에 새 조합 문장이 필요해질 때 같은 드리프트
    (`, 또는` 재도입)가 반복되지 않도록, `forbiddenWithService` 헬퍼의 JSDoc 이나
    swagger.md §5-4 에 "guard-service 결합은 ` 또는 ` 단일 구두점" 한 줄을 남기는
    것을 권장한다 — 이번 PR 범위에서 필수는 아니다(spec 변경 없이 코드 헬퍼
    docstring 만으로도 충분히 만족 가능).

## 확인된 정합 사항 (참고)

- 계획이 "형식 가드를 확장하지 않는다"(설명이 헬퍼로 **시작**하는지까지는 안 본다)고
  결정한 것은 swagger.md §5-4 Rationale "서비스 거부는 세지 않는다 — 헬퍼 문장 뒤에
  덧붙이도록 안내만 한다" 및 §Rationale "개수를 세지 않는다" 원칙과 정확히 일치한다.
  가드 확장을 안 하기로 한 것은 원칙 위반이 아니라 원칙을 **지키는** 선택이다.
- `NOT_A_MEMBER`/`forbiddenForRole` 사용은 `data-flow/12-workspace.md` "가드 거부의
  오류 코드" 결정(비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`, `viewer` 는 코드
  하나)과 일치하며, 계획은 이 결정을 재도입하거나 뒤집지 않는다.
- 계획의 CHANGELOG 체크리스트 항목(OpenAPI 403 설명 문장 변경 고지)은 저장소 관행
  ("CHANGELOG 항목은 수정의 일부다")과 일치한다.

## 요약

target 번들(주로 `spec/conventions/swagger.md`)과 이번 계획(`forbidden-helper-sentences`,
spec 변경 없음)은 §5-4 및 `data-flow/12-workspace.md` 의 기존 Rationale 결정(공용 헬퍼
사용, `NOT_A_MEMBER`/역할 코드 분리, "서비스 거부는 세지 않는다")을 그대로 따르고 있으며
재도입·무근거 번복·invariant 우회로 볼 만한 지점은 발견되지 않았다. 유일한 비고는 구두점
통일(`, 또는` → ` 또는 `) 결정이 plan 문서에는 근거와 함께 적혀 있으나 spec 의
`## Rationale` 에는 남지 않는다는 점인데, 이는 §5-4 규정 범위 밖의 구현 세부이고
`spec_impact: none` 이 의도된 것이라 차단 사유는 아니다.

## 위험도

NONE
