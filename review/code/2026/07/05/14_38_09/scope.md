# 변경 범위(Scope) 리뷰

대상 브랜치: `folder-depth-cycle-guard` — plan V-04 (folder `update()` 시 parentId 변경에 대한 cycle/depth 무검증) 수정.

## 발견사항

- **[INFO]** 변경 파일 구성이 작업 의도(V-04)와 정확히 정합
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts`, `folders.controller.ts`, `folders.service.spec.ts`, `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
  - 상세: 프로덕션 코드 변경은 `update()`에 `validateParentChange` 호출 추가, 신규 private 메서드 `validateParentChange`/`collectSubtree`, 기존 `getDepth`에 `visited` 셋 + 상한 가드 추가로 국한된다. 모두 "parentId 변경 시 계층 무결성 재검증"이라는 단일 목적에 직접 기여하며 관련 없는 로직·다른 엔드포인트·다른 모듈 변경은 없다. Swagger `description` 갱신(controller)과 spec 2곳(`1-data-model.md` 제약조건, `2-navigation/1-workflow-list.md` PATCH 행) 갱신은 코드 변경과 1:1 대응하는 문서 동기화로, CLAUDE.md의 "spec 은 단일 진실" 원칙에 부합하는 필수 수반 변경이지 범위 이탈이 아니다. plan 파일의 V-04 체크박스 갱신 역시 프로젝트 관례(작업 완료 시 plan 갱신)에 따른 필수 동반 변경.
  - 제안: 조치 불요.

- **[INFO]** `getDepth`에 대한 가드 추가가 순수 방어 로직이며 기존 동작 변경 없음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` (`getDepth`)
  - 상세: `visited` Set 과 `depth > MAX_NESTING_DEPTH + 1` 상한은 정상 트리(비순환)에서는 도달하지 않는 조건이라 기존 `create()` 경로의 동작을 바꾸지 않는다. V-04 코멘트에 명시된 대로 "cycle 무한루프 방지"라는 동일 이슈의 일부이며 별도 리팩터링이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 추가분이 신규 로직 커버리지에 집중, 기존 테스트 구조 변경 없음
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts`
  - 상세: 기존 `describe` 블록 뒤에 `describe('update — parentId 재검증 (V-04)', ...)` 하나만 추가됐고 기존 테스트 코드의 수정·삭제는 없다(diff 가 순수 추가, `@@ -91,4 +91,205 @@` 형태로 tail-append). 관련 없는 테스트 리팩토링 없음.
  - 제안: 조치 불요.

- **[INFO]** 동반된 review/consistency 산출물(RESOLUTION.md, SUMMARY.md, 14_28_16 라운드 파일 일체, 14_08_56 consistency-check 산출물)은 프로덕션 코드가 아닌 프로세스 아티팩트
  - 위치: `review/code/2026/07/05/14_28_16/*`, `review/consistency/2026/07/05/14_08_56/*`
  - 상세: 이들은 이전 ai-review 라운드(14_28_16)의 산출물과 그 이전 consistency-check(14_08_56) 산출물로, developer SKILL 워크플로 상 통상 커밋되는 리뷰 히스토리다(사용자 메모리: "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋"). 신규 코드 변경이 아니라 리뷰 이력 기록이므로 scope 이탈로 볼 근거 없음.
  - 제안: 조치 불요. 단, 이 파일들 자체는 scope 리뷰 대상이 아니라 "코드 변경에 부수하는 문서/이력"으로만 취급.

- **[INFO]** 포맷팅·주석·임포트 변경 없음
  - 위치: 전체 diff
  - 상세: 각 diff hunk 가 최소 변경 단위로 좁게 잡혀 있고(controller: description 문자열 1곳, service: 3개 메서드 관련 hunk, spec: tail-append), 무관한 공백/줄바꿈 재포맷팅이나 불필요한 import 추가/정리가 보이지 않는다. 신규 코드 내 주석(`// parentId 변경(재부모화) 시...`, `// 방문 집합 + 상한 가드...`)은 모두 신규 로직의 근거 설명으로, 기존 코드의 주석을 건드리지 않았다.
  - 제안: 조치 불요.

## 요약

이번 변경은 plan V-04(폴더 `update()` 의 parentId 변경 시 계층 무결성 미검증) 이슈 하나에 정확히 스코핑되어 있다. 프로덕션 코드 변경은 `folders.service.ts` 의 `update()`/`getDepth()`/신규 `validateParentChange`·`collectSubtree` 로 국한되고, `folders.controller.ts` 의 Swagger 설명과 `spec/1-data-model.md`·`spec/2-navigation/1-workflow-list.md` 는 동일 동작 변경을 반영하는 필수 동반 문서 동기화다. 테스트 추가는 신규 로직 전용이며 기존 테스트를 건드리지 않았고, plan 체크박스 갱신 및 리뷰/consistency 산출물은 프로젝트 표준 워크플로에 따른 부수 아티팩트다. 의도 이상의 리팩토링, 무관한 파일 수정, 기능 확장, 불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
