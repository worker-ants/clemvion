# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 검토 범위

target 문서(배치 A draft, A-1~A-5)가 제안하는 `spec/**`·`CLAUDE.md`·`.claude/skills/**/SKILL.md`
변경안이 `spec/conventions/**` 정식 규약(특히 `error-codes.md`·`secret-store.md`·`swagger.md`·
`spec-impl-evidence.md`·`review-citations.md`)과 CLAUDE.md 의 문서 구조·명명 컨벤션을 따르는지
확인했다. 각 변경안이 삽입되는 대상 spec 파일의 **현재 상태**(frontmatter·인접 텍스트·앵커·enforcement
코드)를 직접 읽어 target 이 인용하는 전제(따옴표 원문, glob 매치, 컬럼명 등)가 실측과 일치하는지도
대조했다.

## 발견사항

- **[WARNING] A-1 변경안이 `project-planner` 에 새로 부여하는 쓰기 권한이 `project-planner/SKILL.md` 자체 표에는 반영되지 않는다**
  - target 위치: `## A-1`, "그리고 표 아래 규칙 목록에 두 줄을 더한다" 이하 블록 (harness 두 축 분리 bullet)
  - 위반 규약: CLAUDE.md 자신의 구조 원칙 — "역할별 워크플로는 `.claude/skills/` 하위 SKILL.md" (역할의
    실제 권한 상세는 그 역할 자신의 SKILL.md 가 SoT) + A-1 항목 자신이 근거로 드는 원칙("역할 정의를
    그 역할 자신이 고치는 것을 막는 경계")
  - 상세: A-1 은 `CLAUDE.md` Skill 표의 **developer** 행과 `developer/SKILL.md` 의 "경로별 권한" 표를
    **양쪽 다** 갱신해 harness `hooks/`·`tools/`·`tests/` 축을 developer 소유로 명시한다(대칭적).
    그런데 같은 변경이 `.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md`(거버넌스 문서) 축을
    **project-planner** 소유로 새로 규정하면서도, 그 사실은 `CLAUDE.md` 의 bullet 한 줄에만 적히고
    `project-planner/SKILL.md` 자신의 "경로별 권한" 표(`spec/**`·`plan/**`·`codebase/**` read-only·
    `review/**` read 넷뿐, `.claude/**` 행 없음 — 실측 확인)에는 반영되지 않는다. 체크리스트도
    `A-1 CLAUDE.md + developer/SKILL.md 동시 갱신`만 적어 `project-planner/SKILL.md` 를 갱신 대상에서
    빠뜨렸다. 이것은 A-1 이 `#1292` 에서 지적된 것과 **같은 형태의 결함**(권한표가 실제 관례/신규
    결정을 반영하지 못해 그 역할 자신이 자기 권한을 알 수 없음)을 project-planner 축에 그대로 재생산한다.
  - 제안: `project-planner/SKILL.md` "경로별 권한" 표에 `.claude/docs/**`, `.claude/skills/**/SKILL.md`,
    `CLAUDE.md` 행(Read/Write — 거버넌스 문서)을 추가하고, 체크리스트 항목을 "`CLAUDE.md` +
    `developer/SKILL.md` + `project-planner/SKILL.md` 동시 갱신"으로 넓힌다.

- **[WARNING] A-5 규범 블록의 컬럼명이 `1-data-model.md §2.1` 표의 기존 명명 레이어(snake_case)와 다른데 그 사실을 명시하지 않는다**
  - target 위치: `## A-5`, "변경안 (a) — `1-data-model.md §2.1` 규범 블록" 인용 텍스트
  - 위반 규약: 없음(명시적 금지 규칙은 아님) — 다만 대상 문서 자체의 확립된 표기 관례와의 내부 일관성
    문제. `1-data-model.md §2.1 User` 표는 `password_hash`·`two_factor_secret`·`totp_recovery_codes`·
    `webauthn_recovery_codes`·`email_verify_token`·`password_reset_token`·`email_change_token` 처럼
    **DB 컬럼 snake_case** 로 필드를 나열한다(실측 — 파일 전체가 이 표기를 일관 사용). 반면 A-5 가
    삽입하는 규범 블록은 같은 7개 필드를 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
    `webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken` (**camelCase**,
    실제로는 `shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS` 배열과 정확히 일치 — 이 점은
    올바르다)로 적는다.
  - 상세: camelCase 선택 자체는 근거가 있다(enforcement 코드가 그 표기를 쓴다). 문제는 **같은 섹션 안에서
    표는 snake_case, 바로 아래 규범 블록은 camelCase 를 아무 설명 없이 병치**한다는 점이다 — 독자가
    "새 필드 7개가 추가됐나"로 오독할 여지가 있다. 이 저장소에는 이미 해소 선례가 있다 —
    `2-trigger-list.md` §2.1 이 `chatChannelHealth` 류를 적으며 "API 응답 시 camelCase. DB 컬럼은
    snake_case(`chat_channel_health` 등 — [Spec 데이터 모델 §2.8])" 라고 레이어를 명시한다. `1-data-model.md`
    자신은 이 문서 전체에서 camelCase 를 언급한 적이 **0건**이라(실측), A-5 가 그 관례를 처음 깨는 자리다.
  - 제안: 규범 블록 서두에 괄호 문구를 추가한다 — 예: "(아래는 API 응답/엔티티 프로퍼티 camelCase 표기다.
    위 §2.1 표의 DB 컬럼(snake_case)과 1:1 대응 — `password_hash` ↔ `passwordHash` 등)". 최소 변경이며
    `2-trigger-list.md` 의 기존 병기 패턴을 재사용하면 된다.

## 준수 확인 (문제 없음으로 판정한 주요 항목)

- **A-3 에러 코드 명명**: 신규/기존 코드 전부 `TRIGGER_ENDPOINT_PATH_CONFLICT` 등 `UPPER_SNAKE_CASE`
  ([error-codes.md §1](../../../../../spec/conventions/error-codes.md)) 준수. `details` 객체 형태
  주장은 실제 구현(`triggers.service.ts:1627`, `{ field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`)과
  일치, `ErrorResponseBodyDto.details` 가 `type: 'object', additionalProperties: true` 로 이미 열려 있어
  DTO 데코레이터 변경 불요라는 주장도 실측과 일치.
- **A-3(b) `§1.10` 카탈로그 등재 패턴**: `3-error-handling.md` §1.7~§1.9 의 "도메인 spec 참조" 형식
  (SoT 링크 + `UPPER_SNAKE_CASE` 각주 + 표)과 동형으로 작성돼 있다.
- **A-4 검증 층 표 확장**: `2-api-convention.md §5.4`·`swagger.md §5-1` 의 현재 원문("두 검증자가
  나눠 맡는다")과 표 컬럼(검증자/대조 대상/시점/못 보는 것)이 target 의 인용·치환 문구와 정확히 일치.
  `user-entity-exposure*.ts`(2/2: `-guard.ts`+`.spec.ts`)·`user-secret-absence*.ts`(2/2) glob 매치
  주장도 실측과 일치하며, `-guard*.ts` 로 좁히면 `.spec.ts` 가 빠진다는 주장도 확인됨(`-guard*.ts` →
  1/2). `code:` 양쪽 문서 등재 관행(`response-contract*.ts` 가 이미 양쪽에 있음)도 그대로 재사용.
- **A-2 프런트매터**: `status: partial` + `pending_plans:` 조합은 [spec-impl-evidence.md §3](../../../../../spec/conventions/spec-impl-evidence.md)
  요구와 일치하고, 지정한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 실존해
  `spec-pending-plan-existence.test.ts` 를 통과한다. `2-trigger-list.md:151` 의 자백(`status: implemented`
  인데 sort/order 미구현)도 실측과 일치.
- **A-2-1/A-2-3/A-2-4 인용 정확성**: R-2 Rationale 원문, R-CC-10 인용문, `6-config.md` Admin+ UI 노출
  규칙(및 `#권한` 앵커), `hasBotToken`/마스킹 placeholder 자기모순 전부 현재 spec 원문과 대조해 정확함을
  확인.
- **review-citations.md 인용 형식**: 문서 본문에 등장하는 bare `hh_mm_ss` 인용(`10_13_23`·`13_06_22`)은
  전부 plan 자체의 설명 산문(코드 펜스 밖, 실제 spec 삽입 블록 밖)에 위치해 [review-citations.md §3](../../../../../spec/conventions/review-citations.md)
  의 "`plan/**` 문서는 대상 아님" 예외에 해당한다 — 실제로 spec 에 삽입될 markdown 블록 안에는 이런
  인용이 섞이지 않았다.
- **문서 구조**: 모든 대상 파일(`2-api-convention.md`·`3-error-handling.md`·`swagger.md`)이 `## Overview`
  (또는 상당 절)·본문·`## Rationale` 3섹션을 이미 갖추고 있고, target 의 삽입 지점은 전부 본문 안(Rationale
  이전)이라 구조를 흐트러뜨리지 않는다. `#### ` 레벨 소제목 신설(A-3)도 같은 문서의 기존 `#### 검증 층…`
  선례와 동형.

## 요약

이 draft 는 `spec/conventions/**` 의 명명·출력 포맷·문서 구조 규약을 대체로 정확히 따르며, 인용하는
원문·glob 매치·컬럼명 등의 전제를 모두 직접 실측으로 대조한 결과 사실 오류가 발견되지 않았다. 다만
두 군데에서 규약 준수의 "완결성"이 비대칭적이다 — (1) A-1 이 harness 권한을 두 역할로 명시적으로
가르면서 developer 축만 그 역할 자신의 SKILL.md 에 반영하고 project-planner 축은 CLAUDE.md bullet
에만 남겨, 이 항목이 고치려는 결함과 같은 형태의 갭을 project-planner 쪽에 재생산한다. (2) A-5 규범
블록이 이미 확립된 문서(`1-data-model.md`)의 snake_case 표기 관례를 설명 없이 camelCase 로 병치해
같은 섹션 안에서 표기 레이어가 갈린다. 둘 다 CRITICAL 은 아니며(자동 가드가 깨지지는 않는다), 같은
턴에서 한두 문장으로 고칠 수 있는 완결성 문제다.

## 위험도

LOW
