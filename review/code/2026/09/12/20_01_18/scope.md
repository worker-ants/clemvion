# 변경 범위(Scope) 리뷰 — trigger-uuid-and-guide-codes

## 발견사항

- **[INFO]** MCP env var 오기 정정(`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`)이 트리거/UUID/chat-channel 기능 영역과 무관한 MCP 통합 문서를 건드린다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.en.mdx:28`, `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`
  - 상세: 이 배치의 표제 작업은 "`rotateBotToken` UUID 파이프 + chat-channel 가이드 에러코드 오기"인데, `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B "축 1"에서 진행한 "가이드의 UPPER_SNAKE 토큰이 코드베이스에 존재하는가" 전수 스윕이 부수적으로 발견한 MCP 환경변수명 오기까지 같은 PR 에 포함시켰다. 트리거/chat-channel 과는 별개 기능 영역(MCP 서버 통합)이라 엄밀하게는 별도 PR 로 분리할 여지가 있다.
  - 다만 이 포함은 은폐되지 않고 plan 문서에 명시적으로 근거(`.env.example:331` · `mcp.config.spec.ts` · `mcp-tool-provider.ts` 대조)와 함께 등재되어 있고, "가이드가 코드베이스에 없는 이름을 적는다"는 동일 결함 클래스로 스스로 규정했다("두 종"). diff 크기도 2파일 1줄씩으로 최소다. 은닉된 스코프 확장이 아니라 **문서화된 판단**이라 CRITICAL/WARNING 이 아닌 INFO 로 기재한다.
  - 제안: 후속에는 "가이드 오기 스윕"과 "특정 엔드포인트 계약 수정"을 애초에 별도 PR/커밋으로 쪼개는 편이 리뷰 단위를 더 좁게 유지한다. 현재는 조치 불요.

- **[INFO]** `param-uuid-pipe` repo-guard(신규 AST 정적 분석기 + spec + fixture, 총 377줄)가 "1건의 버그 수정"보다 넓은 인프라를 신규 도입한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`, `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: `rotateBotToken` 한 자리만 고치면 되는 결함인데, 전수 AST 스캐너 + 베이스라인-0 회귀 가드 + 4종 대조군 fixture 를 새로 만들었다. 이는 표면적으로는 "기능 확장(over-engineering)"으로 보일 수 있다.
  - 그러나 plan(`trigger-uuid-and-guide-error-codes.md` §A "처분")이 "1회성 수정이면 다음 엔드포인트가 같은 자리에 다시 생긴다"는 근거를 명시하고, 이 저장소에는 이미 동일 패턴의 `repo-guards/__tests__/` 관례(예: fixture 주석이 인용하는 `dto-class-name-collision` 가드)가 존재해 신규 관례 도입이 아니라 기존 컨벤션을 따른 것이다. 뮤테이션 6종 표(M1~M6, 예측/실측 병기)까지 갖춰 vacuous 가드가 아님을 자체 검증했다. 스코프 상 방어 가능한 설계로 판단해 INFO 로 낮춘다.
  - 제안: 조치 불요. 향후 유사 가드 추가 시 이번처럼 "왜 1회성 수정으로 안 되는가"를 plan 에 명시하는 패턴을 유지할 것.

- **[INFO]** `backend-labels.ts`/`backend-labels.test.ts` 변경이 순수 주석·순서 재배치이며 `ERROR_KO` 실제 값(맵 내용)은 건드리지 않는다
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:605-614` (게이트 기준), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:339-345`
  - 상세: `TRIGGER_NOT_FOUND` 를 chat-channel 코드 블록에서 물리적으로 분리하고 귀속 주석을 정정했을 뿐, 동작 변경이 없다. plan §C 에서 "ERROR_KO 매핑을 아무도 읽지 않는다"는 더 큰 갭을 발견했음에도 **이번 배치에서는 고치지 않고 트래커에만 등재**했다고 명시적으로 밝혀, 스코프를 의도적으로 좁게 유지한 판단이 확인된다. 스코프 위반 아님 — 참고로만 기재.

## 검토했으나 문제 없음으로 판정한 항목

- `auth.controller.ts` `switchWorkspace` 의 `@ApiParam` 을 단일 프로퍼티 객체에서 멀티라인 `{name, description, format}` 으로 바꾼 것은 `format: 'uuid'` 필드 추가에 따른 필연적 포맷 변화이며 의미 없는 개행이 아니다.
- `triggers.controller.ts` 는 `ParseUUIDPipe`·`BadRequestException` 등 필요한 심볼이 이미 import 되어 있어 신규/불필요 import 변경이 없다.
- `git diff --stat origin/main...HEAD` 로 대조한 결과 15개 파일·680줄 추가/14줄 삭제가 정확히 프롬프트에 제시된 파일·hunk 와 1:1 일치한다 — 프롬프트에 안 실린 숨은 변경(다른 hunk)은 없다.
- `.env.example`, `mcp.config.spec.ts`, `mcp-tool-provider.ts` 등 실제 코드/설정 파일은 건드리지 않았다 — 정정 대상은 문서(mdx)에 한정되어 실질 동작 변경이 없는 순수 doc-fix.
- `plan/in-progress/*.md` 두 파일의 변경은 이번 배치가 닫은 트래커 항목 체크(`[x]`)와 새 후속 항목 등재(`[ ]`)로, 코드 변경분과 1:1 대응하며 "완료되지 않은 항목을 완료로 표기"하는 사례는 없다(§C 의 두 항목은 의도적으로 미해결 `[ ]` 로 남김).
- 리뷰 대상 파일 중 무관한 리팩토링·드라이브바이 포맷팅·불필요 주석 삭제 사례를 발견하지 못했다.

## 요약

전체 diff(15파일, +680/-14)는 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에 사전 기재된 두 항목(§A `rotateBotToken` UUID 계약 보강 + 회귀 가드, §B 가이드 문서의 오기 6곳 + 부수 발견 MCP 환경변수명 2곳)과 정확히 1:1 대응한다. 트래커 파일 대조와 `git diff --stat` 실측 결과 프롬프트에 없는 숨은 변경은 없었다. 유일하게 스코프 경계선에 걸치는 것은 MCP 환경변수명 오기(트리거/chat-channel 과 무관한 기능 영역)를 같은 PR 에 포함한 점과, 단일 버그 수정보다 넓은 신규 AST 가드 인프라 도입인데, 둘 다 plan 문서에 근거·전수 실측·뮤테이션 검증과 함께 명시적으로 정당화되어 있어 은폐된 스코프 확장으로 보기 어렵다. Critical/Warning 급 스코프 위반은 없다.

## 위험도

LOW
