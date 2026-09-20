# Plan 정합성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

- **[CRITICAL]** 항목 ②의 «가드의 고장 → `INTEGRATION_CALL_FAILED`» 서술이, target 자신이 "비대상"으로 명시한 미해결 결정(홉/preflight 코드 통일)을 실질적으로 한쪽으로 답한다
  - target 위치: `plan/in-progress/spec-draft-integration-error-facts.md` `### ② «가드의 고장» 트리거 — 세 자리`(`0-common.md §4.2`, `1-http-request.md §4 step 8`·`§4.2` 표 신설 행, `2-database-query.md §6.2`) 및 `## 비대상` 둘째 줄
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 체크박스 「**가드 고장이 preflight 냐 리다이렉트 홉이냐에 따라 다른 코드로 나간다 — 그 경로의 회귀 테스트도 없다**」(developer, 2026-09-20 등재, `/ai-review 2026/09/20/10_38_57` WARNING 1·2, open — `[ ]`)
  - 상세: `plan/complete/ssrf-catch-instanceof.md`(target 이 근거로 인용하는 바로 그 완료 plan, §"호출부마다 정한 기대 동작" 표)에 따르면 HTTP Request 노드에서 SSRF 가드가 판정이 아닌 오류를 던졌을 때 코드는 **단계에 따라 갈린다** — preflight(§4 step 8)는 `INTEGRATION_CALL_FAILED`, 리다이렉트 홉(§4 step 9, `http-redirect.ts`→`outboundBlockReason`)은 `try` 밖 전송 catch 로 떨어져 **`HTTP_TRANSPORT_FAILED`**. 이 비대칭을 어느 방향으로 정리할지(①코드를 승격해 통일 vs ②spec 표에 두 코드를 그대로 명시)는 `spec-draft-nullable-notation-followups.md` 의 위 항목이 아직 "정할 것"으로 열어 두었다. 그런데 target 의 변경안은 `1-http-request.md §4.2` 표에 `SSRF 가드의 고장(판정 아닌 오류)` → `failed` → `INTEGRATION_CALL_FAILED` 행을 **단계 구분 없이** 추가하고, `0-common.md §4.2` 에도 "SSRF 가드가 판정이 아닌 오류를 던진 경우도 이 코드로 surface 된다"를 **일반 규칙**으로 적는다. 이는 리다이렉트 홉 케이스(현재 `HTTP_TRANSPORT_FAILED`)에는 해당하지 않는 문장을 무조건 참인 것처럼 적어 두 갈래 결정 중 (1)안(통일)을 암묵적으로 선취한다. target 스스로 `## 비대상`에 "가드 고장 메시지의 host/IP 마스킹 정책 · **홉/preflight 코드 통일** — 둘 다 developer 항목이고 결정이 남아 있다"고 적어 이 결정을 배제했다고 선언하면서, `## 변경안`에서는 그 결정의 한쪽 답을 문서에 새겨 넣는 자기모순이다. (완화 요인: 해당 dev 항목 자체가 "오늘 도달 불가" — 가드가 낼 수 있는 유일한 비판정 오류(`TypeError`)는 `validateCredentials` 가 API 단에서 막아 현재는 관측 불가 — 이므로 즉각적인 사용자 영향은 없다. 다만 문서가 구현보다 넓게 단언하는 형태이며, 그 dev 항목이 나중에 해소될 때 이번에 추가한 §4.2 행을 다시 고쳐야 한다.)
  - 제안: `1-http-request.md` 쪽 문장/행에 "§4 step 8(preflight)에 한정 — step 9(redirect 홉)의 비판정 오류 처분은 트래커의 `가드 고장이 preflight 냐 리다이렉트 홉이냐…` 항목이 아직 결정하지 않았다"는 한정을 명시하거나(target 의 `## 비대상` 취지와 정합), 아니면 그 developer 결정이 먼저 나올 때까지 `1-http-request.md` 쪽 §4.2 신설 행 자체를 이번 draft 에서 보류하고 `0-common.md`(일반 규칙, DB 노드에는 리다이렉트 개념이 없어 문제 없음)·`2-database-query.md` 둘만 이번 턴에 반영. 어느 쪽이든 target 문서의 `## 변경안 ②`와 `## 비대상`을 서로 맞추는 편집이 필요.

- **[INFO]** ① 프론트매터 `code:` 추가가 별도 진행 중인 파일 이동 계획과 다시 부딪힐 수 있음
  - target 위치: `## 변경안 ① 1-http-request.md frontmatter code:`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 체크박스 「**공용 SSRF 가드 `http-safety.ts` 를 `http-request/` 밖 중립 위치로**」(planner+developer, open). "옮기면 `1-http-request.md` frontmatter `code:` 경로를 함께 바꿔야 한다"고 이미 예고
  - 상세: target 이 지금 추가하려는 `http-redirect.ts` 경로 자체는 현재 구현 위치(`http-request/` 폴더) 기준으로 정확하다. 다만 위 미해결 항목이 실행되면(가드 파일들을 중립 위치로 이동) `code:` 리스트를 다시 편집해야 하므로, 이번 사실 정정이 그 후속 이동 때 재작업 대상이 될 것을 알아 두는 정도의 추적 메모가 유용하다. 충돌이나 차단 사유는 아님.
  - 제안: 별도 조치 불필요 — 해당 이동 항목이 실행될 때 `code:` 재조정 범위에 이번에 추가하는 `http-redirect.ts` 항목도 포함됨을 그 항목 실행자가 인지하면 충분.

## 요약

target 은 트래커(`spec-draft-nullable-notation-followups.md`)의 두 planner 체크박스(①②는 "http-redirect.ts 증거 누락 + 가드 고장 트리거 표기", ③④는 "HTTP 연결 테스트 두 코드 + MakeShop §5.9 범위 축소")를 정확히 겨냥하며, ①③④는 근거·변경안이 구현과 일치하는 순수 사실 정정으로 판단된다. 문제는 ②다 — target 은 `## 비대상`에서 "홉/preflight 코드 통일"을 developer 의 미해결 결정이라 명시적으로 배제하면서도, `## 변경안 ②`에서 `1-http-request.md §4.2` 표에 단계 구분 없는 "SSRF 가드의 고장 → `INTEGRATION_CALL_FAILED`" 행을 추가해 사실상 그 결정의 한 방향(코드 통일)을 문서에 선취한다. `plan/complete/ssrf-catch-instanceof.md` 자신의 표가 보여주듯 현재 코드는 리다이렉트 홉에서 `HTTP_TRANSPORT_FAILED`를 낸다 — 지금은 도달 불가능한 경로라는 완화 요인은 있지만, target 이 스스로 인정한 "결정이 남아 있다"는 서술과 실제로 쓰려는 문장이 충돌한다는 점에서 이 draft 를 spec 에 반영하기 전에 조정이 필요하다.

## 위험도
MEDIUM
