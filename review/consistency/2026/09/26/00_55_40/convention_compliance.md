# 정식 규약 준수 검토 — spec-draft-integration-personal-owner-callback.md

## 검토 대상
`plan/in-progress/spec-draft-integration-personal-owner-callback.md` (spec draft, `--spec` 모드) — OAuth 콜백의
"커밋 직전 인가 재판정"을 `spec/data-flow/5-integration.md` §1.2, `spec/2-navigation/4-integration.md` §10.4,
`spec/5-system/1-auth.md` §3.2 세 곳에 서술 추가하는 변경안.

## 확인한 정식 규약 (spec/conventions/**) 및 대조 결과

- **`spec/conventions/error-codes.md`** — draft 가 인용하는 `RESOURCE_NOT_FOUND`·`ADMIN_REQUIRED` 는 신규 코드가
  아니라 `integration-visibility.ts`(`integrationNotFoundError`)·`integration-oauth.service.ts:819`에 이미
  존재하는 값이며 `UPPER_SNAKE_CASE`(§1)·"의미 기반 명명"(§1) 을 그대로 따른다. rename 이 아니라 기존 코드의
  재사용이라 §2 rename 안정성 정책과도 충돌 없음. **위반 없음**.
- **`spec/conventions/spec-impl-evidence.md`** §1 — `spec/data-flow/**` 는 frontmatter(`id`/`status`/`code`) 의무
  대상에서 명시적으로 제외되어 있고(§1 inclusive list 밖, "해당 파일들은 frontmatter 자체가 없다"), draft 가
  수정하는 `5-integration.md` 도 실제로 frontmatter 가 없다 — draft 는 이 파일의 frontmatter 를 건드리지
  않으므로 **위반 없음**. `4-integration.md`(`status: partial`, `pending_plans` 기재)·`1-auth.md`(`status: partial`)
  두 파일도 draft 가 frontmatter 를 바꾸지 않고 본문만 보강하므로 스키마 위반 소지 없음.
- **`.claude/skills/project-planner/SKILL.md`** (spec draft 산출물 규약, CLAUDE.md 가 참조) — "`plan/in-progress/
  spec-draft-<name>.md` 에 변경안 작성, 본문 끝에 `## Rationale`" 요구를 파일명(`spec-draft-integration-personal-
  owner-callback.md`)·본문 구조(`## 실측` → `## 변경안` → `## Rationale`) 모두 그대로 따른다. 같은 PR 의 자매
  draft 둘(`spec-draft-integration-personal-owner.md`, `-assistant.md`)과 구조가 동일하다. frontmatter 도
  `title/status/owner/worktree/spec_impact/started` 6필드로 [`plan-lifecycle.md §4`](../../../../../.claude/docs/plan-lifecycle.md) 의
  `worktree`/`started`/`owner` 필수 3필드를 포함한다. `spec_impact` 3개 경로 모두 실재 파일. **위반 없음**.
- **`spec/conventions/review-citations.md`** §2 — `review/consistency/2026/09/26/00_43_55`, `review/code/2026/09/25/
  22_45_37` 등 인용이 전부 "전체 경로"(권장 형태)이고 bare `hh_mm_ss` 는 없음. **위반 없음**.
- 실제 코드(`integration-oauth.service.ts` `assertRequesterStillAllowed`/`markIntegrationCallbackError`)를 대조한
  결과 draft 의 "실측" 절 서술(판정 순서, `pending_install` 제외, 트랜잭션 커넥션 재사용, `connected`+비-교환
  실패는 `last_error` 만 기록되고 `status_reason` 은 안 건드림)이 코드와 정확히 일치한다. 에러 코드 문자열도
  `RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED` grep 결과와 일치.
- **API 문서 규약(`swagger.md` 등)** — 이 draft 는 DTO·컨트롤러·데코레이터를 건드리지 않으므로 해당 축은
  적용 대상 아님(N/A).
- **금지 항목** — `audit-actions.md`(인라인 문자열 금지)·`error-codes.md`(rename 금지) 등 conventions 가 명시적으로
  금지하는 패턴을 재현하는 부분 없음.

## 발견사항

- **[INFO]** `spec/5-system/1-auth.md` §3.2 삽입 노트가 테이블의 기존 각주-마커 관례와 어긋남
  - target 위치: draft "### (3) `spec/5-system/1-auth.md` §3.2" 절
  - 위반 규약: 명시적으로 성문화된 `spec/conventions/**` 항목은 없음 — §3.2 표 자체가 관례로 정착시킨 로컬
    패턴(참고용, 강제 규약 아님)
  - 상세: 현재 §3.2 표는 부연 설명이 필요한 행에 `†`(멤버 관리 †)·`※`(System Status ※) 같은 **인라인 마커를
    행 이름에 붙이고**, 그 마커에 대응하는 각주를 표 아래(또는 표 중간)에 둔다. draft 가 추가하는
    "Integration (Personal) 의 «자기 것»" 노트는 `> ※ **System Status**` 바로 앞에 삽입되지만 "Integration
    (Personal)" 행 자체에는 마커가 붙지 않는다 — 표에 마커 없는 행에 대한 각주가 하나, 마커 있는 행("System
    Status ※")에 대한 각주가 그 바로 뒤에 오는 모양이 되어, 새 독자가 두 번째 문단을 "System Status" 관련
    보충 설명으로 오독할 여지가 생긴다.
  - 제안: "Integration (Personal)" 행에 `※` 계열의 새 마커(예: `Integration (Personal) ※2` 또는 다른 기호)를
    붙여 관례를 유지하거나, 노트 자체를 "Integration (Personal)" 행 바로 아래(현재 `†` 각주가 표를 끊고 등장하는
    자리와 동일한 방식)로 옮긴다. 이 마커 관례가 앞으로도 쓰일 것이면 `project-planner` SKILL.md 나 해당 spec
    문서 자체에 "표 각주는 인라인 마커 + 표 하단 각주" 규칙을 한 줄로 명문화하는 것도 고려할 만하다(현재는
    암묵적 관례라 이번처럼 놓치기 쉬움).

- **[INFO]** §10.4 신규 행의 "팝업 표시" 컬럼 값이 다른 행과 성격이 다름
  - target 위치: draft "### (2) `spec/2-navigation/4-integration.md` §10.4 에러 매핑" 절, 신규 행
  - 위반 규약: 없음(스타일 제안) — §10.4 표 자체의 컬럼 관례
  - 상세: 기존 §10.4 표의 두 번째 컬럼("팝업 표시")은 실제 팝업에 렌더링되는 리터럴 문구(`Security validation
    failed. Please try again.`, `Integration not found.` 등)를 담는다. draft 의 신규 행은 이 칸에
    "거부 사유(`RESOURCE_NOT_FOUND` · `ADMIN_REQUIRED`)"를 넣어, 다른 행과 달리 실제 팝업 문구가 아니라
    추상적 사유 라벨을 적었다. 코드 정확성 문제는 아니고(이 실패는 팝업이 아니라 API 에러 응답 경로일 수
    있음) 표기 성격이 형제 행과 갈릴 뿐이다.
  - 제안: 실제로 팝업 HTML 을 거치는 경로라면 그 리터럴 문구로 교체하고, 팝업을 거치지 않는(API 에러 응답만
    나가는) 경로라면 컬럼 값에 "N/A (팝업 없음, API 에러 응답)" 식으로 명시해 컬럼 의미와의 불일치를 없앤다.

CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 요약

target 문서는 `project-planner` SKILL.md 의 spec-draft 산출물 규약(파일명 패턴·`## Rationale` 종결·frontmatter
3필수 필드)과 `spec/conventions/error-codes.md`(에러 코드 명명·rename 정책)·`spec/conventions/spec-impl-
evidence.md`(frontmatter 적용 범위, `data-flow/**` 제외)·`spec/conventions/review-citations.md`(전체 경로 인용)를
모두 정확히 따른다. 인용한 에러 코드·함수명·동작 서술은 실제 코드(`integration-oauth.service.ts`)와 대조해도
정확하다. 발견된 두 항목은 성문화된 `spec/conventions/**` 규약 위반이 아니라 대상 spec 문서 자체가 이미 갖고
있는 암묵적 서식 관례(§3.2 표의 마커-각주 짝짓기, §10.4 "팝업 표시" 컬럼의 리터럴-문구 관례)와의 사소한
어긋남으로, INFO 등급의 형식 일관성 제안에 그친다.

## 위험도
LOW
