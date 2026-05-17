# Convention Compliance Check

**검토 대상**: `plan/in-progress/spec-draft-cafe24-call-401-retry.md`
**검토 모드**: spec draft (--spec)
**검토 시점**: 2026-05-17

---

### 발견사항

- **[INFO]** plan 문서에 `type` frontmatter 필드 사용
  - target 위치: frontmatter (line 4)
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — frontmatter 필수 필드 정의
  - 상세: CLAUDE.md 가 규정한 `plan/in-progress/<name>.md` frontmatter 필수 키는 `worktree`, `started`, `owner` 세 가지다. 본 draft 의 `type: spec-draft` 는 규약에 명시되지 않은 추가 필드다. 자체적으로 추가한 것은 허용 여지가 있으나, 공식 컨벤션에 등재된 필드가 아니므로 다른 툴(예: plan_coherence checker)이 이 필드를 인식하지 않을 수 있다.
  - 제안: `type` 필드를 제거하거나, CLAUDE.md frontmatter 정의에 선택적 필드로 추가하는 규약 갱신을 검토.

- **[INFO]** draft 문서 위치가 `plan/in-progress/` 이나 spec draft 성격이 `spec/` 영역과 경계 혼재
  - target 위치: 문서 전체 성격
  - 위반 규약: `CLAUDE.md` §정보 저장 위치 — 기술 명세(스펙)는 `spec/<영역>/*.md`
  - 상세: 본 문서는 spec 본문의 "변경 전/후" 내용을 담은 draft 이며, consistency-check 통과 후 즉시 실제 spec 파일들에 반영하는 구조다. CLAUDE.md 에는 이런 spec draft 를 plan/에 두는 패턴이 명시적으로 허용·금지된 규정이 없다. 다만 `/consistency-check --spec` 의 입력 매체로 plan 문서를 사용하는 것은 현재 세션 경로(`_prompts/convention_compliance.md`)에서 orchestrator 가 생성한 방식과 부합한다.
  - 제안: 현재 패턴은 운영상 문제 없음. 단, 규약에 "spec draft 는 plan/in-progress/ 에 type: spec-draft 로 둘 수 있다"는 설명이 추가되면 혼동이 줄어든다 (INFO 수준 개선).

- **[INFO]** 변경 4 의 Rationale 절 제목 안 backtick 이 markdown 파싱 문맥에서 불안정
  - target 위치: "변경 4" 섹션 — `### `call()` 의 401 자동 회복 (2026-05-17)``
  - 위반 규약: 없음 (구조적 규약 위반은 아님). 다만 `spec/` 문서의 실제 반영 시 `## Rationale` 섹션 하위 헤딩으로 들어갈 때 markdown 파서가 헤딩 문자열 내 backtick 을 처리하는 방식이 렌더러마다 다를 수 있다.
  - 상세: `### \`call()\` 의 401 자동 회복 (2026-05-17)` 형태는 GitHub 등 대부분의 렌더러에서 정상 렌더되지만, 일부 파서에서 anchor 생성 시 backtick 이 포함되어 내부 링크 참조가 깨질 수 있다. draft 내 자기 참조 링크(`[Rationale의 "call() 의 401 자동 회복 (2026-05-17)"](#rationale)`)는 이 헤딩을 anchor 로 가리키지 않고 `#rationale` 를 단순 가리키므로 실제 문제 없음.
  - 제안: spec 실 반영 시 헤딩을 `### call() 의 401 자동 회복 (2026-05-17)` 으로 backtick 없이 쓰거나 현 형태 유지 — 기능상 차이 없음.

- **[INFO]** `spec/conventions/cafe24-api-metadata.md` §5 절차 step 5 에 `restricted` catalog 컬럼 값으로 `op` 가 남아있는 참조 오류 (draft 문서 내)
  - target 위치: "영향받는 다른 문서" 섹션 — `spec/conventions/cafe24-api-metadata.md` 를 "변경 없음" 으로 처리한 부분
  - 위반 규약: `spec/conventions/cafe24-api-metadata.md` §5 step 5 — `restricted` 컬럼 값을 `scope` / `op` 로 기술한 부분이 2026-05-17 drift fix 에서 `operation` 으로 통일됐음
  - 상세: draft 가 "변경 없음" 으로 처리한 `spec/conventions/cafe24-api-metadata.md` 는 이미 최신화되었으며, draft 가 직접 이 파일을 수정하지 않으므로 실질적 위반은 없다. 그러나 draft 의 "영향받는 다른 문서" 목록에서 `cafe24-api-metadata.md` 를 "메타데이터 row 형식 무관" 으로 dismissal 한 점은 정확하다 — 401 자가 회복 정책은 metadata row 형식 자체를 변경하지 않으므로 올바른 평가다.
  - 제안: 현재 draft 기술이 정확함. 변경 없음 표기 유지.

---

### 요약

`plan/in-progress/spec-draft-cafe24-call-401-retry.md` 는 정식 규약(`spec/conventions/**`, CLAUDE.md) 을 전반적으로 잘 준수하고 있다. 파일 위치(plan/in-progress/)와 frontmatter 필수 3필드(`worktree`, `started`, `owner`) 모두 충족한다. 변경 대상 4개 spec 위치(Cafe24 §6.1, MCP Client §8.4, 통합 §10.5, Rationale)는 각각 올바른 파일 경로와 섹션 번호를 참조하며, 에러 코드(`CAFE24_AUTH_FAILED`) 는 `UPPER_SNAKE_CASE` 규약(node-output.md Principle 3.2)을 준수한다. `output.error.code`, `port: 'error'`, `Integration.status` 전이 패턴도 node-output.md 의 에러 컨트랙트(Principle 3) 를 따른다. CRITICAL 또는 WARNING 수준의 위반은 발견되지 않았으며, 발견된 4건은 모두 INFO 수준의 형식 일관성 제안이다.

### 위험도

NONE
