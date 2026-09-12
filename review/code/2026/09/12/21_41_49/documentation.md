# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `param-uuid-pipe-guard.ts` 주석의 실측 수치가 실제 값과 어긋난다 (135:107 vs 실측 136:108)
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:148` (신규 파일 — diff·전체 컨텍스트 게이트 동일)
  - 상세: `apiParamUuidFlags` 바로 아래 `collectMethodViolations` 안의 주석이 "`ParseUUIDPipe` · `new ParseUUIDPipe({ version: '4' })` 둘 다 받는다 — 실측 135건이 107 : 28 로 갈린다" 라고 적는다. `scanUuidParams`/`collectTsFiles` 를 직접 실행해 재측정한 결과 id-형 `@Param` 은 136건이고 그중 bare `ParseUUIDPipe` 108건·`new ParseUUIDPipe(...)` 28건(108+28=136)이다 — 주석의 135·107 은 둘 다 정확히 1씩 적다. 같은 파일 바로 위(line 73-77 부근) `apiParamUuidFlags` docstring 은 "이 수치를 한 번 틀렸다"(127→144 정정)를 자기 사례로 남기며 "측정 시점과 범위를 함께 적어 두면 다음 사람이 재현해 다른 수를 얻었을 때 그것이 내 실수인지 저장소 변화인지 가릴 수 있다"고 명시한다 — 그 교훈이 두 줄 아래에서 다시 어겨진 형태다. 총합(135)이 이 파일 다른 곳의 "id-형 136건"(line 45)과도 안 맞아 대조만으로도 발견 가능했다.
  - 제안: `135건이 107 : 28` 을 `136건이 108 : 28` 로 정정한다. 이 부류 주석은 코드에 영향은 없지만, "베이스라인 0" 가드의 신뢰성을 뒷받침하는 근거 수치이므로 다음 사람이 재실측 없이 믿고 인용할 위험이 있다.

- **[INFO]** CHANGELOG 항목이 두 결함 클래스 중 하나(500→400 behavior change)만 다루고, 가이드 오류 코드 정정(6곳)·`MCP_ALLOW_INSECURE_URL` 오기 정정은 CHANGELOG 에 없다
  - 위치: `CHANGELOG.md:3` (Unreleased 항목 전체) — 대조: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B
  - 상세: 이번 배치는 (A) `rotateBotToken` 500→400 동작 변경과 (B) 유저 가이드 MDX 4곳 + `backend-labels.ts`/`backend-labels.test.ts` 주석 2곳의 `TRIGGER_NOT_FOUND` 오귀속 정정, `mcp-servers{,.en}.mdx` 의 `MCP_ALLOW_INSECURE_URL` 오탈자 정정을 함께 담는다. CHANGELOG 는 (A)만 서술한다. (B)는 API 응답 자체가 바뀌는 게 아니라 문서·주석의 오기 정정(코드가 이미 내던 값을 문서가 뒤늦게 정확히 반영)이라 "Behavior change" 성격은 아니어서 CHANGELOG 관례상 생략이 부당하다고 보기는 어렵다. 다만 사용자(문서를 신뢰해 자동화를 짠 외부 클라이언트)가 `TRIGGER_NOT_FOUND` 문자열을 파싱하고 있었다면 이 정정도 관측 가능한 변화이므로, 완전한 정보가 필요하다면 언급 가치가 있다.
  - 제안: 현 상태 유지도 방어 가능하나, 문서 신뢰도를 다루는 배치이니 CHANGELOG 에 "가이드 문서의 오기 정정(비-동작 변경)" 한 줄을 추가하는 편이 완결성이 높다. 필수 수정은 아님(INFO).

## 요약

이번 PR 은 문서화 관점에서 전반적으로 높은 완성도를 보인다. `CHANGELOG.md` 는 이전/이후 표, 배포 시 확인 사항, 형제 엔드포인트 수 실측(6개)까지 갖췄고 이를 직접 재검증한 결과 정확했다(`switchWorkspace` 파이프 6+1, `hooks.service.ts`/`http-exception.filter.ts` 의 `TRIGGER_NOT_FOUND`/`RESOURCE_NOT_FOUND` 귀속, `spec/conventions/swagger.md §5-4` 의 `ParseUUIDPipe` 0건·`format:'uuid'` 단독 요구, `.env.example` 의 `MCP_ALLOW_INSECURE_URL` 실재명 등 모두 소스와 일치). 신규 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture)의 JSDoc 은 근거·출처·이전 리뷰 라운드에서의 자기 정정 이력까지 투명하게 남겨 두어 이 저장소의 "측정 시점·범위 명시" 관례를 잘 지킨다 — 단 한 곳(`param-uuid-pipe-guard.ts:148`)에서 정확히 그 관례가 요구하는 정밀도에 미달하는 오프바이원 수치 오기가 실측으로 확인됐다(135:107 vs 실제 136:108). `triggers.controller.spec.ts` 의 신규 HTTP 왕복 테스트는 "왜 기존 describe 로는 안 되는지"·"왜 대조군이 셋인지"를 설명하는 모범적인 헤더 docstring을 갖추었고, MDX 사용자 가이드(트리거·텔레그램·MCP 서버) 4개 파일의 에러 코드/환경변수명 정정은 전부 실제 코드와 대조해 정확함을 확인했다. 유일한 실질적 지적은 새 가드 파일의 주석에 있는 오프바이원 통계 오류이며, 기능에는 영향이 없다.

## 위험도

LOW
