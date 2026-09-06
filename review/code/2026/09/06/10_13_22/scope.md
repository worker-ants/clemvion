# 변경 범위(Scope) 리뷰

## 개요

대상 커밋(`96d3856a9`)은 `User` 엔티티 민감 컬럼 노출을 검출하는 두 축 가드(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)를 신설하고, 그 가드에 대한 spec·fixture, 두 e2e 스펙(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`)에 배선, `CHANGELOG.md` 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신으로 구성된다. `git diff --stat origin/main...HEAD` 결과 10개 파일이 정확히 프롬프트의 리뷰 대상 10개 파일과 일치하며, 이 커밋 하나로 완결된다 — 무관한 파일이 섞여 들어온 흔적은 없다.

이 작업은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 등재 항목("`User` 엔티티에 컬럼 수준 방어를 둘지 결정")을 정확히 해소하는 것이 목적이고, 최종 산출물이 그 항목의 요구("착수 시 먼저 잴 것: 7컬럼을 읽는 자리 전수 목록 → `select:false` vs 전역 인터셉터 중 선택")를 그대로 따르지 않고 셋째 길(구조 축 + 이름 축 검출)을 택했다는 점은 CHANGELOG·plan 완료 노트에 근거(19곳 공유 깔때기·46개 호출지점·fail-silent 위험)와 함께 명시돼 있어, 임의 확장이 아니라 실측에 근거한 정당한 방향 전환으로 보인다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto` 에 `joinedAt` 필드 추가는 이번 작업의 핵심 목표(User 컬럼 방어) 밖의 "곁가지" 산출물
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-89`
  - 상세: 이번 PR 이 새로 추가한 `GET /:id/members` e2e(`workspace-rbac.e2e-spec.ts:287`)가 `assertMatchesContract`를 배선하면서, 실제 응답에는 있지만 DTO 에 선언되지 않았던 `joinedAt`이 드러나 함께 선언을 추가했다. `WorkspacesService.listMembers`(`workspaces.service.ts:223`)가 실제로 `joinedAt: m.joinedAt`을 싣고 있음을 확인했고, CHANGELOG(`곁가지` 절)·DTO 주석·plan 완료 노트 세 군데 모두에서 이 파생 발견을 명시적으로 disclose 하고 있다.
  - 제안: 조치 불요(이미 투명하게 문서화됨). 다만 "User 컬럼 방어" 작업의 diff 안에 별개 계약 갭 수정이 섞인 것이므로, 리뷰 시 두 관심사(방어 가드 vs DTO 계약 정정)를 구분해서 봐야 한다는 점만 기록.

- **[WARNING]** 신규 e2e 케이스가 기존 파일의 순차 레이블("A"~"I")과 충돌하는 라벨을 사용
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:287` (신규 `it('F. GET /:id/members …')`) vs 같은 파일 `:382`의 기존 `it('F. sole owner 는 leave 불가 …')` (이번 diff로 변경되지 않은 기존 테스트)
  - 상세: 파일은 A→S→B→C→D→E→F→G→H→I 순으로 케이스를 명명해 왔는데, 신규 테스트를 D 와 E 사이에 삽입하면서 라벨을 새로 매기지 않고 기존 "F"를 재사용해 같은 `describe` 블록 안에 "F." 로 시작하는 테스트가 두 개 존재하게 됐다. 기능적으로는 통과하지만 `jest -t "F\."` 같은 이름 기반 필터가 두 개의 무관한 테스트를 동시에 집는 등, 이 diff 가 만들어낸 새로운 혼동이다.
  - 제안: 신규 테스트를 순서 뒤쪽 새 문자(예: `J.`)로 재명명하거나, 기존 레이블 체계를 포기하고 설명적 이름만 쓰도록 정리.

- **[INFO]** 문서(CHANGELOG·plan) 변경분은 코드 변경과 1:1 대응하며 범위 밖 서술 없음
  - 위치: `CHANGELOG.md:3-53`, `plan/in-progress/spec-draft-nullable-notation-followups.md:284-339`(체크박스 플립 + 완료 노트)
  - 상세: 두 문서 모두 이번 커밋이 실제로 한 일(가드 2종 신설, 선택하지 않은 대안과 근거, 곁가지 발견)만 서술하고 있고, `plan/` 체크박스는 저장소 관례("체크박스 = 실제 상태")를 그대로 따른다. 범위 확장으로 볼 근거 없음.

## 요약

10개 변경 파일 전부가 "User 엔티티 컬럼 수준 노출 방어(검출)"라는 단일 목적에 직접 대응하며, 무관한 리팩토링·포맷팅·불필요한 임포트·설정 변경은 발견되지 않았다. 유일하게 핵심 범위를 살짝 벗어나는 것은 새 e2e 가 드러낸 `WorkspaceMemberDto.joinedAt` 선언 누락 수정인데, 이는 이번 작업이 직접 유발한 파생 갭이고 세 군데 문서에서 투명하게 disclose 돼 있어 실질적 리스크는 낮다. 별도로, 신규 e2e 케이스의 이름표가 기존 파일의 알파벳 순서를 깨고 기존 "F" 테스트와 충돌하는 점은 diff 위생 관점의 실질 결함이라 정정을 권한다.

## 위험도

LOW
