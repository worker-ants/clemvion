# 변경 범위(Scope) 리뷰 — trigger-rotation-audit

## `12_22_23` 라운드 재검증 (커밋 `9eb2c6088`)

지시대로 `git show`(diff 전문) + 독립 뮤테이션 재현으로 `9eb2c6088`("fix(audit): 셋 중 하나에만
회귀를 걸었다 + 내 근거 문장이 사실과 달랐다")의 커밋 메시지 주장 3가지를 각각 재검증했다.

1. **"뮤턴트 2종이 이제 RED"** — **확인됨 (직접 재현).**
   `12_22_23/testing.md` CRITICAL 이 지적한 두 뮤턴트(① `rotateBotToken` 의 `recordAudit` 호출
   블록 전체 삭제, ② 같은 호출을 가드절·6단계 전부보다 앞으로 옮겨 무조건 조기 발화)를 이번
   리뷰에서 `triggers.service.ts` 를 직접 편집해 독립 재현했다(작업 종료 후 커밋 상태로 원복,
   `git diff` 로 잔존 변경 0 확인).
   - 뮤턴트 ①(호출 삭제) → `감사 — 성공 시 trigger.chat_channel_bot_token_rotated 를 남긴다` 1건
     실패(RED), `Number of calls: 0`.
   - 뮤턴트 ②(조기 발화, step 3 뒤로 이동) → `감사 — 오케스트레이션이 중간에 실패하면 남기지
     않는다` 1건 실패(RED), `Received number of calls: 1`.
   두 뮤턴트 모두 정확히 신규 테스트 1건씩만 실패시켰다(vacuous 아님). 주장과 일치.

2. **"사실 오류 세 곳 전부 정정"** — **확인됨.** `12_22_23/documentation.md` WARNING 이 지목한
   "응답에 새 자격증명을 1회 평문 반환한다"는 서술이 `chat_channel_bot_token_rotated` 에는 거짓
   (새 토큰은 호출자 입력이라 응답에 없음)이라는 지적을, 커밋이 실제로 정확히 세 곳에서 정정했다
   (`git show 9eb2c6088` diff 로 3곳 전부 확인):
   - `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 헤더 주석
   - `spec/5-system/1-auth.md §4.1` 카탈로그 행
   - `codebase/backend/src/modules/triggers/triggers.service.spec.ts` describe JSDoc
   세 곳 모두 "실행되면 기존 자격증명이 무효화된다(대상은 액션마다 다르다)"로 재서술하고, 1-auth.md
   에는 "앞의 둘만 1회 평문 반환, `chat_channel_bot_token_rotated` 는 반환하지 않는다"를 명시적으로
   추가했다. `documentation.md` 가 지목한 "코드 주석·spec 카탈로그 행·테스트 JSDoc 세 곳"과
   정확히 일치.

3. **"후속 등재"** — **확인됨.** `side_effect` WARNING(`AuditLogsService.record()` 의 DB 오류
   `logger.warn` 삼킴 → 관측 수단 없음)이 `plan/in-progress/spec-sync-auth-gaps.md` 에
   `- [ ] audit_log 적재 실패에 관측 수단이 없다 (2026-08-11, side_effect WARNING)` 항목으로
   실제로 등재됐다(`git show 9eb2c6088` diff 확인). "이 PR 의 회귀가 아니라 17개 producer 전체의
   기존 설계"라는 스코프 판단도 서술과 부합 — 이번 PR 범위에서 그 메커니즘 자체를 고치지 않은
   것은 스코프 이탈이 아니라 올바른 경계 설정이다.

세 주장 모두 실측과 일치한다 — SUMMARY/RESOLUTION 성격의 커밋 메시지가 부풀리거나 누락한 부분은
발견되지 않았다.

## 발견사항

- **[INFO]** 하네스 테스트 수정(`.claude/tests/test_consistency_bundle_priority.py`)이 "트리거
  회전 감사" 기능과 무관한 별도 축(harness/consistency-checker 인프라)이다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:504-529`(`test_an_uncommitted_edit_reaches_the_top_tier`),
    `:552-568`(`test_collect_context_puts_the_edited_document_first`)
  - 상세: `assertEqual(rank, 0)` → `assertLess(rank, tier0_size)` 로 완화하고 `tier0_size` 를
    함께 emit 하는 변경으로, 감사 로깅 기능과는 직접 관련이 없다. 다만 `git show bc569b089`
    커밮 메시지가 명시하듯 이 결함은 **이 PR 자신이 유발**했다 — 같은 브랜치가 `spec/5-system/
    1-auth.md`(파일 18)를 커밋해 같은 디렉터리에 tier 0 문서가 여럿이 되면서 기존 하네스 테스트의
    "프로브가 항상 1위" 전제가 깨진 것을 이 PR 안에서 직접 겪고 고쳤다(뮤테이션 검증까지 동반).
    즉 무관한 drive-by 리팩터링이 아니라, 이 PR 이 스스로 만든 push-gate 회귀를 같은 PR 안에서
    해소한 것이다. 엄밀히는 "harness 인프라"라는 다른 관심사이므로 별도 커밋으로 분리된 점(자체
    커밋 `bc569b089`)은 위생적이나, 별도 PR 로 완전히 분리했다면 더 깔끔했을 것이다.
  - 판단: CRITICAL 아님 — 자가유발 결함의 자가수정이고, 별도 커밋으로 이미 분리돼 있으며 근거가
    상세히 기록됨.

- **[INFO]** spec 6곳(planner 영역) 작성과 코드 구현(developer 영역)이 한 PR 에 번들됐다
  - 위치: `spec/2-navigation/2-trigger-list.md`, `spec/5-system/1-auth.md`,
    `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`,
    `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md` (파일 17~22) +
    `codebase/backend/src/modules/triggers/*`(파일 4~7)
  - 상세: 저장소 규약("spec/ 변경 → project-planner. codebase/ 변경 → developer")을 문면 그대로
    보면 역할이 나뉘어야 하지만, `plan/in-progress/spec-sync-auth-gaps.md`(파일 8) 자체가
    "planner 선행(spec 6곳)과 구현을 한 PR 에서 처리했다"고 명시적으로 그 결정을 정당화하며, 착수
    전 `consistency-check --spec`(파일 9~16, `11_48_48` 세션) 게이트가 실제로 먼저 돌아 BLOCK:YES
    를 해소한 뒤 진행된 정상 절차를 밟았다. 임의 확장이 아니라 문서화된 의도적 결정.
  - 판단: CRITICAL 아님 — 사전 게이트를 거친 의도적 번들.

- **[INFO]** `spec/5-system/15-chat-channel.md` 의 기존 결함(규약 위반 예시 액션명) 동시 정정
  - 위치: `spec/5-system/15-chat-channel.md:378` (파일 20)
  - 상세: `chat-channel.rotate-bot-token` 이라는, 이번 PR 의 주제와 무관해 보일 수 있는 기존
    오기를 함께 고쳤다. 그러나 이 문자열은 바로 이번 PR 이 확정하는 액션명(`trigger.
    chat_channel_bot_token_rotated`)이 가리키는 바로 그 이벤트의 예시이고, `cross_spec.md`
    C3(파일 12)가 "이번 결정과 충돌할 기존 결함이라 함께 정정" 이라고 착수 전에 이미 지목한
    항목이다. 무관한 opportunistic 정리가 아니라 이번 액션명 확정과 직접 얽힌 필수 동반 수정.
  - 판단: CRITICAL 아님 — 스코프 내.

- **[INFO]** `review/consistency/2026/08/11/11_48_48/**` 6개 파일(파일 9~16) 신규 커밋
  - 상세: 저장소 컨벤션(`review/consistency/**` = 일관성 검토 산출물의 정식 저장 위치)에 따른
    정상 산출물이며, 착수 전 게이트 실행 증거로 필요하다. 스코프 이슈 아님.

CRITICAL 로 판정할 항목은 없다 — 모든 항목이 (a) 명시적으로 정당화됐거나, (b) 이 PR 자신이
유발한 결함의 자가수정이거나, (c) 저장소 표준 프로세스 산출물이다. 코드 diff(파일 3~7) 자체는
`userId` 배선 + `recordAudit` 호출 + 대응 테스트로 기능 범위에 정확히 국한돼 있고, 요청하지 않은
기능 확장·무관한 리팩터링·의미 없는 포맷팅·불필요한 임포트/주석 변경은 발견되지 않았다.

## PR 종결 의견

**지금 종결(머지)해도 좋다.**

근거:
1. `12_22_23` 라운드의 CRITICAL 1건(테스트 커버리지 사각지대)·documentation WARNING(CHANGELOG
   누락·사실 오류 3곳)·side_effect WARNING(후속 관측성 갭)이 모두 `9eb2c6088` 에서 실제로,
   그리고 정확하게 처분됐다(위 재검증 3항목 전부 실측 일치).
2. 이번 스코프 리뷰에서 CRITICAL 급 범위 이탈은 없다 — 번들된 부수 변경(harness 자가수정,
   spec+code 동시 진행, 기존 결함 동시 정정)은 전부 문서화된 근거가 있고 이 PR 의 핵심 변경과
   직접 연결돼 있다.
3. 작업 트리가 깨끗하다(`git status` — 이번 리뷰 세션 산출물 외 변경 없음, `triggers.service.ts`
   뮤테이션 재현 후 원복 확인 완료).

다만 병합 전 확인 권장(비차단, 등재 수준):
- `plan/in-progress/spec-sync-auth-gaps.md`(파일 8)의 항목이 `[x]` 로 완료 처리됐는지, 그리고
  하위 신규 항목("`audit_log` 적재 실패에 관측 수단이 없다")이 별도 트랙으로 정확히 추적되는지
  머지 직후 한 번 더 확인할 것.
- harness 자가수정(`bc569b089`)은 이번엔 자가유발 결함이라 함께 처리하는 것이 합리적이었지만,
  향후 유사 상황에서는 가능하면 별도 PR 로 분리하는 편이 리뷰 가독성에 낫다(강제 사항 아님).

## 위험도

NONE

STATUS: DONE reviewer=scope output=/Volumes/project/private/clemvion/.claude/worktrees/trigger-rotation-audit/review/code/2026/08/11/12_37_14/scope.md critical=0
