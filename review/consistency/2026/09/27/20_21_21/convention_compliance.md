# 정식 규약 준수 검토 — spec/2-navigation/ (cross-workspace-refs, --impl-prep)

검토 대상 diff: `spec/1-data-model.md` §1.1 신설, `spec/2-navigation/1-workflow-list.md` §3/§3.1/Rationale 갱신,
`spec/data-flow/12-workspace.md` Rationale 신설(`git diff origin/main...HEAD`).
대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`,
`spec/conventions/review-citations.md` (전문을 디스크에서 직접 읽음 — 조립된 프롬프트 번들은 `spec/conventions/**` 전체가
컨텍스트 예산 초과로 절단돼 있었다).

## 발견사항

- **[CRITICAL]** 새로 서술한 미구현 표면이 `pending_plans:` 에 없고, Rationale 이 존재하지 않는 "완료" plan 경로를 완료형으로 인용한다
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:`(변경 없음) + §3 Rationale 마지막 문단
    `(2026-09-27 정정) ... plan/complete/cross-workspace-refs.md 가 생성에도 소속 검사를 더했다`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1(`pending_plans` — `status: partial` 시 "미구현 surface 를
    책임지는 plan 경로" 등재 의무) · R-5(spec→plan 역방향 링크로 "어떤 plan 도 책임지지 않는 빈 약속" 방지)
  - 상세: 이번 diff 는 `POST /api/workflows`·`PATCH /api/workflows/:id`·`POST /api/folders` 에 "`folderId`/`parentId`
    는 같은 워크스페이스만 — 아니면 400 `VALIDATION_ERROR`" 를 현재형으로 새로 서술했다. 그런데 실제 코드를 확인하면
    이 검사는 **전혀 구현돼 있지 않다**:
    - `codebase/backend/src/modules/workflows/workflows.service.ts` `create()`/`update()` 는 `dto.folderId` 를
      워크스페이스 검증 없이 그대로 저장한다 (`...dto` spread / `Object.assign(workflow, omitUndefined(rest))`).
    - `codebase/backend/src/modules/workflows/dto/{create,update}-workflow.dto.ts` 의 `folderId` 는 UUID 형식
      검증뿐, 소속 검증이 없다.
    - `codebase/backend/src/modules/folders/folders.service.ts` `create()` 는 `getDepth(data.parentId, workspaceId)`
      만 호출하는데, `getDepth` 의 `findOne({ where: { id, workspaceId } })` 가 타 워크스페이스 부모를 "없음" 으로
      읽어 depth=1 로 조용히 통과시킨다(정확히 diff 의 Rationale 문단이 서술하는 그 버그).
    한편 실재하는 plan 은 `plan/in-progress/cross-workspace-refs.md`(`status: in-progress`, `spec_impact` 에
    `spec/2-navigation/1-workflow-list.md` 포함)뿐이다. `plan/complete/cross-workspace-refs.md` 는 존재하지 않는다
    (`find plan -iname "*cross-workspace*"` → `plan/complete/spec-draft-cross-workspace-refs.md` ·
    `plan/in-progress/cross-workspace-refs.md` 둘뿐). 즉 spec 은 "이미 고쳤다" 는 완료형 서술 + 존재하지 않는
    `plan/complete/` 경로 인용으로, `status: partial` 인 문서에 **책임 plan 없는 새 약속**을 만들었다 — 이 컨벤션이
    텔레그램 chat-channel 영구 누락 사례를 막으려고 만들어진 바로 그 패턴이다. `spec-code-paths.test.ts` 는 `code:`
    글롭이 파일 존재만 확인하므로(`workflows.service.ts` 는 이미 존재) 이 의미론적 갭을 잡지 못한다.
  - 제안: (1) `1-workflow-list.md` frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 추가.
    (2) Rationale 의 plan 경로를 `plan/in-progress/cross-workspace-refs.md` 로 정정하고, 구현 착수 전이므로 시제를
    "…추가할 예정이다" 또는 "이 plan 이 닫히면…" 등 미완료로 낮추거나, 코드 랜딩과 같은 커밋에서 "더했다" 로 확정한다.

- **[WARNING]** 신규 서술이 같은 문서 안의 기존 "미구현 (Planned)" 표기 관례를 따르지 않는다
  - target 위치: `1-workflow-list.md` §3 `POST /api/workflows`·`PATCH /api/workflows/:id` 행, §3.1 `POST /api/folders` 행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` Overview 취지("spec 가 약속한 surface 가 *지금* 구현됐는가") +
    같은 문서 §2.1/§2.7/§3.2 가 이미 쓰고 있는 "**미구현 (Planned)**" 라벨 관례
  - 상세: 같은 파일 §2.1("별도 '트리거 요약' 컬럼... 아직 없다"), §2.7("마켓플레이스 템플릿 추천 링크는 아직 없다"),
    §3.2("포맷 버전 협상은 미구현 (Planned)")는 미구현 항목을 일관되게 라벨링한다. 이번에 새로 추가된 folderId/parentId
    소속 검사 서술만 그 관례 없이 현재형으로 적혀, 문서 내부에서 "이미 되는 것" 과 "아직 안 되는 것" 을 구분하는 유일한
    신호(Planned 라벨)가 이 표면에서만 빠졌다.
  - 제안: 구현 전까지 "(Planned — `plan/in-progress/cross-workspace-refs.md`)" 라벨을 붙이거나, spec 갱신과 코드
    구현을 같은 PR/커밋으로 묶어 present-tense 서술이 항상 사실과 함께 착지하게 한다.

- **[WARNING]** `details[].field='parentId'` 서술이 기존 구현(`validateParentChange`)의 실제 응답 형태와 다르다
  - target 위치: `1-workflow-list.md` §3.1 `PATCH /api/folders/:id` 행의 `(details[].field='parentId' — 생성과 같은 형태)`
  - 위반 규약: `spec/1-data-model.md` §1.1(신설, SoT) 이 규정한 거부 응답 형태 `details: [{ field, message, code:
    'INVALID_FIELD' }]` — `spec/2-navigation/` 는 이 SoT 를 참조해 서술하므로 §1.1 과 실제 코드가 어긋나면 참조하는
    쪽(본 문서)도 같이 부정확해진다
  - 상세: 현재 `folders.service.ts` 의 `validateParentChange` (PATCH 재부모화 시 이미 동작 중인 검증)는
    `throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '...' })` 만 던지고 `details` 를 싣지 않는다.
    `http-exception.filter.ts` 는 예외 객체가 명시적으로 실은 `details` 만 봉투에 통과시키므로, 지금 이 라우트가 실제로
    내는 응답에는 `details[].field` 자체가 없다. 새 spec 문구는 "(생성과 같은 형태)" 라고 적어 마치 POST/PATCH 양쪽이
    이미 `details[].field='parentId'` 형태를 공유하는 것처럼 읽히지만, 실제로는 **둘 다** 그 형태를 내지 않는다(POST 는
    검사 자체가 없고, PATCH 는 검사는 있으나 `details` 가 없다).
  - 제안: 구현 plan 에 "PATCH 의 기존 `validateParentChange` 도 `details: [{ field: 'parentId', message, code:
    'INVALID_FIELD' }]` 형태로 함께 갱신" 을 명시적으로 적어, "생성과 같은 형태" 라는 서술이 실제로 두 경로 모두에서
    성립하도록 만든다.

- **[INFO]** plan 경로 인용이 저장소의 마크다운 링크 인용 관례와 다르고, 그래서 build 가드가 오기를 잡지 못했다
  - target 위치: `1-workflow-list.md` §3 Rationale `(2026-09-27 정정)` 문단의 `` `plan/complete/cross-workspace-refs.md` ``
  - 위반 규약: (참고) `spec/conventions/review-citations.md` §3 — `plan/**` 자체는 인용 날짜 규약 대상은 아니지만, 같은
    문서·인접 Rationale(`spec/data-flow/12-workspace.md` 의 "구현·결정 기록: [`plan/complete/spec-draft-workspace-path-guard.md`]
    (../../plan/complete/spec-draft-workspace-path-guard.md)")들은 plan 경로를 실제 마크다운 링크로 인용해
    `spec-link-integrity.test.ts`(spec-impl-evidence.md §4.2) 의 링크 존재 검사를 받는다. 이번 인용은 backtick 코드
    텍스트일 뿐 링크가 아니어서 그 가드가 대상으로 보지 않았고, 그래서 존재하지 않는 경로가 그대로 통과했다.
  - 상세: CRITICAL 항목과 동일 원인(오기)의 형식적 측면 — 링크였다면 build 가 이 오류를 잡아 줬을 것이다.
  - 제안: `[plan/in-progress/cross-workspace-refs.md](../../plan/in-progress/cross-workspace-refs.md)` 형태의
    실제 링크로 바꾸면, 향후 plan 이 이동/이름 변경될 때 같은 가드가 drift 를 잡아준다.

- **[INFO]** 명명·에러 코드 자체는 규약을 따른다 (긍정 확인)
  - `VALIDATION_ERROR`(시스템 전역 공용, prefix 없음) · `RESOURCE_CONFLICT` · `AUTH_CONFIG_NOT_FOUND` ·
    `MODEL_CONFIG_NOT_FOUND` · `INVALID_FIELD` 모두 `spec/conventions/error-codes.md` §1(의미 기반 명명)·§2(신규 코드
    재사용, rename 지양) 를 따르며 새 코드를 신설하지 않고 기존 코드를 재사용했다. `details[].field=` 대 `details.field=`
    표기 차이(1-workflow-list.md 는 배열, 2-trigger-list.md 의 chat-channel 단일-object 분기는 flat)도 각 SoT
    (`1-data-model.md §1.1` vs `15-chat-channel.md §5.4.1`)의 실제 응답 형태 차이를 정확히 반영해 문제 없음.
  - `1-workflow-list.md`/`spec/1-data-model.md` 는 `## Overview` 절 없이 바로 `## 1. …` 로 시작하는 기존 스타일이라
    "Overview/본문/Rationale" 권장 3섹션을 엄밀히는 안 지키지만, 이번 diff 가 만든 상태가 아니라 문서 전체의 기존
    스타일이며 `spec/data-flow/12-workspace.md`(diff 대상)는 `## Overview` ~ `## Rationale` 구조를 정확히 갖추고
    신규 절도 그 구조 안(`## Rationale` 하위 `###`)에 올바르게 배치했다. 새 위반이 아니므로 별도 등급 없이 기록만 한다.

## 요약

이번 diff 의 에러 코드 명명·응답 형태 표기·문서 구조는 `spec/conventions/error-codes.md`·기존 3섹션 관례를 대체로
지킨다. 다만 가장 무거운 문제는 규약 위반이라기보다 **규약이 막으려던 사고가 실제로 재발**한 것이다 —
`spec/conventions/spec-impl-evidence.md` 가 텔레그램 chat-channel 영구 누락을 계기로 요구한 "status: partial 문서는
미구현 surface 를 `pending_plans:` 로 반드시 추적한다" 는 원칙이, 이번에 새로 서술한 folderId/parentId 워크스페이스
소속 검사(코드로 직접 확인 결과 전혀 미구현)에는 적용되지 않았고, Rationale 은 존재하지 않는 `plan/complete/` 경로를
완료형으로 인용해 "이미 고쳤다" 는 인상을 준다. `code:` 글롭 기반 build 가드는 파일 존재만 보므로 이 의미론적 갭을
잡지 못했다 — 사람이 잡아야 하는 자리다. impl-done 게이트를 이 spec 파일이 포함되는 scope 로 다시 돌리기 전에
`pending_plans:`·Rationale plan 경로·`details[].field` 서술 셋을 함께 바로잡을 것을 권한다.

## 위험도

HIGH
