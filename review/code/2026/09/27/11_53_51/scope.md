# 변경 범위(Scope) 리뷰 — folders-contract-e2e

## 검토 방법

`origin/main...HEAD` 전체 diff(17개 파일, `git diff --stat`으로 실측 대조)를 프롬프트 diff/컨텍스트와 1:1 대조했다. 추가로
`git log --oneline`으로 커밋 단위 의도를, `git show --stat 223f2ad5b`·`git log -- review/consistency/2026/09/27/10_39_26`로
"review/consistency 산출물이 코드 커밋에 함께 실리는 패턴"이 이 PR 고유의 이례적 동작인지 기존 관행인지 실측했다(아래 참고).
저장소 파일은 전혀 수정하지 않았다(`git status --short` 로 뮤테이션 없음 확인 — 조회만 수행).

## 발견사항

이번 diff 는 plan(`plan/in-progress/folders-contract-e2e.md`) "방향" §1~7 이 명시한 항목과 1:1 대응한다 — 서비스
`update()` undefined 필터링, `FolderDto.parentId` §5.4 기본형 전환, 래칫 1행 제거, e2e 신설, 단위·선언 캐너리 테스트,
CHANGELOG, 트래커 좁히기. 각 파일 diff 를 훑어도 요청 범위를 벗어나는 추가 수정·리팩토링·기능 확장·포맷팅 뒤섞기는
찾지 못했다.

- **[INFO]** `review/consistency/2026/09/27/10_39_26/*` 8개 파일(SUMMARY·5개 checker 리포트·meta.json·`_retry_state.json`)이
  기능 코드 수정과 같은 커밋(`223f2ad5b`)에 함께 커밋됐다 — diff 상으로는 코드 변경과 무관한 별도 산출물처럼 보일 수
  있다.
  - 위치: 커밋 `223f2ad5b` 전체(`git show --stat 223f2ad5b`) — 개별 파일 위치는 `review/consistency/2026/09/27/10_39_26/SUMMARY.md` 등 8개.
  - 상세: 그러나 이 저장소는 `review/consistency/**`를 developer 의 `--impl-prep` 의무 산출물 저장 위치로 명시 규약화하고
    있고(CLAUDE.md 정보 저장 위치 표), 실측 결과 이 패턴은 이 PR 고유가 아니다 — 선행 커밋 `e20756844`(`feat(api):
    /integrations/:id/test...`)도 `--impl-prep` 산출물을 같은 커밋에 함께 실었다. 따라서 이것은 스코프 위반이 아니라
    확립된 관행이다. INFO 로만 남긴다.
  - 제안: 조치 불요. (참고로만 기록 — 다음 리뷰어가 "무관한 파일 혼입"으로 오탐하지 않도록.)

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 PR 직접 축(폴더 모듈)이 아닌
  세 파일(`workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts`)의 `Object.assign` 동형 결함 가능성을
  새 백로그 항목으로 추가했다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(diff hunk `@@ -1365,12 +1368,36 @@` 부근, "남은
    세 곳" 문단).
  - 상세: 코드 수정은 폴더 모듈에만 한정돼 있고, 이 세 파일은 **손대지 않았다** — 항목 자체도 "셋 다 실측은 아직
    없다"고 명시한다. 이는 실제 코드 변경이 아니라 발견 사실을 트래커에 등재하는 문서 작업이며, 프로젝트 메모리에
    반복 확인되는 관행("발견했지만 이 PR 의 축이 아니면 트래커에 등재")과 일치한다. 기능 확장(over-engineering)이나
    의도 이상의 코드 변경이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`의 §5.4 스윕 2차 후보 목록에서 이번 PR 이
  닫는 `FolderDto` 외에 이미 다른 PR(#1411~#1413)로 닫힌 4개 DTO(`WorkflowVersionDto` 등)도 함께 취소선 처리했다.
  - 위치: 같은 파일, `@@ -1365,12 +1368,36 @@` 및 `@@ -6257,6 +6284,12 @@` 두 hunk.
  - 상세: plan 자체(`--impl-prep 처분` 절, consistency `plan_coherence` INFO #4)가 "닫힌 넷도 함께 지웠다"고 명시하고,
    실제로 grep(plan 서술)상 그 넷은 선행 PR 에서 이미 완료됐다고 기록돼 있다. 트래커 위생 정리이지 코드 스코프
    확장이 아니다.
  - 제안: 조치 불요.

그 외 개별 파일 단위로도 스코프 이탈을 찾지 못했다:
- `folders.service.ts`: `update()` 메서드 한 곳만 수정(`Object.assign` → undefined 필터). `create()`·`remove()`·
  `getDepth()`·`collectSubtree()`는 무변경.
- `folder-response.dto.ts`: `parentId` 필드 데코레이터·타입만 변경, import 정리는 그 변경의 직접 결과(`ApiPropertyOptional`
  미사용화)이지 별도 정리가 아니다.
- `swagger-dto-contract.spec.ts`: 래칫 배열에서 `folder-response.dto.ts:FolderDto.parentId` 1행만 제거 — DTO 변경의
  직접 귀결.
- `CHANGELOG.md`: 단일 hunk, 항목 1개 삽입만(주변 항목 무변경).
- `folder-crud.e2e-spec.ts`·`folder-response.dto.spec.ts`·`folders.service.spec.ts` 추가분: 모두 이번 결함(undefined
  필드 클로버링·§5.4 선언)만을 겨냥한 신규 테스트, 무관한 assertion 섞임 없음.

## 요약

diff 17개 파일 전부가 plan 이 사전에 선언한 방향(서비스 결함 수정·DTO §5.4 정합화·래칫 상환·e2e/단위/캐너리
신설·CHANGELOG·트래커 좁히기)에 정확히 대응하며, 의도 밖 리팩토링·기능 확장·포맷팅 뒤섞임·불필요한 임포트/설정
변경은 발견되지 않았다. `review/consistency/**` 산출물이 기능 커밋에 동반된 점과 트래커 문서에 이번 PR 축 밖의
백로그 항목이 함께 추가된 점은 처음엔 "무관한 파일 혼입"으로 보일 수 있으나, 실측(`git log`·선행 커밋 대조) 결과
둘 다 이 저장소의 기존 관행/명시 규약에 부합하는 문서 작업이라 INFO 로만 남긴다.

## 위험도

NONE
