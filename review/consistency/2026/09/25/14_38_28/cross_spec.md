# Cross-Spec 일관성 검토 — spec-draft-workspace-path-guard

## 검토 방법

`_prompts/cross_spec.md` 의 번들은 예산 초과로 이 draft 가 실제로 건드리는 9개 대상 파일
(`data-flow/12-workspace.md` · `5-system/{1-auth,2-api-convention,3-error-handling,13-replay-rerun}.md` ·
`conventions/{error-codes,swagger}.md` · `2-navigation/{6-config,9-user-profile}.md`) 을 전부
"본문 생략됨" 으로 떨궜다(`0-overview.md`·`1-data-model.md` 두 파일이 예산을 다 씀 — 기존에 기록된
"consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 패턴의 재현). 번들만으로는 검증이
불가능해, 이 세션은 워크트리의 실제 `spec/**`·`codebase/backend/src/**` 파일을 직접 읽어 draft 의
모든 인용문·grep 주장·수치를 원문과 대조했다.

## 대조 결과 (draft 주장 vs 실측)

다음은 draft 가 인용·주장한 내용을 실제 파일에서 재확인한 목록이다 — 전부 **일치**:

- `data-flow/12-workspace.md` §Overview 전환기 하위호환 문단, Rationale "멤버십 검증은 가드
  1곳에서"(기각 대안 "73개 라우트에 `@Roles('viewer')` 부착 — 74번째 라우트에서 재발" 포함),
  "URL slug = FE 라우팅 SoT", "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도
  비대칭" 절 — draft 의 인용문이 원문과 정확히 일치.
- `5-system/3-error-handling.md` §1.2 `ADMIN_REQUIRED`/`NOT_A_MEMBER` 행, §1.3 "`X-Workspace-Id`
  3분기" 문단 — draft 가 고치겠다는 원문 그대로 확인.
- `5-system/1-auth.md` §1.5.4 "권한 부족 (발송·재발송·취소) | 403 | `forbidden`" 행, §3.2 RBAC
  매트릭스, "부트 캐너리" Rationale — 일치.
- `conventions/error-codes.md` §3 historical-artifact 레지스트리의 `forbidden`/`admin_required` 행,
  "별개 코드 … 의도적 분리" 문장이 `workspace_not_found`·`user_not_found` 두 코드만 지목하고
  `admin_required` 는 그 문장 밖이라는 draft 의 세부 주장까지 원문에서 확인.
- `conventions/swagger.md` §5-4 체크리스트 문구(`@WorkspaceId()` 소비 엔드포인트 조건절·근거문) —
  일치.
- `2-navigation/6-config.md` §A.4 "403 `FORBIDDEN`" 문구 + `auth-configs.controller.ts` 의
  `@Roles('admin')` 5곳(POST·PATCH·regenerate·reveal·DELETE) — grep 으로 정확히 5곳 확인, draft
  주장과 일치.
- `2-navigation/9-user-profile.md` §6.1 "GET .../settings … 비-멤버 403"(코드 미표기) — 일치.
- `5-system/13-replay-rerun.md` 재실행 오류 표 + `executions.controller.ts` 의 재실행 라우트
  `@Roles('editor')` — draft 의 "이 표는 지금도 틀려 있다"는 지적이 실측과 부합(비멤버·Viewer 는
  서비스의 `RERUN_PERMISSION_DENIED` 이전에 가드의 무코드 403 을 받는다).
- `5-system/2-api-convention.md` "403=`FORBIDDEN`" 기본값 문장 — 일치.
- `codebase/backend/src/common/guards/roles.guard.ts` — `ROLE_HIERARCHY`(viewer 1/editor 2/admin
  3/owner 4), `.some()` 최저-역할 OR 비교, 그리고 docstring 의 "가드 거부에 코드를 부여하려면 전
  경로를 함께 바꿔야 한다(별도 작업)" 문장 — draft 의 Rationale "왜 코드를 붙이나" 가 인용하는
  그대로 실재.
- 전역 영향 범위 수치 — `@Roles('editor'|'admin'|'owner'|'viewer')` grep 실측 **66/9/7/5**, draft
  §C-1(e) 의 "editor 66 · admin 9 · owner 7 · viewer 5" 와 정확히 일치.
- `code: 'forbidden'` 발행처 0건(grep), `OWNER_REQUIRED` 는 코드·테스트에만 존재하고 spec 미등재,
  프론트 `workspace/settings/page.tsx:1010` 의 `code === "OWNER_REQUIRED"` 분기 — 전부 draft 주장과
  일치.

## 발견사항

### 다른 spec 영역에 draft 가 놓친 반대 증거는 없음

`git grep`(전수)으로 `spec/` 전체에서 "403 + 역할/멤버십 어휘"·`FORBIDDEN` 출현처를 draft 의 C-9
"전수 방법" 과 별도로 재현했다. draft 가 열거한 6개 수정 대상 외에 남는 자리는:

- `3-workflow-editor/3-execution.md`·`conventions/node-cancellation.md` — "서버도 `@Roles('editor')`
  로 403" (코드 미명시) — draft 가 "«403» 만 적은 서술은 상태가 그대로라 참" 이라 분류한 것과
  같은 부류. `node-cancellation.md` 쪽은 draft 본문이 예시로 들지 않았지만 같은 무코드-403
  서술이라 이 변경으로 거짓이 되지 않는다.
- `4-nodes/2-flow/{0-common,1-workflow}.md`·`5-system/4-execution-engine.md`·
  `conventions/chat-channel-adapter.md` 의 `FORBIDDEN`/`WORKFLOW_FORBIDDEN_WORKSPACE` — sub-workflow
  cross-workspace 격리(`assertSameWorkspace`) 전용 코드로 `RolesGuard` 와 무관. draft 의 배제
  판단과 일치.
- `5-system/6-websocket-protocol.md` 의 `FORBIDDEN` — WS 구독 소유권 검사(execution 단위)로
  `RolesGuard` 와 무관. draft 가 이미 명시적으로 배제.
- `5-system/14-external-interaction-api.md` 의 `FORBIDDEN`/`403` — EIA 토큰 표면 전용, `RolesGuard`
  와 무관. draft 가 이미 명시적으로 배제.
- `4-nodes/1-logic/12-background.md` 의 "멤버 아니면 404"(IDOR 차단, 403 아님) — 별개 메커니즘,
  이 결정의 영향권 밖.

즉 draft 의 C-9 "전수 방법" 이 실제로 전수이며, 이 세션이 별도로 훑어도 빠진 수정 대상은
나오지 않았다.

- **[INFO]** `roles.guard.ts` docstring 은 D 섹션(구현 요구) 밖
  - target 위치: D 섹션(구현 요구 1~8) 전체
  - 충돌 대상: `codebase/backend/src/common/guards/roles.guard.ts` L85-88 docstring
    ("거부는 `false` 반환… 전용 error code 를 붙이지 않는 이유: … 가드 거부에 코드를 부여하려면
    전 경로를 함께 바꿔야 한다(별도 작업)")
  - 상세: 이 draft 의 Rationale "왜 코드를 붙이나" 가 바로 이 docstring 문장을 근거로 인용하며
    "이번에 함께 한다" 고 선언한다. 그런데 D 섹션(구현 요구 1~8)의 어느 항목도 이 docstring
    자체의 갱신을 명시하지 않는다 — 구현 후 이 주석은 "아직 안 한 별도 작업" 을 가리키는 stale
    코멘트로 남는다. spec 충돌은 아니지만(코드 주석) 이 draft 가 직접 인용한 문장이라 후속
    developer PR 이 놓치기 쉽다.
  - 제안: 후속 구현 PR 의 체크리스트에 이 docstring 갱신을 추가(spec 변경 아님, 코드 리뷰 시
    확인 권장).

- **[INFO]** 코드 변경의 실질 blast radius 는 15개 경로 라우트보다 훨씬 크다
  - target 위치: C-1(e) "적용 범위는 전역이다"
  - 충돌 대상: 없음(모순 아님) — `spec/5-system/1-auth.md`·`2-navigation/*`·`3-workflow-editor/*` 등
    `@Roles()` 를 쓰는 전체 87개 라우트(editor 66/admin 9/owner 7/viewer 5, 실측 일치) + 헤더
    위조 거부 전체
  - 상세: 트래커 원 스코프는 "경로 파라미터로 워크스페이스를 받는 라우트 15개" 였으나, "가드
    거부는 전 경로가 함께 코드를 갖는다" 결정으로 인해 이 draft 는 기존에 코드 없이 403 만
    내던 **모든** `@Roles()` 라우트의 wire 코드를 바꾸는 훨씬 넓은 변경이 됐다. draft 스스로
    C-9 에서 전수 확인을 했고 이 세션의 독립 재검증에서도 누락을 찾지 못했으므로 모순은
    아니지만, 이 draft 제목·트래커 항목명("경로 파라미터 워크스페이스…")만 보고 리뷰하면
    실제 영향 범위를 과소평가하기 쉽다.
  - 제안: 없음(정보 제공용) — 후속 developer PR 리뷰 시 "15개 라우트만 바뀐다" 는 전제로
    영향 범위를 오판하지 않도록 링크.

## 요약

이 draft 가 인용하는 모든 spec 원문·grep 수치(`forbidden` 발행 0건, `OWNER_REQUIRED` 코드 전용,
auth-configs 5개 `@Roles('admin')`, 재실행 라우트 `@Roles('editor')`, `@Roles()` 역할별 개수
66/9/7/5 등)를 워크트리의 실제 파일에서 직접 재현했으며 전부 일치했다. 9개 spec_impact 대상
파일 각각의 변경 지점(C-1~C-9)은 서로 다른 문서에 흩어진 동일 사실(가드가 무코드 403 을 낸다,
서비스 코드가 가려진다)을 일관되게 갱신하며, 이 draft가 다루지 않은 다른 영역(sub-workflow
격리 `WORKFLOW_FORBIDDEN_WORKSPACE`, WS 구독 `FORBIDDEN`, EIA 토큰 `FORBIDDEN`, IDOR 404 등)은
`RolesGuard` 와 무관해 이 변경의 영향권 밖이라는 draft 의 배제 판단도 독립 재검증에서 맞았다.
새로 도입하는 요구사항 ID·엔티티·상태 머신은 없으며, 새 에러 코드(`EDITOR_REQUIRED`)는 기존
코드베이스·spec 어디에도 이름 충돌이 없다. 직접적인 spec-대-spec 모순(CRITICAL)이나 우선순위
결정이 필요한 잠재 충돌(WARNING)은 발견하지 못했다 — 남은 항목은 구현 단계에서 참고할 만한
INFO 두 건(코드 주석 stale 위험, blast radius 인지)뿐이다.

## 위험도

LOW
