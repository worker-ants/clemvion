# 테스트(Testing) 리뷰 — EIA 마스킹 왕복 오염 가드 (round2)

## 조사 방법

- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` /
  `dynamic-form-ui.test.tsx` 를 `Read` 로 전문 확인 (프롬프트 크기 제한으로 잘려 있었음).
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 는 diff 가 상수 선언
  재배치 + JSDoc 추가뿐(동작 변화 없음)임을 `git diff` 로 확인. 기존
  `sanitize-error-message.spec.ts` (48 tests, `deepRedactSecrets — 기존 마스킹 마커 보존` 블록
  포함)로 충분히 커버됨을 재확인 — `npx jest src/shared/utils/sanitize-error-message.spec.ts`
  실행, 48 passed.
- plan (`plan/in-progress/eia-masked-prefill-roundtrip-guard.md`) 이 주장한 "가드 제거 →
  4건 RED" 뮤테이션 검증 주장을 **직접 재현**해 검증(아래 발견사항 근거로도 사용).
- 신규 describe 블록("DynamicFormUI — 마스킹된 defaultValue 왕복 차단")에 대해 추가로
  독자적 뮤테이션 2건을 수행해 커버리지 갭을 실측.

## 발견사항

- **[INFO]** plan 의 뮤테이션 주장(가드 제거 → 4건 RED) 재현 성공 — 신뢰할 수 있는 근거
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:364` (`initialValueFor` 의 `!isMaskedValue(...)` 조건)
  - 상세: `if (field.defaultValue !== undefined && !isMaskedValue(field.defaultValue))` 를
    `if (field.defaultValue !== undefined)` 로 뮤테이션(가드 제거) 후
    `dynamic-form-ui.test.tsx` 재실행 → `it.each` 3건 + "제출 payload 에 마커가 실리지
    않는다" 1건, 정확히 4건이 RED 로 전환됨을 확인(plan 체크리스트의 주장과 일치). 나머지
    2건("마커가 아닌 기본값" · "안내 노출")은 영향받지 않아 GREEN 유지 — 예상과 부합.
    뮤테이션 후 원본 파일로 복원했고 `git diff` 로 무결 확인, 전체 23건 재실행해 GREEN 복귀.

- **[WARNING]** "제출 payload에 마커가 실리지 않는다" 테스트가 실제 제출 버튼의
  `type="submit"` 배선을 검증하지 못한다 — 뮤테이션으로 실측한 vacuous 케이스
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:664` (`fireEvent.submit(screen.getByRole("button", ...))`) — 대상 구현은 `dynamic-form-ui.tsx:470` (`<Button type="submit" ...>`)
  - 상세: 같은 파일의 다른 모든 제출 테스트는 `fireEvent.click(submitButton)` 을 쓴다(예:
    line 61, 122, 149, 168, 205 등) — 실제 사용자가 버튼을 클릭하는 경로를 재현해
    `type="submit"` 배선이 살아있는지까지 검증한다. 반면 신규 테스트는
    `fireEvent.submit(button)` 을 쓰는데, 이는 `submit` DOM 이벤트를 **버튼 위에 직접
    dispatch** 하는 것이라 `<form onSubmit>` 까지 버블링돼 우연히 통과하지만, 브라우저가
    "클릭 시 `type=submit` 버튼만 폼을 제출시킨다" 는 규칙을 전혀 거치지 않는다.
    **재현**: `dynamic-form-ui.tsx:470` 의 `type="submit"` 을 `type="button"` 으로 뮤테이션한
    뒤 재실행 — 같은 파일의 `fireEvent.click` 기반 제출 테스트 13건은 전부 RED(정상 회귀
    탐지)로 전환됐지만, `fireEvent.submit` 을 쓰는 이 신규 테스트만 **그대로 GREEN**(오탐,
    vacuous)이었다. 즉 이 테스트는 버튼의 `type` 속성이 실수로 바뀌는 회귀를 못 잡는다.
  - 제안: `fireEvent.submit(button)` 을 `fireEvent.click(button)` 으로 바꿔 파일 내 다른
    제출 테스트와 상호작용 패턴을 통일한다 (동일 검증 대상에 대해 서로 다른 테스트 기법을
    섞으면 회귀 방어력이 조용히 갈린다).

- **[WARNING]** 마스킹 안내(hint) 문구가 마스킹되지 않은 필드에서는 **뜨지 않아야 한다**는
  음의 단언이 없다 — "항상 노출" 회귀를 못 잡음(뮤테이션으로 실측)
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:614-633` ("마커가 아닌 기본값은 그대로 프리필한다") — 대상 구현은 `dynamic-form-ui.tsx:459` (`{isMaskedValue(field.defaultValue) && (<p>...formMaskedDefaultHint...</p>)}`)
  - 상세: 신규 describe 블록은 힌트가 **뜨는** 경우만 단언한다("마커 필드에는 이유를 알리는
    안내를 띄운다", line 635-649). 힌트가 **안 뜨는** 경우(마스킹되지 않은 필드)에 대한
    부재 단언이 없다. **재현**: `dynamic-form-ui.tsx:459` 의 조건 `isMaskedValue(field.defaultValue) &&` 를 `true &&` 로 뮤테이션(모든 필드에 힌트가 항상 뜨도록)한 뒤 파일 전체
    23건 재실행 — **전부 GREEN**(회귀를 하나도 못 잡음). 이 뮤테이션 하에서는 마스킹되지
    않은 "Note"/"Partial" 필드에도 `formMaskedDefaultHint` 문구가 함께 렌더되지만, 그 자리를
    검사하는 단언이 아예 없어 통과한다. JSDoc 주석(line 594-595)이 명시한 *"한쪽만 단언하면
    '전부 프리필 안 함' 구현으로도 초록이 된다"* 는 우려는 프리필 자체에 대해서는 잘
    방어됐지만, **힌트 노출 쪽에서는 같은 종류의 편측 단언 문제가 남아 있다.**
  - 제안: `it("마커가 아닌 기본값은 그대로 프리필한다", ...)` 또는 별도 테스트에
    `expect(screen.queryByText(/자격증명으로 판별되어 가려졌어요/)).not.toBeInTheDocument()`
    류의 부재 단언을 추가한다.

- **[INFO]** 테스트 fixture 의 마커 리터럴이 SoT 를 참조하지 않고 세 번째로 복제된다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:598` (`const MARKERS = ["***", "[REDACTED]", "[REDACTED_DEPTH]"];`)
  - 상세: 마커 문자열은 이미 backend(`sanitize-error-message.ts` `VALUE_MASK_MARKER`
    등)와 frontend(`dynamic-form-ui.tsx` `MASK_MARKERS`) 두 곳에 미러돼 있고 문서가 "양쪽
    동기화 의무"를 명시한다. 테스트가 세 번째 하드코딩 사본을 만들면서 실제 구현 상수를
    import 하지 않는다 — `MASK_MARKERS` 는 현재 export 되지 않아 테스트에서 직접 재사용할
    수 없다. 다만 이 복제는 **fail-safe 방향**이다: 구현이 마커 값을 바꾸고 이 fixture 를
    안 바꾸면 테스트가 (거짓 통과가 아니라) RED 로 실패해 드러난다 — 그래서 CRITICAL/WARNING
    이 아니라 유지보수성 관점의 INFO.
  - 제안: `dynamic-form-ui.tsx` 에서 `MASK_MARKERS` 를 `export` 하고 테스트가 이를 import 해
    `it.each([...MASK_MARKERS])` 로 쓰면 세 번째 복제가 사라지고, 마커 집합이 늘어나도
    테스트가 자동으로 따라간다.

- **[INFO]** backend↔frontend 마커 상수 미러에 대한 자동 동기화 테스트 부재(기존 패턴 확장,
  신규 결함 아님)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:335-339` (`MASK_MARKERS`) ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100` (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)
  - 상세: 두 상수 집합 모두 코드 주석으로 "값이 어긋나면 가드가 조용히 뚫린다"고 명시적으로
    경고하지만, 이를 강제하는 자동 테스트(예: 두 파일의 리터럴을 비교하는 빌드/CI 스크립트)는
    없다. 같은 파일의 기존 `DEFAULT_FILE_*` 미러(파일 필드 기본값)도 동일하게 무가드다 —
    확인 결과 그쪽도 동기화 테스트가 없어, 이 diff 가 새로 만든 갭이 아니라 기존에 팀이
    수용한 패턴을 마스킹 마커까지 확장한 것. 다만 이번 대상(마스킹 마커)은 데이터 무결성과
    직결되는 보안 성격의 상수라 리스크 등급이 `DEFAULT_FILE_*` 보다 높다.
  - 제안(선택): 두 파일을 정규식으로 파싱해 리터럴 집합을 비교하는 소규모 Node 스크립트를
    두 프로젝트 중 하나의 test suite(예: frontend, `fs.readFileSync` 로 backend 소스 상대경로
    직접 읽기 — 런타임 import 는 아키텍처상 불가하지만 텍스트 비교는 빌드 분리와 무관)에
    추가해 드리프트를 CI 에서 탐지한다.

## 회귀 테스트 유효성 확인

- 기존 defaultValue 매트릭스 테스트(line 466-529, 8개 필드 타입)는 마커 문자열을 쓰지 않아
  신규 가드와 충돌하지 않는다 — 회귀 없음 확인.
- backend `sanitize-error-message.spec.ts` 48건은 diff 가 순수 상수 재배치 + 문서화뿐이라
  100% 그대로 유효 — `npx jest` 로 실행 확인, 48 passed.
- 신규 4개 테스트가 `locale-store` 를 오염시키지 않는지: `beforeEach` 가 매 테스트마다
  `locale: "ko"` 로 재설정하므로 테스트 격리 양호. `vitest.config.ts` 의 `globals: true` +
  `@testing-library/react` auto-cleanup 으로 DOM 격리도 보장됨(`src/test/setup.ts` 확인).
- i18n 키 페어리티: `formMaskedDefaultHint` 가 en/ko 양쪽 dict 에 동시 추가됨을
  `npx vitest run src/lib/i18n/__tests__/i18n.test.ts src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 로 재확인(18 passed).

## Mock 적절성 / 테스트 용이성

- `onSubmit={vi.fn()}` 외 mock 없음 — 실제 DOM(jsdom) 렌더 + `fireEvent` 로 실동작에 가깝게
  검증하는 통합 테스트 스타일이며 이 컴포넌트 계층에 적절하다. 과도한 mocking 없음.
- `isMaskedValue` 를 `export` 해 둔 점은 테스트 용이성 측면에서 좋은 결정이나(순수 함수),
  현재는 컴포넌트 렌더를 통한 간접 테스트만 존재한다. 로직이 단순(2줄)해 크리티컬하지
  않지만, 향후 이 판별 로직이 복잡해지면(예: 정규식 기반 판별로 진화) 직접 단위 테스트가
  필요해질 것.

## 요약

핵심 기능(마스킹된 `defaultValue` 프리필 차단 + 제출 payload 오염 차단)에 대한 테스트는
plan 이 주장한 대로 실제 뮤테이션 검증을 통과하는 견고한 수준이다(가드 제거 시 4건 정확히
RED). 다만 신규 describe 블록 내 개별 테스트 2건은 자체 뮤테이션 검증으로 **실제 취약점**이
확인됐다: (1) 제출 최종 단언 테스트가 `fireEvent.submit` 을 써서 버튼 `type="submit"` 배선
회귀를 못 잡고, (2) 마스킹 안내 문구의 "비마스킹 필드에서는 안 뜬다" 는 음의 케이스가
전혀 커버되지 않아 "항상 노출" 회귀를 못 잡는다. 두 갭 모두 실제 뮤테이션으로 GREEN 유지가
재현되어 vacuous 함이 확인됐으므로 fix 권장. backend 변경은 순수 문서화/재배치라 회귀
리스크 없음. i18n·격리·mock 사용은 전반적으로 양호.

## 위험도

MEDIUM
