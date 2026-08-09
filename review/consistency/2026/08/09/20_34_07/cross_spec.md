# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 방식

target 은 `spec/5-system/{1-auth.md, 2-api-convention.md, 3-error-handling.md}` 번들이며,
관련 context 로 `spec/0-overview.md`, `spec/1-data-model.md`,
`spec/2-navigation/{1-workflow-list.md, 2-trigger-list.md}` 가 함께 제공됐다. 이 스코프의
핵심 내용(`X-Workspace-Id` UUID 검증 강도 비대칭, 신설 `VALIDATION_ERROR` 행, 부트 캐너리
Rationale)은 직전 커밋 `602f677cd`(PR #1112, "auth 불변식 5곳 spec 동기화")로 이미
`main` 에 반영돼 있어, 저장소 현재 spec 본문(`spec/5-system/1-auth.md`,
`spec/5-system/3-error-handling.md`, `spec/5-system/15-chat-channel.md`,
`spec/data-flow/12-workspace.md`, `spec/conventions/{secret-store.md,error-codes.md}`)을
직접 읽어 대조했다. 해당 커밋은 직전 세션(`review/consistency/2026/08/09/20_07_08`)의
cross-spec 검토(LOW, WARNING 2건)를 이미 거쳤고 두 WARNING(삽입 위치 서술·"19곳"→"18곳"
수치)이 반영돼 있음을 재확인했다(`grep "19곳"` 0건, "말미" 관련 서술 수정 확인).

## 발견사항

- **[INFO]** 신설 `VALIDATION_ERROR`(X-Workspace-Id 형식 오류) 행에 `details.field` 미기재
  - target 위치: `spec/5-system/3-error-handling.md §1.3` 신설 `VALIDATION_ERROR`
    ("`X-Workspace-Id` 형식 오류") 행
  - 충돌 대상: `spec/5-system/2-api-convention.md §5.3` 에러 응답 envelope —
    `details` 항목은 `{ field, message, code: "INVALID_FIELD" }` 구조로 예시된다
  - 상세: 같은 §1.3 안의 다른 `VALIDATION_ERROR` 계열 행(`RESERVED_VARIABLE_NAME`)은
    `details.offenders[]`, `15-chat-channel.md §5.4.1` 동명 코드는
    `details.field='botTokenRef'` 를 명시하는데, 이번 신설 행은 `details` 유무를 언급하지
    않는다. §5.3 이 `details` 를 "선택 필드"로 규정하므로 모순은 아니나, 헤더 기반 거부라
    DTO `field` 개념이 자연히 없다는 점을 한 줄로 명시하면 §5.4.1 의 "동일 코드·다른
    트리거" 각주와 대칭을 이뤄 미래 구현자가 `details.field` 를 잘못 기대하는 것을 막을 수
    있다.
  - 제안: 굳이 병합 전 필수 수정은 아님. 후속 spec 편집 시 "본 케이스는 `details` 를
    동봉하지 않는다(헤더 레벨 거부, DTO 필드 아님)" 한 문장 추가 권고.

- **[INFO]** 검증 완료 — 핵심 cross-reference 사슬은 전부 실제 spec 본문과 일치
  - 확인한 항목: (1) `3-error-handling.md §1.3` 표의 `WORKSPACE_ID_REQUIRED`/신설
    `VALIDATION_ERROR` 두 행 + 3분기 노트가 `data-flow/12-workspace.md` 의 신설
    Rationale subsection("UUID 검증 강도 비대칭")과 앵커·내용 모두 일치, (2)
    `15-chat-channel.md §5.4` 의 형제 행이 `§1.3` 을 canonical 로 정확히 인용하고
    `details.field='botTokenRef'`(§5.4.1)와 "같은 코드 다른 트리거"임을 명시해 코드
    재사용이 error-codes.md §1 의 "의미 기반 명명 + 코드로 분기" 원칙과 충돌하지 않음,
    (3) `1-auth.md` 신설 부트 캐너리 Rationale이 `data-flow/12-workspace.md` 의
    "reflection 파손은 부트에서 막는다" 문단과 상호 역참조 앵커가 정확히 일치, (4)
    `data-flow/12-workspace.md` 의 캐너리 정정 각주(`system-status.e2e-spec.ts` 는
    `@Roles()`/`@WorkspaceId()` 모두 없어 이 술어에 닿지 않는다는 서술)가 `1-auth.md
    §3` RBAC 서술·`RolesGuard` 의 "코드 없는 403" 서술과 모순 없이 정합, (5) 기존
    `NOT_A_MEMBER`(워크스페이스 전환 전용, `1-auth.md §5` `POST
    /api/auth/workspaces/:id/switch`)와 신설 3분기의 "코드 없는 403"(RolesGuard 일반
    경로)이 서로 다른 endpoint/메커니즘이라 요구사항 ID/RBAC 충돌 없이 공존, (6)
    `1-data-model.md` 의 UUID 컬럼 정의(전부 PK/FK 타입 선언, 포맷 강도 미규정)는 이번
    변경이 다루는 "입력값 형식 검증 강도"와 다른 층위라 모순 여지 없음, (7)
    `2-api-convention.md §5.3` 의 "400 기본값=`VALIDATION_ERROR`"·§4(header-first
    우선순위) 서술이 신설 행·3분기 노트와 그대로 부합, (8) `conventions/error-codes.md
    §1` 의 "`VALIDATION_ERROR` 는 prefix-less 시스템 전역 공용 코드"규정이 §1.3 표에
    동일 코드가 두 행(범용 기본값 + X-Workspace-Id 특화)으로 등재된 것을 정당화 — 명명
    규약 위반 아님, (9) `2-navigation/{1-workflow-list,2-trigger-list}.md` 의 기존
    `VALIDATION_ERROR` 사용(폴더 깊이·PATCH 필드 검증 등)은 전부 `details.field` 로 구분되는
    독립 케이스이며 신설 X-Workspace-Id 행과 이름 충돌은 있으나(코드 값 재사용) 이는
    convention 이 명시적으로 허용하는 패턴이라 CRITICAL 이 아님.

## 요약

`spec/5-system/` 스코프는 이미 결정·구현·머지된 auth 불변식 5건(§1.3 신설 `VALIDATION_ERROR`
행, 1-auth.md frontmatter 글로브·부트 캐너리 Rationale, data-flow/12-workspace.md UUID 검증
비대칭 Rationale, secret-store.md `deleteByPrefix` 불변식)을 사후 문서화한 상태이며, 직전
consistency-check 세션(20_07_08)에서 지적된 WARNING 2건(삽입 위치 서술·ParseUUIDPipe 수치)이
모두 반영·정정돼 있음을 재확인했다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임
어느 축에서도 CRITICAL 급 모순은 발견되지 않았다. `VALIDATION_ERROR` 코드가 §1.3 표 안에서
두 행(범용 기본값 + `X-Workspace-Id` 특화)으로 나타나는 것은 `error-codes.md` 가 명시적으로
정의한 "prefix-less 시스템 전역 공용 코드" 패턴과 일치해 충돌이 아니다. 유일한 신규 관찰은
비차단 INFO 1건 — 신설 `VALIDATION_ERROR` 행이 `details` 필드 존재 여부를 명시하지 않아
같은 문서의 이웃 행(§5.4.1 등)과 서술 대칭이 살짝 어긋난다는 점뿐이다. `uuid-canary-docstring-fix`
개발 착수(코드베이스의 `uuid.ts` docstring 을 올바른 회귀 캐너리 — `uuid.spec.ts`
경계 테스트·`workspace-context.util.spec.ts` nil UUID 테스트 — 로 정정하는 작업) 전 spec
기반으로 삼기에 이 번들은 내적으로 일관되고 다른 spec 영역과도 충돌이 없다.

## 위험도

LOW
