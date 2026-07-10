# 정식 규약 준수 검토 — table-label-eval-vars

target: `plan/in-progress/table-label-eval-vars.md` (spec draft, `--spec` 모드)
대상 spec 변경: `spec/4-nodes/6-presentation/2-table.md` / `spec/5-system/5-expression-language.md`

## 발견사항

- **[INFO]** Rationale 서브헤딩에 em dash(`—`) 사용 — 압도적 다수 관행은 마침표(`R-N.`)
  - target 위치: "변경 1 — `spec/4-nodes/6-presentation/2-table.md`" §1c, 신설 예정 `### R-1 — §1 라벨 per-item 변수 서술 정정 (번복 아님)`
  - 위반 규약: 명문화된 `spec/conventions/*` 항목은 아니지만, `spec/` 트리 전역에서 `### R-N.` (마침표) 헤딩이 74건, `### R-N —` (em dash) 헤딩은 0건으로 사실상 만장일치 관행 (`grep -rhn '^### R-[0-9]' spec/` 로 확인). 같은 폴더(`spec/4-nodes/6-presentation/`)의 직접 이웃 문서인 `1-carousel.md`(`### R-1. \`layout\` 렌더...`)와 `5-template.md`(`### R-1. 캔버스 요약...`)도 동일 마침표 스타일이며, 본 컨벤션의 SoT 문서인 `spec/conventions/spec-impl-evidence.md` 자신도 `### R-1. \`code:\` 글로브...` 로 마침표를 쓴다.
  - 상세: 기능·가드에 영향 없는 순수 표기 스타일 차이이나, 같은 폴더 내 유일하게 다른 구두점을 쓰게 되어 국지적 일관성이 깨진다.
  - 제안: `### R-1 — §1 라벨 per-item 변수 서술 정정 (번복 아님)` → `### R-1. §1 라벨 per-item 변수 서술 정정 (번복 아님)` 로 마침표 스타일 통일.

- **[INFO]** `workflow-list.md` "R-4" 인용이 대상 문서의 실제 헤딩 표기와 불일치
  - target 위치: 신설 예정 `## Rationale` 본문, "...결정의 *번복*이 아니라 최초 *확정*이다(cf. `2-navigation/1-workflow-list.md` R-4)."
  - 위반 규약: 명문 규약은 아니고 cross-reference 정확성 문제. `spec/2-navigation/1-workflow-list.md` 의 Rationale 섹션은 `### R-1./R-2./...` 형식이 아니라 번호만 있는 `### 1.`/`### 2.`/`### 3.`/`### 4. 태그 필터는 단일 free-text 로 하향` 형식이다 — 문서 안에 "R-4" 라는 리터럴 헤딩이 존재하지 않는다.
  - 상세: 인용이 markdown 링크(`[..](path#anchor)`)가 아니라 코드 서식 텍스트라 `spec-link-integrity` 빌드 가드는 걸리지 않지만, 향후 독자가 해당 문서에서 "R-4" 헤딩을 찾으면 못 찾는다.
  - 제안: `2-navigation/1-workflow-list.md §Rationale 4번 항목("태그 필터는 단일 free-text 로 하향")` 처럼 실제 헤딩 텍스트를 인용하거나, 최소한 "R-4" 대신 "§Rationale-4" 등 해당 문서 표기와 일치하는 표현으로 수정.

## 확인했으나 문제 없음 (참고)

- plan frontmatter: `worktree`/`started`(ISO)/`owner` 3필드 모두 존재, `owner: project-planner` 는 다른 in-progress plan(`chat-channel-visual-ssr-png.md` 등)에도 쓰이는 기존 값 — `plan-frontmatter.test.ts` 요건 충족.
- `spec_impact` 두 경로(`spec/4-nodes/6-presentation/2-table.md`, `spec/5-system/5-expression-language.md`) 모두 실존 파일 — Gate C 요건(완료 시점) 을 미리 충족.
- 변경 2a/2b 의 Before 인용문이 현재 `spec/5-system/5-expression-language.md` L185, L497 원문과 정확히 일치.
- 신설 예정 cross-reference(`[Table 노드 §1·§4](../4-nodes/6-presentation/2-table.md)` 등)는 앵커(`#...`) 없이 파일 전체를 가리키는 형태라 `spec-link-integrity` 의 heading-slug 검증 대상이 아니며, 이미 존재하는 `5-expression-language.md:408`(§7.1 자동완성 노트)의 forward reference와 정합해진다.
- `### R-1` prefix 자체(로컬 폴더 관행)·"(번복 아님)" 표기(같은 파일군의 `### R-3 (번복) — ModelConfig...` 선례와 대칭)는 관행에 부합.
- `node-output.md` Principle 1.1(config/output 직교) 등 5필드 output 규약과는 무관한 변경(순수 per-item 표현식 변수 설명 정정)이라 저촉 없음.
- 명명 규약("가용" 컬럼, "셀·라벨"/"셀만" 표기), API 문서 규약(OpenAPI/DTO) 관점은 대상 변경 범위(순수 문서 정정, 코드/API 없음) 밖.

## 요약

target plan 의 spec 정정안은 `spec/conventions/spec-impl-evidence.md`(frontmatter·라이프사이클)와 `node-output.md` 등 실질 규약을 위반하지 않으며, cross-spec 불일치를 근거 있게 정정하는 문서 전용 변경이다. 발견된 2건은 모두 INFO 수준의 표기 일관성 이슈(Rationale 헤딩 구두점 스타일, 타 문서 헤딩 인용 정확도)로 기능·가드에 영향이 없다. 정식 규약 준수 관점에서 차단 사유 없음.

## 위험도

LOW
