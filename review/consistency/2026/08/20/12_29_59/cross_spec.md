# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-inputdata-egress-masking.md`

## 발견사항

- **[CRITICAL]** `spec/5-system/12-webhook.md` §5.3 이 target 의 spec_impact 밖에서 뒤집히는 SoT 를 그대로 인용
  - target 위치: draft 전체(특히 Rationale "왜 카브아웃을 유지하지 않나" — "이 결론은 이미 **네 문서**에 미러됐고")·frontmatter `spec_impact`(4개 문서: `14-external-interaction-api.md`·`1-data-model.md`·`13-replay-rerun.md`·`3-execution.md`)
  - 충돌 대상: `spec/5-system/12-webhook.md:317-329` §5.3 "민감 헤더 마스킹 (ingestion)"
  - 상세: 현재 본문에 다음이 그대로 있다 — *"그리고 `inputData` 에는 그 갭을 덮는 후속 층이 없다 — `outputData`/`error` 와 달리 `inputData` 는 [EIA §R17] 의 egress 값-마스킹 **대상이 아니다**(... §R17 잔여 ② 참조). **즉 이 ingestion 층이 `inputData` 의 유일한 방어다.**"* target 대로 §R17 잔여 ②가 "해소"되고 `Execution.inputData` 가 egress 마스킹 대상에 편입되면, 이 문장은 **그 자리에서 거짓**이 된다 — ingestion 층은 더 이상 "유일한 방어"가 아니라 두 번째 방어(egress 값-패턴 마스킹)가 새로 생긴다. `12-webhook.md` 는 target 이 언급한 "카브아웃을 근거로 인용하는 네 문서"에 포함되지 않았으나, 실제로는 §R17 잔여 ②를 SoT 로 직접 인용하는 **다섯 번째 미러**다. target 의 "이미 네 문서에 미러됐다" 라는 전제 자체가 실측과 어긋난다(실제로는 최소 5~6곳).
  - 제안: `spec_impact` 에 `spec/5-system/12-webhook.md` 를 추가하고, §5.3 의 해당 캐비엇 블록을 "ingestion 이 유일한 방어" → "ingestion + egress 값-패턴 마스킹 이중 방어 (2026-08-20)" 식으로 함께 갱신. §R17 잔여 ② 앵커가 "해소(2026-08-20)" 로 이름이 바뀌는 것과 동기화해야 링크 텍스트도 stale 해지지 않는다.

- **[CRITICAL]** `spec/5-system/6-websocket-protocol.md` 의 "가르는 축은 필드 이름이 아니라 레벨" 서술이 flip 후 붕괴
  - target 위치: draft 전체(같은 Rationale 전제) / target ①·②·③·④ 변경 후의 새 세계관("`Execution.input_data` 와 `NodeExecution.input_data` 가 이제 같은 규칙" — ① 변경문 인용)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md:205-208` (§4.1 부근 "값-패턴 마스킹" 캐비엇 블록)
  - 상세: 현재 본문은 다음을 명시한다 — *"반면 **`Execution.inputData`(REST)는 마스킹하지 않는다** — Re-run 프리필이 그 값을 읽어 **재제출**하기 때문이다([§R17 잔여 ②] · [Re-run §10.2]). 즉 가르는 축은 필드 이름이 아니라 **레벨**이다: *round-trip 되는 Execution 레벨만 카브아웃*하고, 표시 전용인 노드 레벨은 REST·WS 양쪽에서 일관되게 마스킹한다."* target 이 §R17 잔여 ②를 닫으면 Execution 레벨도 마스킹 대상이 되어 "레벨로 가른다" 는 축 자체가 사라진다(① 변경문의 "두 컬럼이 이제 같은 규칙이라 대비할 것이 없다"와 정확히 대칭되는 문장이 이 파일에도 있다). 이 문서 역시 target 의 spec_impact 4개 문서에 없다.
  - 제안: `spec_impact` 에 `spec/5-system/6-websocket-protocol.md` 를 추가하고 위 문단을 "Execution 레벨도 이제 egress 마스킹 대상 — '레벨로 가른다' 축은 폐기(2026-08-20), WS·REST 모두 일관 마스킹" 으로 재작성. 그렇지 않으면 이 파일 혼자 "레벨 기준 카브아웃" 이라는, 이제는 존재하지 않는 축을 정본으로 계속 주장하게 된다.

- **[WARNING]** `spec/4-nodes/1-logic/12-background.md` §8.2 의 카브아웃 설명이 flip 후 시제가 어긋남
  - target 위치: 동일 Rationale 전제("네 문서")
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md:246`
  - 상세: *"**여기 `inputData` 는 마스킹 대상이다** — `Execution.inputData` 의 재제출 카브아웃은 **Execution 레벨 한정**이고 본문 노드 레벨엔 재제출 소비처가 없다"* — 이 행의 핵심 주장(본문 노드 `inputData` 는 마스킹 대상)은 flip 이후에도 참으로 유지되므로 CRITICAL 은 아니다. 다만 괄호 안 설명이 "카브아웃은 Execution 레벨 한정이고" 를 현재형으로 서술하는데, flip 후에는 그 카브아웃 자체가 더 이상 존재하지 않아 설명이 낡는다(사실관계 모순은 아니고 "존재하지 않는 예외를 현재형으로 언급"하는 잔여 서술).
  - 제안: 낮은 우선순위지만 같은 커밋에서 "재제출 카브아웃은 Execution 레벨 한정이었고(2026-08-20 이전), 현재는 컬럼 무관 전면 마스킹" 정도로 과거형 정정. target 의 spec_impact 에 필수로 추가할 정도는 아니나 누락 시 다음 독자가 혼란을 겪을 INFO~WARNING 급 잔여.

- **[INFO]** Rationale 의 "네 문서" 수치가 실측과 불일치
  - target 위치: `## Rationale` → `### 왜 카브아웃을 유지하지 않나` — "이 결론은 이미 **네 문서**에 미러됐고 그중 둘은 코드 식별자(`MASKED_INPUT_DATA_REASON`)까지 인용한다"
  - 충돌 대상: 위 CRITICAL 두 건 + WARNING 한 건에서 확인된 추가 미러 3곳
  - 상세: 실측하면 카브아웃(§R17 잔여 ②)을 인용/서술하는 spec 문서는 `1-data-model.md`(target ①) · `13-replay-rerun.md`(target ②) · `3-execution.md` (target ③, 다만 이 문서는 현재 카브아웃을 명시하지 않음 — 신규 캐비엇 삽입일 뿐) · `14-external-interaction-api.md`(SoT, target ④) · `12-webhook.md`(누락) · `6-websocket-protocol.md`(누락) · `12-background.md`(약한 미러, 누락)로 최소 6~7곳이다. 프로젝트 메모리의 반복 교훈("방어의 정의를 한 칸 좁게 잡는다" — 하드닝을 자매 함수 미적용, SoT 한쪽만)과 같은 형태의 리스크다.
  - 제안: 본문 서술을 "네 문서" → 실측 수치로 정정하고, 위 CRITICAL 2건을 spec_impact 에 반영.

- **[INFO]** `spec/3-workflow-editor/3-execution.md` §2.2 는 현재 카브아웃을 서술하지 않음 (긍정 확인)
  - target 위치: target ③
  - 충돌 대상: 없음 (검증 결과 공유)
  - 상세: 실측 결과 `spec/3-workflow-editor/3-execution.md` 는 현재 "마스킹"/"카브아웃"/"egress" 관련 서술이 전혀 없다 (grep 0건). target ③은 새 캐비엇을 **삽입**하는 것이지 기존 서술을 **뒤집는** 것이 아니므로, 이 문서는 target 이 주장하는 "세 문서가 §R17 을 근거로 인용" 범주에 완전히 들어맞지 않는다(인용은 §10.2/§R17 을 통해서만 간접적). 실질적 충돌은 아니며 참고용 기록.

## 요약

target draft 는 §R17 카브아웃을 닫는 결정 자체와 그 근거(가드 두 개, 기각한 두 대안)는 내적으로 일관되고, 명시한 네 문서(`1-data-model.md`·`13-replay-rerun.md`·`3-execution.md`·`14-external-interaction-api.md`) 안에서는 "현재" 인용문이 실제 spec 본문과 정확히 일치해 변경안 자체의 정합성은 높다. 그러나 draft 가 스스로 세운 전제 — "이 결론은 이미 네 문서에 SoT 로 미러돼 있다" — 는 실측과 어긋난다. `spec/5-system/12-webhook.md` §5.3 은 "ingestion 층이 `inputData` 의 유일한 방어" 라고 §R17 잔여 ②를 근거로 명시하고, `spec/5-system/6-websocket-protocol.md` 는 "가르는 축은 필드 이름이 아니라 레벨" 이라는, flip 이후 존재할 수 없는 축을 정본으로 서술한다. 두 문서 모두 target 의 `spec_impact` 리스트에 없어, 이 draft 를 그대로 커밋하면 정확히 draft 가 방지하려던 것과 같은 종류의 SoT drift(예외 하나가 문서 그래프 곳곳에 각인된 상태에서 일부만 뒤집힘)를 새로 만든다. `spec/4-nodes/1-logic/12-background.md` 는 핵심 주장은 여전히 참이지만 설명 문구가 시제상 낡는다.

## 위험도

HIGH
