# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 신규 `describe` 블록의 두 단언이 기존 블록의 단언과 완전히 동일하다(내용 중복)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:193-196`(신규, `'입력이 없으면 여전히 null 이다 (빈 객체를 만들지 않는다)'`) vs `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:83-87`(기존, `'null/undefined 는 null 을 돌려준다 — 빈 객체가 아니다'`)
  - 상세: 직접 파일을 읽어 실측 확인 — 두 테스트 본문이 `expect(toTerminalErrorPayload(null)).toBeNull(); expect(toTerminalErrorPayload(undefined)).toBeNull();` 로 바이트 단위까지 동일하다. 마스킹 도입 후에도 null-early-return 불변식이 깨지지 않았음을 "이 파일의 새 관심사(egress 마스킹) 섹션에서 다시 고정"하려는 의도는 커밋 메시지·RESOLUTION.md(`review/code/2026/08/16/09_51_00/RESOLUTION.md` W5)에 명시돼 있어 근거 없는 중복은 아니다. 다만 완전 동일한 단언이 같은 파일 두 곳에 있으면, 향후 `toTerminalErrorPayload`의 null 처리 로직이 바뀔 때 두 블록 중 한쪽만 갱신되고 다른 쪽이 stale 로 남는 drift 위험이 남는다.
  - 제안: 신규 블록의 이 테스트에 "레거시 회귀와 동일 — 마스킹이 이 경로를 건드리지 않음을 확인" 같은 짧은 주석을 남기거나(부분적으로는 이미 `199-201`행 인접 테스트에 유사 의도 주석이 있음), 완전 동일 단언은 상단 공유 스위트를 참조하는 주석만 남기고 제거하는 것을 고려. 강한 조치는 불필요.

- **[WARNING]** 같은 파일 안에서 "optional 키 생략" 관용구가 두 가지 스타일로 혼재
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:148`(기존, 명령형 `if (src.details !== undefined) out.details = src.details;`) vs `codebase/backend/src/shared/utils/terminal-error-payload.ts:100-102`(신규, 조건부 spread `...(p.details === undefined ? {} : { details: deepRedactSecrets(p.details) })`)
  - 상세: 같은 함수 파일 내에서 같은 의미론(§6.4 `details` optional — 값이 없으면 키 자체를 만들지 않는다)을 두 함수(`toTerminalErrorPayload`/`redactTerminalError`)가 서로 다른 코드 스타일로 표현한다. 이전 라운드(`09_51_00` maintainability WARNING)에서 이미 지적됐고 RESOLUTION.md(W6)에서 "강한 요구 아님·기존 `if` 를 건드리면 diff 가 넓어진다"는 근거로 의도적으로 무조치 처리됐다. 여전히 다음 수정자가 "이 파일의 관용구가 무엇인지" 판단할 때 약간의 인지 비용을 만든다.
  - 제안: 조치 불요(이미 검토·기각된 사안). 향후 이 파일을 큰 폭으로 손댈 기회가 있으면 하나로 통일하는 것을 고려.

- **[INFO]** `deepRedactSecrets` 반환값(`unknown`)을 `string` 으로 무검증 타입 단언
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:99` — `message: deepRedactSecrets(p.message) as string,`
  - 상세: `deepRedactSecrets(value: unknown, depth = 0): unknown` 은 현재 구현상 문자열 입력에 문자열을 반환하므로 런타임상 안전하지만, 타입 시스템은 이를 보장하지 않는다. 향후 `deepRedactSecrets` 의 문자열 분기가 확장되면(예: 특수 케이스에서 객체 반환) 이 캐스트가 컴파일 경고 없이 조용히 깨질 수 있다.
  - 제안: 강한 조치 불필요. 캐스트 옆에 "문자열 입력→문자열 출력은 `deepRedactSecrets` 의 런타임 불변식(구조 변경 시 여기도 확인)" 정도의 한 줄 주석을 남기면 향후 리팩터 안전성이 높아진다.

- **[INFO]** 동일 basename(`sanitize-error-message.ts`)의 파일이 두 디렉터리에 존재
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts`
  - 상세: 이번 diff 가 두 파일 모두를 건드리며 서로의 관계("자매 leaf util")를 docstring 으로 상세히 설명해(`terminal-error-payload.ts:1-2`) 혼동을 상당히 완화했지만, 파일 탐색기/에디터 탭에서 basename 만 보고는 어느 파일인지 구분되지 않는 근본 문제는 남아 있다. 신규 도입 문제가 아니라 기존 구조.
  - 제안: 즉시 조치 불요. 추후 대규모 리팩터 시 `modules/execution-engine/sanitize-error-message.ts` 를 예컨대 `sanitize-notification-error-message.ts` 로 개명해 grep 모호성을 줄이는 것을 고려.

- **[INFO]** 신규 함수 `redactTerminalError` 는 JSDoc(약 48줄, `:47-95`) 대비 본문(8줄, `:96-104`) 비율이 매우 높은 "문서 지배적" 스타일
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:47-104`
  - 상세: 코드 자체(spread + 조건부 마스킹)는 단순하지만 "왜 이 위치인가, 무엇을 못 잡는가, 왜 여기서 안 넓혔는가, 왜 조기 반환을 뺐는가"를 설명하는 주석이 훨씬 길다. 이 저장소는 결정 배경을 코드 인접 주석에 남기는 것이 이미 확립된 컨벤션(다수 파일에서 반복 관찰됨)이고, 이 함수는 4~5라운드 리뷰에서 반복 INFO 로 미뤄졌다가 실측으로 뒤집힌 결정을 다루므로 근거를 남겨두는 편이 향후 재지적 방지에 유리하다. 실제 로직을 훑을 때 주석을 오래 스크롤해야 하는 비용만 존재.
  - 제안: 조치 불요(컨벤션 부합). 근거가 더 누적되면 일부를 plan 문서나 spec `## Rationale` 로 옮기고 코드 주석은 포인터만 남기는 것을 고려.

## 요약

핵심 로직 변경은 `terminal-error-payload.ts` 에 egress 초크포인트 `redactTerminalError` 헬퍼 하나를 추가하고 `toTerminalErrorPayload` 의 4개 반환 지점을 일괄적으로 그 헬퍼로 통과시키는 것으로, 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 네이밍(`redactTerminalError`, `deepRedactSecrets` 와 일관된 `redact*` 계열)도 무난하다. 직전 리뷰 라운드(`09_51_00`)가 지적한 항목 중 JSDoc 궤도 이탈(scope WARNING)과 판별력 없는 테스트(testing W7)는 실제로 코드에 반영돼 해소된 것을 직접 파일을 열어 확인했다 — `redactTerminalError` JSDoc 은 `toTerminalErrorPayload` 의 `@param`/`@returns` 블록보다 앞에 위치하고, `code`/`nodeId` 비-마스킹 테스트는 이제 실제로 패턴에 매칭되는 adversarial 값을 쓴다. 남은 항목은 이전 라운드에서 이미 검토되어 의도적으로 무조치 처리된 두 가지 경미한 흠(신규 테스트 블록의 완전 동일 단언 중복, 동일 파일 내 optional-키 관용구 혼용)과 사소한 INFO 관찰(타입 단언, 파일명 중복, 문서 지배적 스타일)뿐이다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
