# 테스트(Testing) 리뷰 — `system_error` 배너 라이브 WS 복구 (6라운드, `02_57_18`)

## 사전 확인

`origin/main...HEAD` 전체 diff(59 파일) 중 실질 코드 변경은 `use-execution-events.ts` /
`use-execution-events.test.ts` 2 파일뿐이고, 나머지 55개는 이전 5라운드
(`01_26_11` → `01_44_22` → `02_02_18` → `02_21_19` → `02_39_10`)의 review 산출물이다.
이전 라운드 testing.md·RESOLUTION.md 를 전부 읽고, 직전 라운드(`02_39_10`)가 지적한
유일한 WARNING(`retryable`/`retryAfterSec` `typeof` 좁히기 무테스트)이 이번 diff 에
`[가드] details 필드 타입이 틀리면 안전값으로 떨어진다 — failed / completed` 두 테스트로
**두 핸들러 모두** 실제로 반영돼 있음을 소스에서 직접 확인했다.

독립 검증:
- `pnpm exec vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 재현 —
  **95/95 GREEN** (plan 문서가 주장한 "86→95" 와 일치, `02_39_10` 시점 92 에서 3건 증가).
- `pnpm exec tsc --noEmit` — 대상 두 파일 관련 타입 오류 없음.
- 테스트 격리 재확인: 파일 최상단 `beforeEach`(96행)가 `vi.resetAllMocks()` +
  `useExecutionStore.setState(...)` 로 매 테스트 전 전역 mock·스토어를 리셋. `.skip`/`.only`/
  `test.todo` 없음.
- `extractNodeErrorPayload` 의 `details` 캐스트(`use-execution-events.ts:95-98`)가
  `asRecord` 와 달리 배열을 배제하지 않는다는 5라운드 전 지적(#5, WON'T-DO)을 재확인 —
  소비부가 named-property 접근만 하고 wire 상 배열 경로가 없어 등가 뮤턴트 클래스라는
  기존 판정에 이견 없음(새 정보 없어 재상정하지 않음).

## 발견사항

없음. 5라운드에 걸쳐 뮤테이션으로 실증된 캐너리·가드 테스트 세트가 이번 diff 에서도
그대로 유지·확장되어 있고, 직전 라운드의 유일한 WARNING 이 정확히 지적된 대칭 형태
(두 핸들러 모두)로 해소됐다. 새로 도입된 코드 경로는 없다 — 이번 커밋(`efc04a194`)은
직전 라운드 지적에 대한 fixture 추가뿐이다.

## 확인된 안전 항목 (재검증)

- `[가드] details 필드 타입이 틀리면 안전값으로 떨어진다 — failed`(`:2260` 부근) /
  `— completed`(`:2283` 부근) — `details: { retryable: "true", retryAfterSec: "30" }`
  malformed 타입을 각각 `handleNodeFailed`/`handleNodeCompleted` 양쪽에서 검증. 직전 라운드
  RESOLUTION 의 뮤테이션 실측(M9: failed 무력화 → 3 failed, M10: completed 무력화 →
  1 failed, 서로 다른 테스트가 죽어 대칭 커버 증거)과 fixture 형태가 일치.
- `wrapNodeHandlerOutput()` 빌더가 `{ output, config: {}, meta: {} }` 생성의 유일한
  지점 — 5곳+ 재사용, 손복제 없음(직전 라운드 지적 W3 해소 유지).
- `!code || !message` 가드는 좌/우항을 개별로 가르는 fixture 존재(`02_21_19` W1 반영 유지).
- `output` 배열 케이스 테스트는 "항 하나를 가른다"고 과대 주장하지 않고 등가 뮤턴트임을
  주석으로 명시한 채 유지 — 재상정 불필요.
- `[캐너리]` 문자열 `error` + 래퍼 `output` 조합 / `output` 미동봉 경로 두 캐너리가
  이 결함의 정확한 최소 재현 조합을 고정 — production shape 과 fixture 가 일치함을
  본문·plan 문서(`plan/in-progress/system-error-banner-live-ws.md`)의 emit 좌표 인용과
  대조 확인.

## 요약

6라운드째 검토로, CRITICAL 은 5라운드 연속 0 이고 코드 동작 결함은 4라운드째 없다. 직전
라운드가 남긴 유일한 WARNING(선택적 메타데이터 필드 타입 가드 무테스트)이 정확히 지적된
두 호출부 모두에 대칭적으로 해소됐음을 독립 재실행(95/95 GREEN)과 소스 대조로 확인했다.
새로 도입된 프로덕션 코드 경로가 없어 이번 diff 자체에 대한 신규 커버리지 갭도 없다.
이전 라운드들이 이미 종결 처리한 항목(#5 배열 미배제 details 캐스트, #9 준비코드 반복,
#10/#11/#13 핸들러 중복 등)은 사유가 여전히 유효해 재상정하지 않는다. 테스트 격리·가독성·
mock 경계(핸들러 콜백 직접 fire 방식)도 파일 전역 기존 컨벤션과 일관되어 추가 지적 없음.

## 위험도

NONE
