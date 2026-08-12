# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 테스트 파일 모듈 docstring 이 이번 fix 로 더 이상 사실이 아닌 문장을 그대로 남겼다 (오래된 주석)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-13`
  - 상세: 파일 최상단 모듈 docstring 이 두 번째 `describe` 블록을 "`HttpResponseLike` 의 optional 이 지탱하는 `typeof` 가드 회귀 고정, 손상 캐시 JSON fallback, 그리고 **Spec EIA §R8 과 어긋난 현재 캐시 제외 범위를 고정하는 캐너리를 담는다**" 라고 설명한다. 이 문장은 개정 전(`statusCode >= 400` 이 409·410 을 캐시에서 잘못 제외하던 시점)에는 정확했지만, 이번 diff 가 바로 그 캐너리를 "409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리" 에서 "409 는 캐시된다 (Spec EIA §R8 — 닫힌 목록)" 로 뒤집었다(해당 블록 내 개별 `it` 주석·제목은 모두 정정됐다). 그 결과 이 블록은 이제 R8 위반을 고정하는 캐너리가 아니라 **R8 정합 동작**을 고정하는 회귀 테스트인데, 모듈 docstring 만 옛 서술("현재 캐시 제외 범위" = 위반 상태)에 머물러 있다. 파일을 처음 여는 사람이 이 상단 docstring 만 보면 "아직 §R8 과 어긋난 알려진 결함이 남아 있다" 고 오독할 수 있다. 이 저장소가 반복 학습한 "문서한 보장이 구현/테스트보다 넓다·오래된 주석" 클래스와 동형이며, 하필 이 diff 의 본질(캐너리를 정합 동작으로 뒤집는 것)을 요약하는 자리라서 놓치기 쉬웠던 것으로 보인다.
  - 제안: 13번째 줄을 "그리고 Spec EIA §R8 캐시 대상(2xx·409·410 닫힌 목록)을 고정하는 회귀 테스트를 담는다" 류로 갱신해, 더 이상 존재하지 않는 "위반 상태 고정 캐너리" 서술을 제거한다.

- **[INFO]** CHANGELOG·구현·테스트·spec(`data-flow/15`)·plan 체크리스트 5곳이 모두 상호 정합적으로 갱신됨을 확인
  - 위치: `CHANGELOG.md:3-21`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:39-190`, `spec/data-flow/15-external-interaction.md:257-258`, `plan/in-progress/backend-lint-gate-broken-on-main.md:542-583`
  - 상세: (1) CHANGELOG 신규 항목이 결함·근거·클라이언트 영향을 명확히 서술. (2) 구현 파일의 클래스/필드/메서드 docstring 이 옛 "선재 결함" 서술을 전부 제거하고 새 조건(닫힌 목록 열거, `>= 400`·`=== 400` 두 오답 축약이 각각 왜 틀린지)으로 교체 — 인라인 주석(`§R8 의 열거를 그대로 옮긴 조건`)도 로직과 정확히 일치. (3) `spec/data-flow/15-external-interaction.md` 표에서 "⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" 문구를 정확히 삭제 — 갭이 실제로 닫혔으므로 정합. (4) plan 체크리스트 항목이 `[ ]`→`[x]` 전환과 함께 "완료" 노트에 뮤테이션 실측 표(`>= 400` → 409·410 RED, `=== 400` → 5xx·404 RED)까지 남겨 이후 회귀 원인 추적이 쉽다. 새 env 변수·README 대상 설정 변경은 없음(순수 조건식 버그 수정이라 해당 없음).
  - 제안: 없음 — 참고용 기록.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 캐시 대상 조건을 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에 맞게 좁힌 버그 수정으로, CHANGELOG·구현 docstring/인라인 주석·spec 미러(`data-flow/15`)·plan 체크리스트가 모두 새 동작과 정확히 동기화되어 있고 "선재 결함" 서술이 완료 시점에 맞춰 과거형으로 잘 정리되어 있다. 유일한 흠은 테스트 파일 최상단 모듈 docstring 한 곳(11-13줄)이 개정 전 상태("R8 과 어긋난 현재 캐시 제외 범위를 고정하는 캐너리")를 그대로 남겨, 개별 테스트 케이스는 전부 뒤집혔음에도 파일을 훑어보는 사람에게 "아직 알려진 위반이 남아 있다"는 오독을 유발할 수 있다. 그 외 README·API 문서·환경변수 문서화가 필요한 새 표면은 없다.

## 위험도

LOW
