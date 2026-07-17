# 부작용(Side Effect) 리뷰 — eslint-layering-guard.test.ts 문구 상호배타성 보강 + 이전 리뷰 산출물 커밋

## 대상 요약

이번 payload 의 실제 코드 변경은 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 1개
파일뿐이다(직전 종결 리뷰 `review/code/2026/07/18/00_33_58` 의 WARNING #1·#2 fix). `codebase/frontend/eslint.config.mjs`
는 git status 상 별도로 수정돼 있으나 이번 diff 페이로드에는 포함되지 않았다 — 프로덕션 가드 로직 자체는
이번 변경의 부작용 분석 대상이 아니다. 나머지 20개 파일은 이전 코드리뷰(`review/code/2026/07/17/23_49_51/**`)·
컨시스턴시체크(`review/consistency/2026/07/18/00_22_41/**`) 세션 산출물을 저장소에 기록하는 신규 md/json
파일로, CLAUDE.md 저장 위치 규약에 정확히 부합하는 순수 문서 추가다.

## 발견사항

- **[INFO]** 신규 로컬 상수 `DYNAMIC_MARK`/`REQUIRE_MARK` 도입
  - 위치: `eslint-layering-guard.test.ts` (해당 `it(...)` 콜백 내부, 문구 회귀 고정 테스트)
  - 상세: 두 상수는 모듈 스코프가 아니라 단일 `it` 콜백 내부에 선언된 지역 변수다 — export 되지 않고
    다른 테스트/파일과 공유되지 않는다. 전역 오염, 테스트 간 공유 상태 변경 없음. 직전 라운드에 도입된
    `GUARD_BLOCK_KEY`(모듈 스코프 상수, 이미 이전 side_effect 리뷰에서 INFO/조치 불필요로 처분)보다도
    스코프가 더 좁아 부작용 위험이 낮다.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 케이스 데이터 구조 변경 — `readonly [string, string]` 튜플 → `{ code, present, absent }` 객체
  - 위치: `eslint-layering-guard.test.ts` (동일 `it` 블록의 `cases` 배열과 순회 루프)
  - 상세: 이 배열·타입은 해당 테스트 함수 내부 지역 변수이며 export/재사용되지 않는다. 순회 로직도
    `for (const [code, distinctPhrase] of cases)` → `for (const { code, present, absent } of cases)` 로
    같은 함수 내부에서만 바뀌었다 — 다른 테스트 파일이나 호출자에 영향을 주는 시그니처/인터페이스
    변경이 아니다. 단언 개수가 늘었을 뿐(`toContain` positive → `toContain`/`not.toContain` positive+negative)
    실행 흐름의 부작용(파일시스템/네트워크/환경변수/전역 상태)은 없다 — 순수 in-memory
    `linter.verify()` 호출 결과 문자열에 대한 assertion 뿐이다.
  - 제안: 조치 불필요.

- **[INFO]** JSDoc(모듈 최상단 주석) 텍스트 갱신 — `src/lib/**` 단독 스코프 서술 → `LOWER_LAYERS`(`src/lib/**`·`src/types/**`) 포괄 서술
  - 위치: `eslint-layering-guard.test.ts:7-18` 부근
  - 상세: 주석 텍스트만 변경. 컴파일·런타임 동작에 영향 없음(다른 리뷰어가 documentation 관점에서
    별도로 다룰 staleness 잔여 지적이 있으나, side effect 관점에서는 무해).
  - 제안: 조치 불필요.

- **[INFO]** 시그니처/공개 인터페이스 변경 없음
  - 상세: `layeringErrors()`, `errorsAt()`, `ruleSeverity()` 등 기존 헬퍼 함수의 파라미터·반환 타입은
    이번 diff 에서 전혀 건드리지 않았다. 테스트 파일이라 애초에 외부에 공개되는 인터페이스도 없다
    (다른 소스 파일이 이 파일을 import 하지 않음).
  - 제안: 조치 불필요.

- **[INFO]** 환경 변수·네트워크 호출 없음
  - 상세: 이번 diff 범위(JSDoc 텍스트 + 단일 테스트의 assertion 구조 변경)에는 `process.env` 접근이나
    외부 서비스 호출이 전혀 추가되지 않았다. 파일 하단의 실제 `ESLint({ cwd: FRONTEND_ROOT })` 인스턴스
    생성·`lintText()` 호출 블록은 이번 diff 의 변경 대상이 아니라(직전 라운드에 이미 도입·리뷰됨)
    범위 밖이다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 산출물 20개 파일 신규 생성 (`review/code/2026/07/17/23_49_51/**`, `review/consistency/2026/07/18/00_22_41/**`)
  - 위치: 파일 2~21 (본 payload 상)
  - 상세: 전부 이전 세션이 프로토콜대로 생성한 리포트(md)·상태(json) 파일이며, 저장 위치가 CLAUDE.md
    "정보 저장 위치" 표(`review/code/<...>`, `review/consistency/<...>`)와 정확히 일치한다. 실행 코드
    경로에 영향 없는 문서 추가다. `_retry_state.json`/`meta.json` 내부에 이 worktree 의 절대경로가
    다수 기록돼 있어 worktree 정리(삭제) 시 문서 내 경로가 댕글링될 수 있으나, 이는 하네스 전반의
    기존 관례(세션별 상태 파일에 절대경로 기록)이며 이번 diff 가 새로 도입한 패턴이 아니다 — 직전
    라운드 side_effect 리뷰에서도 동일하게 INFO/조치 불필요로 처분됨.
  - 제안: 조치 불필요(기존 하네스 패턴). 참고용 기록.

CRITICAL/WARNING 급 부작용 없음. 전역 변수 오염, 의도치 않은 상태 변경, 함수/메서드 시그니처 파괴,
공개 인터페이스 breaking change, 환경변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경 — 8개 점검 관점
모두 해당 사항 없음.

## 요약

이번 diff 의 실제 코드 변경은 테스트 파일 1개에 국한되며, 그 안에서도 JSDoc 텍스트 갱신과 단일
`it` 블록 내부의 assertion 구조 변경(positive-only `toContain` → positive/negative 조합)이 전부다.
새로 도입된 상수(`DYNAMIC_MARK`/`REQUIRE_MARK`)와 데이터 구조는 해당 테스트 함수 내부에 완전히
격리돼 있어 전역 상태·다른 파일에 영향을 주지 않고, 파일시스템 쓰기·네트워크 호출·환경변수 접근도
추가되지 않았다. 기존 함수 시그니처·공개 인터페이스는 무변경이다. 나머지 20개 파일은 이전 리뷰·
컨시스턴시체크 세션 산출물을 관례된 위치에 기록하는 문서 추가로, 부작용 관점에서 위험이 없다.

## 위험도
NONE
