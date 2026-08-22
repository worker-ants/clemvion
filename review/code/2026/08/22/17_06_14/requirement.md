# 요구사항(Requirement) Review — `eia-error-code-unify`

대상: 두 Manual 엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)의
최상위 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일 (re-run 쪽을 변경).

## 검토 방법

diff 로 제시된 3개 코드 파일(`executions.service.ts`/`executions.controller.ts`/
`executions-rerun.service.spec.ts`)과 2개 mdx 문서를 `Read`/`Bash` 로 직접 열어 전체 컨텍스트를
확인했다. 관련 spec 6파일(`spec/4-nodes/7-trigger/1-manual-trigger.md`,
`spec/5-system/{3-error-handling,12-webhook,13-replay-rerun,14-external-interaction-api}.md`,
`spec/conventions/error-codes.md`)을 전부 열어 line-level 로 대조했다. `git diff origin/main HEAD`
로 실제 변경 파일 목록(11개, plan/review 산출물 제외)을 재확인하고, 관련 테스트
(`executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`, `workflows.service.spec.ts`
포함 `src/modules/executions` + `src/modules/workflows` 전체, 297 tests)를 직접 실행했다 — 전부
GREEN.

## 발견사항

- **[INFO]** `error-codes.md §5` Rename 이력 표 신규 행의 "PR" 컬럼이 플레이스홀더 `#TBD_PR` 로
  남아 있다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: plan 체크리스트(`plan/in-progress/eia-error-code-unify.md` 작업 항목)는 "§5 신규 행
    'PR' 컬럼은 이 작업의 PR 번호를 쓴다 — 실측 근거로 인용한 커밋 `7b0e65aa8` 을 옮겨 적지
    않는다"고 명시했고, 실측(`grep`)상 실제로 커밋 해시를 오기재하는 실수는 피했다. 다만 PR
    번호 자체가 아직 없으므로(이 작업이 아직 PR 로 올라가지 않은 시점) `#TBD_PR` placeholder 로
    남아 있다 — 저장소 내 다른 어떤 문서에도 이 placeholder 패턴의 선례가 없다(`grep -rn
    'TBD_PR' spec plan` = 이 1건뿐). 표의 형제 행들(`PR4b`, `#566`)은 전부 실제 식별자다.
  - 제안: PR 생성/머지 시점에 실제 번호로 치환 필요 — 병합 전 반드시 정정돼야 하는 잔여 작업.
    기능적 결함은 아니며(문서 필드일 뿐) 코드 동작에 영향 없음.

- **[INFO]** 정본 트래커·session 산출물(`review/consistency/2026/08/22/16_34_50/_retry_state.json`,
  `13_20_18/_retry_state.json`)이 `agents_success: []`, `agents_pending: [...]` (즉 "미완료"
  스냅샷) 상태로 커밋됐다
  - 위치: `review/consistency/2026/08/22/16_34_50/_retry_state.json` (전체)
  - 상세: 해당 세션의 `SUMMARY.md`·5개 checker 리포트(`cross_spec.md` 등)는 전부 완료된 내용을
    담고 있어 실제로는 5개 checker 가 전원 성공했음이 분명하다. 그런데 `_retry_state.json` 은
    초기(호출 전) 스냅샷 그대로 커밋돼 `agents_pending` 에 5개가 그대로 남아 있고
    `agents_success`/`agents_fatal` 모두 빈 배열이다. 이는 harness 의 상태 파일 관리
    (`subagent-call-contract.md`)가 완료 후 `_retry_state.json` 을 갱신하지 않고 그대로 두는
    설계인지, 아니면 갱신 로직 누락인지 이 리뷰 범위에서는 판별 불가 — 코드 리뷰 대상인
    application 기능과 무관한 harness 부산물이라 기능 요구사항 관점에서는 영향 없음(참고용
    기록).
  - 제안: application 코드 결함이 아니므로 조치 불요. harness 자체를 다루는 세션이라면
    `subagent-call-contract.md` 재검토 가치는 있음.

## 검증 완료 항목 (문제 없음)

- **핵심 코드 변경** (`executions.service.ts:509` `code: 'INVALID_TRIGGER_PARAMETERS'`,
  `executions.controller.ts:274` Swagger description, `executions-rerun.service.spec.ts:330,422`
  단언/제목)이 diff 그대로 반영돼 있고, 자매 호출부 `workflows.controller.ts:324`
  (`grep` 확인) · `workflows.service.ts:931` 과 동일한 코드값을 낸다.
- **테스트**: `executions-rerun.service.spec.ts` 단독 실행(20/20 pass) + `src/modules/executions`
  `src/modules/workflows` 전체(297/297 pass) 확인. `workflows.controller.spec.ts:150,246`,
  `workflows.service.spec.ts:1176` 세 곳 모두 `INVALID_TRIGGER_PARAMETERS` 단언 — 세 소비처가
  같은 코드를 낸다는 사실이 테스트로 고정됐다는 plan 의 주장과 일치.
- **잔존 `INVALID_INPUT` 실측**: `grep -rn 'INVALID_INPUT' codebase spec` = 5건, 전부 이력
  서술(주석 1 + spec 4곳) — 발행 지점 0건. plan 의 "검증 기준" 절 주장과 정확히 일치.
  frontend/channel-web-chat 소스에서도 `INVALID_INPUT` 히트 0건(mdx 2곳은 이미 수정 완료).
- **spec fidelity** — line-level 로 전수 대조, 전부 코드와 일치:
  - `1-manual-trigger.md:181` 경로별 코드 표: re-run 행 `INVALID_TRIGGER_PARAMETERS` 로 교체 +
    wrapper 함수명(`resolveTriggerParametersRejectingMasked`)·"base 에 넣지 않은 이유" 콜아웃
    신설 + frontmatter `code:` 에 `reject-masked-resubmission.ts` 추가.
  - `13-replay-rerun.md §8.1`(246행)·§10.2(384행): 표 값 교체 + `RERUN_` prefix 미사용이
    의도임을 각주로 설명(cross_spec INFO #1 반영).
  - `3-error-handling.md §1.3`(80행): "세 엔드포인트 공용" 명시 + 반대 방향 Rationale
    ("`RERUN_` prefix 를 안 붙이는 것은 §2 rename-stability 상 유지") 을 방향 전환 이력으로
    개정(무엇이 기각됐고 무엇이 뒤집혔는지 보존) — §1.7(189행) details 노트도 동반 개정.
  - `12-webhook.md:313`: "Manual re-run `INVALID_INPUT`" → 세 경로 공용 `INVALID_TRIGGER_PARAMETERS`.
  - `14-external-interaction-api.md §R17`: 4번째 행 볼드 제거(평문 통일, 형제 3행과 정렬) +
    wrapper 함수명·CI 가드(`masked-reject-callers-guard.ts`) 구현 위치 콜아웃 신설 + frontmatter
    `code:` 갱신. 해당 가드 파일 실존 확인.
  - `conventions/error-codes.md`: §4 를 §4.1(Code 노드 내부)/§4.2(trigger-parameter, 신설)로
    분리 — consistency WARNING #2("단순 append 시 표 scope 선언과 충돌") 을 그대로 반영한 처방.
    §5 Rename 이력에 신규 행 추가, 비고에 리스크 등급("워크스페이스 JWT 내부 엔드포인트,
    제3자 분기 코드로 배제 불가, 관측(grep) 기준 판정")을 명시 — consistency WARNING #1
    (선례에 없는 근거 소급 부여 정정) 도 반영됨(§5 절 서술이 "선례가 이미 그렇게 판단했다"가
    아니라 이번 사례가 선례보다 엄격한 최초 사례임을 명시하는 톤으로 작성됨).
  - `02-nodes/triggers.mdx:22` / `.en.mdx:22`: `required` 필드 설명의 `INVALID_INPUT` →
    `INVALID_TRIGGER_PARAMETERS` — 선존 drift 정정(주 실행 경로 코드와 일치시킴).
- **엣지 케이스/에러 시나리오**: `resolveTriggerParametersRejectingMasked` 경유 실패 시
  `TriggerParameterValidationException` catch 분기 하나뿐이고(다른 예외는 `throw err` 로
  재던짐 — 반환값 누락 없음), `details` 필드가 `err.errors` → `toTriggerParameterErrorDetails`
  로 정규화돼 `errors` 키 대신 `details` 키로만 실린다는 선존 배선 수정(별개 관심사, 이미
  #1188/#1189 에서 처리됨)도 회귀 테스트로 고정돼 있음을 확인.
- **비즈니스 로직**: "세 엔드포인트가 동일 검증 실패에 동일 최상위 코드를 낸다"는 이번 통일의
  핵심 규칙이 코드(3개 발행처) + 테스트(3개 spec 파일) + spec(6개 문서) 전 계층에서
  line-level 로 일관되게 반영됨.
- **TODO/FIXME**: 변경된 코드 3파일에서 TODO/FIXME/HACK/XXX 마커 0건.
- **spec 자체 결함**: 발견 없음 — 오히려 이번 변경이 기존 spec 문서의 두 갭(§4 표 scope 충돌
  위험, `error-handling.md §1.3` 카탈로그에 `INVALID_TRIGGER_PARAMETERS` 행 자체가 없던 갭)을
  선제적으로 해소했다(§4.1/§4.2 분리, §1.3 신규 행).

## SPEC-DRIFT 여부

없음 — 이번 변경은 spec 을 코드에 맞추는 것이 아니라, 사용자가 명시적으로 결정한 rename 을
코드·spec·테스트·유저 가이드 전 계층에 동시 반영한 것이다. `spec/conventions/error-codes.md §2`
(rename=breaking, 이름 정확성 향상만을 위한 rename 금지)의 명시적 예외로 §5 에 등재됐고,
근거·잔여 위험이 문서에 그대로 남아 있어 "코드가 옳고 spec 이 낡았다"는 SPEC-DRIFT 패턴이 아니라
정규 spec 개정 절차(사용자 결정 → planner 턴 → consistency-check → 코드 반영)를 따른 사례다.

## 요약

3개 백엔드 파일 + 2개 mdx 문서의 diff 는 "re-run 경로의 최상위 error.code 를
`INVALID_TRIGGER_PARAMETERS` 로 통일한다"는 의도를 정확히, 그리고 누락 없이 구현한다. 자매
엔드포인트(`workflows.controller.ts`/`workflows.service.ts`)와의 코드 일치를 실측으로
재확인했고, 관련 spec 6개 문서(`1-manual-trigger.md`, `13-replay-rerun.md`,
`3-error-handling.md`, `12-webhook.md`, `14-external-interaction-api.md`,
`conventions/error-codes.md`)가 전부 line-level 로 코드와 일치하며, 앞선 consistency-check
(`16_34_50`)가 낸 WARNING 2건(§4 표 scope 분리, §5 리스크 등급 명시)이 실제 spec 편집에
정확히 반영됐음을 직접 확인했다. 잔존 `INVALID_INPUT` 참조는 5건 전부 의도된 이력 기록이고
발행 지점은 0건이다. 관련 테스트(297개, executions+workflows 모듈 전체) 전부 GREEN. 유일한
잔여 사항은 `error-codes.md §5` 신규 행의 PR 컬럼이 `#TBD_PR` placeholder 로 남아 있다는
것(INFO, 병합 전 정정 필요)과 harness `_retry_state.json` 스냅샷이 미완료 상태로 커밋된 것
(INFO, 코드 기능과 무관) 두 가지뿐이며 둘 다 기능적 결함이 아니다.

## 위험도

NONE
