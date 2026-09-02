# 정식 규약 준수 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

대상: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` (spec draft — WS 소켓 수명을
토큰 수명에 종속, `--spec` 모드)

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 준수 근거 (참고용 — 교차 확인한 항목)

- **파일 명명** — `plan/in-progress/spec-draft-<slug>.md` 패턴은 이미 4개 형제 문서
  (`spec-draft-eia-62-waiting-payload.md` 등)가 쓰는 확립된 관행과 일치. `spec-sync-*` 와도
  구분됨.
- **frontmatter 스키마** — `worktree`/`started`/`owner` 3필드 모두 존재
  ([`plan-lifecycle.md §4`](.claude/docs/plan-lifecycle.md) 요구). `owner: planner` 는 §4 스키마
  예시(`# planner / developer / 사용자 본인 등`)에 등장하는 값 그대로이며, 같은 날 작성된
  형제 문서 `spec-draft-ws-wontdo-maintenance-appping.md` 도 동일 값을 씀. `spec_impact:` 는
  Gate C 상 `complete/` 이동 시점 의무 필드이나, 4개 형제 draft 전부가 착수 시점부터 선언하는
  것이 이 클러스터의 기존 관행이라 조기 선언 자체는 위반이 아님(YAML 리스트 형태로
  [`feedback_spec_impact_gate_c_list`] 요구도 충족).
- **필드 명명 (`expiresAt`, ISO 8601)** — 신설 payload 필드 `expiresAt: string`은 대상 spec
  문서 자신의 기존 `auth.refreshed.expiresAt`(§1.3 won't-do 예시, `:64`)과
  `startedAt`/`finishedAt`(§Rationale "요소별 절대 발생 시각")뿐 아니라
  [`spec/conventions/node-output.md:255-259`]의 `_resumeCheckpoint.expiresAt`/`_retryState.expiresAt`
  (TTL, ISO 8601)과도 표기가 일치한다. 동명 필드가 다른 의미를 가리키는 경우 §4.6 표에 뜻을
  명시하겠다는 draft 의 계획은 [`spec/conventions/error-codes.md` §4.1 "레이어 주의"] 가 요구하는
  "동명이의 필드는 사용 계층을 명시" 관행과 같은 방향이다.
- **이벤트 명명** — `auth.token_expired` 는 §2.1 이 규정하는 `<네임스페이스>.<액션>` 형태를
  이미 만족하며(변경 대상 아님), `<도메인>EventType` enum 접두 규약
  ([§Rationale "WS 이벤트 enum 명명", `:1228`])과도 충돌 없음(코드 레벨 enum 이름은 draft 범위
  밖 — "구현 메모" 절에서 명시적으로 제외).
- **테이블·caveat 서식** — `# | 위치 | 변경` 표 형식, "—" no-op 행, `> **비채택 (won't-do)**`/
  `> **구현 현실**` 스타일 blockquote 관행은 대상 spec 문서 본문 전반 및 형제 draft
  (`spec-draft-ws-wontdo-maintenance-appping.md`)와 일치.
- **Rationale ID 관행** — `R-ws-socket-lifetime-binds-token` 신설은 기존 `R-wontdo-rawws-rest`·
  `R-wontdo-maintenance-appping` 처럼 본문에서 `§Rationale `R-xxx`` 형태로 역참조되는 이미 확립된
  패턴을 따름.
- **금지 항목 미위반** — draft 는 이 결정을 위해 새 `spec/conventions/*.md` 파일을 만들지
  않는다. 대상 문서 자신의 §Rationale(`:1228` 근방)이 "적용 범위가 한 모듈뿐인 규칙은
  conventions/ 신설이 아니라 로컬 Rationale 로 남긴다"고 이미 명문화한 원칙과 같은 방향이며,
  `swagger.md`가 금지하는 "빈 껍데기 스키마"·`additionalProperties` 남용 패턴도 이 draft 의
  범위(WS 이벤트, DTO 아님)에 해당하지 않음.
- **역할 경계** — "구현 메모 (developer 트랙 — 본 draft 범위 밖)" 절로 구현 착수를 명시적으로
  분리해 CLAUDE.md 의 planner/developer 쓰기 경계를 스스로 준수.

## 요약

이 draft 는 명명(파일·이벤트·payload 필드)·frontmatter 스키마·문서 서식(표·blockquote·
Rationale ID)·역할 경계 어느 축에서도 `spec/conventions/**` 또는 CLAUDE.md 의 정식 규약과
충돌하지 않는다. 오히려 `expiresAt` 필드명·ISO 8601 표기·Rationale ID 참조 패턴 등 여러
지점에서 기존 확립된 관행을 적극적으로 재사용하고 있어 규약 준수도가 높다. `spec/conventions/`
전체(약 280개 파일, cafe24/makeshop 카탈로그 제외)에서 이 변경과 직접 충돌하는 항목은 발견되지
않았다.

## 위험도

NONE
