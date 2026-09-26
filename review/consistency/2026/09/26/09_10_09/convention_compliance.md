# 정식 규약 준수 검토 — post-status-openapi (--impl-prep)

대상: `plan/in-progress/post-status-openapi.md` 가 참조하는 spec 컨텍스트 번들
(`/private/tmp/.../scratchpad/pso-prep-scope/spec/**`, 10개 파일 — `2-navigation/{4-integration,5-knowledge-base,9-user-profile,6-config,3-schedule}.md`,
`3-workflow-editor/{3-execution,4-ai-assistant}.md`, `5-system/{2-api-convention,11-mcp-client}.md`,
`conventions/swagger.md`)를 `spec/conventions/**` 정식 규약 기준으로 검토했다. 이 plan 은
`spec_impact: none` 으로 선언된 codebase-only 변경(POST 액션 14곳 201→200 정합 + 정적 가드 신설)이다.

## 발견사항

- **[WARNING]** 신규 가드가 시행할 규칙의 SoT 문서에 그 가드가 등재되지 않을 계획
  - target 위치: `plan/in-progress/post-status-openapi.md` §요구 1 (`http-status-advertised{-guard.ts,.spec.ts}` 신설) · frontmatter `spec_impact: none`
  - 위반 규약: `spec/conventions/swagger.md` frontmatter `code:` (4행 이하) · `spec/5-system/2-api-convention.md` frontmatter `code:` (4행 이하) · `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의("본 spec 이 약속한 surface 의 구현 경로")
  - 상세: 신설 가드 `http-status-advertised-guard.ts`/`.spec.ts` 는 정확히 `spec/conventions/swagger.md §2-4`("상태 코드 응답 규칙", 284행)와 `spec/5-system/2-api-convention.md §6`("HTTP 상태 코드", 338행)이 규정한 "광고된 성공 코드 = 실제 성공 코드" 불변식을 시행한다. 그런데 두 문서의 frontmatter `code:` 는 이미 `swagger-dto-contract*.ts`·`dto-class-name-collision*.ts`·`param-uuid-pipe*.ts` 등 **각 세부 규칙을 시행하는 가드를 개별 glob 으로 등재**하는 관례를 따르고 있고(swagger.md 4~16행), 신규 가드는 이 관례에 해당하는 자리인데도 등재 계획이 없다(plan 요구 1에 frontmatter 갱신 언급 없음, `spec_impact: none`). swagger.md 자신의 §5-1 Rationale(421행)이 이 정확한 실패 양상을 이미 경고했다 — *"이 규칙은 가드가 먼저 생기고 규약이 나중에 온 자리입니다 … 그 가드가 무엇을 강제하는지 여기 적지 않으면 다음 사람이 '누가 왜 넣었는지 모르는 검사'로 보고 지웁니다."* 같은 구조(가드가 먼저 생기는 자리)가 이번에도 반복되는데 이번엔 등재 계획 자체가 없다. 부가적으로, 이 등재는 `spec/**` 파일 편집이라 CLAUDE.md 상 `developer` 의 기본 쓰기 권한 밖(spec read-only)이라 `spec_impact: none` 선언이 이 등재 필요성과 충돌할 수 있다 — 자기-반증형 소정정 예외(다섯 조건)에도 해당하지 않는다(신규 가드 추가는 "예고 문장의 정정"이 아니라 신규 커버리지 등재).
  - 제안: (a) `spec_impact` 를 `spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md` 로 갱신하고 project-planner 턴(또는 매우 좁은 frontmatter-only 변경이라면 그 turn 안에서 명시 사유와 함께)으로 두 문서 `code:` 에 `codebase/backend/src/repo-guards/__tests__/http-status-advertised*.ts` 를 추가. (b) 등재를 생략하기로 결정한다면 그 사유를 plan 에 명시(`code:` 글로브가 이미 다른 항목으로 충족되어 `spec-code-paths.test.ts` 통과에는 지장 없다는 점은 맞지만, `/spec-coverage` standing audit·다음 개발자의 "이 가드는 왜 있나" 질문에 대한 답이 없어지는 문제는 남는다).

- **[WARNING]** 상태 코드 표가 "액션성 POST(자원 미생성)" 카테고리를 명문화하지 않아 이번 정정이 교차-참조 추론에 의존
  - target 위치: `spec/conventions/swagger.md` §2-4 (284~289행) · `spec/5-system/2-api-convention.md` §6 (338~357행)
  - 위반 규약: 같은 두 문서 자신 — 표가 스스로 규정한 범주가 이번 PR 이 다루는 사례(생성도 아니고 조회/수정도 아닌 "부수효과 액션" POST)를 포함하지 않는다.
  - 상세: swagger.md §2-4 는 `200 OK` 를 **"조회/수정"** 에만, api-convention.md §6 은 `200` 을 **"조회, 수정 성공"** 에만 매핑한다. 어느 표에도 "리소스를 만들지 않는 액션 실행 POST" 가 어느 코드에 속하는지 없다 — plan 은 이를 api-convention.md §3 의 별개 문장("POST=리소스 생성, **액션 실행**")과 코드베이스 실측(POST 93개 중 `@HttpCode(200)` 42개가 전부 200 광고, `plan/in-progress/post-status-openapi.md` 16~52행)을 엮어 정당화한다. 즉 "정식 규약을 그대로 따랐다"기보다 **두 문서를 조합해 빈틈을 메운 것**이다. 판단 자체(정적으로 충분히 뒷받침됨)에는 동의하지만, 표 문면만 읽는 다음 작성자는 신규 액션 엔드포인트에 여전히 기본값(201)을 고르고도 "광고와 실제가 일치"하니 신규 가드를 통과할 수 있다 — 가드는 **광고=실제 일치**만 보지, "액션이면 200을 골라야 한다"는 규범적 방향을 강제하지 않는다(plan §요구 1 "베이스라인 0" 참고).
  - 제안: 이 PR 자체를 막을 사안은 아니나(가드는 오히려 이 빈틈이 방향 없이 벌어지는 것을 막는 안전망 역할), `spec/conventions/swagger.md §2-4`·`spec/5-system/2-api-convention.md §6` 표에 "액션성 POST(자원 미생성)는 200" 한 줄을 명문화하는 후속 결정을 트래커에 남길 것을 권장. 같은 plan 이 인용한 `spec/2-navigation/9-user-profile.md:354`(아바타 업로드 POST → "성공 시 200")·`spec/5-system/11-mcp-client.md:537`(preview-test 200 OK) 두 선례가 이미 이 방향의 실증 사례이므로, 규칙화 비용은 낮다.

- **[INFO]** 문서 구조 3섹션 권장(Overview/본문/Rationale) 미충족 파일 다수 — 이번 변경과 무관한 기존 상태
  - target 위치: `spec/2-navigation/4-integration.md` · `5-knowledge-base.md` · `9-user-profile.md` · `3-schedule.md` · `spec/3-workflow-editor/3-execution.md` · `4-ai-assistant.md` · `spec/5-system/11-mcp-client.md` (8/10 파일)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장"
  - 상세: 위 8개 파일은 모두 `## Rationale` 은 있지만 명시적 `## Overview` 섹션이 없다(반면 `2-navigation/6-config.md`·`5-system/2-api-convention.md` 는 `## Overview (제품 정의)` 를 갖춘다). 다만 이는 이번 plan 이 만든 상태가 아니라 기존 spec 저장소 전반(2-navigation·3-workflow-editor 카테고리)의 기존 패턴으로 보이며, `spec_impact: none` 인 이번 codebase-only 작업 범위 밖이다.
  - 제안: 이번 PR 에서 조치 불요. project-planner 가 해당 영역 spec 을 다음에 손볼 때 참고.

## 요약

이번 plan(`post-status-openapi`)이 인용하는 규약 근거(`swagger.md §2-4`, `api-convention.md §3/§6`)는 정확히 해당 절을 가리키고 있고, 계획된 코드 변경(14곳 `@HttpCode(OK)` 추가, `revokeInvitation` 광고 정정, 정적 가드 신설)은 인용된 규약과 충돌하지 않는다. target 스코프의 다른 spec 문서들(schedule/knowledge-base/mcp-client 등)도 이번에 바뀌는 엔드포인트에 대해 상태 코드를 침묵하거나 이미 200으로 명시하고 있어 모순은 없었다. 다만 두 가지 구조적 간극을 발견했다 — (1) 신설되는 `http-status-advertised` 가드가 그것이 시행하는 정식 규약 문서(swagger.md/api-convention.md)의 `code:` frontmatter 에 등재되지 않을 계획이라 `spec-impl-evidence.md` 관례 및 swagger.md 자신의 선례적 경고와 어긋나고, (2) 그 두 문서의 상태 코드 표 자체가 "액션성 POST" 범주를 명문화하지 않아 이번 정정이 표 문면이 아닌 교차 문서 추론에 의존한다. 둘 다 구현을 막을 CRITICAL 은 아니며, (1)은 project-planner 협업 또는 명시적 예외 사유 기록으로, (2)는 후속 규약 명문화 결정으로 해소를 권장한다.

## 위험도

LOW
