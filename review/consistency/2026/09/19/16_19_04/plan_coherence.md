# Plan 정합성 검토 — `spec/2-navigation/4-integration.md` (impl-done)

## 발견사항

- **[INFO]** 코드 리팩터링이 `node-output-redesign` 감사 plan 의 라인 인용을 미세하게 어긋나게 만든다
  - target 위치: 구현 diff — `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`(806→762줄), `database-query/database-query.handler.ts`(공유 로직 `database-connection.ts` 로 이동)
  - 관련 plan: `plan/in-progress/node-output-redesign/http-request.md`(§8 잔여 항목이 `http-request.handler.ts:357,366`·`:405-426`·`:492`·`:554-580`·`:697-772` 등 정확한 라인을 인용), `plan/in-progress/node-output-redesign/database-query.md`(`:192-292`·`:223-232`·`:632-648` 등)
  - 상세: 이번 PR 이 `buildPgConnection`·`buildMysqlSsl`·`DbCredentials`(database-query 쪽), `buildHttpCredentials` 보조 로직 일부·redirect 로직(`followRedirectsSafely`)을 새 공유 모듈로 뽑아내면서 두 handler 파일의 라인이 밀렸다(HTTP_BLOCKED 참조가 `:357,366`→실측 `:369,378,429`, `buildHttpCredentials` 가 `:697-772`→실측 `:722~`). 다만 확인한 범위에서 SSRF 차단이 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 로 라우팅되는 **결론 자체는 변하지 않았다** — 실제로 어긋난 것은 라인 번호뿐이다. 두 plan 문서는 이미 "N차 갱신(코드 재검증)" 형태로 주기적 라인 재확인을 관행화하고 있어 이번 드리프트도 같은 패턴으로 흡수 가능한 크기다.
  - 제안: CRITICAL/WARNING 조치는 불요. 다음에 두 node-output-redesign 문서를 열 때 "2026-09-19(이 PR) 이후 라인 재검증 필요" 한 줄만 추가해 두면 다음 독자가 인용을 신뢰하지 않도록 돕는다. 이번 PR 의 체크리스트에 추가할 필요는 없음(범위 밖 문서).

- **[INFO]** target Rationale · tracker 가 아직 `plan/in-progress/` 에 있는 draft 를 `plan/complete/` 경로로 앞서 인용
  - target 위치: `spec/2-navigation/4-integration.md` `## Rationale` 신설 절 "연결 테스트 — Database · HTTP 는 실제로 접속한다…" 말미 "근거·실측: `plan/complete/spec-draft-integration-connection-tests.md`."
  - 관련 plan: `plan/in-progress/spec-draft-integration-connection-tests.md`(아직 in-progress, 미이동) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 새 항목들이 `plan/complete/integration-db-http-testers.md`·`plan/complete/spec-draft-integration-connection-tests.md`·`plan/complete/spec-draft-integration-db-test-waits.md` 를 인용)
  - 상세: 세 plan 문서 모두 `ls` 로 확인한 결과 `plan/complete/` 에는 아직 존재하지 않는다(`plan/in-progress/` 에만 있음). 세 문서의 체크리스트는 공통적으로 "이 draft/plan `plan/complete/` 로 이동(같은 PR 의 마무리 커밋)" 을 마지막 미체크 항목으로 남겨 두고 있어, 이 forward-reference 는 **의도된 선반영**(마무리 커밋에서 함께 이동)으로 읽힌다. 다만 지금 시점만 보면 target spec 과 트래커가 가리키는 경로가 존재하지 않는 dangling reference 다 — 이 PR 의 `--impl-done` 이후 "트래커 반영 · 이동" 체크리스트 항목이 누락된 채 병합되면 영구적으로 깨진 링크가 된다.
  - 제안: 새로 만들 필요는 없다 — 이미 각 plan 체크리스트에 "이동" 항목이 있으므로, 그 항목 수행(git mv + 커밋)을 잊지 않도록 마무리 단계에서 재확인만 하면 된다.

## 요약

target(`spec/2-navigation/4-integration.md`)의 이번 변경은 세 plan 문서(`integration-db-http-testers.md` 구현 plan, `spec-draft-integration-connection-tests.md`·`spec-draft-integration-db-test-waits.md` spec draft) 가 이미 사용자 결정·`--spec`/`--impl-prep` 리뷰를 거쳐 합의한 내용을 그대로 반영한 것으로 확인된다. 트래커(`spec-draft-nullable-notation-followups.md`)에 남아 있는 "결정 필요" 항목들(rotate 400/422, SMTP CGNAT, §5.3 필드 표, Google auto-renew, preview-test 오라클 위험, dns.lookup 스레드풀, 동시 rotate 덮어쓰기 등) 은 target 이 어느 쪽으로도 선결하지 않고 정확히 열어 둔 채 등재했다 — 미해결 결정을 우회한 사례는 없다. rotate() 코드(`update` 미조건부 갱신)를 직접 확인한 결과도 트래커가 "여전히 열려 있다"고 적은 동시성 갭과 일치해 서술과 실측이 어긋나지 않는다. 발견된 두 건은 모두 INFO 수준 — 리팩터링에 따른 다른 in-progress plan(`node-output-redesign/*`)의 라인 인용 드리프트, 그리고 마무리 커밋을 앞서 가리키는 `plan/complete/` forward-reference — 이며 어느 쪽도 결정 충돌·선행조건 미해소·후속항목 누락에 해당하는 차단 사유는 아니다.

## 위험도

LOW
