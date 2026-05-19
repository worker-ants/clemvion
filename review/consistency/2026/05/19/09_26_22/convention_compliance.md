# 정식 규약 준수 Check — convention_compliance

대상: `plan/in-progress/requiredwhen-dsl-whitelist.md`
검토 모드: plan draft 검토 (--plan)

---

### 발견사항

- **[INFO]** plan 문서 파일명이 규약 위치 컨벤션에 적합함 (확인)
  - target 위치: frontmatter + 파일 경로
  - 위반 규약: CLAUDE.md §명명 컨벤션 `plan/in-progress/<name>.md`
  - 상세: `plan/in-progress/requiredwhen-dsl-whitelist.md` 로 평문 파일명을 사용하고 있으며 `plan/in-progress/` 하위에 위치함. 규약에서 요구하는 패턴과 정확히 일치. frontmatter 에 `worktree`, `started`, `owner` 세 필드가 모두 존재하고 형식도 규약 준수. 위반 없음.
  - 제안: 해당 없음 (준수).

- **[INFO]** 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 대상 아님 (확인)
  - target 위치: 문서 전체 구조
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 (3섹션 권장)
  - 상세: 3섹션(Overview / 본문 / Rationale) 권장은 `spec/<영역>/N-name.md` 형식 문서에 적용되는 규약이며, `plan/in-progress/` 문서에는 해당되지 않는다. plan 문서는 별도 라이프사이클 규칙을 따름. 위반 없음.
  - 제안: 해당 없음 (plan 문서에는 적용 불가).

- **[INFO]** spec 갱신 항목 — spec 파일명 패턴 적합성 (확인)
  - target 위치: `## 작업 항목` 중 spec 갱신 항목 (`spec/4-nodes/1-logic/2-switch.md`)
  - 위반 규약: CLAUDE.md §명명 컨벤션 `spec/<영역>/N-name.md` (`0-` prefix 패턴 등)
  - 상세: 작업 항목에서 언급되는 `spec/4-nodes/1-logic/2-switch.md` 는 숫자 prefix(`2-`) 패턴을 준수하는 정상 파일이다. plan 문서 안에서 이 경로를 참조하는 것은 규약 위반이 아님. 위반 없음.
  - 제안: 해당 없음 (준수).

- **[WARNING]** 마이그레이션 항목 — `equals: ['value']` 단일 원소 배열의 의미 명확성
  - target 위치: `## 작업 항목` 5번째 항목 (`switch.schema.ts:85` 마이그레이션)
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 (NodeHandlerOutput 의 필드 의미 동일성) — 직접 위반은 아니나, DSL 시그니처 변경이 기존 단일값·배열 동작을 하나로 통합하는 구조 변경임을 plan 에서 충분히 명시하지 않음.
  - 상세: `notEquals: 'expression'` → `equals: ['value']` 로 변환할 때, 기존 `{ field, oneOf: [...] }` 와의 의미 중복 관계가 plan 에는 "단순화를 위해 deprecate" 한 줄로만 처리되어 있다. `equals` 배열이 화이트리스트 의미를 가진다는 DSL 확장 규칙이 spec 문서(`spec/4-nodes/1-logic/2-switch.md` §8 Rationale 신설)에만 기술될 예정이며, plan 자체에서는 "새 DSL 의 평가 규칙" 요약이 없다. spec 없이 plan 만 보면 `equals: ['value', 'range']` 와 `equals: 'value'` 가 의미상 어떻게 다른지 추적 불가.
  - 제안: plan 의 `## 결정` 섹션 또는 `## 배경` 말미에 새 DSL 의 평가 규칙(단일값: 동등비교, 배열: 화이트리스트 포함 여부)을 한두 줄로 요약 추가. spec §8 Rationale 에 이미 기술 예정이라면 이 제안은 선택적.

- **[INFO]** 관련 문서 링크 — 상대 경로 형식 (확인)
  - target 위치: `## 관련 문서` 섹션
  - 위반 규약: CLAUDE.md §명명 컨벤션 (경로 표기)
  - 상세: `[node-config-required-defaults-sweep](./node-config-required-defaults-sweep.md)` 형태의 상대 경로 링크는 동일 `plan/in-progress/` 내 문서를 참조하는 통상적 방식으로, 규약에서 특별히 금지하는 형식이 아님. 위반 없음.
  - 제안: 해당 없음.

- **[INFO]** 미완 항목 상태 — `in-progress/` 유지 적합성 (확인)
  - target 위치: `## 작업 항목` 하단 미체크 항목 (`[ ] consistency-check 통과` 외 4건)
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 분류 기준
  - 상세: 미체크 체크박스가 4건 존재하므로 `plan/in-progress/` 에 두는 것이 정확히 규약을 준수함. `plan/complete/` 로 이동 전 조건 미달. 위반 없음.
  - 제안: 해당 없음.

---

### 요약

`plan/in-progress/requiredwhen-dsl-whitelist.md` 는 CLAUDE.md 및 `spec/conventions/` 의 정식 규약을 전반적으로 준수하고 있다. frontmatter 3 필드(`worktree`, `started`, `owner`) 완비, 파일 위치·명명 패턴 정확, 미완 항목이 남아 `in-progress/` 에 위치하는 것도 적합하다. 유일한 개선 여지는 WARNING 1건으로, 새 DSL 의 평가 규칙(단일값 vs 배열 화이트리스트)이 plan 문서 자체에 간략히 요약되어 있지 않아 plan 만으로는 DSL 의도를 파악하기 어렵다는 점이다. 이 사항은 spec §8 Rationale 에 이미 기술 예정이므로 CRITICAL 위반은 없다.

### 위험도

LOW
