# Rationale 연속성 검토 — `spec-draft-api-convention-verifier-registration.md`

## 발견사항

- **[INFO]** `spec/conventions/swagger.md` 자체 `## Rationale` 이 이번 검토 입력 번들에서 누락됐다
  - target 위치: target 문서 `③ 변경안 > spec/conventions/swagger.md` 및 `## Rationale > 기각한 대안 — spec/conventions/swagger.md 에만 등재`
  - 과거 결정 출처: 입력 번들에는 없음(누락) — 직접 조회한 `spec/conventions/swagger.md#Rationale` (447~588행, `id: swagger` 는 target 의 `spec_impact` 대상 파일)
  - 상세: 제공된 "관련 Rationale 발췌" 번들은 `spec/5-system/**`·`spec/0-overview.md`·`spec/1-data-model.md`·`spec/2-navigation/**` 등 여러 spec 문서의 `## Rationale` 을 담고 있으나, `spec/conventions/` 트리는 단 한 문서도 포함되지 않았다. target 이 `code:`·본문 문장을 직접 수정하겠다고 선언한 `swagger.md` 조차 빠져, 이 checker 가 원래 갖춰야 할 "target 이 그 문서 자신의 과거 Rationale 과 충돌하는가" 판정을 번들만으로는 할 수 없는 상태였다. 별도로 파일을 직접 읽어 447~588행 전체(§1-6 numeric 분업, §0 Swagger UI opt-in, §1-4 discriminator/union, §3 DTO 길이 지향화, §5 pass-through, §5-4 워크스페이스 가드 확대 등)를 확인한 결과, 검증자 등재 위치(`2-api-convention.md` vs `swagger.md`)나 경계 문장 신설에 대해 기각된 결정·상충하는 원칙은 없었다 — target 의 주장과 실제 충돌은 없다.
  - 제안: 이번 회차는 통과이지만, orchestrator 의 `--spec` 번들링 필터가 `spec_impact` 로 선언된 `spec/conventions/*.md` 파일을 계통적으로 빠뜨리는 것으로 보인다(기존 교훈 "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 와 동일 클래스). 다음 회차부터는 `spec_impact` 목록에 있는 파일은 영역 트리와 무관하게 반드시 번들에 포함시키도록 orchestrator 스크립트를 점검할 것.

- **[INFO]** 기각 근거 인용이 원문 발췌가 아니라 재서술인데 인용부호로 표기됨
  - target 위치: target 문서 `## ① ... 재해석이 아니라 기존 관행의 적용이다` 문단, `review-citations.md 가 만든 예외 (*"시행 코드가 없는 순수 문서형 convention 은 준수 예시를 적는다"*)`
  - 과거 결정 출처: `spec/conventions/review-citations.md#Rationale > code: 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유` — 원문은 *"이 규약에는 시행하는 코드가 없다 — 주석 형태를 강제하는 가드가 없기 때문이다. 그래서 `code:` 에 이 규약이 처방하는 형태를 실제로 쓰는 파일을 적었다"*
  - 상세: target 이 인용부호로 감싼 문장은 원문의 재구성(paraphrase)이며 축자 인용이 아니다. 의미는 정확히 일치하고(실제로 review-citations.md 는 "시행 코드 부재 → 준수 예시로 code: 채움" 을 그대로 말한다) 왜곡은 없으나, 이 저장소가 인용 정확성에 특히 민감하다(`review-citations.md` 자체가 인용 형태 규약 문서) 는 점에서 형식만 짚어둔다.
  - 제안: 조치 불필요 — 의미 왜곡이 없으므로 그대로 두어도 무방하다. 후속 편집 때 인용부호를 걷어내거나 "요지" 라고 명시하면 더 정확해진다.

## 요약

target 문서(§5.4 검증자 2종 등재 + 역할 경계 명문화 + `## Overview` 부수 처분)는 `spec/5-system/2-api-convention.md`(직접 확인, 167~224행)·`spec/conventions/swagger.md`(직접 확인, 447~588행)·`spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md`·`.claude/skills/project-planner/SKILL.md` 등 인용한 문서의 실제 내용과 대조했을 때 **기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 사례가 없다**. `code:` 등재 위치를 "규칙 소유자(2-api-convention.md)" 로 정한 것과 리네임을 하지 않기로 한 것 모두 target 자신이 새 `## Rationale` 항목으로 근거·기각 대안을 명시했고, 인용한 과거 판단(review-citations.md 의 준수-예시 예외, 이전 라운드 checker 의 리네임 비용 발언, project-planner/SKILL.md 의 3섹션/`_product-overview.md` 규칙)은 실제 문서와 대조해 정확했다. 유일한 흠은 절차적인 것으로, 이번 검토에 전달된 입력 번들이 `spec/conventions/` 트리를 통째로 빠뜨려 `swagger.md` 자신의 Rationale 을 자동으로 대조하지 못했다는 점이며, 이는 직접 파일을 읽어 보완했다(충돌 없음 확인).

## 위험도

NONE
