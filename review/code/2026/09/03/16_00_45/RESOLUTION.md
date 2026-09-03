# RESOLUTION — entity nullable 배치 1 리뷰 4R (최종)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **0** · SPEC-DRIFT 1 · INFO 20

**조치 없음 — 수렴.** 7개 reviewer 전원이 1R Critical(부팅 실패)과 1R~3R WARNING 전부의
해소를 각자 소스 열람·`grep`·테스트 실행(120/120 PASS)으로 재확인했다.

## SPEC-DRIFT #1 — 이미 위임됨 (조치 불요)

`spec/1-data-model.md:260` 의 `next_run_at` non-null 표기. **코드가 맞고 spec 표가 낡았다** —
DB 컬럼에 제약이 없고 런타임이 이전부터 `null` 을 대입해 왔다.

reviewer 가 **위임 등재를 직접 확인**했고, developer 권한 밖(자기-반증형 소정정 조건 1 미충족)
판단도 맞다고 적었다. documentation reviewer 는 그 위임 서술을 *"문서화 우수 사례"* 로 기록했다.

## 왜 이 라운드에 조치가 없나

3R 이 Critical 0 · Warning 0 으로 수렴했고, 그 뒤 변경은 **테스트 docstring 1곳 + 단언 1줄**
뿐이다. 이 라운드는 그 2줄이 새 결함을 만들지 않았음을 확인하는 자리였다.

INFO 20건 중 **신규는 2건**(`create()`/`update()` 의 `undefined` vs `null` 표기 불일치 —
pre-existing 이고 무해, `findUntypedNullableColumns` 순환 복잡도 경계선)이고 나머지는 전부
이전 라운드의 재확인이거나 이미 plan 에 이름으로 등재된 이연 항목이다.

## 미조치 (판단 유지 — 전부 근거가 문서화돼 있다)

| INFO | 판단 |
|---|---|
| #3 `create()` 의 `undefined` vs `update()` 의 `null` | **이번 diff 밖** pre-existing. INSERT 경로라 결과 동일해 무해. `create()` 를 만질 때 통일 |
| #4 `Schedule.lastRunAt` 비대칭 | plan 에 **배치 2 후보 (d)** 로 이름 등재됨 |
| #12 walker 5중복 | plan 에 이연(1R W5). 형제 가드 4개 동반 필요 |
| #13 `count`/`has` 인접성 | **4라운드 연속** 같은 판단. 다음에 이 파일을 만질 때 |
| #15 시간 매직넘버 | 한쪽은 diff 밖 기존 코드 |
| #16 `findUntypedNullableColumns` 복잡도 | 조건이 하나 더 늘면 `isExempt()` 로 분리 |
| #17 다중 offender 미검증 | **4라운드 연속**. 실사용(153+ 파일 전수 스캔) 위험 낮음 |
| #19 CHANGELOG | **4라운드 연속**. wire 계약 무영향, 선례(`Execution.error`)도 같은 취급 |

## 검증

lint · unit(backend **9,250**) · build · e2e(**292**) **PASS** · docs 가드 **3157** ·
backend ratchet **198/37** · `--impl-done` **BLOCK: NO**.

> e2e 는 한 번 실패했다 — **코드가 아니라 디스크**였다(postgres `initdb`:
> `No space left on device`, Docker 빌드 캐시 33.5GB). 컨테이너 로그로 원인을 확인하고
> `builder prune`+`image prune` 으로 45.8GB 회수 후 재실행해 PASS.
