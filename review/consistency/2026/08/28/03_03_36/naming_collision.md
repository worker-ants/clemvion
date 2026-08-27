# 신규 식별자 충돌 검토 — target: `spec/5-system/` (impl-done)

## 범위 확인

`git diff origin/main...HEAD -- spec/` 결과가 빈 값이다 — 이번 diff 는 `spec/5-system/**`
어느 파일도 수정하지 않는다. 프롬프트에 첨부된 `spec/5-system/1-auth.md`,
`2-api-convention.md`, `3-error-handling.md` 등은 전부 `@bundle-file`(참고용 전문)이지
diff 가 아니다. 실제 diff 는 아래 코드 2개 파일에 한정된다.

- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- `codebase/frontend/src/lib/websocket/use-execution-events.ts`

즉 이번 target 은 **새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로를
전혀 도입하지 않는다.** 코드가 참조하는 `§4.1-a` 절(`execution.node.failed` 의
`error`/`output` 실측 정정)도 `spec/5-system/6-websocket-protocol.md:239` 에 이미
존재하는 기존 섹션이다(2026-08-24 자로 별도 커밋에서 도입, "2026-08-24 정정" 이라고
diff 내 주석에도 명시됨) — 이번 diff 가 새로 부여한 ID 가 아니라 기존 spec 표기를
코드가 뒤늦게 따라잡은 것.

## 검토한 신규 식별자 (코드 레벨)

diff 가 실제로 새로 도입하는 로컬 식별자는 아래 2개뿐이며, 둘 다 **모듈 비공개
(non-exported) 헬퍼**로 다른 영역에서 import 되지 않는다.

- `asRecord(v: unknown): Record<string, unknown> | null` — `use-execution-events.ts:52`, 신규.
- `wrapNodeHandlerOutput(domain): Record<string, unknown>` — 테스트 파일 내 로컬 헬퍼, 신규.

### 발견사항

- **[INFO]** `asRecord` 함수명이 `channel-web-chat` 패키지에 이미 존재
  - target 신규 식별자: `asRecord` (`codebase/frontend/src/lib/websocket/use-execution-events.ts:52`, non-exported, 반환 타입 `Record<string, unknown> | null`)
  - 기존 사용처: `codebase/channel-web-chat/src/lib/presentation.ts:102` — `function asRecord(v: unknown): Record<string, unknown>` (non-exported, 반환 타입에 `| null` 없음 — 항상 빈 객체 폴백)
  - 상세: 두 함수는 "unknown 을 record 로 안전 캐스팅" 이라는 동일한 목적이지만 널 처리 방식이 다르다(하나는 `null` 반환, 하나는 빈 객체 폴백). 다만 `frontend`(Next.js 메인 앱)와 `channel-web-chat`(별도 임베드 위젯 SPA, 독립 패키지)은 서로 import 관계가 없고 각 함수 모두 모듈 스코프에 비공개다. 컴파일/런타임 충돌은 없다 — 이름이 같은 두 개의 독립적 로컬 유틸리티일 뿐이다. `codebase/frontend` 내부의 `llm-call-trace.ts:73`, `output-shape.ts:259` 에도 동명의 지역 변수(`const asRecord = raw as Record<string, unknown>`)가 있으나 이 역시 각 함수 스코프 내부 지역변수로 충돌 없음.
  - 제안: 실질적 위험은 없음. 향후 두 패키지가 공유 유틸을 추출할 계획이 있다면 그 시점에 시그니처(nullable 여부) 통일을 고려. 현재는 조치 불필요.

- **[INFO]** `wrapNodeHandlerOutput` 은 백엔드 기존 테스트 헬퍼와 개념이 겹치지만 파일·런타임이 분리됨
  - target 신규 식별자: `wrapNodeHandlerOutput` (`codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1987`)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/__test__/mock-output.ts` — `NodeHandlerOutput` 형태를 만드는 backend 전용 mock 빌더(이름은 다름, 개념만 유사)
  - 상세: 두 헬퍼 모두 "`NodeHandlerOutput` 래퍼 shape 을 만든다"는 동일 의도지만 FE 테스트 파일 로컬 함수와 BE 테스트 유틸은 이름도, import 경로도 겹치지 않는다. 식별자 충돌이 아니라 FE/BE 경계를 넘는 fixture 로직 중복(별도 관심사 — DRY/maintainability 리뷰 영역)에 가깝다.
  - 제안: 이번 신규 식별자 충돌 관점에서는 조치 불필요.

## 요약

이번 target(`spec/5-system/`, impl-done)은 실제로는 `spec/` 어떤 파일도 변경하지 않는
순수 코드 버그 수정이다(`extractNodeErrorPayload` 시그니처를 2-인자에서 1-인자로
정리하고 `output.output.error` 접근 경로를 정정) — 새 요구사항 ID, 엔티티/DTO명, API
endpoint, 이벤트/메시지명, 환경변수, spec 파일 경로 중 어느 것도 새로 도입되지 않는다.
코드가 참조하는 `§4.1-a` 는 이미 `spec/5-system/6-websocket-protocol.md` 에 존재하는
기존 섹션이다. diff 가 새로 만든 로컬 헬퍼 `asRecord`/`wrapNodeHandlerOutput` 은 둘 다
모듈 비공개라 이름이 겹치는 다른 패키지 함수와 실질적 충돌이 없어 INFO 수준으로만
기록한다.

## 위험도

NONE
