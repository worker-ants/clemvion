# 정식 규약 준수 검토 — `spec/5-system/`

검토 모드: `--impl-done`, scope = `spec/5-system/`, diff-base = `origin/main`

> 실측 확인: `origin/main...HEAD` 사이 `spec/**` 변경은 **0줄**이다(`git diff origin/main...HEAD --stat`).
> 이번 plan(`rerun-input-resolution-extract`, `spec_impact: none`)의 유일한 코드 diff 는
> `codebase/backend/src/modules/executions/executions.service.ts` — `reRun()` 의 40줄 입력 해석
> 블록을 private 헬퍼 `resolveManualOverrideInput`로 추출한 순수 리팩터다(에러 코드·응답 봉투
> 필드·검증 순서 전부 무변경, diff 라인 대조로 확인). 따라서 본 검토는 ① 이번 diff 가 새로 도입한
> 규약 위반이 있는지, ② `spec/5-system/`(특히 `13-replay-rerun.md` — 이 diff 의 `code:` 대상 spec)
> 이 현재도 `spec/conventions/**` 를 따르는지 두 축으로 수행했다.

## 발견사항

### [WARNING] `13-replay-rerun.md` §8.1·§8.2 의 401 코드가 표준 카탈로그와 다르다 (선존, 재확인)

- target 위치: `spec/5-system/13-replay-rerun.md:240`(§8.1 `POST /api/executions/:id/re-run`) ·
  `spec/5-system/13-replay-rerun.md:269`(§8.2 `GET /api/executions/:executionId/chain`)
- 위반 규약: `spec/5-system/2-api-convention.md:171`("`code` 의 상태코드별 기본값: … 401=`AUTH_REQUIRED`")
  + `spec/5-system/3-error-handling.md:42`(카탈로그 `AUTH_REQUIRED` | 401) +
  `spec/conventions/error-codes.md §1`(카탈로그 SoT 는 `3-error-handling.md`로 위임)
- 상세: 두 표 모두 `401 | UNAUTHORIZED | 인증 토큰 없음/만료`로 적혀 있고, §8.1 행은 스스로
  *"표준 [Spec 에러 처리] 규약"* 이라 자칭하면서 비표준 코드명을 쓴다. 런타임 실측
  (`codebase/backend/src/common/filters/http-exception.filter.ts` `case 401: return 'AUTH_REQUIRED'`)
  은 이미 규약대로 동작하므로 **클라이언트가 실제로 받는 값과 문서가 불일치**한다 — 이 문서를
  신뢰해 `UNAUTHORIZED`로 분기하면 실제 응답과 절대 일치하지 않는다. 오늘(2026-08-22) 앞선
  `--impl-prep` 검토(`review/consistency/2026/08/22/21_53_41/convention_compliance.md` W1)와
  `/ai-review`(`review/code/2026/08/22/22_19_56/SUMMARY.md` SPEC-DRIFT #1)에서 각각 동일하게
  잡힌 항목이며, 이번 `--impl-done` 시점까지도 **미수정**임을 재확인했다(코드 grep 재실측).
- **선존 여부**: 이번 plan 의 diff(`executions.service.ts`)와 무관하다. 이미
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 항목으로 등재돼
  planner 턴을 기다리고 있어 유실 위험은 없다(`spec/` 편집은 developer 권한 밖 — CLAUDE.md 역할표).
- 제안: 신규 조치 불요(이미 트래커에 등재). `project-planner` 턴에서 두 행의 `code` 열을
  `UNAUTHORIZED` → `AUTH_REQUIRED` 로 1줄 정정.

### [INFO] `spec/5-system/` 6개 문서가 권장 3섹션 구성(`## Overview`)을 따르지 않는다 (선존, 재확인)

- target 위치: `2-api-convention.md` · `6-websocket-protocol.md` · `16-system-status-api.md`
  (Overview 섹션 자체 부재) / `5-expression-language.md` · `7-llm-client.md` · `11-mcp-client.md`
  (`## Overview` 대신 다른 헤딩 레이블)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` 명명 컨벤션(`## Overview` / 본문 /
  `## Rationale` 3섹션) + CLAUDE.md "Spec 문서 3섹션 구성" 권장
- 상세: `grep -c '^## Overview' spec/5-system/*.md` 재실측 결과 여전히 위 6개 파일이 `0` 이다
  (`## Rationale` 축은 18개 중 `_product-overview.md` 제외 전부 정확히 1개로 완전 준수 —
  Overview 축만 부분 이탈). 이번 plan 이 이 6개 문서를 건드리지 않으므로 diff 가 만든 신규
  이탈이 아니다.
- 제안: 기계 강제 대상이 아닌 권장 사항이라 착수 차단 사유 아님. 이 문서들을 다음에 손댈 때
  `## Overview`(또는 `## 1. 개요` → `## Overview` 통일)로 정렬 권장.

### [INFO] 이번 diff 가 도입한 코드 주석은 관련 정식 규약 인용이 정확하다

- target 위치: `codebase/backend/src/modules/executions/executions.service.ts` 신설
  `resolveManualOverrideInput()` JSDoc/inline 주석
- 상세: `INVALID_TRIGGER_PARAMETERS` rename 근거 주석이 `spec/conventions/error-codes.md §5`
  (실제로 §5 "Rename 이력" 표에 `INVALID_INPUT → INVALID_TRIGGER_PARAMETERS`, PR #1193, 등급 B
  로 정확히 등재됨)를 가리키고, `details` vs `errors` 필드 주석도 실제 구현
  (`GlobalExceptionFilter`가 `details`만 읽음)과 일치한다. 코드 이동 과정에서 지시대상만
  "이 함수가 소유" → "그 wrapper(`resolveTriggerParametersRejectingMasked`)가 소유"로 정확히
  갱신됐다(로직 변경 없음). 이는 spec 문서가 아니라 코드 주석이라 conventions 준수 범위 밖이지만,
  `error-codes.md §5` 참조가 착지하는지 교차 확인한 결과 규약 위반 없음.
- 제안: 조치 불요.

### [INFO] 그 외 검토 결과 — 위반 없음 확인

- `spec/5-system/13-replay-rerun.md §8.1`(`INVALID_TRIGGER_PARAMETERS`)·`§10.2`(마스킹 재제출
  거부) 상호 참조가 착지하며, `MASKED_VALUE_RESUBMITTED` / `RERUN_` prefix 의도적 생략 서술이
  `spec/conventions/error-codes.md §4.2`·`3-error-handling.md §1.7`과 정합.
- `spec/conventions/egress-masking.md`(2026-08-22 신설)의 마커 리터럴 비인용 규율("본 문서는
  마커 리터럴을 적지 않는다")이 자체 본문에서 준수됨(`VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER`
  이름으로만 지칭).
- 신규 private 헬퍼는 `spec/` 어디에도 심볼명으로 인용되지 않는다 — 구현 세부이므로 spec 이
  이를 노출하지 않는 것은 SoT 분리 원칙(구현 상세 vs 계약)에 부합, 위반 아님.
- frontmatter(`id`/`status`/`code`)·API endpoint 명명(`/api/executions/:id/re-run`,
  `/api/executions/:executionId/chain` — 케밥 없는 리소스명이나 RPC-style 예외 규칙과 무관한
  표준 sub-resource 패턴)에서 신규 이탈 없음.

## 요약

이번 plan 의 유일한 코드 변경은 `ExecutionsService.reRun`의 입력 해석 블록을 private 헬퍼로
추출한 순수 리팩터이며 `spec/**`는 전혀 수정되지 않았다(diff 0줄). 신규로 도입된 규약 위반은
없다 — 새 코드의 규약 인용(`error-codes.md §5`)은 정확하고, 에러 코드·응답 봉투·검증 순서 전부
동작 무변경이 확인됐다. 다만 `spec/5-system/`에는 이번 diff 와 무관한 선존 규약 이탈이 둘 남아
있다: `13-replay-rerun.md`의 401 코드 표기(`UNAUTHORIZED` — 표준은 `AUTH_REQUIRED`, WARNING)와
6개 문서의 `## Overview` 헤딩 부재/변형(INFO). 전자는 이미 `spec-sync-external-interaction-api-gaps.md`
트래커에 planner 턴 항목으로 등재돼 유실 위험이 없고, 후자는 기계 강제 대상이 아닌 권장 사항이다.
둘 다 이번 검토에서 처음 발견된 것이 아니라 오늘 앞선 `--impl-prep`·`/ai-review` 검토에서 이미
포착·기록된 항목의 재확인이며, 본 plan 의 착수·완료를 차단할 CRITICAL 은 없다.

## 위험도

LOW
