# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-change-password-code-alignment.md`

## 검토 대상 및 방법

target 은 `plan/in-progress/spec-draft-change-password-code-alignment.md` (spec draft, `--spec` 모드).
`spec/conventions/error-codes.md`(전문 로드) 를 1차 근거로, `spec/conventions/audit-actions.md`·
`spec/conventions/swagger.md`·`.claude/skills/project-planner/SKILL.md`·`.claude/docs/plan-lifecycle.md`
를 보조로 대조했다. 추가로 target 이 인용하는 실제 spec 라인(`1-auth.md:339/521/750`,
`3-error-handling.md:50/66/67/70`, `9-user-profile.md:147`, `error-codes.md §3/§5`)과
`plan/in-progress/auth-change-password-oauth-only-code-split.md` 의 사용자 결정 기록을 저장소에서
직접 열어 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. INFO 2건만 아래에 기록한다.

- **[INFO]** §5 머리말 "코드베이스에서 완전 제거" 전제의 최초 예외 케이스
  - target 위치: "결정 ② … `§5 전제 하나가 이 행에서는 성립하지 않는다`" 절, 변경안 #10
  - 관련 규약: `spec/conventions/error-codes.md §5` 머리말 — "구 코드는 더 이상 발행되지 않으며(**코드베이스에서 완전 제거**)"
  - 상세: target 은 이 전제가 `INVALID_PASSWORD` 행에서는 안 맞는다는 것(문자열이 `login_history.failure_reason` 감사값으로 존속)을 스스로 정확히 짚어내고, 행 단위 각주로 명시하기로 했다(변경안 #10). 다만 §5 는 A/B 두 등급이 이미 있는데도 "레이어가 달라 계속 산다" 는 3번째 성격의 각주는 **아직 §5 의 어떤 행에도 선례가 없다** — 이 행이 첫 사례다. §5 머리말 자체는 wire 발행 기준으로 읽으면 여전히 참이라 CRITICAL/WARNING 은 아니지만, 다음에 비슷한 "레이어가 다른 잔존값" 행이 또 생기면 그때도 각 행에 산발적으로 각주를 다는 대신 §5 머리말에 한 문장 caveat 을 추가하는 편이 §3 의 `WORKER_HEARTBEAT_TIMEOUT`/`AbortError` 항목이 이미 쓰는 "레이어가 다르다" 패턴과 정합적이다.
  - 제안: target 은 지금 그대로 진행해도 무방(등재 자체는 §5 grade B 조건을 정확히 충족). 여력이 되면 변경안에 §5 머리말 한 문장 caveat 추가를 옵션으로 덧붙이는 정도.

- **[INFO]** §2 "의미 분기 시 새 코드 신설" 문구와 target 의 "신규 코드 0" 선택의 관계가 §2 본문에는 아직 명문화돼 있지 않음
  - target 위치: "결정 ① … **새 코드를 만들지 않는다**" 단락
  - 관련 규약: `spec/conventions/error-codes.md §2` — "의미가 분기되거나 새 조건이 생기면 새 코드를 신설한다"
  - 상세: target 은 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 조건이 실제로 갈린다는 것을 근거로 삼으면서도, §2 문구가 기대하는 "새 코드 신설" 대신 **형제 흐름이 이미 쓰는 기존 코드를 재사용**한다. target 의 근거(§1 "구현 세부·전이적 맥락을 이름에 박지 않는다" + "PASSWORD_* 근접 명명 3→4종 증가 방지")는 타당하고 §5 grade B 절차도 정확히 따랐으므로 위반이라 보긴 어렵다. 다만 §2 본문 자체는 "분기 시 신설"만 적혀 있어, 이번처럼 "이미 존재하는 형제 코드로 흡수"하는 경로는 §2 문구만 읽으면 예상되지 않는다.
  - 제안: target 수정은 불필요. 규약 쪽에서 §2 에 "단, 동일 의미의 코드가 형제 흐름에 이미 존재하면 신설 대신 그 코드를 채택해 근접 명명 증식을 막는다" 류의 한 문장을 추가하면, 이번 결정이 향후 유사 사례의 명시적 선례가 된다(지금은 §5 grade B 표의 개별 행 서술에만 근거가 있다).

## 교차 검증 메모 (규약 준수 관점에서 확인된 항목 — 발견사항 아님)

- 파일명 `plan/in-progress/spec-draft-change-password-code-alignment.md` 는 `project-planner/SKILL.md` §작업워크플로 3 의 `spec-draft-<name>.md` 명명과 정확히 일치.
- frontmatter 3필드(`worktree`/`started`/`owner`) 충족 + `spec_impact` 가 YAML 리스트(Gate C 형식) — `plan-lifecycle.md §4` 준수.
- 본문 끝 `## Rationale` 존재 — SKILL.md §3 요구 충족(spec draft 는 3섹션 대신 `## Rationale` 만 의무).
- 제안 코드 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 신설 없이 기존 `UPPER_SNAKE_CASE` 코드를 재사용 — `error-codes.md §1` 표기 규칙·§2 안정성 정책과 충돌 없음.
- `error-codes.md §3` 행 제거 → `§5` 신설이라는 target 의 절차는 §3 말미 각주("교체·은퇴된 구 코드의 rename 이력은 §5 에 둔다")가 이미 지시하는 정확한 경로.
- grade B 판정 근거(워크스페이스 JWT 내부 REST, 저장소 grep 미발견, 사용자 결정 요구)는 §5 grade B 정의와 축자적으로 일치. "두 번째 B" 주장도 실측(§5 표에 현재 `INVALID_INPUT` 1건만 존재) 과 일치.
- `1-auth.md:339/521/750`, `3-error-handling.md:50/66/67/70`, `9-user-profile.md:147` 라인 인용은 실제 파일 내용과 대조해 정확함.
- `auth-change-password-oauth-only-code-split.md` 의 "사용자 결정(2026-09-02) — 형제와 완전 정렬" 체크박스가 실제로 존재 — target 의 근거 인용이 조작이 아님.
- `swagger.md §2-4` 는 401 응답을 코드별이 아니라 `@ApiUnauthorizedResponse` 로 뭉뚱그려 문서화하므로, target 이 Swagger/DTO 데코레이터 변경을 변경안에 포함하지 않은 것은 정확 — API 문서 규약(점검관점 4) 위반 아님.
- `audit-actions.md` 관련 액션명(`user.password_changed`) 은 이번 변경으로 건드리지 않음 — 명명 규약(점검관점 1) 위반 없음.
- `password-and-sessions.mdx` 는 `codebase/frontend/src/content/docs/...` 하위 파일이라 target 이 이를 "developer 턴" 인계 목록에 둔 것은 CLAUDE.md 의 `spec/` vs `codebase/` 역할 분리와 일치.

## 요약

target 은 `spec/conventions/error-codes.md` §1(의미 기반 명명)·§2(rename 안정성)·§3(historical-artifact 등록부)·§5(Retired codes, grade A/B) 의 메커니즘을 정확히 이해하고 그 절차 그대로(§3→§5 이관, grade B 등재, 사용자 결정 인용) 변경안을 구성했다. 인용한 spec 라인·plan 결정 기록도 저장소 실물과 대조해 모두 정확했고, Swagger/audit-actions 등 무관 규약에는 손대지 않아 범위도 정확하다. plan 파일명·frontmatter·`## Rationale` 종결 구조도 `project-planner/SKILL.md`·`plan-lifecycle.md` 요구사항을 그대로 충족한다. CRITICAL/WARNING 급 규약 위반은 발견되지 않았고, INFO 2건은 target 이 이미 인지하고 각주로 처리한 §5 전제의 예외적 층위 및 §2 문구와 재사용 결정 사이의 (규약 문서 쪽에서 보강하면 좋을) 여백을 짚은 것으로, target 수정을 강제하지 않는다.

## 위험도

NONE
