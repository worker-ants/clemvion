# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` (구현 착수 전 검토), scope=`spec/2-navigation/`
대조 대상: `spec/conventions/**` (특히 `error-codes.md` · `audit-actions.md` · `spec-impl-evidence.md` · `swagger.md` · `i18n-userguide.md`)

컨텍스트 예산 초과로 프롬프트 번들에는 18개 파일 본문이 생략돼 있었으나, 전수를 `Read`/`grep`
로 직접 열어 frontmatter·명명·에러 코드·감사 액션·API 엔드포인트를 확인했다. 특히 최근 커밋
(`0a040b96c` "Database·HTTP 연결 테스트가 실제로 접속한다", `cef3687f2`, `4157bc557`,
`73bc0f1c3`)으로 크게 바뀐 `4-integration.md`(1829행)를 diff 기준으로 집중 검토했다.

## 발견사항

- **[INFO]** 화면 spec 다수가 명시적 `## Overview` 헤딩 없이 바로 번호 섹션(`## 1. …`)으로 시작
  - target 위치: `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` ·
    `4-integration.md` · `5-knowledge-base.md` · `7-statistics.md` · `9-user-profile.md` ·
    `10-auth-flow.md` · `11-error-empty-states.md` · `13-user-guide.md` · `15-system-status.md` ·
    `16-agent-memory.md` · `_layout.md` (18개 중 13개, `Rationale` 은 전부 보유)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: "권장" 이지 강제가 아니며, `spec/2-navigation/` 전역(화면-레벨 spec)에서 오래전부터
    일관된 기존 패턴이다(`0-dashboard.md`·`6-config.md`·`14-execution-history.md` 셋만 별도
    `## Overview` 보유). 이번 세션의 diff 가 새로 만든 이탈이 아니라 저장소 전체의 기존 관행이므로
    새 위반으로 보기 어렵다.
  - 제안: 규약을 갱신해 "화면-레벨 spec(`2-navigation/**`)은 라우트/화면 구조 섹션이 Overview 를
    겸한다" 는 예외를 명문화하거나, 그대로 둔다면 재지적 방지를 위해 이 예외를 어딘가(SKILL.md 등)에
    한 줄로 적어 두는 편이 다음 검토자의 반복 지적을 막는다.

- **[INFO]** `13-user-guide.md` 디렉터리 트리 주석에 글로서리 금지어 `엣지` 잔존
  - target 위치: `spec/2-navigation/13-user-guide.md:52`
    (`connecting-nodes # 노드 연결하기 (포트 · 엣지 유효성 · 색상 · stale 정리)`)
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 6 (글로서리·문체) —
    "금지어 (예: '엣지' → '연결선' …) 사용 금지"
  - 상세: 이 규약의 명시 적용 범위는 "사용자 가이드 본문(`content/docs/**`)과 UI 사용자 가시
    한국어 문자열" 이며, 여기 걸린 자리는 그 범위 밖(2-navigation spec 이 가이드 디렉터리 구조를
    설명하는 코드블록 주석)이라 **엄밀히는 이 규약의 직접 적용 대상이 아니다.** 다만 같은 저장소가
    바로 최근(`4157bc557`) 워크플로우 에디터 spec 의 동일 단어를 "금지어 위반" 으로 정정한 선례가
    있어, 표기 일관성 관점에서는 상충된 인상을 준다.
  - 제안: 구속력 있는 위반은 아니므로 조치 의무는 없다. 일관성을 원하면 "연결선" 으로 바꿔도 되고,
    이 자리가 규약 범위 밖임을 확인했다는 사실만 남겨도 충분하다.

- **[INFO]** `IntegrationTestResult.code` 신규 코드 5종(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·
  `HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)은 명명·문서화 모두 규약 준수 확인
  - target 위치: `spec/2-navigation/4-integration.md` §5.3(HTTP)·§5.4(Database)·§11 에러 표·
    Rationale "연결 테스트 — Database · HTTP 는 실제로 접속한다"
  - 근거: `error-codes.md` §1(의미 기반 명명·도메인 prefix)·§2(rename 안정성) 모두 충족 — 의미
    기술적 이름, `DB_`/`HTTP_` prefix, UPPER_SNAKE_CASE. 카탈로그(3-error-handling.md) 미등재는
    새 결함이 아니라 기존 선례(`EMAIL_CONNECT_FAILED`·`EMAIL_HOST_BLOCKED`도 동일하게 미등재)와
    같은 패턴 — `IntegrationTestResult.code` 는 `GlobalExceptionFilter` 에러 봉투(§5.3 API 규약)
    가 아니라 `200 + { success, code }` 커스텀 result shape 라 그 카탈로그 등재 의무 조항의 대상이
    아니다. 실제 swagger 노출 DTO 는 `TestConnectionResultDto`(Dto 접미 준수, `dto/responses/`
    위치 준수)이고 `IntegrationTestResult` 는 내부 TS interface 일 뿐이라 swagger 명명 규약
    대상도 아니다. **위반 없음 — 참고용으로만 기록.**

- 그 외 확인한 항목(위반 없음, 참고용으로만 기록)
  - 감사 액션(`integration.created/updated/deleted/rotated/reauthorized/scope_changed`,
    `auth_config.reveal`)이 `audit-actions.md` §3 레지스트리와 정확히 일치.
  - `4-integration.md` API 엔드포인트 전수(`/api/integrations/**`, RPC-style
    `oauth/begin`·`:id/reauthorize`·`:id/rotate` 등)가 `api-convention.md §2.2` 케밥케이스·
    복수형·RPC 예외 규칙과 일치.
  - frontmatter 전 파일 확인 — `id`/`status`/`code`/`pending_plans` 스키마 준수
    (`spec-impl-evidence.md §2·§3`). `16-agent-memory.md` 의 `id: nav-agent-memory` 는
    `spec/5-system/17-agent-memory.md` 의 `agent-memory` 와 basename 충돌을 피하는 문서화된
    패턴(§2.1) 그대로. `_product-overview.md`/`_layout.md` 는 `_` prefix 로 frontmatter 의무
    면제 대상(§1) — `_layout.md` 가 frontmatter 를 갖고 있어도 문제 없음(의무 아님이지 금지
    아님).
  - `2-trigger-list.md` 의 `pending_plans: [plan/in-progress/spec-draft-nullable-notation-followups.md]`
    실존 확인 — `spec-pending-plan-existence` 가드 통과 형태.
  - `error-codes.md` §3 이 참조하는 `4-integration.md#rationale` 앵커(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED
    코드명 유지 결정`)와 §5.4→§5.5 cross-reference("IntegrationTestResult.code namespace(§5.5)")
    모두 실제 섹션 위치와 일치.

## 요약

`spec/2-navigation/`(18개 파일, 특히 이번 세션에서 크게 개정된 `4-integration.md`)을 정식 규약
관점에서 전수 대조한 결과 CRITICAL·WARNING 급 위반은 발견되지 않았다. 신규로 도입된
연결 테스트 전용 에러 코드 5종은 `error-codes.md` 의 의미 기반 명명·UPPER_SNAKE_CASE·도메인
prefix 규율을 정확히 따르고, `swagger.md` 의 DTO 위치·명명 규약도 위반이 없다. 감사 액션·API
엔드포인트 명명·frontmatter 스키마도 모두 해당 규약과 일치한다. 남은 두 항목(Overview 섹션
헤딩 부재, 글로서리 금지어 "엣지" 잔존)은 각각 저장소 전역의 기존 관행과 규약의 문자적 적용
범위 밖이라는 이유로 INFO 수준에 그친다.

## 위험도

NONE
