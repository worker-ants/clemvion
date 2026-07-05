# 부작용(Side Effect) Review — V-04 folder depth/cycle guard (재리뷰, 14_38_09)

대상 프로덕션 코드는 이전 리뷰 라운드(`review/code/2026/07/05/14_28_16`)와 동일 커밋(`26abaf425 fix(folders): update() parentId 재부모화 계층 무결성 가드 (V-04)`)이다. `git log`로 확인한 결과 `folders.service.ts`/`folders.controller.ts`는 그 이후 추가 커밋이 없다. 이번 diff 셋에서 실질적으로 새로 추가된 것은 (1) `folders.service.spec.ts`의 테스트 케이스 2건 추가(경계값 depth=5 통과, 형제 다중 서브트리 BFS cycle), (2) plan 체크박스 갱신, (3) 이전 라운드의 리뷰 산출물(SUMMARY/RESOLUTION/각 reviewer md/meta.json/_retry_state.json) 신규 파일 추가, (4) spec 문서(`1-data-model.md`, `2-navigation/1-workflow-list.md`) 동기화다. 아래는 이 갱신분을 포함해 부작용 관점으로 재검토한 결과다.

## 발견사항

- **[INFO]** 프로덕션 코드(`folders.service.ts`, `folders.controller.ts`) 자체는 이전 라운드와 완전 동일 — 재확인 결과 재론할 신규 부작용 없음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` (`update`, `getDepth`, `validateParentChange`, `collectSubtree`), `folders.controller.ts` (Swagger description 문자열만)
  - 상세: `git log --oneline -- codebase/backend/src/modules/folders/folders.service.ts`는 V-04 구현 커밋 1건만 보유하며 이번 라운드에 추가 수정이 없다. 이전 side_effect 리뷰(`review/code/2026/07/05/14_28_16/side_effect.md`, 위험도 NONE)가 이미 다음을 확인했다: (a) `update(id, workspaceId, data)` 시그니처·반환 타입 불변, 호출자(`FoldersController`) 영향 없음, (b) 전역 변수·환경 변수·파일시스템·네트워크 호출 도입 없음, (c) `visited`/`ids`/`frontier`는 모두 메서드 로컬 변수로 요청 간 공유 없음, (d) 이벤트/콜백 트리거 추가 없음, (e) `getDepth()`는 `private` 메서드로 외부 호출자 없음. 코드가 그대로이므로 이 결론은 여전히 유효하다.
  - 제안: 없음(재확인 완료).

- **[INFO]** 신규 테스트 2건(경계값 depth=5, 형제 다중 서브트리 BFS) — 프로덕션 부작용 없이 순수 mock 기반, 기존 패턴과 일관
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts` `allows reparent at exactly max depth (parent depth 4 + leaf = 5)`, `detects cycle across a multi-child, multi-level subtree (BFS 다중 frontier)`
  - 상세: 두 테스트 모두 `mockRepository.findOne`/`mockRepository.find`에 대한 `mockResolvedValueOnce` 체이닝만 사용하며, 실제 DB·파일시스템·네트워크에 접근하지 않는다. `beforeEach`의 `mockRepository.findOne.mockReset()`/`mockRepository.find.mockReset()`는 Jest mock(테스트 전용 공유 fixture)의 호출 이력만 초기화하며 프로덕션 상태에 영향 없다. 파일 스코프에서 한 번만 생성되는 `mockRepository` 객체를 여러 `describe` 블록이 공유하는 기존 구조도 이전 라운드에서 이미 지적된 사항으로 이번 신규 테스트가 그 위험을 악화시키지 않는다(각 `it` 앞에 `mockReset` 실행되어 격리 유지).
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/05/14_28_16/**` 신규 파일 일괄 추가(SUMMARY·RESOLUTION·13개 reviewer md·meta.json·_retry_state.json) — 리뷰 프로세스 산출물, 런타임 부작용과 무관
  - 위치: `review/code/2026/07/05/14_28_16/` 전체
  - 상세: 이 파일들은 이전 `/ai-review` 실행이 생성한 정적 문서 산출물이며 애플리케이션 코드·전역 상태·외부 서비스와 무관하다. `_retry_state.json`은 오케스트레이션 세션의 로컬 상태 파일로 절대경로(`session_dir` 등)를 포함하지만 이는 review 스킬 자체의 관례(`.claude/skills/code-review-agents`)이며 이번 diff 가 새로 도입한 패턴이 아니다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 체크박스 갱신 — 문서 상태 변경, 코드 부작용 없음
  - 위치: 파일 4, L31-34
  - 상세: V-04 항목을 `[ ]`→`[x]`로 갱신하고 완료 근거(브랜치·PR·TEST WORKFLOW 결과)를 기록한 것으로, 순수 계획 문서 갱신이다. 런타임 동작에 영향 없음.
  - 제안: 없음.

- **[INFO]** RESOLUTION.md 서술과 실제 diff의 정합성 확인 — "프로덕션 코드 무변경" 주장이 diff 검증과 일치
  - 위치: `review/code/2026/07/05/14_28_16/RESOLUTION.md` "build: 통과 (직전 — 본 조치는 테스트/plan 만, 프로덕션 코드 무변경)"
  - 상세: 이번 diff 세트에서 `folders.service.ts`/`folders.controller.ts`에 대한 변경 헝크가 파일 3/1에 나타나지만, 이는 diff 도구가 base(main) 대비 전체 변경분을 다시 보여주는 것이며 실제로는 이전 커밋(26abaf425)에서 이미 반영된 동일 내용이다(git log 확인). 이번 라운드에서 서비스/컨트롤러에 대한 "추가" 변경은 없다는 RESOLUTION.md의 주장과 실측이 일치한다.
  - 제안: 없음.

- **[INFO]** spec 문서(`1-data-model.md`, `2-navigation/1-workflow-list.md`) 동기화 — 문서 변경, 부작용 아님
  - 위치: 파일 27-28 (본 프롬프트에서는 앞부분에 포함되지 않았으나 meta.json에 파일 목록으로 등장; 이전 라운드 documentation 리뷰에서 이미 "제약조건 문구 추가"로 확인됨)
  - 상세: 정적 spec 문서 갱신으로 런타임 부작용 없음.
  - 제안: 없음.

## 요약

이번 재리뷰 대상 diff는 프로덕션 코드(`folders.service.ts`, `folders.controller.ts`) 자체의 신규 변경이 없고(`git log` 확인상 V-04 구현 커밋 1건에서 이미 확정), 대신 (a) 테스트 커버리지 보강 2건, (b) plan 체크박스 완료 처리, (c) 이전 `/ai-review` 라운드가 생성한 리뷰 산출물 파일 신규 추가로 구성된다. 이전 side_effect 리뷰(위험도 NONE)의 핵심 결론 — 공개 시그니처 불변, 전역/환경/파일시스템/네트워크/이벤트 부작용 없음 — 은 코드가 동일하므로 그대로 유효하며, 신규 테스트도 순수 mock 기반으로 부작용을 추가하지 않는다. RESOLUTION.md의 "프로덕션 코드 무변경" 주장도 diff 실측과 일치함을 확인했다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
