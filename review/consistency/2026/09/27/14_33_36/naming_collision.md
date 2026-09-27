# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-done, patch-omit-undefined)

## 검토 범위 요약

target 은 `spec/2-navigation/` 이나, `origin/main...HEAD` 대비 이 영역의 **spec 델타는 0개 파일**이다
(`git diff origin/main...HEAD --stat -- spec/2-navigation/` 실측, 출력 없음). 즉 이번 PR 은 이 spec
영역에 어떤 요구사항 ID·엔티티명·API 계약도 새로 쓰지 않았다 — 코드 전용 PR 이다.

실제 변경은 `codebase/backend/` 10개 파일(구현 diff 654줄, `_code_diff.patch` 로 확인)로, PATCH 요청이
보내지 않은 필드를 `Object.assign` 이 `undefined` 로 덮어써 응답·DB 값을 잃던 결함(`workflows.service.ts` /
`nodes.service.ts` / `auth-configs.service.ts`)을 기존 헬퍼 `omitUndefined` 로 고치는 작업이다. 이 작업이
**새로 도입하는 식별자**가 있는지 diff 전문을 대조했다.

## 새로 도입되는 식별자 인벤토리 (diff 실측)

- **요구사항 ID**: 없음. spec 델타 0.
- **엔티티/타입/DTO**: 없음. `WorkflowDto` / `NodeDto` / `AuthConfigDto` / `WorkflowSettingsDto` /
  `UpdateWorkflowDto` / `UpdateNodeDto` / `UpdateAuthConfigDto` 모두 기존 클래스를 그대로 재사용
  (import 추가만 있고 신규 선언 없음 — `git log --oneline --all` 로 각 DTO 파일이 이 브랜치 이전부터
  존재함을 확인). 유일한 신규 타입은 `omit-undefined.ts` 내부의 지역 유틸리티 타입 `NotArray<T>` 뿐이며,
  export 되지 않고 파일 밖에서 쓰이지 않는다(`git grep NotArray` — 선언·사용 모두 같은 파일 3곳).
- **API endpoint**: 없음. `PATCH /api/workflows/:id`, `PATCH /api/nodes/:id`,
  `PATCH /api/auth-configs/:id` 모두 기존 endpoint 다.
- **이벤트/메시지명**: 없음.
- **환경변수·설정키**: 없음. `settings.maxConcurrentExecutions` 는 이미
  `spec/2-navigation/1-workflow-list.md` §3.2 · Rationale §2 에 정의된 기존 키이며, 이번 diff 는 그
  키를 "지우지 않도록" 병합 로직만 고쳤다 — 새 키를 추가하지 않았다.
- **파일 경로**: 신규 파일 1건 — `codebase/backend/test/patch-partial-body.e2e-spec.ts`
  (`git log --oneline --all` 로 이 브랜치의 `fd21691c9` 커밋에서 최초 생성 확인). 그 외 변경은 모두
  기존 `*.service.spec.ts` 에 케이스 추가.

## 발견사항

- **[INFO]** 신규 e2e 파일명이 형제 명명 컨벤션(`<도메인>-<시나리오>`)에서 벗어남 — 재확인, 결론 불변
  - target 신규 식별자: `codebase/backend/test/patch-partial-body.e2e-spec.ts`
  - 기존 사용처: `codebase/backend/test/*.e2e-spec.ts` 전수(`workflow-crud`, `folder-crud`,
    `trigger-update-save-window`, `schedule-trigger` 등 79개 파일 — 전체 목록 실측) 는 예외 없이
    `<도메인>-<시나리오>` 축을 쓴다. `patch-partial-body` 는 워크플로우·노드·인증설정 세 도메인에 걸친
    "결함 클래스" 축이라 유일하게 다른 명명 축을 쓴다.
  - 상세: 이는 `--impl-prep` 단계(`review/consistency/2026/09/27/13_11_33/naming_collision.md`)에서
    이미 지적·처분된 항목이며, plan 본문(`plan/in-progress/patch-omit-undefined.md`)에 근거가 명시돼
    있다. impl-done 시점에 실제 diff 를 봐도 파일명이 기존 79개 파일 어느 것과도 겹치거나 혼동을 부를
    만큼 유사하지 않다 — 실충돌은 없다.
  - 제안: 차단 사유 아님. 파일 상단 JSDoc(이미 "결함 클래스 축" 근거 서술 포함, diff 내 L1-L11)을
    유지하면 다음 사람이 "도메인 누락"으로 오인하는 것을 막기에 충분하다.

- **[NONE]** `omitUndefined` 헬퍼 재사용 확산 — 충돌 없음
  - target 신규 식별자: 없음(기존 헬퍼 재사용). `omit-undefined.ts` 는 이전 폴더 PR(`b55e14f77` 계열)
    에서 이미 도입됐고, 이번 PR 은 `triggers.service.ts` / `folders.service.ts` 에 이어
    `workflows.service.ts` / `nodes.service.ts` / `auth-configs.service.ts` 세 곳에 배선을 확장할
    뿐이다. 시그니처도 `T extends object` → `T & NotArray<T>` 로 배열을 막는 방향으로만 좁아졌고,
    기존 호출부(`triggers.service.ts:622`, `folders.service.ts:75`)의 의미와 어긋나지 않는다.
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts`,
    `codebase/backend/src/modules/folders/folders.service.ts`.
  - 상세: 동일 의미로 일관되게 재사용되므로 충돌 대상 아님.

- **[NONE]** 노드 응답에서 제거된 `workflow` 키 — 신규 식별자 아니라 기존 유출 제거
  - `nodes.service.ts` 의 `update()` 가 반환하던 IDOR 검사용 `workflow` 관계 전체 객체를 이제 분리해
    빼는(`const { workflow: _workflow, ...response } = saved`) 변경이다. 이는 신규 식별자를 도입하는
    것이 아니라 `NodeDto` 가 애초에 선언하지 않은 필드의 유출을 제거하는 것이라 이 관점(신규 식별자
    충돌)의 대상이 아니다.

## 요약

target(`spec/2-navigation/`) 은 이번 PR 에서 spec 델타 0 — 새 요구사항 ID·엔티티/DTO명·API endpoint·
이벤트명·환경변수/설정키를 도입하지 않았다. 실제 구현 diff(654줄, 10개 코드 파일)를 전수 대조해도
export 되는 신규 식별자는 없으며, 유일한 신규 산출물은 `--impl-prep` 단계에서 이미 검토·처분된 e2e
파일 `patch-partial-body.e2e-spec.ts`(형제 명명 컨벤션과 축이 다르지만 실충돌 없음, plan 에 근거
명시)과 파일 지역 타입 `NotArray<T>`(비export, 단일 파일 내 사용) 뿐이다. `omitUndefined` 헬퍼의
배선 확장은 기존 두 사용처와 의미가 일관된다. 신규 식별자 충돌 관점에서 이 PR 이 머지된 뒤에도 추가로
조치할 사항은 없다.

## 위험도

NONE
