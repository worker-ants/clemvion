# 변경 범위(Scope) 리뷰 결과

## 발견사항

발견된 범위 위반이 없습니다.

### 관찰 사항 (INFO)

- **[INFO]** 엔진 spec에서 `processFormResumeTurn — 4 branches` describe 블록 약 420줄 제거
  - 위치: `execution-engine.service.spec.ts` (라인 ~14408-~14958 구간 전체 삭제)
  - 상세: 중복 방지 목적으로 의도된 제거. 동일 테스트 코드가 verbatim으로 `form-interaction.service.spec.ts`에 이관됨. 커밋 메시지에 "processX resume 분기·§5.5 테스트는 verbatim 이전 + 엔진 spec 에서 제거(중복 방지)"로 명시.
  - 제안: 없음 (의도된 정리).

- **[INFO]** `waitForButtonInteraction` / `waitForFormSubmission` 호출 래핑 재포맷
  - 위치: `execution-engine.service.ts` — dispatch-loop 및 executeInline 호출 지점 6곳
  - 상세: `this.buttonInteraction.waitForButtonInteraction(...)` / `this.formInteraction.waitForFormSubmission(...)` 으로 위임 경로가 길어져 prettier 포맷이 줄바꿈을 추가. 의미 변경 없음.
  - 제안: 없음 (필연적 결과).

- **[INFO]** 엔진 생성자에서 `conversationThreadService` 필드 제거
  - 위치: `execution-engine.service.ts` 라인 ~658
  - 상세: Form/Button 처리 로직이 추출 서비스로 이동하면서 엔진 내 `conversationThreadService` 직접 주입 불필요. 제거 정당.
  - 제안: 없음.

## 요약

7개 파일 변경이 모두 선언된 작업 범위(strangler-fig C-1 step3 — Form/Button blocking-interaction 추출)에 국한됩니다. 신규 파일 4개(form/button-interaction.service.ts + spec.ts)는 추출 대상 메서드만 담으며, 엔진 수정은 dispatch-loop 위임 재배선·주입 제거·임포트 정리로 한정됩니다. 엔진 spec의 중복 테스트 제거는 커밋 메시지에 명시된 의도이고 동일 케이스가 새 spec 파일로 이관됐습니다. 범위를 벗어난 무관한 수정, 불필요한 리팩토링, 기능 확장은 없습니다.

## 위험도

NONE
