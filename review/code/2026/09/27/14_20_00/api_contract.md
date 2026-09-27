# API 계약(API Contract) 리뷰 — patch-omit-undefined (머지 후 재확인)

이 diff 는 `review/code/2026/09/27/13_50_41` 1R 에서 발견된 Critical(`PATCH /workflows/:id { settings: null }` 500 회귀)의
수정 커밋(`edd79ca40`)과 그 RESOLUTION·plan 갱신까지 포함한 최종 상태다. 저장소 파일은 건드리지 않았고(`git status --short` 확인),
`Read`/`Bash` 로 diff 밖의 관련 소스(DTO 선언 등)를 직접 열어 현재 코드 상태를 대조했다.

## 발견사항

- **[INFO]** 1R Critical(`settings: null` → 500) 수정이 코드·테스트 양쪽에서 확인됨 — 재발 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:257`(`if (settings != null) {`)
  - 상세: 병합 가드가 `settings !== undefined` 에서 `settings != null` 로 바뀌어 `omitUndefined(null)` 이 더 이상 호출되지 않는다.
    실제로 `Read` 로 현재 파일을 열어 확인했고, 단위 테스트("settings: null 은 던지지 않고 저장된 설정을 그대로 둔다",
    `workflows.service.spec.ts`)와 e2e 케이스 B(`patch-partial-body.e2e-spec.ts`, `settings: null` → 200 · 저장값 유지)가 회귀를
    고정한다. `folders`·`triggers`·`nodes`·`auth-configs` 나머지 4개 `omitUndefined` 호출부는 top-level DTO 자체(널이 될 수 없는
    객체)를 받으므로 같은 클래스의 위험이 없음을 `grep -rn "omitUndefined("` 로 전수 확인했다.
  - 제안: 없음 (양성 확인).

- **[INFO]** `settings: null` 의 의미가 다른 nullable 필드의 "명시적 null = 값 초기화" 관례와 다르다 (사전 존재 동작 — 이 diff 가 만든 것 아님)
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:80`(`settings?: WorkflowSettingsDto;` — `nullable: true` 미선언,
    diff 밖 파일, `Read`로 직접 확인) / `codebase/backend/src/modules/workflows/workflows.service.ts:249-261`
  - 상세: `folderId`·`description` 같은 스칼라 nullable 필드는 §5.4 tri-state 대로 "명시적 null = 값 지움" 이다(같은 diff 의
    `workflows.service.spec.ts` "명시적 null 은 로드한 값을 지운다" 테스트가 확인). 반면 `settings` 는 최상위에서 `null` 을 보내도
    "무시(변경 없음)" 으로 처리된다 — DTO 타입 선언(`WorkflowSettingsDto` optional, `| null` 아님)과도 일치하지만, `class-validator`
    의 `@IsOptional()` 은 `null` 도 통과시켜 스키마 밖 값이 조용히 no-op 이 된다. 이 diff 의 주석(`workflows.service.ts:255-256`)이
    "원래 그렇게 다뤘다"고 명시하므로 새로 도입된 동작은 아니고, 이번 수정은 크래시만 없앤 것이다. 다만 클라이언트 입장에서는 같은
    엔드포인트 안에서 필드마다 `null` 의 뜻이 다르다(스칼라=지움, `settings`=변경없음)는 점이 계약을 읽는 사람에게 드러나지 않는다.
    settings 내부의 개별 키(`maxConcurrentExecutions: null`)를 보내면 그 키만 지워지는 경로는 남아 있어(`omitUndefined(settings)` 가
    `null` 값은 통과시킴), 완전한 초기화 수단 자체가 없는 것은 아니다.
  - 제안: 이 PR 범위 밖(`spec_impact: none`, 이미 plan 트래커가 §5.4 tri-state 문서화 갭을 planner 인계 항목으로 들고 있음
    — `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6)/(7)). 후속 spec 정정 시 "settings 최상위 null = no-op,
    개별 키 null = 그 키 초기화" 를 한 문장으로 명문화할 것을 제안. 차단 사유 아님.

- **[INFO]** `PATCH /nodes/:id` 응답에서 `workflow` 관계 제거 — `NodeDto` 선언과 실제 응답을 재일치, breaking change 아님
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:58`(`Promise<Omit<Node, 'workflow'>>`), `:82-83`
    (`const { workflow: _workflow, ...response } = saved; return response;`)
  - 상세: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` 를 직접 열어 `workflow` 필드가 애초에 선언된
    적이 없음(`workflowId: string` 만 있음, `:12`)을 확인했다. 컨트롤러도 `@ApiOkWrappedResponse(NodeDto, …)` 만 선언
    (`nodes.controller.ts:127`)하므로 이번 제거는 문서화되지 않은 채 새던 필드를 계약대로 되돌리는 정정이다.
  - 제안: 조치 불요.

- **[INFO]** 세 PATCH 엔드포인트(`/workflows/:id`, `/nodes/:id`, `/auth-configs/:id`) 응답이 저장값과 일치하도록 정정 — 하위 호환 관점에서 버그 수정
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:249`, `codebase/backend/src/modules/nodes/nodes.service.ts:78`,
    `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:247` (세 곳 모두 `Object.assign(엔티티, omitUndefined(…))`)
  - 상세: 이전엔 일부 필드만 보낸 PATCH 가 응답에서 nullable 컬럼을 거짓 `null` 로, non-nullable 컬럼을 키 누락으로 실어 앱이 아니라
    "API 를 직접 부르는 클라이언트"만 틀린 값을 받았다(CHANGELOG). 새 e2e(`patch-partial-body.e2e-spec.ts`)가 저장값(GET) → 응답 값 →
    `assertMatchesContract` 계약 대조 3단으로 검증해, §5.4 optional+nullable 동결로 인해 계약 대조만으로는 못 잡는 값 오염을 별도로
    잡아낸다 — API 계약 관점에서 바람직한 보강.
  - 제안: 없음 (양성 확인).

- **[INFO]** 요청 검증·URL·페이지네이션·인증/인가·버전 관리 — 이번 diff 의 변경 범위 밖
  - 상세: DTO 검증 규칙(`UpdateWorkflowDto`/`UpdateNodeDto`/`UpdateAuthConfigDto`/`WorkflowSettingsDto`)은 이번 diff 에서 손대지
    않았다. 라우트 신설/삭제 없음, 목록 API 변경 없음(페이지네이션 무관), `nodes.service.ts` 의 IDOR 가드(워크스페이스 소유권 검사,
    `relations: ['workflow']` 단일 쿼리)는 그대로다. 이 저장소는 URL 버전 관리를 쓰지 않으며 이번 변경도 버전에 영향 없음.

## 점검 관점별 요약

1. **하위 호환성**: 응답 값을 저장값·선언(§5.4 tri-state)에 맞추는 버그 수정 — breaking change 아님. `null`/키 누락으로 잘못
   응답받던 클라이언트가 있었다면 이제 다른(올바른) 값을 받는 변화는 있으나, 이는 "결함 수정"으로 분류.
2. **버전 관리**: 해당 없음(버전드 라우트 없음, 변경 없음).
3. **응답 형식**: `WorkflowDto`/`NodeDto`/`AuthConfigDto` 선언은 그대로, 실제 값만 선언과 일치하도록 정정. `workflow` undeclared 필드
   제거로 응답이 선언에 더 가까워짐.
4. **에러 응답**: 이번 diff 로 새로 회귀했던 500(Critical)은 고쳐졌고 재발 방지 테스트가 있다. 그 외 에러 경로 변경 없음.
5. **요청 검증**: DTO 검증 규칙 변경 없음. `settings` 최상위 `null` 이 `@IsOptional()` 로 조용히 통과·no-op 되는 기존 동작은
   위 INFO 항목 참고(사전 존재, 문서화 갭).
6. **URL/경로 설계**: 변경 없음.
7. **페이지네이션**: 해당 없음(목록 API 무변경).
8. **인증/인가**: 변경 없음, IDOR 가드 유지.

## 요약

1R 에서 발견된 Critical(`PATCH /workflows/:id { settings: null }` 500 회귀)은 `settings != null` 가드로 고쳐졌고, 코드 재확인(`Read`)과
단위·e2e 테스트, RESOLUTION.md 의 TEST WORKFLOW 로그(lint/unit/build/e2e 422 passed)로 뒷받침된다. 나머지 4개 `omitUndefined` 호출부는
top-level 객체만 받아 같은 위험이 없음을 전수 확인했다. 세 PATCH 엔드포인트의 응답 값 오염(거짓 null·키 누락)과 워크플로 `settings`
JSONB 소실 수정은 저장값·선언에 맞추는 정당한 버그 수정이며 breaking change 로 분류하지 않는다. `PATCH /nodes/:id` 의 undeclared
`workflow` 필드 제거도 계약(`NodeDto`)을 벗어난 적 없던 필드를 되돌린 것이다. 유일하게 새로 짚을 점은 `settings` 최상위 `null` 이
다른 nullable 스칼라 필드("null=지움")와 다르게 "no-op" 으로 처리된다는 의미론적 비일관성인데, 이는 이 diff 가 만든 것이 아니라
크래시만 없앤 사전 존재 동작이며 이미 plan 트래커가 관련 spec 문서화 갭을 planner 인계로 들고 있어 이 PR 을 막을 사유가 아니다.
CRITICAL/WARNING 급 API 계약 위반은 발견되지 않았다.

## 위험도

LOW
