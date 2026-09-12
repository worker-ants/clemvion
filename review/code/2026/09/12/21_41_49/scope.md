# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** MCP 서버 통합 문서의 환경변수 오타 수정이 이번 배치(트리거 UUID + chat-channel 가이드 코드)와 무관한 별개 서브시스템을 건드린다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.en.mdx:28`, `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`
  - 상세: `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정은 실재하지 않는 환경변수명을 고친 것으로 그 자체는 정확하다. 그러나 이 PR/배치의 표제 범위는 "`rotateBotToken` 의 `:id` UUID 파이프 누락"과 "chat-channel 에러 코드(`TRIGGER_NOT_FOUND`) 오귀속 4~6곳"이며, MCP 서버 통합은 트리거·chat-channel 과 코드 경로를 공유하지 않는 별개 기능이다. plan(`trigger-uuid-and-guide-error-codes.md` §B 축 1)에 "가이드 UPPER_SNAKE 토큰이 코드베이스에 존재하는가"라는 **훨씬 넓은 전수 스윕**을 수행하다가 곁가지로 발견해 즉석에서 고친 것으로 문서화돼 있다. 근거 자체는 확실하지만(`.env.example:331`, `mcp.config.spec.ts`, `mcp-tool-provider.ts` 실측), 스캔 범위를 "chat-channel 가이드 식별자"에서 "`content/docs/**` 전체 식별자"로 넓힌 결과물이 이 PR 에 섞여 들어간 형태라 리뷰 대상 diff 만 보면 "트리거 작업인데 왜 MCP 문서가 바뀌었나"라는 의문이 자연스럽게 든다.
  - 제안: 이 정정 자체를 되돌릴 필요는 없으나(정확한 수정이고 사소함), 향후 유사 케이스에서는 "핵심 배치"와 "부수 발견 스윕 결과"를 커밋 단위로 분리하거나 커밋 메시지/PR 설명에 "부수적으로 무관 서브시스템 오타 1건도 수정함"을 명시해 diff 심사자가 서브시스템 경계를 넘는 변경임을 즉시 알 수 있게 할 것.

- **[INFO]** 신규 `param-uuid-pipe` 가드의 베이스라인 0 정책이 트리거와 무관한 `auth.controller.ts` 를 수정하게 만들었다
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:433-440` (`switchWorkspace` 의 `@ApiParam`)
  - 상세: 이번 작업의 핵심은 `TriggersController.rotateBotToken` 하나지만, "두 축(`ParseUUIDPipe`+`@ApiParam({format:'uuid'})`) 전수 위반 0"을 요구하는 리포지토리 전역 가드를 새로 도입하면서 기존에 `format: 'uuid'` 키만 빠져 있던 `auth.controller.ts` 의 `switchWorkspace` 도 같은 커밋에서 고쳐야 가드가 통과한다. plan 에 "한 건짜리 허용목록을 만드는 대신 자리를 고친다"는 명시적 근거가 있고 수정 자체도 3줄 주석 + `format` 키 1개로 최소적이라 위험도는 낮으나, "트리거 UUID 파이프" 라는 배치명 범위를 놓고 보면 `auth` 모듈까지 diff 에 들어온 것은 가드를 리포지토리 전역으로 설계한 결과에 따른 파생 확장이다.
  - 제안: 현재 근거 문서화 수준(허용목록 회피 이유, 실측 3건)이면 충분하다고 판단되나, 이런 "신규 전역 가드 도입 → 기존 위반 전수 수정"패턴은 코드 리뷰 시 "이 가드가 왜 이 PR 범위에 auth 모듈까지 끌어들이는가"를 별도로 짚어줄 가치가 있다는 점만 기록.

- **[INFO]** `triggers.mdx`/`triggers.en.mdx` 콜아웃에 단순 식별자 교체를 넘어선 신규 설명 문단이 추가됐다
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:463-465`, `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:450-452`
  - 상세: 원래 백로그 항목은 "`TRIGGER_NOT_FOUND` → 실제 코드로 교정"인데, 실제 diff 는 그 문장을 고치는 김에 "이 코드들은 API 를 직접 호출할 때만 보이는 값이고 UI 는 고정 실패 메시지를 띄운다"는 새 문단을 추가했다. plan 에 "그 옆 문장이 더 크게 틀려 있었다 — 고치던 손으로 확인했다"는 근거가 있고(원 문장 "모두 한국어 안내 메시지로 표시돼요"가 8종 전부에 대해 거짓이었다는 실측), 같은 콜아웃 박스 안의 인접 문장을 정정한 것이라 완전히 무관한 확장은 아니다. 다만 "식별자 교정"이라는 원 스코프에서 "UI 노출 여부에 대한 새 설명 추가"로 범위가 넓어진 것은 사실이다.
  - 제안: 문제될 수준은 아니나, 커밋 메시지/PR 설명에 이 문단이 "식별자 정정과 별개로 발견된 문서-구현 불일치 정정"임을 한 줄로 밝히면 향후 diff 심사가 쉬워진다.

## 요약

핵심 변경(트리거 컨트롤러의 `ParseUUIDPipe` 추가 + 이를 지키는 신규 AST 가드 3파일 + `TRIGGER_NOT_FOUND` 오귀속 정정 4~6곳)은 plan(`trigger-uuid-and-guide-error-codes.md`)이 선언한 범위와 정확히 일치하고, 각 파일의 diff 는 그 실측·근거가 매우 촘촘하게 문서화되어 있어 "의도 이상의 은밀한 변경"은 발견되지 않았다. 다만 (1) MCP 서버 통합 문서의 환경변수 오타 수정은 트리거/chat-channel 과 코드 경로가 겹치지 않는 별개 서브시스템이라 이 배치 범위 밖의 부수 수정으로 보이고, (2) 신규 리포지토리 전역 가드의 베이스라인-0 정책이 `auth.controller.ts` 를 함께 건드리게 했으며, (3) chat-channel 콜아웃 문서에 식별자 교정을 넘어선 설명 문단이 추가됐다. 셋 다 plan 문서에 근거가 상세히 기록되어 있고 코드 자체의 위험은 낮지만, "트리거 UUID + chat-channel 가이드 코드"라는 배치명 대비 실제 diff 의 서브시스템 경계(특히 MCP 문서)가 한 칸 넓다는 점은 리뷰어가 인지해야 한다.

## 위험도

LOW
