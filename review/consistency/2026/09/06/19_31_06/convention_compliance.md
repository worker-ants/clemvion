# 정식 규약 준수 검토 — target: `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 범위와 방법

- scope(`spec/2-navigation`) 델타는 0개 파일 — 이번 PR 은 이 spec 영역 문서를 고치지 않았다.
  검토는 (a) 기존 `2-trigger-list.md`·`3-schedule.md` 본문이 `spec/conventions/**` 를 따르는가,
  (b) 이번 PR 의 코드 diff(`triggers.controller/service.ts`, `pg-error.ts`,
  `workflow-versions.service.ts`, `workspace-response.dto.ts`, `repo-guards/__tests__/*`,
  `shared/testing/*`)가 그 spec 이 이미 약속한 API 계약·명명·출력 형식을 `swagger.md` ·
  `error-codes.md` · `review-citations.md` · `spec-impl-evidence.md` 형식대로 지키는가 두 축이다.
- 프롬프트 번들에서 컨텍스트 예산으로 절단된 `spec/conventions/{swagger,error-codes,
  spec-impl-evidence,review-citations}.md` · `spec/5-system/2-api-convention.md` 은 워킹트리에서
  절대경로로 직접 Read 했다(`/Volumes/project/private/clemvion/.claude/worktrees/
  user-entity-column-defense`, HEAD).
- 코드 사실관계는 전부 `git diff origin/main...HEAD` 와 워킹트리 파일을 직접 Read/grep 해
  확인했다 — 프롬프트 번들에 실린 diff 텍스트가 아니라 실측이다.
- **이번 라운드는 이전 라운드(`review/consistency/2026/09/06/16_58_16`)가 지적한 WARNING 이
  가장 최근 커밋(`e008dd009`, 이 검토 직전 커밋)에서 이미 수정됐는지를 우선 재검증했다.**

## 발견사항

이번 라운드에서 신규로 보고할 CRITICAL/WARNING 은 없다. 직전 라운드(`16_58_16`)가 낸 WARNING
1건은 아래와 같이 HEAD 에서 이미 해소를 확인했다 — 참고로만 남긴다.

- **[해소 확인 — 신규 발견 아님]** 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`
  계약의 Swagger 데코레이터 누락 (직전 라운드 WARNING #1)
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## 3. API` `PATCH /api/triggers/:id`
    블록쿼트 + §2.3.1 `Webhook Configuration | endpointPath` 행
  - 관련 규약: `spec/conventions/swagger.md` §2-4 (`409 → @ApiConflictResponse`)
  - 상세: `triggers.controller.ts` 를 직접 Read 해 확인 — `create()`(L98-101)·
    `update()`(L127-130) 양쪽에 `@ApiConflictResponse({ description: '동일 워크스페이스에 같은
    endpointPath 를 쓰는 트리거가 이미 존재. code=RESOURCE_CONFLICT, details.field="endpoint_path",
    details.code="TRIGGER_ENDPOINT_PATH_CONFLICT".' })` 가 이미 붙어 있다
    (`grep -n "ApiConflictResponse" triggers.controller.ts` → 3건: import + 2곳). `git log -1`
    로 확인하면 이 파일은 커밋 `e008dd009`("fix(backend): 내가 새로 쓴 가드가 자기 서술보다
    좁았다")에서 정확히 이 목적으로 수정됐다. 서비스 계층(`rethrowEndpointPathConflict`)이
    던지는 `code`/`details.field`/`details.code` 값과 데코레이터 설명 문구가 1:1로 일치한다.
  - 제안: 없음 — 이미 해소.

## 점검했으나 위반이 아니라고 판단한 항목 (근거 포함)

- **URL 명명** — `POST /api/triggers/:id/notification/rotate-secret` ·
  `.../interaction/revoke-token` · `.../chat-channel/rotate-bot-token` · `POST
  /api/schedules/:id/run-now` 는 `api-convention.md` §2.2 "RPC-style sub-channel/자원 액션"
  예외 행이 정확히 같은 형태로 등재한 패턴과 일치.
- **상태 토글** — `PATCH /api/triggers/:id { isActive }` 단일 경로, `/toggle` 서브경로 미채택
  (R-4, R-16) — `api-convention.md` §12.1 "상태 토글 전용 endpoint 금지"와 일치. drawer UI 표현
  (read-only 배지)과 API 편집 경로(PATCH body)를 분리한 R-16 의 논리도 규약과 모순 없음.
- **에러 코드 표기** — 이번 diff 가 신설한 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 포함해
  `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`RESOURCE_NOT_FOUND`/`AUTH_CONFIG_NOT_FOUND` 전부
  `UPPER_SNAKE_CASE` — `error-codes.md` §1 표기 규율 위반 없음. `TRIGGER_ENDPOINT_PATH_CONFLICT`
  가 §4.2(트리거 파라미터 검증 전용 파이프라인)에도, §3(historical 예외 레지스트리)에도 속하지
  않는 **신규 자리**라는 점, 그리고 `details` 필드가 object(단일 사유)로 쓰여 `api-convention.md`
  §5.3 이 명문화한 array(`[{ field, message, code }]`) 형태와 모양이 다르다는 점은 이미
  `plan/in-progress/spec-draft-nullable-notation-followups.md` (§"도메인 세부 에러 코드의 표현
  방식을 정식화한다", `review/consistency/2026/09/06/14_59_49` W1 인용)에 planner 항목으로
  등재돼 있고, 그 문서 자신이 "spec(`2-trigger-list.md §3`)이 이미 이 두 층 구조를 문장으로
  선언했으므로 코드가 그 문장을 그대로 실현했을 뿐, 이 PR 이 정책을 일방 결정한 것은 아니다"
  라고 정확히 처분해 두었다 — 재지적 불요.
- **numeric wire 타입 / DTO 위치·네이밍** — 이번 diff 가 건드린 응답 DTO
  (`workspace-response.dto.ts` 신규 `joinedAt`)는 `swagger.md` §5.4(부재 표현: 상시 존재
  nullable → `@ApiProperty({ nullable: true })` + `T | null`)를 정확히 따르고, JSDoc `/** */`
  에는 소비자용 한 문장만, 내부 서사(정정 경위·리뷰 인용)는 `//` 에 둬 §3 "JSDoc 은 공개
  OpenAPI 로 나간다"를 지킨다. 새 응답 타입 `ProjectedCreator`/`WorkflowVersionListItem`/
  `WorkflowVersionDetail`(`workflow-versions.service.ts`)도 같은 원칙(내부 서사는 `//`, 공개
  설명은 JSDoc)을 지킨다. (대상 파일은 spec/2-navigation 프론트매터 밖이라 참고 확인.)
- **리뷰 인용 형식** — 이번 diff 전체(코드 주석·plan 등재 항목) 의 review 인용은 전부
  `review/{code,consistency}/2026/09/06/HH_MM_SS` 전체 경로 또는 `#지적번호` 포함 형태로,
  `spec/conventions/review-citations.md` §2 위반(bare `hh_mm_ss`) 없음. 같은 브랜치가 §3 "DTO
  JSDoc 리뷰 인용 금지" 축을 강제하는 `dto-jsdoc-citation-guard.ts` 를 신설했고, 마지막 커밋에서
  그 가드 자신의 검출 패턴(bare 시각 세 형태 중 백틱 없는 형태 누락)을 발견해 고쳤다 — 가드가
  스스로의 §2 서술("세 형태를 센다")과 실제 정규식이 어긋났던 자기모순을 같은 턴에 닫았다.
  `review-citations.md`·`spec-impl-evidence.md` 두 규약 문서 자신의 frontmatter `code:` 설명도
  "자기-반증형 소정정"(`CLAUDE.md`) 조건 5가지 — developer 자신이 쓴 문장, 예고성 서술,
  실측(가드 신설)으로 반증, 원문 취소선 보존 + 정정만 국소 추가, `--impl-done` 게이트가 이
  파일을 spec-linked 로 재검토 — 를 충족하는 형태로 이뤄져 있다.
- **frontmatter `code:` 파서 안전성** — `review-citations.md` 의 `code:` 블록에 인라인 YAML
  주석(`# 준수 예시` / `# 시행 코드`)이 섞여 있는데, 이 브랜치가 같은 턴에
  `review_guard._parse_frontmatter_code` 를 "빈 줄·`#` 주석을 건너뛰도록" 고쳐(731 대 731,
  프런트엔드 gray-matter 파서와 답이 일치) 그 주석이 항목을 조용히 삭제하지 않음을 확인했다 —
  문서-가드 정합성 위반 없음.
- **plan 라이프사이클 위생** — 직전 라운드 WARNING #2(`spec-draft-api-convention-verifier-
  registration.md` 가 열린 체크박스 0인데 `plan/in-progress/`·`status: in-progress` 로 남아
  있던 건)도 HEAD 에서 확인 — `plan/complete/` 로 이동됐고 frontmatter `status: complete` 로
  갱신됐다(`plan/in-progress/` 쪽엔 더 이상 존재하지 않음).

## 요약

`spec/2-navigation/`(트리거 목록·스케줄 화면) 본문 자체는 URL 명명, 상태 토글 패턴, 에러 코드
표기, 페이지네이션 응답 형식 등에서 `spec/conventions/**` 를 폭넓게 정확히 인용하며 따르고
있다. 이번 PR 코드 diff 도 그 spec 이 이미 문서화한 409 `TRIGGER_ENDPOINT_PATH_CONFLICT`
계약을 처음으로 런타임에서 실현했고, 직전 검토 라운드가 지적한 유일한 WARNING(그 계약의
Swagger 데코레이터 누락)은 이 검토 직전 커밋에서 이미 수정이 확인된다. `details` 봉투 형태의
정식화 미결 등 이미 알려진 gap 은 전부 `plan/in-progress/spec-draft-nullable-notation-
followups.md` 에 사유·인용과 함께 등재돼 있어 이번 라운드에서 재지적할 필요가 없다. 신규
CRITICAL/WARNING 없음.

## 위험도

NONE
