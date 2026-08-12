# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 스펙 파일이 1,463줄로 계속 커지는 중 (이전 라운드 1,426줄 → 이번 라운드 경계값 추가로 +37줄)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (파일 전체, `describe` 5개 누적)
  - 상세: 이번 diff 는 새 `describe` 축을 추가한 것이 아니라 기존 다섯 번째 `describe`(`readKey`/`hashBody` 경계값)에 `99` 무효 케이스 1건을 보강한 것뿐이라, 직전 라운드(`00_54_18` maintainability 리뷰)가 이미 지적하고 RESOLUTION 이 의식적으로 유예("다음 `describe` 축 추가 시 분리 검토")한 항목과 동일 선상이다. 새로운 문제가 아니라 기존 관찰의 연장.
  - 제안: 조치 불요 — 기존 유예 결정 유지. 다음에 여섯 번째 `describe` 축이 생길 때 분리 검토.

- **[INFO]** `jest.spyOn(Logger.prototype, 'warn')` + `try/finally { mockRestore() }` 보일러플레이트가 파일 전체 11회 반복 (이번 라운드에서 신규 추가는 없음 — 직전 라운드에 1회 추가된 것이 유지)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (`statusCode` 손상 케이스 `it.each` 블록 포함 11곳)
  - 상세: 직전 라운드 리뷰가 이미 지적했고 RESOLUTION 이 "`withWarnSpy()` 헬퍼 후보로 유예"라 명시적으로 처분한 항목. 이번 diff 는 해당 카운트를 늘리지 않았다.
  - 제안: 조치 불요 — 기존 유예 결정 유지.

## 이번 라운드에서 확인한 긍정적 변화

직전 라운드(`00_54_18`)의 maintainability INFO 지적 중 코드에 실제 반영이 필요했던 2건이 정확히 처리됐다.

- **매직 넘버 → 상수화**: `isHttpStatusCode()` 의 `100`/`599` 리터럴이 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 로 상수화됐다(`idempotency.interceptor.ts:25-26`). 같은 파일의 `MAX_KEY_LENGTH`/`TTL_SEC` 관례와 일관되고, 함수 본문(`idempotency.interceptor.ts:397-402`)에는 리터럴 재중복이 없음을 확인(grep).
- **`readKey()` JSDoc 추가**: 반환 규약(`null` 의 세 사유)과 호출부가 `=== null` 로 묻는 이유, 배열 분기의 실제 성격(중복 헤더 경로가 아니라 타입 방어)까지 명시돼, 파일 내 다른 헬퍼(`hashBody`/`isErrorStatusCacheable`/`isIdempotencyEntry`/`isHttpStatusCode`)와 문서화 수준이 맞춰졌다(`idempotency.interceptor.ts:412-422`).
- **모듈 docstring 색인 갱신**: 스펙 파일 최상단 docstring 이 다섯 번째 `describe` 를 목록에 반영해(`idempotency.interceptor.spec.ts:22-26`), 파일 구조 색인이 실제 블록 수와 다시 일치한다.
- **경계 인접 페어 보강**: `isHttpStatusCode()` 하한 무효 케이스에 `99`(하한 바로 아래)가 추가돼 `-1`/`0` 만으로는 못 갈랐던 인접 경계(99 무효/100 유효)가 고정됐다(`idempotency.interceptor.spec.ts` 의 `it.each` 무효 케이스 목록). 상한은 기존 `599`/`600` 페어로 이미 대칭을 이룬다.
- **`makeContext` body 정규화 수정**: `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 바뀌어 "명시 안 함"과 "명시적 nullish" 를 키 존재 여부로 가른다. 근거 주석이 왜 종전 방식이 이중으로 vacuous 했는지(뮤테이션 실측)까지 남겨 다음 사람이 되돌리지 않도록 방어한다(`idempotency.interceptor.spec.ts:133-137`).

새로 도입된 코드(`isHttpStatusCode()`, `readKey()` JSDoc, 신규 `it.each` 8건)는 기존 파일의 명명 규칙(`is*` 술어 함수, `MAX_*`/`MIN_*` 상수), 주석 스타일(근거·뮤테이션 실측 인용), 헬퍼 재사용(`makeRedis`/`makeContext`/`makeCallHandler`/`scopedKey`/`bodyHashOf`) 패턴을 그대로 따른다. 함수 하나는 단일 책임(범위 검사)만 가지며 중첩 깊이·순환 복잡도 증가는 없다.

## 요약

이번 diff 는 직전 리뷰 라운드(`00_54_18`)에서 이미 CRITICAL/WARNING 없이 LOW 로 판정됐던 변경분에, 그 라운드의 WARNING(하한 인접 경계 미검증·중복 헤더 주석 오류·CHANGELOG 누락·docstring 색인 누락)과 코드 관련 INFO(매직 넘버·`readKey` JSDoc 부재)를 정확히 반영한 RESOLUTION 이 더해진 상태다. 새로 관찰되는 유지보수성 결함은 없으며, 남은 두 항목(스펙 파일 길이·`warnSpy` 보일러플레이트)은 직전 라운드가 이미 지적하고 의식적으로 유예한 것과 동일하고 이번 diff 가 그 규모를 유의미하게 늘리지 않았다. 신규 코드는 파일의 기존 컨벤션(명시 비교 우선, 근거 주석, 헬퍼 재사용, `is*` 술어 네이밍)을 일관되게 따른다.

## 위험도
LOW
