# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (--impl-done)

대상 diff: `git diff origin/main...HEAD` (3 commits: `0e80bd4a1` 구현 / `629f628e6` plan 갱신 / `f2764f3a9` ai-review Warning 반영)
변경 파일: `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `interaction.service.spec.ts`, `plan/in-progress/eia-getstatus-column-projection.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(1줄 stale 인용 정정), `review/code/2026/07/10/22_47_32/**`, `review/consistency/2026/07/10/22_25_21/**`.
**`spec/5-system/14-external-interaction-api.md` 본문·frontmatter 는 diff 에 포함되지 않음** — spec 무변경 확인.

## 발견사항

- **[INFO]** RESOLUTION.md `## 조치 항목` 표의 `commit` 열이 실제 git hash 대신 `(본 commit)` 리터럴
  - target 위치: `review/code/2026/07/10/22_47_32/RESOLUTION.md` `## 조치 항목` 표 전 행
  - 위반 규약: `.claude/skills/developer/SKILL.md` §RESOLUTION.md schema — "`## 조치 항목`: SUMMARY # 와 **fix commit hash** 매핑 표"
  - 상세: RESOLUTION.md 가 fix 코드와 **같은 commit**(`f2764f3a9`)에 함께 커밋되므로 작성 시점에 실제 hash 를 알 수 없는 구조적 chicken-egg 이 있다. 다만 `review/code/2026/07/10/15_03_11/RESOLUTION.md` 등 기존 산출물도 hash 컬럼 없이 "파일" 컬럼만 쓰는 등 프로젝트 내 실제 관행이 이미 느슨하다 — 이 인스턴스는 오히려 컬럼을 갖추고 있어 상대적으로 더 엄격하다.
  - 제안: 필수 위반은 아님(선례가 이미 다양한 표기를 인정). 원한다면 push 직전 `git rev-parse --short HEAD` 로 실제 hash 를 사후 치환하는 절차를 §RESOLUTION.md schema 에 명문화하는 규약 갱신을 고려할 수 있음 — 강제할 정도는 아니라고 판단.

- **[INFO]** `STATUS_PROJECTION_COLUMNS` + `satisfies (keyof Execution)[]` 패턴이 코드베이스 최초 사용
  - target 위치: `interaction.service.ts:66-73`
  - 위반 규약: 없음 (신규 패턴 도입 자체는 금지 항목 아님)
  - 상세: `grep -rn "COLUMNS\b" codebase/backend/src` / `grep -rn "satisfies (keyof" codebase/backend/src` 결과 이 파일이 유일한 사용처. 명명(SCREAMING_SNAKE_CASE, 비-export)은 같은 파일의 `TERMINAL_STATUSES`/`SSE_SEQ_PLACEHOLDER` 와 일관되고, RESOLUTION 이 컴파일 타임 차단을 `tsc` 로 실증(TS2820)까지 남겨 근거가 충분함.
  - 제안: 조치 불필요. 향후 다른 서비스에서 유사 projection 이 필요하면 이 패턴을 참조 선례로 재사용 권장(문서화까지는 불요).

## 항목별 확인 결과

1. **`spec/conventions/**` 위반 여부** — 위반 없음. `swagger.md`(DTO/컨트롤러 무변경이라 미적용), `error-codes.md`(신규 에러코드 없음), `conversation-thread.md`(§8.4 "소비처 (b) SSE waiting emit, (c) getStatus REST" 를 그대로 유지 — `redactThreadForPublic` egress 마스킹 재배선이 W1 fix 로 명시적으로 고정됨) 어느 것도 저촉하지 않음.
2. **PROJECT.md §변경 유형 → 갱신 위치 매핑** — 표의 22개 행을 전수 대조. 매칭 행 없음을 확인: DTO/컨트롤러/엔드포인트 파일 diff 0건, 에러코드/warningCode 신규 0건, i18n dict·MDX·backend-labels 미터치, `spec/**` 미변경(신규/대규모 변경 행 미해당), enum·handler output field 신규 없음. "백엔드 API 추가·변경" 행은 API surface(요청/응답 shape) 변경이 없어(내부 조회 최적화, wire 동일) 트리거 조건 자체가 성립하지 않음 — plan 의 자체 판정("해당 행 없음")과 일치.
3. **모듈 상수 명명 일관성** — `STATUS_PROJECTION_COLUMNS` 는 SCREAMING_SNAKE_CASE·비-export·JSDoc 포함으로 같은 파일 선례(`TERMINAL_STATUSES`, `SSE_SEQ_PLACEHOLDER`)와 일관. 문제 없음.
4. **commit 메시지 규약** — `git log origin/main..HEAD --oneline` 3건 모두 `type(scope): subject` 형식(`refactor(external-interaction):`, `docs(plan):`) 준수. 각 커밋 본문도 변경 배경·근거를 명시해 developer SKILL §단계별 자동 commit 표(9단계 REVIEW WORKFLOW → `refactor(<scope>):`)와 일치.
5. **plan frontmatter 스키마** — `plan/in-progress/eia-getstatus-column-projection.md` 에 `worktree: optimize-getstatus-projection-78853c`(현재 worktree 디렉토리명과 일치) / `started: 2026-07-10` / `owner: developer` 3개 필수 필드 모두 존재. `.claude/docs/plan-lifecycle.md §4` 스키마 충족.
6. **RESOLUTION.md §RESOLUTION schema** — `review/code/2026/07/10/22_47_32/RESOLUTION.md` 에 `## 조치 항목`(SUMMARY#-내용-조치-commit 매핑 표) · `## TEST 결과`(lint/unit/build/e2e 각 결과, e2e 는 "통과" — 4형식 중 정상) · `## 보류·후속 항목`(없음 명시) 3섹션 모두 존재. push 전 자가검증 체크리스트(두 필수 섹션 존재·e2e 4형식 중 하나) 충족. commit hash 컬럼이 실제 hash 대신 "(본 commit)" 인 점만 위 INFO 로 기록(비차단).

## 요약

이번 변경은 `getStatus()` 의 순수 내부 조회 최적화(2단계 컬럼 projection)로, wire 응답 계약·DTO·엔드포인트·에러코드·i18n·user-guide 어느 것도 건드리지 않아 `PROJECT.md §변경 유형 → 갱신 위치 매핑` 의 어떤 행도 트리거하지 않는다는 자체 판정이 실제 diff 와 일치한다. 신규 모듈 상수 `STATUS_PROJECTION_COLUMNS` 의 명명·비-export 스타일은 같은 파일 선례와 일관되고, `satisfies (keyof Execution)[]` 패턴은 컴파일 타임 실증까지 남긴 견고한 신규 관용구다. commit 메시지는 conventional commits 형식을 정확히 따르고, plan frontmatter·RESOLUTION.md 는 각각 `plan-lifecycle.md §4`·developer SKILL §RESOLUTION schema 의 필수 요건을 모두 충족한다. Critical/Warning 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
