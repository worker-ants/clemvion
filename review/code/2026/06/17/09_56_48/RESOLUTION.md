# RESOLUTION — C-1 step3 (Form/Button InteractionService)

리뷰 세션: `review/code/2026/06/17/09_56_48/SUMMARY.md`
대상: `claude/engine-split-s3-formbutton` (C-1 step3)
전체 위험도: **MEDIUM** (FormInteractionService 테스트 갭) · Critical 0 · fix 커밋 `77ae1522`

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W-1 | Testing | **fix** — FormInteractionService spec sentinel 에 `emitNode(NODE_COMPLETED)`·`emitExecution(EXECUTION_RESUMED)` 어서션 추가 (행위 실재, verbatim) | `77ae1522` |
| W-2 | Testing | **fix** — `appendPresentationInteraction`(ConversationThread 단일 entrypoint) `{interaction:{type:'form_submitted'}}` 어서션 추가 | `77ae1522` |
| W-3 | Testing | **fix** — 필드 whitelist 보안 케이스 2건(미허용 키 strip / `config.fields=[]` 전체 통과) | `77ae1522` |
| W-4 | Architecture | **수용** — 엔진↔추출서비스 양방향 forwardRef 순환 DI 누적은 strangler-fig A방식의 의도된 중간상태(plan framing). 체인 종료 시 "엔진→서비스 주입 방향 제거(caller-side)" 백로그 등록 (c1-engine-split.md 후속 고려). | — |
| W-5 | Side Effect | **수용(INFO 강등)** — `@Inject(ENGINE_DRIVER)` 에 forwardRef 래퍼 없음은 `AiTurnOrchestrator` 와 **동일 패턴**(실측 확인: 셋 다 forwardRef 없이 토큰 주입 — 문자열 토큰은 forwardRef 불요). 일관·정상. | — |
| INFO-13 | Testing | **fix** — form·button spec 양쪽 `afterEach(jest.restoreAllMocks)` 추가 (spy 누적 방어) | `77ae1522` |

INFO 처분 (요점):
- **SPEC-DRIFT** (`button_continue` data `selectedItem`/`url` optional·메서드 위치 포인터): 코드 유지, 체인 종료(PR4) 시 planner 가 `node-output.md §4.5`·`4-execution-engine.md §1.3·§7.5` 일괄 갱신 (c1-engine-split.md spec phase).
- **ISP** (EngineDriver 7노출 vs 3사용), **ButtonClickPayload 타입가드**, **WaitingInteractionType 위치**, **processButtonResumeTurn 280줄/매직문자열/buttonConfig 중복**: verbatim 이동이라 본 PR 범위 외 — 후속 step 분해 항목으로 plan 기록.
- **button spec 추가 케이스**(previousOutput 무한체인·null nodeExec): 저우선 후속.

## TEST 결과

- **lint**: 통과 — 변경 파일 eslint 0 errors.
- **unit**: 통과 — `src/modules/execution-engine` 32 suites / **794 passed** (form/button spec 신설 22 + W-3 whitelist 2 포함). execution-engine 은 otplib 미의존 → 환경오염 면역. (호스트 full `npm test` 의 auth 8 suites 는 otplib 환경오염으로 실패 — 본 PR 무관.)
- **build**: 통과(본 PR 범위) — execution-engine tsc 컴파일 clean (`error TS` 중 totp 외 0). 호스트 build 의 `totp.service.ts`(otplib) 실패는 환경오염. dockerized build(npm ci v12) 전체 성공.
- **e2e**: 통과 — dockerized **34 suites / 202 tests** (form park/resume 통합 + 엔진→서비스 위임 부팅 검증, npm ci=v12 호스트 오염 면역).

## 환경/리뷰 제약 노트

- **otplib v13** 공유 node_modules 오염(병렬 잡): 호스트 build/full-unit 의 auth 부분 실패 — 본 PR diff 무관(`totp.service.ts` 미변경), dockerized 게이트 면역·통과. (PR2 RESOLUTION 과 동일 사유.)
- **security reviewer 미생성**: `/ai-review` 세션 전반 **API 529 Overloaded**(server-side) 로 security reviewer 가 3회(최초 fan-out + 2회 재시도) output 미생성. 본 변경은 **behavior-preserving 추출**(form/button park/resume verbatim 이동) 으로 신규 보안 surface 없음 — 유일 보안 관련 로직인 필드 whitelist 는 verbatim 이동 + W-3 fix 로 테스트 lock 됨. side_effect reviewer(LOW) 가 인접 관점 커버. 무한 재시도 대신 transient gap 으로 기록 (e2e "자동흐름 환경차단" 과 동등 처리).

## 보류·후속 항목

- **W-4 체인 종료 백로그**: 엔진→서비스 주입 방향 제거(caller-side 전환) — strangler-fig 완료 단계.
- **SPEC-DRIFT**: PR4 후 planner 일괄 (위).
- **후속 분해/타입 강화**: ButtonClickPayload 타입가드·processButtonResumeTurn 분해·WaitingInteractionType/EngineDriver ISP 정리 (c1-engine-split.md 후속 고려).

## impl-done (consistency) 후속

`/consistency-check --impl-done`(10_22_36) **BLOCK: NO**. Critical 0, Warning 2 (둘 다 **pre-existing SPEC-DRIFT**, verbatim-move 실증).

- **W-1 (`button_continue.selectedItem`) · W-2 (`previousOutput`)**: git diff 실측 — 둘 다 엔진 `processButtonResumeTurn` 의 DELETION(`-`) 과 `ButtonInteractionService` ADDITION(`+`) **양쪽에 존재** = PR3 이 보존한 verbatim 기존 행위(신규 도입 아님, behavior-preserving). spec drift(`node-output.md §4.5`/§4.2·`execution-engine.md §1.3`)는 PR3 이전부터 존재 → 체인 종료(PR4) planner 일괄 spec sync (`previousOutput` Phase 3 유예 예외 §4.2 등재 포함).
- **INFO**(메서드 소유자 표기·`interaction-type-registry.md §1.2` button emit 위치·data-flow 다이어그램 actor·god-class Rationale): plan 갱신 + 체인 종료 spec sync (c1-engine-split.md spec phase). form spec 4-branch 커버리지(I-2)는 존재 확인(상기 W-1/2/3 fix 포함).
