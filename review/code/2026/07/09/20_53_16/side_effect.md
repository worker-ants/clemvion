# 부작용(Side Effect) 리뷰

대상 커밋: `54b466defab6a2766ff0eeb1487be1b3df8da900` (직전 리뷰 20_26_00 Warning 3건 조치 refactor)

## 발견사항

- **[INFO]** 판정 헬퍼 추출 — 함수 시그니처는 test 파일 내부 전용, 외부 영향 없음
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` (`subGlobalTimeoutsInLine(line, global)` 신설, `describe("검출 로직 true/false positives")` 내부의 로컬 `scanLine` 제거)
  - 상세: 신규 함수는 파일 로컬(모듈 최상위, non-export) 스코프에 머문다. `export` 되지 않으므로 다른 모듈이 import 하는 공개 인터페이스가 아니다. `findSubGlobalTimeouts`(프로덕션 스캔)와 self-test 양쪽이 이 헬퍼를 호출하도록 바뀌었지만, 두 호출부 모두 같은 파일 안에 있어 "시그니처 변경의 호출자 영향" 범주에 해당하는 외부 caller 가 없다. grep 확인 결과 `scanLine` / 신규 함수명을 참조하는 다른 파일 없음.
  - 제안: 없음 (안전).

- **[INFO]** 파일시스템 접근 패턴 불변 — read-only 유지
  - 위치: `subGlobalTimeoutsInLine`, `findSubGlobalTimeouts`, `collectE2eFiles`, `readGlobalExpectTimeout` (동일 파일)
  - 상세: 이번 diff 는 판정 로직(`v < global` 비교)을 라인 단위 순수 함수로 추출했을 뿐, 실제 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 호출 지점과 인자는 변경되지 않았다. 모두 `__dirname` 기준 리포지토리 내부 고정 경로(`E2E_DIR`, `PLAYWRIGHT_CONFIG`)만 스캔하며 쓰기·삭제 호출은 여전히 없다. 새 함수 자체는 파일 I/O 를 전혀 하지 않는 순수 계산 함수(문자열 → number[])라 부작용 표면이 오히려 좁아졌다(테스트 대상이 파일 I/O 와 분리됨).
  - 제안: 없음.

- **[INFO]** 전역 상태/변수 변경 없음
  - 위치: 동일 파일
  - 상세: 신규 도입된 식별자(`subGlobalTimeoutsInLine`)는 모듈 스코프 함수 선언으로, 기존 모듈 스코프 상수(`E2E_DIR`, `PLAYWRIGHT_CONFIG`, `TIMEOUT_LITERAL`)에 변화가 없다. 전역(`globalThis`, `process.env` 등) 읽기/쓰기 없음. 프로세스 환경 변수 접근 없음.
  - 제안: 없음.

- **[INFO]** 테스트 제목(it title) 값 보간 정정 — 표시 문자열만 변경, 판정 로직·타이밍 불변
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 메인 `it(...)` 타이틀
  - 상세: 기존에는 템플릿 리터럴이 `GLOBAL` 이 아닌 고정 문자열(`"parsed from playwright.config.ts"`)을 보간하던 오도 코드였고, 이제 실제 `${GLOBAL}` 값을 보간한다. `GLOBAL`(=`readGlobalExpectTimeout()`)은 이미 `describe` 블록 최상단에서 (변경 전부터) 평가되고 있었으므로, 이번 변경으로 `readGlobalExpectTimeout()` 호출 횟수·시점·throw 가능성(fail-closed) 이 새로 생기거나 바뀐 것은 아니다 — 단지 이미 계산돼 있던 값을 타이틀 문자열에 정확히 반영하도록 고쳤을 뿐이다. 테스트 제목이 런타임에 달라지는 점에 대해 grep 으로 저장소 전체(`*.ts`/`*.sh`/`*.yml`/`*.md`)를 확인했으나 이 타이틀 문자열(구·신)을 `--testNamePattern` 등으로 참조하는 스크립트/CI 설정은 없다.
  - 제안: 없음.

- **[INFO]** 신규 파일 생성 다수 — 정책상 정당한 위치, 예상치 못한 파일시스템 부작용 아님
  - 위치: `review/code/2026/07/09/20_26_00/{RESOLUTION.md, SUMMARY.md, _retry_state.json, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md}` (본 diff 에서 신규 생성)
  - 상세: 다수의 새 파일이 diff 에 포함돼 있으나 전부 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 하위 — CLAUDE.md 가 명시한 "코드 리뷰 산출물" 정식 저장 위치와 정확히 일치한다. RESOLUTION.md 본문에 따르면 이는 직전 리뷰 세션(20_26_00)에서 harness 의 알려진 write-vs-status 갭으로 인해 4개 reviewer 산출물이 디스크에 기록되지 못했던 것을 journal.jsonl 에서 복원해 채운 것으로, 새로운 부작용이 아니라 기존 세션 산출물의 사후 확정이다. 애플리케이션 코드(`codebase/**`)나 설정에 대한 부작용은 없다.
  - 제안: 없음 (기록 목적 확인).

- **[INFO]** PROJECT.md 문서 1줄 추가 — 런타임 부작용 없음
  - 위치: `PROJECT.md` §자동 가드(build-time 차단) 목록
  - 상세: 신규 가드 테스트 파일에 대한 문서 등록 한 줄 추가. 순수 문서 변경으로 코드 실행 경로·빌드 스크립트 동작에 영향 없음.
  - 제안: 없음.

- **[INFO]** 환경 변수 / 네트워크 / 이벤트-콜백 — 해당 없음
  - 위치: 전체 diff
  - 상세: 환경 변수 읽기/쓰기 코드 없음(`process.env` 미사용). 외부 서비스 호출·HTTP 요청 없음. 이벤트 발행(`emit`)·콜백 등록/해제 변경 없음. 이번 diff 는 테스트 파일 내부 리팩터링 + 문서 1줄 + 리뷰 산출물 파일 생성으로 한정된다.
  - 제안: 없음.

## 요약

이번 diff(직전 리뷰 20_26_00 의 Warning 3건 조치)는 `e2e-no-sub-global-timeout.test.ts` 안의 판정 로직을 단일 non-export 헬퍼(`subGlobalTimeoutsInLine`)로 통합하고 테스트 타이틀의 값 보간을 바로잡은 순수 리팩터링으로, 새로운 함수는 파일 로컬 스코프에 머물러 외부 호출자·공개 API에 영향이 없다. 파일시스템 접근은 기존과 동일하게 리포지토리 내부 고정 경로에 대한 read-only 스캔뿐이며 전역 변수·환경 변수·네트워크·이벤트 콜백 어느 관점에서도 변경이 없다. 함께 포함된 다수의 신규 review 산출물 파일 생성은 규약이 정한 `review/code/**` 경로에 정확히 부합하고, RESOLUTION.md 에 근거(harness write-isolation 갭 복원)가 명시돼 있어 예상치 못한 부작용이 아니다. 종합적으로 부작용 관점에서 문제 될 변경 없음.

## 위험도
NONE
