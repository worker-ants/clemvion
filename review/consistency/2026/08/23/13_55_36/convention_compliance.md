STATUS=success convention_compliance review complete
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep)

## 검토 범위 메모

프롬프트 번들은 `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md` 만
전문이 실렸고 나머지 15개 파일(`4-execution-engine.md` 등)은 컨텍스트 예산 초과로 절단됐다.
`spec/conventions/**` 쪽도 `egress-masking.md`·`audit-actions.md`(+ cafe24 카탈로그 2개)만
전문이고 `error-codes.md`·`node-output.md`·`swagger.md`·`secret-store.md` 등은 절단됐다 —
이 파일들은 저장소에서 직접 `Read` 해 대조했다. 절단된 `spec/5-system/*` 는 "내용이 없다"의
근거로 삼지 않았고, 이번 라운드에서 실제 diff 가 없는(= 이번 작업 `masking-gate-consolidation`
이 아직 spec 을 건드리지 않은) 파일들이라 위험은 낮게 잡았다.

실제 작업(`plan/in-progress/masking-gate-consolidation.md`)의 spec 영향 범위는
`spec/conventions/egress-masking.md §3` 문장 정정 1건뿐이며, 코드 변경은
`executions.service.ts`/`background-runs.service.ts` 리팩터(동작 무변경)다. 아래는 현재
번들에 실린 문서들이 `spec/conventions/**` 를 얼마나 따르는지에 대한 baseline 점검이다.

## 발견사항

- **[WARNING] API URL 중첩 2단계 규칙과 `/api/auth/2fa/webauthn/...` 계열의 불일치**
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` (`/api/auth/2fa/webauthn/register/options`,
    `.../authenticate/verify`, `.../recovery-codes/regenerate` 등 다수)
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` "중첩은 2단계까지" + 유일하게 문서화된
    예외 "RPC-style sub-channel action" 패턴(`/api/{resource}/{id}/{channel}/{action}`, **`{id}` 필수**)
  - 상세: `/api/auth/2fa/webauthn/register/options` 는 `auth/2fa/webauthn/register/options` 로
    세그먼트 5단계이며 `{id}` 를 포함하지 않아 §2.2 가 명시한 예외 패턴과도 형태가 다르다.
    `/api/auth/2fa/webauthn/credentials/:id` 도 `:id` 이전에 이미 4단계(`auth/2fa/webauthn/credentials`)다.
    §2.2 규칙 자체가 리소스 CRUD 중첩(`/knowledge-bases/:id/documents`)을 염두에 둔 문구라 auth
    흐름의 액션 네임스페이스에 그대로 적용하기 애매하지만, 현재 문서에는 이 케이스를 위한 명시적
    carve-out 이 없다 — 규칙과 실제 카탈로그 사이에 문서화되지 않은 간극이 있다.
  - 제안: 코드 변경은 불필요(엔드포인트는 정상 동작 중). `2-api-convention.md §2.2` 에 "인증
    흐름처럼 리소스가 아닌 액션 네임스페이스는 중첩 제한에서 제외" 같은 명시 예외 문구를
    추가해 규칙-실제 간극을 닫는 것을 제안한다(스펙 갱신 쪽이 적절 — `project-planner` 소관).

- **[INFO] `2-api-convention.md` 에 `## Overview` 섹션 표제가 없음**
  - target 위치: `spec/5-system/2-api-convention.md` 최상단 (제목 → 관련 문서 blockquote → `---` → 바로 `## 1. 기본 원칙`)
  - 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
  - 상세: 같은 번들의 `1-auth.md`·`3-error-handling.md`·`egress-masking.md`·`audit-actions.md` 는
    모두 명시적 `## Overview` 절을 갖고 있는데 `2-api-convention.md` 만 없다(관련 문서
    blockquote 로 대체된 형태). "권장" 규정이라 CRITICAL 은 아니며, 문서 끝에는 `## Rationale`
    절이 정상적으로 존재한다.
  - 제안: `## 1. 기본 원칙` 앞에 짧은 `## Overview` 절 신설(다른 문서들과의 구조 일관성).
    이번 작업 범위 밖이므로 급하지 않음 — 후속 spec 정리 시 반영 권장.

## 정합성 확인 (문제 없음 — 교차검증 근거로 기록)

- `1-auth.md §1.5.4`·§Historical-artifact 표기(`lower_snake_case` invitation/워크스페이스
  코드군)는 `error-codes.md §3` 레지스트리 행과 문자열 단위로 정확히 일치(코드 목록·HTTP·근거 모두).
- `1-auth.md §4.1` 구현/Planned 액션 목록은 `audit-actions.md §3` 도메인별 분류 레지스트리와
  1:1 대응하며 시제 분류(§2.1/§2.2/§2.3)도 어긋남 없음.
- `egress-masking.md` 는 스스로 선언한 "마커 리터럴을 적지 않는다" 규칙을 실제로 지킨다
  (`VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER` **이름**만 등장, 값 리터럴 grep 0건).
- `egress-masking.md` ↔ `node-output.md §Principle 7`(echo 금지 backstop) 상호 포인터가 양쪽
  다 착지한다(`node-output.md` 314~326행이 egress-masking 을 SoT 로 명시 역참조).
- `egress-masking.md`·`audit-actions.md` 모두 Overview / 본문 / Rationale 3섹션 구조를
  완전히 갖췄고, `id`/`status`/`code:` frontmatter 도 CLAUDE.md·`spec-impl-evidence.md` 관례를 따른다.
- `error-codes.md` §4.2(`masked_value_resubmitted` → `MASKED_VALUE_RESUBMITTED`)는
  `egress-masking.md` SoT 표가 가리키는 위치와 정확히 일치 — 재제출 거부 코드 정규화 경로에
  대한 두 문서의 서술이 갈라지지 않는다.
- 이번 작업이 예고한 `egress-masking.md §3` 트리거 문장 정정은 (plan 문서 기준) **표 자체를
  건드리지 않고 산문만 고치는 방식**이라 §3 이 스스로 규정한 "좌표계 표는 사람이 갱신" 원칙과
  충돌하지 않는다 — 아직 미집행이라 이번 라운드에서 실제 편집을 검증하지는 못했다(다음 라운드에서
  실제 diff 로 재확인 필요).

## 요약

번들에 전문이 실린 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 와
`spec/conventions/egress-masking.md`·`audit-actions.md` 는 정식 규약(명명·출력 포맷·문서
구조·API 문서·금지 항목) 대부분을 정확히 따르고 있으며, 특히 에러 코드·감사 액션 명명은
conventions 레지스트리와 완전히 대조 가능한 수준으로 교차 링크돼 있다. CRITICAL 급 위반은
발견하지 못했다. 발견한 두 항목(auth 엔드포인트 중첩 규칙 간극, `2-api-convention.md`
Overview 절 부재)은 모두 이번 `masking-gate-consolidation` 작업 범위 밖의 기존 상태이며 급박한
차단 사유는 아니다. 컨텍스트 예산으로 절단된 12개 `spec/5-system/*` 파일과 대부분의
`spec/conventions/*`(error-codes·node-output·swagger·secret-store 등)는 직접 저장소 파일을
읽어 교차 대조했고 이상을 발견하지 못했으나, 전수 검토는 아니므로 절단분에 대한 결론은
잠정적이다.

## 위험도

LOW
