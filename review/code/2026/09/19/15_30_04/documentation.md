# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 아직 `plan/in-progress/`에 있는 두 plan 을 `plan/complete/` 경로로 전방 참조(dangling forward-reference)한다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3594`, `:4761`, `:4788`
  - 상세: 세 곳에서 `` `plan/complete/integration-db-http-testers.md` ``(3594, 4788) 와
    `` `plan/complete/spec-draft-integration-connection-tests.md` ``(4761) 를 이미 완료된 것처럼 인용한다.
    그러나 실제 파일은 둘 다 `plan/in-progress/` 에 그대로 있고(`plan/complete/` 에는 해당 파일이 존재하지 않음),
    `integration-db-http-testers.md` 자신의 체크리스트도 "TEST WORKFLOW" · "`/ai-review`" ·
    "`--impl-done`" · "트래커 반영 · `complete/` 이동" 네 항목이 아직 `[ ]`(미완료)다. 이 문서 규약상
    `plan/complete/` 이동은 라이프사이클 조건을 충족한 뒤의 별도 동작인데, 참조가 그 이동을 앞서가 다음 사람이
    `plan/complete/integration-db-http-testers.md` 를 열어보면 찾지 못한다(경로 존재 확인함, `ls`: No such file or
    directory).
  - 제안: 두 plan 이 실제로 `complete/` 로 이동하는 커밋에서 참조 경로를 확정하거나, 그 전까지는
    `plan/in-progress/...`(현재 위치)로 인용하고 "완료 예정" 표현으로 남긴다.

- **[INFO]** CHANGELOG 항목의 동시 상한 설명 문장이 두 줄로 쪼개져 두 번째 줄이 독립 문장처럼 보인다
  - 위치: `CHANGELOG.md:17-18`
  - 상세: "…2개까지다 — 넘는 요청은 줄을 선다.\n  응답하지 않는 DNS 를 가리키는 테스트가 겹쳐 libuv 스레드풀을
    채우지 못하게." — 두 번째 줄이 서술어 없이 목적절만 있어(앞 문장에 종속) 단독으로 읽으면 어색하다.
    다른 CHANGELOG 항목들의 문장 구성과 비교하면 사소한 스타일 편차다.
  - 제안: "…줄을 선다 — 응답하지 않는 DNS 를 가리키는 테스트가 겹쳐 libuv 스레드풀을 채우지 못하게." 처럼
    한 문장으로 합치면 더 명확하다. 차단 사유는 아니다.

## 확인해 본 항목 (이상 없음)

- `clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`,
  `database-connection.ts`, `http-credentials.ts`, `http-redirect.ts` 모두 공개 함수·모듈에
  분기별 결과 코드까지 명시한 JSDoc/한글 독스트링이 충실히 달려 있고, spec 문서 절 번호까지
  교차 참조한다.
- `integrations.service.ts` 에서 `clampMessage` 를 `clamp-message.ts` 로 옮기면서 원래 있던
  독스트링도 함께 이동했고(옛 위치에 죽은 주석이 남지 않음), 새 위치의 독스트링은 email·database·http
  테스터 공용이라는 사실까지 갱신해 반영했다 — 오래된 주석 없음. 새로 추가된
  `CONNECTION_TEST_MAX_CONCURRENCY` 상수는 왜 이 값(2)인지, libuv 스레드풀 크기와의 관계, MCP 가 이
  가드를 완전히 만족시키지 못하는 이유까지 상세히 설명한다.
- `IntegrationsController` 의 `preview-test`·`rotate` 두 엔드포인트 Swagger `@ApiOperation` 설명과
  코드 위 JSDoc 이 새 동작(실제 접속 테스터 존재)에 맞게 갱신됐고, `@ApiBadRequestResponse` 에도
  `INTEGRATION_TEST_FAILED` 케이스가 추가됐다.
- `PreviewTestResultDto.code` 신규 필드, `TestConnectionResultDto.code` 코멘트 갱신 — 새 `DB_*`/`HTTP_*`
  코드 네임스페이스를 반영했고 형제 DTO 관계도 `{@link}` 로 명시했다.
- 사용자 가이드(`integration-management.mdx`/`.en.mdx`) 양쪽 언어 모두 새 Callout 으로 서비스별 연결
  테스트 범위(실제 접속 vs 형식 검증만), Database/HTTP 세부 동작, SSRF 예외 조건을 설명하도록
  업데이트됐고, frontmatter `code:` 목록에 신규 테스터 파일 두 개가 추가돼 있다 — README 격인 문서
  갱신 요건을 충족한다.
- `spec/2-navigation/4-integration.md` — §3.3·§5.1·§5.2·§5.3·§5.4·§5.7·§9.2·§9.4·§10.3·§10.5·§14.1·
  Rationale 이 한 커밋(`74087dff6`)에서 일관되게 갱신됐다. 새 에러 코드(`DB_AUTH_FAILED` 등)가 §14.1
  표에 추가되면서 노드 런타임 코드와의 모집합 차이(`DB_CONNECT_FAILED` vs `DB_CONNECTION_ERROR`)까지
  명시했고, Rationale 절이 범위 결정 배경(Google/GitHub/Webhook 은 왜 제외했는지)을 근거와 함께 기록한다.
- `CHANGELOG.md` 신규 항목은 사용자 영향("배포 뒤 보일 수 있는 것")까지 포함해 형식이 다른 기존 항목들과
  일치한다.
- `smtp-host-guard.ts`/`nodes/core/error-codes.ts` 의 "HTTP 가드와 SMTP 가드가 사실은 다른 구현"이라는
  기존 오기(stale comment)는 이 PR 의 diff 범위 밖이며(`git diff origin/main` 무변경 확인), 이미
  `spec-draft-nullable-notation-followups.md:4769` 의 별도 백로그 항목으로 등재돼 있어 재지적 불필요.
- `SSRF_BLOCKED_CLIENT_MESSAGE` 를 `http-safety.ts` 로 옮긴 뒤 `http-request.handler.ts` 가 리터럴
  대신 그 상수를 import 해서 쓰는지 확인함 — 일치, 중복 문자열 없음.

## 요약

핵심 코드(테스터 2종·공유 모듈·서비스·컨트롤러·DTO)의 독스트링·Swagger 설명·주석은 이번 diff 안에서 매우
꼼꼼하게 갱신됐고, spec·사용자 가이드(ko/en)·CHANGELOG 까지 같은 PR 에서 동기화돼 문서화 품질이 높다.
유일하게 실질적인 문제는 `spec-draft-nullable-notation-followups.md` 세 곳이 아직 `in-progress` 인 두
plan 을 `complete/` 경로로 앞서 인용해 다음 독자가 파일을 찾지 못하게 만드는 전방 참조 오류이며, 그 외에는
CHANGELOG 문장 하나의 사소한 스타일 편차만 있다.

## 위험도

LOW
