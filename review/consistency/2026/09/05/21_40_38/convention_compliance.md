# 정식 규약 준수 검토 — convention_compliance

## 검토 범위

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- scope 델타: `spec/5-system/**` 파일 변경 **0건** (정상 — 이 브랜치는 코드 전용 PR)
- 실제 검토 대상: `git diff origin/main...HEAD -- codebase/**` 29개 파일 / 1,102줄
  (프롬프트 절단으로 diff 본문이 잘려, 워킹트리를 절대경로로 직접 grep/diff 해 확인)
  - 이번 라운드(`21_40_38`)의 순증분은 직전 라운드(`20_45_39`, 20:45) 이후 커밋
    `67881bbd4`("create() 를 고치고 자매 update() 를 두었다 — 대칭 복구 + 미검증 분기 4건")
    하나다. 나머지(트리거 회전 secret 이중 유출 차단·5개 DTO 23필드 선언·§5.4 금지 조합
    래칫)는 이전 세 라운드(`18_23_03`·`19_08_19`·`20_45_39`)가 이미 상세 검토했고 모두
    LOW 로 수렴했다 — 본 라운드는 그 결론을 재확인하고 신규 커밋만 증분 검토했다.
- 대조한 정식 규약: `spec/5-system/2-api-convention.md §5.4`(부재 표현·검증 층),
  `spec/conventions/swagger.md`(§1-4/§1-6/§3/§5-1), `spec/conventions/secret-store.md §1.1`,
  `spec/conventions/spec-impl-evidence.md`(code: 커버리지)

## 발견사항

- **[INFO]** 신규 DTO 클래스 JSDoc 에 내부 서사가 여전히 섞여 있다 (재발견 — 2라운드째 미수정)
  - target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    의 `ScheduleTriggerWorkflowRefDto`(3~14행) 클래스 docblock
  - 위반 규약: `spec/conventions/swagger.md §3` "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
    서사를 담지 않는다" — "정정 경위·리뷰 참조·왜 이렇게 바꿨는지 같은 내부 서사는
    JSDoc 이 아니라 그 위의 `//` 주석에 적는다"
  - 상세: 클래스 위 `/** ... */` 에 "종전 응답은 조인된 `Trigger` 엔티티 전체를 실어
    보냈고... §5.4 응답-계약 스윕이 `trigger` 를 '선언되지 않은 키' 로 검출해 드러났다"
    는 보안사고 경위 서사가 그대로 남아 있다. `review/consistency/2026/09/05/20_45_39`
    convention_compliance 가 이미 같은 자리를 INFO 로 지적했고("필수 아님, 다음에 이
    파일을 건드릴 때 함께 맞춰도 무방"), 이번 라운드(`21_40_38`)의 유일한 신규 커밋
    (`67881bbd4`)은 이 파일을 다시 건드리지 않아 그대로 남았다.
  - 다만 실질 영향은 없다 — `@nestjs/swagger` CLI 플러그인(`introspectComments`)이
    **클래스 레벨** JSDoc 을 공개 OpenAPI `description` 으로 승격하지 않는다는 점이
    `19_08_19` 라운드에서 이미 실측 확인됐고, 이번에도 재현된다(필드 레벨 JSDoc 만
    승격 대상). 즉 공개 wire 유출은 없고, 순수 코드 스타일/규약 문면 준수 이슈다.
  - 제안: 두 문단(경위 서술)을 클래스 선언 위 `//` 블록으로 옮기고 `/** */` 에는
    "스케줄 응답에 동봉되는 트리거 참조(참조 수준으로 좁혀짐)" 수준의 한 줄만 남긴다.
    §3 "기존 DTO 는 소급 정리 대상이 아니다" 원칙과 동형으로, 다음에 이 파일을 편집할
    때 함께 맞춰도 무방 — 차단 사유 아님.

- **[INFO]** §5.4 래칫의 양성 대조군 fixture 가 `2-api-convention.md` 의 `code:` 커버리지
  밖 (재확인 — 이미 planner 후속으로 등재된 상태)
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` 목록
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` 의 code: 완전성 기대치 —
    `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
    (§5.4 금지 조합 래칫의 존재 이유를 검증하는 양성 대조군)가 현재 `code:` glob
    (`swagger-dto-contract*.ts`) 어디에도 매칭되지 않는다(`*` 가 `/` 를 넘지 않고,
    파일명도 그 접두로 시작하지 않는다 — 폴더 이동/개명으로도 해결 안 됨, 술어가
    `/dto/responses/` 경로를 요구하므로).
  - 상세: 이는 `review/consistency/2026/09/05/20_45_39` W1 이 이미 발견했고, 이번 라운드의
    신규 커밋(`67881bbd4`)이 **정확한 절차**로 처리했다 — developer 는 spec 을 직접 고치지
    않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속
    항목으로 등재만 했다(`code:` 에 `.../fixtures/**` 추가 필요, 2026-09-05 등재).
    CLAUDE.md 의 "spec 변경은 project-planner" 경계를 정확히 지킨 사례라 **위반이 아니라
    확인**이다.
  - 제안: 이미 planner 후속 트래커에 등재돼 있으므로 별도 조치 불요. 다음 spec 쓰기 턴에서
    해당 plan 항목을 소비하면 자연히 해소된다.

## 준수 확인 (참고 — 위반 아님)

이번 라운드의 유일한 순증분(`67881bbd4`)에서 규약 관련 변경을 확인했다:

- **§5.4 대칭 복구**: `SchedulesService.update()` 의 `saved.trigger = trigger ?? schedule.trigger`
  대입을 `if (schedule.isActive)` 블록 밖으로 옮겨 `create()` 와 대칭을 맞췄다 — PATCH
  비활성화 응답에서 `trigger` 키(§5.4 키-생략형)가 요청 값에 따라 조용히 사라지던 결함을
  닫는다. `create()`/`update()` 양쪽 다 "트리거는 `isActive` 와 무관하게 항상 존재한다"는
  동일 불변식을 이제 동일하게 반영한다.
- **§5.4 키-생략형 재검증**: 커밋 서술에 따르면 e2e 가 `POST` 응답(관계 미로드, 3키)과
  `GET` 응답(관계 로드, 4키 — `workflow` 포함)의 실제 형태 차이를 발견해 `ScheduleTriggerRefDto.workflow`
  의 `@ApiPropertyOptional`(키-생략형) 선언이 옳았음을 재확인했다 — 규약이 요구하는
  "선언이 wire 를 반영해야 한다" 원칙이 실제로 작동한 사례.
- **`contractForDto` JSDoc 위치**: 새 `contractCache` 상수가 함수 JSDoc 사이에 끼어들었던
  것을 함수 바로 위로 되돌리고 상수에는 한 줄 주석만 남겼다 — 문서-코드 근접성 유지
  (직접적인 명명/포맷 규약은 아니나 §3 정신과 일치).
- **CHANGELOG 정정**: `appUrl` 을 "키 생략형 예외"로 잘못 적었던 것을 "기본형(e2e 가 첫 판
  선언을 반증)"으로 정정 — §5.4 판정 근거를 정확하게 유지.

## 요약

이번 라운드의 실질 순증분은 커밋 1개(`67881bbd4`)이며, `schedules.service.update()` 를
`create()` 와 대칭으로 복구해 §5.4 키-생략형 계약의 남은 비대칭을 닫았다. 명명·출력 포맷·
문서 구조·API 문서 규약 어느 축에서도 새로운 위반은 발견되지 않았고, 기존에 등재된
INFO 두 건(스케줄 트리거 참조 DTO 의 JSDoc 내부 서사 잔존, 래칫 fixture 의 `code:` 커버리지
공백)은 둘 다 이전 라운드에서 이미 식별·기록된 항목의 재확인이며 후자는 이미 정확한
경계(§spec/ 는 planner 전용)를 지켜 plan 트래커에 등재된 상태다. 실질 wire 유출이나 규약
직접 위반은 없다.

## 위험도

LOW
