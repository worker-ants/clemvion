# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `auth.controller.ts` 의 `switchWorkspace` 수정은 이번 배치의 표제 대상(`triggers` 모듈의 `rotateBotToken`)과 다른 모듈(`auth`)이다.
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:433-440`
  - 상세: 작업명은 "trigger-uuid-and-guide-error-codes" 이고 A항목의 실측 대상도 `rotateBotToken` 하나였다. 그런데 신규 도입한 `param-uuid-pipe` 가드가 두 축(런타임 파이프·문서 `format`)을 베이스라인 0으로 요구하도록 설계되면서, 같은 위반 클래스를 가진 `auth.controller.ts` 의 `switchWorkspace` 까지 수정 범위에 들어왔다. `plan/in-progress/trigger-uuid-and-guide-error-codes.md:59-63`(전체 파일 컨텍스트 기준 실제 줄 번호)에 이 확장이 사전에 근거와 함께 명시돼 있고("한 건짜리 허용목록을 만드는 대신 자리를 고친다"), `--impl-prep`/두 차례 `/ai-review` 라운드를 거치며 검토됐다. 의도치 않은 은닉 변경은 아니지만, 표제 스코프(트리거 UUID)를 넘어 리포지토리 전역 컨벤션 준수로 확장된 지점이라 스코프 관점에서 기록해 둔다.
  - 제안: 현재 수준의 문서화(plan 근거 + CHANGELOG 언급)로 충분해 보이나, PR 설명에도 "가드 베이스라인 0 확보를 위해 `auth.controller.ts` 1곳을 함께 수정했다"는 점을 한 줄 명시하면 리뷰어가 diff 를 보고 놀라지 않는다.

- **[INFO]** `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 환경변수명 정정은 트리거/에러코드 작업과 직접 관련이 없는 MCP 통합 문서 영역이다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.en.mdx:28`, `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`
  - 상세: 이 배치의 B항목은 "가이드가 코드베이스에 없는 UPPER_SNAKE 토큰을 적는다"는 전수 스윕에서 파생된 것으로, 결과적으로 트리거/에러코드가 아닌 MCP 서버 통합 문서까지 건드리게 됐다. `plan/in-progress/trigger-uuid-and-guide-error-codes.md:120`(전체 파일 컨텍스트 기준)에 "환경변수 오기 — 본 PR 에서 고친다"고 명시적으로 근거를 남겨 두었고, 변경 자체는 2파일·2줄의 오탈자 수정이라 위험은 낮다. 다만 작업명이 가리키는 범위(트리거 UUID + 에러코드)를 문자 그대로 보면 무관한 파일 영역 수정에 해당하므로 스코프 리뷰 관점에서 표시한다.
  - 제안: 이미 plan 에 근거가 있으므로 추가 조치는 불필요. PR 설명에 "부수적으로 발견된 MCP 환경변수 오탈자 1건도 같은 스윕에서 수정" 정도로 언급하면 충분.

- **[INFO]** 단일 누락 파이프 결함(`rotateBotToken`)을 고치기 위해 3개 신규 파일·약 400줄 규모의 AST 기반 repo-guard 인프라(`param-uuid-pipe-guard.ts` + `param-uuid-pipe.spec.ts` + `fixtures/param-uuid-pipe/sample.controller.ts`)를 새로 도입했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`(신규 194줄), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`(신규 122줄), `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`(신규 96줄)
  - 상세: 이 저장소에는 이미 `repo-guards/__tests__/` 하위에 같은 패턴의 형제 가드(`dto-class-name-collision` 등, 주석에서 언급)가 존재해 이 배치가 새 관례를 만든 것은 아니고 기존 컨벤션을 확장한 것으로 보인다. 또한 `--impl-prep` convention_compliance WARNING 이 "파이프 축만 닫으면 문서 축(`@ApiParam format:'uuid'`)이 남는다"고 명시적으로 지적해 가드 도입의 필요성을 뒷받침했다. 다만 재발 방지 인프라 규모(대조군 fixture 96줄, 판정 로직 194줄, 스펙 122줄)가 원래 결함(1곳의 누락 파이프)에 비해 크다는 점은 "기능 확장(과잉engineering)" 관점에서 짚어볼 만하다. Critical/Blocking 은 아니며, 프로젝트가 이런 가드 패턴을 표준으로 채택하고 있다는 근거(형제 가드 존재, 두 차례 `/ai-review` 통과)가 있어 위험도는 낮다.
  - 제안: 별도 조치 불필요. 다만 이후 유사 1건 결함마다 반복적으로 대규모 가드를 신설하는 패턴이 누적되면 `repo-guards/` 자체의 유지보수 비용이 스코프 이슈로 재부상할 수 있음을 인지해 둘 것.

## 요약

전체적으로 이 PR 은 plan 문서(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)에 작업 범위·근거·실측·뮤테이션 검증·두 차례 `/ai-review` 처분 내역이 매우 상세히 기록돼 있어, 표면적으로 "스코프 밖"으로 보이는 변경(`auth.controller.ts` 의 `switchWorkspace`, MCP 환경변수명 오탈자)도 실제로는 이번 배치가 도입한 가드/스윕의 논리적 귀결이며 은닉된 무관 변경이 아니다. 다만 (1) 트리거 UUID 작업이 인접 모듈(auth)까지, (2) 트리거/에러코드 스윕이 무관 기능 영역(MCP 통합)까지 번진 지점, (3) 단일 결함 대비 상대적으로 큰 재발방지 인프라 신설이라는 세 가지는 "의도한 최소 범위"를 넘어선 확장으로 분류할 만하며, 리뷰어가 diff 만 보고 판단할 경우 놀랄 수 있는 지점이다. 세 항목 모두 근거가 충분히 문서화돼 있어 CRITICAL/WARNING 수준의 결함은 아니다.

## 위험도

LOW
