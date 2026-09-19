# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** SSRF 차단 메시지 상수를 다른 파일로 옮기며 원래 자리에 있던 상세 JSDoc 을 "고아" 상태로 남겼다 — 이관된 새 문서는 더 짧아 정찰-면-축소 근거(CWE-209)와 Activity API 노출 경위가 빠졌다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:29-37` (Read 로 실측한 실제 파일 줄 번호. 해당 hunk 는 diff 상 `@@ -33,7 +35,6 @@`)
  - 상세: `SSRF_BLOCKED_CLIENT_MESSAGE` 상수 선언은 `http-safety.ts` 로 옮겨졌는데(신규 JSDoc: `http-safety.ts:24-27`, "SSRF 가드가 요청을 막았을 때의 클라이언트 문구. 차단된 host/IP 는 싣지 않는다 — 정찰 면 축소(원본 상세는 서버 로그에만). HTTP Request 노드(`HTTP_BLOCKED` 노드 에러)와 통합 연결 테스트가 같은 문구를 쓴다."), `http-request.handler.ts` 쪽의 원래 5줄짜리 JSDoc 블록(29~37줄)은 상수 선언과 함께 지워지지 않고 그대로 남았다. 지금은 그 블록이 아무 선언도 설명하지 않는 채로 다음 JSDoc(`Strip URL-borne credentials...`)과 `QUERY_PARAM_BLACKLIST` 사이 허공에 떠 있다. 게다가 원본에는 있었지만 새 위치의 JSDoc 에는 빠진 정보가 있다 — "CWE-209" 참조와 "`IntegrationUsageLog`가 Activity API(`GET /integrations/:id/activity`)로 workspace 사용자에게 raw 반환되므로 거기에도 이 일반화 문구를 기록한다"는 문구는 왜 메시지를 반드시 일반화해야 하는지를 설명하는 핵심 근거인데, 이관 과정에서 유실됐다.
  - 제안: 고아가 된 JSDoc 블록을 지우고, CWE-209 근거와 Activity API 노출 경위를 `http-safety.ts` 의 새 JSDoc 에 병합한다.

- **[WARNING]** spec 신규 Rationale 이 아직 존재하지 않는 경로(`plan/complete/...`)를 가리킨다 — 지금 diff 상태로 머지되면 깨진 링크다
  - 위치: `spec/2-navigation/4-integration.md:1174` ("근거·실측: `plan/complete/spec-draft-integration-connection-tests.md`.")
  - 상세: 이 문장이 가리키는 계획 문서는 실제로는 아직 `plan/in-progress/spec-draft-integration-connection-tests.md` 에 있다(`plan/complete/` 에는 존재하지 않음). 해당 draft 자신의 체크리스트 마지막 항목("이 draft `plan/complete/` 로")도 `[ ]`(미완료)로 남아 있어, `complete/` 이동이 아직 실행되지 않았음을 스스로 확인해 준다. 같은 draft 를 참조하는 `plan/in-progress/integration-db-http-testers.md` 의 "왜 지금" 절도 같은 미이동 상태를 전제로 한다. 이번 PR 이 이 상태로 머지되면 spec 문서의 Rationale 인용 경로가 즉시 dangling reference 가 된다.
  - 제안: `plan/complete/` 이동은 이 plan 의 마지막 체크리스트 단계이므로, 이동을 실제로 수행하는 커밋에서 spec 참조 경로가 가리키는 실제 위치와 일치하는지 재확인한다(이동 전에 머지되면 참조를 `plan/in-progress/...` 로 임시 정정하거나, 이동 커밋을 같은 PR 에 포함시킨다).

- **[WARNING]** 이 저장소의 CHANGELOG.md 관례상 "behavior change" 로 기록해 온 것과 같은 성격의 변경인데 항목이 없다
  - 위치: `CHANGELOG.md` (신규 항목 없음) — 비교 대상 변경은 `codebase/backend/src/modules/integrations/integrations.service.ts:404-412`(`database`·`http` transport tester 배선)
  - 상세: `CHANGELOG.md` 는 "Unreleased — **Behavior change**: 모델 연결 테스트의 실패 사유가 화면에 도달한다" 를 비롯해 20여 건의 "이전엔 조용히 성공/실패하던 것이 이제 실제로 검증한다" 류 항목을 일관되게 남기는 관례가 있다. 이번 PR 도 정확히 같은 모양이다 — `database`·`http` 서비스는 구조 검증만 통과하면 항상 `{ success: true }` 였고, 그 성공을 조건으로 하는 `rotate()` 가 틀린 자격증명도 통과시켰다. 이제는 실제로 접속해 인증을 확인하므로, 기존에 (버그 덕에) 통과하던 rotate 호출이 새로 거부될 수 있다 — 이는 기존 사용자에게 보이는 실제 동작 변화다. 강제 규약은 없지만(§harness 어디에도 CHANGELOG 필수 명시 없음), 이 저장소 자체의 반복된 선례가 이런 변경에 항목을 기대하게 만든다.
  - 제안: 기존 항목들과 같은 형식으로 "Unreleased — Behavior change: Database·HTTP 연결 테스트가 이제 실제로 접속한다" 항목을 추가하고, 영향 범위(잘못된 자격증명으로 저장된 기존 통합의 rotate 가 이제 거부될 수 있음)를 명시한다.

## 그 외 확인한 항목 (문제 없음)

- 신규 모듈(`clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `database-connection.ts`, `http-credentials.ts`) 모두 공개 함수/모듈에 spec 절 번호까지 인용하는 JSDoc 이 붙어 있고, 실제 동작(타임아웃 상수·에러 코드 분기·SSRF 처리)과 정확히 일치함을 대조 확인했다.
- `integrations.controller.ts` 의 `@ApiOperation`/`@ApiOkWrappedResponse` Swagger 설명과 JSDoc 주석이 "구조 검증만" → "MCP·Email·Database·HTTP 는 실제 접속" 으로 정확히 갱신되어 실제 배선(`transportTesters` 맵)과 일치한다.
- `PreviewTestResultDto.code` / `TestConnectionResultDto.code` 두 DTO 의 JSDoc 이 새 `DB_*`·`HTTP_*` 코드까지 포함하도록 함께 갱신됐고 서로 교차 참조한다.
- 가이드 문서(`integration-management.mdx`/`.en.mdx`)는 한/영 양쪽에 새 Callout 이 동일한 내용(서비스별 테스트 범위·10초 타임아웃·SSRF 차단 시 주소 미노출)으로 추가됐고, 실제 `DB_TEST_TIMEOUT_MS`/`HTTP_TEST_TIMEOUT_MS` 상수(10,000ms)·4xx/5xx 분기와 정합한다. 한국어 파일의 frontmatter `code:` 목록에 새 테스터 두 파일이 추가됐다(영문 파일은 frontmatter 를 공유하는 구조라 별도 갱신 불필요).
- `database-query.handler.ts`/`http-request.handler.ts` 에서 공유 로직을 새 모듈로 뽑아내면서 원래 있던 `buildPgConnection`의 SSL 정책 설명 주석("`require` now enforces cert verification...")은 고아로 남기지 않고 새 위치(`database-connection.ts`)로 온전히 함께 이동했다 — 위 SSRF 메시지 케이스와 달리 이쪽은 정상 처리됐다.
- 두 신규 unit spec(`database-connection-tester.spec.ts`, `http-connection-tester.spec.ts`)과 신규 e2e(`integration-connection-test.e2e-spec.ts`)는 파일 상단에 spec 절 번호와 "종전에는 어떤 결함이 있었는지"를 설명하는 describe-block 독스트링을 갖추고 있어 예제 코드 역할도 겸한다.
- 신규 plan(`plan/in-progress/integration-db-http-testers.md`)과 spec draft(`plan/in-progress/spec-draft-integration-connection-tests.md`)는 뮤테이션 테스트 실측표·`--impl-prep` 컨센서스 체크 반영 내역까지 기록해 추적성이 높다.
- 새 환경변수는 도입되지 않았다(`ALLOW_PRIVATE_HOST_TARGETS` 는 기존 SSRF 가드가 이미 쓰던 것을 재사용할 뿐이며 `.env.example` 에 이미 문서화돼 있음).

## 뮤테이션/저장소 상태 메모

리뷰 중 저장소에 어떤 파일도 쓰거나 고치지 않았다(뮤테이션 검증 없이 `git diff`/`grep`/`Read` 로만 확인). 세션 시작 시점에 `plan/in-progress/integration-db-http-testers.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 unstaged 로 수정돼 있었는데, 이는 이 리뷰 세션이 만든 변경이 아니다(내용을 보면 같은 작업을 진행 중인 orchestrator/developer 세션이 TEST WORKFLOW 체크박스를 갱신한 것으로 보인다) — 참고로만 남긴다.

## 요약

핵심 구현 파일들의 문서화 품질은 전반적으로 높다 — 새 테스터·공유 모듈 전부가 spec 절 번호를 인용하는 JSDoc 을 갖추고 있고, 이 JSDoc 은 실제 코드 동작과 정확히 일치하며, API 설명(Swagger)·가이드 문서(mdx, 한/영)·DTO 주석까지 이번 동작 변경에 맞춰 일관되게 갱신됐다. 다만 리팩터링 과정에서 SSRF 차단 메시지 JSDoc 이 원래 위치에 고아로 남으면서 이관 대상 위치의 새 문서보다 더 자세했던 근거(CWE-209·Activity API 노출)가 유실됐고, 새로 쓴 spec Rationale 이 아직 존재하지 않는 `plan/complete/...` 경로를 인용하는 시점 문제가 있으며, 이 저장소의 반복된 CHANGELOG 관례에 비추어 이번 behavior change 도 항목이 있어야 자연스럽다. 셋 다 치명적이지 않고 좁은 범위에서 고치기 쉽다.

## 위험도

LOW
