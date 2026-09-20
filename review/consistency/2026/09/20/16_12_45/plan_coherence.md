# Plan 정합성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md` (3차)

## 발견사항

- **[INFO]** 리다이렉트 홉의 `HTTP_TRANSPORT_FAILED` 행 문구가 "가드의 고장" 트리거를 여전히 명시적으로 담지 않음 (1차 CRITICAL → 2차 INFO에서 이월, 이번 개정에서도 미반영)
  - target 위치: `## 변경안 ②` 마지막 괄호 — "(홉 쪽은 기존 `HTTP_TRANSPORT_FAILED` 행이 이미 덮는다.)"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4944행 「**가드 고장이 preflight 냐 리다이렉트 홉이냐에 따라 다른 코드로 나간다 — 그 경로의 회귀 테스트도 없다**」(developer, open `[ ]`)
  - 상세: `spec/4-nodes/4-integration/1-http-request.md:337` 의 `HTTP_TRANSPORT_FAILED` 행 조건은 지금도 "`fetch` reject (DNS / 연결 거부 / 소켓 / `AbortController` timeout)" 로만 적혀 있어, "SSRF 가드가 판정 아닌 오류를 던져 전송 catch 로 떨어진 경우"는 문구에 없다. 코드 경로상 같은 catch 로 수렴해 같은 코드가 나가는 것은 사실(target 의 실측이 맞다)이지만, target 자신이 draft 의 존재 이유로 드는 근거("표가 그 구분을 담지 않으면 다음 사람이 «가드 실패 = 차단» 으로 되돌린다", `## Rationale`)가 정확히 이 행에는 여전히 적용되지 않는다. 2차 검토가 이 점을 INFO로 지적했고 제안대로 "차단 사유 아님"이지만, 개정 diff 를 보면 이 부분은 그대로다 — 트래커 4944행에도 "행 문구 보강" 언급이 아직 없다.
  - 제안: 이번 draft 를 막을 사유는 아니다. `## 비대상` 또는 트래커 4944행에 "코드 통일 여부와 별개로 `HTTP_TRANSPORT_FAILED` 행 문구에 '리다이렉트 홉에서 가드가 판정 아닌 오류를 던진 경우' 트리거를 추가하는 것도 그때 함께 처리" 라는 한 구절을 남겨 두는 편이 안전하다 — 없으면 그 developer 항목 착수자가 "코드는 안 바꾸기로 했으니 문서도 그대로 둔다"로 오독할 수 있다.

- **[INFO]** `1-http-request.md` frontmatter `code:` 편입이 별도 진행 중인 가드 파일 이동 계획과 예정된 재작업으로 다시 부딪힘 (1·2차 검토에서 이미 비차단으로 판단, 3차에서도 유효)
  - target 위치: `## 변경안 ① 1-http-request.md frontmatter code:`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크박스 「**공용 SSRF 가드 `http-safety.ts` 를 `http-request/` 밖 중립 위치로**」(planner+developer, open) — "옮기면 `1-http-request.md` frontmatter `code:` 경로를 함께 바꿔야 한다"고 이미 예고
  - 상세: 지금 추가하는 `http-redirect.ts`·`http-credentials.ts` 경로는 현재 구현 위치 기준으로 정확하다. 다만 그 이동 항목이 실행되면 이번에 늘어난 `code:` 항목 둘도 포함해 리스트 전체를 다시 편집해야 한다 — 충돌이 아니라 예정된 재작업.
  - 제안: 별도 조치 불필요. 이동 항목 실행자가 그 시점에 `http-redirect.ts`·`http-credentials.ts` 둘 다 재조정 범위에 있음을 인지하면 충분.

- **[INFO]** 트래커 `spec-draft-nullable-notation-followups.md` 의 frontmatter `spec_impact` 목록에 이번 target 이 건드리는 4개 spec 파일이 없음 (target 이 만든 문제 아님, 사전 존재 갭)
  - target 위치: 해당 없음 (target 자신의 `spec_impact` frontmatter 는 4개 파일을 정확히 열거해 정상)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact` (1~64행) — `spec/4-nodes/4-integration/0-common.md` · `1-http-request.md` · `2-database-query.md` · `spec/2-navigation/4-integration.md` 넷 다 부재. 트래커 자신의 관례 주석(13~14행)은 "본문 항목이 정정을 요구하는 파일 — 빠지면 `--spec`/`--impl-done` 번들 스코프에서 누락된다"고 명시하는데, 4975행·4993행 두 항목이 바로 이 4개 파일 편집을 요구한다.
  - 상세: 이번 target document 는 별도 plan 파일로 독립 진행 중이고 자체 `spec_impact` 를 올바르게 갖췄으므로 이번 `--spec` 검토 자체에는 영향이 없다. 다만 target 완료 후 체크리스트대로 "트래커 두 항목 해소"로 4975·4993 을 `[x]` 처리하면 이 갭은 자연 소멸한다 — 반대로 두 항목을 지우지 않고 남겨 둔 채 트래커가 나중에 통째로 `--impl-done`/`--spec` 번들 대상이 되면(예: 4944행 developer 항목 처리 시) 같은 4개 파일이 다시 스코프 밖에서 편집될 위험이 있다.
  - 제안: target 의 마감 단계("트래커 두 항목 해소")에서 4975·4993 을 체크할 때, 남아 있는 4944행(가드 고장 시점 통일 미결정)이 같은 파일들을 다시 건드릴 수 있음을 인지하고 그때 `spec_impact` 에 편입할지 판단하면 충분 — 지금 당장 target 을 막을 사유는 아니다.

## 요약

target 은 트래커(`spec-draft-nullable-notation-followups.md`)의 두 planner 체크박스(4975행: `http-redirect.ts` 증거 누락 + 가드 고장 트리거 표기, 4993행: HTTP 연결 테스트 두 코드 + MakeShop §5.9 범위 축소)를 정확히 겨냥하고, 인용한 두 선행 완료 plan(`plan/complete/ssrf-catch-instanceof.md`, `plan/complete/connection-test-codes-and-gaps.md`)은 실제로 `status: complete`·커밋 완료 상태라 전제가 충족돼 있다. 1차 검토가 지적한 CRITICAL(변경안 ②가 트래커의 열린 developer 결정 — 홉/preflight 코드 통일 여부 — 을 단계 구분 없이 암묵적으로 선취)은 실측표로 두 시점을 분리하며 해소됐고, `## 비대상` 서술("두 시점 통일은 트래커의 열린 항목")과 `## 변경안`이 지금은 서로 모순되지 않는다. 2차 검토가 지적한 WARNING 3건(`http-credentials.ts` 동반 누락·spec 본문의 트래커 경로 인용·§5.9 자기모순 문장)도 이번 개정에 모두 반영됐다. 남은 것은 INFO 3건뿐이며 전부 비차단이다 — 두 건은 2차부터 이월된 것(리다이렉트 홉 행 문구 보강 미반영, `http-safety.ts` 이동 시 `code:` 재작업 예고)이고, 한 건은 이번에 새로 확인한 것으로 트래커 자신의 `spec_impact` frontmatter 가 4975·4993 항목이 요구하는 4개 spec 파일을 열거하지 않은 사전 존재 갭(target 이 만든 것이 아니며 두 항목을 `[x]` 처리하면 자연 소멸)이다. 미해결 결정과의 정면 충돌, 선행 plan 미해소, 후속 항목의 실질적 무효화는 발견되지 않았다.

## 위험도
LOW
