# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-review-citations-class-jsdoc.md`

## 발견사항

- **[WARNING]** draft 본문이 project-planner 워크플로가 요구하는 자체 `## Rationale` 섹션 없이 끝난다
  - target 위치: 문서 전체 구조 — `## 실측`(L17) → `## 변경안`(L31) → `## 구현 위임`(L67)으로 종료. 최상위 `## Rationale` 헤딩이 없다
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3항 — *"`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. **본문 끝에 `## Rationale` 로 결정 근거 명시**"*, 그리고 4항 — *"BLOCK: NO + Warning → `## Rationale` 에 노트 남기고 진행"*
  - 상세: 같은 유형의 선행 draft 인 `plan/in-progress/spec-draft-nullable-notation-followups.md`(L6354 `## Rationale`)와 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(L375 `## Rationale`)는 모두 draft 자신의 최상위 `## Rationale` 섹션으로 끝난다. 이 target 문서에는 (A)/(B) 두 방향을 비교하는 근거 있는 논의(L52-64)가 있지만, 그것은 **`spec/conventions/review-citations.md` 에 삽입될 인용문(blockquote) 안**에 있는 것이지 draft 자신의 최상위 섹션이 아니다. SKILL.md 4항이 정한 "`--spec` 리뷰가 Warning 을 내면 그 노트를 `## Rationale` 에 남긴다"는 다음 단계를 수행할 자리가 문서에 없다.
  - 제안: 문서 끝에 draft 고유의 `## Rationale` 섹션을 추가한다 — 예: 이 라운드의 `--spec` 검토(WARNING들)에 대한 대응 노트를 여기 적고, "왜 (A) 대신 (B) 를 택했는가"의 draft-레벨 요약(스펙 삽입문과 별개로, 이 세션의 판단 과정으로서)을 남긴다.

- **[WARNING]** `spec/conventions/swagger.md` §3 의 동일한 과잉일반화 문장이 spec_impact 밖에 남는다
  - target 위치: L37, L41 — `[swagger.md §3](./swagger.md)` 인용은 그대로 유지, `spec_impact`(frontmatter L5-6)는 `spec/conventions/review-citations.md` 하나만 선언
  - 위반 규약: `spec/conventions/swagger.md` §3 (L355-367) — *"플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다... 즉 **DTO 의 `/** ... */` 는 API 소비자가 읽는 문장이다**"*. 이 문장은 필드/클래스를 가르지 않은 채 "DTO 의 JSDoc" 전체에 대해 그대로 성립한다고 말한다
  - 상세: 이 draft 의 실측(L19-25)이 정확히 반증하는 것이 이 문장이다 — 클래스 JSDoc 은 `_OPENAPI_METADATA_FACTORY` 에 실리지 않는다. `review-citations.md §3` 과 가드 헤더 주석(`dto-jsdoc-citation.spec.ts` L15-16: *"DTO 의 JSDoc 은 `introspectComments` 로 **공개 OpenAPI `description`** 이 된다 (`swagger.md §3`)"*) 둘 다 이 swagger.md §3 문장을 근거로 인용한다. 이 draft 는 review-citations.md 와 가드 헤더 주석(구현 위임, L67-70)은 갈라 고치면서, 두 곳이 공통으로 인용하는 **원본 근거 문장(swagger.md §3)** 자체는 건드리지 않는다 — 착수 스코프를 "선행 트래커가 남긴 질문"(review-citations.md §3 표)으로 의도적으로 좁혔기 때문(L14)이지만, 그 결과 PR 이 머지된 뒤에도 swagger.md §3 는 여전히 "DTO 의 `/** ... */`"를 필드/클래스 구분 없이 공개 문서로 나간다고 말하는 상태로 남는다.
  - 제안: `spec_impact` 에 `spec/conventions/swagger.md` 를 추가하고 §3 문장에 "(DTO **필드**: swagger CLI 플러그인이 프로퍼티별 `description` 으로 싣는다 — 클래스 JSDoc 은 실리지 않는다. `review-citations.md §3` 참고)" 같은 한정을 붙이거나, 스코프를 의도적으로 좁힌 것이라면 그 사실과 "다음에 swagger.md 를 건드릴 때 함께 맞춘다"는 §4 원칙 적용을 Rationale 에 명시적으로 적어 둔다.

- **[INFO]** 새 행의 "규약 적용" 칸이 표의 기존 테르스(terse) 값 관행과 어긋난다
  - target 위치: L42 — `| **응답 DTO 클래스의 ...** | **대상 아님 — 필드와 같이 쓰지 않는다** | ... |`
  - 위반 규약: `spec/conventions/review-citations.md` §3 표(원본) — 같은 칸의 다른 모든 행은 `적용` 또는 `대상 아님` 두 값 중 하나만 쓰고, 이유는 세 번째 칸("이유")에 둔다
  - 상세: 새 행만 두 번째 칸에 `— 필드와 같이 쓰지 않는다` 라는 부가 설명을 덧붙여, 그 칸을 열거형 값이 아니라 짧은 산문으로 만든다. 같은 설명이 세 번째 칸에도 이미 나온다("그래도 필드 행과 같은 규칙을 둔다").
  - 제안: 두 번째 칸은 `**대상 아님**` 으로 통일하고, "필드와 같이 쓰지 않는다"는 근거는 세 번째 칸에만 남긴다. (사소한 서식 제안 — 채택 여부는 자유)

## 요약

본 draft 는 review-citations.md §3 표의 DTO 행을 필드/클래스로 가르는 실측·변경안·구현 위임을 담고 있고, frontmatter 3필드(`worktree`/`started`/`owner`)·`spec_impact` 리스트 형식·앵커 링크(`#3--...`)·가드 헤더 인용 등 검증 가능한 항목들은 모두 규약과 정확히 일치한다(직접 대조 확인). 다만 project-planner SKILL.md 가 명시하는 draft 자체의 최상위 `## Rationale` 섹션이 빠져 있어 이후 `--spec` 라운드의 Warning 노트를 남길 자리가 없고, 이 draft 가 고치는 것과 같은 근거 문장이 `swagger.md §3` 에도 그대로 남아 있어(review-citations.md·가드 헤더 둘 다 그 문장을 인용) 스코프를 좁힌 결과로 상위 SoT 는 여전히 부정확한 상태로 남는다. 둘 다 BLOCK 수준(CRITICAL)은 아니며, 채택 전 draft 에 반영하거나 최소한 Rationale 에 의도적 유예로 기록하는 것을 권한다.

## 위험도

LOW
