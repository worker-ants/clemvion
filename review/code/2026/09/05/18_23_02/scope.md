# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 별도 `import` 문으로 추가해, 같은 모듈에서 온 `WorkflowDto` 와
  import 가 두 줄로 나뉜다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: 13번째 줄 `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    이 새로 추가됐는데, 바로 아래 14번째 줄에 이미 같은 경로에서 `WorkflowDto` 를 import 하고
    있다. 기능상 문제는 없으나 한 줄로 합칠 수 있었던 자리다. 기능·범위와 무관한 스타일
    수준의 사소한 흠으로, 이 스윕의 목적(계약 배선)과는 무관한 부수적 잔여물이다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 다만 매우 사소해 이번
    PR 을 막을 사유는 아니다.

- **[INFO]** 보안 결함 수정(트리거 회전 secret 유출)과 계약 스윕(24개 필드 선언 보정)이 한
  PR 에 섞여 있다.
  - 위치: `CHANGELOG.md:3-56`, `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`sanitizeForResponse` 관련 hunk 전체), `codebase/backend/src/modules/schedules/schedules.controller.ts:53-99`
  - 상세: 이 자체는 범위 위반이 아니라고 판단한다 — CHANGELOG·plan 트래커 서술이 명시하듯
    "§5.4 검증자를 넓히는 스윕 도중 실측으로 발견된" 결함이라, 스윕과 분리해서 별도 PR로
    낼 이유가 약하다(발견 즉시 고치지 않으면 방금 넓힌 검증자가 그 결함을 놓친 채로 남는다).
    다만 보안 수정(트리거/스케줄 두 곳)과 순수 문서화 성격의 필드 선언 보정(5개 DTO 24필드)은
    "왜"가 다른 두 축이라는 점은 리뷰어가 인지해 두는 편이 좋다 — 이후 `git log` 로 추적할 때
    "이 커밋이 보안 픽스다" 라는 판단이 24개 필드 선언 노이즈에 가려질 수 있다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 참조 0곳인 내부 카운터인데도
  선언에 포함됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:145-152`
  - 상세: PR 자신의 주석과 plan 트래커(파일 25, `IntegrationDto.consecutiveNetworkFailures 노출
    중단 검토` 항목)가 이 필드를 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고
    명시적으로 인정하고 있다. 즉 스코프 판단이 스스로 문서화돼 있어 은닉된 확장이 아니다 —
    "선언을 실제에 맞춘다" 는 이번 PR 의 원칙에 정확히 부합하는 최소 개입이다.
  - 제안: 조치 불요.

## 요약

`sweep-response-contract` 라는 워크트리 이름 그대로, 응답-계약 검증자(§5.4)의 배선을
4개→18개 DTO 로 넓히는 단일하고 응집력 있는 작업이다. 25개 변경 파일 대부분(14개 e2e
spec 의 `assertMatchesContract`/`contractForDto` 임포트·호출 추가, `response-contract.ts` 의
`allowMissing` 옵션·`contractForDto` 메모이제이션, 관련 유닛 테스트 3건)은 그 배선 자체이고,
스윕 도중 실측으로 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한
2차 유출)에 대한 수정과 5개 DTO 24개 필드의 선언 보정(wire 불변, 문서만 실제에 맞춤)이 뒤따른다.
전부 CHANGELOG 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 서사와
근거(FE 참조 수, 뮤테이션 테스트 결과)가 함께 기록돼 있고, 손대지 않기로 한 항목
(`CanvasSaveResultDto` 타입 미선언, `consecutiveNetworkFailures` 제거, 2차 스윕 대상)은
새 백로그 항목으로만 등재됐지 코드가 손대지 않았다 — 즉 스코프 경계를 판단한 흔적이 산출물
자체에 남아 있다. 드러난 흠은 `workflow-crud.e2e-spec.ts` 의 사소한 import 분리 정도이며,
의도 밖 리팩토링·무관한 파일 수정·불필요한 기능 확장·포맷팅 혼입은 관측되지 않았다.

## 위험도
NONE
