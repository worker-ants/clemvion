# 문서화(Documentation) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기

## 발견사항

- **[WARNING]** `database-query.handler.ts` 의 기존 인라인 주석이 이번 diff 로 더 이상 사실과 맞지 않게 됨(오래된 주석)
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:338-342`
  - 상세: 해당 주석(이번 diff 로 수정되지 않은 기존 텍스트)은 "SSRF guard 의 plain Error 는 위에서 `DB_HOST_BLOCKED` IntegrationError 로 승격되므로 더 이상 mapDbError fallback(`INTEGRATION_CALL_FAILED`)으로 흐르지 않는다" 고 서술한다. 이는 이번 diff 이전(가드가 던진 것을 **무조건** `DB_HOST_BLOCKED` 로 승격하던 시절)의 동작을 정확히 설명하던 문장이다. 그런데 바로 위 262-288행이 이번 diff 로 `instanceof SsrfBlockedError` 로 갈라져, 이제 가드 실패는 판정(`DB_HOST_BLOCKED`)과 비판정(`INTEGRATION_CALL_FAILED`) 두 갈래로 나뉜다. 338-342행의 결론("mapDbError fallback 으로 흐르지 않는다")은 여전히 참이지만(비판정도 `IntegrationError` 로 던져지므로 `err instanceof IntegrationError` 분기를 그대로 탄다), "SSRF guard 의 plain Error 는 `DB_HOST_BLOCKED` 로 승격되므로" 라는 근거 문장은 더 이상 전체 그림을 설명하지 못한다 — 다음 사람이 이 주석만 보고 "SSRF 가드 실패는 늘 `DB_HOST_BLOCKED` 다" 라고 오해할 수 있다.
  - 제안: 338-342행을 "SSRF guard 실패는(판정=`DB_HOST_BLOCKED`, 비판정=`INTEGRATION_CALL_FAILED`) 모두 위에서 `IntegrationError` 로 승격되므로" 정도로 갱신해 두 갈래를 모두 반영.

- **[WARNING]** `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 가 이번 PR 이 직접 수정한 `http-redirect.ts` 를 여전히 누락(머지 시점 기준 미해소)
  - 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 블록 (파일 4번째~8번째 줄)
  - 상세: `--impl-prep` 단계의 `convention_compliance` checker 가 이미 같은 갭을 WARNING #2 로 지적했고(`review/consistency/2026/09/20/09_06_34/convention_compliance.md`), plan 체크리스트 1항은 "둘 다 마무리 커밋에서 등재한다" 고 적어 두었다. 그런데 이 리뷰 시점(머지 후)에도 frontmatter `code:` 는 여전히 `http-request.handler.ts`/`http-request.schema.ts`/`http-safety.ts`/`sanitize-response-headers.util.ts` 넷만 나열하고, §4 step 9(리다이렉트 5홉 수동 follow + 매 홉 SSRF 재검증)를 실제로 구현하는 `http-redirect.ts` 는 빠져 있다 — 이번 diff 가 바로 그 파일의 SSRF 판정 분기를 고쳤음에도 그렇다. `developer` 는 `spec/` 쓰기 권한이 없으므로(자기-반증형 소정정 5조건에도 해당 안 됨 — 예고 문장의 정정이 아니라 증거 목록 누락), 이 항목은 planner 턴으로 넘겨야 한다.
  - 제안: plan 의 남은 체크리스트(`--impl-done`, 트래커 해소)를 마무리하기 전에 project-planner 턴에서 `code:` 목록에 `http-redirect.ts` 를 추가.

- **[INFO]** `testDatabaseConnection`/`testHttpConnection` 의 JSDoc 결과-코드 표가 새 트리거(가드의 비판정 오류)를 예시로 들지 않음
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:125-134` (특히 133행 "그 밖(네트워크 · 타임아웃 · TLS · 없는 database 등) → `DB_CONNECT_FAILED`"), `codebase/backend/src/modules/integrations/http-connection-tester.ts:74-87` (특히 84행 "네트워크 · 타임아웃 · TLS → `HTTP_CONNECT_FAILED`")
  - 상세: 두 JSDoc 모두 "등"/열거형 예시로 그 밖의 실패를 뭉뚱그려 `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 로 문서화하고 있어 기술적으로 틀린 것은 아니다. 다만 이번 diff 가 두 함수에 각각 "가드가 판정 아닌 오류를 던지면" 이라는 새로운(그리고 각 파일에 전용 테스트가 추가된) 트리거 경로를 만들었는데, JSDoc 예시 목록에는 반영되지 않았다 — 코드 안의 인라인 주석(예: `database-connection-tester.ts` 143-146행)에는 이유가 상세히 적혀 있지만 함수 상단 계약 요약에는 없다.
  - 제안: 각 JSDoc 의 `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED` 항목에 "(SSRF 가드 자체의 고장 포함)" 정도의 문구를 덧붙이면 함수 시그니처만 보고 계약을 파악하려는 다음 독자에게 도움이 된다. 블로킹 사안은 아님.

- **[INFO]** spec 표(§4.2/§6.2)의 `INTEGRATION_CALL_FAILED` 신규 트리거 사례 미기재는 이미 추적 중 — 재확인만
  - 위치: `spec/4-nodes/4-integration/0-common.md` §4.2, `spec/4-nodes/4-integration/1-http-request.md` §4.2, `spec/4-nodes/4-integration/2-database-query.md` §6.2
  - 상세: `--impl-prep` 단계 `cross_spec` checker 가 이미 INFO #1 로 같은 갭("SSRF 가드가 판정 아닌 오류를 던진 경우"가 두 표에 열거되어 있지 않음)을 잡았고 plan 체크리스트에도 반영돼 있다(`--impl-done` 이후 project-planner 턴). 문서화 관점에서도 동일하게 유효한 지적이므로, 이 plan 의 나머지 체크리스트(`--impl-done`, 트래커 해소)를 닫기 전에 함께 처리되는지 확인 필요 — 새 결함은 아니고 기존 추적 항목의 재확인.
  - 제안: 별도 조치 불요(이미 계획됨). `--impl-done` 이후 project-planner 턴 누락 여부만 후속 확인.

- **[INFO]** CHANGELOG.md 미갱신은 이번 diff 의 실측(“지금 동작 차이가 없다”)과 일치 — 결함 아님
  - 위치: `CHANGELOG.md` (신규 항목 없음)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "배포 뒤 보일 수 있는 것" 섹션을 갖춘 사용자-관측 가능한 동작 변경(예: `ea27c21b3` 의 IPv4-mapped IPv6 차단)을 기록한다. 이번 plan 문서(`plan/in-progress/ssrf-catch-instanceof.md` 29-33행)는 "지금 동작 차이가 없다는 것은 실측이다" — 현재 가드 구현이 던지는 것은 전부 `SsrfBlockedError` 뿐이라 비판정 경로에 아직 아무도 도달하지 않는다 — 라고 명시적으로 근거를 남겼다. 오늘 시점엔 사용자에게 보일 변화가 없으므로 CHANGELOG 항목 생략은 타당하다.
  - 제안: 조치 불요. 다만 향후 가드에 실제 비판정 실패 경로가 생겨 이 분기가 처음 발동하는 시점에는 CHANGELOG 갱신을 고려할 것(참고용, 이번 PR 범위 아님).

- **[INFO]** 이번 diff 가 새로 추가/수정한 문서(인라인 주석·JSDoc·테스트 docstring)는 전반적으로 정확하고 근거가 충실함 — 긍정 관찰
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:21-29`(`outboundBlockReason` JSDoc), `codebase/backend/src/modules/integrations/http-connection-tester.ts:124-127`(`try` 블록 이동 사유), 네 핸들러/테스터의 판정-분기 inline 주석, `http-redirect.spec.ts`/각 `*.spec.ts` 신규 `it()` 앞의 근거 주석
  - 상세: 각 주석이 "왜 SsrfBlockedError 로만 판정을 좁히는지", "그 밖의 오류를 삼키면 어떤 거짓 보고가 생기는지", "no-throw 계약이 왜 지켜져야 하는지" 를 구체적으로 설명하고, SMTP 가드 선례·`dispatchTest` 계약·`spec/5-system/3-error-handling.md` §6.3.1 C2 등 근거를 정확히 인용한다. 향후 유지보수자가 "왜 instanceof 체크가 필요한가" 를 다시 찾아 헤매지 않아도 되는 수준.
  - 제안: 없음(모범 사례로 유지).

## 요약

이번 diff 는 코드 자체에 대한 문서화(인라인 주석·JSDoc·테스트 docstring)는 매우 충실하다 — 새로 추가한 설명은 전부 정확하고 근거가 있다. 다만 diff 가 건드리지 않은 **기존** 주석 하나(`database-query.handler.ts` 338-342행)가 이번 변경으로 사실과 어긋나게 되었고(WARNING), 이미 알려진 spec 증거 갭(frontmatter `code:` 의 `http-redirect.ts` 누락, WARNING)이 머지 시점까지 해소되지 않았다. 나머지는 INFO 수준의 완전성 개선 여지(JSDoc 예시 목록, spec 트리거 표)로 이미 plan 에 후속 추적이 명시돼 있다. README·API 문서·환경변수 문서는 이번 변경의 영향 범위 밖(내부 catch 분류 리팩토링, wire 계약 불변)이라 갱신 불요.

## 위험도

LOW
