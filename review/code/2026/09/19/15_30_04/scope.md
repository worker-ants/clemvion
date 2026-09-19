# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 기존 프로덕션 핸들러 2개(`database-query.handler.ts`, `http-request.handler.ts`)가 이 PR 에서 함께 리팩터링됐다
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` (`buildPgConnection`·`buildMysqlSsl`·`DbCredentials` 제거 후 `database-connection.ts` import), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (query 조립·리다이렉트 추종·`buildHttpCredentials` 본문을 `http-credentials.ts`/`http-redirect.ts` 로 위임)
  - 상세: 표면적으로는 "Database·HTTP 연결 테스터 추가"이지만 실제로는 두 노드 핸들러의 기존 로직도 함께 옮겨졌다. 다만 이는 무관한 정리가 아니라, `plan/in-progress/integration-db-http-testers.md` §설계에 명시된 대로 "노드 실행과 연결 테스터가 같은 매핑/같은 방식을 쓰지 않으면 테스트 통과가 실행 성공을 보장하지 않는다"는 목적에 직접 종속된 필수 추출이다. 동작 변경 없이 순수 이동(diff 로 확인, `buildPgConnection`/`buildMysqlSsl`/`resolveHttpCredentials`/`followRedirectsSafely`/`appendQueryParams` 로직이 바이트 단위로 동일하게 옮겨짐)이며, 새 위치에 대한 unit spec(`http-credentials.spec.ts` 등)이 별도로 추가돼 회귀 감시도 갖췄다. 범위 위반이라기보다 "공유가 필요한 최소 집합만 추출"이라는 plan 의 명시적 설계 결정이므로 CRITICAL/WARNING 이 아닌 INFO 로 기록한다.
  - 제안: 리뷰어는 이 두 핸들러 diff 를 "동작 로직 재작성"이 아니라 "위치 이동 + 얇은 위임"으로 읽고, 실제 계산 로직 변경 여부만 별도 검증하면 된다(이미 grep/diff 로 대조한 결과 로직 변경 없음).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(무관한 제목의 범용 백로그 트래커)에 이번 작업 중 발견된 9개의 신규 항목이 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (rotate 400 vs 422 불일치, SMTP CGNAT 가드 누락, HTTP 필드 표 `none`/`default_headers` 누락, Google auto-renew 미구현, `account_email`/`login` 필수값 미확인, Google·GitHub·Webhook 테스터 보류, "확인 못 함" 안내 미노출, spec 표기 오류 2건, preview-test 오라클 보안 트레이드오프, `dns.lookup` 스레드풀 잔여 위험, i18n 사전 누락)
  - 상세: 파일명(`nullable-notation-followups`)과 실제로 추가된 내용(연결 테스트 기능 자체의 결함/설계 트레이드오프)이 주제상 무관해 보이지만, 이 문서는 프로젝트 관례상 "spec-impl 갭 범용 트래커"로 이미 쓰이고 있었다(diff 이전에도 `PreviewTestResultDto` code 미선언 항목이 이미 등재돼 있었음). 실제 코드를 고치는 대신 백로그로 넘긴 것은 스코프 확장을 피하는 올바른 판단이며, 각 항목은 이 PR 의 `--impl-prep`/`/ai-review` 산출물을 근거로 등재돼 추적 가능하다. 스코프 위반이 아니라 스코프 관리가 잘 된 사례로 판단해 INFO 로만 남긴다.
  - 제안: 없음(참고용 기록).

- **[INFO]** 같은 브랜치 안에 `docs(spec)` 커밋(`74087dff6`, planner 역할)과 `feat`/`fix`/`test`/`docs(guide)` 커밋(developer 역할)이 섞여 있음
  - 위치: `spec/2-navigation/4-integration.md` (커밋 `74087dff6` 단독 수정, 이후 developer 커밋 `9e91352d8..HEAD` 는 `spec/` 를 건드리지 않음 — `git log --name-only 9e91352d8..HEAD -- spec/` 결과 없음으로 확인)
  - 상세: 역할 경계(§Skill 체계)를 지켰는지 실측했다 — spec 변경은 planner 커밋 하나에 격리돼 있고, 이후 구현 커밋들은 `spec/` 을 전혀 건드리지 않는다. 코드 리뷰 대상 diff(`origin/main...HEAD`)에 spec 파일이 섞여 보이는 것은 같은 worktree/브랜치에서 planner→developer 턴이 이어졌기 때문이며, 실제 저자와 책임 분리는 깨지지 않았다.
  - 제안: 없음(검증 결과 문제 없음).

## 요약

45개 변경 파일을 `origin/main...HEAD` 전체 diff 로 대조한 결과, 신규 파일(테스터 본체·공유 모듈·테스트)은 전부 "Database·HTTP 연결 테스트가 실제로 접속한다"는 선언된 목표에 정확히 대응하고, 기존 파일 수정(controller/DTO 설명, 두 노드 핸들러의 로직 추출, `integrations.service.ts` 의 배선·동시성 상한·rotate 부분 저장)은 모두 같은 PR 안의 3라운드 리뷰 피드백에 커밋 메시지로 추적 가능하게 연결돼 있다. `p-limit` 은 이미 `package.json` 에 존재하던 의존성이라 신규 도입이 아니며, lockfile 변경도 없다. spec 변경은 planner 단일 커밋에 격리되어 있고 developer 커밋은 `spec/` 를 건드리지 않아 역할 경계도 지켜졌다. 무관한 파일·포맷팅·주석·불필요 리팩토링·기능 확장(over-engineering) 성격의 변경은 발견되지 않았으며, 발견 못한 갭은 코드로 고치는 대신 기존 백로그 트래커에 항목으로만 등재해 스코프 확장을 스스로 억제한 흔적이 뚜렷하다.

## 위험도

NONE
