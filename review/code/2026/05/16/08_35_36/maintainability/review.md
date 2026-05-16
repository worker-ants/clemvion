# 유지보수성(Maintainability) 리뷰

리뷰 대상: `frontend/src/content/docs/02-nodes/ai.en.mdx`, `ai.mdx`, `integrations.en.mdx`, `integrations.mdx`, `overview.en.mdx`, `overview.mdx`, `04-expression-language/variables-and-context.en.mdx`, `variables-and-context.mdx`, `plan/in-progress/user-guide-sync-2026-05-16.md`, `review/consistency/2026/05/16/08_22_34/SUMMARY.md`, `review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md`

---

### 발견사항

- **[INFO]** 한국어/영문 MDX 쌍(ai.mdx + ai.en.mdx, integrations.mdx + integrations.en.mdx 등)의 섹션 제목이 영문으로 통일(`### Conversation Context`, `### Example`, `### Fields`, `### Ports`)되어 있음
  - 위치: `ai.mdx` 111행 `### Conversation Context`, `integrations.mdx` 238행 `## Cafe24`, 245행 `### 언제 쓰나요?` 등
  - 상세: `ai.en.mdx` 에는 `### Example`, `integrations.en.mdx` 에는 `### Fields` / `### Ports` / `### Example` 이 영문이고, 대응하는 `ai.mdx` / `integrations.mdx` 에도 일부는 한국어(`### 예시`, `### 필드`, `### 포트`), 일부는 영문(`### Conversation Context`)이 혼재한다. `### Conversation Context` 는 한/영 두 파일 모두 동일하게 영문으로 두어 일관성이 깨지지 않으나, 다른 섹션은 한국어 버전에서 한국어 제목을 사용해 패턴이 유지되어 있다. `## Cafe24` 섹션 제목은 고유명사이므로 문제 없음.
  - 제안: 규칙을 명시적으로 확정하거나(`Conversation Context` 는 제품 용어이므로 영문 유지 가능), 향후 신규 섹션 추가 시 한국어 파일에는 한국어 제목을 쓴다는 기준을 문서화한다.

- **[INFO]** `ai.mdx`의 `### Conversation Context` 섹션에서 `contextScope: none`, `contextScope: thread` 등의 코드 리터럴 표기에 backtick inline code 스타일이 일관되게 사용되지 않음
  - 위치: `ai.mdx` 115행 — `` `contextScope: none` `` (backtick 있음), 동일 문단 안 ``{{ $thread.text }}`` 도 backtick 사용. 전반적으로 일관된 편이나, FieldTable `description` 필드 내 문자열에서는 backtick 없이 영문 그대로 표기된 부분이 있음(파일 99~103행 description 속성값 내).
  - 상세: MDX FieldTable의 `description` 속성 값은 JSX 문자열이라 내부에 backtick Markdown이 동작하지 않을 수 있어 의도적 선택일 수 있으나, 기존 다른 FieldTable description 행들의 처리 방식과 비교할 때 혼재 여지가 있다.
  - 제안: FieldTable description 내 코드 리터럴 표기 방식(backtick vs. 일반 문자열)에 대한 기존 패턴을 확인하고 신규 행도 이를 따른다.

- **[INFO]** `integrations.en.mdx` 의 Cafe24 Example 블록 내 `shop_no: 1` 이 하드코딩된 숫자 리터럴
  - 위치: `integrations.en.mdx` 185행, `integrations.mdx` 270행 `shop_no: 1`
  - 상세: 사용자 가이드 예시 코드에서 `shop_no: 1`은 문서 목적상 의도적 상수(Cafe24 기본 상점 번호). 그러나 독자가 값의 의미를 파악하기 어려울 수 있다. 한국어 버전에도 동일하게 주석 없이 1이 사용됨.
  - 제안: 예시 코드 내 주석으로 `// 기본 상점(shop_no 기본값=1)` 또는 영문 `// default shop` 을 추가하면 독자가 값의 의미를 즉시 알 수 있다.

- **[INFO]** `integrations.en.mdx` vs `integrations.mdx` 의 pagination 예시 값 일관성
  - 위치: `integrations.en.mdx` 187행, `integrations.mdx` 272행 `pagination: { limit: 50, offset: 0 }`
  - 상세: 양 파일 모두 동일한 값. 매직 넘버 50/0 자체는 페이지네이션 예시로 직관적이고 일관성 있으나, Cafe24 API의 실제 최대 `limit` 값(100)과 다르다는 점을 독자가 혼동할 수 있다.
  - 제안: 현 상태 유지 가능. 단, `max_limit` 제약이 있다면 FieldTable description 이나 Callout 에 언급하면 유지보수성 개선.

- **[WARNING]** `variables-and-context.en.mdx`와 `variables-and-context.mdx`의 `$thread` 섹션 구조가 내용상 동등하나 일부 세부 표현이 분기됨 — 두 파일을 동기화하는 기준이 불명확
  - 위치: `variables-and-context.en.mdx` 371~403행, `variables-and-context.mdx` 437~471행
  - 상세: 두 섹션은 구조와 예시가 거의 동일하지만, Callout 내 설명 문장의 세부 표현이 다르다. 예를 들어 영문 버전의 `"Compute it once and stash the result in a variable."` 과 한국어 버전의 `"한 번만 가공해서 변수에 담아 두는 패턴을 권장해요."` 는 내용은 같으나 문장 구성이 다르다. 현재는 허용 가능 수준이나, 향후 내용이 많아지면 한/영 파일 간 drift가 발생할 가능성이 높다.
  - 제안: 한/영 파일 쌍이 늘어날수록 단일 진실 구조(예: MDX 컴포넌트를 통한 데이터 주입 방식)를 도입하거나, 최소한 PR 체크리스트에 "한/영 대응 파일 동시 수정 확인"을 명시한다. 단기적으로는 현 방식 유지 가능.

- **[INFO]** `plan/in-progress/user-guide-sync-2026-05-16.md` 에서 "후속(spec 갱신 위임)" 섹션에 `project-planner` 호출이 필요한 항목 목록이 있으나, 실제 위임 상태(완료/미완료)에 대한 추적 체크박스가 없음
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` 523~533행
  - 상세: plan 본문의 주 체크리스트(`## 체크리스트`)는 완료 체크가 모두 `[x]` 상태이나, "후속(spec 갱신 위임)" 섹션의 spec 수정 위임 항목들은 텍스트 나열로만 되어 있고 체크박스가 없다. CLAUDE.md 의 plan 라이프사이클 분류 기준상 "미해결 follow-up 항목이 하나라도 있으면 `in-progress/`"에 해당하므로 현재 `in-progress/`에 있는 것이 맞으나, 위임 항목들의 완료 여부를 체크박스로 추적하지 않으면 완료 시점을 판단하기 어렵다.
  - 제안: 후속 위임 항목들을 `[ ]` 체크박스로 변환하여 완료 시 `[x]`로 체크하고, 모든 항목이 완료된 후 `plan/complete/`로 이동할 수 있도록 명시한다.

- **[INFO]** `ai.mdx`(한국어)와 `ai.en.mdx`(영문)의 `contextScopeN` 기본값 표기에 미세한 일관성 차이
  - 위치: `ai.mdx` 100행 `default: "20"`, `ai.en.mdx` 38행 `default: "20"`
  - 상세: 두 파일 모두 동일하게 `"20"` 으로 표기되어 있고 `contextScope: lastN` 섹션 본문에서도 `contextScopeN` 개(기본 20)으로 언급하여 일관성이 유지되고 있다. 문제 없음.
  - 제안: 현 상태 유지.

---

### 요약

이번 변경은 사용자 가이드 MDX 파일 8개와 plan/review 파일 3개를 포함하는 문서 정합성 보강 작업이다. 문서 코드 자체는 전반적으로 기존 패턴(FieldTable, Example, Callout 컴포넌트 활용)을 잘 따르고 있으며, 한/영 대응 파일 쌍의 내용이 실질적으로 동등하게 유지된다. 주요 유지보수성 리스크는 한/영 MDX 파일 쌍 간 장기 drift 가능성(WARNING 1건)과, plan 내 spec 위임 항목의 추적 체크박스 부재(INFO 1건)이다. 섹션 제목의 한/영 혼재(한국어 파일 내 `### Conversation Context` 영문 유지)는 제품 용어 성격으로 수용 가능하나 명시적 기준 문서화가 권장된다. 매직 넘버(`shop_no: 1`, pagination 값)는 예시 코드 맥락에서 직관적이므로 CRITICAL/WARNING 수준은 아니나, 주석 보완으로 독자 경험을 개선할 수 있다. 전체적으로 기존 코드베이스 스타일과 패턴을 잘 준수한 변경이다.

### 위험도

LOW
