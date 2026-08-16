# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새로 추가된 `describe` 블록이 기존 블록과 완전히 동일한 단언을 반복한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:184-187` (신규) vs `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:83-87` (기존)
  - 상세: 기존 `describe('toTerminalErrorPayload', …)` 블록의 `'null/undefined 는 null 을 돌려준다 — 빈 객체가 아니다'` 테스트와, 이번 PR 이 추가한 `describe('toTerminalErrorPayload — secret 마스킹 …', …)` 블록의 `'입력이 없으면 여전히 null 이다 (빈 객체를 만들지 않는다)'` 테스트가 본문이 완전히 동일하다(`expect(toTerminalErrorPayload(null)).toBeNull(); expect(toTerminalErrorPayload(undefined)).toBeNull();`). 마찬가지로 `'details 가 없으면 키를 만들지 않는다 (§6.4 optional)'`(신규, :189-191)도 기존 `'details 는 있을 때만 싣는다'`(:32-38) 테스트의 후반부와 검증 대상이 겹친다. 마스킹 래퍼(`redactTerminalError`)를 씌운 뒤에도 null-early-return·details-omission 불변식이 안 깨졌는지 "이 파일의 새 관심사 영역에서 다시 고정"하려는 의도로는 이해되지만, 완전히 동일한 단언을 별도 파일 수정 없이 두 곳에 유지하면 한쪽만 갱신되고 다른 쪽이 stale 로 남는 drift 위험이 있다.
  - 제안: 신규 블록의 두 테스트를 "레거시 회귀와 동일하니 마스킹이 이 경로를 건드리지 않음을 확인" 정도의 짧은 주석으로 의도를 명시하거나, 완전 동일 단언(null/undefined 케이스)은 신규 블록에서 제거하고 상단 공유 스위트가 이미 그 계약을 지킨다는 점을 주석으로 참조.

- **[WARNING]** 동일 파일 안에서 "optional 키 생략" 패턴이 서로 다른 두 관용구로 구현되어 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:128` (기존, 명령형 `if`) vs `codebase/backend/src/shared/utils/terminal-error-payload.ts:85-87` (신규, 조건부 spread)
  - 상세: `toTerminalErrorPayload` 본문은 `if (src.details !== undefined) out.details = src.details;` 로 "값이 있을 때만 키를 만든다"를 명령형으로 표현하는데, 바로 위에 새로 추가된 `redactTerminalError` 는 같은 의미론(`details` 가 `undefined` 면 키 자체를 생략)을 `...(p.details === undefined ? {} : { details: deepRedactSecrets(p.details) })` 라는 조건부 spread 로 표현한다. 같은 파일, 같은 불변식(§6.4 optional 표현)을 두 가지 다른 스타일로 풀어 놓으면 다음 수정자가 "이 파일의 관용구가 무엇인지" 판단하기 어려워진다.
  - 제안: 둘 중 하나로 통일 — `redactTerminalError` 에도 `const out = {...p, message: ...}; if (p.details !== undefined) out.details = deepRedactSecrets(p.details); return out;` 형태를 쓰거나, 기존 `if` 분기도 spread 스타일로 맞춘다. 강한 요구는 아니며 함수가 작아 혼동 비용은 낮다.

- **[INFO]** `deepRedactSecrets` 반환값을 `unknown` → `string` 으로 무검증 단언
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:84` — `message: deepRedactSecrets(p.message) as string,`
  - 상세: `deepRedactSecrets(value: unknown, depth = 0): unknown` 은 입력이 문자열이면 문자열을 돌려주는 현재 구현상 안전하지만, 타입 시스템은 이를 보장하지 않는다. 훗날 `deepRedactSecrets` 의 문자열 분기가 바뀌면(예: 특수 케이스에서 객체를 반환하도록 확장) 이 `as string` 캐스트가 컴파일 타임 경고 없이 조용히 깨진다.
  - 제안: 강한 조치는 불필요하지만, 캐스트 옆에 "문자열 입력→문자열 출력은 `deepRedactSecrets` 의 런타임 불변식(구조 변경 시 여기도 확인)" 한 줄 주석을 남기면 향후 리팩터 시 안전하다.

- **[INFO]** 마스킹 유틸이 동일 basename `sanitize-error-message.ts` 로 두 디렉터리에 존재
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts`
  - 상세: 이번 PR 이 두 파일을 모두 건드리며 서로의 관계(“자매 leaf util”)를 docstring 으로 상세히 설명해 혼동을 상당히 완화했지만, 파일 탐색기/에디터 탭에서 basename 만 보고는 어느 파일인지 구분되지 않는 근본 문제는 남아 있다. 신규 코드는 아니라 이번 diff 의 책임은 아니다.
  - 제안: 즉시 조치 불요. 추후 대규모 리팩터 시 `modules/execution-engine/sanitize-error-message.ts` 를 `sanitize-notification-error-message.ts` 등으로 개명해 grep 모호성을 줄이는 것을 고려.

- **[INFO]** JSDoc 대 함수 본문 비율이 매우 높음(문서 지배적 스타일)
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:1-26`(주석 26줄, 함수 11줄) / `codebase/backend/src/shared/utils/terminal-error-payload.ts:52-80`(주석 29줄, `redactTerminalError` 본문 8줄)
  - 상세: 두 경우 모두 코드보다 "왜"를 설명하는 주석이 훨씬 길다. 이 저장소는 결정 배경을 코드 인접 주석/plan Rationale 에 남기는 것이 이미 확립된 컨벤션(리뷰 이력·plan 문서에서 반복 관찰됨)이라 새 패턴은 아니며, 이번 PR 의 맥락(4라운드 INFO 로 미뤄졌다가 실측으로 뒤집힌 결정)을 감안하면 근거를 남겨두는 편이 향후 재지적을 막는 데 유리하다. 다만 실제 로직을 훑을 때 주석을 오래 스크롤해야 하는 비용은 존재한다.
  - 제안: 조치 불요(컨벤션 부합). 다만 향후 같은 함수에 근거가 더 누적되면 일부를 `plan/complete/*.md` 또는 spec `## Rationale` 로 옮기고 코드 주석은 포인터만 남기는 것을 고려.

## 요약

핵심 로직 변경은 `terminal-error-payload.ts` 에 egress 초크포인트 `redactTerminalError` 헬퍼 하나를 추가하고 4개 반환 지점을 일괄적으로 그 헬퍼로 통과시키는 것으로, 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 네이밍(`redactTerminalError`, `deepRedactSecrets` 와 일관된 `redact*` 계열)도 무난하다. "관측 불가능한 조기 반환은 제거한다", "모든 반환을 같은 문으로 통과시켜 분기 누락을 구조적으로 막는다" 같은 설계 판단이 주석에 근거와 함께 명시되어 있어 의도 파악이 쉽다. 발견된 문제는 전부 경미하다 — 신규 테스트 블록이 기존 블록과 동일한 단언을 반복해 향후 drift 소지를 만든 것(WARNING), 같은 파일 안에서 "optional 키 생략"을 명령형/함수형 두 관용구로 혼용한 것(WARNING), 그리고 타입 단언·파일명 중복 등 사소한 관찰(INFO)이다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
