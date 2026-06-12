# 유지보수성(Maintainability) 리뷰

대상 파일: `codebase/backend/src/nodes/data/code/code.handler.ts`

---

## 발견사항

- **[INFO]** `execute()` 메서드가 단일 함수로는 길고 여러 책임을 포함
  - 위치: 라인 433–531 (`execute` 메서드, 약 99 LoC)
  - 상세: isolate 생성 → 컨텍스트 빌드 → 컴파일 → 실행 → `$vars` 동기화 → 성공 반환 → 에러 분류 및 실패 반환까지 6단계가 하나의 메서드 안에 있다. `_buildIsolateContext` / `_runWithTimeout` / `failure` 로 이미 일부 추출했으나, `execute` 자체는 여전히 여러 concerns 를 담는다. 현재 로직은 명확하게 주석으로 구분되어 있어 가독성이 나쁘지 않지만, 장기적으로 `$vars` sync 로직을 별도 헬퍼로 추출하면 테스트 독립성이 높아진다.
  - 제안: `_syncVarsBack(ctx, varsClone, context)` 헬퍼를 추출하여 `execute` 의 책임 수를 줄이는 것을 검토.

- **[INFO]** 매직 넘버 `1000` (wall-clock grace period) 이 인라인 하드코딩
  - 위치: 라인 641 (`timeoutMs + 1000`)
  - 상세: `_runWithTimeout` 내 wall-clock 타이머에 `+ 1000` (1초 grace period) 이 이름 없이 사용된다. 주석으로 의미가 맥락 안에서 추론 가능하지만, 상수가 없어 값의 의도를 파악하려면 함수 전체를 읽어야 한다.
  - 제안: `const WALL_CLOCK_GRACE_MS = 1000;` 상수로 추출하고 `timeoutMs + WALL_CLOCK_GRACE_MS` 로 사용.

- **[INFO]** 매직 넘버 `8` (syntax check isolate 메모리 한계)
  - 위치: 라인 336 (`new ivm.Isolate({ memoryLimit: 8 })`)
  - 상세: 8MB 가 어디서 비롯된 값인지 코드만으로는 알 수 없다. `ISOLATE_MEMORY_LIMIT_MB` 처럼 명명된 상수가 있으면 의도가 명확해진다.
  - 제안: `const SYNTAX_CHECK_MEMORY_LIMIT_MB = 8;` 상수를 선언하고 주석으로 최소값 선택 근거를 한 줄 기재.

- **[INFO]** `_buildIsolateContext` 내 jail.set 호출 반복 패턴
  - 위치: 라인 529–568
  - 상세: `await jail.set(key, new ivm.ExternalCopy(value).copyInto())` 패턴이 4회 반복된다. 차이는 인자뿐이며 구조가 동일하다. 현 코드 양이 크지 않아 심각한 문제는 아니나, 데이터 주입 항목이 늘어날 경우 중복이 누적된다.
  - 제안: `async function injectCopy(jail, key, value)` 헬퍼를 모듈 스코프에 두어 반복 제거.

- **[INFO]** `wrapUserCode` 내 라인 오프셋(+3) 이 여러 곳에서 참조되나 상수화 미적용
  - 위치: 라인 311–319 (`wrapUserCode`), JSDoc W14 참조
  - 상세: JSDoc 과 spec 참조에서 "+3 offset" 이 언급되지만 코드 내 숫자 상수로 선언되지 않아, UI 레이어에서 실제 빼는 값을 찾으려면 W14 주석을 직접 추적해야 한다.
  - 제안: `export const USER_CODE_LINE_OFFSET = 3;` 을 `code.schema.ts` 또는 해당 파일에 선언하여 UI 레이어와 단일 진실 공유.

- **[INFO]** `BOOTSTRAP_SOURCE` 문자열 내 삭제 대상 전역 목록이 `_buildIsolateContext` 의 `__host_*` 이름과 암묵적으로 결합
  - 위치: 라인 263–268 (BOOTSTRAP_SOURCE delete 블록), 라인 573–587 (jail.set 블록)
  - 상세: `__host_hash`, `__host_uuid`, `__host_b64encode`, `__host_b64decode`, `__host_log` 이름이 BOOTSTRAP_SOURCE 문자열과 `_buildIsolateContext` 에 각각 중복 선언된다. 이름 불일치 시 컴파일 타임에 잡히지 않고 런타임 버그(global 미삭제)로만 드러난다.
  - 제안: 상수 배열 `HOST_CALLBACK_NAMES = ['__host_hash', '__host_uuid', ...]` 를 단일 소스로 두고, BOOTSTRAP_SOURCE 생성과 jail.set 루프 모두 해당 배열에서 파생하면 이름 동기화 오류를 제거할 수 있다. 단, BOOTSTRAP_SOURCE가 문자열 리터럴로 유지되는 현 아키텍처(isolate 실행 단순성 우선)에서는 타입 시스템이 직접 보호하기 어려우므로 주석 경고로 최소화 가능.

- **[INFO]** 언어 일관성: 주석 일부가 한글·영문 혼재
  - 위치: 라인 113–114 (`dayjs snapshot 생성 실패 — per-exec 컴파일 fallback 사용:`), 기타 영문 주석들
  - 상세: 모듈 수준 주석 대부분이 영어인데, warn 메시지 하나만 한글이다. 동일 파일 안에서 warn/error 메시지 언어가 일관되지 않으면 로그 검색·모니터링 쿼리 작성 시 혼란을 줄 수 있다.
  - 제안: operator-facing warn/error 메시지를 영어로 통일하거나, 프로젝트 정책에 따라 한국어로 통일.

- **[INFO]** `failure()` 메서드에서 config echo 구조체가 `execute()` 성공 경로와 동일하게 중복
  - 위치: 라인 497–500 (execute 성공 경로), 라인 657–661 (failure 성공 경로)
  - 상세: `{ code: ..., language: ... ?? 'javascript', timeout: ... }` 형태의 config echo 객체가 두 경로에서 동일하게 구성된다. 필드가 추가되거나 폴백 값이 변경될 때 두 곳을 모두 수정해야 한다.
  - 제안: `buildConfigEcho(config)` 헬퍼 함수로 추출하여 단일 진실 보장.

---

## 요약

`code.handler.ts` 는 전반적으로 읽기 쉽고 명확하다. 모듈 수준 상수 분리(`DEFAULT_MEMORY_LIMIT_MB`, `MAX_MEMORY_LIMIT_MB`, `LEGACY_TO_NORMALIZED` 등), 책임별 private 메서드 추출(`_buildIsolateContext`, `_runWithTimeout`, `failure`), 풍부한 JSDoc 및 인라인 주석이 유지보수성을 높이고 있다. 발견된 항목들은 모두 INFO 등급으로, wall-clock grace period(`+1000`)와 syntax check 메모리 한계(`8`)의 상수화, config echo 중복 제거, 경고 메시지 언어 일관성 정도가 주요 개선 포인트다. `__host_*` 이름의 이중 관리 구조는 잠재적 동기화 위험이 있으나 현 아키텍처 제약 내에서 주석으로 보완되어 있다.

---

## 위험도

LOW
