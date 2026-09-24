# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `plan/in-progress/`·`plan/complete/` 디렉터리 리터럴이 두 곳에 독립적으로 존재한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:95` (`PENDING_PLAN_DIRS` 선언) / `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:60` (`planRel.replace("/in-progress/", "/complete/")`, 이번 diff 범위 밖의 기존 코드)
  - 상세: 이번 PR 이 신설한 `isPendingPlanPath`는 "어느 디렉터리가 work plan 위치인가"라는 지식을 `PENDING_PLAN_DIRS` 배열 하나로 잘 응집시켰다. 그런데 바로 옆 `it("pending_plan path resolves", ...)`(기존 코드, 미변경)은 같은 지식을 `"/in-progress/"` → `"/complete/"` 문자열 치환으로 별도로 인코딩하고 있다. 두 표현이 우연히 같은 두 디렉터리를 가리키고 있을 뿐, 코드 상 서로 참조하지 않는다 — 나중에 세 번째 plan 위치(예: 향후 `plan/complete/archive/` 자체가 별도 카테고리로 승격되는 경우)가 추가되면 한쪽만 갱신되고 다른 쪽은 조용히 낡을 수 있다.
  - 제안: 이번 PR 을 막을 사안은 아니다(기존 코드는 이번 diff 가 건드리지 않았고, PR 이 추가한 부분 자체는 리터럴을 정확히 한 곳에 모았다). 다음에 이 파일을 만질 기회가 있으면 `resolves` 체크도 `PENDING_PLAN_DIRS` 기반으로 파생시켜 두 지식을 합치는 편을 권한다.

- **[INFO]** 새 술어의 "닫힌 허용목록(allow-list)" 설계는 이 가드의 목적에 맞게 fail-closed 다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:95-100` (`PENDING_PLAN_DIRS`, `isPendingPlanPath`)
  - 상세(긍정 평가, 조치 불요): `isPendingPlanPath`는 "존재하는 모든 경로"가 아니라 정확히 두 디렉터리 접두사만 허용하는 화이트리스트다. 향후 새로운 plan 디렉터리 관례가 생겨도 코드를 명시적으로 고치지 않는 한 자동으로 허용되지 않는다 — `#1386` 사고(존재 검사가 임의 파일을 통과시킨 것)가 재발하지 않도록 정확한 방향으로 좁혀졌다. 정규화(`path.posix.normalize`)를 접두사 검사 **이전**에 수행해 `..` 이스케이프도 닫았다.

## 요약

변경 핵심은 기존 `isApplicable`과 동일한 형태(순수 함수, 단일 책임의 경로 분류 술어)를 그대로 답습해 `isPendingPlanPath`를 `spec-frontmatter-parse.ts`(4개 가드가 공유하는 헬퍼 허브로 이미 문서화된 위치)에 추가한 것으로, 기존 아키텍처 관례를 정확히 따른다. 책임 분리도 명확하다 — "이 경로가 plan인가"(신규, `isPendingPlanPath`)와 "그 plan이 디스크에 실존하는가"(기존 `it("... resolves")`)를 서로 다른 검사로 유지해 관심사를 섞지 않았고, 가드가 항목마다 두 검사를 순서대로(존재 이전에 형태) 돌리도록 배선했다. 순환 의존성이나 레이어 경계 위반, 과도/부족한 추상화는 발견되지 않았고, `pending_plans` 소비처가 이 가드 하나뿐임을 확인해 모듈 경계도 깔끔하다. 유일하게 짚을 점은 "plan 위치 디렉터리"라는 동일 지식이 신규 `PENDING_PLAN_DIRS`와 기존(미변경) resolve 체크의 문자열 치환 두 곳에 독립 존재한다는 것인데, 이는 이번 diff 가 만든 문제가 아니라 이번 diff 가 완전히 해소하지 못한 기존 중복이며 위험도는 낮다.

## 위험도
NONE
