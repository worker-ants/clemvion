# 변경 범위(Scope) 리뷰

검토 대상: `origin/main`(`53335867a`) 대비 현재 브랜치 42개 파일 diff(Database·HTTP 연결 테스트 구현 + 관련 spec/plan/review 산출물).

## 발견사항

- **[INFO]** `database-query.handler.ts` · `http-request.handler.ts` 의 로직 추출(리팩토링)이 이번 PR 범위에 섞여 있다
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`(`buildPgConnection`·`buildMysqlSsl`·`DbCredentials` 삭제), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`(`HttpCredentials`·`buildHttpCredentials` 본문·redirect follow 루프 삭제)
  - 상세: 두 핸들러에서 로직을 각각 `database-connection.ts`/`http-credentials.ts`/`http-redirect.ts` 새 모듈로 꺼냈다. 겉으로는 "핸들러 리팩토링"이라 스코프 이탈처럼 보이지만, `git diff -w`로 대조한 결과 공백만 다른 게 아니라 실제로 동일 로직을 그대로 옮긴 것이고(동작 변경 없음), `plan/in-progress/integration-db-http-testers.md` §설계에 "노드와 연결 테스터가 같은 매핑을 쓰도록 공유 모듈로 뺀다 — 안 그러면 순환 import"라고 사전에 명시돼 있다. 즉 이번 기능(연결 테스터가 노드와 동일한 연결 로직을 재사용해야 함)이 직접 요구하는 추출이지 무관한 정리가 아니다. 스코프 이탈은 아니라고 판단하지만, 이 리팩토링이 "기능 추가"와 한 커밋(diff)에 섞여 있다는 점은 기록해 둔다.
  - 제안: 조치 불요(설계 문서로 사전 정당화됨). 리뷰 참고용 기록.

- **[INFO]** `integrations.service.ts` 의 `rotate()` 부분 저장(partial save) 리팩토링과 동시성 상한(`p-limit`) 도입이 "테스터 추가"라는 원 목적보다 넓은 변경이다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()`(`entity.credentials = merged; ...; save(entity)` → `save({id, ...changes}); Object.assign(entity, changes)`), `connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)` 신설
  - 상세: 둘 다 원래 계획(§설계)에는 없었고 커밋 메시지(`eebf0286a fix(integrations): 연결 테스트 리뷰 1라운드 — 동시 상한 · rotate 부분 저장 · 리다이렉트 추종 공유`)와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목("연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다")이 밝히듯, DB·HTTP 테스터가 실제 네트워크 I/O(수 초 대기)를 갖게 되면서 **이번 PR 자신이 새로 만든** 레이스(구식 `save(entity)` 가 그사이 `logUsage` 의 원자적 update 를 되돌림)와 자원 고갈(연결 테스트 동시 실행이 libuv 스레드풀을 채움) 문제를 고치는 것이다. 즉 기능 추가가 유발한 결함의 수정이지, 관련 없는 코드 정리가 아니다.
  - 제안: 조치 불요. 다만 두 항목 모두 "테스터 구현"과 "테스터가 드러낸 기존 결함 수정"이 한 PR에 묶여 있다는 점은 다음 리뷰어가 diff 크기를 판단할 때 참고할 사실이다.

- **[INFO]** 대량의 `review/consistency/**` · plan 파일이 diff 에 포함되어 있으나 이는 저장소 SDD 워크플로의 정규 산출물이다
  - 위치: `review/consistency/2026/09/19/13_03_41/**`, `review/consistency/2026/09/19/13_21_00/**`(총 17개 파일), `plan/in-progress/integration-db-http-testers.md`, `plan/in-progress/spec-draft-integration-connection-tests.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 이 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치" 표, `feedback_plan_checkbox_actual_state.md`)상 `review/`는 gitignore 대상이 아니며 `--spec`/`--impl-prep` consistency-check 산출물과 plan 갱신은 정규 커밋 대상이다. 실제로 이 두 세션 산출물은 이번 기능(§2-navigation/4-integration.md 개정)에 대한 사전 검토 기록이고 새 파일 추가 외의 내용 변경은 없다(`git diff --stat` 확인). 코드 스코프 이탈이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 에 이번 작업 중 발견한 6개 이상의 무관한 결함(rotate 400/422 불일치, SMTP CGNAT 누락, Google 자동갱신 미구현 등)을 인라인으로 고치지 않고 "비대상" 백로그 항목으로만 등재했다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 삽입 블록(라인 4760~4814 부근, "rotate 의 테스트 실패 응답이 400 인데 spec 은 422" 등 6항목)
  - 상세: 이는 오히려 스코프 규율이 잘 지켜진 사례다 — 작업 중 발견한 부수적 결함을 이번 PR 코드에 끼워 고치지 않고 별도 트래커 문서에 기록만 남겼다. 코드 diff(파일 1~21)에는 이 항목들에 대응하는 실제 수정이 없음을 확인했다.
  - 제안: 조치 불요(긍정적 관측).

- **[INFO]** `plan/in-progress/integration-db-http-testers.md` 의 working-tree 미커밋 변경(체크박스 하나 tick)은 이번 diff(42파일) 밖의 후속 작업 상태다
  - 위치: `plan/in-progress/integration-db-http-testers.md` — `- [ ] TEST WORKFLOW …` → `- [x] TEST WORKFLOW … PASS`
  - 상세: `git status`에서 이 파일만 `M`(unstaged)이고, 리뷰 대상 diff(브랜치 vs `origin/main`)에는 이미 `[ ]` 상태로 포함돼 있다. 이 리뷰가 검토하는 코드 변경 범위와는 무관한 plan 진행상황 갱신이라 스코프 판단 대상이 아니다.
  - 제안: 조치 불요. 참고용 기록.

포맷팅·주석·임포트·설정 파일 관점에서는 이탈이 발견되지 않았다: `git diff -w`(공백 무시)와 일반 diff의 변경 줄 수가 완전히 동일해 포맷팅만 바뀐 파일이 없고, 임포트 변경은 전부 이번에 추출한 신규 모듈(`clamp-message.ts`·`database-connection.ts`·`http-credentials.ts`·`http-redirect.ts`) import 로의 치환뿐이며 미사용 임포트 추가는 없다. `integration-cache-invalidate.e2e-spec.ts`의 `base_url` 필드 제거는 새 HTTP 테스터가 실제 네트워크 호출을 하게 된 데 따른 fixture 조정으로, 회전(rotate) 브로드캐스트 e2e 자체의 의도와 직접 연결된 최소 수정이다.

## 요약

42개 파일 diff는 CHANGELOG/커밋 히스토리가 서술하는 목표("Database·HTTP 연결 테스트가 실제로 접속한다")와 그로 인해 노출된 파생 결함 수정(동시성 상한, rotate 부분 저장, 노드-테스터 로직 공유를 위한 추출 리팩토링)에 정확히 대응한다. 리팩토링처럼 보이는 부분(핸들러에서 공유 모듈 추출)은 순환 import 회피와 "노드·테스터가 같은 연결 로직을 써야 결과가 신뢰된다"는 이번 기능의 핵심 요구가 직접 요청한 것이며, `git diff -w` 대조로 로직 변경 없이 이동만 됐음을 확인했다. 대량의 `review/`·`plan/` 파일 포함은 이 저장소의 정규 SDD 워크플로 산출물이지 스코프 이탈이 아니다. 작업 중 발견한 무관한 결함들은 코드에 끼워 고치지 않고 별도 백로그 문서에만 등재해 스코프 규율을 지켰다. 포맷팅·주석·임포트 노이즈는 발견되지 않았다.

## 위험도
NONE
