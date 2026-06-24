# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `sanitizeToolError` 함수가 내부 예외 메시지를 첫 줄 200자로 잘라 WS/UI/outputData 에 노출
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `sanitizeToolError` 함수 및 `runProviderTool` 내 catch 블록
  - 상세: `sanitizeToolError` 가 예외 메시지의 첫 줄 최대 200자를 반환해 LLM tool_result content 에 직접 포함된다. 내부 에러 메시지 첫 줄이 DB 연결 문자열이나 내부 호스트명을 포함하지 않는다는 보장이 구현체에는 없고 주석 의도에만 의존한다. 반면 서버 로그에는 `err.message` 전체를 `Logger.warn` 으로 기록하고 있어 서버 측 보존은 적절하다.
  - 제안: 허용 패턴 allowlist(예: 알려진 비즈니스 에러 코드 prefix) 기반 필터나, 에러 분류 타입(provider-level 공개 에러 vs raw 예외)을 구분해 첫 줄 pass-through 의 신뢰 범위를 좁히는 방어 레이어 추가 검토. 현재 구조에서 당장 CRITICAL 은 아니나, provider 구현체마다 다를 수 있는 예외 메시지 형태에 의존하는 점을 추적할 것.

- **[INFO]** `FORM_SUBMITTED_GUIDANCE_MESSAGE` — `message` 필드 하드코딩 경계가 주석에만 명시
  - 위치: `ai-turn-executor.ts` — `FORM_SUBMITTED_GUIDANCE_MESSAGE` 상수 및 JSDoc
  - 상세: JSDoc 이 사용자 입력(formData/userMessage)은 `data` 필드에, `message` 에는 절대 합성하지 않는다는 보안 경계를 명시하지만 코드 경로 검증 없이 주석에만 의존한다. 이번 변경 범위에서 직접 위반 없음.
  - 제안: `message` 필드를 설정하는 모든 코드 경로에서 해당 필드가 상수에서만 대입됨을 단위 테스트로 고정하는 것을 권장한다.

- **[INFO]** `capFormDataBytes` — 비-string 필드에 byte cap 미적용
  - 위치: `ai-turn-executor.ts` — `capFormDataBytes` 함수, 비-string 분기
  - 상세: 비-string 필드(number/boolean/array/object)에 매우 큰 배열이 들어오면 cap 이 작동하지 않는다(`stringFields.length === 0` 분기에서 formDataTruncation 메타만 부착하고 실제 truncate 없음). LLM context window 폭주 가능성이 남아 있다. 이번 변경 범위 밖의 기존 이슈.
  - 제안: 비-string 필드도 serialized bytes 기준 단일 cap 을 적용하거나, 배열 원소 수에 하드 한도를 별도로 두는 방어 보강 검토.

- **[INFO]** `toolCallCount` 버그픽스(condition 미합산) — 보안 영향 없음
  - 위치: `ai-turn-executor.ts` — `recordMultiTurnNonProviderToolResults`, diff `-toolCallCount++`
  - 상세: 이번 핵심 변경인 `toolCallCount++` 제거는 condition 도구 비합산으로 spec 에 수렴시키는 버그픽스다. condition 도구는 provider/외부 호출을 수행하지 않는 내부 deferral 신호이므로 maxToolCalls budget 우회 악용 위험 없음.
  - 제안: 해당 없음.

## 요약

이번 변경(`fix(ai-agent): W7 SPEC-DRIFT`)은 multi-turn condition tool 의 `toolCallCount` 미합산 통일, `TOOL_BUDGET_EXCEEDED_ERROR` 상수 추출, Date.now() 이중 호출 단일 캡처, JSDoc 경로 수정으로 구성된다. 변경 자체에서 새로운 보안 취약점은 발견되지 않는다. 기존 코드에 있던 `sanitizeToolError` 첫 줄 pass-through 패턴과 비-string 필드 byte cap 미적용은 이번 변경과 무관한 선재 이슈로 INFO 수준으로 기록한다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 알려진 취약 의존성 사용 등은 이번 변경 범위에서 식별되지 않는다.

## 위험도

NONE
