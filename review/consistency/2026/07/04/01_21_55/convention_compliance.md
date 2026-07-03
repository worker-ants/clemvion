# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: --impl-done
- Target: `spec/5-system/4-execution-engine.md`
- Diff base: `origin/main` → HEAD worktree (`.claude/worktrees/awesome-benz-2abe0f`)
- 구현 변경 범위: `execution-engine.service.ts`(PR3 case B crash re-drive)·`executions.controller.ts`(e2e-only recovery trigger)·신규 e2e spec

## 발견사항

### INFO — `@ApiExcludeEndpoint` + `_test/` 백도어 라우트 패턴이 `spec/conventions/swagger.md` 에 미문서화
- target 위치: 해당 없음 (target 문서 `4-execution-engine.md` 자체는 이 엔드포인트를 규정하지 않음 — REST 표면은 `14-external-interaction-api.md`/컨트롤러 SoT). 실 코드 위치: `codebase/backend/src/modules/executions/executions.controller.ts` `triggerStuckRecoveryForTest` (`@Post('_test/recover-stuck-executions')`, `@ApiExcludeEndpoint()`)
- 위반 규약: `spec/conventions/swagger.md` §2 (Controller 패턴) — 정식 규약이 `@ApiExcludeEndpoint` 사용 시점·`_test/` 네임스페이스 세그먼트·`E2E_TEST_HOOKS` 게이팅 패턴을 다루지 않음
- 상세: 이번 diff 가 코드베이스 최초로 (1) `@ApiExcludeEndpoint()` 데코레이터, (2) 라우트 세그먼트 `_test/*`, (3) `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이팅 + 404 은닉 패턴을 도입한다. 코드 자체는 방어적으로 잘 설계됐고(§docstring 의 "다층 방어" 서술이 근거를 상세히 남김), 기존 `swagger.md`/`2-api-convention.md` 의 명시적 규칙을 위반하지는 않는다 — 단지 규약이 이 케이스를 아직 다루지 않을 뿐이다. e2e-only backdoor 는 향후 다른 도메인에서도 재발할 가능성이 있는 패턴(부팅 전용 트리거를 HTTP 로 검증해야 하는 사례는 이번이 처음이 아닐 수 있음)이라, 정식 규약으로 승격해두면 다음 PR 이 임의 변형을 만드는 것을 막을 수 있다.
- 제안: 코드 변경 불요. `swagger.md` 에 "e2e 전용 backdoor 엔드포인트" 절을 신설해 `_test/` prefix + `@ApiExcludeEndpoint` + 이중 env 게이팅(`NODE_ENV==='test'` AND 명시 플래그) + 404 은닉을 표준 레시피로 명문화하는 것을 권장(정식 규약 갱신 성격 — `project-planner` 영역).

### INFO — `RESUME_CHECKPOINT_MISSING` 재사용은 `error-codes.md` §1 의미 기반 원칙에 부합, 문서 갱신 여부만 확인 필요
- target 위치: 해당 없음 (에러 코드 자체는 `4-execution-engine.md` 가 아니라 `conventions/error-codes.md` 가 SoT)
- 위반 규약: 없음 — 확인 목적의 기록
- 상세: PR3 는 case B(크래시 re-drive) 실패 시 새 에러 코드를 신설하지 않고 기존 `RESUME_CHECKPOINT_MISSING` 을 재사용한다(`ai-conversation-helpers.ts` 의 기존 `RehydrationError` union). `error-codes.md` §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 "PR3 기간 미발동, 재구동 불가는 `RESUME_CHECKPOINT_MISSING`" 이라고 정확히 예고해뒀고, target spec(`4-execution-engine.md` §7.1/§7.5, §Rationale)·`error-codes.md`·`1-data-model.md` 세 곳의 서술이 모두 일치한다. §2(안정성/rename 금지) 원칙도 위반 없음 — 신설이 아니라 재사용이므로 breaking 우려 없음. 정합성 우수 사례로 판단.
- 제안: 조치 불요.

### INFO — 신규 method/파일 명명은 기존 패턴과 일관
- target 위치: 해당 없음
- 위반 규약: 없음 — 확인 목적의 기록
- 상세: `reclaimStuckRunningExecution`/`redriveStuckExecution`/`driveStuckRedrive`/`failOrphanRunningNodeExecutions`/`recordRunningSegmentStart` 등 신규 private method 는 camelCase 동사구로 기존 서비스 파일의 명명 스타일과 일치. e2e 파일명 `execution-crash-redrive.e2e-spec.ts` 도 기존 `<domain>-<scenario>.e2e-spec.ts` kebab-case 패턴(`execution-park-resume.e2e-spec.ts` 등)과 일치. `_test/recover-stuck-executions` 라우트 세그먼트도 kebab-case 준수.
- 제안: 조치 불요.

## 요약

이번 PR3 diff(execution-engine 크래시 re-drive 전환 + e2e 전용 recovery trigger)는 정식 규약(`spec/conventions/**`) 위반이 없다. 검토 대상 conventions 중 diff 와 직접 관련된 것은 `error-codes.md`(에러 코드 명명·안정성)뿐이었고, 이 문서는 오히려 이번 PR 의 도래를 사전에 정확히 예고해뒀으며(§3 `WORKER_HEARTBEAT_TIMEOUT` 행) 코드·target spec·conventions 3자가 일관됐다. 신설 에러 코드 없이 기존 `RESUME_CHECKPOINT_MISSING` 을 재사용한 것도 §1/§2 원칙(의미 기반 명명, rename 금지) 에 정확히 부합한다. 유일한 특이점은 e2e 검증을 위해 도입한 `_test/` 백도어 라우트 + `@ApiExcludeEndpoint` + 이중 env 게이팅 패턴으로, 이는 기존 `swagger.md` 규약이 아직 다루지 않는 신규 패턴이지만 어떤 명시 규칙도 위반하지 않으며 방어 설계도 견고하다 — 향후 재발 가능성을 감안해 규약 문서에 편입해두면 좋을 INFO 수준 제안이다. Audit-actions·cafe24-api-catalog 등 payload 에 포함된 나머지 conventions 는 이번 diff 와 무관해 해당 없음으로 처리했다.

## 위험도

NONE
