# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `ExportWorkflowDto` 를 `WorkflowDto` 와 별도 `import` 문으로 추가해, 같은 모듈 경로에서
  온 두 타입의 import 가 두 줄로 나뉜 채 남아 있다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14`
  - 상세: `import { ExportWorkflowDto } from '.../workflow-response.dto';` 가 13번째 줄에 있고,
    바로 아래 14번째 줄에 이미 같은 경로에서 `WorkflowDto` 를 import 한다. 기능상 문제는
    없고, 이전 라운드(`review/code/2026/09/05/18_23_02/scope.md`)에서도 이미 INFO 로
    지적됐지만 사소하다는 이유로 미조치 상태가 이번 라운드까지 그대로 이어지고 있다. 스코프
    자체를 벗어난 변경은 아니며 병합 누락 수준의 스타일 흠이다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 여러 라운드째
    반복되는 사소한 지적이라 이번에도 PR 을 막을 사유는 아니다.

- **[INFO]** `CHANGELOG.md` 신규 절 안에 인용 블록(`>`)이 문단 중간에서 끊겨 일반 문단과
  섞인 자리가 있다.
  - 위치: `CHANGELOG.md` — "같은 조합이 조용히 넓어지지 못하게 래칫을 세웠다" 절, `>
    **나머지 6개는 다른 축이다**` 로 시작하는 인용문 블록.
  - 상세: `> ... 래칫이 무엇을 막는지가 흐려진다 (...) W3). **두 검증자 어느 쪽도 잡지
    못했다** — 런타임 검증자는 값을` 다음 줄부터 `>` 접두사가 빠져 일반 텍스트로 이어지다가
    다시 절로 넘어간다. Markdown 렌더 시 인용 블록이 의도치 않게 조기 종료되는 포맷팅
    결함이지만, 신규로 작성한 문서 내용 자체(스코프)와는 무관한 저작 중 실수라 범위 위반은
    아니다.
  - 제안: 조치 불요(범위 리뷰 밖) — 해당 인용 블록 전체에 `>` 를 일관되게 붙이면 해소된다.

- **[INFO]** 이번 diff 의 대부분(230개 변경 파일 중 약 197개)은 실 코드가 아니라
  `review/code/**`·`review/consistency/**` 아래의 이전 라운드 산출물(RESOLUTION.md·
  SUMMARY.md·checker 리포트·`meta.json`·`_retry_state.json`)이다.
  - 위치: `review/code/2026/09/05/**`, `review/consistency/2026/09/05/**` 등
  - 상세: 이는 이 저장소의 표준 관례(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/**`")를
    그대로 따른 것이며, 실 코드 diff(`git diff --stat origin/main...HEAD -- codebase/ spec/
    plan/ CHANGELOG.md`)는 33개 파일·약 1,805줄로 훨씬 작고 전부 이번 작업(§5.4
    응답-계약 스윕)의 직접 산물이다. 범위 위반으로 보지 않는다.
  - 제안: 조치 불요.

## 요약

`codebase/`·`spec/`·`plan/`·`CHANGELOG.md` 전체 33개 실 변경 파일을 `git diff
origin/main...HEAD` 로 직접 열어 확인했다(프롬프트가 크기 제한으로 생략한 파일 포함 —
`schedules.controller.ts`, `triggers.service.ts`, `trigger-response.dto.ts`,
`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`, `response-contract.ts`,
`response-contract.spec.ts`, `triggers.service.spec.ts`, `schedules.controller.spec.ts`,
`schedule-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, plan 트래커,
CHANGELOG 전문). 모든 변경이 "§5.4 응답-계약 검증자 배선 확대(4→18 DTO)"라는 단일 목적에
직접 종속된다: (1) `assertMatchesContract`/`contractForDto` 를 14개 e2e 스펙에 배선, (2)
그 스윕이 실측으로 검출한 트리거 회전 secret 유출(`notificationSecretV2`·
`chatChannelTokenV2` — 엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출)에 대한 보안 수정과
회귀 테스트(unit+e2e), (3) 5개 DTO 24필드의 선언을 실제 wire 형태에 맞춘 것(wire 불변),
(4) 그 정정 과정에서 스스로 반증한 §5.4 금지 조합(17건)을 바로잡고 재발 방지용 정적 가드
3번째 축(78건 양방향 래칫)을 신설, (5) `create()`/`update()` 의 `isActive` 조건부 대칭
버그·PATCH `undefined` 덮어쓰기 버그를 함께 고친 것. 이 다섯 갈래는 CHANGELOG 와
`plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽에 "왜"와 근거(FE 참조
수, 뮤턴트 RED 실측, 관련 리뷰 라운드 인용)가 일관되게 기록돼 있고, 손대지 않기로 결정한
항목(`CanvasSaveResultDto` 타입 미선언, `consecutiveNetworkFailures` 제거, §5.4 스윕
2차 대상)은 코드를 건드리지 않은 채 백로그 체크박스로만 등재됐다 — 스코프 경계를 스스로
판단하고 기록한 흔적이 산출물 자체에 남아 있다. `git log` 상 이 브랜치의 최근 5개 커밋도
전부 같은 스윕의 후속 정정(`fix(backend): ...`)이며 무관한 리팩터링·기능 확장·설정 변경·
불필요한 import 정리는 발견되지 않았다. 유일하게 남는 흠은 여러 라운드째 반복되는 사소한
import 미병합 하나와 CHANGELOG 인용 블록 포맷팅 한 곳으로, 둘 다 범위 위반이 아니라 저작
품질 수준의 INFO다.

## 위험도

NONE
