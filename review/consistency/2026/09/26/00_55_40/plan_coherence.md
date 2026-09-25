### 발견사항

- **[WARNING]** Rationale 이 예고한 트래커 질문 등재가 변경안에 없다
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner-callback.md` `## Rationale` "왜 코드는 그대로인가" 항목 (69~71행) — "«요청자가 더는 볼 수 없는 행에 `last_error` 를 남기는 것이 맞는가»는 코드 판단이라 트래커(«통합 소유자 강제의 테스트 · 구조 잔여»)에 질문으로 등재한다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 5781행 "**통합 소유자 강제의 테스트 · 구조 잔여 — 트랜잭션 매니저 분기 · Organization rotate e2e · 조건부 쓰기 헬퍼**" 항목 (developer, `/ai-review` `00_27_56` W1·W3·W4 등재분, 현재 3개 하위 항목만 있음)
  - 상세: target 은 "요청자가 더는 볼 수 없는 행에 last_error 를 남기는 것이 맞는가"라는 **새 설계 질문**을 실제로 발생시킨다 — 예컨대 재인증 시작 후 콜백 사이에 그 Organization 통합이 (다른 Admin 이) personal 로 전환돼 요청자가 더는 볼 수 없는 행이 됐는데도, 실패한 재판정이 그 행의 `last_error` 에 진단 정보를 남긴다(그 정보는 이제 원래 요청자가 아니라 새 소유자에게만 보인다). Rationale 은 이 질문을 기존 트래커 항목에 "등재한다"고 단언하지만, 이 draft 의 `## 변경안` (1)(2)(3) 은 전부 3개 spec 파일 편집뿐이고, 형제 draft(`spec-draft-integration-personal-owner.md`)가 갖는 것과 같은 `## 동반 산출물 (같은 커밋)` 절이 없다 — 즉 이 질문을 실제로 어느 plan 파일의 어느 자리에 어떻게 추가할지가 변경 세트에 없다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 트래커 항목을 grep 해도 (매니저 분기 unit · e2e · 조건부 쓰기 헬퍼) 3개 하위 항목뿐, 이 질문은 아직 어디에도 없다. Rationale 의 서술과 실제 변경 세트가 어긋나 있어, 이 draft 를 그대로 반영하면 "등재했다"는 서술만 남고 실제 등재는 누락될 위험이 있다.
  - 제안: 이 draft 의 `## 변경안`(또는 별도 `## 동반 산출물` 절)에 `spec-draft-nullable-notation-followups.md` 해당 트래커 항목에 이 질문을 하위 항목으로 추가하는 구체적 편집을 포함시키거나, Rationale 문구를 "등재한다"(완료 서술)에서 "등재가 필요하다"(과제 서술)로 낮추고 별도 후속 커밋에서 처리하도록 명시.

### 요약
target 은 `--impl-done` `00_43_55` WARNING 1·INFO 1 이 요구한 두 spec 문서(§1.2 시퀀스·§10.4 에러 매핑)와 `--spec` 잔여 INFO 1(§3.2 상호 참조)을 정확히 겨냥하고 있고, 전제로 삼는 선행 draft(`f47069564`)·어시스턴트 draft(`1e7ee5123`)는 이미 spec 에 반영되어 있으며, 서술하는 코드(`assertRequesterStillAllowed`·`markIntegrationCallbackError`·pending_install 제외)도 실측과 일치한다. 미해결 결정을 우회하거나 후속 plan(`integration-personal-owner-followup.md` 4항목)을 무효화하는 지점은 없다. 다만 이 draft 자신의 Rationale 이 새로 제기한 설계 질문(가시성 없는 행에 `last_error` 를 남기는 것의 타당성)을 트래커에 "등재한다"고 서술하면서 실제 등재 편집이 변경 세트에 빠져 있어, 반영 후 그 질문이 유실될 위험이 있다.

### 위험도
LOW
