# 변경 범위(Scope) 리뷰

## 개요

`origin/main...HEAD` 는 10개 커밋 · 247개 파일 · +22,946/-28 로 구성된다. 이 중 대다수(약
210개)는 이 브랜치 자신의 반복 `/ai-review` + `/consistency-check` 라운드가 매번
`review/code/2026/09/06/<ts>/**`, `review/consistency/2026/09/06/<ts>/**` 로 커밋에
동봉한 산출물이다 — `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/**`" 저장 규약대로이며,
이 자체는 스코프 이탈이 아니다. 실질 코드/문서 변경은 25개 파일(`git diff --stat
origin/main...HEAD -- codebase/ CHANGELOG.md plan/ spec/`)로 좁혀진다.

핵심 주제("`User` 엔티티 컬럼 수준 방어": `user-entity-exposure-guard.ts`, `user-secret-
absence.ts`, `dto-jsdoc-citation-guard.ts` 3축 신설 + `WorkflowVersionsService.findOne`
의 실유출 수정 + `WorkspaceMemberDto.joinedAt` 선언 갭)은 전부 `plan/in-progress/spec-
draft-nullable-notation-followups.md` 의 등재 항목을 직접 해소하며, 각 파생 발견도 그
문서·`CHANGELOG.md`에 실측과 함께 투명하게 공개돼 있다. 그러나 이 브랜치는 자신의 게이트가
스스로 넓어지며 드러낸 **완전히 다른 두 관심사**를 같은 PR 안에서 마저 처리했다 — 아래
발견사항 참조.

## 발견사항

- **[INFO]** 트리거 `(workspace_id, endpoint_path)` UNIQUE 충돌 처리 신설은 "User 엔티티
  컬럼 방어"와 무관한 별개 계약 갭 수정이며, 게이트 확장의 연쇄로 같은 PR 에 합류했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:213`(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`), `:223`(`isEndpointPathUniqueViolation`), `:427`·`:513`(`.catch((err) => this.rethrowEndpointPathConflict(err))` 배선), `:1608`(`rethrowEndpointPathConflict`); 동반 SoT 확장 `codebase/backend/src/common/db/pg-error.ts:10-11`(`constraint?` 필드 추가)·`:43-46`(`pgErrorConstraint` 신설)
  - 상세: 커밋 이력(`a185846a5`)과 `CHANGELOG.md:139-166` 를 보면 이 변경은 `User` 컬럼
    노출과 무관하게, 파서 수정으로 `workspace-response.dto.ts` 가 처음 spec-linked 로
    잡히면서 `spec/2-navigation/` 전체가 `--impl-done` 게이트 범위에 들어왔고, 그 결과
    `2-trigger-list.md §3` 이 약속한 `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드가 코드에
    0건이라는, 이 PR 이전부터 있던 부채가 드러나 그 자리에서 구현됐다. 커밋 메시지·
    CHANGELOG 모두 "이 PR 이 만든 결함이 아니라 게이트가 넓어져 드러난 기존 부채"라고
    스스로 밝히고 있어 은폐된 변경은 아니지만, 워크트리 이름(`user-entity-column-
    defense`)·plan 등재 항목이 가리키는 범위(User 컬럼 노출 검출)와는 성격이 다른 별도
    기능(트리거 엔드포인트 충돌 응답 계약 구현)이 같은 diff 에 섞여 있다. 리뷰 시 두
    관심사를 분리해서 평가해야 하며, 별도 PR 로 쪼갤 수 있었다면 각각의 리뷰·롤백 단위가
    더 명확했을 것이다.
  - 제안: 조치 불요(이미 근거·실측이 커밋 메시지와 `CHANGELOG.md`에 투명하게 남아 있음).
    다만 향후 유사 상황(gate 확장이 무관한 부채를 드러내는 경우)에서는 별도 커밋 단위로는
    유지하되 가능하면 별도 PR 분리를 우선 검토할 것을 권고.

- **[INFO]** `.claude/hooks/_lib/review_guard.py` YAML frontmatter 파서 수정은 "User 엔티티
  컬럼 방어" 기능과 무관한 harness(게이트 자체) 버그 수정이며, 같은 이유의 연쇄로 합류했다
  - 위치: `.claude/hooks/_lib/review_guard.py:600`(`_parse_frontmatter_code` 독스트링 확장), `:626`(`_strip_comment` 신설), `:644`·`:655`(호출부); 회귀 테스트는 `.claude/tests/test_review_guard.py`(prompt 상 diff 생략, 원본 참조)
  - 상세: `review-citations.md`의 `code:` frontmatter 에 범주 구분용 인라인 YAML 주석을
    넣자 이 파서의 블록 리스트 루프가 첫 비-`- ` 줄에서 `break`해 파싱 결과가 2개→0개로
    떨어지는 회귀를 유발했고(`8b67300b5`), 그 여파로 spec 387개 중 7개 파일에서 41개
    `code:` entry 가 이미 조용히 유실 중이었다는 사실이 드러나 파서 자체를 고쳤다. 이는
    이 PR 의 본래 목적(User 컬럼 노출 검출)과 직접적 인과관계가 없는 **툴체인/게이트
    인프라 수정**으로, 성격상 별도 harness 전용 변경이다. 다만 이 저장소의 기존 관례
    (`feedback_review_fix_stale_loop.md` 등)상 리뷰 루프 중 발견된 게이트 결함을 즉시
    고치는 것은 문서화된 표준 흐름이며, 원인·실측·회귀 테스트가 `CHANGELOG.md:99-137`에
    상세히 공개돼 있어 은폐성 스코프 확장은 아니다.
  - 제안: 조치 불요. 기록 목적의 관찰.

- **[INFO]** `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-
  evidence.md` 편집은 developer 의 `spec/` 쓰기 제약과 배치되어 보이나, 절차상 문제 없음
  - 위치: `spec/conventions/review-citations.md`(`code:` frontmatter에 항목 추가 + `##
    Rationale` 절 취소선 정정), `spec/conventions/spec-impl-evidence.md`(`code` 필드 설명
    행의 취소선 정정)
  - 상세: `CHANGELOG.md:85-98`에 "developer 가 고칠 수 없는 자리였다 — `git log -S` 로
    보면 그 문장은 planner 턴(`90c1751e8`)이 등재했다. 그래서 우회하지 않고 planner 턴을
    열어 정정했다"고 명시돼 있고, 실제 diff 도 원문을 취소선(`~~...~~`)으로 보존한 채
    해당 문장에 국한해 정정을 추가하는 형태(`CLAUDE.md` §자기-반증형 소정정과 유사하지만,
    이 경우는 그 예외 대신 정식 planner 턴 경로를 택함)를 따른다. 스코프 이탈이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 선언 추가는 핵심 목표(User 컬럼 방어) 밖의
  파생 발견이나, 투명하게 공개되어 있다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 이 PR 이 신설한 `GET /:id/members` e2e(`workspace-rbac.e2e-spec.ts:602`, `J.`
    라벨)가 `assertMatchesContract` 를 배선하면서 실제 응답에는 있으나 DTO 에 미선언이던
    `joinedAt` 이 드러나 추가됐다. `WorkspacesService.listMembers` 가 실제로
    `joinedAt: m.joinedAt` 을 싣는다는 실측, `workspace_member` 를 만드는 4자리가 전부
    `new Date()` 로 즉시 채운다는 실측이 DTO 주석(`:82-87`)·`CHANGELOG.md:78-83`·plan
    완료 노트 세 곳에 일관되게 남아 있다. "User 컬럼 방어" 작업의 diff 안에 별개 계약 갭
    정정이 섞여 있다는 점만 기록하며, 실질 리스크는 낮다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 시나리오 라벨(`workspace-rbac.e2e-spec.ts` `J.`, `workflow-crud.e2e-
  spec.ts` `H.`)은 파일 내 기존 알파벳 순서·유일성을 깨지 않는다 — 이전 라운드가 지적한
  `F.` 중복은 현재 재발하지 않음(직접 확인)
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:602`, `codebase/backend/test/workflow-crud.e2e-spec.ts:513`
  - 상세: 두 파일 모두 라벨을 전수 확인(`grep -n "it('[A-Z]\."`)한 결과 파일 내 라벨 중복이
    없고, 새 라벨이 각 파일의 기존 마지막 라벨 뒤에 순서대로 이어진다. 과거 라운드
    (`review/code/2026/09/06/10_13_22`)가 지적했던 `F.` 라벨 충돌은 이후 라운드에서
    이미 정정되었음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 문서(CHANGELOG·plan) 변경분은 코드 변경과 대응하며 범위 밖 서술이 거의 없다
  - 위치: `CHANGELOG.md:1-166`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크박스 플립 + 완료 노트), `plan/in-progress/spec-draft-review-citations-enforcement.md`(신규 후속 트래커)
  - 상세: 두 plan 문서 모두 이번 커밋들이 실제로 한 일과 그 근거(실측 수치, 기각한 대안)만
    서술하며, 체크박스는 저장소 관례("체크박스 = 실제 상태")를 따른다. 유일한 특이점은
    위에서 지적한 두 "곁가지"(트리거 충돌 코드, harness 파서)가 CHANGELOG 최상단의
    "User 엔티티 방어" 절 안에 이어 붙어, 절 제목만 보면 무관한 두 수정이 같은 주제로
    오인될 수 있다는 점이다(단, 본문은 각 절 소제목으로 명확히 구분돼 있음).
  - 제안: 조치 불요.

## 요약

25개 실질 변경 파일 중 대부분은 "`User` 엔티티 컬럼 수준 노출 검출"이라는 단일 목적에
직접 대응하며, 무관한 리팩토링·포맷팅·불필요한 임포트·주석 낙서는 발견되지 않았다. 다만 이
브랜치는 자신의 리뷰 게이트가 반복적으로 넓어지며(`review-citations.md` frontmatter 파싱
버그 수정 → `workspace-response.dto.ts` spec-linked 화 → `2-trigger-list.md` 범위 진입)
연쇄적으로 드러낸 **두 개의 완전히 별개인 관심사**(트리거 엔드포인트 충돌 응답 계약 구현,
`.claude/hooks/_lib/review_guard.py` YAML 파서 버그 수정)를 같은 PR 안에서 마저 처리했다.
둘 다 커밋 메시지와 `CHANGELOG.md`에 원인·실측·근거가 투명하게 공개돼 있어 은폐되거나
임의로 확장된 기능(over-engineering)은 아니지만, "User 엔티티 컬럼 방어"라는 작업명·plan
등재 항목의 범위를 엄격히 잣대로 삼으면 스코프를 벗어난 부수 작업이 맞다. `WorkflowVersions
Service.findOne` 투영 수정과 `WorkspaceMemberDto.joinedAt` 추가는 같은 취약점 클래스의
직접 파생물로 범위 안으로 판단한다. 전체적으로 위험도는 낮다 — 모든 확장분이 문서화·근거
제시·테스트 동반이 되어 있고, 기능적 회귀나 은닉된 변경은 없다.

## 위험도

LOW
