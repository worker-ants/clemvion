# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 리뷰 중 관측한 일시적 테스트 실패 — 실측 결과 코드 결함 아님 (병렬 리뷰 오염 가능성)
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (전체), `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` (전체)
  - 상세: 검증 과정에서 `npx jest src/repo-guards/__tests__/param-uuid-pipe.spec.ts src/modules/triggers/triggers.controller.spec.ts`
    를 최초 1회 실행했을 때 두 스펙이 모두 실패했다 — `param-uuid-pipe.spec.ts` 는
    `rotateBotToken() @Param('id') — 빠짐: ParseUUIDPipe` 위반을 보고했고, `triggers.controller.spec.ts`
    의 HTTP 왕복 케이스는 `expect(res.status).toBe(400)` 인데 `Received: 200` 이었다. 이는
    "`ParseUUIDPipe` 가 그 순간 빠져 있었다면" 정확히 나올 결과다. 그러나:
    1) 소스 파일을 직접 `Read` 로 확인하면 `triggers.controller.ts:291` 에
       `@Param('id', ParseUUIDPipe) triggerId: string` 이 존재한다.
    2) `ts-node` 로 `scanUuidParams` 를 jest 밖에서 직접 실행하면 `{scanned: 136, violations: []}` —
       위반 0건.
    3) 파일을 **건드리지 않은 채** `--no-cache` 로 3회 연속 재실행하면 두 스펙 모두 매번 GREEN
       (`param-uuid-pipe.spec.ts` 7/7, `triggers.controller.spec.ts` 13/13).
    4) 실측 전후 `md5`/`git status --short` 로 대상 파일이 원본과 바이트 단위로 동일함을 확인했고
       저장소에는 어떤 잔여물도 남기지 않았다(review 산출물 디렉터리 4개만 untracked, 코드 변경 0).

    가장 유력한 설명은 이 리뷰가 **병렬 fan-out** 이라, 다른 reviewer 가 같은 파일
    (`triggers.controller.ts` 의 `ParseUUIDPipe`)을 뮤테이션 검증(plan 의 M1/M9 — "파이프 제거 →
    RED 확인") 중이던 순간과 내 첫 jest 실행이 겹쳤을 가능성이다 — 관측된 실패 형태가 그 뮤턴트를
    적용했을 때의 예측과 정확히 일치한다. **실제 코드·가드 로직에는 결함이 없음을 재확인했다.**
    보고 의무([`.claude/docs/subagent-call-contract.md`](../docs/subagent-call-contract.md) 상위
    지시)에 따라 이상 관측을 그대로 남긴다 — 통합 조율자가 다른 리뷰어의 산출물에서 같은 시점의
    유사 오탐을 볼 경우 원인 규명에 참고할 것.
  - 제안: 조치 불필요(코드는 정상). 병렬 리뷰 인프라 차원에서 뮤테이션 검증 시 **워크트리 격리**
    또는 뮤테이션 구간의 상호 배제가 필요하다는 기존 교훈이 재확인된 사례로 기록.

- **[INFO]** `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표에 신규 400 행 미반영 (이미 추적 중)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:270-273` (`@ApiBadRequestResponse`
    에 `VALIDATION_ERROR (:id 가 UUID 형식이 아님)` 추가) vs `spec/5-system/15-chat-channel.md §5.4`
    (미변경)
  - 상세: 이번 PR 로 `rotate-bot-token` 이 `400 VALIDATION_ERROR` 를 낼 수 있는 새 관측 가능한
    분기가 생겼다. 컨트롤러 데코레이터와 CHANGELOG 에는 반영됐지만, 그 코드를 canonical 하게
    나열하는 spec §5.4 표에는 아직 없다 — 즉 **spec(계약 문서) 이 구현보다 일시적으로 좁다.**
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 항목으로 등재되어
    있고(자기-반증형 소정정 조건 1 미충족이라 developer 가 직접 못 고침), 체크박스는 미해결(`[ ]`)
    상태다.
  - 제안: 이미 추적 중이므로 이번 PR 을 막을 사유는 아니다. 다음 planner 턴에서 §5.4 표에
    `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행을 추가할 것 — plan 에
    적힌 처분 제안과 동일.

- **[INFO]** `swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을
  요구 사항으로 적지 않음 (이미 추적 중)
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:107-127` (docstring —
    "런타임 축은 spec 조항이 아니라 실측 관례를 가드로 승격한 것") vs `spec/conventions/swagger.md §5-4`
    (미변경)
  - 상세: 신설된 `param-uuid-pipe` 가드는 문서 축(`@ApiParam({format:'uuid'})`)과 런타임 축
    (`ParseUUIDPipe`) 두 가지를 모두 강제하는데, 공식 규약 문서 §5-4 는 문서 축 한 줄만 요구한다.
    가드가 규약보다 넓게 물고 있는 상태 — 규약과 실제 강제 사이의 괴리다. 역시 plan 에 planner
    항목으로 이미 등재되어 있다.
  - 제안: 다음 planner 턴에서 §5-4 에 `@Param('<id>', ParseUUIDPipe)` 항목을 추가해 가드와
    규약을 일치시킬 것.

## 요약

핵심 변경은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 파라미터에 누락돼
있던 `ParseUUIDPipe` 를 추가해, 비-UUID 값이 DB 까지 흘러가 `GlobalExceptionFilter` 의 세 분기
(HttpException·http-error-like·23505) 어디에도 걸리지 않고 **500 INTERNAL_ERROR 로 마스킹되던
결함**을 400 VALIDATION_ERROR 로 정정한 것이다. 실제 소스(`triggers.controller.ts:291`)와
필터 로직(`http-exception.filter.ts`)을 직접 대조해 이 동작 변화가 주장대로 재현됨을 확인했다.
이 변경은 상태 코드가 500→400 으로 바뀌는 **관측 가능한 behavior change** 이지만 CHANGELOG 에
"배포 시 확인" 경고와 함께 상세히 문서화했고, 저장소 내 유일한 소비자(프런트엔드 토스트)가 상태
코드를 분기하지 않음을 확인해 하위 호환 영향이 없음을 실측으로 뒷받침했다 — API 계약 변경 문서화의
모범 사례에 가깝다. 회귀 방지를 위해 AST 기반 `param-uuid-pipe` 가드(런타임 축 + 문서 축, 베이스라인
0, 허용목록 없음)를 신설했고, 직접 실행(`ts-node`)과 3회 반복 `jest --no-cache` 로 그 가드 로직이
정상 동작함을 재확인했다(최초 1회의 실패는 병렬 리뷰 뮤테이션과의 시점 충돌로 추정되며 코드 결함이
아님 — 위 INFO 참조). 부수적으로 `auth.controller.ts switchWorkspace` 의 `@ApiParam` 에
`format:'uuid'` 를 보강(순수 문서, 런타임 영향 없음)했고, 유저 가이드 MDX 4곳·`backend-labels.ts`·
`backend-labels.test.ts` 에서 `TRIGGER_NOT_FOUND`(inbound webhook 전용 코드)를 chat-channel API
코드로 잘못 문서화한 오귀속을 실제 컨트롤러 선언(`RESOURCE_NOT_FOUND`, `hooks.service.ts:120` 실측)과
대조해 정정했다 — 에러 응답 문서와 실제 계약 간 정합성을 개선하는 방향이다. 남은 두 gap(spec §5.4
실패 표·swagger.md §5-4 규약 범위)은 이미 plan 에 planner 후속 항목으로 정확히 등재돼 있어 이번
PR 의 범위를 벗어난 것으로 판단했다. URL 설계·페이지네이션·인증/인가 축에는 이번 diff 로 인한 변경이
없다.

## 위험도

LOW
