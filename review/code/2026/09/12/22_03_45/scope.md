# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 주 스코프(`triggers.controller.ts` 의 `rotateBotToken` UUID 파이프) 밖의 다른 컨트롤러에 부수 수정이 포함됨
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:433-440` (`switchWorkspace` 의 `@ApiParam`)
  - 상세: `switchWorkspace` 는 이번 배치가 고치려는 `triggers` 모듈과 무관한 `auth` 모듈 엔드포인트다. 다만 이 배치가 신설한 저장소 전수 가드(`param-uuid-pipe`)가 "id-형 `@Param` 은 `@ApiParam({format:'uuid'})` 를 갖춰야 한다"는 조건을 baseline 0 으로 강제하기 때문에, 이 가드를 통과시키려면 기존에 `format` 키만 빠져 있던 이 자리도 같이 채워야 했다. 순수 OpenAPI 문서 애노테이션 추가(`format: 'uuid'`)이고 런타임 로직·응답 변화는 없다. 근거는 plan(`plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A "축이 둘이었다" 표)과 커밋 `bbc9e7f70` 본문에 명시돼 있어 은폐된 변경이 아니다.
  - 제안: 이미 disclosure 는 충분하다. 다만 "가드 신설이 스코프를 다른 모듈까지 넓힌다"는 패턴이 반복될 수 있으므로, 이런 종류의 배치는 커밋 제목에 "+ 전수 가드 baseline 확보" 정도를 명시해 두면 이후 리뷰어가 diff 범위를 재차 의심하지 않아도 된다.

- **[INFO]** 트리거/rotate-bot-token 과 무관한 MCP 서브시스템의 환경변수 오타 수정이 같은 배치에 포함됨
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`, `mcp-servers.en.mdx:28` (`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`)
  - 상세: 이 PR 의 표제 작업(트리거 UUID 400/500·chat-channel 가이드 오류 코드)과는 다른 서브시스템(MCP 통합)의 문서 오타다. 다만 이는 "가이드가 코드베이스에 없는 식별자를 적는다"는 이 배치의 두 번째 축(§B)을 위해 `content/docs/**` 의 UPPER_SNAKE 토큰 97개를 전수 스캔하다가 함께 드러난 것으로, plan 과 커밋 메시지(`bbc9e7f70`: "부수: 축 1 이 환경변수 오기 … 를 드러냈다")에 명시적으로 disclose 되어 있다. 순수 2줄 문서 수정이며 코드 동작에 영향 없음. 5라운드 `/ai-review` 에서도 동일 지적("MCP 오타 수정이 배치 범위 밖")이 나왔고, 그 라운드 결론은 "되돌릴 필요 없음(커밋 메시지 명시 권고)"로 이미 처분됐다(`50f77b404` 커밋 본문에 그 disclosure 문장이 실제로 들어가 있음을 확인).
  - 제안: 이미 적절히 처리된 항목이라 재작업 불요. 향후 유사한 "전수 스윕이 다른 서브시스템의 무관 오타를 함께 드러내는" 경우, 이번처럼 커밋 본문에 "무관 서브시스템 부수 수정"임을 한 줄로 못 박는 관행을 계속 유지할 것.

- **[INFO]** 원 결함(파이프 1건 누락) 대비 신규 가드 인프라 규모가 큼 — 다만 이 저장소의 확립된 관례에 부합
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`(229줄, 신규) · `param-uuid-pipe.spec.ts`(123줄, 신규) · `fixtures/param-uuid-pipe/sample.controller.ts`(96줄, 신규)
  - 상세: 실제 결함은 컨트롤러 1곳의 `ParseUUIDPipe` 누락이었으나, 그 재발을 막기 위해 AST 기반 전수 스캔 가드 + vacuity floor + 대조군 fixture 4종을 신설했다. 최소 수정 대비 확장이지만, 이 저장소는 유사 결함마다 `repo-guards/__tests__/*` 에 회귀 방지 가드를 추가하는 것이 이미 반복적으로 확립된 관례(형제 가드 `dto-class-name-collision`·`swagger-dto-contract`·`nullable-type-lie-cast` 등 참조 코멘트로 스스로 인용)이며, plan 문서에 뮤테이션 검증(M1~M10)까지 실어 근거를 남겼다. over-engineering 성 기능 확장이라기보다 이 코드베이스의 표준 워크플로에 해당한다.
  - 제안: 없음(기록 목적).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 원 스코프보다 넓은 후속 항목 다수를 함께 등재
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (예: `GlobalExceptionFilter` 22P02 미분류, `swagger.md §5-4` 체크리스트 갭, "가이드 식별자 실재성 가드 부재" 등 5개 신규 `- [ ]` 항목)
  - 상세: 코드 변경은 없고 트래커에 "이번 배치에서 하지 않을 후속 작업"을 등재만 하는 문서 편집이다. `CLAUDE.md`/메모리가 요구하는 "미룬 항목은 그 턴에 plan 에 적어라" 관행에 정확히 부합하며, 실행(코드) 스코프를 넓히지 않고 오히려 스코프를 좁게 유지하기 위한 장치다. 스코프 위반이 아니라 모범 사례로 판단.
  - 제안: 없음.

## 요약

핵심 diff(`triggers.controller.ts`의 `ParseUUIDPipe` 부착, HTTP 왕복 테스트, CHANGELOG, chat-channel 가이드 4개 MDX·`backend-labels.{ts,test.ts}` 의 `TRIGGER_NOT_FOUND` 오귀속 정정)는 plan(`trigger-uuid-and-guide-error-codes.md`)이 처음부터 선언한 두 축(A: UUID 파이프, B: 가이드의 없는/틀린 식별자)에 정확히 대응하며, 포맷팅·주석·임포트 변경도 실질 변경에 결부된 것만 있다(순수 whitespace-only diff 없음, `git diff --ignore-all-space` 결과 동일). `auth.controller.ts`(switchWorkspace)와 MCP 환경변수 오타 수정 두 건은 표제 작업과 다른 모듈/서브시스템을 건드리는 부수 수정이지만, 둘 다 이번 배치의 산출물(전수 가드 baseline 0, 식별자 전수 스윕)이 필연적으로 드러낸 것이고 plan·커밋 메시지에 그 근거와 "무관 서브시스템 부수 수정"이라는 disclosure 가 명시돼 있어 은폐된 스코프 확장이 아니다. 신규 가드 인프라(약 450줄)는 결함 규모 대비 커 보이지만 이 저장소가 반복적으로 채택해 온 "결함 발견 시 회귀 방지 가드 신설" 관례에 부합한다. 전체적으로 의도 이상의 변경·불필요한 리팩토링·무관한 파일 수정은 관찰되지 않았고, 스코프를 넘는 부분은 모두 문서화·disclosure 됐다.

## 위험도

LOW
