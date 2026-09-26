# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 테스트 F 에서 새로 만든 `emptyWorkflow` 가 정리(삭제)되지 않음
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:208-216` (`it('F. sessions/latest …')` 블록)
  - 상세: `null` 분기를 실측하려고 `POST /api/workflows` 로 새 워크플로 행을 하나 더 만드는데, 같은 테스트 안에서 세션은 `DELETE /api/workflow-assistant/sessions/${sessionId}` 로 명시적으로 지우면서(220-222행 "정리: 깔끔하게 지움") 이 워크플로는 지우지 않는다. e2e DB 에 고아 행이 하나 더 남는다.
    다만 같은 파일의 `beforeAll`(43-48행)이 만드는 주 `workflowId`/`workspaceId` 도 `afterAll` 에서 `db.end()` 만 하고 삭제하지 않으므로, 이 파일 전체가 "워크플로/워크스페이스는 정리하지 않고 세션만 명시적으로 지운다"는 기존 관례를 따르고 있다 — 새로 도입된 부작용 패턴은 아니다. 다른 테스트가 워크플로 개수를 세는 assertion 은 이 파일에 없어(grep 결과 없음) 교차 오염 가능성도 낮다.
  - 제안: 기존 관례와 일치하므로 차단 사유는 아니다. 다만 e2e DB 가 장기간 누적되는 환경이라면 후속으로 `afterAll` 에 워크플로 정리를 추가하는 것을 고려할 수 있다(이번 PR 스코프는 아님).

- **[INFO]** `codebase/backend/test/workflow-assistant.e2e-spec.ts` 외 나머지 변경분(플랜 문서 4개·`spec/3-workflow-editor/_product-overview.md` 1줄 표기 정정·`review/consistency/**` 산출물 20여 개)은 전부 비-실행 마크다운/JSON 문서다. 함수 시그니처·전역 변수·env·네트워크 호출·이벤트/콜백 어디에도 영향이 없다.

## 요약

이번 변경의 실질 코드 표면은 `workflow-assistant.e2e-spec.ts` 테스트 파일 하나뿐이며, 제품 코드·공개 API·함수 시그니처·환경 변수·네트워크 호출 경로는 전혀 건드리지 않는다. 테스트 F 에 추가된 `emptyWorkflow` 생성이 명시적으로 정리되지 않아 DB 에 행 하나가 더 남지만, 이는 같은 파일이 이미 갖고 있던 "워크플로/워크스페이스는 정리하지 않는다"는 기존 관례의 연장선이라 새로운 부작용 클래스는 아니다. 나머지 변경(plan 문서, spec 한 줄 표기, 리뷰 산출물)은 전부 비실행 문서라 부작용 관점에서 볼 것이 없다. 검증 중 저장소 파일을 뮤테이션하지 않았다(`git status --short` 로 확인할 변경 없음).

## 위험도

NONE
