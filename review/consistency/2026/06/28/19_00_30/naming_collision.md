# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` (--impl-done, diff-base=origin/main)
실제 변경 파일: `codebase/backend/` 내 4개 파일 + `plan/in-progress/` 내 2개 신규 파일

---

## 발견사항

이번 변경(PR #763 후속 코드 정리 A+B 묶음)이 도입하는 신규 식별자는 아래 3종이다.

### [INFO] `PublicWebhookReqShape` — 신규 named interface, 충돌 없음

- target 신규 식별자: `export interface PublicWebhookReqShape` (`public-webhook-throttle.guard.ts:160`)
- 기존 사용처: 기존 코드베이스에 `PublicWebhookReqShape` 라는 이름은 존재하지 않았다. 기존 `public-webhook-throttle.guard.spec.ts` 에는 `export interface ReqShape` 가 선언되어 있었으나, 이번 변경으로 삭제되고 `type ReqShape = PublicWebhookReqShape` 로 대체되었다.
- 상세: `PublicWebhookReqShape` 는 같은 파일에 이미 있던 `PublicWebhookReqExtension` 을 extends 하는 새 인터페이스다. `ReqShape` 라는 이름은 테스트 파일 내부 비공개 타입 별칭으로만 남아 있어 외부에 노출되지 않는다. `PublicWebhookReqExtension` 이 hooks.controller.ts 에서 import 되어 쓰이고 있으므로 같은 파일에 선언된 새 인터페이스와의 관계도 명확하다.
- 제안: 충돌 없음. 기존 `ReqShape export` 는 삭제되어 잠재적 export 혼선도 해소되었다.

### [INFO] `UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE` — private static 상수, 충돌 없음

- target 신규 식별자: `private static readonly UNKNOWN_ERROR_MESSAGE`, `private static readonly UNHANDLED_ERROR_MESSAGE` (`http-exception.filter.ts:33, 39`)
- 기존 사용처: 코드베이스에 `UNKNOWN_ERROR_MESSAGE`·`UNHANDLED_ERROR_MESSAGE` 라는 이름을 가진 기존 심볼은 없다. 유사한 `UNKNOWN_ERROR` (에러 코드 문자열 값)가 `foreach-executor.ts` 등 여러 곳에 사용되지만, 이는 에러 코드 식별자이고 신규 상수는 메시지 문자열을 담는 클래스 내부 상수로 성격이 다르다.
- 상세: 두 상수는 `GlobalExceptionFilter` 클래스에 `private static readonly` 로 선언되어 클래스 외부에서 참조 불가하다. `UNKNOWN_ERROR` (에러 코드)와 `UNKNOWN_ERROR_MESSAGE` (메시지 텍스트)는 이름과 역할 모두 구분되어 혼동 가능성이 낮다.
- 제안: 충돌 없음. `private static` 범위 한정으로 외부 노출 없음.

### [INFO] 신규 plan 파일 2종 — 명명 충돌 없음

- target 신규 식별자: `plan/in-progress/webhook-hardening-cleanup.md`, `plan/in-progress/webhook-public-ip-failopen-hardening.md`
- 기존 사용처: `plan/complete/` 에 `auth-config-webhook-followups.md`, `auth-config-webhook-wiring.md`, `spec-draft-auth-config-webhook-wiring.md`, `spec-sync-webhook-gaps.md` 가 있다. `plan/in-progress/` 기존 파일과도 중복되지 않는다.
- 상세: 두 파일 이름이 기존 complete/in-progress 어디에도 존재하지 않으며, 명명 컨벤션(`<topic>-<subject>.md`)을 따른다.
- 제안: 충돌 없음.

---

## 요약

이번 변경(extractClientIp 로컬 래퍼 제거, `PublicWebhookReqShape` named interface 추출, 매직 문자열 상수화, 테스트 격리 패턴 통일)이 도입하는 식별자는 3종이며, 기존 코드베이스·spec·plan 에서 동일 이름을 다른 의미로 사용하는 사례가 없다. `extractClientIp` 이름 자체는 `auth/utils/client-ip.ts` 에 별도 공개 함수로 계속 존재하지만, `hooks.service.ts` 의 동명 로컬 래퍼는 이번에 삭제되어 충돌이 오히려 해소되었다. 신규 식별자 충돌 관점에서 차단 사유가 없다.

## 위험도

NONE

STATUS: DONE
