# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 및 방법

Target 은 `spec/5-system/` 전체(prompt 에는 `2-api-convention.md`/`3-error-handling.md`/
`13-replay-rerun.md` 본문 전문 + 나머지 15개 파일은 컨텍스트 예산 초과로 생략, `<git diff>`
섹션 자체도 예산 초과로 생략). 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/masked-marker-plan-close-d8edad`)에서
`git diff origin/main...HEAD` 를 직접 재실행해 실제 변경분을 확인했다:

- `codebase/backend/.../executions.service.ts` — `reRun()` 의 입력 해석 40줄을 private 헬퍼
  `resolveManualOverrideInput` 로 추출하는 **순수 리팩터**(동작 무변경, 에러 코드·`details`
  필드·마커 거부 검사 시점 전부 동일하게 유지).
- `plan/**` — `masked-marker-test-gaps.md` complete/ 이동, `rerun-input-resolution-extract.md`
  신규 complete 등재, `spec-sync-external-interaction-api-gaps.md` 트래커 갱신.
- **`spec/**` 파일 변경은 diff 에 없다** — 이번 PR 은 spec 텍스트를 전혀 건드리지 않는다.

target 이 spec 을 직접 변경하지 않으므로, 이번 검토는 "새로 유입되는 충돌"이 아니라
`spec/5-system/` 현재 상태 자체에 잔존하는 cross-area 모순을 점검하는 것으로 초점을 맞췄다.
`spec/1-data-model.md §2.13/§2.13.1/§2.14`, `spec/4-nodes/7-trigger/1-manual-trigger.md §6`,
`spec/5-system/12-webhook.md §5.2/§5.3`, `spec/5-system/14-external-interaction-api.md §R17`,
`spec/conventions/error-codes.md`, `spec/conventions/egress-masking.md` 를 `Read`/`grep` 으로
직접 대조했다.

## 발견사항

- **[WARNING] `13-replay-rerun.md` §8.1/§8.2 의 401 코드가 API 규약 표준과 어긋난다**
  - target 위치: `spec/5-system/13-replay-rerun.md:240`, `:269` (§8.1 `POST
    /api/executions/:executionId/re-run`, §8.2 `GET /api/executions/:executionId/chain` 의
    에러 코드 표, 두 곳 모두 `401 | UNAUTHORIZED | 인증 토큰 없음/만료`)
  - 충돌 대상: `spec/5-system/2-api-convention.md:171` (`401=AUTH_REQUIRED` 를 상태코드별
    기본 코드로 명시) · `spec/5-system/3-error-handling.md:42` (`AUTH_REQUIRED | 인증 필요 |
    토큰 없음 | 401`)
  - 상세: `spec/5-system` 전체에서 401(토큰 없음/만료)의 표준 코드명은 `AUTH_REQUIRED` 로
    통일돼 있는데(`2-api-convention.md` §5.3 기본값 표, `3-error-handling.md` §1.2 카탈로그),
    `13-replay-rerun.md` §8.1·§8.2 두 표만 `UNAUTHORIZED` 를 쓴다. §8.1 행 자체가 "표준 [Spec
    에러 처리] 규약" 이라고 자칭하면서 그 규약과 다른 이름을 적어, 문면상 자기모순이다.
    실제 런타임(`http-exception.filter.ts:145`)은 401 에 `AUTH_REQUIRED` 를 내므로 이는
    **문서(spec)만의 drift** 이고 클라이언트 계약은 정상이다.
  - 제안: `13-replay-rerun.md` 두 표의 `UNAUTHORIZED` → `AUTH_REQUIRED` 로 정정. **이미
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-22 `21_53_41`
    convention_compliance W1 로 등재)에 planner-턴 항목으로 기록돼 있다** — `spec/` 쓰기가
    developer 권한 밖이라 이번 PR 은 정정하지 않는 것이 올바른 판단이었고 diff 도 그렇게
    돼 있다(spec 변경 없음). 본 발견은 그 백로그 항목을 cross-spec 렌즈에서 재확인하는
    것이며, 별도 조치를 요구하지 않는다 — 다음 planner 턴에서 처리 시 참고용.

이 외에 다음 축에서는 모순을 발견하지 못했다:

- **데이터 모델**: `spec/1-data-model.md §2.13`(Execution `re_run_of`/`chain_id`/`dry_run`/
  `single_node_id`/`previous_execution_id`, `input_data`/`output_data` 마스킹 규칙)이
  `13-replay-rerun.md §9`·`14-external-interaction-api.md §R17`(마커 카브아웃 2026-08-20
  종결 이력)과 필드·이력 단위로 정확히 일치.
- **API 계약**: `POST /executions/:id/re-run` 의 `400 INVALID_TRIGGER_PARAMETERS` +
  `details[].code=MASKED_VALUE_RESUBMITTED` 가 `13-replay-rerun.md §8.1`,
  `3-error-handling.md §1.7`, `4-nodes/7-trigger/1-manual-trigger.md §6`,
  `conventions/error-codes.md`(rename 이력 `INVALID_INPUT→INVALID_TRIGGER_PARAMETERS`,
  #1193 등급 B) 전부에서 동일한 3-엔드포인트(주 실행·저장·re-run) 공용 헬퍼
  (`resolveTriggerParametersRejectingMasked`/`toTriggerParameterErrorDetails`)로 수렴한다.
  이번 diff 가 추출한 private 헬퍼도 이 계약(코드·`details`·raw-우선 검사 시점)을 한 글자도
  바꾸지 않았다 — 리팩터가 이 API 계약을 깨지 않았음을 실제 파일 diff 로 확인.
  `conventions/egress-masking.md` 가 마커 집합·깊이 상한의 SoT 를 `@workflow/masked-markers`
  공유 패키지로 단일화한 것도 `14-external-interaction-api.md §R17`·
  `manual-trigger.md` 양쪽에서 일관되게 인용된다.
  §8.1 401 코드 하나를 제외하면 나머지 코드(403/404/409/400)는 규약과 일치.
  `13-replay-rerun.md §8.1` 이 `INVALID_TRIGGER_PARAMETERS` 만 `RERUN_` prefix 를 갖지 않는
  이유도 명시적으로 서술돼 있어 다른 4종(`RERUN_PERMISSION_DENIED` 등)과 네이밍 충돌이 없다.
- **요구사항 ID**: `RR-PL-01~07`, `R17`/`R18`(EIA) 등 신규 ID 는 각 spec 파일 내에서만
  스코프되며 다른 영역에서 재사용된 흔적 없음.
- **RBAC**: `RR-PL-06`(원본 시작자 + Editor+, `executed_by=NULL` 자동 실행은 Editor+ 전원)이
  `1-auth.md` RBAC 매트릭스의 Owner/Admin/Editor/Viewer 4-tier 모델과 일치.
- **계층 책임**: 입력 해석(스키마 로드 → 마커 거부 resolve → 에러 매핑)의 소유는 spec 상
  `executions.service.ts` 로 명시돼 있고(`3-error-handling.md` "Re-run 의 `inputOverride`"),
  private 헬퍼 추출은 같은 서비스 파일 내부 구조 변경이라 이 소유 경계를 넘지 않는다 —
  spec 은 메서드 내부 분해 수준까지 규정하지 않는다.

## 요약

이번 PR 의 실제 diff 는 spec 텍스트를 전혀 바꾸지 않는 순수 코드 리팩터(`reRun` 입력 해석
40줄 → private 헬퍼)와 plan 트래커 정리뿐이라, cross-spec 관점에서 새로 유입되는 충돌은
없다. `spec/5-system/` 현재 상태를 관련 영역(`1-data-model.md`, `4-nodes/7-trigger/`,
`conventions/error-codes.md`, `conventions/egress-masking.md`)과 대조한 결과, 데이터 모델·
API 계약·RBAC·계층 책임 대부분이 촘촘히 상호 참조되어 정합했다. 유일한 발견은
`13-replay-rerun.md` §8.1/§8.2 의 401 코드가 API 규약 표준(`AUTH_REQUIRED`)과 어긋나는
문서-only drift(`UNAUTHORIZED`)이며, 이는 이미 이전 리뷰 라운드(21_53_41)가 발견해
`spec-sync-external-interaction-api-gaps.md` 에 planner-턴 항목으로 정확히 등재해 둔
상태다 — 런타임 계약에는 영향이 없고 developer 권한 밖이라 이번 PR 이 손대지 않은 것은
올바른 판단이다.

## 위험도

LOW
