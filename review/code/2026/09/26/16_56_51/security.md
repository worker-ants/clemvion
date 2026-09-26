# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경셋은 전부 다음 세 종류로 구성된다.

1. `codebase/backend/test/workflow-assistant.e2e-spec.ts` — e2e 테스트 파일 1곳의 단언(assertion) 강화. 제품 코드 변경 없음.
2. `plan/in-progress/*.md`, `review/consistency/**/*.md|json`, `spec/3-workflow-editor/_product-overview.md` — 작업 추적·일관성 검토 산출물·PRD 표기 정정(문서만).
3. 그 외 나머지는 이전 `/consistency-check` 세션(16_14_14, 16_27_26, 16_35_16)이 이미 생성한 리뷰 산출물(SUMMARY/체커별 결과/`meta.json`/`_retry_state.json`) — 이번 diff 에 새로 포함된 것은 파일 자체(신규 생성)일 뿐, 내용은 별도 세션의 결과물이라 보안 관점의 "코드 변경"이 아니다.

즉 실행 가능한 애플리케이션 코드(백엔드 컨트롤러/서비스/프론트엔드) 변경은 **하나도 없다**. 아래는 그럼에도 점검 관점별로 확인한 내용이다.

## 검토 상세

### 1. 인젝션 취약점
`workflow-assistant.e2e-spec.ts` 의 추가된 요청들은 전부 `supertest` 로 고정된 JSON body(`{ name: uniqueName(...) }`, `{ workflowId }`)를 보낸다. 사용자 제어 입력을 이어붙여 쿼리/명령을 구성하는 부분이 없다. 해당 없음.

### 2. 하드코딩된 시크릿
`token`/`workspaceId` 는 `registerAndLogin`/`createTeamWorkspace` 헬퍼가 매 테스트 실행마다 동적으로 발급한 값이며, 리터럴 자격증명이 소스에 박혀 있지 않다(`codebase/backend/test/workflow-assistant.e2e-spec.ts:29-38`). 새로 추가된 코드(`emptyWorkflow`, `none` 요청)도 동일한 `authHeaders()` 헬퍼를 재사용한다. 해당 없음.

### 3. 인증/인가
- 새로 추가된 두 요청(`POST /api/workflows`, `GET /api/workflow-assistant/sessions/latest`)은 모두 기존 `authHeaders()`(Bearer 토큰 + `X-Workspace-Id`)를 그대로 사용해 인증 컨텍스트를 유지한다. 인가 우회를 유발하는 변경이 없다.
- `plan/in-progress/spec-draft-ed-ai-19-status.md` 가 다루는 대상(ED-AI-19: "워크플로우 실행 중 편집 도구가 거부되어야 한다" — `ASSISTANT_WORKFLOW_RUNNING` 가드 미구현)은 **인가/상태 검증 관점에서 흥미로운 기존 갭**이지만, 이번 diff 는 그 갭을 새로 만든 것이 아니라 PRD 표기를 상세 spec(이미 "미구현"으로 서술)과 맞추는 **문서 정합화**일 뿐이다. 실측 근거(`ASSISTANT_WORKFLOW_RUNNING` grep 0건)도 diff 안에 포함돼 있어 은폐성이 없다. 코드 수정이 아니므로 이 리뷰의 CRITICAL/WARNING 대상은 아니지만, 참고로 남긴다 — 실행 중 워크플로에 대해 Assistant 편집 도구 호출을 막는 서버측 상태 검증이 아직 없다는 것이 문서로 확인된 상태다(제품/구현 백로그 사안, 이번 PR 소관 아님).

### 4. 입력 검증
테스트 추가분은 서버 입력 검증을 우회하거나 완화하지 않는다. 오히려 `sessions/latest` 응답 계약(`data: null` 케이스, 상태 코드 200 고정, 방금 만든 세션 id 일치)과 도구 호출 DTO의 선택 키 생략 케이스를 새로 커버해 계약 검증 커버리지를 넓히는 방향이다.

### 5. OWASP Top 10
해당 없음 — 신규 엔드포인트·비즈니스 로직 변경이 없다.

### 6. 암호화
해당 없음.

### 7. 에러 처리
새 단언들은 `expect(...).toBe(200)`, `toStrictEqual({ data: null })` 등 응답 바디/상태 코드만 검사하며, 에러 메시지에 민감정보를 노출시키는 로직 변경은 없다.

### 8. 의존성 보안
`import` 구문에 새 서드파티 패키지가 추가되지 않았다(`crypto`, `pg`, `supertest` 등 기존 의존성만 사용).

### 리뷰 산출물(review/consistency/**) 자체에 대한 확인
`_retry_state.json`, `meta.json` 등에 절대경로(`/Volumes/project/private/clemvion/...`)가 포함돼 있으나 이는 로컬 워크트리 경로이지 시크릿이 아니다. 토큰·자격증명·API 키 패턴은 발견되지 않았다.

## 요약

이번 변경셋은 백엔드 e2e 테스트 1개 파일의 단언 강화(제품 코드 변경 없음)와 작업 추적/일관성 검토 문서·PRD 표기 정정으로만 구성되어 있어, 인젝션·시크릿 하드코딩·인증/인가 우회·암호화·에러 노출 등 보안 관점에서 새로 도입된 리스크가 없다. 다만 이번 diff 가 문서화한 기존 사실(§ED-AI-19: 실행 중 워크플로에 대한 Assistant 편집 도구 거부 가드가 아직 구현되지 않음)은 인가/상태검증 공백으로서 별도 구현 작업이 필요한 기존 갭이며, 이미 별도 plan/spec 트래커로 인계되어 있다.

## 위험도

NONE
