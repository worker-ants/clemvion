# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `findById()`의 404 처리를 `throwAuthConfigNotFound()` 헬퍼로 추출 — 버그 자체(동시 삭제 이중 감사)와 직접 관련 없는 기존 코드 경로(`findById`)를 함께 리팩터링
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:131-154` (`findById`, `throwAuthConfigNotFound`)
  - 상세: 이번 결함 수정의 핵심은 `remove()` 내부의 `remove(config)` → `delete({id, workspaceId})` 전환 하나다. 그런데 diff 는 `findById()`의 인라인 `throw new NotFoundException(...)` 블록도 함께 걷어내 새 private 헬퍼로 옮겼다. 이 자체는 `remove()`가 같은 404 를 두 번째로 던져야 하므로 중복 방지 목적이 명확하고, `plan/in-progress/authconfig-dup-delete.md` §A 에 "형제 넷이 전부 같은 추출을 했다(#1370~#1373)"는 선례와 함께 사전 고지돼 있다. 범위 이탈이라기보다 이번 변경이 만든 두 번째 사용처를 정당화 근거로 삼은 최소 리팩터링이라 판단했다.
  - 제안: 조치 불요 — 근거가 diff·plan 양쪽에 이미 명시돼 있다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(다른 트래커) 2개 항목 편집 — 이번 PR의 핵심 목표(`AuthConfigsService.remove()` 동시 삭제 결함)와 직접 관련 없는 두 가지 부수 작업이 같은 diff 에 섞여 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4842-4874`(RolesGuard 근거 정정), `plan/in-progress/spec-draft-nullable-notation-followups.md:4944-4964`(6축 고정 열거 → 재열거형 일반화)
  - 상세: (1) 첫 번째 편집은 `#1373`(workspaces 멤버 제거 PR)에서 이 developer 세션이 예전에 남긴 "`RolesGuard` 가 없다"는 근거를 "전역 `APP_GUARD`였다"로 정정한 것이고, 대상 코드(`workspaces.controller.ts`)는 이번 auth-configs 작업과 무관하다. (2) 두 번째 편집은 "삭제 엔드포인트 spec 서술 누락" 항목을 고정 열거(4개)에서 재열거형("집행 시점 기준 스냅샷")으로 바꾸며 auth-configs 를 7번째 자리로 추가한 것이다. 둘 다 `plan/**`(developer 쓰기 권한 범위) 안에 머물고, `plan/in-progress/authconfig-dup-delete.md` 체크리스트에 "부수 발견"·"착수 전 일반화"로 명시적으로 disclose 돼 있어 은닉된 변경은 아니다. 다만 (1)은 이번 PR의 직접 대상이 아닌 다른 완료 PR의 근거 오류를 고치는 것이라 엄밀한 "요청된 변경"의 경계 밖이고, (2)는 auth-configs 항목 추가에 필요한 최소 편집(리스트에 한 줄 추가)을 넘어 항목 전체의 서술 방식을 재작성했다.
  - 제안: 코드 변경이 아니고 spec/거버넌스 문서도 아니므로 차단 사유는 아니다. 다만 향후엔 이런 "부수 발견 정정"은 별도의 작은 커밋으로 분리해 두면 diff 리뷰 시 "이 PR이 실제로 무엇을 바꾸는가"를 더 빨리 판별할 수 있다.

- **[INFO]** `review/consistency/2026/09/21/14_41_01/**` 8개 파일 신규 생성 — 코드 변경이 아닌 프로세스 산출물이 diff 에 포함
  - 위치: `review/consistency/2026/09/21/14_41_01/{SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md}`
  - 상세: `CLAUDE.md`가 `developer`는 구현 착수 직전 `consistency-check --impl-prep` 을 의무로 규정하고 그 산출물 저장 위치를 `review/consistency/**`로 지정하므로, 이 8개 파일은 요청되지 않은 추가 작업이 아니라 프로젝트가 상시 승인한 필수 워크플로 부산물이다. 범위 이탈로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 포맷팅·임포트·설정 파일 변경 없음
  - 상세: `git diff origin/main --stat` 결과 13개 파일 전부가 프롬프트에 열거된 파일과 정확히 일치하고(숨겨진 diff 없음), `auth-configs.service.ts`/`auth-configs.service.spec.ts`에 무관한 공백·줄바꿈 재정렬이나 사용하지 않는 임포트 추가는 없다. 테스트 파일에 추가된 `import { DeleteResult } from 'typeorm'`는 새 mock 타입 명시에 실제로 쓰인다.
  - 제안: 없음.

## 요약

핵심 코드 변경(`auth-configs.service.ts`의 `remove()` 원자적 DELETE 전환, 신규 단위/e2e 회귀 테스트)은 명시된 목표(동시 삭제 이중 감사 로그 제거)에 정확히 대응하며 `git diff --stat` 로 대조한 결과 프롬프트에 없는 숨은 변경도 없다. `findById()`의 헬퍼 추출은 이번 변경이 만든 404 두 번째 사용처를 근거로 정당화되고 plan 에 사전 고지돼 있어 경미한 수준이다. 유일하게 눈에 띄는 범위 확장은 별도 트래커 문서(`spec-draft-nullable-notation-followups.md`) 안의 두 항목(다른 PR의 근거 정정, 무관 항목의 서술 방식 일반화)인데, 둘 다 `plan/**` 범위 내 문서 편집이며 이 PR 의 체크리스트에 명시적으로 disclose 돼 있어 은닉성 문제는 없다. `review/consistency/**` 산출물은 프로젝트가 의무화한 프로세스 부산물이라 범위 이탈이 아니다. 전반적으로 스코프는 잘 지켜졌다.

## 위험도

LOW
