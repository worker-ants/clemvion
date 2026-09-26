# Plan 정합성 검토 결과

## 발견사항

- **[INFO]** 가드 판정 축이 트래커 등재 문구(AST)에서 reflection 으로 바뀌었다 — 닫을 때 트래커 텍스트 갱신 필요
  - target 위치: `spec/conventions/swagger.md` §5-4 Rationale "왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가" · `plan/in-progress/request-body-guard.md` "가드(developer)" 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5150` — 트래커가 이 항목을 등재할 때 "2. **가드(developer)**: **AST** — `@Body()` 파라미터 타입이 클래스 참조가 아니면…" 로 적어 두었다
  - 상세: target(개발 plan + 이미 병합된 spec Rationale)은 AST 대신 reflection(`design:paramtypes`)을 판정 축으로 채택했고 그 이유(`interface`·타입 별칭이 런타임에 `Object` 로 소거돼 AST 로는 클래스 참조와 구별 불가)를 spec Rationale 에 정확히 남겼다. 이 자체는 "결정 필요"로 명시 유보된 항목이 아니라 트래커가 적어 둔 초기 기술 추정이라 개발 중 반증하고 대체하는 것은 정상 범위다. 다만 트래커 원문은 여전히 "AST" 라고 적혀 있어, 이 항목을 닫을 때(트래커 좁히기) 그 문구를 reflection 으로 정정하지 않으면 다음 사람이 트래커만 보고 AST 를 기대하게 된다.
  - 제안: `request-body-guard.md` 체크리스트의 "트래커 항목 좁히기(남는 §1-7·리네임)·닫힌 부분 기록" 수행 시, 남기는 서술을 "AST" 가 아니라 "reflection(인터페이스·타입 별칭이 런타임에 `Object`)" 으로 명시 정정할 것 — `spec-draft-swagger-request-body.md` 자체가 이미 이 정정을 "INFO3·7" 처리 항목으로 예고하고 있어 누락 위험은 낮다.

- **[INFO]** `spec-draft-swagger-request-body.md` 의 변경안이 이미 전부 `spec/conventions/swagger.md` 에 반영됐는데 plan 상태·체크박스가 그대로다
  - target 위치: `plan/in-progress/spec-draft-swagger-request-body.md` (frontmatter `status: in-progress`), `plan/in-progress/request-body-guard.md` 체크리스트 `- [ ] spec draft \`--spec\` · 반영(planner)`
  - 관련 plan: 동일 두 파일
  - 상세: 실측 확인 결과 §5-4 체크리스트 한 줄(`swagger.md:517`), frontmatter `code:` 가드 등재, Rationale 한 절(`swagger.md:750`)이 커밋 `f71f5df06`(docs(spec))으로 이미 병합돼 있다. 그런데 구현 plan `request-body-guard.md` 의 체크리스트 첫 항목은 여전히 미체크이고, `spec-draft-swagger-request-body.md` 도 `plan/complete/` 로 옮겨지지 않았다. 다만 harness 자신이 남긴 메모("이 `--impl-prep` 은 구현 plan … 착수 전 검토다(spec 은 planner 커밋으로 이미 반영)")가 이 상태를 이미 알고 있어 판정을 오도하지는 않는다.
  - 제안: 차단 사유는 아니며, `request-body-guard.md` 체크리스트가 이미 마지막 단계에 "트래커 항목 좁히기 · 닫힌 부분 기록"을 예정해 두었으므로 그 시점에 (a) 첫 체크박스 체크, (b) `spec-draft-swagger-request-body.md` 를 `plan/complete/` 로 이동하는 것을 함께 챙길 것.

- **[INFO]** §1-7 문서 전용 요청 DTO 명명 결정은 target 이 정확히 유보 상태로 남겨 두었음 (정합 — 문제 아님, 확인 기록)
  - target 위치: `plan/in-progress/request-body-guard.md` "3 의 DTO 어순 리네임과 1 의 §1-7 명명 행은 **남긴다**"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5147-5149` — "선례 `ExecuteWorkflowDto` 는 접미가 없다 — 규칙이 둘 중 하나로 정한다"(미해결 명명 결정)
  - 상세: target 의 §5-4 체크리스트 신규 줄과 Rationale 은 문서 전용 DTO 의 이름 패턴(`<Domain><Action>RequestDto` 접미 여부)을 전혀 언급하지 않아, 트래커가 열어 둔 이 결정을 일방적으로 선점하지 않았다. `spec-sync-external-interaction-api-gaps.md` 의 완료 이력(`ExecuteWorkflowDto` 무접미 선례, `ContinueExecutionRequestDto` 접미 선례 공존)과도 충돌 없이 병존한다.
  - 제안: 없음 — 현재 스코핑 유지.

## 요약
검토 대상(swagger.md §5-4 request-body 규칙 + 대응 reflection 가드 plan)은 트래커(`spec-draft-nullable-notation-followups.md` "요청 본문 스키마의 규칙과 가드" 항목)의 1(규칙)·2(가드)·3(곁가지) 중 일부만 의도적으로 좁혀 착수했고, 그 좁힘의 근거(§1-7 명명·DTO 어순 리네임은 별 결정이라 섞지 않음)를 두 plan 모두에 명시했다. 트래커가 열어 둔 명명 결정을 일방적으로 확정하지 않았고, 선행 조건(§5-4 규칙 문단, `rotate-bot-token-body` #1408 완료)도 실측상 충족돼 있다. 발견된 것은 전부 등급이 낮은 bookkeeping 성격 — (1) 가드 판정 축이 트래커 등재 문구(AST)와 달라졌으니 트래커 정정 항목에 이를 반영할 것, (2) 이미 병합된 spec-draft plan 의 상태·체크박스가 stale — 이며 둘 다 target 의 체크리스트가 이미 마지막 단계에서 처리를 예정하고 있어 실제 충돌·누락 위험은 낮다.

## 위험도
LOW
