# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (--impl-done 재검토)

배경: 직전 impl-done(`review/consistency/2026/07/10/23_20_43/`)은 `BLOCK: NO`. 이후 커밋
(`b5d0203bc` 문서/리뷰 산출물, `c807d4d1b` plan git mv)은 `codebase/**` 내용 변경 0 — mtime 만
갱신돼 guard 재발화. 본 세션은 `git diff origin/main...HEAD` 를 처음부터 다시 실증해 재검토한다.

대상 diff (5 commits, `origin/main...HEAD`):
- `0e80bd4a1` refactor(external-interaction): getStatus() 2단계 컬럼 projection
- `629f628e6` docs(plan): TEST WORKFLOW 통과 기록
- `f2764f3a9` refactor(external-interaction): ai-review Warning 4건 반영
- `b5d0203bc` docs(review): impl-done 일관성 검토 + fresh ai-review
- `c807d4d1b` chore(plan): mark eia-getstatus-column-projection complete

변경 파일 (`git diff --stat`): `interaction.service.ts`, `interaction.service.spec.ts`,
`plan/complete/eia-getstatus-column-projection.md`(신규, `plan/in-progress/` 에서 git mv),
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(1줄 stale 인용 정정),
`review/code/2026/07/10/{22_47_32,23_20_44}/**`, `review/consistency/2026/07/10/{22_25_21,23_20_43}/**`.
**`spec/5-system/14-external-interaction-api.md` 본문·frontmatter는 diff에 없음** — spec 무변경 확인.
`codebase/backend/src/modules/external-interaction/` 내 변경 파일도 `interaction.service.ts`
(+spec.ts) 뿐 — controller·DTO·guard·rate-limiter 등 미변경.

## 발견사항

- **[INFO]** RESOLUTION.md `## 조치 항목` 표의 `commit` 열이 실제 git hash 대신 `(본 commit)` 리터럴
  - target 위치: `review/code/2026/07/10/22_47_32/RESOLUTION.md` `## 조치 항목` 표 전 행
  - 위반 규약: `.claude/skills/developer/SKILL.md` §RESOLUTION.md schema — `## 조치 항목`은 "SUMMARY # 와
    **fix commit hash** 매핑 표"라고 명시
  - 상세: RESOLUTION.md 가 fix 코드와 **같은 commit**(`f2764f3a9`)에 함께 커밋되므로 작성 시점엔 자신이
    속할 commit hash 를 알 수 없는 구조적 chicken-egg. 과거 산출물(예: `review/code/2026/06/14/**` 다수)의
    `## 조치 항목` 표 컬럼 헤더도 `# | 발견 | 조치 | commit`·`# | 발견 | 조치`·`출처 | 발견 | 조치` 등으로
    제각각이라 schema 템플릿이 예시일 뿐 리터럴 강제가 아님이 기존 관행으로 확인됨. 이 인스턴스는 컬럼
    자체는 갖추고 있어 상대적으로 더 엄격한 편.
  - 제안: 필수 위반 아님(비차단). 강제하려면 push 직전 `git rev-parse --short HEAD` 로 실 hash 를
    사후 치환하는 절차를 §RESOLUTION.md schema 에 명문화하는 **규약 갱신**을 고려할 수 있으나, 기존
    선례가 이미 다양한 표기를 인정하는 상태라 우선순위 낮음.

- **[INFO]** step 8(TEST WORKFLOW) 커밋 prefix가 `docs(plan):` — SKILL.md 표는 `test(<scope>):` / `style(<scope>):` 명시
  - target 위치: 커밋 `629f628e6` "docs(plan): TEST WORKFLOW 통과 기록 (lint·unit·build·e2e)"
  - 위반 규약: `.claude/skills/developer/SKILL.md` §단계별 자동 commit 표 — "8. TEST WORKFLOW | ... | `test(<scope>):` / `style(<scope>):`"
  - 상세: 이 커밋은 코드 수정 없이 plan 체크박스만 갱신한 것이라 표의 "코드 수정 없으면 skip" 조건에
    해당하지만, skip 대신 `docs(plan):` prefix로 별도 커밋을 남겼다. `git log --all --grep="docs(plan):"`
    조회 결과 `c453d2084`·`379bd37a2` 등 과거 병합 커밋에서도 동일 패턴(코드 변경 없는 TEST WORKFLOW
    통과 기록을 `docs(plan):` 커밋으로 별도 기록)이 반복적으로 쓰여 이미 정착된 실무 관행으로 보인다.
  - 제안: 비차단. 다만 반복되는 패턴이라면 §단계별 자동 commit 표에 "코드 변경 없는 TEST WORKFLOW
    통과 기록은 `docs(plan):`" 예외를 명문화하는 규약 갱신을 검토할 만함.

- **[INFO]** `STATUS_PROJECTION_COLUMNS` + `satisfies (keyof Execution)[]` 패턴이 코드베이스 최초 사용
  - target 위치: `interaction.service.ts:66-73`
  - 위반 규약: 없음(신규 패턴 도입 자체는 금지 항목 아님)
  - 상세: `grep -rn "COLUMNS\b" codebase/backend/src`, `grep -rn "satisfies (keyof" codebase/backend/src`
    결과 이 파일이 유일한 사용처. 명명(SCREAMING_SNAKE_CASE, 비-export, JSDoc 포함)은 같은 파일의
    `TERMINAL_STATUSES`/`SSE_SEQ_PLACEHOLDER` 와 완전히 일관. 프로퍼티명(`workflowId`/`startedAt`/
    `finishedAt`/`outputData`/`conversationThread`)도 `execution.entity.ts` 의 실제 camelCase 프로퍼티와
    직접 대조해 오기 없음을 확인(TS 컴파일 통과로도 실증됨).
  - 제안: 조치 불필요.

Critical/Warning 급 발견 없음.

## 항목별 확인 결과

1. **`spec/conventions/**` 위반 여부 (API 응답 형식·명명·주석 규약)** — 위반 없음.
   - `swagger.md`: controller·DTO 미변경 → 적용 대상 아님.
   - `error-codes.md`: 신규/변경 에러코드 없음(`error-codes.ts` diff 0).
   - `conversation-thread.md` §"소비처 (2026-07-09)": "(c) getStatus REST(읽기 전용)"가 SSE emit 과
     동일 `redactThreadForPublic` helper 를 egress 시 공유해야 한다는 불변식을 그대로 유지 — 2단계
     재조회 결과(`threadRow.conversationThread`)에도 동일 helper 재배선이 유지됨을 신규 테스트
     (`2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과`)가 secret-injection 방식으로 고정.
   - `execution-context.md`: `ExecutionContext` 필드 집합 관련 규약이나, `getStatus()` 는 애초
     `ExecutionContext` 소비자가 아니라(Execution DB row 직접 조회) 저촉 대상 아님.
   - 모듈 상수 명명(SCREAMING_SNAKE_CASE·비-export)은 §3 참조.

2. **`PROJECT.md §변경 유형 → 갱신 위치 매핑` 전 행 대조** — 매칭 행 없음을 확인.
   - "백엔드 API 추가·변경"(swagger jsdoc + user-guide) 행: 트리거 조건인 API 노출(요청/응답 shape)
     변경이 0건(`interaction.controller.ts`, `dto/responses.dto.ts` 등 diff 0) — 트리거 자체가
     성립하지 않음. plan 의 자체 판정("wire·DTO·에러코드 무변경의 순수 내부 조회 최적화")과
     `git diff --stat` 실측이 일치.
   - i18n/backend-labels/dict/mdx: diff 0.
   - `spec/**` 대규모 변경 행: `spec/5-system/14-external-interaction-api.md` diff 0.
   - 신규 cross-cutting enum/handler output field/BullMQ 큐 등 나머지 20여 행: 해당 없음(코드 변경
     범위가 단일 서비스 메서드의 쿼리 projection에 국한).

3. **모듈 상수 명명 일관성** — `STATUS_PROJECTION_COLUMNS` 는 SCREAMING_SNAKE_CASE·비-export·
   JSDoc 포함으로 같은 파일 선례(`TERMINAL_STATUSES`, `SSE_SEQ_PLACEHOLDER`)와 완전히 일관. 문제 없음.

4. **commit 메시지 규약** — `git log origin/main..HEAD --oneline` 5건 전부 `type(scope): subject`
   conventional-commit 형식. `refactor(external-interaction):`(×2), `docs(plan):`, `docs(review):`,
   `chore(plan): mark <name> complete`. `.claude/skills/developer/SKILL.md §단계별 자동 commit` 표와
   대조: 5–7단계/9단계 REVIEW WORKFLOW 는 `refactor(<scope>):` 일치, 10단계 plan complete 는
   `chore(plan): mark <name> complete` 문구까지 정확히 일치. 8단계 TEST WORKFLOW 의 `docs(plan):`
   prefix 편차는 위 INFO 참조(비차단, 기존 실무 관행과 일치).

5. **완료 plan `plan/complete/eia-getstatus-column-projection.md` frontmatter**
   - `spec_impact: none` — 리터럴 `none` 사용, YAML 리스트가 아닌 bare string 도 아님 → Gate C
     스키마(`.claude/docs/plan-lifecycle.md §5`, `spec/conventions/spec-impl-evidence.md`) 유효값 충족.
   - `worktree: optimize-getstatus-projection-78853c`(현재 worktree 디렉토리명과 일치) /
     `started: 2026-07-10` / `owner: developer` 3개 필수 필드 모두 존재 (`plan-lifecycle.md §4`).
   - `started` 가 2026-06-04 이후라 `spec-plan-completion.test.ts` 강제 대상이며, 커밋 메시지가
     "frontend Gate C·plan-frontmatter 가드 통과 확인 (unit PASS)" 를 명시 — 자가 검증 기록 있음.
   - `git mv` 로 이동(내용 변경 0, rename 100%) — `plan-lifecycle.md` "이동 skip 자가점검" 항목
     ("commit 메시지가 `chore(plan): mark <name> complete` 형식인가") 충족.

6. **`review/code/2026/07/10/22_47_32/RESOLUTION.md` §RESOLUTION schema 충족 여부**
   - `## 조치 항목` ✓ (SUMMARY # ↔ 조치 매핑 표, W-1~W-4 + INFO 항목 전부 커버)
   - `## TEST 결과` ✓ — lint/unit/build/e2e 4항목 모두 기록. e2e 줄은 `**통과** (..., 43 suite ·
     249 test, 0 fail)` — `.claude/skills/developer/SKILL.md §RESOLUTION.md schema` 의 4형식
     (통과/면제/보류(수동 전용)/자동 흐름 환경 차단) 중 "통과"에 해당, 정상.
   - `## 보류·후속 항목` ✓ ("없음. 별도 plan 으로 이관한 항목 없음.")
   - e2e 1차 실행 113 failed → 원인이 `getStatus`·본 PR 변경과 무관한 auth 의존 스펙 전반의
     `register failed: 500` 로 수렴함을 실증하고, 잔존 볼륨 문제로 규명(`make e2e-down` 후
     249/249 재통과)한 경위를 투명하게 기록 — 은폐·자의적 스킵 없음. `## 조치 항목` 표 컬럼
     구성(`SUMMARY # | 내용 | 조치 | commit`)이 §RESOLUTION.md schema 예시 표(`SUMMARY # | 분류 |
     조치 commit | 비고`)와 정확히 일치하진 않으나, 과거 산출물 전수(`review/code/**`)가 이미
     제각각 컬럼 구성을 써온 관행과 부합 — schema 는 "두 필수 섹션 + e2e 4형식" 을 강제할 뿐 표
     컬럼 리터럴을 강제하지 않음(§1 INFO 항목 참조).

## 요약

이번 변경(`getStatus()` 2단계 컬럼 projection)은 wire 응답 계약·DTO·컨트롤러·엔드포인트·에러코드·
i18n·user-guide 어느 것도 건드리지 않는 순수 내부 조회 최적화로, `PROJECT.md §변경 유형 → 갱신 위치
매핑`의 어떤 행도 트리거하지 않는다는 자체 판정이 실제 diff 와 정확히 일치한다. 신규 모듈 상수
`STATUS_PROJECTION_COLUMNS` 는 같은 파일 선례와 명명 일관성을 유지하고 `satisfies (keyof Execution)[]`
로 컴파일 타임 오기 차단까지 실증했다. `conversation-thread.md` 의 egress 마스킹 불변식(단일
`redactThreadForPublic` helper 공유)은 2단계 재조회 구조로 바뀐 뒤에도 secret-injection 테스트로
명시적으로 재확인됐다. commit 메시지는 conventional-commit 형식과 developer SKILL 단계별 prefix 표를
대체로 준수하며(8단계 `docs(plan):` 편차만 기존 실무 관행과 일치하는 비차단 INFO), plan frontmatter
는 Gate C(`spec_impact: none`)·필수 필드(`worktree`/`started`/`owner`)를 모두 충족한다. RESOLUTION.md
는 `## 조치 항목`/`## TEST 결과`(e2e 4형식 중 "통과")/`## 보류·후속 항목` 3섹션을 모두 갖추고 e2e
1차 실패의 환경적 원인을 투명하게 기록했다. Critical/Warning 급 정식 규약 위반은 발견되지 않았으며,
직전 impl-done(`23_20_43`) 판정과 결론이 일치한다(내용 변경 없는 mtime-only guard 재발화였음을 재확인).

## 위험도

NONE

STATUS: OK
