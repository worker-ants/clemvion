# Plan 정합성 검토 — `spec-draft-swagger-request-body.md`

## 발견사항

- **[INFO]** 트래커 항목 1 의 절반만 이번 draft 로 닫힌다 — 이미 draft/plan 양쪽에 명시돼 있음
  - target 위치: `plan/in-progress/spec-draft-swagger-request-body.md` §"왜 §1-7 명명 행은 이번에 넣지 않나"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목 «요청 본문 스키마의 규칙과 가드» 1(규칙) — "§5-4 체크리스트 한 줄" **과** "§1-7 표에 문서 전용 `<Domain><Action>RequestDto` 행"을 하나의 불릿으로 묶어 둠
  - 상세: draft 는 §5-4 체크리스트 줄만 추가하고 §1-7 명명 행은 "기존 이름(`ExecuteWorkflowDto` 접미 없음 vs `ContinueExecutionRequestDto` 어순)을 어떻게 다룰지 정하는 별 결정"이라며 의도적으로 미룬다. 이는 미해결 결정을 우회 없이 정직하게 남겨 두는 올바른 처리이며, 구현 plan(`request-body-guard.md`)의 서두와 체크리스트 마지막 항목("트래커 항목 좁히기(남는 §1-7 · 리네임) · 닫힌 부분 기록")에도 이미 이 분리가 반영돼 있어 실질적 위험은 낮다.
  - 제안: 트래커를 닫는 시점에 항목 1을 "§5-4 체크리스트(닫힘)"과 "§1-7 표 행(남음, 별도 결정 필요)"으로 명시적으로 쪼개 적을 것 — 이미 계획된 마감 단계이므로 별도 조치 불요, 진행 시 누락 방지용 확인만.

- **[INFO]** 트래커가 적은 가드 판정 축("AST")과 draft/plan 이 선택한 축("reflection")이 다르다 — 기술적으로는 더 타당한 선택
  - target 위치: `plan/in-progress/spec-draft-swagger-request-body.md` §"Rationale" 중 "**reflection 으로 센다**" 절
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 트래커 항목 2(가드) — "**AST** — `@Body()` 파라미터 타입이 클래스 참조가 아니면 …"
  - 상세: 트래커는 가드 구현축으로 AST 를 적어 뒀으나, draft/plan 은 reflection(`design:paramtypes` + `Reflect.getMetadata`)을 택하고 "AST 로는 `interface`·타입 별칭 참조가 런타임에 `Object` 가 되는 것을 클래스 참조와 구별할 수 없다"는 근거를 명시한다. 실측 확인 결과 형제 가드 `forbidden-response-codes-guard.ts` 도 이미 reflection 기반이고, 헬퍼 `swagger-probe.ts` 의 `bodyParamDesignType` 도 `Reflect.getMetadata` 로 reflection 을 쓴다 — 저장소의 기존 패턴과 정합하며, `CustomValidationPipe.toValidate()` 의 비검증 타입 목록(`[String, Boolean, Number, Array, Object]`)과 draft 의 서술도 정확히 일치한다(코드 확인 완료). 트래커의 "AST" 표기는 작성 당시의 개략 표현으로 보이며, 이번 draft 가 이를 기술적으로 정정한 것에 가깝다 — 미해결 결정을 일방적으로 우회한 것이 아니라 더 구체적인 근거로 대체한 것.
  - 제안: 트래커 항목을 닫을 때 "AST" → "reflection(근거: interface/타입 별칭이 런타임에 Object 로 붕괴)"으로 정정 기록. 지금 당장 변경 불요 — 위와 같은 마감 체크리스트 단계에서 함께 처리 가능.

## 요약

target 스펙 draft(`spec-draft-swagger-request-body.md`)는 트래커(`spec-draft-nullable-notation-followups.md`)의 «요청 본문 스키마의 규칙과 가드» 항목 1·2·3(부분)을 좁혀서 닫으려는 구현 plan(`request-body-guard.md`)과 서로 정합한다. 선행 조건(`rotate-bot-token-body`/#1408 — `@Body()` 78개 베이스라인 0)은 이미 머지돼 해소됐고(커밋 `a3a418ae3`), draft 가 미룬 §1-7 명명 행과 DTO 어순 리네임은 "결정 필요"로 명시적으로 남겨 둔 채 별도 트래커 항목으로 보존되며, 구현 plan 체크리스트에도 마감 시 트래커 반영 단계가 이미 포함돼 있다. 가드 판정축을 트래커의 "AST" 대신 "reflection"으로 바꾼 점은 형제 가드·기존 헬퍼와의 정합성 및 코드 실측(`CustomValidationPipe.toValidate`)으로 뒷받침되는 정당한 기술적 정정이며, 미해결 결정의 일방적 우회로 보기 어렵다. 다른 in-progress plan(`eia-context-schema-followups.md`, `spec-sync-external-interaction-api-gaps.md` 등)의 swagger.md 관련 항목은 모두 이미 닫혔거나 무관한 절을 다뤄 후속 무효화·충돌이 없다. Plan 정합성 관점에서 CRITICAL/WARNING 급 문제는 발견되지 않았다.

## 위험도
NONE
