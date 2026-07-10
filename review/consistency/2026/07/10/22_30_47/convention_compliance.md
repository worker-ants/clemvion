# 정식 규약 준수 검토 — EIA `getStatus.context` 스키마화 + 부재 표현 규칙 draft

- target: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`
- 검토 모드: spec draft (`--spec`)
- 판단 기준: 본 draft 는 `spec/conventions/swagger.md` §1-4 · `spec/5-system/2-api-convention.md` §5 를 **개정 제안**한다. 개정 자체가 목적이므로 "현행 §1-4 텍스트와 다르다"는 이유만으로는 위반 판정하지 않았다. 대신 (a) 개정 결과물이 spec 문서 구조 규약(Overview/본문/Rationale, anchor, frontmatter)을 지키는가, (b) 개정된 §1-4 가 §5-2 `ApiOkWrappedOneOfResponse` 행·§6 레거시 패턴 제거와 내적 정합을 유지하는가에 집중했다.

## 발견사항

### [WARNING] §5-2 "표에 행 추가" vs "각주 형태" — 자기모순적 지시로 §5-2 구조와 충돌 소지

- target 위치: 갭 1 개정안 하단, `§5-2 표에 property-level 행 1개 추가(헬퍼 아닌 데코레이터 조합이므로 각주 형태).` 한 줄
- 위반 규약: `spec/conventions/swagger.md` §5-2 (표 컬럼: `헬퍼` / `용도` / `반환 스키마` — 재사용 가능한 **호출형 함수** 인벤토리)
- 상세: §5-2 표는 `codebase/backend/src/common/swagger/` 가 export 하는 **이름 있는 헬퍼 함수**(`ApiOkWrappedResponse` 등)만 나열한다. draft 의 새 프로퍼티 레벨 패턴(`@ApiExtraModels`+`@ApiProperty({oneOf})`)은 스스로 "헬퍼 아니다" 라고 명시하면서도 "표에 행 1개 추가"라고 지시해 자기모순이다. 문자 그대로 표 행으로 넣으면 `헬퍼` 컬럼에 함수명이 아닌 것이 들어가 §5-2 의 "이 표 = 호출형 헬퍼 인벤토리"라는 기존 불변식을 깨고, 반대로 "각주"로만 두면 표에 행을 추가한 게 아니게 되어 지시가 스스로 어긋난다.
- 제안: 이 항목을 명확화 — (예) "§5-2 표 하단에 각주(footnote)로 1줄 추가: '프로퍼티 레벨 닫힌 union 은 헬퍼가 아닌 데코레이터 조합(§1-4 참조)'" 식으로 **표 행이 아니라 표-부속 각주**임을 명시하거나, 반대로 실제로 행을 추가하고 싶다면 `헬퍼` 컬럼 의미를 "재사용 함수 **또는** 데코레이터 조합"으로 넓히는 문구 조정이 함께 필요하다. 어느 쪽이든 draft 체크리스트 항목을 "표 각주 1줄 추가(행 아님)"처럼 소거법으로 확정해 반영 시 혼선을 막는다.

### [WARNING] EIA §5.3 예시 JSON 이 R17 서술·draft 의 코드 실증과 이미 어긋나 있으나 Gap 3 범위에서 누락

- target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 (L459-465) 의 `context` 예시 블록 — `formConfig` / `buttonConfig` / `conversationConfig` 3개 키를 병렬로 예시
- 위반 규약: 문서 구조 규약상 "단일 진실"(CLAUDE.md 정보 저장 위치 표) — 같은 spec 안에서 서술(R17)과 예시(§5.3 JSON)가 갈리면 안 됨. draft 자신의 "코드 실증" 표와도 어긋남
- 상세: draft 배경 섹션이 `interaction.service.ts` 코드를 직접 대조해 확정한 실제 shape 는 **`buttonConfig` 또는 `nodeOutput` 중 하나만** 실리는 닫힌 3-way 이고, R17 본문(L1113-1115)도 정확히 "buttons→`buttonConfig{buttons,nodeOutput}`, form/ai_conversation→`nodeOutput`"으로 같은 진실을 서술한다. 그런데 §5.3 의 JSON 예시(L459-465)는 여전히 `formConfig`/`buttonConfig`/`conversationConfig` 세 키를 나열해 존재하지 않는 `formConfig`/`conversationConfig` 키를 암시한다 — 이는 draft 가 발견하기 이전부터 있던 drift 지만, Gap 1 이 바로 이 실제 shape(`buttonConfig` xor `nodeOutput`)을 property-level `oneOf` DTO 로 고정하려는 시점이라 방치하면 **새로 만든 스키마(정확)와 기존 예시(부정확)가 같은 문서 안에서 정면으로 갈리는 상태가 고정**된다. Gap 3 은 "cross-ref (경미)" 로 §5.3/§R17 → 새 §5.4 링크 추가만 다루고, 이 기존 JSON 오류 정정은 체크리스트 어디에도 없다.
- 제안: 갭 3 (또는 갭 1 체크리스트) 에 "§5.3 JSON 예시를 실제 shape(`buttonConfig` xor `nodeOutput`, `formConfig`/`conversationConfig` 키 삭제)로 정정" 항목을 추가한다. 이 정정 없이 Gap 1 의 oneOf DTO 만 반영하면 신규 스키마와 구예시가 같은 spec 파일 안에서 모순으로 남는다.

### [WARNING] Rationale 항목이 대상 문서의 기존 `### §N ...` 헤더 패턴 없이 볼드 문단으로만 작성됨

- target 위치: draft 말미 `## Rationale (draft — 반영 시 각 spec 의 ## Rationale 로 이관)` 4개 항목 (`**왜 discriminator 를 쓰지 않는가**` 등)
- 위반 규약: `spec/conventions/swagger.md` Rationale 은 `### §0 ...`/`### §5 ...` 식 개별 헤더로 항목을 구분하고, `spec/5-system/2-api-convention.md` Rationale 도 `### 413 PAYLOAD_TOO_LARGE...`/`### §11 Webhook 절을...` 식 개별 헤더를 쓴다(둘 다 anchor 로 상호 참조 가능). `spec/conventions/audit-actions.md` Rationale 도 동형(`### 왜 시제를 한 규약으로 묶는가`)
- 상세: draft 의 4개 Rationale 문단은 헤더 없이 볼드 리드인(`**왜 X** — ...`)만으로 되어 있다. "반영 시 각 spec 의 `## Rationale` 로 이관" 이라는 메모는 있지만, 어느 문단이 swagger.md 로 가고 어느 것이 api-convention.md 로 가는지, 그리고 이관 시 기존 두 문서 모두가 쓰는 `### §N 제목` 헤더 형식으로 변환해야 한다는 지시가 없다. 볼드 문단 그대로 옮기면 두 대상 문서의 기존 Rationale 헤더 패턴과 스타일이 어긋나고, 향후 다른 spec 이 이 결정을 anchor 로 직접 인용할 수 없다(헤더가 없어 `#anchor` 불가).
- 제안: draft 를 spec 에 반영하는 단계에서 4개 문단을 각각 `### <제목>` 헤더로 승격하고, 1·2번째(`discriminator`/`봉투만 스키마화`)는 swagger.md, 3번째(`null 정규화 안 함`)는 api-convention.md 로 명시 배정한다. 4번째(`ConversationThreadDto 미생성`)는 두 문서 중 어디 소속인지 draft 상 모호하므로 반영 전에 명시 배정을 확정한다(아래 항목 참조).

### [INFO] 4번째 Rationale 항목("왜 `ConversationThreadDto` 를 만들지 않는가")의 귀속 문서가 불명확

- target 위치: 같은 Rationale 블록, 4번째 문단
- 위반 규약: 없음(직접적 규약 위반은 아님) — CLAUDE.md 정보 저장 위치 표의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙의 실행 모호성
- 상세: 이 문단은 `context` 봉투 DTO 설계(§1-4, swagger.md 소관)와 `conversationThread` 부재 표현(§5.4, api-convention.md 소관) 양쪽에 걸친 내용이라 어느 파일 Rationale 로 귀속되는지 draft 만으로 판단하기 어렵다.
- 제안: 반영 시 swagger.md(§1-4 봉투 설계 근거) 로 귀속시키되, api-convention.md §5.4 Rationale 에는 1줄 cross-ref만 남기는 방식을 권장. 사용자/planner 확정 필요.

### [INFO] `node-output.md` 상대경로가 §1-4 amendment 가 실제로 안착할 디렉토리 기준 관례와 다른 형태

- target 위치: Rationale "왜 봉투만 스키마화하는가" 문단의 `[node-output.md](../conventions/node-output.md)`
- 위반 규약: 없음(링크 자체는 깨지지 않음) — 스타일 참고용
- 상세: 이 문단이 `spec/conventions/swagger.md` 의 `## Rationale` 로 이관된다고 가정하면, `swagger.md` 는 `node-output.md` 와 **같은 디렉토리**(`spec/conventions/`)에 있다. 같은 디렉토리 안에서 다른 conventions 문서(`execution-context.md`, `conversation-thread.md` 등)는 전부 `./node-output.md` 형태로 참조한다(`../conventions/node-output.md` 형태는 `spec/conventions/` 바깥 문서, 예: `spec/2-navigation/4-integration.md` 에서만 쓰임). draft 의 `../conventions/node-output.md` 는 수학적으로는 여전히 `spec/conventions/node-output.md` 로 정확히 resolve 되어 **깨지진 않지만**, 안착 위치 관례와 다른 우회 표기다.
- 제안: swagger.md 에 반영 시 `./node-output.md` 로 정정.

### [INFO] `conversationThread` shape SoT 인용이 §4/§8.4(영속화·Rationale) 대신 §1.3(자료구조)을 우선 지목하는 편이 더 정확

- target 위치: Rationale "왜 `ConversationThreadDto` 를 만들지 않는가" 문단, `conversation-thread.md §4/§8.4 가 thread shape(turns[]/source/totalChars/nextSeq)의 SoT 다`
- 위반 규약: 없음 — 인용 정밀도 지적
- 상세: `turns[]`/`totalChars`/`nextSeq` 필드 정의 표는 `conversation-thread.md` **§1.3 (ConversationThread)** 에 있다. §4 는 "어디에 영속되는가"(영속화 단계표), §8.4 는 durable 컬럼 채택의 **Rationale**(결정 근거)이지 필드 shape 표 자체가 아니다. §4 테이블 안에 필드명이 부분적으로 등장하긴 하나(예시 JSON), 정식 스키마 정의는 §1.2/§1.3 이 SoT.
- 제안: 인용을 `§1.3(자료구조) + §4(영속화)` 로 정정하거나 최소 §1.3 을 추가.

### [INFO] 체크리스트 1항의 선제결과 기입과 미체크 상태의 불일치 (plan 체크박스 = 실제 상태 원칙)

- target 위치: `## 체크리스트` 첫 줄 `[ ] /consistency-check --spec 통과 (BLOCK: NO)`
- 위반 규약: 직접적 spec convention 은 아니고 plan-lifecycle 운영 관례(`.claude/docs/plan-lifecycle.md` §5, "plan 체크박스 = 실제 상태") 에 인접
- 상세: `(BLOCK: NO)` 라는 결과가 이미 괄호로 명시돼 있으면서 체크박스는 미체크(`[ ]`) 다. 이미 실행되어 결과가 나온 항목이라면 `[x]` 여야 하고, 아직 실행 전이라면 결과를 미리 적어두는 것이 오해를 부른다.
- 제안: 실제로 `/consistency-check --spec` 을 실행한 뒤 통과 결과에 맞춰 체크 상태를 갱신. (이 항목은 spec/conventions 준수 여부라기보다 plan 운영 관례라 정보성으로만 표기)

## 검토 통과 확인 (정합 유지 확인된 부분)

- §1-4 개정안의 "응답 body 전체가 union 이면 property 레벨 대신 공용 헬퍼 `ApiOkWrappedOneOfResponse` (§5-2) 를 쓴다" 문구는 §5-2 기존 행과 모순 없이 책임 경계를 정확히 나눈다.
- `discriminator` 를 "판별자가 unsound 하면 생략" 이라는 새 규칙은 기존 `api-wrapped.ts` 의 `wrapOneOfDataSchema` JSDoc("호출자는 모든 DTO 가 동일 propertyName 필드를 보유함을 보장해야 합니다")과 이미 정합하며, 이를 conventions 문서 레벨로 승격하는 것으로 code-comment 와 spec 사이 기존 drift 를 줄인다(개선 방향).
- §1-4 의 "열린/동적 map 은 '타입을 모르겠다'는 사유로 쓰지 않는다"는 신규 제약은 §6 레거시 패턴 제거(빈 껍데기 스키마 금지)의 취지와 같은 방향이며 직접 충돌하지 않는다.
- `@ApiExtraModels`/`getSchemaPath`/`@ApiPropertyOptional` 등 데코레이터 명명은 모두 기존 `codebase/backend/src/common/swagger/api-wrapped.ts` 의 실제 import 와 정확히 일치.
- EIA §5.3 anchor(`#53-단발-상태-조회--get-apiexternalexecutionsexecutionid`)는 같은 문서 안 §5.1/§5.2 기존 anchor 생성 패턴(예: `#52-sse-이벤트-스트림--get-apiexternalexecutionsexecutionidstream`)과 동형이며 정확히 계산된다.
- 인용된 기존 규약 문구(§8.2 `nextCursor`, §5.3 `details`, execution-context.md §원칙3 "소급 적용 대상 아님", EIA §5.3 "형제 필드의 `null` 관례와 달리 키 부재")는 모두 원문과 정확히 일치하는 verbatim/near-verbatim 인용.
- draft 자체 frontmatter(`worktree`/`started`/`owner`)는 `plan-lifecycle.md §4` 스키마를 충족.

## 요약

본 draft 는 §1-4 개정의 핵심 논리(닫힌 union vs 열린 map 분리, discriminator soundness 조건부 생략)가 기존 §5-2/§6/`api-wrapped.ts` 코드와 잘 정합하고, 인용한 기존 규약 문구도 모두 정확하다. 다만 반영 실행 단계에서 두 가지 실질적 리스크가 있다 — (1) §5-2 "표에 행 추가 vs 각주" 지시가 자기모순적이라 그대로 반영하면 §5-2 의 "헬퍼 함수 인벤토리" 불변식이 흐려질 수 있고, (2) Gap 3 "cross-ref (경미)" 로 표기된 EIA §5.3 손질 범위가 실제로는 이미 존재하던 예시 JSON drift(`formConfig`/`conversationConfig` 유령 키)를 놓치고 있어, Gap 1 의 oneOf 스키마가 반영되는 순간 새 스키마(정확)와 구예시(부정확)가 같은 문서 안에서 충돌한 채로 굳어질 수 있다. 나머지는 Rationale 항목의 헤더 승격·귀속 문서 명시, 상대경로/인용 절 번호 미세 정정 수준의 경미한 사항이다. Critical 급 위반(다른 시스템의 invariant 붕괴)은 없다.

## 위험도

MEDIUM
