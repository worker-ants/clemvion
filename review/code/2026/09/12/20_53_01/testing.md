# 테스트(Testing) Review

## 발견사항

- **[WARNING]** 같은 PR 안에서 동일한 결함 성질(선언·문서와 실제가 조용히 어긋남)을 두 갈래로 고쳤는데, 한쪽만 회귀 가드를 얻었다.
  - 위치: `plan/in-progress/trigger-uuid-and-guide-error-codes.md:120`, `:171`, `:173` (처분 서술) / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` · `triggers.en.mdx` / `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` · `telegram.en.mdx` / `.../mcp-servers.mdx` · `mcp-servers.en.mdx` / `codebase/frontend/src/lib/i18n/backend-labels.ts:605-611`
  - 상세: Part A(`rotateBotToken` 의 `ParseUUIDPipe` 누락)는 AST 전수 스캔 가드(`repo-guards/__tests__/param-uuid-pipe-guard.ts` + `.spec.ts`, 베이스라인 0, 허용목록 없음)로 승격해 다음에 같은 실수가 생기면 CI 가 RED 를 낸다. 반면 Part B(가이드 MDX·`backend-labels.ts` 가 코드베이스에 없거나 틀린 식별자를 적는 문제 — `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND`, `MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)는 정규식/토큰 스윕으로 6+2곳을 찾아 **수동으로만** 고쳤고, 재발을 막을 자동 테스트·가드는 추가되지 않았다. 이 클래스의 결함 자체가 "4개월간 아무도 몰랐다"(Part A 헤더 주석)는 방식으로 존재해 왔다는 사실이 재발 위험의 근거다 — 다음에 새 엔드포인트가 문서에 잘못된 에러 코드를 적거나 env var 이름이 또 바뀌면 이번과 똑같이 몇 달간 조용히 남을 것이다.
  - 제안: `content/docs/**` 의 `NNN \`CODE\`` / env var 토큰이 backend 소스에 실재하는지 확인하는 경량 가드를 `param-uuid-pipe` 와 같은 패턴(순수 판정 함수 + AST 또는 안전한 정적 스캔 + vacuity floor)으로 별도 후속 항목에 명시하거나, 이미 plan §C 에 등재된 "가이드가 존재하지 않는 에러 코드 5종" 항목에 "가드 신설"을 처분으로 못박는다.

- **[INFO]** plan 자체 체크리스트가 전체 회귀 스위트 실행 확인을 아직 미완료로 표시한다.
  - 위치: `plan/in-progress/trigger-uuid-and-guide-error-codes.md:204` (`- [ ] \`.claude/tools/run-test-all.sh\``)
  - 상세: 리뷰 시점 스냅샷에서 이 항목이 미체크다. 직접 검증한 결과 이 PR 이 새로 추가/수정한 테스트는 모두 GREEN 이었다 — backend `npx jest src/modules/triggers/triggers.controller.spec.ts src/repo-guards/__tests__/param-uuid-pipe.spec.ts` → 2 suites / 20 tests 통과, frontend `npx vitest run src/lib/i18n/__tests__/backend-labels.test.ts` → 20 tests 통과. 또한 `triggers.controller.ts` 의 `@Param('id', ParseUUIDPipe)` 를 `@Param('id')` 로 뮤테이션(스크래치 디렉터리에 원본을 백업한 뒤 `cp` 로 복원)해 재실행한 결과 guard spec 과 HTTP 왕복 spec 이 예측대로 각각 RED(`위반 1건`, `expect(res.status).toBe(400)` 실패 — 실제로는 200)로 전환됨을 재확인했고, 원복 후 `git status --short` 로 해당 파일이 clean 함을 확인했다 — plan 의 뮤테이션 표 M1·M9 주장과 일치한다. 다만 이는 이 리뷰가 확인한 범위(변경된 스펙 파일)에 한하고, `run-test-all.sh` 가 커버하는 backend 전체·frontend 전체·e2e 전체의 회귀 여부는 그 체크박스가 닫히기 전까지 이 PR 기준으로 미확정이다.
  - 제안: 머지 전 `run-test-all.sh` 전체 실행 결과를 체크리스트에 반영.

## 확인한 사항 (문제 아님 — 근거 기록)

- `triggers.controller.spec.ts` 의 신규 `describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)')` 는 이전 라운드의 "e2e 가 필요하다" 전제를 `Test.createTestingModule` + `supertest` + `GlobalExceptionFilter` 부착으로 반증하고 대체했다 — `new TriggersController(...)` 직접 생성 방식(같은 파일의 위 두 describe)이 파이프를 실행하지 않는다는 점과 대비된다. 세 입력(비-UUID / 정상 UUID+본문 누락 / 정상 UUID+정상 본문)이 서로 다른 `error.code` 로 갈리는 것까지 단언해 "무언가가 400 을 냈다" 수준의 vacuous 단언을 피한다.
- `param-uuid-pipe.spec.ts` 는 스캔 대상 0건(vacuous) 방지 floor 를 판정과 **같은 순회에서 나온 `scanned` 값**으로 걸어 두었고, `[대조군]` describe 가 면제(`@ApiExcludeEndpoint`)의 방향성(문서 축만 끄는지 런타임 축까지 끄는지)까지 반대 방향 캐너리로 가른다 — 두 축·네 형태 위반을 각각 다른 사유로 구분해 판정 함수가 실제로 가르는지 확인한다.
- 가드 스캔 루트(`src/modules`)가 실제로 전체 `*.controller.ts` 35개를 포함하는지 직접 `find` 로 재확인했다 — 35개 전부 `src/modules/` 아래에 있어 "전수" 주장이 성립한다(스캔 루트 밖에 숨는 컨트롤러 없음).
- `backend-labels.test.ts`/`backend-labels.ts` 의 diff 는 `LOCALIZED_ERROR_CODES`/`CHAT_CHANNEL_CODES` 배열 내용(원소 자체)은 바꾸지 않고 주석 귀속만 정정한 순수 문서성 변경이라 테스트 시맨틱에 영향이 없다 — 실행 결과도 이를 뒷받침한다(20/20 통과).
- `CurrentUser`/`WorkspaceId` 데코레이터 구현을 직접 읽어, 신규 HTTP 왕복 테스트가 실제 프로덕션 미들웨어 체인(옵셔널 체이닝으로 `user` 부재를 안전 처리, 헤더 우선순위 로직)과 부합하게 동작함을 확인했다 — mock 이 실제 동작과 괴리되지 않는다.

## 요약

신규 `param-uuid-pipe` 가드(순수 로직 + AST 기반 전수 스펙 + fixture 대조군)와 `triggers.controller.spec.ts` 의 HTTP 왕복 테스트는 vacuous 단언·mock 실제성·회귀 고정(뮤테이션 검증) 측면에서 모두 견고했다 — 직접 실행 및 뮤테이션 재현으로 GREEN/RED 주장을 검증했다. 유일한 실질적 갭은 같은 PR 이 다루는 두 번째 결함 클래스(가이드/코드의 식별자 불일치)가 첫 번째만큼의 영구 가드를 얻지 못해 재발 방지 비대칭이 남는다는 점이며, 이는 WARNING 수준으로 별도 후속 항목화가 필요하다. plan 체크리스트의 전체 스위트 실행 미완료는 이 리뷰가 직접 검증한 범위 밖의 잔여 리스크로 INFO 수준이다.

## 위험도

LOW
