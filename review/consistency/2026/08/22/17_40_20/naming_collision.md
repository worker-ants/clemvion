# 신규 식별자 충돌 검토 — eia-error-code-unify (impl-done)

## 검토 범위

`origin/main...HEAD` diff (`spec/5-system/`) 실측:
- `spec/5-system/3-error-handling.md` — §1.3 카탈로그 `INVALID_INPUT` 행 → `INVALID_TRIGGER_PARAMETERS` 로 rename + rationale 각주 추가, §1.7 각주 re-run 소비처 서술 갱신
- `spec/5-system/13-replay-rerun.md` — §8.1 에러 표 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS`, §10.2 서버 거부 코드 동일 갱신
- `spec/5-system/12-webhook.md` — §5.2 각주의 "Manual re-run `INVALID_INPUT`" 서술을 "Manual 실행·저장·re-run 세 경로의 `INVALID_TRIGGER_PARAMETERS`" 로 통일
- `spec/5-system/14-external-interaction-api.md` — 마커 재제출 표 정리(신규 식별자 없음), `code:` frontmatter 에 기존 파일 2건 등재
- 연동 파일: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표 + `code:` frontmatter, `spec/conventions/error-codes.md` §4(§4.1/§4.2 분리 신설) + §5 Rename 이력 신규 행
- 코드: `executions.controller.ts`(Swagger 문구) · `executions.service.ts`(`code: 'INVALID_INPUT'` → `'INVALID_TRIGGER_PARAMETERS'`) · `triggers.mdx`/`triggers.en.mdx`(사용자 가이드 문구)

이번 PR 은 **새 식별자를 도입하지 않는다** — `POST /executions/:id/re-run` 의 `inputOverride` 검증 실패 `error.code` 를 `INVALID_INPUT` 에서, 자매 두 경로(주 실행 `POST /workflows/:id/execute`·저장 `POST /workflows/:id/save`)가 이미 쓰던 **기존** 코드 `INVALID_TRIGGER_PARAMETERS` 로 통합하는 rename 이다. `reject-masked-resubmission.ts`/`resolveTriggerParametersRejectingMasked`/`hasMaskedLeaf`/`masked-reject-callers-guard.ts` 등은 모두 선행 PR(#1188~#1191, 2026-08-20~21)에서 이미 구현된 코드이며 이번 diff 범위 밖(worktree 실측: `git diff origin/main...HEAD --name-status` 에 해당 `.ts` 파일 변경 없음, frontmatter `code:` 등재만 추가).

## 발견사항

- **[INFO]** `INVALID_TRIGGER_PARAMETERS` 는 신규 식별자가 아니라 기존 값의 3번째 소비처로 확장 — 실제 rename 완료 확인
  - target 신규 식별자: 없음 (기존 코드 재사용)
  - 기존 사용처: `codebase/backend/src/modules/workflows/workflows.controller.ts`·`workflows.service.ts`(주 실행/저장 경로, 종전부터 발행) / `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표(180행 부근)
  - 상세: 세 엔드포인트 모두 `resolveTriggerParameters` 가 던지는 **동일 의미**의 검증 실패를 감싼다. HEAD 워킹트리에서 `executions.service.ts:508` 의 `throw new BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ... })` 로 정정된 것을 실측 확인했고, `spec/5-system/3-error-handling.md` §1.3 카탈로그·`spec/5-system/13-replay-rerun.md` §8.1 에러 표·`spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표·`spec/5-system/12-webhook.md` §5.2 각주·`codebase/backend/src/modules/executions/executions.controller.ts` Swagger 문구·frontend user-guide mdx 2건이 모두 동기화됐다. 잔존하는 `INVALID_INPUT` 문자열 2곳(`13-replay-rerun.md:252`, `executions.service.ts:508` 인접 주석)은 전부 "2026-08-22 이전엔 이 자리가 `INVALID_INPUT` 이었다" 는 **rename 이력 서술**이며 발행 코드가 아니다(grep 확인, 라이브 `code:` 리터럴 아님).
  - 제안: 조치 불요 — 통합이 설계 의도이며 충돌이 아니다.

- **[INFO]** `error-codes.md §4` 재구성(§4.1/§4.2 신설)은 앵커 보존형 확장 — 기존 링크와 충돌 없음
  - target 신규 식별자: `spec/conventions/error-codes.md` §4.1(Code 노드 내부 분류)·§4.2(Trigger 파라미터 검증 사유) 서브섹션
  - 기존 사용처: `spec/4-nodes/5-data/2-code.md`·`spec/5-system/3-error-handling.md`·`spec/conventions/chat-channel-adapter.md` 가 이미 `error-codes.md#4-내부-전용-분류-코드-정규화-후-발행`(`## 4.` 최상위 앵커) 를 참조 중
  - 상세: 최상위 `## 4.` 헤딩 텍스트·앵커는 그대로 유지한 채 그 아래 `### 4.1`/`### 4.2` 를 신설하는 구조라, 기존 3건의 `§4` 참조는 여전히 올바른 섹션(이제는 두 파이프라인을 포함하는 부모 섹션)에 착지한다. 신설 §4.2 는 webhook §5.2·error-handling §1.3 가 이미 "error-codes 규약 §4 패턴" 을 인용하던 미착지 참조(§4 가 당시 Code 노드 전용이라 trigger 파라미터 사유와 무관했던 갭)를 메우는 목적이라, 오히려 기존 drift 를 해소한다.
  - 제안: 조치 불요.

- **[INFO]** Rename 이력 표 신규 행의 "PR" 컬럼 값 `#TBD_PR` — 식별자 충돌은 아니나 placeholder 잔존
  - target 신규 식별자: `spec/conventions/error-codes.md` §5 Rename 이력 표의 `INVALID_INPUT → INVALID_TRIGGER_PARAMETERS` 행, PR 컬럼 `#TBD_PR`
  - 기존 사용처: 같은 표의 기존 3행은 `PR4b`/`#566` 형식의 실제 PR/커밋 참조를 쓴다
  - 상세: `#TBD_PR` 은 다른 식별자와 충돌하지 않는 명백한 placeholder 문자열이라 CRITICAL/WARNING 대상은 아니다. 이전 회차(16:34:50) 검토가 우려했던 "무관한 커밋 해시(`7b0e65aa8`)가 PR 컬럼에 잘못 옮겨질 위험"은 실현되지 않았고, 대신 명시적 TBD 마커로 남아 있다.
  - 제안: 머지/PR 번호 확정 시 `#TBD_PR` 을 실제 PR 번호로 치환할 것 — 식별자 충돌 관점이 아니라 이력 추적 완결성 관점의 후속 조치.

## 요약

이번 target 은 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·spec 파일 경로 중 **어느 것도 신규로 도입하지 않는다.** 유일한 "값 변경" 대상인 `error.code` 는 이미 두 자매 엔드포인트가 쓰던 기존 값 `INVALID_TRIGGER_PARAMETERS` 로 세 번째 호출부(Manual re-run)를 통합하는 rename이며, HEAD 워킹트리 실측 결과 spec 5곳(`3-error-handling.md`·`13-replay-rerun.md`·`12-webhook.md`·`1-manual-trigger.md`·`error-codes.md`)과 코드 2곳(`executions.controller.ts`·`executions.service.ts`)·문서 2곳(mdx)이 모두 정합하게 갱신됐다. 폐기된 `INVALID_INPUT` 값은 잔존 참조가 전부 rename 이력 서술뿐이라 활성 충돌이 없고, `error-codes.md §4` 서브섹션 신설도 기존 3건의 앵커 참조를 깨지 않는다. 유일한 잔여 사항은 §5 표의 PR 컬럼 placeholder(`#TBD_PR`)로, 식별자 충돌이 아닌 이력 완결성 문제라 INFO 수준이다.

## 위험도
NONE
