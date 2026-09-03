# 문서화(Documentation) 리뷰

## 사전 확인 사항

이 diff(`origin/main`(`d8b7cb93e`)..`HEAD`(`34ce41086`))는 이미 **9차례의 리뷰-수정 라운드**를
거친 결과물이며, 문서화 관점은 8R(`04_18_01`)·9R(`04_37_28`)에서 이미 NONE 으로 수렴한
상태였다. 이번 10R 에서 새로 검토할 실질 변경은 직전 커밋(`34ce41086`, 리뷰 9R 조치)
하나뿐이다 — `nullable-type-lie-cast.spec.ts`(중복 스캔 제거, W1)와
`plan/in-progress/entity-nullable-column-type-mismatch.md`(체크박스 정정, W2). 나머지
파일(1~9의 소스, 10번대 이후의 이전 라운드 산출물)은 이전 라운드에서 이미 문서화 관점으로
확인이 끝났고 이번 커밋에서 변경되지 않았다.

소스를 직접 열어 9R 조치를 재확인했다:

- `nullable-type-lie-cast.spec.ts` `저장소 전수` 블록: `collectTsFiles(SRC_ROOT, { includeSpec: true })` 를
  한 번만 불러 `all` 을 만들고 `entities`/`specs` 를 `.filter()` 로 파생한다. 바로 위 3줄 주석이
  "왜 한 번만 부르는지"(상위집합 관계) · "무엇을 실측했는지"(entities 41 · specs 443) · "어느
  리뷰가 지적했는지"(9R W1) 를 정확히 설명하고, 실제로 `find … -name '*.entity.ts' | wc -l` =
  41, `*.spec.ts` = 443 으로 그 수치와 일치함을 직접 재실측해 확인했다. 코드-주석 불일치 없음.
- `plan/in-progress/entity-nullable-column-type-mismatch.md`: "한 자리만 고치는 버릇" 표가
  7행이고 헤딩·본문 모두 "일곱" 으로 일관되게 갱신돼 있다(`grep`으로 "여섯"/"일곱" 잔존 위치
  전수 확인 — 6번 항목 텍스트 안의 "여섯 다"만 "일곱 다"로 정확히 치환됐고 누락된 자리 없음).
  "가드 사각지대" 체크박스는 `[x]` 로 바뀌었고, 원문 근거("텍스트 스캔으로는 부족하다")를
  취소선 없이 인용하면서 그 판단이 반증된 경위(`widenedEntityFields`+`findStaleSpecCasts`가
  바로 그 역추적을 한다)를 이어 붙였다 — 회고형 정정 관례(CLAUDE.md §자기-반증형 소정정과
  유사한 서술 패턴)를 잘 따른다.

## 발견사항

새로 보고할 CRITICAL/WARNING 은 없다. 참고로만 남긴다.

- **[INFO]** 직전 라운드(9R) 문서화 리포트의 "잔여 planner-턴 항목 2건" 이라는 서술이 실측과
  다르다 — 다만 이 diff 의 변경 대상은 아니다
  - 위치: `review/code/2026/09/04/04_37_28/documentation.md` (요약, "남은 `[ ]` planner-턴
    항목 2건과 일치" 문구) — 이 파일 자체가 이번 diff 로 신규 커밋된 리뷰 산출물이다.
  - 상세: `plan/in-progress/entity-nullable-column-type-mismatch.md` 를 `grep -n '^\- \[ \]'`
    로 직접 세면 planner-턴 미완료 항목이 **3건**이다(§2.9 `next_run_at` 표기, §2.2
    `/api/auth/*` 인가, §5.4 `field?:` 표기). 다만 이 세 항목 모두 `git log -S` 로 확인 결과
    이 diff 의 base(`origin/main` = `d8b7cb93e`) 이전 커밋(`255aa8597` 등)에서 이미
    존재하던 서술이라 **이번 changeset 이 만든 drift 가 아니다** — 9R 리포트가 개수를
    잘못 세었을 뿐, 코드/plan 문서 자체에는 결함이 없다. `review/**` 산출물은 시점 스냅샷
    기록이라 사후 정정 대상이 아니라고 판단해 조치를 요구하지 않는다.
  - 제안: 조치 불필요(참고 기록). 향후 이 plan 문서가 `complete/` 로 이동할 때 잔여 planner
    항목 개수를 다시 정확히 세면 된다.

- **[INFO]** (9R 이전부터 이월) `masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`
  의 walker 위임 함수 한 줄 docstring이 `.d.ts` 제외를 언급하지 않음 — 8R·9R 에서 이미
  검토·유예된 항목이며 이번 라운드에서 재확인 결과 여전히 실질 위험 없음(`.d.ts` 는 `src`
  하위 0개, `source-scan.ts` 자체 docstring 에 근거 기재). 재조치 요구하지 않는다.

## 요약

이번 diff 는 9라운드의 리뷰-수정을 거쳐 문서화 관점에서 이미 수렴했고, 이번에 새로 검토한
직전 커밋(9R 조치 — 중복 스캔 제거 W1, plan 체크박스 정정 W2)은 둘 다 코드/문서가 정확히
일치한다: 스캔 중복 제거 주석은 실측치(entities 41·specs 443)를 인용하며 그 수치가 실제
저장소 상태와 일치했고, plan 문서의 표·헤딩·체크박스는 "일곱 번째" 로 빠짐없이 동기화됐다.
새로 보고할 CRITICAL/WARNING 은 없다. 유일하게 기록할 점은 직전 라운드(9R) 리뷰 산출물
자신의 요약 문구("잔여 planner-턴 2건")가 실측(3건)과 다르다는 것인데, 이는 이번 diff 가
만든 코드/plan 결함이 아니라 그 항목들이 diff 범위 밖(origin/main 이전)에서 이미 존재했던
것을 리뷰 산출물이 잘못 요약한 것이라 조치 대상이 아니다. README/CHANGELOG 는 이 diff
범위(내부 test-utils/repo-guards 리팩터 + plan 문서 갱신, API/동작 영향 없음)에서 갱신
대상이 아니며 `CHANGELOG.md` 관례(동작·계약 영향이 있는 항목만 기재)와도 일치한다.

## 위험도

NONE
