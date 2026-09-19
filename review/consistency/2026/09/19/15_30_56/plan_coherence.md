# Plan 정합성 검토 — `plan/in-progress/spec-draft-integration-db-test-waits.md`

## 발견사항

- **[WARNING]** 트래커 항목 "4-integration.md 소소한 표기 두 건" 이 반씩만 해소되는데 그 분리가 반영되지 않음
  - target 위치: `plan/in-progress/spec-draft-integration-db-test-waits.md` §변경-B, «비대상» 절, 체크리스트(3항목 모두 트래커 갱신 언급 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `- [ ] **4-integration.md 소소한 표기 두 건**` 항목 (파일 내 "§6 이 연결 테스트 endpoint(:id/test)를 §9.3 으로 가리킨다 — 실제로는 §9.1... §14.1 이 노드 런타임 코드를 HTTP_{status} 로 적는 자리와 리터럴 HTTP_4XX · HTTP_5XX 로 적는 자리가 섞여 있다" 부분)
  - 상세: 이 트래커 항목은 §6→§9.3 오기재와 §14.1 `HTTP_{status}`/`HTTP_4XX` 혼용, 두 하위 문제를 **하나의 미체크 항목**으로 묶어 등재하고 있다. target 의 변경 B 는 이 중 §6→§9.3 부분을 정확히 정정한다(spec 실측으로 §9.1 이 맞음을 이 검토에서 직접 대조 확인 — `:id/test` 행과 `pending_install` 가드 서술은 §9.1 표에, §9.3 은 "사용처·활동"). target 은 §14.1 부분만 "트래커에 남긴다" 고 명시하지만, §6 부분이 이 PR 로 해소된다는 사실을 트래커 쪽에 반영(체크 해제/분리/각주)하도록 지시하지 않는다. 이대로 머지되면 트래커에는 이미 고쳐진 §6/§9.3 오기재가 여전히 "미해결 두 건" 중 하나로 남아, 다음에 이 항목을 보는 사람이 이미 끝난 일을 다시 조사하거나 반대로 §14.1 항목까지 실수로 함께 닫아버릴 위험이 있다.
  - 제안: target 의 체크리스트(또는 dev plan `integration-db-http-testers.md` 의 "트래커 반영" 항목)에 "`spec-draft-nullable-notation-followups.md` 의 '4-integration.md 소소한 표기 두 건' 항목을 §14.1 단독 항목으로 축소(§6/§9.3 부분은 이 PR 로 해소돼 제거)" 를 명시적으로 추가.

- **[INFO]** dev plan 종결 체크리스트가 "spec draft" 단수를 참조 — 이제 spec draft 가 둘
  - target 위치: `plan/in-progress/spec-draft-integration-db-test-waits.md` 체크리스트 3항 "이 draft `plan/complete/` 로 (구현 plan 과 같은 PR 의 마무리 커밋)"
  - 관련 plan: `plan/in-progress/integration-db-http-testers.md` 체크리스트 마지막 항 "트래커 반영(«비대상» 여섯 등재) · **이 plan 과 spec draft `complete/` 이동**" (단수 "spec draft" — 작성 시점엔 `spec-draft-integration-connection-tests.md` 하나뿐이었다), 그리고 `plan/in-progress/spec-draft-integration-connection-tests.md` 자신의 체크리스트도 "구현" · "트래커 등재 · 이 draft `plan/complete/` 로" 두 항목이 아직 미체크 상태(실제로는 dev plan 쪽에서 이미 구현·테스트·가이드가 완료됨 — 체크박스만 stale).
  - 상세: 같은 PR/마무리 커밋에서 `plan/complete/` 로 옮겨야 할 spec draft 가 이제 `spec-draft-integration-connection-tests.md` 와 이 target `spec-draft-integration-db-test-waits.md` 두 개다. dev plan 의 종결 항목 문구는 여전히 단수형이라, 마무리 커밋을 만드는 사람이 두 draft 중 하나(특히 이미 "완료"로 착각하기 쉬운 원조 draft)를 빠뜨릴 여지가 있다. 직접적인 결정 충돌은 아니고 정리 시점에 자연히 잡힐 가능성이 높아 INFO 로 낮춘다.
  - 제안: 마무리 커밋 시 두 spec draft(`spec-draft-integration-connection-tests.md`, `spec-draft-integration-db-test-waits.md`) 모두의 남은 체크박스를 채우고 함께 `plan/complete/` 로 이동. 여유가 있으면 dev plan 체크리스트 문구를 "두 spec draft" 로 갱신.

## 요약

target 문서(§5.4 쿼리 대기 정정, §6 §9.3→§9.1 정정)는 두 항목 모두 사실 정정이며, 스펙 본문을 직접 대조한 결과 두 정정 모두 옳다(§5.4 는 현재 "연결 대기는 10초"만 적어 구현의 쿼리 타임아웃과 어긋나고, `:id/test`/`pending_install` 서술은 §9.3 이 아니라 §9.1 표에 있다). 미해결 결정을 우회하는 내용은 없고, 선행 조건(같은 브랜치 구현·리뷰)도 이미 해소돼 있다. 다만 target 의 변경 B 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커의 기존 미체크 항목("4-integration.md 소소한 표기 두 건")을 절반만 해소하는데 그 트래커 갱신(분리/축소)이 target 체크리스트에 반영돼 있지 않다 — 이 한 건이 유일한 실질적 정합성 갭이다. 부수적으로 같은 PR 로 완료돼야 할 spec draft 가 이제 두 개인데 dev plan 의 종결 문구가 아직 단수를 가리키는 점도 낮은 위험으로 남는다.

## 위험도

LOW
