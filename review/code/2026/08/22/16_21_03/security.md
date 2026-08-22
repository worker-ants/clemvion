# Security Review — backend-redact-depth-boundary

## 발견사항

없음 (검토 대상 diff 는 시크릿 마스킹 로직 자체를 바꾸지 않는다).

- **[INFO]** 실제 코드 변경은 테스트 전용이며 운영 코드(`sanitize-error-message.ts`)는 변경되지 않음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (전체 diff)
  - 상세: `git diff --stat origin/main...HEAD -- codebase/` 로 확인한 결과 이번 변경셋에서 `codebase/` 하위 유일한 변경 파일은 `sanitize-error-message.spec.ts` 뿐이다. `deepRedactSecrets`/`deepRedactCore` 등 실제 마스킹 구현(`sanitize-error-message.ts`)은 수정되지 않았다. 나머지 변경은 `plan/**` 문서 이동(in-progress → complete)과 이전 리뷰 라운드 산출물(`review/code/16_07_45/**`, `review/consistency/15_35_56/**`)이며 둘 다 텍스트 문서로 실행 코드가 아니다.
  - 제안: 해당 없음 — 정보 확인용.

- **[INFO]** 새로 추가된 경계 테스트가 fail-closed 방향을 명시적으로 검증함
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:328` (`'[경계] 그 자리의 비밀 문자열은 여전히 가려진다 — fail-closed 방향'`), `:377` (`'[회귀] 매우 깊은 입력에서도 던지지 않고, 상한 지점에서 잘린다'`)
  - 상세: 구현 확인(`codebase/backend/src/shared/utils/sanitize-error-message.ts:270`, `if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;`)상 상한 깊이 초과 시 서브트리를 통째로 마스킹 마커로 치환하는 fail-closed 동작이며, 새 테스트는 이 동작을 (a) 깊이 5000 입력에서 `RangeError` 없이, (b) 정확히 `MAX_REDACT_DEPTH` 지점에서 마스킹되는지 함께 단언한다. 이전 테스트(`not.toThrow()`만 확인)보다 강화됐고, 값 검사(문자열 패턴)가 깊이 검사보다 먼저 수행되어 상한 지점의 비-비밀 리터럴은 보존되는 순서도 명시적으로 커버한다 — 이 순서가 뒤집히면(깊이 검사가 먼저면) 정상 입력까지 마스킹 마커로 덮여 하류의 "재제출 마커 거부" 로직(PR #1188/#1189)이 정상 입력을 오탐 거부할 수 있는데, 새 테스트가 이 회귀를 잡아낸다. 상한 자체도 리터럴이 아니라 SoT(`MAX_REDACT_DEPTH` → `@workflow/masked-markers` 의 `MAX_MASK_DEPTH`)를 import 해 사용하므로 상수가 이동해도 테스트가 추종한다.
  - 제안: 없음 — 긍정적 방향의 하드닝. 스택 오버플로(DoS) 회귀 방지 테스트(깊이 5,000)도 포함되어 있어 무제한 재귀로 인한 서비스 거부 가능성을 커버한다.

- **[INFO]** 테스트 픽스처의 비밀 유사 문자열은 명백한 가짜 값
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (예: `Bearer sk-DEEP-END`, `sk-LEAF-1`)
  - 상세: 파일 전체를 확인한 결과 `sk-DEEP-END`, `sk-LEAF-1`, `sk-live-abc123.DEF-456` 등은 기존 스위트 전반에서 재사용되는 자리표시자 패턴이며 실제 발급된 자격증명 형식(예: 실제 OpenAI/Stripe 키 포맷)과 일치하지 않는다. 하드코딩된 시크릿에 해당하지 않는다.
  - 제안: 없음.

## 요약

이번 변경셋은 `deepRedactSecrets` 의 재귀 깊이 상한 경계를 고정하는 backend 테스트 추가(`sanitize-error-message.spec.ts`)와 두 plan 문서의 in-progress→complete 이동, 그리고 이전 리뷰 라운드 산출물(`review/code`, `review/consistency`) 커밋으로 구성된다. 보안에 실질적 영향을 주는 운영 코드(마스킹/재제출 가드 로직)는 이번 diff 에서 변경되지 않았고, 추가된 테스트는 오히려 기존의 vacuous 한(25겹 중첩으로 "언젠가 멈춘다"만 보던) 회귀 테스트를 상한 값 자체·연산자 방향(`>=` vs `>`)·값-우선 검사 순서·스택 오버플로 방지까지 정밀하게 고정해 시크릿 마스킹 fail-closed 보장을 강화하는 방향이다. 인젝션·인증/인가·하드코딩된 시크릿·평문 전송·에러 처리 노출 등 다른 관점에서 새로 도입된 취약점은 발견되지 않았다.

## 위험도

NONE
