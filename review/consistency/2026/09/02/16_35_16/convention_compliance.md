# 정식 규약 준수 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 발견사항

- **[INFO]** `worktree:` frontmatter 값이 스키마 문서화 형태를 벗어난 복합 표기
  - target 위치: frontmatter `worktree: plan-in-progress-items-b0c80b (branch claude/ws-token-expired-lifetime)`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>  # 이 plan 이 살아있는 worktree 디렉토리 이름` (디렉토리 이름만 기대)
  - 상세: 값이 디렉토리 이름 뒤에 `(branch claude/ws-token-expired-lifetime)` 를 덧붙인 복합 표기다. `plan-scan.ts`/`plan-stale-audit.sh` 의 파서는 첫 공백까지만 캡처(`[^[:space:]]+`)하므로 build guard·worktree 존재 판정에는 영향이 없고, 같은 날 작성된 형제 draft(`spec-draft-ws-wontdo-maintenance-appping.md`, 이미 적용됨)도 동일 패턴을 쓴다 — 한 물리 worktree 안에서 두 개의 논리적 branch(제안)를 구분하려는 의도된 국지적 관례로 보인다. 다만 `plan-lifecycle.md` 본문은 이 확장 표기를 명시하지 않는다.
  - 제안: 기능상 문제는 없으므로 필수 수정 아님. 이 페어링 패턴(한 worktree, 복수 논리 branch)이 앞으로도 반복될 의도라면 `plan-lifecycle.md §4` 에 "복수 draft 가 한 worktree 를 공유할 때 `(branch …)` 부기를 허용한다" 는 한 줄을 추가해 규약과 실제 사용을 맞추는 편을 권장.

## 검토 요약 (위반 없음으로 확인된 항목)

- **파일 명명**: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` — `project-planner/SKILL.md` §"draft 작성" 의 `spec-draft-<name>.md` 패턴과 정확히 일치 (동일 디렉토리의 8건 이상 기존 draft와 동형).
- **frontmatter 필수 필드**: `worktree`/`started`/`owner` 셋 모두 존재 (`plan-lifecycle.md §4` 충족). `spec_impact` 는 in-progress 단계에서 의무는 아니지만 이미 리스트 형식(`- spec/5-system/6-websocket-protocol.md`)으로 선언돼 있어 완료 시점 Gate C 스키마(`spec-plan-completion.test.ts`)와도 미리 정합함 (bare string·빈 배열 아님).
- **문서 구조**: `## Rationale (본 draft 의 결정 근거)` 가 최종 섹션으로 위치 — `project-planner/SKILL.md` "본문 끝에 `## Rationale` 로 결정 근거 명시" 요건 충족. 대상 spec 파일(`6-websocket-protocol.md`) 자체의 `## Rationale` 아래 하위 결정 항목 명명 패턴(`R-wontdo-rawws-rest`, `R-wontdo-maintenance-appping` — `R-<slug>. <제목> (결정 YYYY-MM-DD)`)과 draft 가 제안하는 신설 항목 `R-ws-socket-lifetime-binds-token` 도 동일 슬러그 규칙을 따름.
- **이벤트/페이로드 명명 (출력 포맷)**: `auth.token_expired` 는 기존 점(dot) 표기 컨벤션 — `data-flow/8-notifications.md:347` 이 "다른 모든 WebSocket 이벤트(`execution.started`, `execution.node.completed`, `auth.token_expired` 등)도 점 표기를 따른다" 고 명시. 신규 페이로드 필드 `expiresAt` 도 문서 전역의 camelCase `*At` 타임스탬프 명명(`startedAt`, `scheduledAt`)과 일치하며, 같은 §4.6 표의 기존 행들처럼 페이로드 컬럼에 타입 주석을 달지 않는 문서 스타일과도 어긋나지 않음.
- **status/frontmatter 라이프사이클**: `spec/conventions/spec-impl-evidence.md §3` 기준으로 대상 spec 은 `partial` (일부 구현 + `pending_plans` 필수) 상태이며, draft 는 "frontmatter 변경 없음 — `status: partial` 유지" 로 명시 — 이 draft 가 다루는 변경은 결정·문서 정정일 뿐 구현 완료가 아니므로 `implemented` 로 성급히 승격하지 않는 판단이 §3.1 전이 규칙과 일치.
- **금지 항목**: 에러 코드 신설·rename(`error-codes.md`), 감사 액션 신설(`audit-actions.md`), Cafe24 카탈로그 동기(`cafe24-api-catalog/`) 등 다른 conventions 가 명시적으로 금지하는 패턴에 해당하는 변경이 target 안에 없음. 구현 세부(타이머 설치·해제 등)는 "구현 메모 (developer 트랙 — 본 draft 범위 밖)" 로 명확히 분리해 project-planner 의 쓰기 권한 경계(`spec/**`, `plan/**`)를 스스로 지킴.

## 요약

target draft 는 명명(파일·이벤트·필드)·문서 구조(Overview 상당 배경/결정 절 + 본문 + 말미 `## Rationale`)·frontmatter 스키마(Gate C `spec_impact` 리스트 포함)·기존 spec 문서 내부 관례(Rationale 서브섹션 슬러그, WS 이벤트 점 표기, camelCase 타임스탬프 필드)를 모두 정확히 재사용하고 있으며, 정식 규약(`spec/conventions/**`) 을 직접 위반하는 패턴은 발견되지 않았다. 유일한 지적은 `worktree:` frontmatter 의 `(branch …)` 부기가 `plan-lifecycle.md` 문면과 정확히 일치하지 않는다는 INFO 수준 사항으로, 빌드 가드는 영향받지 않고 이미 검증된 형제 draft와 동형이라 실질 리스크는 없다.

## 위험도
NONE
