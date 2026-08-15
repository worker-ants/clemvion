# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 방법

- diff-base `origin/main` 대비 이번 라운드가 손댄 부분(§6 `durationMs` 종결 3종 구현·§12 re-run URL 정정·
  `spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` union nullable 화)을 중심으로 `spec/conventions/**`
  대조. 프롬프트 번들이 예산 초과로 `spec/conventions/**` 본문 전부(271개)를 생략했으므로, HEAD 워크트리를
  절대경로로 직접 `Read`/`grep`해 대조했다(`error-codes.md`·`spec-impl-evidence.md`·`node-output.md` 등).
- 코드 대조는 HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)
  기준 — `git diff origin/main...HEAD` 로 실제 변경 파일을 확정한 뒤 grep/Read.
- 직전 라운드(`10_52_07/convention_compliance.md`)가 문서 전체를 훑어 "발견 없음"으로 닫았으므로, 본 라운드는
  그 이후 diff(주로 `durationMs` 구현)에 집중해 새로 도입된 편차만 추가로 찾았다.

## 발견사항

- **[WARNING]** 신설 `terminal-duration.ts` 가 어떤 spec frontmatter `code:` 에도 매칭되지 않는다
  — `spec-impl-evidence` 컨벤션의 evidence 사슬이 이 파일에 대해서만 끊겨 있음
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (파일 상단) · §6 필드
    집합 표 `durationMs` 행(§6, 이번 diff로 "미구현 (Planned)" → "구현됨" 전환) · §6.5 신설 `durationMs`
    캐비엇 블록
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1(적용 대상)·§2(frontmatter 스키마 `code:` 필드
    정의 — "본 spec 이 약속한 surface 의 구현 경로")·R-1(Rationale, 글로브 stale/미매칭 갭은
    `/spec-coverage` reverse-evidence Gate D 가 보완하는 알려진 약점으로 명시)
  - 상세: 이번 diff 로 `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 파일)가 도입됐다.
    이 파일의 최상단 JSDoc 이 스스로 "SoT: `spec/5-system/14-external-interaction-api.md` §6 필드 집합
    표"라고 선언하며, `resolveTerminalDurationMs`/`TERMINAL_DURATION_MS_SQL`/`PG_INT4_MAX` 가 바로 §6
    `durationMs` 행("구현됨")과 §6.5 캐비엇("취소 경로 5곳 중 4곳은 raw UPDATE 에서 SQL 로 계산…")이
    서술하는 그 구현 자체다. 그런데 이 경로는 `14-external-interaction-api.md` 의 `code:` 목록
    (`external-interaction/**` · `strip-external-only-fields.ts` · hooks/triggers 일부 · web-chat 2개)
    어디에도 매칭되지 않는다. 프로그램적으로 전체 `spec/**/*.md` frontmatter `code:` 를 fnmatch 로
    대조했으나 **어떤 spec 도 `codebase/backend/src/shared/utils/terminal-duration.ts` 를 커버하지
    않는다** — `4-execution-engine.md` (`code: … shared/execution-resume/** …`, `shared/utils/` 는 없음),
    `14-execution-history.md` (`executions.service.ts` 개별 파일만 명시)도 마찬가지. 실제 호출부는
    `execution-engine.service.ts`/`retry-turn.service.ts`(→ `4-execution-engine.md` 의 `execution-engine/**`
    글로브로 이미 커버됨, 문제 없음)와 `executions.service.ts`(→ `14-execution-history.md` 로 이미
    커버됨, 문제 없음)이므로 **누락은 `terminal-duration.ts` 단일 파일**로 좁혀진다. `status: partial`
    가드(`spec-code-paths.test.ts`)는 "≥1 매치"만 요구해 build 는 깨지지 않지만(다른 항목이 이미
    매치), evidence 사슬의 의도(제품 surface ↔ 구현 경로 1:1 추적, 텔레그램 chat-channel 영구 누락
    재발 방지가 이 컨벤션의 존재 이유)는 이 파일에 한해 비어 있다. 같은 브랜치의
    `plan/in-progress/eia-terminal-payload.md` 재판정 ④ "spec 동반 변경 (전수)" 표가 §6 표·§6.5·
    형제 문서 6곳까지 촘촘히 나열했음에도 frontmatter `code:` 항목은 그 표에 없었다 — 이 plan 이
    반복 겪은 "동반 변경 누락" 패턴의 또 다른 사례로 보인다.
  - 제안: `14-external-interaction-api.md`(§6 의 계약 SoT — 코드 자체가 이곳을 SoT 로 자칭) 와
    `4-execution-engine.md`(실제 호출부 다수) 중 최소 한 곳의 `code:` 에
    `codebase/backend/src/shared/utils/terminal-duration.ts` 를 명시적으로 추가한다 — `strip-external-only-
    fields.ts` 가 `14-external-interaction-api.md`·`6-websocket-protocol.md` 양쪽에 개별 파일로 등재된
    선례와 동일 패턴. developer 권한(`spec/` read-only) 밖이므로 반영은 project-planner 턴 필요.

## 요약

`spec/5-system/14-external-interaction-api.md` 는 (직전 라운드가 확인했듯) 명명·출력 포맷·문서 구조·
Swagger 규약 전 축에서 `spec/conventions/**` 를 촘촘히 준수하며, 이번 diff(§6 `durationMs` 종결 3종
구현, §12 `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run` 정정)도 이 궤적을 벗어나지
않는다 — 특히 §12 정정은 `2-api-convention.md §1`("버전은 URL 경로에 미포함") 위반을 실제로 **바로잡는**
방향이고, 실제 컨트롤러(`executions.controller.ts:258 @Post(':id/re-run')`)와도 일치함을 코드로
확인했다. `durationMs` 의 `number | null` 부재 표현(§5.4 부재 표현 관례와 동형, `error.code` 형제
필드와 일관)·`chat-channel-adapter.md` union 타입 동반 갱신도 규약과 어긋나지 않는다. 다만 이번 diff 가
도입한 신규 구현 파일 `terminal-duration.ts` 가 `spec-impl-evidence.md` 가 요구하는 "spec ↔ 코드"
frontmatter 증거 사슬 어디에도 걸리지 않는 갭 1건을 새로 발견했다 — build 를 깨뜨리지 않는 advisory
성격(WARNING)이지만, 이 파일 스스로가 본 spec 을 SoT 로 자칭하고 있어 방치하면 `/spec-coverage`
reverse-evidence 가 잡아야 할 몫을 늘린다.

## 위험도

LOW
