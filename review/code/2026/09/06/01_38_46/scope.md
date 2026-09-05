# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `workflow-crud.e2e-spec.ts` 에서 `ExportWorkflowDto` 를 `WorkflowDto` 와 별도
  `import` 문으로 추가해, 같은 모듈에서 오는 두 타입의 import 가 두 줄로 나뉜다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';` 줄과 바로 아래 기존 `WorkflowDto` import 줄.
  - 상세: 기능상 문제는 없다. 이전 라운드(`review/code/2026/09/05/18_23_02/scope.md`)에서 이미
    지적됐고 여러 후속 커밋을 거치는 동안에도 병합되지 않은 채 남아 있다. 이 스윕의 목적
    (계약 배선)과 무관한 사소한 스타일 잔여물.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 매우 사소해 PR 을
    막을 사유는 아니다.

- **[INFO]** 보안 수정(트리거 회전 secret 유출 4곳 + 스케줄 조인 유출 + PATCH 필드 소실 +
  CWE-209 진단 유출)과 응답-계약 검증자 배선 확장(4→18개 DTO)·선언 보정(23필드)이 한 브랜치에
  15개 커밋으로 섞여 있다.
  - 위치: `CHANGELOG.md` 전체, `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`sanitizeForResponse` 4축 정화), `codebase/backend/src/modules/schedules/schedules.controller.ts`
    (`toResponse` 신설), `plan/in-progress/spec-draft-nullable-notation-followups.md`.
  - 상세: 범위 위반으로 보지 않는다 — CHANGELOG·plan 트래커가 명시하듯 이 보안 결함들은
    "§5.4 검증자를 넓히는 스윕 도중 실측으로 발견된" 것들이라, 발견 직후 같은 브랜치에서
    고치지 않으면 방금 넓힌 검증자가 그 결함을 놓친 채로 남는다(실제로 `dfb2664af` →
    `7e85da873` → `66a2510fd` → `48704becd` → `0de16b488` 순으로 검증 범위를 넓힐 때마다
    새 유출 경로가 하나씩 드러났다 — CHANGELOG 의 "네 자리를 한꺼번에 찾은 것이 아니다"
    서술과 정확히 일치). 다만 `git log` 로 이 브랜치를 나중에 추적할 때 "보안 픽스" 라는
    성격이 24필드 선언 보정이라는 문서화 성격 커밋들 사이에 섞여 한눈에 안 들어올 수 있다는
    점은 리뷰어가 인지해 둘 만하다.
  - 제안: 조치 불요 — 이미 CHANGELOG 에 "원인" 섹션으로 두 축(보안/선언)이 표로 분리돼
    있어 추적성은 확보돼 있다.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 참조 0곳인 내부
  카운터인데도 이번 스윕에서 선언에 포함됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures: number;` 필드, `@ApiProperty({ example: 0 })` 데코레이터
    바로 위 JSDoc).
  - 상세: PR 자신의 주석과 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    ("`IntegrationDto.consecutiveNetworkFailures` 노출 중단 검토" 백로그 항목)이 이 필드를
    "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고 스스로 명시하고 있다.
    스코프 판단이 은닉되지 않고 산출물 자체에 남아 있으며, "선언을 실제에 맞춘다" 는 이번
    PR 의 원칙에 정확히 부합하는 최소 개입이다.
  - 제안: 조치 불요.

- **[INFO]** 대규모 `review/code/**` · `review/consistency/**` 산출물 디렉터리(약 240개
  파일)가 이번 diff 에 포함돼 있다.
  - 위치: `review/code/2026/09/05/*`, `review/consistency/2026/09/05/*`,
    `review/consistency/2026/09/06/*` 등.
  - 상세: 범위 위반이 아니다 — 프로젝트 컨벤션상 `review/**` 는 gitignore 대상이 아니고
    코드 리뷰·일관성 검토 산출물의 정식 저장 위치다. 이 브랜치가 리뷰→수정 루프를 여러
    라운드(최소 8라운드) 거치며 자연히 누적된 것으로, 실제 코드 변경 범위(35개 파일,
    +2094/-62줄)와는 명확히 분리해 판단해야 한다.
  - 제안: 조치 불요.

## 요약

`sweep-response-contract` 워크트리 이름 그대로, 응답-계약 검증자(§5.4)의 배선을 4→18개
DTO 로 넓히는 단일하고 응집력 있는 스윕이다. `git diff origin/main...HEAD` 기준 실질 코드
변경은 `codebase/`·`spec/`·`plan/`·`CHANGELOG.md` 35개 파일(+2094/-62줄)로, 14개 e2e spec 의
`assertMatchesContract`/`contractForDto` 배선, 관련 유닛 테스트 3건(`response-contract.spec.ts`
의 `allowMissing`/메모이제이션 회귀, `schedule-trigger-ref.spec.ts` 헬퍼 자체 회귀,
`swagger-dto-contract.spec.ts` 의 78건 양방향 래칫), 그리고 스윕 도중 실측으로 드러난 트리거
회전 secret 유출(엔티티 컬럼 2개 + JSONB 3축 + 스케줄 조인을 통한 2차 유출 + PATCH 경로
필드 소실)에 대한 수정, 5개 DTO 24필드의 선언 보정(wire 불변, 문서만 실제에 맞춤)으로
구성된다. 15개 커밋 각각이 직전 라운드 리뷰가 지적한 좁은 결함 하나씩을 닫아 가는 반복
수정 이력이며, 손대지 않기로 한 항목(`CanvasSaveResultDto` 타입 미선언,
`consecutiveNetworkFailures` 제거, §5.4 스윕 2차 대상)은 plan 트래커에 새 백로그 항목으로만
등재됐지 코드가 손대지 않았다 — 스코프 경계를 판단한 흔적이 산출물 자체에 남아 있다.
디버그 잔여물(`console.log`/`TODO`/`FIXME`) 은 없고, 포맷팅만 바뀐 hunk 도 관측되지 않았다.
드러난 흠은 이전 라운드부터 이어진 `workflow-crud.e2e-spec.ts` 의 사소한 import 분리 하나뿐이며,
의도 밖 리팩토링·무관한 파일 수정·요청하지 않은 기능 확장은 관측되지 않았다.

## 위험도
NONE
