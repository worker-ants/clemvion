# 문서화(Documentation) 리뷰

## 컨텍스트

이번 리뷰 대상은 `entity-nullable-column-type-mismatch` 배치 1의 **3라운드 누적 diff**(57개 파일)다.
실질 코드/plan 변경은 파일 1~15(15개)뿐이고 나머지는 이전 두 코드리뷰 라운드
(`review/code/2026/09/03/14_44_15`, `15_17_01`, `15_36_03`)와 consistency-check 라운드
(`review/consistency/2026/09/03/15_17_03`)의 산출물이다. 세 라운드 모두 documentation 관점
리뷰가 이미 수행됐고(`14_44_15/documentation.md`, `15_17_01/documentation.md`), 그 라운드들이
낸 WARNING·INFO 는 이후 커밋(`52ca3128a`, `e78b6dbad`)에서 실제로 조치됐다. 이번 리뷰는 그
"조치됐다"는 주장을 프롬프트 텍스트가 아니라 **현재 워킹트리 파일을 직접 `Read`** 해 재검증하고,
독립적으로 남은 문서화 결함이 있는지 확인했다.

## 재검증 결과 (이전 라운드 WARNING/INFO 해소 여부)

- `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" 절에 `(d) Schedule.lastRunAt`,
  `(e) auth.service.spec.ts:58 의 lockedUntil 캐스트` 가 실제로 **이름으로 등재**되어 있다 —
  `15_17_01/documentation.md` WARNING이 정확히 지적했던 누락이 `52ca3128a`에서 해소됨을 직접 확인.
- `nullable-type-lie-cast-guard.ts`의 `collectScanTargets` docstring에서 "실측 12건" 같은 낡을 수
  있는 숫자가 제거되고, 검증되지 않는 숫자를 적지 않겠다는 원칙과 함께 `grep` 안내로 대체되어 있다.
- `auth.service.spec.ts`의 `verifyEmail` 신규 테스트에서 죽은 `usersService.findByEmail` mock이
  제거되어 있다(`grep`으로 해당 테스트 블록에 더 이상 없음을 확인).
- `schedules.service.spec.ts`의 신규 테스트 제목이 `[방어 분기]`로 정정되고, docstring에
  "현재 구현상 도달 불가능한 방어 분기다"라는 정확한 설명이 추가되어 있다 — 실제
  `computeNextRuns`/`schedule-runner.service.ts`의 `catch` 분기와 대조한 결과 서술이 정확하다.
  참고로 `schedule-runner.service.spec.ts` 쪽 catch 분기는 (cron 파싱 실패 시 실제로 런타임에
  도달 가능한 분기이므로) 별도 "방어 분기" 표기가 필요 없고, 현재도 붙어 있지 않다 — 두 테스트의
  라벨링이 실제 도달 가능성과 정확히 대응한다.
- `resetPassword` 성공 경로 테스트에 대상 `id` 단언(`usersService.update.mock.calls[0][0]`)이
  추가되어 있다.

이전 라운드가 이미 여러 reviewer(보안·유지보수성·테스트·문서화)의 실행/뮤테이션 검증을 거쳤고,
이번 재확인에서도 어긋나는 지점을 찾지 못했다.

## 발견사항

- **[INFO]** `source-scan.ts`의 신규 함수 쌍이 기존 count/has 페어링 인접성을 깨는 상태가 3라운드
  연속 유지되고 있다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`countRawUpdateReturning`
    112행 → 신규 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast` 158~168행 →
    `hasRawUpdateReturning` 171행)
  - 상세: 파일 헤더의 `{@link}` 주석 관례(`count` 정의 바로 아래 그 `has` 래퍼)를 이번 diff가
    끼워넣기로 깬 상태다. 세 라운드 모두 "다음에 이 파일을 만질 때 파일 끝으로 옮긴다"로 판단을
    유지했고, 코드 정확성에는 영향이 없다. 새 결함은 아니나, 리뷰 세션이 끝나기 전 이번에 정리해도
    비용이 낮은 자리(2개 함수 12줄 이동)라는 점은 다시 짚어 둔다.
  - 제안: 조치 불요(기존 결정 유지). 다음 편집 시 새 함수 쌍을 파일 끝으로 이동.

- **[INFO]** 이번 배치(타입 확장 8건 + `type: 'varchar'` 보강 4건 + 회귀 가드 신설)가
  `CHANGELOG.md`에 반영되지 않은 상태가 3라운드 동안 유지되고 있다
  - 위치: `CHANGELOG.md:63` (`Execution.error` 선례 — 정확히 같은 클래스의 이전 정정이 "부수로"
    문단으로 기록돼 있음을 재확인) vs 이번 diff에는 대응 항목 없음
  - 상세: 세 라운드 모두 "wire-facing 동작 변화가 아니라 필수는 아니다"로 판단을 유지했다.
    선례가 존재하는데 이번엔 안 남긴 이유(순수 내부 타입 정합화)가 문서화돼 있어 독자가 판단
    근거를 추적할 수 있으므로 판단 유지에 동의한다.
  - 제안: 조치 불요. 배치 전체(2·3…)가 끝나는 시점에 한 줄 요약을 남기는 것을 고려할 수 있음.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md`의 §2.9 정정 위임이
  "developer 권한 밖"이라고 명시하며 planner 턴으로 정확히 넘겨져 있다 — 결함 아님, 문서화 우수
  사례로 기록
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`
  - 상세: `spec/1-data-model.md §2.9`의 `next_run_at` 비-nullable 표기가 실제 nullable 계약과
    어긋난다는 사실을, CLAUDE.md의 "자기-반증형 소정정" 다섯 조건(대상 문장을 developer 자신이
    쓴 것이 아님) 중 조건 1을 스스로 검토해 예외 대상이 아니라고 정확히 판단하고 planner 턴으로
    명시 이관했다. `consistency-check`(WARNING #1)·`--impl-done`도 같은 항목을 지적했고 plan이
    이를 반영한 상태다.
  - 제안: 없음(정보 제공).

## 요약

3라운드에 걸쳐 이미 다른 documentation 리뷰어가 발견한 WARNING 1건(RESOLUTION의 "추적한다"
주장과 실제 plan 등재 여부 불일치)과 사소한 INFO들이 이후 커밋(`52ca3128a`, `e78b6dbad`)에서
실제로 조치됐음을 프롬프트 텍스트가 아니라 현재 워킹트리 파일을 직접 열어 재검증했다 — 전부
일치했다. 신규 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/
`findCastOffenders`/`findUntypedNullableColumns`)와 신규 가드 spec은 "왜 필요한가·왜 이
위치인가·무엇을 못 보는가·과거에 무엇이 틀렸었는가"를 촘촘히 남긴, 이 저장소 평균 이상의
문서화 밀도를 유지한다. 테스트 docstring의 "도달 불가능한 방어 분기"와 "실제 도달 가능한 catch
분기"를 정확히 구분해 서술하는 점도 이 저장소가 반복해 겪은 "문서한 보장이 구현보다 넓다" 결함
클래스를 스스로 예방한 사례다. 남은 것은 3라운드 내내 "판단 유지"로 명시적으로 이연된 INFO 2건
(count/has 페어링 인접성, CHANGELOG 미기재)뿐이며 둘 다 근거가 문서화돼 있어 새로 차단할 사유가
아니다. CRITICAL/WARNING 없음.

## 위험도

NONE
