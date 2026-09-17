# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-trigger-lock-gaps.md`

검토 대상: trigger-config advisory lock 관련 spec draft (planner 6건: A~D 변경안, `spec/2-navigation/2-trigger-list.md` · `spec/conventions/redis-keys.md` · `spec/5-system/15-chat-channel.md` · `spec/data-flow/11-workflow.md` 대상).
`spec/conventions/**` 전체 번들(예산 초과분은 truncated) + 실제 target 4개 spec 파일 원문 + 관련 코드(`trigger-config-lock.ts`, `execution-engine.service.ts`, migrations)를 대조해 검증했다.

## 발견사항

- **[WARNING]** plan frontmatter `worktree:` 가 규약 스키마·전 선례와 다른 full-path 형태 — 실측으로 audit 도구 오탐 확인
  - target 위치: frontmatter `worktree: .claude/worktrees/spec-trigger-lock-gaps-836689` (파일 최상단)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — 스키마 주석이 `worktree: <task_name>-<slug>  # 이 plan 이 살아있는 worktree **디렉토리 이름**` 이라고 명시(전체 경로가 아니라 basename). CLAUDE.md 가 이 문서를 plan frontmatter 스키마의 SoT 로 지정하므로 "문서 구조 규약(CLAUDE.md 의 명명 컨벤션)" 점검 범위에 든다.
  - 상세: `plan/in-progress/*.md` 34개 파일 전수 조사 결과, `worktree:` 값이 `.claude/worktrees/` 접두를 포함한 파일은 본 target 이 유일하다(나머지는 모두 `<slug>` bare 형태, 예: `harness-changeset-exclusion`, `eia-r8-cache-scope-4ae434` 등). 실측: `.claude/hooks/_lib/plan_guard.py` 의 `_normalize_worktree_value()` 는 leading path 를 벗겨내 정상 매칭하므로 push-gate(plan_guard) 자체는 영향 없음. 그러나 `.claude/tools/plan-stale-audit.sh` L133 은 `sed`로 원문 그대로를 추출해 정규화 없이 `-d ".claude/worktrees/$wt_value"` 로 존재를 검사한다 — 이 값이 `.claude/worktrees/spec-trigger-lock-gaps-836689` 이면 검사 경로가 `.claude/worktrees/.claude/worktrees/spec-trigger-lock-gaps-836689` 로 이중 접두되어 실제로 살아있는 worktree 인데도 `MISSING` 으로 오판정된다(직접 재현: `wt_status=MISSING`). 도구 자체는 "informational only" 라 push 를 막지는 않지만, 이 plan 이 나중에 체크박스를 다 채우면 `DONE? ORPHAN?` 오탐까지 이어질 수 있다.
  - 제안: `worktree: spec-trigger-lock-gaps-836689` (bare slug) 로 정정한다. 다른 33개 in-progress plan 과 표기를 통일하면 `plan-stale-audit.sh` 오탐도 함께 해소된다.

- **[INFO]** §4.3 cascade 표 신설 행의 "연관 엔티티" 컬럼이 기존 행과 다른 방향(상류/원인)을 담는다
  - target 위치: 변경안 A3, `spec/2-navigation/2-trigger-list.md §4.3 cascade 동작` 표에 삽입되는 첫 행 — `연관 엔티티` 칸에 "**상류** — `workflow`·`workspace` 삭제"
  - 위반 규약: 명시적 `spec/conventions/**` 항목은 없음 — 같은 표 안에서의 열 의미 일관성 이슈(약한 구조 권고 수준)
  - 상세: 기존 5행(`schedule`, `execution.trigger_id`, `auth_config_id`, notification 채널, interaction 토큰)은 모두 **"트리거 삭제 시 하류로 무엇이 영향받는가"** 를 담는데, 신설 행은 반대로 **"트리거가 상류(workflow/workspace) 삭제로 인해 어떻게 사라지는가"** 를 담아 열의 의미축이 반전된다. `§4` 제목("삭제 정책")·`§4.3` 제목("cascade 동작")이 트리거 삭제 관점으로 서술돼 있어, 표를 훑는 독자가 "연관 엔티티=삭제 대상" 으로 오독할 여지가 있다. draft 는 굵게 "**상류**" 라벨로 구분해 최소한의 disambiguation 은 해 두었다.
  - 제안: 컬럼 헤더를 바꾸거나(예: `연관 엔티티 (방향)`), 표 바로 위에 "이 표는 트리거 삭제의 하류 영향과 트리거가 삭제되는 상류 원인을 함께 담는다" 한 줄을 추가해 방향 전환을 명시하면 좋다. 정식 규약 위반은 아니므로 blocking 사유는 아니다.

## 점검했으나 위반 없음 (참고)

- **frontmatter `code:` 인라인 YAML 주석** (A1, `2-trigger-list.md`) — `spec/conventions/spec-impl-evidence.md §2.1` 은 2026-09-06 이전엔 이 패턴이 `review_guard._parse_frontmatter_code` 파서를 깨뜨렸다고 기록하지만, 그 파서는 이후 고쳐져 안전하다고 명시한다. 실제로 같은 파일(`2-trigger-list.md`)의 기존 `code:` 리스트에 이미 동일 패턴(`# 시행 코드 — …` 등)이 여러 번 쓰이고 있어(15~26행), A1 의 추가는 그 정본 선례를 그대로 따른 것 — 위반 없음.
- **`redis-keys.md §4` 배치** (B1) — advisory lock 키(`trigger-config:<id>` · `exec-cap:<...>`)는 Postgres 전용이라 Redis 를 경유하지 않는다. §4 는 정확히 "형태는 비슷하나 Redis 를 경유하지 않는 것" 을 위한 절이라 분류가 정확하다. 표 컬럼(`이름`/`실체`/`SoT`)·"·" 로 복수 키 묶기 스타일도 기존 §3·§4 행과 동일 패턴.
- **anchor 링크 정합성** — draft 가 인용하는 모든 헤딩 앵커(`2-trigger-list.md#3-api`, `#43-cascade-동작`, `#44-결과에러`, `15-chat-channel.md#5411-...`, `4-execution-engine.md#8-동시-실행-제한` 등)를 실제 헤딩과 대조 확인, 전부 일치.
- **사실 근거** — `trigger-config-lock.ts` 소비자(triggers.service.ts · chat-channel-binder.service.ts · schedules.service.ts), `exec-cap:${workspaceId ?? execution.workflowId}` 키 조합, cafe24 advisory lock 기각 사유(§9.6 인용문), `REFERENCES workflow(id)` 마이그레이션 10건(CASCADE 9 · SET NULL 1) 전부 코드/마이그레이션 원본과 대조해 정확함을 확인 — Rationale 의 "기각된 대안" 서술도 실제 코드 주석(`4-integration.md` L1444 상당)과 일치.
- **plan frontmatter 필수 3필드** (`worktree`/`started`/`owner`) — 존재. `spec_impact` 4개 경로 전부 실재 spec 파일과 일치.

## 요약

정식 규약(`spec/conventions/**`) 관점에서는 이 draft 가 제안하는 4개 spec 파일 변경안(A~D) 자체는 명명·출력 포맷·문서 구조·API 문서 규약을 위반하지 않는다 — `code:` 인라인 주석, `redis-keys.md §4` 배치, 앵커 링크가 모두 기존 선례·현재 파서 상태와 일치함을 코드 대조로 확인했다. 유일한 실질적 결함은 draft 문서 **자신의** plan frontmatter `worktree:` 필드가 전 선례(33/33)와 다른 full-path 형태를 써서 `plan-stale-audit.sh` 를 오탐시키는 것이며(push-gate 인 `plan_guard.py` 는 정규화로 안전), 부수적으로 §4.3 cascade 표 신설 행의 방향 축 전환이 약한 가독성 이슈로 남는다. 두 건 모두 draft 가 제안하는 spec 본문 내용 자체의 결함이 아니라 draft 문서의 메타데이터/표현 층 문제다.

## 위험도

LOW
