# 변경 범위(Scope) 리뷰 — forbidden-desc-codes

## 리뷰 방법

프롬프트에 실린 32개 파일 unified diff 전부를 확인했고, 크기 제한으로 잘린 파일(다수 컨트롤러)은 diff hunk 만으로 판단 가능한
수준(설명 문자열 치환 + import 추가)이라 전체 컨텍스트 재확인이 불필요했다. 추가로 `plan/in-progress/forbidden-desc-codes.md`
(작업 plan)와 `git diff --stat origin/main...HEAD` 를 대조해 리뷰 대상 32개 파일이 plan 이 명시한 범위와 정확히 일치하는지
검증했다.

## 발견사항

- **[INFO]** `workspaces.controller.ts` · `integrations.controller.ts` 는 "빠진 129곳"보다 넓게 손댔다(이미 코드를 담고 있던
  로컬 상수 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE`, `FORBIDDEN_MEMBER` 등도 공용 헬퍼로
  교체).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (게이트 33~68), `codebase/backend/src/modules/integrations/integrations.controller.ts` (게이트 92~97)
  - 상세: 두 파일은 이미 거부 코드를 문장에 담고 있던 28곳 중 상당수를 포함한다. 이번 diff 는 그 로컬 상수 정의부까지 지우고
    `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole`로 대체했다 — 엄밀히는 "빠진 곳 채우기"를 넘어 "같은 문장의 중복 정의 제거"까지
    포함한다.
  - 다만 이는 `plan/in-progress/forbidden-desc-codes.md` §방향에 "`workspaces.controller.ts` 의 로컬 상수 셋 · integrations 의
    상수를 헬퍼로 옮긴다(같은 문장이 두 벌이 되지 않게)"로 **명시적으로 선언된 작업**이라 의도 이상의 변경이 아니다. 정보 제공
    목적으로만 기록.
  - 제안: 조치 불요(plan 근거로 이미 정당화됨).

- **[INFO]** `roles.guard.ts` 에서 인라인 `reduce` 3줄을 `lowestRequiredRole(requiredRoles)` 한 줄 호출로 바꾼 것은 "설명 문자열
  교체" 작업 자체와는 결이 다른 리팩터링(로직 이동)이다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:219-222`
  - 상세: 동작은 동일(같은 식을 `common/constants/workspace-roles.ts` 로 추출)하고, 새 repo-guard가 가드와 **같은 함수**를 써서
    모델 드리프트를 막기 위한 것으로 plan §방향("문턱 계산 공유")에 사전 계획돼 있었다. 순수 이동이며 새 단위 테스트
    (`workspace-roles.spec.ts`)로 뒷받침된다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 대상 32개 파일은 `git diff --stat`(6개 공용 파일 + 24개 컨트롤러 + 2개 신규 repo-guard 파일)과 1:1로 일치했고,
  그 외 브랜치 diff에는 `CHANGELOG.md`·spec draft·plan 문서·이전 리뷰 라운드 산출물(`review/**`)만 있었다 — 전부 developer
  워크플로 §REVIEW/§CHANGELOG 의무가 요구하는 부산물이라 코드 스코프 이탈이 아니다.
  - 위치: (해당 없음 — 전수 대조 결과)
  - 상세: 이번 코드 리뷰 스코프(파일 1~32) 밖에서 코드 영역을 건드린 흔적은 없었다.

- **[INFO]** 각 컨트롤러 diff 는 예외 없이 (a) `common/swagger` import 목록에 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole` 추가,
  (b) 하드코딩 한국어 403 설명 문자열을 그 상수/헬퍼 호출로 치환, 두 가지 패턴만 반복한다. import 는 실제 사용된 심볼만
  추가됐고(예: `dashboard.controller.ts` · `statistics.controller.ts` · `workflow-versions.controller.ts` · `notifications.controller.ts` 는
  역할 기반 라우트가 없어 `FORBIDDEN_NOT_A_MEMBER`만 import), 라우트 핸들러 로직·DTO·주석 실질 내용은 손대지 않았다. 포맷팅
  전용 변경이나 미사용 임포트, 임의 주석 편집은 발견되지 않았다.

## 요약

이번 변경은 표면적으로 32개 파일(그중 24개는 서로 다른 컨트롤러)을 건드려 스코프가 커 보이지만, `plan/in-progress/forbidden-desc-codes.md`
에 사전 승인된 계획(§방향·§요구·§체크리스트)과 diff 내용이 항목 단위로 정확히 일치한다 — 129곳 403 설명 문자열 치환, 공용 헬퍼
신설, `lowestRequiredRole` 추출, 신규 repo-guard 2파일. 로직 변경은 `roles.guard.ts` 의 순수 함수 추출 하나뿐이며 이는 새 가드의
정확성을 위해 plan 이 명시적으로 요구한 것이다. 의도 밖 리팩터링·기능 확장·무관한 파일 수정·포맷팅 오염·불필요한 주석/임포트
변경은 발견되지 않았다.

## 위험도

NONE
