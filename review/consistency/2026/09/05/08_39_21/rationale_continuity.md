# Rationale 연속성 검토 — `spec-draft-numeric-wire-convention.md`

## 검증 절차 요약

target 이 다루는 두 파일(`spec/1-data-model.md`, `spec/conventions/swagger.md`)의 현재 `##
Rationale` 전문을 대조했고, 그 외 번들에 포함된 전 spec 문서(74개는 예산 초과로 생략 —
목록 확인, numeric/wire 타입과 무관한 영역이라 판정에 영향 없음)의 Rationale 도 `wire 타입`,
`NUMERIC`, `decimal` 키워드로 훑었다. 추가로:

- `grep -rhoiE "^\s+[a-z_]+ +(NUMERIC|DECIMAL)\([0-9]+, *[0-9]+\)" codebase/backend/migrations/*.sql`
  실행 → target 의 "numeric 컬럼은 둘뿐" 주장이 **실측과 일치**(`cost_usd`, `threshold`).
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 의
  `findNumericAsNumber` 및 그 docstring("짝짓기는 `<Entity>Dto` 이름 관례에 의존하는 알려진
  한계", `StatisticsResponseDto`/`AlertRuleDto` 음성 대조군) 을 직접 열어 target 의 가드
  범위 서술과 대조 → **정확히 일치**.
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 를 열어
  target 이 예로 든 "`//` 내부 서사 vs JSDoc 공개 설명" 분리가 실제로 적용돼 있음을 확인.
- target 이 인용한 과거 리뷰 근거(`19_43_18` INFO#6, `20_05_42` W2, `21_10_30` INFO#3) 를
  `review/code/2026/09/04/19_43_18/`, `review/code/2026/09/04/21_10_30/`,
  `review/consistency/2026/09/04/20_05_42/` 의 실제 산출물과 대조 → **셋 다 실재하고 인용
  내용과 일치** (지어낸 이력 아님).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 원 항목 문구("`numeric`/
  `decimal` 컬럼을 엔티티 그대로 내보내는 응답은 문자열") 를 target 의 "처음 등재된 문구"
  인용과 대조 → 일치.

## 발견사항

- **[INFO]** JSDoc 분리 신설 규칙(변경안 C)의 소급 적용 범위 미명시
  - target 위치: §4 변경안 (C) — `swagger.md §3` 신설 문단
  - 과거 결정 출처: `spec/conventions/swagger.md` `## Rationale` §1-4 "적용 범위 — 신규
    변경 한정"(line 122) — 새 DTO 분류 규칙을 도입할 때 "기존 필드를 일괄 소급 재선언하지
    않는다"고 **매번 명시**해 온 관행이 이 문서 안에 두 차례(§1-4 신설, `execution-context.md`
    §원칙 3 인용) 반복된다.
  - 상세: target 의 (C) 는 "JSDoc 은 공개 API 로 나간다"는 새 규칙을 §3 에 추가하면서, 이미
    존재하는 다수 DTO 의 JSDoc 에 내부 서사가 섞여 있을 가능성에 대해 소급 정리 의무가
    있는지/없는지를 밝히지 않는다. Rationale 자체를 위반하는 것은 아니지만, 이 문서가 스스로
    반복해 온 "신규 변경 한정" 관행과 나란히 두면 다음 사람이 "기존 DTO 도 다 훑어야 하나"를
    다시 판단해야 한다.
  - 제안: (C) 문단 또는 그 Rationale 항에 "기존 DTO 는 소급 정리 대상 아님(§1-4 와 동일 원칙)"
    한 줄을 추가하거나, 반대로 의도적으로 소급 대상이라면 그 근거를 명시.

## 요약

target(`plan/in-progress/spec-draft-numeric-wire-convention.md`)은 `spec/1-data-model.md`·
`spec/conventions/swagger.md` 어느 쪽의 기존 `## Rationale` 에도 이미 기각된 대안을 되살리거나
합의된 원칙을 거스르는 지점이 없다. 오히려 이 draft 자체가 세 가지 결정("가드를 명시 변환
경로까지 넓히지 않는다", "`cost_usd` 행까지 함께 고친다", "§3 이 아니라 별도 문단으로
넣는다")에 대해 **새 Rationale 을 직접 동반**하고 있어 "결정의 무근거 번복" 항목을
스스로 충족한다. `threshold` 를 `Float` 로 표기한 종전 문구는 Rationale 로 채택된 결정이
아니라 실제 DB/wire 타입과 애초에 어긋나 있던 오표기였으므로, 이를 정정하는 것은 결정의
번복이 아니라 사실 정정이다(`alert_rule` §2.25 등재 Rationale 이 정의한 "이 문서 = 컬럼
정의 SoT" 원칙과도 부합). 인용된 과거 리뷰 근거·가드 코드·DTO 예시를 전수 실측 대조한
결과 모두 실재했고 서술과 일치했다. 유일한 지적은 신설 JSDoc 분리 규칙의 소급 적용 범위를
이 문서가 스스로 반복해 온 관행("신규 변경 한정" 명시)만큼 명확히 하지 않았다는 INFO 수준
보완 제안이다.

## 위험도

NONE
