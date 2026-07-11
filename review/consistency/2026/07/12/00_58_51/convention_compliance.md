# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- Target: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
- 참고: `spec/5-system/` 는 이번 PR diff 에 포함되지 않음(`git diff origin/main -- spec/5-system/` 무출력). 실제 코드 변경은
  `codebase/backend/src/modules/knowledge-base/{embedding,graph}/*.service.ts`·`websocket/websocket.service.ts` 의
  `emitEvent` 시그니처를 `event: string` → `event: KbEventType` 로 좁혀 union 밖 이벤트명을 컴파일타임 차단하는
  behavior-preserving 리팩터. 따라서 본 검토는 target spec 문서에 대한 standing audit 성격이며, 코드 diff 는
  10-graph-rag.md/8-embedding-pipeline.md 가 이미 문서화한 `KbEventType` 11종(embedding 6 + graph 5)과
  1:1 로 정확히 일치함을 확인했다(`document:graph_started/_progress/_completed/_retry/_failed`, graph 에는
  `_error` 없음 — 문서·코드 양쪽 동일 서술).

## 검토 방법

target 두 파일이 인용하는 `spec/conventions/*.md` 를 실제로 열어 교차 검증했다: `audit-actions.md`,
`error-codes.md`, `node-output.md`(§3.2), `swagger.md`(§1-4·§2-5·§5·§6), `spec-impl-evidence.md`(frontmatter
lifecycle), `migrations.md`(+ `codebase/backend/migrations/README.md` §1) , `secret-store.md`(§Rationale R5).
아래는 그 중 실제로 확인한 항목.

## 발견사항

- **[INFO]** API URL 중첩 깊이 규약(`2-api-convention.md §2.2`)의 예외 목록이 실제 관행보다 좁음
  - target 위치: `1-auth.md §5` API 엔드포인트 표 — `POST /api/auth/2fa/webauthn/register/options`,
    `.../authenticate/verify`, `.../recovery-codes/regenerate` 등 (auth 리소스 기준 4~5 세그먼트, `:id` 없음)
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` "중첩은 2단계까지 / 3단계 이상은 최상위로 분리" +
    거기 열거된 "RPC-style sub-channel action" 예외(`/api/{resource}/{id}/{channel}/{action}`, 예시는 모두
    `:id` 를 포함)
  - 상세: WebAuthn 엔드포인트들은 `:id` 없이 `auth/2fa/webauthn/<action1>/<action2>` 형태로 §2.2 가 명시한
    예외 패턴(요구: 중간에 `:id`)과 정확히 일치하지 않는다. 다만 이는 **1-auth.md 만의 문제가 아니라
    시스템 전역의 기존 관행**이다 — 같은 문서 안의 `/api/auth/2fa/setup`, `/api/auth/oauth/:provider/callback`,
    그리고 다른 도메인의 `/api/users/me/email-change/verify`, `/api/users/me/sessions/revoke-others`,
    `/api/integrations/oauth/install/cafe24/:install`(5 세그먼트) 등 다수가 이미 같은 정도로 깊게 중첩되어
    있으나 §2.2 예외 목록에 등재되지 않았다. 즉 실제 코드/스펙 관행이 문서화된 규칙보다 넓다.
  - 제안: target 문서 수정이 아니라 **규약 갱신**이 적절 — `2-api-convention.md §2.2` 의 예외 조항을
    "`:id` 유무 무관, 하위 action 네임스페이스 계층이 REST 리소스가 아닌 절차형 흐름(2FA/OAuth/이메일 변경 등)을
    표현할 때" 로 일반화하거나, 최소 대표 사례를 예시에 추가해 명문화를 권장. target 문서 자체를 바꿀 필요는
    없다(오래된 광범위 기존 관행이며 이번 diff 와 무관).

## 교차검증 상세 (위반 없음 확인)

다음은 실제로 대조했고 **위반이 발견되지 않은** 항목이다 (근거 확보 차원에서 기록):

1. **`audit-actions.md`** — `1-auth.md §4.1` "현재 구현된 액션"/"Planned" 표가 컨벤션 §3 "도메인별 분류
   레지스트리" 와 자구까지 정확히 일치 (`integration.*`, `user.*` 과거분사, `auth_config.*`/`model_config.*`
   현재형 예외, `execution.re_run`/`workspace.transfer_ownership` 도메인 고유 동사, `workspace.deleted`
   구조적 배제 등). 토큰 구분자(언더스코어) 규칙도 전 항목 준수.
2. **`error-codes.md`** — §3 historical-artifact 레지스트리의 `invitation_*`/`forbidden`/`rate_limited`
   (lower_snake_case, "초대 API 한정") 등재가 `1-auth.md §1.5.4` 각주와 정확히 대응. §1 의미 기반 명명·§2
   rename 안정성 정책과 `1-auth.md` 의 `REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`/`PASSWORD_REQUIRED`
   등 UPPER_SNAKE_CASE 코드 전부가 원칙 위반 없이 §1.2.1(3-error-handling.md) 공용 카탈로그에 등재 확인.
3. **`node-output.md` §3.2** — `code` UPPER_SNAKE_CASE 원칙 SoT 확인, `error-codes.md` 가 재선언하지 않고
   위임하는 구조와 일치.
4. **`swagger.md`** — §2-5/§5/§6 의 "비-페이징 고정 컬렉션 `{ data: { items } }` pass-through" 규칙이
   `1-auth.md §5` `GET /api/auth/2fa/webauthn/credentials` 응답 서술과 정확히 일치. §1-4 닫힌 union/열린 map
   구분 규칙은 target 문서에 해당 패턴이 없어 적용 대상 아님.
5. **`spec-impl-evidence.md`** — `1-auth.md` frontmatter(`status: partial` + `pending_plans:
   plan/in-progress/spec-sync-auth-gaps.md` 실존 확인)·`10-graph-rag.md` frontmatter(`status: implemented`
   + `code:` 글로브)가 §2/§3 스키마·라이프사이클 규칙 준수. `## Overview` → 본문 → `## Rationale` 3섹션 구조
   양쪽 모두 확인(`10-graph-rag.md` 의 `## Overview (제품 정의)` 변형은 `spec/5-system/`·`spec/4-nodes/` 전역에서
   10회 이상 쓰이는 기존 정착 패턴이라 이탈 아님).
6. **`migrations.md` + `codebase/backend/migrations/README.md` §1** — `1-auth.md` Rationale 1.4.G 의
   "V058 을 NOT VALID+VALIDATE 2-step 이 아닌 단일 statement 로 작성한 이유"가 README §1 의 예외 인정 조건
   (append-only, 신규 enum 값 addition, 락 영향 평가)과 정확히 대응하며, README 는 이 사례를 자신의 예시로
   직접 인용(`spec/5-system/1-auth.md §1.4.G`) — 양방향 정합 확인. 실제 마이그레이션 파일(`V025`, `V026`,
   `V027`, `V037`, `V058`)도 명명 규약(snake_case descriptor, 단조 증가 V번호) 그대로 존재.
7. **`secret-store.md` §Rationale R5** — `1-auth.md` Rationale "Production fail-closed 가드" 의
   `ENCRYPTION_KEY` 설명이 secret-store.md R5 와 상호 인용·정합.
8. **KB WebSocket 이벤트 union** — 이번 diff 대상 코드(`KbEventType`, 11종)가 `10-graph-rag.md §KB-GR-OB-02`·
   `8-embedding-pipeline.md` 의 이벤트 표와 정확히 일치(`_error` graph 미보유 서술 포함).

## 요약

`spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 는 `spec/conventions/**` (audit-actions, error-codes,
node-output, swagger, spec-impl-evidence, migrations, secret-store)와 명명·출력 포맷·문서 구조·API 문서 규약
전반에서 매우 정밀하게 정합되어 있으며, 여러 항목이 상호 인용까지 정확히 맞물려 있다(마이그레이션 README ↔
1-auth §1.4.G, secret-store §R5 ↔ 1-auth Rationale, error-codes §3 ↔ 1-auth §1.5.4 등). 이번 PR 의 실제 코드
변경은 spec/5-system/ 문서를 건드리지 않는 순수 타입-안전성 리팩터이며 기존 문서화된 WebSocket 이벤트 계약과
1:1 일치한다. 유일하게 표면화한 항목은 `2-api-convention.md §2.2` 의 URL 중첩 깊이 예외 목록이 WebAuthn 등
다수의 기존 관행보다 좁게 쓰여 있다는 점으로, target 문서의 결함이라기보다 시스템 전역에 걸친 오래된 규약
문서화 공백(INFO)이다.

## 위험도

NONE
