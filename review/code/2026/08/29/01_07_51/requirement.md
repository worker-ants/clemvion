# 요구사항(Requirement) Review

## 발견사항

- **[WARNING]** C2("message·name 밖 속성이 없다") 서술이 형제 파일과 어긋나고, `ExpressionError` 의 실제 shape 과도 맞지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:142`
  - 상세: 이 줄은 "C2 — 표현식 평가 예외라 message·name 밖 **속성이 없다**" 라고 적는다("민감" 한정어 없음). 그런데 바로 그 옆의 형제 구현 파일 `expression-resolver.service.ts:318` 은 같은 조건을 "message·name 밖에 **민감** 속성이 붙지 않는다" 로 적어 두었다 — 한정어 유무가 다르다. 실측하면 후자(구현 파일, 한정어 있음)가 맞고 spec.ts 쪽(한정어 없음)이 틀렸다: `evaluate()` 가 던지는 에러는 전부 `ExpressionError`(및 `ReferenceError`/`TypeError`/`FunctionError`/`TimeoutError`/`DepthExceededError`) 인스턴스이고, 이 클래스는 `message`/`name` 외에 `code: ErrorCode` 와 `position?: number` 를 **own property 로 갖는다**(`codebase/packages/expression-engine/src/errors.ts:14-24`, `evaluator.ts` 의 모든 throw 지점이 이 서브클래스만 사용). 즉 "속성이 없다" 는 문자 그대로는 거짓이고, 실제로 성립하는 건 "그 속성들이 민감하지 않다"(C2 의 spec 원문 그대로) 뿐이다.
  - spec 본문(§6.3.1, `spec/5-system/3-error-handling.md:494`)의 C2 정의 자체는 "message·name **밖의 민감 정보를** 속성으로 들고 있지 않다" 로, "민감" 한정어가 core 조건이다 — 즉 spec 은 정확하고, `expression-resolver.service.ts` 의 주석도 정확하다. 어긋난 것은 `expression-resolver.service.spec.ts:142` 하나뿐이다.
  - 이 PR 자체의 커밋 메시지(`8b92546f5`)가 "요약을 두면 정본이 바뀔 때 갈린다 — 실제로 갈렸다(이 주석이 한때 C1 만 적고 있었다)" 는 걸 발견하고 고치는 것이 취지였는데, 그 수정 과정에서 같은 클래스의 더 미묘한 drift(한정어 탈락)를 새로 하나 심었다. C1/C2 결론(= `cause` 부착이 안전하다) 자체는 여전히 맞다 — `code`/`position` 은 enum 값·문자열 offset 정수라 민감 정보가 아니기 때문이다. 그래서 CRITICAL 이 아니라 WARNING: 실제 보안/동작 회귀는 없지만, 이 주석 5곳의 존재 이유가 "정본과 어긋나면 다음 사람이 잘못 믿는다" 는 것이므로 이 어긋남 자체가 이 PR 의 목적을 정확히 훼손한다.
  - 제안: `expression-resolver.service.spec.ts:142` 를 `expression-resolver.service.ts:318` 과 동일하게 "민감 속성이 붙지 않는다" 로 정정한다(한 단어 추가). spec 문서는 수정 대상 아님 — spec 은 이미 정확하다.

- **[INFO]** C2 는 주석으로만 서술되고 테스트로는 검증되지 않는다 (C1 만 실제로 잠겨 있다)
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:144-159` (`'원본 예외를 cause 로 보존한다'` 테스트)
  - 상세: 이 테스트의 단언은 `thrown instanceof Error`, `cause instanceof Error`, `thrown.message.toContain(cause.message)` 세 개뿐이다. 마지막 단언이 C1(message 가 원본을 포함)을 실제로 검증하는 유일한 지점이고, C2("message·name 밖에 민감 속성이 없다")를 검증하는 단언은 없다(예: `Object.keys(cause)` 나 `cause` 에 `code`/`position` 이상의 필드가 없는지 등). plan 체크리스트(`plan/in-progress/deps-peer-gating-and-eslint10.md:322-327`)는 "주석 대신 테스트로 잠갔다" 고 적어 두었는데, 그건 C1 에는 맞지만 C2 에는 해당하지 않는다 — 지금 이 테스트만으로는 향후 `ExpressionError` 서브클래스가 실제로 민감한 속성(예: 평가 중인 원본 표현식 문자열 전체, 컨텍스트 스냅샷 등)을 추가해도 RED 가 나지 않는다.
  - 현재는 실질적 위험이 없다(`code`/`position` 비민감 확인됨) — 그래서 CRITICAL/WARNING 이 아니라 INFO. 다만 이후 이 클래스에 필드가 늘어날 가능성을 원천 차단하려면 C2 도 회귀 테스트로 고정하는 편이 이 PR 이 지향하는 "주석보다 테스트가 강하다" 원칙과 일관된다.
  - 제안(선택): `ExpressionError` 인스턴스인 `cause` 에 대해 `code`/`position` 을 제외한 추가 키가 없음을 단언하는 캐너리 하나를 추가하거나, 최소한 이 갭을 plan 에 명시.

## 요약

이번 diff 는 순수 주석/문서 변경(6개 파일 중 5개는 `cause: err` 판단 근거 주석을 spec §6.3.1 로 재정렬, 1개는 그 경위를 기록한 plan 문서 addendum)이며 실제 동작(`cause` 부착/비부착 여부, eslint-disable 위치)은 이전과 동일하다. `spec/5-system/3-error-handling.md §6.3.1` 의 C1/C2 정의를 직접 대조한 결과 `expression-resolver.service.ts`(부착)·`code.handler.ts`(부착)·`secret-resolver.service.ts`(비부착) 세 곳의 실제 판정은 spec 과 line-level 로 일치한다. 다만 이 PR 이 고치려던 것과 같은 종류의 결함 — "요약을 여기 적어 두면 정본과 갈린다" — 이 `expression-resolver.service.spec.ts:142` 에 새로 하나 남았다: C2 를 "민감 속성 없음" 이 아니라 "속성 없음" 으로 과잉 일반화했고, 이는 `codebase/packages/expression-engine/src/errors.ts` 가 정의하는 `ExpressionError`(`code`+`position` 보유)와 문자 그대로는 모순된다. 실질적 보안 결론(“cause 부착 안전”)은 `code`/`position` 이 비민감하므로 여전히 유효해 CRITICAL 은 아니지만, 이 주석들의 존재 이유 자체가 훼손되는 지점이라 WARNING 으로 남긴다. 그 외 TODO/FIXME, 반환값 누락, 에러 시나리오 누락 등은 발견되지 않았고 plan 문서의 부수 서술(파일 목록·경로·참조)도 실측과 일치했다.

## 위험도
LOW
