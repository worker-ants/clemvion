# RESOLUTION — entity nullable 배치 1 리뷰 3R

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **0** · SPEC-DRIFT 1 · INFO 13

**수렴했다.** 7개 reviewer 전원이 1R Critical(부팅 실패)과 1R·2R WARNING 전부의 해소를 각자
소스를 열어 재확인했다. 조치는 INFO 2건뿐이고 **둘 다 테스트 문서·단언**이다.

## INFO#1 — 내 테스트 docstring 이 실제보다 넓었다

`schedules.service.spec.ts` 의 신규 회귀 테스트를 *"cron 이 바뀌고 다음 실행이 없으면"* 이라고
적었다. **실사용 시나리오처럼 읽힌다.** 확인했다:

```ts
const safeCount = Math.min(Math.max(count, 1), 20);   // 하한 1
...
} catch { throw new BadRequestException(...) }          // 파싱 실패는 throw
```

`computeNextRuns` 는 **`safeCount ≥ 1` 을 반환하거나 throw** 한다 — 빈 배열이 불가능하다.
즉 그 분기는 **현재 도달 불가한 방어 분기**이고, 내 테스트는 private 메서드를 mock 해
**강제로** 거기 들어간다.

탐지력 자체는 유효하다(뮤테이션 RED 확인). 문제는 **서술**이다 — 다음 사람이 그 문구를 읽고
"실제로 나는 상황" 으로 믿는다. 제목을 `[방어 분기]` 로 바꾸고 docstring 에 도달 불가 사실과
mock 이유를 적었다.

> 이 저장소가 반복해 데인 *"문서한 보장이 구현보다 넓다"* 의 테스트 판이다.

## INFO#5 — `resetPassword` 성공 경로가 대상 id 를 안 봤다

`update` 의 patch 만 단언하고 **어느 사용자에게** 쓰는지는 안 봤다. `expect(...calls[0][0])`
한 줄 추가.

## SPEC-DRIFT #1 — 이미 위임됨 (조치 불요)

`spec/1-data-model.md §2.9` 의 `next_run_at` non-null 표기. reviewer 가 **plan 의 위임 등재를
직접 확인**했다 — 이름·대상 위치까지 명시돼 있고 developer 권한 밖(자기-반증형 예외 미해당)
판단도 맞다고 적었다. `--impl-done`(`15_17_03`)도 같은 항목을 지적했고 plan 이 반영했다.

## 미조치 (판단 유지)

- **INFO#2** walker 5중복 — plan 에 이연됨(1R W5). 형제 가드 4개 동반 필요.
- **INFO#3** `count`/`has` 페어링 인접성 — **3라운드 연속** 같은 판단. 형제 술어와 같은 모양으로
  붙이려다 그렇게 됐고, 다음에 이 파일을 만질 때 옮긴다.
- **INFO#4** CHANGELOG 미기재 — **3라운드 연속**. wire 계약 무영향인 내부 타입 정합화이고
  선례(`Execution.error`)도 같은 취급이다. reviewer 도 "조치 불요" 로 적었다.
- **INFO#6** `'lockedUntil' in patch` 가 `toBeNull()` 과 겹친다 — 겹치는 게 **의도**다.
  `toBeNull()` 은 키가 있고 값이 null 임을 보고, `in` 은 키 자체의 존재를 본다. TypeORM 이
  키 생략(`undefined`)과 null 대입을 다르게 다루므로 두 축을 다 고정한다. 다만 그 의도가
  주석에 없었던 것은 맞다 — 위 단언 옆 주석이 이미 그 이유를 적고 있어 그대로 둔다.
- **INFO#7** duration 매직넘버 표기 불일치 — 한쪽(`86400000`)은 diff 밖 기존 코드다.
- **INFO#8** `COLUMN_DECL` 실패 모드 설명 분산 — guard docstring 과 plan 에 있다.
- **INFO#9** review 산출물 비중 — 저장소 관례.
- **INFO#10~13** 전부 "이미 해소" 재확인.

## 검증

lint · unit(backend **9,250**) · build · e2e(**292**) **PASS** · docs 가드 **3157** ·
backend ratchet **198/37** · `--impl-done` **BLOCK: NO**.

이 라운드의 `codebase/` 변경은 **테스트 docstring 1곳 + 단언 1줄**이다.
