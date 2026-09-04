# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-scope-and-anchor-drift.md`

## 검토 범위

target 은 `--spec` 초안 문서로, `spec/5-system/2-api-convention.md`(§5.4·§2.2) ·
`spec/2-navigation/3-schedule.md`(§2.1) · `spec/3-workflow-editor/3-execution.md`(:757) ·
`spec/1-data-model.md`(:474·:562) · `spec/5-system/3-error-handling.md`(§1.4) 에 대한 4건의
변경안(①~④)을 담고 있다. `spec/conventions/error-codes.md`·`swagger.md`·해당 spec 원문을
직접 열어 각 변경안의 인용·서식·용어가 정식 규약과 맞는지 대조했다.

## 발견사항

- **[WARNING]** ④ Rationale 인용 오귀속 — 존재하지 않는 문서에 실제로는 다른 문서의 문장을 귀속
  - target 위치: `## Rationale` → `### ④ 를 "코드를 전부 const 로 옮기기" 로 하지 않은 이유` (본문 259~261행)
  - 위반 규약: CLAUDE.md 문서 구조 규약의 `## Rationale`(결정의 배경·근거) 정확성 요건 + 저장소 관행(`feedback_rationale_rejected_alternatives_need_history` — Rationale 의 "기각된 대안" 근거는 실제 이력이어야 한다)
  - 상세: target 은 *"`spec-conventions-engine-error-code-surface.md` 가 이미 판단을 남겼다 — '이미 타입 앵커가 있어 옮기지 않았다. 옮기면 앵커가 두 개가 된다.'"* 라고 인용부호로 직접 인용한다. 그러나 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 전체를 grep 해도 이 문장은 존재하지 않는다. 실제 원문은 `plan/complete/exec-intake-followups.md:56` — *"셋 다 **이미 타입 앵커가 있다.** 상수로 또 옮기면 앵커가 둘이 되어 갈라진다."* — 로, **다른 plan 문서**다. 인용 출처가 뒤바뀐 상태로 `spec/` Rationale 에 실리면, 이후 `spec-conventions-engine-error-code-surface.md` 를 열어 이 근거를 찾으려는 사람이 못 찾는다.
  - 제안: 인용 출처를 `plan/complete/exec-intake-followups.md:56` 으로 정정하거나, 두 문서 모두 근거로 삼는다면 두 출처를 함께 병기한다.

- **[WARNING]** ③ 변경안(A) 의 표 셀 서식이 GFM 테이블 문법과 어긋남 (적용 시 표 붕괴 위험)
  - target 위치: `## ③ §2.2 — 자원 액션 패턴 성문화` → `### 변경안 (A)` (본문 149~156행)
  - 위반 규약: 문서 출력 포맷 일관성 — 대상 파일 `spec/5-system/2-api-convention.md` §2.2 의 기존 예외 행(53~55행, `spec/5-system/2-api-convention.md` 실측)은 각 행이 **줄바꿈 없이 한 줄**로 작성돼 있어야 파이프 테이블로 렌더링된다(GFM 은 셀 내부 줄바꿈을 지원하지 않음, `<br>` 미사용).
  - 상세: 변경안(A) 블록은 `| **자원 액션**: ...` 로 시작한 뒤 이어지는 4개 줄이 `|` 로 시작하지 않고, 마지막 줄(`` `/executions/:id/stop`, ... ``)도 `|` 로 감싸여 있지 않다. 이 블록을 그대로 §2.2 표에 붙여넣으면 두 번째 줄부터 표 밖 일반 문단으로 렌더링되어 **한 행이 아니라 표가 깨진 문단**이 된다. 기존 세 예외 행(53~55행)은 아무리 길어도 반드시 한 줄로 작성된 실측 선례가 있다.
  - 제안: 변경안(A) 본문을 실제 삽입 시 한 줄(파이프 테이블 규칙 준수)로 합칠 것임을 draft 에 명시하거나, 애초에 한 줄로 제시해 다음 사람이 혼동 없이 그대로 옮길 수 있게 한다.

- **[INFO]** ② 변경안의 데이터 모델 링크에 섹션 앵커 누락
  - target 위치: `## ② \`3-schedule.md\` §2.1` → `### 변경안` (본문 96~99행)
  - 위반 규약: 문서 구조 규약 — 같은 문서(`spec/2-navigation/3-schedule.md:18`)의 기존 선례는 `[데이터 모델 - Schedule](../1-data-model.md#29-schedule)` 처럼 대상 섹션 앵커(`#29-schedule`)를 포함한다.
  - 상세: target 이 제안하는 교체 문구는 `([데이터 모델 §2.9](../1-data-model.md))` 로 앵커 프래그먼트가 빠져 있다. 이대로 적용하면 링크가 `1-data-model.md` 최상단으로만 이동하고 §2.9(Schedule, 실제 헤딩은 `### 2.9 Schedule`)로 바로 스크롤되지 않는다. 같은 문서 18행이 이미 정확한 앵커 형식(`#29-schedule`)의 선례다.
  - 제안: `[데이터 모델 §2.9](../1-data-model.md#29-schedule)` 로 앵커를 보완한다.

- **[INFO]** ③ 신규 행의 레이블이 §2.2 기존 "예외 —" prefix 관행과 다름
  - target 위치: `## ③` → `### 변경안 (A)` (본문 150행), 및 이를 정당화하는 `## Rationale` → `### ③ 을 "예외" 가 아니라 "형태" 로 적는 이유` (245~250행)
  - 위반 규약: 없음(강제 규약 아님) — §2.2 표의 기존 3개 특수 행은 전부 `**예외 — <이름>**:` 형식으로 시작하는데(`spec/5-system/2-api-convention.md:53~55` 실측), 신규 행은 `**자원 액션**:` 으로 그 접두 관행을 따르지 않는다.
  - 상세: target 은 이 이탈을 Rationale 에서 의도적으로 설명한다 — 33개·전체 라우트 18%로 관행이 확립돼 "예외"로 적으면 "봐준다"로 오독된다는 논지다. spec/conventions/ 에 이 접두 표기를 강제하는 규약은 없으므로 CRITICAL/WARNING 대상은 아니나, 표 내 다른 세 행과 시각적 일관성이 깨지는 점은 다음 편집자가 인지할 만하다.
  - 제안: 현행 유지도 가능(이미 근거가 명시됨). 다만 다음 사람이 §2.2 를 훑을 때 "예외 3 + 비예외 1" 혼재를 바로 알아보도록 표 상단에 "행 종류가 섞여 있다"는 한 줄 안내를 붙이는 것도 고려할 수 있다.

## 정합성 확인 (위반 아님 — 참고)

대조 결과 target 의 핵심 인용·서식은 실제 spec/conventions 규약과 잘 맞는다:

- ① 의 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합과 선례(`UpdateAssistantSessionDto.llmConfigId`)는 실측(`codebase/backend/.../update-assistant-session.dto.ts:18-29`)과 정확히 일치하며, `swagger.md` 가 명시한 `@ApiPropertyOptional`=`required:false` 별칭 규칙과도 모순되지 않는다. 제안한 "> **적용 범위 — ...**" 블록쿼트 형식도 `swagger.md:122` 의 기존 "> **적용 범위 — 신규 변경 한정**:" 패턴과 형식이 일치한다.
- ③ 의 "§2.2 에 '단일 동사 action 패턴' 규칙이 없다"는 핵심 주장은 `spec/5-system/2-api-convention.md` §2.2(45~55행) 실측과 `3-execution.md:757` 실측 모두로 검증된다.
- ④ 의 앵커 3분류(`ErrorCode` const / `EngineErrorCode` const / 파라미터 유니온 / 에러 클래스 `readonly code` / 앵커 없음)는 `spec/conventions/error-codes.md` §Overview 가 이미 명문화한 "대표 surface 는 둘(자매 const)" 프레임과 어긋나지 않고 오히려 세분화해 보완한다. `CYCLE_DETECTED`·`INVALID_EXPRESSION` 이 `error-codes.ts` 에는 없고 `shadow-workflow.ts`·`execution-failure-classifier.ts` 에만 동명으로 존재한다는 주장도 grep 으로 확인된다.
- target 문서 자체의 구조(도입 문단 → 항목별 문제/실측/변경안 → "넘기는 것" → `## Rationale`)는 CLAUDE.md 가 권장하는 Overview/본문/Rationale 3섹션 관례와 부합한다. frontmatter 의 `spec_impact` 는 YAML 리스트로 Gate C 를 충족한다.

## 요약

target 이 인용하는 규약·선례는 대부분 실측으로 검증되며 정식 규약(특히 `error-codes.md`·`swagger.md`)과 정합적이다. 다만 (a) ④ Rationale 의 근거 인용이 실제로는 다른 plan 문서에서 온 문장인데 잘못 귀속돼 있고, (b) ③ 변경안(A) 의 제시 서식이 그대로 옮기면 GFM 파이프 테이블을 깨뜨리는 멀티라인 구조라는 점은 draft 를 실제 spec 커밋으로 승격하기 전에 정정이 필요하다. 나머지는 경미한 서식 제안(INFO) 수준이다.

## 위험도

LOW
