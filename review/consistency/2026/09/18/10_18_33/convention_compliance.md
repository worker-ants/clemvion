### 발견사항

- **[CRITICAL]** C10 이 삽입할 새 문장의 자기참조 앵커가 깨져 있다 (`#r-5-…`)
  - target 위치: `plan/in-progress/spec-draft-deletion-release-current-tense.md` §"변경안 > C10" — `spec/conventions/spec-impl-evidence.md §3.1` 에 추가할 하위 불릿 마지막 줄, `([R-5](#r-5-…))`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` (in-repo `[..](path)`/`#anchor` 링크는 실제 렌더러(`rehype-slug`+`github-slugger`) 슬러그와 일치해야 build 차단)
  - 상세: 이 줄은 기존 텍스트를 인용하며 생략 부호로 축약한 다른 "…" 용례(예: L33·L96·L101·L102)와 달리, **신규로 작성해 파일에 그대로 삽입할 문장**이다. `…`는 실제 앵커 슬러그가 아니라 미완성 placeholder로 남아 있다. 저장소의 `github-slugger`로 R-5 실제 제목(`### R-5. \`status: partial\` 의 \`pending_plans:\` 의무화 — plan 라이프사이클 역방향 강제`)을 슬러그화하면 `r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제` 가 나온다(같은 문서의 기존 참조 `[R-9](#r-9-42-지식저장소plan-무결성-가드--별도-family-신설-근거)` 로 슬러그 규칙을 교차검증함). C10 을 이 문구 그대로 `spec/conventions/spec-impl-evidence.md` 에 반영하면 `spec-link-integrity.test.ts` 가 앵커 미존재로 build 를 깬다 — 이 가드는 바로 이 컨벤션 문서 자신의 §4.2 가 규정한 것이라, 이 문서를 개정하는 변경안이 그 문서의 규약을 스스로 위반하게 된다.
  - 제안: C10 텍스트의 `([R-5](#r-5-…))` 를 `([R-5](#r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제))` 로 교체. (참고: 다른 "…" 는 기존 문구를 인용·축약하는 것이라 그대로 두어도 무방 — 이 한 곳만 신규 삽입 콘텐츠임에 유의.)

- **[INFO]** §3.1 하위 불릿의 중첩 레벨 표기가 모호함
  - target 위치: C10 — "§3.1 `partial → implemented` 불릿 **아래**에 하위 불릿 하나" 지시문과 그 예시 블록
  - 위반 규약: 직접 규약 위반은 아님. `spec/conventions/spec-impl-evidence.md §3.1` 은 현재 flat 불릿 리스트(중첩 없음)이며, 이번이 첫 중첩 사례가 됨
  - 상세: "하위 불릿"이라는 표현이 실제 파일에 들어갈 때 `partial → implemented` 불릿 아래로 들여쓰기된 자식 불릿인지, 그냥 다음 줄의 동일 레벨 불릿인지 diff 적용 시점에 판단이 필요하다. 예시 코드블록 자체는 들여쓰기 없이 최상위 `- **...**` 로 시작해 지시문(하위/자식)과 예시 형태가 어긋난다.
  - 제안: 실제 반영 시 2-space 들여쓰기로 `partial → implemented` 불릿의 자식으로 명시하거나, 지시문을 "바로 다음 줄에 별도 최상위 불릿으로 추가"로 명확히 할 것.

- **[INFO]** 신규 결정을 기존 R-5 에 덧붙임 (신규 번호 미부여)
  - target 위치: C10 — "`## Rationale` R-5 끝에 한 문단" 추가
  - 위반 규약: 명시적 금지 규약은 없음 (스타일 제안)
  - 상세: `spec-impl-evidence.md` 의 Rationale 은 R-1~R-10 까지 "결정 하나당 번호 하나" 패턴을 유지해 왔다(R-8/R-9 도 각각 독립 신설). 이번 결정("공유 트래커의 승격 판정 시점")은 R-5(`pending_plans:` 의무화 자체)와 논지가 인접하지만, 판정 술어·가드 사각지대라는 **새로운 불변식**을 도입하는 점에서 R-9 류의 독립 신설과 성격이 더 가깝다.
  - 제안: 현행대로 R-5 말미에 붙여도 무방하나, 검색성을 위해 별도 `R-11` 로 분리하는 안도 고려할 것(필수는 아님).

### 요약
검토 대상 plan draft(`spec-draft-deletion-release-current-tense.md`)는 `spec-impl-evidence.md` 의 frontmatter 스키마(§2)·상태 전이(§3)·`code:` 인라인 주석 허용 규칙(§2.1, 2026-09-06 이후)을 정확히 따르고 있고, `spec_impact` 8개 경로 전부 실존하며, 본문에서 재사용하는 앵커(`#43-cascade-동작` 등)도 실제 헤딩 슬러그와 일치한다. `secret-store.md` 를 `implemented` 로 승격하면서 `pending_plans` 를 제거하는 처리(C7)는 build 가드(`spec-status-lifecycle.test.ts`)가 이 방향을 강제하지 않음을 실제 가드 소스로 확인했고, 그 가드 사각지대를 C10 으로 컨벤션에 명문화하는 처리 방식도 절차적으로 타당하다. 다만 C10 이 신규 삽입할 자기참조 앵커(`#r-5-…`)가 placeholder 상태로 남아 있어, 이 변경안이 그대로 `spec/conventions/spec-impl-evidence.md` 에 반영되면 그 문서 자신이 규정한 `spec-link-integrity.test.ts` 를 위반해 build 를 깬다 — 반영 전 반드시 정정이 필요한 단일 CRITICAL 결함이다.

### 위험도
MEDIUM
