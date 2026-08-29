# 보안(Security) 코드 리뷰

## 리뷰 범위 요약

이 변경은 eslint 10 의 `preserve-caught-error` recommended 룰 대응이다. 실질 동작 변경은 두 곳뿐이다:

- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` — `resolveString` catch 블록에 `cause: err` 부착 (주석만 추가, 코드는 이전 라운드에 이미 부착됨 — 이번 diff 는 §6.3.1 참조 주석 정리)
- `codebase/backend/src/nodes/data/code/code.handler.ts` — 컴파일 예외 rethrow 에 `cause: err` 부착 (마찬가지로 주석 정리)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — **코드 변경 없음**, `cause` 를 의도적으로 **비부착**하는 이유를 설명하는 주석만 재정리
- 두 `*.spec.ts` 파일 — 주석 재정리(설명 요약 제거, 정본 spec 참조로 대체)
- `plan/in-progress/deps-peer-gating-and-eslint10.md` — 코드 아님, 작업 추적 문서

## 검증 절차 (뮤테이션 없이, 저장소 read-only 로 수행)

이 리뷰는 "`cause: err` 부착이 안전하다"는 코드 주석의 주장을 실제로 검증했다:

1. `grep -rn "\.cause" codebase/backend/src` (spec 제외) → 결과는 `telegram-client.ts:92` 단 1건이며 이 PR 과 무관.
2. `resolveConfig`/`handler.execute` 를 호출하는 모든 상위 catch 블록(`execution-engine.service.ts` 전수)이 `err.message` 만 읽는다 — `.cause` 를 읽거나 전개(spread)하는 지점 없음.
3. `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts`)도 `exception.message`/`resp.message` 만 사용하고 `.cause` 를 다루지 않음. 매핑되지 않은 내부 `Error` 는 오히려 완전히 마스킹된 `UNHANDLED_ERROR_MESSAGE` 로 치환된다(CWE-209 대응).
4. `@workflow/expression-engine` 의 `errors.ts` 를 직접 열어 `ExpressionError` 계열이 실제로 `message`/`name` 외에 어떤 속성을 갖는지 확인.

결론: 저장소 전체에서 `cause` 를 소비하는 지점이 없으므로, 오늘 시점에는 두 곳의 `cause: err` 부착이 실제 정보 노출 경로를 만들지 않는다. `secret-resolver.service.ts` 가 `cause` 를 **의도적으로 비부착**한 판단도 근거가 맞다(§6.3.1 C1 불성립 — crypto 에러 상세를 일부러 감추는 자리이므로 `cause` 를 달면 그 추상화가 무의미해진다. `#814` SSRF 메시지 일반화 선례와 정합).

## 발견사항

- **[INFO]** `cause` 비민감성 근거(C2) 문구가 `ExpressionError` 의 실제 형태보다 좁게 읽힌다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (`resolveString` catch 블록의 `cause` 부착 주석, "C2 — 표현식 평가 예외라 message·name 밖 속성이 없다"), 동일 문구가 `expression-resolver.service.spec.ts` 의 테스트 주석에도 미러됨
  - 상세: `codebase/packages/expression-engine/src/errors.ts` 의 `ExpressionError` 는 실제로 `message`/`name` 외에 `code: ErrorCode`(public readonly) 와 `position?: number`(public readonly) 두 속성을 더 갖는다. 즉 C2 의 "message·name 밖 속성이 없다"는 서술은 엄밀히는 사실이 아니다. 다만 `code` 는 열거형 문자열(`EXPR_REFERENCE_ERROR` 등)이고 `position` 은 표현식 문자열 내 오프셋(숫자)이라 — 둘 다 이미 사용자가 작성한 표현식 범위 안의 정보이며 secret/PII 가 아니다. 오늘 시점 실질 노출 위험은 없다(위 검증 절차에서 확인한 대로 `.cause` 를 읽는 소비자 자체가 없음). 다만 이 주석은 "정본 기준을 이 자리가 어떻게 만족하는가"를 정확히 서술하는 것이 목적이라고 스스로 밝히고 있어(§6.3.1 을 재서술하지 않고 이 자리의 근거만 적는다는 설계 의도), 그 근거 자체가 부정확하면 다음 사람이 `ExpressionError` 에 민감한 필드(예: 평가 중이던 원본 값, 스택 일부)를 추가할 때 "속성이 없다"는 잘못된 전제 위에서 `cause` 안전성을 재확인 없이 그대로 믿을 수 있다.
  - 제안: 문구를 "message·name 밖에 **민감한** 속성이 없다(code: 열거형, position: 표현식 내 오프셈 — 둘 다 비민감)"처럼 정확하게 좁히거나, `ExpressionError` 에 향후 필드가 추가될 때 이 C2 판단을 재확인하도록 spec §6.3.1 Rationale 에 "ExpressionError 확장 시 재검토" 캐너리 문구를 남기는 것을 권장.

- **[INFO]** `cause` 부착 안전성이 "아무도 `.cause` 를 읽지 않는다"는 전역 부재(negative) 불변식에 의존
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:320` 부근(`throw new Error(...,{cause: err})`), `codebase/backend/src/nodes/data/code/code.handler.ts:458` 부근(동일 패턴)
  - 상세: 두 곳 모두 안전성 근거가 "다운스트림에서 `.cause` 를 직렬화/소비하는 곳이 없다"는 현재 상태의 관측이다. 이 프로젝트 자체 회고(`feedback_documented_guarantee_wider_than_built`)가 지적하듯, 이런 부재 주장은 코드베이스가 커지면서 조용히 깨질 수 있다 — 예를 들어 향후 누군가 관측성(APM/구조적 로깅) 목적으로 `Error` 를 `JSON.stringify(err, Object.getOwnPropertyNames(err))` 형태로 직렬화하는 유틸을 추가하면, `cause` 는 스펙상 열거형(enumerable) 데이터 프로퍼티라 그 안의 원본 에러(`ExpressionError`/`isolated-vm` 의 cross-realm `SyntaxError`)까지 함께 실릴 수 있다. 오늘 시점엔 그런 소비자가 없음을 grep 으로 확인했으므로 취약점은 아니다.
  - 제안: 이미 계획 문서가 "테스트로 잠갔다"고 밝힌 대로 두 spec 파일의 회귀 테스트는 "cause 가 존재/원본을 포함한다"만 검증한다. 여기에 더해 (스코프 밖 제안이라 이번 PR 필수 아님) `GlobalExceptionFilter` 또는 공용 에러 직렬화 유틸에 "cause 를 클라이언트 응답에 노출하지 않는다"는 회귀 테스트를 한 곳에 두면, 향후 직렬화 유틸 추가 시 이 불변식이 깨지는 순간 RED 로 잡을 수 있다.

- **[INFO]** `secret-resolver.service.ts` 의 `cause` 비부착 판단은 정확 — 별도 조치 불요
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:100`(`throw new Error('Secret decryption failed')`, eslint-disable 병행)
  - 상세: 이 자리는 C1(message 가 원문을 담는가)이 성립하지 않는 유일한 사례라는 주석 근거가 코드와 일치한다. `resolve()` 위쪽의 `logger.error` 가 `ref` + `workspaceId` 만 남기고 plaintext/원본 crypto 에러 상세를 로그에도 남기지 않는 것(SS-SE-05)까지 확인했다. `#814` SSRF 메시지 일반화 선례(노드 에러가 Activity API 로 사용자에게 노출된다는 전제)와 정합하며, `deleteByPrefix` 의 LIKE 메타문자 거부(입력 자체 거부, 이스케이프 아님) 등 인접 코드도 이번 diff 범위 밖이지만 여전히 안전한 상태로 유지되고 있다.

## 요약

이번 변경은 eslint 10 `preserve-caught-error` 룰 대응을 위한 `cause` 부착/비부착 판단과 그 근거 주석을 정본 spec(`spec/5-system/3-error-handling.md §6.3.1`)에 정렬시키는 문서·주석 정리가 핵심이며, 실질 런타임 동작 변경은 두 catch 블록에 `cause: err` 를 다는 것으로 이미 이전 라운드에 반영되어 있었다. 저장소 전체를 grep 하여 `.cause` 를 읽거나 직렬화하는 소비자가 없음을 직접 확인했고, `GlobalExceptionFilter` 도 `.message` 만 다뤄 클라이언트에 노출되는 표면은 이번 변경으로 넓어지지 않는다. `secret-resolver.service.ts` 가 crypto 에러 상세를 감추기 위해 `cause` 를 의도적으로 비부착한 판단도 근거가 정확하다. 유일한 지적은 안전성 근거 주석의 정밀도(§6.3.1 C2 문구가 `ExpressionError` 의 `code`/`position` 부가 속성을 "없다"고 과장 서술)와, 그 안전성이 "아무도 cause 를 안 읽는다"는 검증되지 않은 전역 불변식에 의존한다는 점인데, 둘 다 오늘 시점 실제 노출 경로가 없어 실질 위험도는 낮다. 인젝션·하드코딩 시크릿·인증/인가·암호화 알고리즘·의존성 관련 새 이슈는 발견되지 않았다.

## 위험도
LOW
