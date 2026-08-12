# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** CHANGELOG 신규 항목이 "생성자 null" 경로도 warn 을 남긴다고 잘못 서술 — 같은 diff 가 넣은 클래스 docstring 표와 정면으로 모순된다.
  - 위치: `CHANGELOG.md:17-19`
  - 상세: 해당 문단은 "이로써 이 클래스의 fail-open 다섯 경로(생성자 `null` · GET 실패 · SET 실패 · 직렬화 실패 · 엔트리/payload 손상)가 모두 warn 을 남긴다" 라고 적는다. 그런데 같은 diff 가 `idempotency.interceptor.ts:65-71`에 새로 그려 넣은 fail-open 경로 표는 정확히 그 반대를 명시한다 — "경로 1(기동 시 미주입, 생성자 `null`)" 행의 `warn` 열은 `— (설정 상태이지 장애가 아니다)` 로, 표 도입부 문장도 "**경로 1 을 뺀 넷이** warn 을 남긴다" 라고 못박는다. 실제 코드(`idempotency.interceptor.ts:105-108`, `if (!rawKey || !this.redis) { return next.handle(); }`)에도 이 분기에 `logger.warn` 호출이 없다 — 파일 전체에서 `logger.warn` 호출은 5곳(`:117` interaction ctx 부재, `:144` GET 실패, `:224` discardCorruptEntry, `:307` 직렬화 실패, `:315` SET 실패)뿐이고 생성자 null 분기(`:106`)는 그중 어디에도 해당하지 않는다. 즉 CHANGELOG 는 "5경로 모두 warn" 이라 말하고, 같은 커밋의 SoT인 클래스 docstring·실제 코드는 "5경로 중 4개만 warn" 이라고 말한다 — 독자가 CHANGELOG 만 읽고 "Redis 미주입 시에도 로그가 남는다" 로 오해할 수 있다.
  - 이 세션은 바로 이 "경로 개수를 정확히 세는" 문제로 이미 두 라운드(`23_24_08` WARNING #2 "세 경로→다섯 경로", `23_36_13` WARNING "옛 문구 인용")를 거쳤고, 그때마다 지적된 자리는 고쳐졌다. 이번 CHANGELOG 항목은 그 교훈이 미치지 못한 세 번째 자리다 — 다른 파일이 아니라 이번에 새로 쓴 문서 그 자체 안에서 발생한 자기모순이라는 점이 다르다.
  - 제안: `CHANGELOG.md:18-19` 를 "GET 실패 · SET 실패 · 직렬화 실패 · 엔트리/payload 손상 네 경로가 모두 warn 을 남긴다(생성자 시점 미주입은 장애가 아니라 설정 상태라 warn 대상이 아니다)" 식으로 정정하거나, 목록에서 "생성자 `null`" 을 아예 빼고 "네 경로" 로 개수를 맞춘다.

## 문서화 우수 사례 (참고, 감점 아님)

이번 diff 는 직전 두 라운드(`23_24_08`, `23_36_13`)가 지적한 문서화 WARNING 을 실제로 반영했다는 점을 소스 대조로 확인했다:

- `idempotency.interceptor.ts:62-78` — 클래스 docstring 이 "세 경로" 산문에서 **다섯 경로 표**로 갱신됐고, 표 도입부에 "개수를 세어 두는 것이 요점" 이라는 자기 성찰적 경고까지 추가돼 향후 경로 추가 시 표 동반 갱신을 촉구한다.
- `idempotency.interceptor.spec.ts:826-829` — 직전 라운드(`23_36_13`)가 지적한, docstring 옛 문구("세 경로 모두 fail-open")를 그대로 인용하던 주석이 "다섯 경로" 로 정정됐고, 원본이 바뀌면 인용이 조용히 거짓이 된다는 이유까지 명시해 향후 재발을 구조적으로 줄였다.
- `idempotency.interceptor.spec.ts:11-27` — 모듈 최상단 docstring 이 이번에 추가된 4건(엔트리/payload 손상 각각의 warn, 파싱 순서 캐너리, 에러 재현 분기 자매)을 구체적으로 반영해 갱신됐다.
- `idempotency.interceptor.ts:206-218` — `discardCorruptEntry` docstring 이 두 호출부(`엔트리`/`payload`)의 서로 다른 "종전 동작"(조용한 강등 vs 방어 없는 500 마스킹)을 정확히 분리 서술한다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:619-631` — 완료 기록이 실제 코드 변경(파싱 순서 계약, warn 추가, 무효 뮤턴트 함정 회피 경위)과 정확히 부합한다.

## 참고 (검토했으나 이슈 없음)

- `review/code/2026/08/12/{23_24_08,23_36_13}/*` 하위 신규 파일 22건은 이전 라운드의 리뷰어 산출물(불변 이력 기록)이며 살아있는 코드 문서가 아니라 본 관점(독스트링/README/API 문서 등)의 평가 대상이 아니라고 판단해 별도 지적하지 않았다.
- README 업데이트, API 문서, 신규 환경변수/설정, 예제 코드 — 이번 diff 는 내부 인터셉터의 파싱 방어 리팩터로 공개 인터페이스·설정·API 계약 변경이 없어 해당 없음.

## 요약

프로덕션 코드(`idempotency.interceptor.ts`)와 테스트 파일의 신규 로직 문서화 품질은 높다 — 직전 두 라운드가 지적한 "세 경로 vs 다섯 경로" stale docstring, 테스트 주석의 옛 문구 인용, discardCorruptEntry 공유 docstring 의 뭉개진 서술, 모듈 docstring 미반영 등이 모두 소스 대조로 반영 확인됐다. 다만 이번에 새로 쓴 CHANGELOG.md 항목 자체가 같은 diff 의 클래스 docstring 표와 정면으로 모순되는 문장("생성자 null 도 warn 을 남긴다")을 담고 있다 — 바로 이 "경로 개수를 정확히 세는" 문제로 이미 두 라운드를 거친 세션에서, 이번엔 그 교훈이 새 문서 자체 내부의 자기모순으로 재발했다. 기능 결함은 아니며 CHANGELOG 정정 한 문장으로 해소된다.

## 위험도

WARNING (문서 정확성 결함 1건, 기능 영향 없음 — 전체 위험도는 LOW~MEDIUM 권고)
