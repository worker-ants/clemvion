# 문서화(Documentation) 리뷰 결과

## 검증 방법

- `git log --oneline origin/main..HEAD` 로 이번 changeset 이 커밋 5개(`22e68459d` fix →
  `eb752e0e6`/`e7ad5ca1f` docs → `dff218f17` plan → `86de12278` fix)로 구성됨을 확인.
- 프롬프트에서 diff 가 생략된 두 핵심 파일(`idempotency.interceptor.ts`,
  `idempotency.interceptor.spec.ts`)은 `git diff origin/main..HEAD -- <path>` 와 `Read` 로
  직접 원문 대조.
- 이전 세 라운드(`23_24_08`/`23_36_13`/`23_48_38`)의 documentation WARNING 이 실제로
  반영됐는지 `git blame` 으로 최종 소스와 대조 확인(전부 반영됨 — 아래 "확인된 선행 조치" 참고).
- 마지막 커밋(`86de12278`)이 새로 추가한 `isIdempotencyEntry()` 형태 가드 + 9건의 테스트가
  그 상위 요약 문서(테스트 모듈 docstring, plan 완료 노트)에 반영됐는지를 `git blame` 으로
  타임스탬프 대조.

## 발견사항

- **[WARNING]** 테스트 파일의 모듈 최상단 docstring과 두 번째 `describe` 블록 docstring이 마지막 커밋이 추가한 "형태(shape) 검증" 테스트 9건을 반영하지 않는다 — 이 세션에서 이미 3회 지적된 "문서가 최신 코드 변경을 못 따라간다" 패턴의 4번째 재발.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-14`(모듈 최상단 docstring), `:238-245`(`describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)', ...)` 바로 위 블록 docstring)
  - 상세: `git blame` 확인 결과 두 docstring 모두 커밋 `eb752e0e6`(23:36:06)에서 마지막으로 수정됐다. 그런데 그다음 커밋 `86de12278`(00:07:57)이 같은 `describe` 블록에 `it.each` 8-fixture(`'null'`·`42`·`[]`·`'"str"'`·필드 누락 객체·필드별 타입 불일치 3건 — `:559-608` 부근)와 독립 테스트 `엔트리 손상은 조용히 넘어가지 않는다`(`:610-632` 부근)를 새로 추가하고, 프로덕션 코드에 `isIdempotencyEntry()` 타입 가드(`idempotency.interceptor.ts:370-378`)를 신설했다. 이 추가분은 부수적 보강이 아니라 이 커밋의 **핵심 결함 수정**이다 — `'null'` 은 `JSON.parse` 문법 검사를 통과한 뒤 `cached.bodyHash` 접근에서 `TypeError`를 내 `GlobalExceptionFilter`가 500으로 마스킹하던, "이 PR이 없애려던 바로 그 실패 형태"(커밋 메시지 자체 표현)였다. 그런데 두 docstring 은 여전히 "손상 캐시 fallback(바깥 엔트리와 안쪽 `responseJson` 두 겹 · 각각 warn 을 남기는지 · 에러 재현 분기 · 순서 캐너리)" 만 나열할 뿐 "문법은 유효하지만 형태가 아닌 값도 막는다"는 세 번째 축을 언급하지 않는다. 파일을 훑어 커버리지를 파악하려는 사람은 이 describe 블록에 `'null'`/배열/원시값 방어가 있다는 사실을 헤더만으로는 알 수 없다.
  - 이 세션은 정확히 이 결함 클래스("코드가 늘 때 요약 docstring 동반 갱신 실패")를 이미 세 자리에서 지적·조치했다 — 클래스 docstring "세 경로→다섯 경로"(`23_24_08`), 테스트 인라인 주석의 옛 문구 인용(`23_36_13`), CHANGELOG/docstring 상호모순(`23_48_38`). 이번 것은 그 교훈이 아직 미치지 못한 네 번째 자리다.
  - 제안: 모듈 최상단 docstring(`:11-14`)과 describe 블록 docstring(`:238-245`)에 "문법은 유효하지만 엔트리 형태가 아닌 값(`null`·배열·원시값·필드 누락/타입 불일치)도 `isIdempotencyEntry()` 로 걸러 손상으로 처리한다" 한 문장을 추가.

- **[WARNING]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 노트가 마지막 커밋(`86de12278`)의 수정 내용을 반영하지 않는다 — 이 항목이 명시적으로 "완료" 라고 선언한 자리인데, 그 선언 이후에 추가된 후속 수정이 노트에 없다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:622-634`(`> **완료 (2026-08-12, eia-idem-responsejson-guard).**` 블록)
  - 상세: 이 완료 노트는 "한 번만 파싱" · "두 자리 모두 warn" · "파싱 순서가 bodyHash 판정 뒤" · "순서 뮤턴트가 처음엔 무효였다" 네 가지만 기록한다 — 전부 첫 fix 커밋(`22e68459d`, 2026-08-12 23:xx)의 내용이다. 그런데 노트에 적힌 그 날짜(`2026-08-12`) 그대로 이어진 후속 커밋 `86de12278`(00:07:57, 날짜가 바뀌었지만 같은 작업 세션)이 `isIdempotencyEntry()` 형태 가드를 신설해 "문법은 유효하지만 형태가 아닌 캐시 값(특히 `'null'`)이 `TypeError`로 500을 낸다"는 별개 갭을 닫았는데, 이 완료 노트에는 그 사실이 전혀 언급되지 않는다. 이 갭은 사소한 부수 사항이 아니라 커밋 메시지가 스스로 "이 PR 이 없애려던 바로 그 실패 형태" 라고 부르는 것 — 즉 이 plan 항목이 원래 주장한 "500 마스킹을 없앤다" 는 목표 자체가 첫 fix 만으로는 부분적으로 미달이었다는 뜻이다. 완료 노트를 그대로 읽는 사람은 "한 번 더 좁은 틈이 남아 있었고 그것도 닫혔다"는 사실을 알 수 없다.
  - 이 세션은 "완료로 처분해 놓고 실제로 반영이 덜 됐다" 패턴을 이미 같은 항목 안에서 두 차례(`18_07_36`→`18_37_45`, `23_24_08`→`23_48_38` INFO 10) 지적·조치했다 — 이번 것은 그 반복이 세 번째로 일어난 것이며, 프로젝트가 "plan 체크박스/완료 노트 = 실제 상태" 를 명시적으로 규약화한 바로 그 실패 형태다.
  - 제안: `:634` 뒤에 "**추가 완료 (2026-08-13).** 문법은 유효하지만 형태가 아닌 캐시 값(`'null'` 등)이 `isIdempotencyEntry()` 형태 가드 없이는 `TypeError`→500 으로 새는 좁은 틈이 남아 있어(리뷰 `23_48_38` testing WARNING), 타입 가드를 추가해 닫았다" 정도의 문단을 보강.

## 확인된 선행 조치 (참고, 감점 아님)

이전 세 라운드가 지적한 documentation WARNING 은 모두 소스에서 실제로 반영됐음을 확인했다 —
재발이 아니라는 점을 명시해 둔다.

- `23_24_08` WARNING(클래스 docstring "세 경로" stale) → `idempotency.interceptor.ts:62-71`
  다섯-경로 표로 갱신 확인.
- `23_24_08` WARNING(CHANGELOG 누락) → `CHANGELOG.md:3-24` 항목 추가 확인.
- `23_36_13` WARNING(테스트 주석의 옛 docstring 문구 인용 stale) → `idempotency.interceptor.spec.ts:906` 부근 주석이 "다섯 경로" 로 정정되고, 인용 위험을 명시하는 메타 코멘트까지 추가된 것 확인.
- `23_48_38` WARNING(CHANGELOG "생성자 null 도 warn" ↔ docstring "warn 아님" 모순) →
  최종 `CHANGELOG.md:21-24` 가 "다섯 경로 중 넷" 으로 정정되어 클래스 docstring 표와 정확히
  일치함을 확인.
- `23_48_38` WARNING(`warnSpy` try/finally 밖) → `idempotency.interceptor.spec.ts:512` 부근이
  `try { … } finally { warnSpy.mockRestore(); }` 로 감싸진 것 확인.
- `23_48_38` testing WARNING(문법 유효 비-객체 값의 500 마스킹) → 코드·CHANGELOG 는 정확히
  반영(위 새 WARNING 두 건이 지적하는 것은 코드가 아니라 그 코드를 요약하는 **상위 문서**의
  지연이다).

프로덕션 코드 자체의 문서화 품질은 이번 라운드에서도 높다 — `discardCorruptEntry()` JSDoc 이
두 호출 범주(엔트리/payload)의 종전 동작 차이를 분리 서술하고, `isIdempotencyEntry()` JSDoc 이
뮤테이션으로 절을 두 번 갈았던 실측 경위(`Array.isArray`·`typeof` 절이 관측 가능한 동작 없이
죽어 있었던 사실)까지 남겨 향후 같은 실수를 예방한다. README·API 문서·환경변수/설정 문서는
이번 변경이 내부 인터셉터의 파싱 방어 강화뿐이라 해당 없음(신규 공개 인터페이스·엔드포인트·
설정 없음).

## 요약

프로덕션 코드·CHANGELOG·클래스 docstring 수준에서는 이번 5-커밋 changeset 이 매우 높은 문서화
규율을 보인다 — 이전 세 라운드가 지적한 WARNING(경로 개수 drift, 옛 문구 인용, CHANGELOG-docstring
모순, warnSpy 격리)이 전부 다음 커밋에서 실제로 조치됐음을 소스 대조로 확인했다. 다만 그 규율이
"코드를 요약하는 상위 문서"까지 매번 닿지는 못했다 — 이번 라운드에서 새로 발견한 두 건이 정확히
그 자리다. (1) 마지막 커밋이 신설한 `isIdempotencyEntry()` 형태 가드와 9건의 신규 테스트(이 PR
이 없애려던 바로 그 실패 형태를 닫는 핵심 수정)가 테스트 파일의 두 요약 docstring 에는 반영되지
않았고, (2) 같은 수정이 plan 파일의 "완료" 선언 노트에도 없어, 그 노트만 읽으면 이 갭이 여전히
열려 있(었)다는 사실을 알 수 없다. 둘 다 기능 결함이 아니라 "코드는 맞는데 그 코드를 요약하는
자리가 뒤처졌다"는 성격이며, 같은 세션에서 이미 세 차례 같은 근본 원인(변경이 늘 때 인접 요약을
동반 갱신하지 않음)으로 지적·조치된 패턴의 재발이다.

## 위험도

MEDIUM
