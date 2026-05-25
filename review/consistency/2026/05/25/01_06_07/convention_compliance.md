# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-25

---

## 발견사항

### [INFO] plan frontmatter 필수 필드는 모두 충족
- target 위치: frontmatter (lines 1-5)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` frontmatter 스키마
- 상세: `worktree`, `started`, `owner` 세 필드 모두 작성됨. `worktree: workflow-resumable-execution-6b105e`, `started: 2026-05-25`, `owner: resolution-applier` 로 규약 준수.
- 제안: 이상 없음.

---

### [WARNING] 제안된 spec endpoint 경로가 기존 spec 의 endpoint 명명과 불일치
- target 위치: `## 제안 변경 > spec/5-system/4-execution-engine.md §11 step 1 보정` 제안 본문
- 위반 규약: `spec/5-system/2-api-convention.md §2.1 기본 패턴` — `{base_url}/api/{resource}` 및 복수형 명사 규칙
- 상세: 제안된 텍스트에서 endpoint 를 `POST /api/workflows/:id/execute` 로 명시했다. 현재 원본 spec 은 `POST /api/executions/start` 로 표현되어 있다. 두 경로 모두 API convention 의 RESTful 패턴(`{base_url}/api/{resource}/{id}/{action}`) 범주 안에 들어오나, 이 plan 문서가 spec 에 적용할 제안 경로 `POST /api/workflows/:id/execute` 가 실제 구현 코드·기존 spec 표현과 일치하는지 불명확하다. spec 에 이 경로가 없거나 구현이 다른 경로를 사용하고 있다면 spec 개정 후 새 단일 진실로서 혼란이 발생할 수 있다.
- 제안: plan 작성자가 spec 반영 전, 실제 구현 코드의 라우트(`POST /api/workflows/:id/execute` vs `POST /api/executions/start`)를 확인해 spec 제안 경로와 구현 경로가 일치하는지 명시할 것. 불일치 시 API convention §2 의 복수형·케밥케이스 규칙 준수 경로로 통일 후 반영.

---

### [INFO] spec 변경 대상 파일(`spec/1-data-model.md`)은 spec-impl-evidence frontmatter 의무 적용 제외 대상
- target 위치: `## 제안 변경 > spec/1-data-model.md §2.13 error.code 어휘 보완` 섹션
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1 적용 대상` — `spec/1-data-model.md` 는 명시적 제외 목록("단순 overview 성격")에 포함됨
- 상세: `spec/1-data-model.md` 는 spec-impl-evidence 의 frontmatter 의무 대상이 아니므로, 이 문서에 대한 변경은 frontmatter 갱신 부담이 없음. 단, `spec/5-system/4-execution-engine.md` 는 `spec/5-system/**.md` 에 해당되어 frontmatter 의무 대상이다. 현재 그 파일의 `status`가 `spec-only` 이므로 제안 변경 반영 시 별도 `code:` 갱신 의무는 없으나, `spec-only` TTL(90일) 트래킹 대상임을 인지해야 한다.
- 제안: 이상 없음. 다만 `spec/5-system/4-execution-engine.md` 의 frontmatter `status` 상태(현재 `spec-only`, TTL 기준일)를 변경 반영 시 함께 확인 권장.

---

### [WARNING] 에러 코드 shape 참조 표기가 규약 링크 경로와 불일치
- target 위치: `## 제안 변경 > spec/5-system/4-execution-engine.md §11 step 1 보정` 제안 본문 — `[Spec API 규약](./2-api-convention.md)`
- 위반 규약: `spec/5-system/2-api-convention.md §5.3 에러 응답` — 에러 shape 는 `{ "error": { "code": "...", "message": "...", "details": [...] } }` 이며, 제안 본문의 `{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }` 표기는 형식상 일치함. 링크 경로(`./2-api-convention.md`)는 `spec/5-system/` 내 상대경로로 올바름.
- 상세: 에러 shape 자체는 `spec/5-system/2-api-convention.md §5.3` 과 일치한다. 그러나 이 참조 링크는 plan 문서(위치: `plan/in-progress/`) 안에 인라인 markdownlink 로 삽입됐다. plan 문서에서 spec 내부 상대경로 링크를 사용하면 plan 문서를 직접 렌더할 때 링크가 깨진다 (plan 과 spec 이 다른 디렉토리에 있으므로). plan 문서가 제안 내용 초안 용도이므로 크리티컬하지는 않지만, spec 에 실제 반영할 때 링크 경로를 `spec/5-system/` 기준 상대경로로 바꿔야 한다.
- 제안: 링크 자체보다 제안 텍스트가 실제 spec 파일에 붙여질 때 링크 경로가 맞는지(즉 `./2-api-convention.md`) 반영 시 확인 필요. plan 초안 문서 자체의 링크는 현재 용도상 INFO 수준.

---

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 미구성
- target 위치: 문서 전체 구조
- 위반 규약: CLAUDE.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: 본 문서는 `plan/in-progress/` 소속의 작업 추적 문서로, spec 문서(`spec/**`) 가 아니다. 따라서 Overview / 본문 / Rationale 3섹션 권장은 spec 문서에 적용되는 것이며 plan 문서에는 강제되지 않는다. 현재 구성(원본 발견사항 / 현황 분석 / 제안 변경 / 주의사항)은 plan 추적 문서로서 적절하다.
- 제안: 이상 없음. 다만, 이 plan 이 제안하는 spec 본문 변경 텍스트가 실제 spec 에 반영될 때 해당 spec 파일(`spec/5-system/4-execution-engine.md`)이 Overview / 본문 / Rationale 구조를 유지하는지 반영자가 확인해야 한다.

---

### [INFO] `owner: resolution-applier` — 역할 표기 규약 확인
- target 위치: frontmatter `owner` 필드
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — owner 는 `planner / developer / 사용자 본인 등` 예시. `resolution-applier` 는 sub-agent 식별자.
- 상세: plan-lifecycle §4 는 `owner` 예시로 `planner`, `developer`, 사용자 본인 등을 들지만, 규약에서 특정 값을 금지하지는 않는다. `resolution-applier` 는 일관성 검토 resolution sub-agent 를 가리키는 것으로 보이며, 이는 해당 plan 이 자동화 에이전트에 의해 생성됐음을 추적하는 용도로 허용 가능하다. 다만 이 관행을 프로젝트 내에서 명시적으로 정의하지 않았으므로 일관성 확보 차원에서 규약에 `owner` 허용 값 확장을 명시하는 것을 권장한다.
- 제안: 즉각적인 수정 불필요. 향후 plan-lifecycle.md §4 에 `owner: <역할/이름/sub-agent-id>` 로 명시하거나, sub-agent 생성 plan 표기 패턴을 결정 후 규약 갱신.

---

### [WARNING] 제안 본문에 `Phase 1 구현 범위` 주석이 spec 본문에 삽입되는 구조 — spec 문서 의미 오염 우려
- target 위치: `## 제안 변경` 내 step 1 / step 4 제안 텍스트의 blockquote 부분
- 위반 규약: CLAUDE.md 정보 저장 위치 원칙 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- 상세: 제안된 spec 변경 텍스트 안에 `> **Phase 1 구현 범위**: ...` 형태의 blockquote 가 spec 본문(step 1, step 4) 내부에 삽입된다. 이는 구현 범위 한정 메모가 spec 본문 핵심 서술과 같은 레벨에 섞이는 구조다. 규약상 결정의 배경·근거는 spec 문서 끝의 `## Rationale` 섹션에 위치해야 한다. spec 본문 안에 구현 한계를 blockquote 로 삽입하면 미래 독자가 spec 의 의도(본래 requirement)와 현재 구현 한계(Phase 1 제약)를 혼동할 수 있으며, Phase 2 에서 갱신 시 blockquote 제거를 빠뜨릴 위험도 있다.
- 제안: `> Phase 1 구현 범위` 내용을 spec 본문 step 안에 두지 말고, `spec/5-system/4-execution-engine.md` 의 `## Rationale` 섹션(또는 신설)에 "Phase 1 구현 범위 한정 이유"로 이동하거나, `§11` 섹션 마지막에 별도 "구현 범위 노트" 블록으로 분리할 것. 본문 step 자체는 eventual 요구사항(Phase 2 포함한 전체 목표)을 서술하고, 현재 구현 상태는 `## Rationale` 또는 별도 노트로 격리.

---

## 요약

`plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md` 는 plan 문서로서의 frontmatter 규약(`worktree` / `started` / `owner`)을 완전히 준수하고, plan 문서 자체에 요구되지 않는 spec 3섹션 구조 위반도 없다. 주된 규약 거리감은 두 가지다: (1) 제안된 spec 변경 텍스트에서 `POST /api/workflows/:id/execute` 경로가 기존 spec·구현과의 일치 여부가 명시되지 않아 API endpoint 단일 진실 원칙에서 검증이 필요하고, (2) `> Phase 1 구현 범위` blockquote 가 spec 본문 step 안에 삽입되는 구조가 CLAUDE.md 의 "결정 배경은 `## Rationale`" 원칙에 어긋나 spec 의미 오염 및 Phase 2 갱신 시 누락 위험이 있다. 두 항목 모두 spec 반영 전 project-planner 가 `/consistency-check --spec` 검증 시 추가로 확인해야 하며, plan 문서 자체에 이 절차를 명시한 주의사항(마지막 섹션)이 이미 있어 절차 인식은 양호하다.

---

## 위험도

MEDIUM
