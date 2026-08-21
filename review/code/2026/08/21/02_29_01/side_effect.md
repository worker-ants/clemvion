# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (6라운드째, `02_29_01`)

## 검토 범위와 방법

`git diff origin/main...HEAD --stat -- codebase/` 로 실제 애플리케이션 코드 변경을 확정했다
(11개 파일, +949/-11). 이전 5라운드(`00_03_57`→`00_39_27`→`01_15_47`→`01_38_26`→`02_04_38`)의
side_effect 리뷰가 핵심 기능(거부 로직·두 호출부·에러 봉투)을 이미 LOW/NONE 으로 수렴시켰으므로,
이번 라운드는 **직전 `02_04_38` 대비 순증분**(`git show --stat 29ce00bdc`)에 집중했다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `MASKED_MARKERS` 타입 교체
  (`ReadonlySet<string>` → `readonly string[]` + `Object.freeze`), `isMaskedMarker` 를
  `.has()` → `.includes()` 로 교체
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 불변성 캐너리 신규
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` — `importsBaseFn`
  에 `stripCommentsAndStrings` 전처리 추가, 허용목록에서 자기참조 2줄 제거
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` — 합성 fixture
  탐지 캐너리 신규(`os.tmpdir()` 사용)

나머지 애플리케이션 코드(`reject-masked-resubmission.ts`/`.spec.ts`, `executions.service.ts`,
`workflows.controller.ts`, `trigger-parameter.types.ts`)는 이번 라운드에서 변경되지 않았음을
`git show --stat 29ce00bdc -- codebase/` 로 확인했고, 실물도 `Read` 로 재대조해 이전 라운드
결론(부작용 관점 LOW, drop-in 치환, 순수 함수)이 그대로 유효함을 확인했다.

## 발견사항

- **[INFO]** `MASKED_MARKERS` 의 공개 export 타입이 `ReadonlySet<string>` 에서 `readonly
  string[]` 로 바뀌었다 — 인터페이스 변경이나 현재 실질 소비처가 없어 영향 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`
    (`export const MASKED_MARKERS: readonly string[] = Object.freeze([...])`)
  - 상세: 이 심볼은 직전 라운드(`00_03_57`~`00_39_27` 구간)에 module-private `const` 에서
    `export const` 로 막 승격됐고, 그 직후(`02_04_38`) `Object.freeze(Set)` 이 플라시보였다는
    지적을 받아 이번 라운드에서 배열로 교체됐다. `grep -rn "MASKED_MARKERS"
    codebase/backend/src`(spec 파일 제외)로 재확인한 결과 이 파일 자신 밖에서 `MASKED_MARKERS`
    를 직접 import 하는 곳은 없다 — 소비는 전부 `isMaskedMarker()` 함수를 통해서만 이뤄지고,
    그 함수의 시그니처(`(v: unknown) => boolean`)는 이번 변경으로 바뀌지 않았다. 별도 경로인
    `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(알림/이메일
    전용, 다른 파일)는 `redactSecrets` 만 import 해 무관함도 확인했다. 프런트 미러
    (`frontend/src/lib/utils/masked-markers.ts`)는 이 백엔드 export 를 import 하지 않는 별도
    복제본이라 영향 없음.
  - 제안: 조치 불요. 향후 `MASKED_MARKERS` 값 자체(Set/array)를 직접 import 하는 소비처가
    생기면 이 타입 변경을 알고 시작하도록 doc comment 로 남아 있는 현재 상태로 충분.

- **[INFO]** 신규 캐너리 테스트가 `os.tmpdir()` 아래 임시 디렉터리·파일을 생성/삭제한다 —
  격리되고 정리되어 실질 파일시스템 부작용 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`
    (`it('[캐너리] 허용목록 밖 위반을 실제로 탐지한다 (합성 fixture)', ...)`) — `fs.mkdtempSync`,
    `fs.writeFileSync` ×2, `fs.rmSync(tmp, { recursive: true, force: true })`
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'masked-guard-'))` 로 매 실행마다 고유한
    디렉터리를 원자적으로 생성하므로 병렬 Jest 워커 간 충돌 위험이 없고, 파일 생성 2건은
    `try` 블록 안에, 삭제는 `finally` 블록에 있어 단언(`expect`)이 실패해도 정리가 보장된다.
    같은 디렉터리에 있는 자매 가드(`eslint-unicorn-peer-guard.ts` 계열)나 이 저장소의 다른
    guard 테스트들도 유사한 임시 파일 패턴을 쓰는 것으로 보아 새로운 부작용 클래스가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `importsBaseFn` 의 `stripCommentsAndStrings` 전처리 변경은 순수 문자열 변환
  함수 내부 로직 교체이며 export 표면·시그니처는 그대로다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (함수 `importsBaseFn`, `stripCommentsAndStrings` 신규 export)
  - 상세: `importsBaseFn(source: string): boolean` 시그니처는 변경되지 않았고, 이 파일을
    소비하는 곳은 형제 spec(`masked-reject-callers.spec.ts`) 하나뿐이라 호출자 영향이 없다.
    `ALLOWED_DIRECT_CALLERS` 에서 자기참조 2줄이 빠진 것은 값 내용 변경이지만 이 상수는
    모듈 스코프에 격리돼 있고 다른 모듈이 공유·변형하는 전역 상태가 아니다(`repo-guards` 테스트
    전용, 런타임 요청 경로 밖).
  - 제안: 조치 불요.

## 요약

이번 라운드의 실질 순증분은 4개 파일이며, 전부 (1) 이미 export 돼 있던 상수의 타입을 실제로
불변인 형태로 교정하거나, (2) 테스트 전용 repo-guard 의 판정 로직/커버리지를 보강하는 것이다.
런타임 요청 경로(두 Manual 실행 엔드포인트, `resolveTriggerParametersRejectingMasked`, 에러
봉투 조립)는 이번 라운드에서 손대지 않았고 이전 라운드들이 독립적으로 재검증해 LOW/NONE 로
수렴한 상태가 실물 대조로 그대로 유지됨을 확인했다. `MASKED_MARKERS` 타입 교체는 현재 유일한
소비 경로(`isMaskedMarker` 함수 호출)를 우회하는 직접 import 가 없어 실질적 호출자 영향이
없고, 신규 캐너리의 임시 파일 생성은 `mkdtempSync`+`finally` 정리로 격리되어 있다. 전역
가변 상태 도입, 예상치 못한 파일 생성·삭제, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백
변경은 발견되지 않았다.

## 위험도

NONE
