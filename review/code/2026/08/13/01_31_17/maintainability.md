# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `err instanceof Error ? err.message : String(err)` 삼항식이 파일 안에서 4회 반복
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:152, 247(변수명 `detail`), 330, 338`
  - 상세: GET 실패·엔트리/payload 손상·직렬화 실패·SET 실패 네 곳의 warn 로그 조립이 동일한 1줄 표현식을 반복한다. 첫 리뷰 라운드(`23_48_38`)에서 이미 INFO 로 관측되고 "1줄 표현식이라 즉시 조치 불요"로 명시 유예됐으며, 이번 diff 는 그 반복 횟수를 늘리지 않았다 — 새로운 결함이 아니라 기존 유예의 연장이다.
  - 제안: 조치 불요(기존 유예 유지). 다섯 번째 호출부가 생기면 `formatErr(err)` 파일-로컬 헬퍼 추출을 재검토.

- **[INFO]** `intercept()` 가 여전히 ~120줄, 7개 분기(Redis 미주입/키 부재 · 스코프 부재 · GET 실패 · 캐시 미스 · 바깥 JSON 손상 · 형태 불일치 · payload 손상 · 409 충돌 · 정상 재현)를 한 메서드 안에서 처리
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `intercept()` (:106-226)
  - 상세: `switchMap` 콜백을 `resolveCacheHit()` 로 추출하는 리팩터가 이미 이 세션의 트리거 조건(분기 수 증가)을 충족한 것으로 plan 에 기록돼 있으나(`plan/in-progress/backend-lint-gate-broken-on-main.md:669-676`), "순수 구조 변경이라 리뷰 라운드를 한 번 더 요구"한다는 이유로 이번 PR 범위에서 의도적으로 제외됐다. 이번 diff(경계값 테스트 + `isHttpStatusCode`)는 이 메서드 자체를 건드리지 않아 복잡도를 늘리지도 줄이지도 않는다.
  - 제안: 조치 불요 — 이미 항목화된 백로그(다음에 이 콜백을 만질 때 착수)를 그대로 따름. 이번 PR 에서 추가로 손댈 필요 없음.

- **[INFO]** 스펙 파일이 1,467줄로 계속 증가 중 (직전 라운드 1,463줄 → `99` 무효 케이스 1건 추가)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (다섯 번째 `describe`, `readKey`/`hashBody` 경계값 블록: `:1224-1467`)
  - 상세: 두 라운드 전부터 관찰·유예("여섯 번째 `describe` 축 추가 시 분리 검토")된 항목이며, 이번 diff 는 기존 다섯 번째 축 안에 케이스 하나를 보강했을 뿐 새 축을 열지 않았다.
  - 제안: 조치 불요 — 기존 유예 유지.

- **[INFO]** `key200`/`key201` 리터럴(`'k'.repeat(200)`/`'k'.repeat(201)`)이 production 상수 `MAX_KEY_LENGTH` 를 참조하지 못하고 숫자를 직접 반복
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1225-1226`
  - 상세: `MAX_KEY_LENGTH` 는 `.ts` 파일의 module-private 상수라 export 되지 않으므로 스펙 파일이 참조할 수 없다 — 구조적 제약이며 인접 주석(`// MAX_KEY_LENGTH 경계 (허용)`)이 의미를 명시해 오독 위험은 낮다. 새로 발견된 결함이라기보다 테스트-대-구현 경계선의 통상적인 트레이드오프.
  - 제안: 조치 불요.

## 이번 라운드에서 확인한 사실

`CHANGELOG.md`(신규 `statusCode` 500-방지 항목, :3-19), `idempotency.interceptor.ts`(`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 상수화 :25-26, `isHttpStatusCode()` :397-403, `readKey()` JSDoc :412-422), `idempotency.interceptor.spec.ts`(모듈 docstring 다섯 번째 `describe` 색인 :22-24, `99` 인접 경계 케이스 :1391) 모두 직전 두 라운드(`00_54_18`, `01_10_52`)가 WARNING/INFO 로 지적한 항목이 코드에 정확히 반영된 상태로 확인된다. 새로 도입된 코드는 파일 기존 컨벤션(`is*` 술어 함수, `MAX_*`/`MIN_*` 상수 네이밍, 근거·뮤테이션 실측 인용 주석, 헬퍼 재사용)을 일관되게 따르며, 새로운 중첩·순환 복잡도 증가는 없다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크박스/완료 노트 갱신도 이 프로젝트의 "체크박스=실제 상태" 규약과 일치하고, 테스트 개수 불일치(13 vs 15)는 이미 `01_10_52` documentation WARNING 으로 지적·정정됐다.

`review/code/**`, `review/consistency/**` 하위 신규 파일들은 이전 리뷰 라운드의 정규 산출물(저장 규약 `review/code|consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 준수)이며 실행 코드가 아니라 함수 길이·중첩·매직 넘버 등 본 관점의 평가 대상이 아니다.

## 요약

이번 diff 는 두 차례의 선행 maintainability 리뷰(LOW, LOW)가 지적한 항목을 모두 반영을 확인시켜 주는 마무리 라운드 성격이다. 새로 도입되거나 새로 악화된 가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도·일관성 문제는 발견되지 않았다. 남은 관찰(에러 포맷팅 삼항식 반복, `intercept()` 분기 수, 스펙 파일 길이, 테스트-구현 간 상수 미공유)은 전부 이전 라운드부터 의식적으로 유예된 항목이며 이번 diff 가 그 규모를 유의미하게 늘리지 않았다.

## 위험도

NONE
