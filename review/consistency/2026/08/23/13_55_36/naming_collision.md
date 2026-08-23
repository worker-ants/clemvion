# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위에 대한 메모

prompt 상 target 은 `spec/5-system/` 디렉터리 전체 번들(17개 파일)로 지정돼 있으나, 그중
`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 3개만 본문이 실렸고 나머지 14개는
컨텍스트 예산 초과로 절단되어 있었다. 절단된 파일은 "여기 없다"를 "충돌 없다"의 근거로 삼지
말라는 지시에 따라, 실제 작업 원장(worktree git status)을 대조해 **이번에 실제로 새로 도입된
식별자가 무엇인지**부터 특정했다.

`git status`(이 worktree) 확인 결과 실제 변경분은 다음 4개 파일로 좁혀진다 — 이는
`plan/in-progress/masking-gate-consolidation.md`(마스킹 게이트 4곳을 헬퍼 2개로 통합)의
구현 산출물이다:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규 함수 정의)
- `codebase/backend/src/modules/executions/executions.service.ts` (호출부 교체)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (호출부 교체)
- `spec/conventions/egress-masking.md` (트래커 stale 예고 정정 — 표 자체는 무변경)

즉 이번 target 이 실제로 새로 도입하는 식별자는 spec 요구사항 ID·엔티티·API endpoint·이벤트명·
ENV var·spec 파일 경로가 **아니라**, 백엔드 shared util 의 신규 함수 심볼 2개(+ 이동된 private
헬퍼 1개)로 한정된다. 아래는 그 식별자들과, 점검 관점 1~6 각각에 대한 대조 결과다.

## 신규/이동 식별자 목록 (실측)

| 식별자 | 종류 | 위치 | 상태 |
|---|---|---|---|
| `redactStoredFieldsForResponse` | export function | `redact-stored-error.ts` | 신규 |
| `redactNodeExecutionRow` | export function (generic) | `redact-stored-error.ts` | 신규 |
| `maskIfPresent` | module-private function | `redact-stored-error.ts` | **이동** (`executions.service.ts` 에서 동일 이름·동일 시그니처로 옮겨짐 — 원본은 diff 에서 삭제됨, 중복 아님) |

## 점검 관점별 대조

1. **요구사항 ID 충돌** — 이번 변경은 신규 요구사항 ID 를 부여하지 않는다 (frontmatter `id:`
   변경 없음). `spec/` 전체 `id:` 필드를 전수 대조했으나 중복은 없다 (해당 사항 없음).
2. **엔티티/타입명 충돌** — `redactStoredFieldsForResponse`·`redactNodeExecutionRow` 로
   `codebase/`·`spec/` 전체(backend+frontend)를 grep 했으나 이 두 이름의 기존 사용처는
   이번에 추가된 자리 외에 없다. 같은 파일의 기존 자매 함수 `redactStoredErrorForResponse`·
   `redactStoredDataForResponse` 와도 접두사만 공유할 뿐 겹치지 않는다(신규 함수는 그 위에
   서는 래퍼로, spec/conventions/egress-masking.md 갱신분이 이 관계를 정확히 기술한다).
   `maskIfPresent` 는 `codebase/` 전체에 이 자리 외 사용처가 없다(module-private, 이동 전
   위치의 정의는 diff 에서 함께 제거됨 — 동일 이름 두 곳 동시 존재 아님). 유사 명명
   (`maskSensitiveFields`, `maskValueForLog`, `redactSecrets`, `redactThreadForPublic` 등)은
   모두 기존에 이미 공존하던 이름이며 이번 변경으로 새로 생긴 충돌이 아니다.
3. **API endpoint 충돌** — 이번 diff 는 REST/WS endpoint 를 추가·변경하지 않는다(응답 조립
   내부 구현만 교체). 해당 사항 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경 없음. 해당 사항 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음. 해당 사항 없음.
6. **파일 경로 충돌** — 새 spec 파일 생성 없음(`spec/conventions/egress-masking.md` 는 기존
   파일의 본문 수정). 신규 코드 파일도 없음(기존 `redact-stored-error.ts` 에 함수 추가). 해당
   사항 없음.

## 부가 확인 — 넓은 스캔(스팟체크)

target 이 명목상 `spec/5-system/` 전체이므로, 위 diff 와 무관하게도 다음을 스팟체크했다
(전수 검증은 아님 — 본문이 절단된 14개 파일은 열람하지 못했다):

- `spec/` 전체 frontmatter `id:` 중복 없음(`common` 은 여러 `0-common.md` 가 공유하는 기존
  컨벤션이고, `chat-channel` 중복은 `spec-impl-evidence.md` 의 예시 문구일 뿐 실제 id 충돌
  아님 — 둘 다 기존 상태이며 이번 target 이 새로 만든 문제가 아니다).
- `1-auth.md` §5 의 신규 API 표(WebAuthn·이메일 변경 등)는 `WEBAUTHN_RP_ID` 등 ENV var 가
  이미 `codebase/backend/src/common/config/webauthn.config.ts`·`webauthn.service.ts`·
  `webauthn.controller.ts` 와 일치해 구현과 어긋난 신규 충돌이 없다.
  `/api/users/me/enable-2fa` ↔ `/api/auth/2fa/setup` 같은 legacy alias 도 양쪽 문서가
  "canonical" 포인터로 서로를 참조해 의도된 이중 표기이지 미인지 충돌이 아니다.

## 요약

이번 target 이 실제로 도입하는 신규 식별자는 백엔드 shared util 함수 2개
(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)와 이동된 private 헬퍼 1개
(`maskIfPresent`)로, 전부 단일 파일(`redact-stored-error.ts`) 안에 있고 기존 코드베이스·spec
전반에 동일 이름의 다른 의미 사용처가 없다. 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
ENV var·spec 파일 경로 축에서는 애초에 신규 도입이 없어 충돌 여지가 없다. `spec/5-system/`
전체를 대상으로 한 명목상 스코프에 대해서도 스팟체크(frontmatter id 전수, ENV var, legacy
alias 표기)에서 미인지 충돌을 발견하지 못했으나, 컨텍스트 절단으로 본문을 열람하지 못한 14개
파일(`4-execution-engine.md` 등 대용량 파일 포함)은 이번 회차에서 전수 검증되지 않았다는 점을
남긴다.

## 위험도

NONE
