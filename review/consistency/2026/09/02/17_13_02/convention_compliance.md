# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위에 대한 방법론적 caveat

전달된 `_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 `spec/5-system/` 18개 파일 중
**`1-auth.md` 한 파일만 본문이 포함**되고 나머지 17개(`2-api-convention.md`·`3-error-handling.md`·
`4-execution-engine.md`·`14-external-interaction-api.md` 등)는 "본문 생략됨" 처리되어 있었다.
`spec/conventions/**` 도 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·`category.md` 를
제외한 나머지(`error-codes.md`·`swagger.md`·`node-output.md` 등 규약 SoT 다수 포함)가 동일하게
생략되어 있었다.

프롬프트 지시("여기 없다는 사실을 '해당 내용이 없다' 의 근거로 삼지 말 것")에 따라 아래는 `Read`
도구로 **실제 저장소 파일을 직접 열어** 수행한 검토다:

- 전문 검토: `spec/5-system/1-auth.md`(프롬프트 내 완전 포함분), `spec/5-system/2-api-convention.md`
  (직접 Read)
- 규약 SoT 전문 확인: `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` ·
  `spec/conventions/audit-actions.md`(직접 Read)
- 구조·frontmatter 스캔: `spec/5-system/` 18개 파일 전체(헤딩 존재 여부, frontmatter 스키마)
- grep 표본 점검: 나머지 파일들에서 에러 코드·상태 코드 패턴

`1-auth.md` 이외 파일 본문의 세부 위반은 이 조건 하에서 **놓쳤을 수 있다** — 아래 발견사항은
확인된 것만 적는다.

---

## 발견사항

- **[WARNING] `410 Gone` 상태 코드가 API 규약 §6 표에 미등재**
  - target 위치: `spec/5-system/1-auth.md` §1.5.1(토큰 정책 "만료 시 410 응답")· §1.5.4(에러 응답
    표, `invitation_expired`/`invitation_already_used` → 410) · §5(`GET /api/invitations/:token`
    "만료·invalidated 토큰은 410")
  - 위반 규약: `spec/5-system/2-api-convention.md` §6 "HTTP 상태 코드" 표
  - 상세: `2-api-convention.md` §6 은 200/201/204/400/401/403/404/409/413/422/429/500/503 만
    카탈로그화하고 **410 이 없다**. §5.3 도 "code 의 상태코드별 기본값" 목록에서 410 을 다루지
    않는다. 그런데 410 Gone 은 `1-auth.md`(초대 토큰 만료/사용됨) 뿐 아니라
    `12-webhook.md`(WH-EP-07, 비활성 트리거) · `14-external-interaction-api.md`(EIA-IN-12,
    `EXECUTION_TERMINATED`) · `3-error-handling.md`(`EXECUTION_TERMINATED` 행)에서 **반복적으로
    등장하는 표준 상태 코드**로 이미 4개 문서에 걸쳐 쓰이고 있다. `202 Accepted`(§11.4 webhook 응답)
    도 동일하게 §6 표에는 없다. `2-api-convention.md` §6 은 다른 절(§5.3)이 "기본값 SoT" 로 참조하는
    캐논 테이블 역할을 하는데, 실사용 코드가 빠져 있으면 그 SoT 역할이 불완전해진다.
  - 제안: `2-api-convention.md` §6 표에 `410 Gone`(및 `202 Accepted`) 행을 추가하거나, 표가
    "대표 예시일 뿐 전체 카탈로그가 아님"을 명시적으로 밝힌다. 이는 developer 가 고칠 수 있는
    표현-only 정정 범주가 아니라(요구사항/계약 표는 자기반증형 소정정 예외 §대상 아님) planner
    턴으로 정정하는 편이 맞다.

- **[WARNING] `PASSWORD_INVALID` / `INVALID_PASSWORD` — 단어 순서만 다른 별개 코드**
  - target 위치: `spec/5-system/1-auth.md` §2.3 "재인증 에러 코드" 콜아웃(line 364 부근)과 §5
    "민감 동작 비밀번호 재확인 코드" 콜아웃(line 548 부근)
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명 (핵심 원칙)" — "이름만으로 분기
    의미가 드러난다"
  - 상세: `SessionsService.verifyReauth`(세션 강제 종료·이메일 변경 재인증) 의 비밀번호 불일치는
    `PASSWORD_INVALID`(401) 를 반환하고, `AuthService.verifyPasswordForUser`(2FA 비활성화·WebAuthn
    복구 코드 재발급 등) 의 현재 비밀번호 재확인 실패는 `POST /users/me/change-password` 컨텍스트에서
    `INVALID_PASSWORD`(401) 를 반환한다. 두 코드는 **토큰 순서만 뒤바뀐 사실상 동일 문구**이고, 이름
    자체는 두 흐름의 차이(재인증 vs 비밀번호 변경 확인)를 전혀 드러내지 않는다. `error-codes.md` §3
    historical-artifact 레지스트리에도 이 쌍은 등재돼 있지 않다 — 즉 §1 원칙 위반이면서 예외 등록도
    되지 않은 상태다.
  - 제안: rename 은 breaking change(§2) 이므로 강제하지 않되, 최소한 `error-codes.md` §3 에 "의도적
    분리·유지" 근거를 등재하거나(§3 는 lowercase 뿐 아니라 "부정확/혼동 소지 이름"도 다룰 수 있게
    확장), 두 코드가 왜 통합되지 않았는지를 `1-auth.md` 안에서 한 곳에 모아 명시한다(현재는 두 콜아웃에
    분산돼 있어 대조하지 않으면 유사성이 잘 드러나지 않는다).

- **[INFO] `## Overview` 헤딩 미사용 파일 다수**
  - target 위치: `spec/5-system/2-api-convention.md`·`3-error-handling.md`(§Rationale 는 있으나
    개요는 `## 1. 기본 원칙`) 는 예외로 하고, 특히 `11-mcp-client.md`(`## 1. 개요`)·
    `16-system-status-api.md`(개요 섹션 없이 바로 `## 1. 대상 큐 레지스트리`)·
    `5-expression-language.md`(`## 1. 개요`)·`6-websocket-protocol.md`(개요 없이 `## 1. 연결`)·
    `7-llm-client.md`(`## 1. 개요`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" —
    `## Overview (제품 정의)` / 본문 / `## Rationale`
  - 상세: CLAUDE.md·SKILL.md 는 이 구조를 **"권장"**으로 명시해 강제가 아니다. `1-auth.md` 자체는
    `## Overview`/`## Rationale` 을 정확히 갖춰 완전히 준수한다. 위 6개 파일은 레거시 스타일(`## 1.
    개요` 또는 개요 섹션 부재)이며, `_product-overview.md` 가 이미 PRD 레벨 요구사항을 담당하는
    구조이므로 심각한 위반은 아니다.
  - 제안: 우선순위 낮음. 해당 6개 파일을 건드릴 계기(구현 착수)가 생기면 `## Overview` 헤딩으로
    통일을 고려. 이번 작업 범위에서 강제할 사안은 아니다.

## 준수가 확인된 항목 (참고)

- `1-auth.md` §1.5.4 의 lowercase 에러 코드(`invitation_*`·`forbidden`·`rate_limited`)는
  `error-codes.md` §3 historical-artifact 레지스트리와 **문구·근거·링크가 정확히 일치**한다.
- `1-auth.md` §4.1 의 감사 액션 카탈로그(`integration.*`·`user.*`·`auth_config.*`·`workflow.*`·
  `trigger.*`·`schedule.*`·`model_config.*`)는 `audit-actions.md` §1(dot-prefix)·§2(시제 3분류)·
  §3(도메인별 레지스트리)과 **행 단위로 정합**한다. 언더스코어 토큰 구분자 규칙도 전부 준수.
  `workflow.executed`/`workspace.deleted` 제외 근거도 두 문서가 서로 일치.
- frontmatter(`id`/`status`/`code`/`pending_plans`) 스키마가 `spec/5-system/` 18개 파일 전체에서
  일관되며, `_product-overview.md` 만 frontmatter 가 없는 것도 `spec/` 전역의 `_product-overview.md`
  패턴(2-navigation·3-workflow-editor·4-nodes 등)과 일치하는 정상 패턴이다(PRD 레벨 문서는
  `code:` 매핑 대상이 없음).
- `1-auth.md` §1.4.2/§5 의 응답 봉투(`{ requires2fa, methods, challengeToken }`, `{ enabled:
  boolean }` 등)는 `2-api-convention.md` §5.1/§5.4 의 wrapping·부재표현 규칙과 충돌하지 않는다.
- 실제 codebase(`codebase/backend/src/modules/auth/**/*.controller.ts`)를 표본 확인한 결과
  `@ApiTags`/`@ApiBearerAuth` 누락이나 `swagger.md` §6 이 금지하는 "빈 껍데기 인라인 schema" 패턴은
  발견되지 않았다 — spec 문서가 기술하는 API 표면과 실제 데코레이터 패턴 간 괴리 없음.

## 요약

`1-auth.md`(이번 프롬프트에서 유일하게 전문이 제공된 target)는 정식 규약 준수 수준이 전반적으로
높다 — 특히 `error-codes.md` 의 historical-artifact 예외 레지스트리·`audit-actions.md` 의 시제
taxonomy 를 문구 단위로 정확히 인용하고 있고, 과거 위반(`re_run_initiated`, §3.2 Admin 열 등)을
Rationale 로 self-correct 한 이력도 잘 남아 있다. 발견된 두 WARNING 은 모두 "명백한 위반"이라기보다
규약 자체의 완결성 갭(§6 상태 코드 표에 실사용 코드 누락)과 명명 품질 이슈(순서만 다른 두 에러 코드)로,
차단(BLOCK) 사유는 아니다. 다만 이번 리뷰는 예산 절단으로 `1-auth.md` 를 제외한 17개 target 파일의
본문을 직접 못 봤다는 방법론적 한계가 있으므로, 그 파일들에 대한 "위반 없음" 은 grep 표본 점검
수준의 약한 보증에 그친다.

## 위험도

LOW
