# 변경 범위(Scope) 리뷰 — `23_36_13`

## 대상 diff 요약

`origin/main..HEAD` 전체(16 파일)를 확인. 실제 커밋 2개(`22e68459d` fix, `eb752e0e6` docs)로
구성되며, 프롬프트에 담긴 diff 는 그 누적분과 정확히 일치한다(파일 목록·라인 수 대조 완료,
숨은 파일 없음).

- **프로덕션 코드**: `idempotency.interceptor.ts` — 캐시 엔트리 **안쪽** `responseJson` 파싱이
  재현 분기 두 자리에서 맨몸으로 이뤄져 손상 시 `SyntaxError`가 500 으로 마스킹되던 결함을
  `discardCorruptEntry()` 로 통합 처리.
- **테스트**: `idempotency.interceptor.spec.ts` — 신규 4건(엔트리 손상 warn, 안쪽 손상 성공 분기,
  순서 캐너리, 안쪽 손상 에러(409) 분기).
- **문서**: `CHANGELOG.md` 신규 Unreleased 항목, 클래스 docstring 3경로→5경로 표로 갱신.
- **plan**: `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 체크박스 완료 표시 + 완료 기록.
- **review 산출물**: `review/code/2026/08/12/23_24_08/**` (RESOLUTION.md 포함 전체 세션) — 이 저장소의
  표준 리뷰 파이프라인이 세션 디렉토리 전체를 커밋하는 관례(리뷰 산출물은 gitignore 대상 아님)와
  일치.

모든 항목이 "엔트리 내부 `responseJson` 손상 방어" 라는 단일 의도(plan 체크리스트 항목)에
수렴한다. 무관한 파일·영역 수정, 사용하지 않는 import 추가, 의미 없는 포맷팅 변경은 발견되지
않았다.

## 발견사항

- **[INFO]** 바깥(엔트리) JSON 손상 경로에 이번 diff 에서 처음으로 warn 로그가 추가됐다 —
  PR/plan 표제("**내부** `responseJson` 손상")보다 한 칸 넓은 변경이다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:161`
    (`return this.discardCorruptEntry('엔트리', err, processFresh);`)
  - 상세: 종전에는 바깥 JSON 파싱 실패 시 조용히 신규 처리로 강등됐고 warn 이 없었다. 이번
    리팩터로 `discardCorruptEntry()` 공유 경로에 들어가면서 엔트리 손상도 payload 손상과
    동일하게 warn 을 남기게 됐다. 같은 클래스(조용한 강등)의 결함이고 5줄 안의 변경이라
    범위 이탈로 보기는 어렵지만, 엄밀히는 "안쪽만 고친다"던 원 의도보다 넓다. 직전 리뷰
    라운드(`review/code/2026/08/12/23_24_08/SUMMARY.md` INFO #9)에서 이미 지적됐고 개발자가
    "수용"으로 처분한 항목이라 재조치를 요구하지 않는다.
  - 제안: 조치 불요(이미 처분됨). 다만 plan 항목 제목을 향후 "손상 처리 전체"로 넓게 적으면
    같은 재확인 비용을 줄일 수 있다는 기존 제안을 따르는 것이 좋다.

- **[INFO]** 클래스 docstring 의 fail-open 경로 표를 "세 경로"에서 "다섯 경로"로 갱신하면서,
  이번 diff 와 무관하게 **선재**했던 "직렬화 실패" 누락 항목까지 함께 바로잡았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:62-71`
  - 상세: 커밋 메시지 스스로도 "종전에는 세 경로였는데 실제로는 직렬화 실패가 이미 빠져있었다"고
    밝히고 있어 은폐된 변경이 아니다. 이번 diff 가 두 경로(엔트리/payload 손상)를 새로 추가하며
    문서와 코드가 더 벌어지는 것을 막기 위한 정합화이며, 손댄 docstring 자체가 이번 fix 의
    직접 대상이라 범위 밖 리팩터로 보지 않는다.
  - 제안: 없음(정당한 수정).

## 요약

리뷰 대상 16파일 중 실질 변경은 인터셉터 프로덕션 코드·테스트·CHANGELOG·plan 체크리스트
4파일뿐이며, 전부 "캐시 엔트리 내부 `responseJson` 손상 방어"라는 단일 plan 항목에 정확히
대응한다. 나머지 12파일은 이 저장소의 표준 관례에 따라 커밋되는 직전 리뷰 세션(`23_24_08`)의
산출물로, scope 이탈이 아니라 워크플로 산출물이다. `switchMap` 내부의 `processFresh`/
`discardCorruptEntry` 추출은 세 자리에 흩어져 있던 "신규 처리" 로직을 하나로 모으기 위한
최소 리팩터로, 요청받은 수정 없이는 성립하지 않는 변경이라 불필요한 리팩터링으로 보지 않는다.
발견된 두 건은 모두 INFO 수준이며 그중 하나(바깥 엔트리 warn 확장)는 직전 리뷰 라운드에서
이미 지적·처분(수용)된 항목이라 재조치가 필요하지 않다. 포맷팅·주석·import·설정 변경 중 실질
변경과 무관하게 섞인 것은 없었다.

## 위험도
NONE
