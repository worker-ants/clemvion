# 유지보수성(Maintainability) 리뷰 — deps-guard (11차 라운드, `08_20_09`)

## 리뷰 대상 범위

router 가 넘긴 14개 파일 중 실제 프로덕션 코드는 2개뿐이다.

- `scripts/check-override-floors.py` — 최신 커밋 `f71be98d8`("축 3(ignoreCves 억제분 추적) 철회")
  반영 후 상태. 직전 라운드(`06_03_11`) requirement 리뷰의 CRITICAL 2건(스키마 드리프트 오판,
  widened/`EXPECTED_SUPPRESSED_PATHS` 죽은 코드)에 대한 응답으로 `widened` 계산·
  `EXPECTED_SUPPRESSED_PATHS`·`_report_widened()`·`classify_vulnerable()`의 `actions[]` 소비
  경로가 전량 삭제됐다.
- `scripts/check-pnpm-security-config.py` — `EXPECTED_IGNORED_CVES` 를 빈 `set[str]` 로 교체 +
  근거 주석 추가(2줄 diff).

나머지 12개 파일(`review/code/2026/08/01/05_36_28/testing.md`,
`review/code/2026/08/01/06_03_11/{SUMMARY.md,_retry_state.json,documentation.md,
maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md,
user_guide_sync.md}`)는 이전 라운드의 리뷰 산출물 markdown/JSON이다. 산문 리포트·머신 상태
파일이라 함수 길이·네이밍·중첩·매직 넘버·중복·순환 복잡도 같은 코드 구조 관점이 적용되지
않는다(선례: `06_03_11/maintainability.md` 자신이 같은 판단을 이미 명시했고, 이번 라운드도
그 판단을 유지한다). 별도 발견사항 없음.

## 발견사항

- **[INFO]**(긍정 관측, 이전 WARNING 해소) `main()`의 책임 과다 문제가 이번 라운드 커밋으로
  사실상 해소됐다 — `06_03_11` maintainability 리뷰의 WARNING("`main()`이 오케스트레이션과
  두 개의 비트리비얼 도메인 로직(widened diff, eroded 상관분석)을 겸함")이 "추출" 이 아니라
  "메커니즘 자체 삭제" 로 근본 해결됐다.
  - 위치: `scripts/check-override-floors.py:252-280`(`main()`, 이전 WARNING이 지적한 위치는
    옛 `:297-342`)
  - 상세: `f71be98d8`가 직전 라운드 requirement 리뷰의 CRITICAL(widened/
    `EXPECTED_SUPPRESSED_PATHS` 메커니즘이 실제 pnpm 동작과 어긋나 발동 불가능한 죽은
    코드)에 응답해 widened 계산 루프(set 차집합 + `EXPECTED_SUPPRESSED_PATHS.get()`)·
    `_report_widened()`·`classify_vulnerable()`의 `suppressed`/`actions[]` 소비 경로를
    전부 제거했다. 직접 `grep -n "widened\|EXPECTED_SUPPRESSED_PATHS\|_report_widened"
    scripts/check-override-floors.py`로 대조해 댕글링 참조 0건을 확인했다 — 깨끗한 삭제다.
    그 결과 `main()`은 이제 존재 확인 → `load_override_targets` → `run_audit` →
    `classify_vulnerable` → `patched_by_module` 컴프리헨션 → `eroded` 컴프리헨션(단순
    필터 1개) → OK/에러 분기 1개로 줄어, 남은 인라인 로직은 4줄짜리 필터 컴프리헨션
    하나뿐이다(`:266-270`). `classify_vulnerable()`의 반환 타입도
    `tuple[dict[str, str], dict[str, list[str]]]` → `dict[str, str]`로 단순화됐다(`:220`).
    이전 WARNING이 제안한 "이름 있는 함수로 추출"이 아니라 "메커니즘 자체 삭제"로 응답한
    셈이라, 남은 `eroded` 컴프리헨션까지 추가로 추출할지는 이제 순수 선호의 문제다.
  - 제안: 조치 불요. 여유가 있으면 대칭성을 위해 `eroded` 계산도
    `_correlate_eroded(reported, targets, patched_by_module)`로 뽑아 `override_target`/
    `run_audit`처럼 직접 단위 테스트 가능하게 할 수 있으나, 지금 상태(4줄 필터
    컴프리헨션)도 그 자체로 읽기 쉬워 필수는 아니다.

- **[INFO]** `run_audit()`가 여전히 `actions` 키의 **존재**를 응답 형태 정상성의 판정
  기준으로 요구하는데, 바로 아래 `classify_vulnerable()`의 docstring은 "`actions[]`는 읽지
  않는다"를 굵게 강조한다 — 두 함수를 따로 읽으면 "그럼 왜 아직 `actions` 존재를 요구하나"
  라는 의문이 남는다. 직전 라운드의 CRITICAL 2건이 모두 `actions[]` 해석을 둘러싼 것이었던
  이력을 고려하면, 이 필드는 유독 근거를 명시적으로 남겨둘 가치가 있다.
  - 위치: `scripts/check-override-floors.py:210-216`(`if not isinstance(data, dict) or
    "actions" not in data:` 및 이어지는 `_undecidable(...)`), 대조 지점 `:223`
    (`classify_vulnerable()` docstring, `**actions[] 는 읽지 않는다.**`), 참고
    `:239-242`(다른 이유를 설명하는 인접 주석)
  - 상세: `run_audit()`의 검사 자체는 여전히 유효하다 — 정상 pnpm 응답이 `actions`/
    `advisories`/`metadata`를 함께 갖는다는 관측(주석 `:211`)에 기반한 스키마 형태
    점검이지, `actions[]`의 **내용**을 소비하겠다는 뜻이 아니다. 하지만 "존재는
    검사하되 내용은 안 읽는다"는 이 구분이 `run_audit()` 정의부 어디에도 명시돼 있지
    않다. `classify_vulnerable()` 쪽 주석(`:239-242`)도 이 질문에 답하는 게 아니라
    "`advisories` 하위 필드명 드리프트"라는 별개 이유를 설명한다. `f71be98d8` 커밋으로
    `actions[]` 내용 소비가 완전히 사라진 지금, `run_audit()`의 `"actions" not in data`
    검사만 남아 있는 이유를 그 자리에서 바로 알기 어렵다 — 향후 누군가 "actions 를
    검사하니 다시 써도 되겠다"고 오인해 방금 삭제된 로직을 재도입할 여지를 열어둔다.
  - 제안: `run_audit()`의 `:211` 주석에 한 줄만 추가 — 예: "actions 는 존재만 확인한다.
    내용은 더 이상 어디서도 읽지 않는다(`classify_vulnerable()` 참고, 근거: plan §축 3
    철회)." 필수는 아니지만, `actions[]`가 이 파일에서 두 차례 CRITICAL을 낸 이력이 있는
    필드라 향후 재도입 시도를 막는 데 저비용 고가치.

- **[INFO]**(carried, `06_03_11` 유지, 새 근거 없음) `pnpm audit` 호출의 심각도 임계값
  (`"--audit-level=moderate"`)이 다른 튜닝 상수(`_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/
  `_KEY_PREVIEW`/`_AUDIT_TIMEOUT_SEC`)와 달리 이름 붙은 상수가 아니고 근거 주석도 없다 —
  이번 라운드 diff(`f71be98d8`)도 이 줄을 건드리지 않아 그대로 남아 있다.
  - 위치: `scripts/check-override-floors.py:182`
    (`["pnpm", "audit", "--audit-level=moderate", "--json"]`)
  - 상세: `06_03_11` 라운드의 maintainability 리뷰가 이미 지적했고(그 라운드가
    `.github/workflows/deps-security-checks.yml`의 기존 audit 잡과 동일 값임을 대조
    확인함), 이번 라운드 diff는 이 줄을 변경하지 않아 새 근거나 위험 변화가 없다. 값
    자체는 안전하고 임의로 고른 매직 넘버는 아니다.
  - 제안: 급하지 않음(carried). 여유가 있을 때
    `# .github/workflows/deps-security-checks.yml 의 audit 잡과 동일 임계값` 한 줄 주석
    또는 `_AUDIT_LEVEL = "moderate"` 명명 상수 승격.

## `check-pnpm-security-config.py` 관측 (발견사항 아님)

`EXPECTED_IGNORED_CVES`를 빈 `set[str] = set()`로 바꾸며 "왜 비어 있는지 + 되살릴 때 무엇과
함께 고쳐야 하는지"를 설명하는 2줄 주석을 추가했다(`:75-78`) — 기존 파일의 다른 `EXPECTED_*`
상수들과 같은 "근거 주석" 관례를 그대로 따른다. 빈 컬렉션 리터럴(`set()`)에 명시적
`set[str]` 타입 힌트를 단 것도 타입 추론 한계(빈 리터럴은 원소 타입을 못 알아냄)를 정확히
보완한 적절한 선택이다. 발견사항 없음.

## 요약

이번 라운드의 실질 코드 델타(`f71be98d8`)는 유지보수성 관점에서 순수한 개선이다 — 직전
라운드가 "항상 발동 불가능한 죽은 코드"로 지목한 widened/`EXPECTED_SUPPRESSED_PATHS`
메커니즘을 정확히 삭제해, 그 메커니즘의 dead-weight 복잡도(집합 연산·별도 보고 함수·
`actions[]` 부가 스키마 검사)를 통째로 걷어냈다. 부수 효과로 `06_03_11` maintainability
라운드가 냈던 유일한 WARNING(`main()`의 책임 과다)도 사실상 해소됐다 — 남은 인라인 로직은
4줄짜리 단순 필터 컴프리헨션 하나뿐이라 더 이상 "비트리비얼 도메인 로직 2개를 겸한다"는
지적이 성립하지 않는다. `grep`으로 widened/suppressed 관련 댕글링 참조가 없음을 직접
확인했다. 새로 남긴 관찰은 두 가지뿐이다 — (1) `run_audit()`가 여전히 `actions` 키
존재를 요구하는데 그 옆 함수는 "actions[]는 안 읽는다"를 명시해, 두 함수를 따로 읽으면
의도가 즉시 드러나지 않는다(INFO, 저비용 고가치 — 이 필드가 직전 라운드 CRITICAL 2건의
중심이었던 이력 때문에 특히), (2) `--audit-level=moderate`가 다른 튜닝 상수와 달리 근거
주석 없는 인라인 문자열이라는 `06_03_11`의 INFO가 이번 diff에서 건드려지지 않아 그대로
이월된다. `scripts/check-pnpm-security-config.py`의 변경(빈 집합 + 근거 주석 + 명시적
타입 힌트)도 기존 관례와 정확히 일치해 발견사항이 없다. 나머지 12개 파일은 전부 이전
라운드의 리뷰 산출물(markdown/JSON)이라 코드 구조 관점이 적용되지 않는다.

## 위험도

LOW — Critical·Warning 없음. INFO 3건 중 1건은 이전 WARNING의 해소를 확인하는 긍정 관측,
1건은 저비용 명확화 제안(신규), 1건은 이전 라운드부터 이월된 낮은 우선순위 항목이다. 이번
라운드의 실질 변경은 복잡도를 늘리지 않고 오히려 줄이는 방향(죽은 코드 삭제)이라 유지보수성
리스크는 낮다.
