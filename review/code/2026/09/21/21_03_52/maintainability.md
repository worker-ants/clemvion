# 유지보수성(Maintainability) 코드 리뷰

## 범위 및 검증 방법

이번 diff 는 `codebase/backend/src/**` 변경이 0건인 순수 테스트 리팩터의 세 번째 라운드다.
아홉 e2e 파일(11 블록)에 손으로 복제돼 있던 "BEGIN → 락 → 두 요청 발사 → 공허성 가드
(`Promise.race`) → COMMIT → 결과 반환, `finally`: ROLLBACK + pending 흡수" 블록을
`codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 로 추출했고,
`PROJECT.md` 에 사용 안내를 추가했다. 나머지 파일들(`review/code/2026/09/21/20_26_50/**`,
`review/code/2026/09/21/20_45_43/**`, `review/consistency/2026/09/21/19_59_55/**`)은
이전 라운드의 리뷰/consistency-check 산출물이 이번 diff 에 함께 커밋되는 것으로, 코드가
아니라 프로세스 부산물이라 유지보수성 관점 검토 대상에서 제외했다.

`codebase/backend/test/helpers/concurrency.ts` 전체를 `Read` 로 직접 열어 프롬프트의 게이트
줄 번호(1-116)와 실제 파일 줄 번호가 정확히 일치함을 확인했고, `git show 905e1f696 --
codebase/backend/test/helpers/concurrency.ts` 로 라운드 1→2 사이의 변경 이력(상수 위치 이동,
`KNOWN_LOCK_TIMEOUTS_MS` 목록화, `@throws` 보강)을 대조해 이전 라운드 리뷰가 지적한 항목이
실제로 해소됐는지 확인했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short` 확인 완료).

## 이전 라운드 지적사항 해소 확인 (재지적 방지용 기록)

- 라운드 1 maintainability 리뷰가 지적한 "`VACUITY_GUARD_MS` 가 사용 지점(당시 67번 줄)보다
  뒤(당시 87번 줄)에 선언됨"과 "1.5초 근거 설명이 함수 본문 주석과 상수 JSDoc 두 곳에
  중복"은 둘 다 해소됐다 — 현재 `VACUITY_GUARD_MS` 는 함수 정의(76번 줄) **위**(27번 줄)에
  있고, 함수 본문 인라인 주석(98번 줄)은 근거를 반복하지 않고 "대기 시간의 근거는
  `VACUITY_GUARD_MS` 선언부에 한 번만 적는다" 로 위임한다.
- 라운드 2 concurrency 리뷰가 지적한 "assert 가 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 하나만
  검사해 향후 더 짧은 타임아웃을 가진 열 번째 호출부를 감지 못한다"는 갭은 완전히 닫히지
  않았지만(설계상 닫을 수 없는 갭), `KNOWN_LOCK_TIMEOUTS_MS` 목록 순회로 바꾸고 "여기 있는
  것만 검사된다 · 추가하지 않으면 오탐한다" 는 한계를 코드 옆 JSDoc(6-11번 줄)에 명시해
  "다음 사람이 채워야 할 자리"를 명확한 한 줄로 좁혔다 — 문서화된 한계이므로 재지적하지
  않는다.
- 문서화 리뷰가 지적한 "`PROJECT.md` 가 신규 헬퍼를 언급하지 않는다"(WARNING)도 이번 diff
  자체가 `PROJECT.md:337-342` 에 안내를 추가해 해소했다(다만 아래 새 지적 참고).

## 발견사항

- **[INFO]** `PROJECT.md` 신규 안내 항목만 전체 문장이 굵게(bold) 처리되어, 같은 목록의
  다른 항목들과 스타일이 어긋난다
  - 위치: `PROJECT.md:337` (`- **동시성 · race condition: ... 손으로 쓰지 말 것.**`)
  - 상세: 같은 "Backend e2e 패턴 (supertest)" 목록의 형제 항목들 — `PROJECT.md:335`
    ("DB 직접 접근: ..."), `:336`("인증 setup: ...") — 은 굵게 처리 없이 평문이고,
    `:343`("**응답 shape 규칙** (`TransformInterceptor` 동작):")은 **레이블 단어만** 굵게
    처리하는 패턴을 쓴다. 반면 337번 줄은 레이블부터 마침표까지 문장 전체(코드 스팬 포함)를
    하나의 `**...**` 로 감쌌다 — `grep -n '^\- \*\*.*\*\*$' PROJECT.md` 로 확인한 결과 파일
    전체에서 이 줄이 유일하게 "불릿 전체가 굵게"인 사례다. 기능에는 영향이 없으나, 이
    문서를 훑어 읽는(scan) 사람에게는 다른 항목보다 과도하게 강조돼 있어 시각적 일관성이
    깨진다.
  - 제안: `:343` 의 기존 패턴을 따라 "**동시성 · race condition**: `helpers/concurrency.ts`
    의 ... 손으로 쓰지 말 것." 처럼 레이블만 굵게 하고 나머지는 평문으로 낮추는 편이
    문서 스타일 일관성에 맞다.

- **[INFO]** `KNOWN_LOCK_TIMEOUTS_MS` 튜플의 표시용 이름 문자열이 실제 import 바인딩과
  별도로 손으로 동기화해야 한다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:12-14`
    (`['TRIGGER_DELETE_LOCK_TIMEOUT_MS', TRIGGER_DELETE_LOCK_TIMEOUT_MS]`)
  - 상세: 튜플의 첫 원소는 오직 에러 메시지 출력용 리터럴 문자열이고, 둘째 원소가 실제
    import 된 상수 값이다. 상수를 리네임하면 TypeScript 컴파일러가 4번 줄의 import 와
    13번 줄의 값 참조는 강제로 갱신시키지만, 13번 줄의 **문자열 리터럴** `'TRIGGER_DELETE_
    LOCK_TIMEOUT_MS'` 는 컴파일 에러 없이 그대로 남을 수 있다 — 그 결과 이 loop 가 30-34번
    줄에서 던지는 에러 메시지가 실제 상수 이름과 다른, 오래된 이름을 표시하게 된다. 순수
    표시용이라 오탐/누락 같은 기능적 결함으로 이어지진 않지만, "왜 실패했는지" 를 알려주는
    바로 그 메시지가 stale 해질 수 있다는 점에서 디버깅 시 사람을 혼동시킬 수 있다.
  - 제안: 필수는 아니다. 리스트 항목이 지금은 1개뿐이라 당장 위험은 작다 — 다만 항목이
    늘어날 때 "상수 리네임 시 문자열도 같이 고쳐야 한다"는 사실을 6-11번 줄 JSDoc 에 한
    문장 추가해 두면, 이미 그 JSDoc 이 강조하는 "이 목록은 사람이 갱신해야 한다"는 한계
    서술과 자연스럽게 합쳐진다.

## 정합성 확인 (문제 없음, 재확인만)

- `raceUnderHeldLock()` 은 41줄, 단일 책임("겹침 오케스트레이션 + 공허성 가드"), 중첩은
  `if` 조기 반환 1단 + `try/finally` 1단으로 얕다. 순환 복잡도가 낮다.
- 9개 e2e 파일 전체에서 호출 패턴·주석 스타일이 일관되게 치환됐다(`webauthn-credential-
  delete-concurrency.e2e-spec.ts` 두 블록 포함, 프롬프트에서 diff 가 생략된 파일이라 저장소
  원본을 `git diff origin/main` 으로 직접 대조해 다른 8개 파일과 동일한 전환 패턴임을
  확인했다).
- 매직 넘버 `1_500` 은 `VACUITY_GUARD_MS` 명명 상수 하나로 집중됐고, `KNOWN_LOCK_TIMEOUTS_MS`
  도 이름이 그 용도를 정확히 드러낸다. 네이밍(`raceUnderHeldLock`/`locker`/`lock`/`fires`)은
  JSDoc·호출부 변수명과 일관된다.
- "테스트 헬퍼가 프로덕션 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)를 직접 import 하는 결합"은
  라운드 2 리뷰가 지적했고 커밋 `905e1f696` 의 메시지에서 저자가 "컴파일 에러로 즉시 드러나는
  정상적 drift 방지 수단"이라는 근거로 명시적으로 기각했다 — 근거가 반증 가능한 형태로
  남아 있어(리네임 시 컴파일 에러) 재지적하지 않는다.

## 요약

세 번째 라운드에 이르러 이전 두 라운드의 유지보수성 지적(상수 선언 위치, 근거 문서 중복,
검사 범위 과장 서술)이 모두 실측·근거와 함께 해소됐고, `raceUnderHeldLock()` 자체는 여전히
짧고 단일 책임이며 9파일 11블록의 중복을 깔끔하게 흡수한 모범적인 추출이다. 이번 라운드에서
새로 발견한 것은 `PROJECT.md` 신규 안내 항목의 국소적 볼드 스타일 불일치와, 표시용 문자열이
실제 상수 이름과 별도로 수동 동기화돼야 하는 사소한 drift 위험 두 건으로, 둘 다 기능에
영향이 없는 INFO 수준이다. Critical/Warning 급 유지보수성 결함은 발견하지 못했다.

## 위험도

LOW
