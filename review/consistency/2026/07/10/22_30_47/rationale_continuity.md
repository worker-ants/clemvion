# Rationale 연속성 검토 — spec-draft-eia-context-schema-absence-convention

대상: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`
대조 SoT: `spec/conventions/swagger.md` §Rationale · `spec/5-system/2-api-convention.md` §Rationale · `spec/5-system/14-external-interaction-api.md` §R17 (+ §5.3/§6.2 본문, `spec/conventions/execution-context.md` §원칙3, `spec/conventions/conversation-thread.md` §4/§8.4, `spec/conventions/node-output.md` Principle 1.1.4)

> 주: 호출 payload(`_prompts/rationale_continuity.md`)에 동봉된 "관련 Rationale 발췌"는 라인 629에서 "(truncated due to size limit)"로 잘려, 지정된 3개 spec(swagger.md/api-convention.md/EIA §R17)의 Rationale 원문에 도달하지 못했다. 따라서 본 검토는 해당 3개 spec 원본 파일을 직접 읽어 대조했다(레포 내 최신 상태 확보, 결과에 영향 없음).

## 발견사항

- **[WARNING]** §5.3/§6.2 기존 JSONC 예시가 draft 의 신규 2-variant closed-union 결정과 이미 어긋나 있음 — "cross-ref(경미)"로는 부족
  - target 위치: 갭 3 (`## 갭 3 — cross-ref (경미)`, "EIA §5.3 의 키 생략 문단 → 새 api-convention §5.4 로 링크", "EIA §R17 → ... §5.4 참조로 1문장")
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 ("`getStatus.context` 는 SSE `waiting_for_input` wire 형식과 동일하게") + 같은 문서 §5.3 JSONC 샘플(L459-465) + §6.2 JSONC 샘플(L564-569, SSE 변환 note L575-583)
  - 상세: draft 의 "배경 — 코드 실증"·"Rationale (draft)" 절은 실제 코드/SSE wire 가 **2-variant**(`buttonConfig{buttons,nodeOutput}` vs `nodeOutput`, 판별자는 "어느 키가 present 인가")임을 정확히 짚고, 그에 맞춰 `oneOf` 2-variant + no-discriminator 스키마를 §1-4 신설안으로 제안한다. 그런데 같은 EIA 문서의 **기존 §5.3 JSONC 예시**는 `context` 아래에 `formConfig`/`buttonConfig`/`conversationConfig`/`conversationThread` 4개를 나열("노드 종류에 따라 form/button/conversation config 중 하나만 동봉")하고, §6.2 outbound notification 예시도 동일한 3-key(`formConfig`/`buttonConfig`/`conversationConfig`) 형태를 보인다 — 이는 draft 가 폐기하려는 "3-way(노드 타입별 config 이름)" 모델과 형태가 같고, draft 가 새로 세우려는 "2-variant(어느 키가 present 인가)" 모델과 다르다. §6.2 바로 아래 note(L575-583)가 이미 SSE wire 는 이 outbound 예시와 다르다고 밝히고 있어 문서 내부에 3중 서술(§5.3 예시 / §6.2 예시 / §6.2 note)이 혼재하는 상태다. draft 의 §1-4 개정으로 `context` 를 실제 Swagger `oneOf` 스키마로 확정하면, 이 스키마는 §5.3/§6.2 의 예시와 직접 모순되는 셋째 서술이 된다 — "cross-ref 링크 추가"만으로는 이 모순이 남아, 향후 구현자(developer)나 SDK 소비자가 어느 예시를 신뢰할지 다시 헷갈릴 위험이 있다(draft 자신이 "배경" 절에서 지적한 `eia-types.ts` 드리프트와 동일한 계열의 문제가 §5.3/§6.2 예시 자체에 재발할 소지).
  - 제안: 갭 3 범위를 "cross-ref" 에서 "정정"으로 넓혀, §1-4 개정 반영 PR 에서 §5.3 JSONC 샘플(및 가능하면 §6.2 outbound 샘플)을 실제 2-variant 형태로 함께 고친다. 최소한 plan 체크리스트에 "§5.3/§6.2 JSONC 예시를 2-variant 형태로 정정" 항목을 명시적으로 추가해, "경미"라는 표현 때문에 후속 세션에서 누락되지 않게 한다.

- **[INFO]** `responses.dto.ts` 의 기존 JSDoc 이 draft 가 반박하는 구 가정("interactionType 이 sound discriminator")을 그대로 담고 있음
  - target 위치: 배경 절 (코드 실증)
  - 과거 결정 출처: 해당 사항 없음 (spec `## Rationale` 아님, 코드 주석 — 참고용)
  - 상세: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:57-58` 의 JSDoc 은 "`context` 의 sub-config 는 노드 종류에 따라 0~1개만 동봉. 클라이언트는 `currentNode.interactionType` 으로 분기" 라고 적혀 있다. draft 의 "Rationale (draft)"는 이 가정이 unsound(`buttons` fallthrough)함을 정확히 반박하며 `discriminator` 미채택을 정당화한다. 이는 spec Rationale 위반이 아니라 이미 stale 해진 코드 주석과의 정합 문제이므로 CRITICAL/WARNING 대상은 아니다.
  - 제안: 체크리스트의 "구현 위임(developer): `responses.dto.ts` oneOf 봉투 DTO" 작업 시 이 JSDoc 문구도 함께 정정하도록 developer 세션에 한 줄 남겨두면 재확인 비용을 줄인다.

- **[INFO]** 신설 `api-convention.md §5.4` 와 기존 `swagger.md §1-3` (Optional 필드) 사이 상호 참조 부재
  - target 위치: 갭 2 개정안 (`### 5.4 부재 표현`)
  - 과거 결정 출처: `spec/conventions/swagger.md` §1-3 (Optional 필드, `field?: T` 패턴 서술)
  - 상세: §5.4 는 DTO 선언 패턴(`@ApiPropertyOptional` + `field?: T` vs `field?: T|null`)을 규정하지만, 이미 존재하는 §1-3 "Optional 필드" 절과 내용이 인접함에도 상호 링크가 없다. 모순은 없으나 두 절이 겹치는 주제를 별도 문서에서 다뤄 발견성이 떨어진다.
  - 제안: §5.4 본문 또는 swagger.md §1-3 끝에 상호 링크 한 줄 추가(선택 사항, 필수 아님).

## 대조 결과 — 위반 없음으로 확인된 항목

- **discriminator 미채택 결정**: `spec/conventions/swagger.md` §Rationale 에는 discriminator 채택/기각에 대한 기존 결정이 없다. §5-2 표의 `ApiOkWrappedOneOfResponse(..., { discriminator })` 는 응답 레벨(OAuth begin 분기) 용례일 뿐 property 레벨 discriminator 에 대한 선례가 아니라서, draft 의 "discriminator 생략" 결정은 **기각된 대안의 재도입이 아니라 신규 결정**이며, draft 는 이를 새 Rationale 문단으로 명시적으로 남기기로 체크리스트에 명기했다(리뷰 기준 3 충족).
- **봉투만 스키마화 / 내부 payload 는 open map 유지**: `spec/conventions/node-output.md` Principle 1(“output 은 자유 payload”)·`spec/conventions/execution-context.md` §원칙3 "소급 적용 대상 아님"과 정합하며, draft 는 실제로 execution-context.md 의 동일 문구를 인용해 적용 범위를 스스로 제한했다 — 취지 일치.
- **`conversationThread` 를 `null` 로 정규화하지 않는 결정**: `spec/5-system/14-external-interaction-api.md` §R17(및 §5.3 prose)의 "SSE wire parity" 계약을 draft 가 그대로 존중하며, 오히려 그 계약을 §5.4 신설 규칙의 실사례로 인용한다 — 위반 없음, 오히려 R17 의 명시 계약을 근거로 삼는 정합적 설계.
- **`ConversationThreadDto` 미생성**: `spec/conventions/conversation-thread.md` §4/§8.4 가 이미 thread shape 의 SoT 임을 확인했고, draft 의 "SoT 이중화 회피" 논리와 부합한다.
- **`api-convention.md §5.4` 의 null 우선 기본값·details 필드 선례**: §5.3 `details`(선택 필드, 존재 시에만 동봉)·§8.2 `nextCursor`(없으면 null) 를 직접 대조했고, draft 가 인용한 선례 표가 실제 spec 문구와 정확히 일치한다 — 허구의 선례를 만들어 정당화하는 패턴 없음.

## 요약

draft 는 세 SoT(swagger.md, api-convention.md, EIA §R17)의 기존 Rationale·계약을 대체로 정확히 인용하고 존중한다 — 특히 `conversationThread` 를 `null` 로 정규화하지 않는 것, `nodeOutput`/`buttonConfig.buttons` 를 open map 으로 남기는 것, discriminator 를 의도적으로 생략하는 것 모두 기존 결정을 뒤엎지 않으며 새 Rationale 을 함께 작성하겠다고 체크리스트에 명시해 "무근거 번복"에 해당하지 않는다. 유일한 실질적 우려는 EIA 문서 자체에 이미 존재하는 §5.3/§6.2 의 구형(3-key sibling) JSONC 예시가 draft 가 정착시키려는 2-variant 모델과 상충한 채 "cross-ref(경미)" 범위로만 다뤄져, 구현 단계에서 어느 쪽이 권위인지 재차 혼동될 소지가 있다는 점이다(WARNING 1건). 이는 기각된 대안의 재도입이나 합의 원칙 위반이 아니라, R17 의 "SSE wire parity" invariant 를 스키마 레벨까지 끝까지 관철하지 못할 위험에 가깝다.

## 위험도

LOW
