STATUS=success

===REPORT_MARKDOWN_BELOW===

# 정식 규약 준수 검토 — target: `spec/5-system/` (--impl-done)

## 사전 확인 (범위 판정)

호출 프롬프트는 이 워크트리 경로(`.claude/worktrees/eia-r8-cache-scope-4ae434`)를
"EIA r8 캐시 스코프" 작업으로 암시하지만, 실제 `git worktree list` / `git log` 로 확인한
결과 이 워크트리의 실제 체크아웃 브랜치는 `claude/raw-query-audit-followups` 이다 (워크트리
디렉토리명이 재사용되며 이름만 stale 하게 남은 상태 — `plan/in-progress/update-returning-tuple-shape.md`
및 커밋 `103dee234` "stale 워크트리 이름이 consistency 대상을 오염시킨다" 에 이미 기록·추적 중인
기존 이슈). 이름에서 "EIA 캐시 스코프 델타가 없다" 는 추론을 끌어내 CRITICAL 을 내는 것은
동일 문서가 명시적으로 경고한 오탐 패턴이므로, 본 검토는 **실제 diff**(`git diff origin/main...HEAD`)
와 **실제 target 문서 내용**(`spec/5-system/*.md`, 특히 번들에 포함된 `1-auth.md`·`3-error-handling.md`)
만을 근거로 판단했다.

`git diff origin/main...HEAD --stat -- spec/` 결과 **spec 델타 0** — 이번 PR 은 코드 전용이다
(`auth-oauth.service.ts`, `execution-engine.service.ts`, `knowledge-base.service.ts` 의
`UPDATE/DELETE … RETURNING` 튜플 오인 버그 수정 + 공용 헬퍼 `updateReturningRows` 신설).
코드 전용 PR 에서 spec 델타 0은 그 자체로 정상이며 위반이 아니다.

## 검토 내용

1. **명명 규약**: 신설 유틸 `updateReturningRows`/`AuthOAuthStateRow`/`countCalls` 는 backend
   내부 유틸리티로 API endpoint·DTO·swagger 표면이 아니다. 신규/변경된 에러 코드는 없다
   (`OAUTH_STATE_MISMATCH`, `KB_REEXTRACT_IN_PROGRESS`, `KB_REEMBED_IN_PROGRESS` 모두 기존
   코드 재사용 — `spec/5-system/3-error-handling.md` §1.9·`spec/conventions/error-codes.md` §1
   에 이미 등재된 `UPPER_SNAKE_CASE` 준수 코드). 위반 없음.
2. **출력 포맷 규약**: OAuth 콜백 응답 `{ ...tokens, rememberMe }` 의 shape 은 변경 없음 —
   버그는 `rememberMe` 값 산출 로직(snake_case 필드 오독)에 있었고 이번 수정은 그 계산을
   `spec/5-system/1-auth.md` §2.3(rememberMe→7일/30일 TTL) 이 이미 규정한 대로 복원한 것.
   즉 **spec 을 따르지 않던 구현을 spec 에 맞춘** 방향이라 규약 위반이 아니다.
3. **문서 구조 규약**: 번들에 포함된 `spec/5-system/1-auth.md`·`3-error-handling.md` 는 각각
   `## Overview` → 번호 섹션 본문 → `## Rationale` 구조를 유지하고 있어 CLAUDE.md 3섹션
   권장을 준수. frontmatter(`id`/`status`/`code`/`pending_plans`)도 `spec-impl-evidence.md`
   스키마와 부합.
4. **API 문서 규약**: 이번 diff 는 컨트롤러/DTO/swagger 데코레이터를 건드리지 않는다
   (raw SQL 결과 파싱 레이어만 수정). 해당 없음.
5. **금지 항목**: `spec/conventions/**` 어디에도 raw query 결과 shape 처리 방식을 규정한
   컨벤션은 없다(코드 스타일/버그 수정은 `/ai-review` 영역이며 실제로 `review/code/2026/08/13-14/**`
   에 별도 코드 리뷰 세션이 이미 다수 수행됨). 확인된 명시적 금지 패턴 위반 없음.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

- **[INFO]** 신규 공용 유틸(`update-returning-rows.ts`, `assert-row-array.ts` 확장)이
  `spec/5-system/1-auth.md`·(execution-engine·knowledge-base 관련 spec 문서)의 `code:`
  frontmatter glob 에는 개별 등재되어 있지 않다.
  - target 위치: `spec/5-system/1-auth.md` frontmatter `code:` (라인 49-61 근방)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §2 (code: 필드는 glob 매칭 존재만
    검증하며 "PR 이 건드린 모든 파일 나열"을 의무화하지 않음)
  - 상세: `common/utils/update-returning-rows.ts` 는 auth·execution-engine·knowledge-base
    세 도메인이 공유하는 범용 유틸이라 특정 spec 문서에 배타적으로 귀속시키기 애매하다.
    가드 위반은 아니며(글롭이 이미 존재 파일에 매칭), 강제 사항도 아니다.
  - 제안: 조치 불필요. 굳이 정리하려면 별도 `spec/5-system/0-overview.md` 류의 cross-cutting
    유틸 섹션에 포인터를 추가하는 정도(선택 사항).

## 요약

이번 PR 은 `spec/5-system/` 에 대한 spec 델타가 없는 코드 전용 버그 수정(`UPDATE/DELETE …
RETURNING` 이 TypeORM 0.3.31+pg 에서 `[rows, rowCount]` 튜플로 반환되는 것을 8개 지점이
행 배열로 오인해 소셜 로그인 상시 실패·KB CAS 락 미작동·admission cap 미집행 등을 유발한
결함의 수정)이다. 변경된 동작(예: rememberMe 7일/30일 TTL, KB 재추출/재임베딩 409 CAS 락)은
모두 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`
가 이미 규정한 계약을 구현이 뒤늦게 따라잡은 것으로, 정식 규약을 새로 위반하거나 규약과
어긋나는 신규 명명·출력 포맷·API 문서 패턴을 도입하지 않았다. 번들에 포함된 target 문서
섹션(§Overview/본문/Rationale 구조, 에러 코드 명명)도 기존 규약을 그대로 준수한다. 워크트리
디렉토리명("eia-r8-cache-scope")과 실제 브랜치 내용 불일치는 이미 별도 plan(`update-returning
-tuple-shape.md`)에 추적 중인 기존 이슈이며, 본 검토는 그 이름에서 유도된 오탐(EIA 캐시 스코프
델타 부재를 CRITICAL 로 보는 것)을 반복하지 않았다.

## 위험도

NONE
