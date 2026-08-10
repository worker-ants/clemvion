# Cross-Spec 일관성 검토 — `spec/conventions/` (재검토, impl-done)

검토 대상: `spec/conventions/` (특히 `spec-impl-evidence.md`) + 실제 구현 diff
(`origin/main...HEAD`, 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`).

## 프롬프트 결함 메모

번들 자체에는 `## 구현 변경 사항` diff 섹션이 없었으나(예산 초과), `spec-impl-evidence.md`
target 본문은 이번 회차에는 번들에 온전히 포함되어 있었다. diff 는 지시대로 워킹트리
절대경로에서 `git diff origin/main...HEAD` 로 직접 산출해 확인했다.

## 직전 라운드(`01_09_04`) 지적 3건 반영 확인

1. **`PROJECT.md:277` 미러 갱신** — 반영 확인. `plan-frontmatter.test.ts` row 가
   "top-level frontmatter 검사" 단일 서술에서 "**3종** 검사(frontmatter/`complete/` status
   종료값/top-level 상대링크)" 로 갱신됐고, `plan-scan.ts`·`spec-links.ts` 도 구현 파일로
   함께 등재됐다. `spec/conventions/spec-impl-evidence.md §4.2` 표의 동일 row 서술과
   자구까지 거의 일치 — 두 문서가 동기 상태.
2. **`spec-links.ts` JSDoc "8건" 정정** — 반영 확인. JSDoc 이 "이 가드가 보는 8건(이동
   7 + stale 앵커 1)" 과 "손으로 고친 9번째(```markdown 펜스 안이라 `extractLinks` 스캔
   밖)" 를 명시적으로 구분해 서술한다. 실제로 `extractLinks`(라인 82-106)는 펜스 진입 시
   `inFence` 토글로 링크 추출 자체를 건너뛰므로, 이 서술은 코드 동작과 일치한다.
   `plan/in-progress/spec-fix-swagger-forbidden-response.md` 의 손 정정(`../5-system/`
   → `../../spec/5-system/`, 코드펜스 안이라 가드가 볼 수 없는 경로 깊이 오류)도 diff 에서
   확인돼 서술과 실제 사례가 맞아떨어진다.
3. **`spec-impl-evidence §2.2` domain 구분 추가** — 반영 확인. "`status:` 키 (plan
   frontmatter, 2026-08-10 추가)" 항목이 plan 쪽 `status: implemented` 가 spec 쪽 enum 값과
   문자열을 공유하되 의미 도메인이 다르다는 것, SoT 가 `plan-scan.ts`
   의 `TERMINAL_PLAN_STATUSES` 라는 것을 명시한다. `spec/1-data-model.md` 의 엔티티
   `status` 컬럼들(Execution/NodeExecution 등)은 `completed`/`pending`/`running`/`failed`/
   `cancelled`/`skipped`/`waiting_for_input` 뿐이라 `implemented`/`applied`/`superseded`
   와 겹치지 않음 — 3번째 도메인(엔티티 컬럼)과도 충돌 없음을 직접 확인.

네 층(PROJECT.md / spec-impl-evidence §2.2·§4.2 / plan-lifecycle.md §4·§5 / 실제 가드 코드
`plan-scan.ts`+`plan-frontmatter.test.ts`+`spec-links.ts`)을 대조한 결과 **cutoff 값
(`2026-06-04`)·TERMINAL 값 집합(`complete`/`implemented`/`applied`/`superseded`)·검사
스코프(§4.2 표의 "top-level in-progress" vs "complete/**") 는 4곳 모두 정확히 일치**한다.
`plan-lifecycle.md §2.1` 에도 신규 두 검사의 스코프 구분이 추가돼 `research/` 문서가 두
신규 검사(상태 모순·링크)의 대상이 아님을 명시 — 기존 §2.1 서술과 모순 없음.

## 발견사항

- **[WARNING] `plan-scan.ts` 주석이 가리키는 후속 plan 이 같은 커밋에서 이미 폐기된 참조다**
  - target 위치: (간접) `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 가
    `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 를 본 컨벤션의 구현 증거로
    등재 — 그 파일의 주석이 곧 본 컨벤션의 "미완 통합 항목" 추적처를 서술한다.
  - 충돌 대상: `plan/in-progress/harness-env-value-subpattern-dedup.md` vs
    `plan/in-progress/docs-guard-walker-dedup.md` (둘 다 최신 커밋 `88555a52b` 에서
    동시에 갱신/신설).
  - 상세: `plan-scan.ts` 상단 주석(라인 18-22)은 "Gate C(`spec-plan-completion.test.ts`)의
    `collectCompletePlans` 미통합 항목은 `harness-env-value-subpattern-dedup.md` 에
    등재했다" 고 말한다. 그런데 **같은 커밋**이 `harness-env-value-subpattern-dedup.md` 를
    고쳐 정확히 그 반대를 선언한다 — "TS walker 중복 이관은 되돌렸다(잘못 넣었던 것),
    그 항목은 `docs-guard-walker-dedup.md` 에 있다" 는 명시적 Rationale 과 함께.
    `docs-guard-walker-dedup.md`(신규) 는 실제로 "## 함께 볼 것 — Gate C 의 4번째 walker"
    절에서 `collectCompletePlans` 통합 결정을 스스로의 체크박스 항목으로 갖고 있다.
    즉 코드 주석 1곳과 plan 문서 2곳이 서로 다른 "SoT" 를 가리키는 상태로 같은 커밋
    안에서 확정됐다 — 커밋 메시지도 "잘못된 이관 되돌림" 을 명시 항목으로 다루면서
    `plan-scan.ts` 자체의 참조는 갱신하지 않았다.
  - 제안: `plan-scan.ts` 라인 20-22 의 `harness-env-value-subpattern-dedup.md` 참조를
    `docs-guard-walker-dedup.md` 로 정정. 한 줄 diff 라 본 라운드에 바로 반영 가능.

## 요약

직전 라운드에서 낸 WARNING 2건 + INFO 1건은 모두 정확히 반영됐고, `PROJECT.md`·
`spec-impl-evidence.md §2.2/§4.2`·`plan-lifecycle.md §4/§5`·실제 가드 코드(`plan-scan.ts`
/ `plan-frontmatter.test.ts` / `spec-links.ts`) 네 층은 cutoff 값·TERMINAL 상태 집합·검사
스코프 서술이 전부 일치한다. 다만 그 반영 작업을 수행한 **바로 그 커밋** 안에서 새로운
사소한 stale 참조(코드 주석이 가리키는 후속 plan 파일이 같은 커밋에서 다른 파일로
갈아치워졌는데 주석만 갱신 안 됨)가 하나 생겼다. spec 문서 자체(엔티티 status 도메인
포함)와의 직접 모순은 없다.

## 위험도

LOW
