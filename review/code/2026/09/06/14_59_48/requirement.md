# 요구사항(Requirement) 리뷰

## 범위에 대한 메모

`git diff origin/main...HEAD --stat` 기준 222개 파일 중 실질 코드/스펙 변경은 22개
(`.claude/hooks/_lib/review_guard.py`, `triggers`/`workflow-versions` 서비스,
`user-entity-exposure-guard`/`user-secret-absence`/`dto-jsdoc-citation-guard` 3종
가드 + fixture/spec, e2e 3건, `CHANGELOG.md`, `plan/in-progress/*.md` 2건,
`spec/conventions/review-citations.md`·`spec-impl-evidence.md`)이고, 나머지
~200개는 이 브랜치의 이전 리뷰 라운드(`review/code/**`, `review/consistency/**`)
산출물이 커밋된 것이라 "구현 완전성" 리뷰 대상이 아니다. 아래는 실질 코드/스펙
변경 22개에 집중한 결과다.

## 발견사항

- **[WARNING]** `review_guard._strip_comment` 가 따옴표로 감싼 YAML 스칼라 뒤의
  트레일링 주석을 처리하지 못해, 이번에 막으려던 것과 **같은 등급의 "죽은
  glob"** 을 재생산할 수 있다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_strip_comment` 함수 (`_parse_frontmatter_code` 내부, block-list/inline-list/single-value 세 분기가 모두 이 함수를 거친다)
  - 상세: `_strip_comment` 는 토큰이 `"`/`'` 로 시작하면 트레일링 주석 처리를
    건너뛰고 원문을 그대로 반환한다 (`if t.startswith('"') or t.startswith("'"): return t`).
    그런데 그 뒤 `_clean` 이 하는 `.strip('"').strip("'")` 은 문자열 **양 끝**의
    따옴표만 제거하므로, `"a.ts"  # 비고` 같은 입력에서는 선행 `"` 만 지워지고
    닫는 `"` 와 주석 텍스트는 그대로 남는다. 실제로 재현했다(scratch, 저장소
    비변경):
    ```python
    _clean('"codebase/backend/a.ts"  # 비고')
    # -> 'codebase/backend/a.ts"  # 비고'   (닫는 따옴표 + 주석이 그대로 남음)
    ```
    이 PR 자체의 커밋 메시지·문서(`CHANGELOG.md`, `spec-impl-evidence.md`)가
    이 파서의 목적을 "**entry 가 조용히 사라지는 것**을 막는다" · "gray-matter
    프런트엔드 파서와 **같은 답을 내야 한다**" 라고 명시한다. 그러나 quoted
    스칼라 + 트레일링 주석 조합에서는 두 파서가 갈린다 — gray-matter(js-yaml)는
    YAML 스펙대로 주석을 제거한 순수 문자열을 내고, 이 Python 파서는 오염된
    문자열을 낸다. 현재 저장소 `spec/**` 의 `code:` 리스트 항목 중 따옴표를 쓰는
    사례가 0건이라(grep 확인) **지금 당장 어떤 spec 파일도 이 경로로 깨지지
    않는다** — 그래서 CRITICAL 이 아니라 WARNING 이다. 다만 이 함수가 스스로
    "두 파서가 일치해야 한다"고 선언한 계약을 완전히 충족하지 못한 상태로 남아
    있고, 앞으로 누군가 `#` 을 포함한 파일명(`a#b.ts`, 이 PR 이 이미 대조군으로
    다루는 형태)을 따옴표로 감싸 주석과 함께 적으면 같은 실패가 재발한다.
  - 제안: `_strip_comment` 를 quoted 스칼라에 대해서도 "닫는 따옴표 뒤"의
    `\s+#...` 를 잘라내도록 확장(예: 닫는 따옴표 위치를 찾아 그 뒤 텍스트에서
    주석을 분리)하거나, 최소한 `.claude/tests/test_review_guard.py` 에 quoted +
    trailing-comment 대조군 테스트를 추가해 이 갭을 명시적으로 기록한다(현재는
    unquoted 트레일링 주석 테스트만 있고 quoted 케이스는 없다).

- **[INFO]** §5.4 "검증 층" 표·`code:` 등재 후속 작업이 의도적으로 미완 상태로
  남아 있음 — 결함이 아니라 투명하게 추적된 부채
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "신규
    검출 3축을 §5.4 「검증 층」과 `code:` 에 등재" 항목 (체크박스 미체크)
  - 상세: 새로 만든 두 가드(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`)가
    `spec/5-system/2-api-convention.md` §5.4 · `spec/conventions/swagger.md`
    §5-1 어느 `code:` glob 에도 걸리지 않는다는 사실을 `review_guard._spec_linked_changes()` 로
    직접 확인한 뒤 plan 에 명시적으로 남겼다(정본 게이트에 직접 질의, 재구현
    아님). 즉 이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가
    현재는 잡지 못한다. 다음 planner 턴을 위한 조치 지시(glob 폭 주의사항 포함)까지
    이미 적혀 있어 "숨겨진 갭" 은 아니지만, 요구사항 관점에서 이 PR 산출물
    자체의 spec 등재가 아직 완결되지 않았다는 사실은 기록해 둔다.
  - 제안: 조치 불요(이미 후속 planner 턴으로 등재·추적됨). 다음 라운드에서
    처리 확인.

## 검증 결과 요약 (문제 없음을 확인한 항목)

- `TriggersService.isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict` —
  `V002__indexes.sql` 의 `idx_trigger_workspace_endpoint` 이름과 SQLSTATE 23505
  를 함께 좁혀 사용, `create`/`update` 양쪽에 배선, 다른 UNIQUE 위반·비-DB 오류는
  그대로 흘려보냄을 단위 테스트로 왕복 확인. `2-trigger-list.md` §3(요약 표)·
  §3(엔드포인트 상세) 두 곳의 "409 `RESOURCE_CONFLICT` / 세부 코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT` / `details.field='endpoint_path'`" 문구와
  코드가 정확히 line-level 로 일치. `GlobalExceptionFilter` 가 `code`/`message`/
  `requestId`/`details` 만 복사한다는 주석의 주장도 실제 필터 코드로 확인.
- `WorkflowVersionsService.findOne`/`findByWorkflow` — `CREATOR_PROJECTION` 이
  `WorkflowVersionCreatorDto` 의 실제 필드(`id`/`name`/`email`)와 일치(수동 확인
  + 자체 swagger-probe 테스트로 이중 보증). `findOne` 에 없던 `select` 투영을
  추가해 자매 메서드와 동일한 형태로 맞춘 것 확인.
- `user-entity-exposure-guard.ts` 의 `EXPECTED_USER_RELATION_LOADS` 래칫(3건:
  `auth.service.ts#logout`/`#refresh`, `workspaces.service.ts#listMembers`) —
  저장소 전체 엔티티(`@ManyToOne(() => User, ...)`)의 실제 프로퍼티 이름을
  전수 대조해 파생 집합(`creator`/`executor`/`owner`/`user`)이 정확함을, 그리고
  이 집합에 대해 투영 없이 로드하는 자리가 정확히 위 3곳뿐임을 grep 으로
  독립 재확인. `WorkflowVersionsService` 의 두 조회는 이제 `select` 투영이
  있어 목록에서 정상적으로 빠짐.
- `user-secret-absence.ts`/`.spec.ts` — null 전파, 최상위(봉투 없음), 중첩
  배열, snake_case, 유사 이름 오검출 방지, 원시값 입력 등 엣지 케이스 전부
  양성/음성 테스트로 커버.
- `dto-jsdoc-citation-guard.ts` — `review-citations.md` §2 의 세 인용 형태
  (전체 경로/날짜+시각/bare 시각)와 정규식 3종이 일치, `§3` 의 "응답 DTO만
  대상, 컨트롤러 미강제" 카브아웃이 `isResponseDtoFile()` 범위 제한으로
  정확히 반영됨. 기존 프로덕션 위반 2건(베이스라인 동결)도 실제 소스에서
  확인.
- `WorkspaceMemberDto.joinedAt` 신설 — `WorkspacesService.listMembers` 가
  `joinedAt: m.joinedAt` 을 무조건 반환값에 싣는 실제 코드와 대조해
  "상시 존재 + null 허용" 판단이 정확하고, `2-api-convention.md` §5.4 "기본은
  `null`" · `@ApiProperty({ nullable: true })` + `field: T | null` 규칙과
  정확히 일치.
- TODO/FIXME/HACK/XXX 등 미완성 표시 신규 도입 0건(diff 전체 grep 확인).
- `workspace-rbac.e2e-spec.ts` 의 spec 인용 정정(`§1.3` → `§3(인가)`)은
  `spec/5-system/1-auth.md` 의 실제 섹션 번호(`## 3. 인가 (Authorization)`)와
  대조해 올바른 수정임을 확인 — §1.3 은 무관한 "셀프 호스팅 추가 인증" 절이었다.

## 요약

`User` 엔티티 컬럼 노출 방어(검출) 기능은 세 가지 축(관계 로드 구조 스캔,
응답 값 이름 기반 부재 단언, DTO JSDoc 인용 금지)이 서로 다른 실패 모드를
겨냥해 설계됐고, 각 가드는 fixture 기반 양성/음성 대조군과 뮤테이션 검증
이력(리뷰 산출물 인용으로 추적됨)까지 갖춰 "테스트가 실제로 문다"는 것이
반복 확인된 상태다. 핵심 비즈니스 로직(트리거 endpoint_path UNIQUE 충돌
매핑, WorkflowVersion.creator 투영, WorkspaceMemberDto.joinedAt 부재 표현)은
관련 spec 본문과 line-level 로 정확히 일치하며, 실제로 살아있던 보안 유출
(`WorkflowVersionsService.findOne`)을 이 작업이 새로 찾아 닫았다는 점도 코드로
검증된다. 유일하게 실질적으로 지적할 것은 `review_guard.py` 의 YAML 주석
스트리핑이 quoted 스칼라 조합에서 자기 자신이 선언한 "두 파서 일치" 계약을
완전히 충족하지 못하는 좁은 회귀 가능 지점이며(현재 실제 spec 파일에는
영향 없음), 그 외 후속 작업은 이미 plan 에 투명하게 추적되어 있다.

## 위험도

LOW
