# 부작용(Side Effect) 리뷰 — deps-guard 11차 라운드 (`08_20_09`)

## 스코프 메모

router 가 이번 라운드에 넘긴 14개 파일 중 실행되는 코드는 2개뿐이다 — `scripts/check-override-floors.py`
(303줄, 신규)와 `scripts/check-pnpm-security-config.py`(7줄 diff, 기존 파일 수정). 나머지 12개는
전부 `review/code/2026/08/01/{05_36_28,06_03_11}/` 하위의 리뷰 산출물(markdown/json)로, 실행되지
않는 정적 문서다 — 이 리뷰 체인이 지난 10개 라운드 동안 반복 확인해 온 결론과 동일하게 부작용
관점에서 검토 대상이 아니다(코드 실행 경로 없음, `code-review-agents` 스킬의 정해진 산출 경로에
부합).

실질 분석은 `git log -1`(HEAD = `f71be98d8` "축 3(ignoreCves 억제분 추적) 철회 + stale ignoreCves
2건 제거")과 `git show f71be98d8 -- scripts/check-override-floors.py
scripts/check-pnpm-security-config.py` 로 직전 라운드(`06_03_11`) 이후의 실제 델타를 직접 대조하는
데 집중했다. 이 커밋은 `06_03_11` 라운드의 requirement 리뷰어가 낸 CRITICAL 2건 중 하나
(`widened`/`EXPECTED_SUPPRESSED_PATHS` 가 실 registry 에서 항상 발동 불가능한 죽은 코드)를 **재설계가
아니라 제거**로 처리했다 — 이 리뷰는 그 제거 자체가 새 부작용을 들이지 않았는지를 검증했다.
`.claude/tests/test_override_floors.py`·`pnpm-workspace.yaml`·`PROJECT.md`·`.github/workflows/*.yml`
는 이번 라운드도 router 파일 목록 밖이라(과거 라운드와 동일한 `.claude/**`/설정 파일 제외 패턴)
정보 컨텍스트로만 `Read`/`grep` 참조했다.

## 발견사항

- **[INFO]**(긍정 관측, 이월 항목 종결) `06_03_11/side_effect.md` 가 "현재는 안전하지만 향후 실수로
  mutate 될 여지"로 INFO 기록했던 mutable 전역 `EXPECTED_SUPPRESSED_PATHS: dict[str, set[str]]` 가
  이번 커밋에서 **완전히 삭제**됐다 — 더 이상 이월할 대상이 아니다.
  - 위치: 삭제된 대상이라 현재 파일에 인용할 게이트가 없음(직접 `git show f71be98d8 --
    scripts/check-override-floors.py` 로 확인). 이전 위치 참고: `review/code/2026/08/01/06_03_11/
    side_effect.md:72-81`(원 INFO). 현재 남은 전역 상수 선언부는
    `scripts/check-override-floors.py:57-64`(`_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/`_KEY_PREVIEW`/
    `_AUDIT_TIMEOUT_SEC`, 전부 스칼라 상수) — mutable 컨테이너 타입 전역은 현재 파일에 0개임을
    `grep -n "^[A-Z_]* *[:=]" scripts/check-override-floors.py` 로 재확인했다.
  - 상세: `EXPECTED_SUPPRESSED_PATHS` 와 그것을 읽던 `main()` 의 `widened` 계산 루프,
    `_report_widened()` 가 커밋 `f71be98d8`으로 함께 제거됐다. 남은 전역은 전부 읽기 전용
    스칼라(문자열/정수) 상수이거나 컴파일된 정규식(`_NAME_CHAR`/`_INNER_SPACE`/`_RANGE_SUFFIX`,
    이전 라운드들이 이미 안전 확인) 뿐이다.
  - 제안: 조치 불요(확인 기록).

- **[INFO]** `classify_vulnerable()` 의 반환 시그니처가 `tuple[dict[str, str], dict[str, list[str]]]`
  (`(reported, suppressed)`) 에서 `dict[str, str]`(`reported` 단독) 로 축소됐다 — 시그니처 변경이지만
  이 파일 밖으로 노출되는 인터페이스가 아니라 영향받는 외부 호출자가 없음을 확인했다.
  - 위치: `scripts/check-override-floors.py:220`(`def classify_vulnerable(audit: dict) -> dict[str,
    str]:`), 유일한 프로덕션 호출부는 `:259`(`reported = classify_vulnerable(audit)`, `main()` 내부)
  - 상세: 이 함수는 모듈 내부 전용이며(`__all__` 없음, 다른 스크립트가 `import` 하는 사례 없음 —
    `grep -rln "check-override-floors\|check_override_floors"` 결과 `.claude/tests/
    test_override_floors.py`(importlib 로 모듈 자체를 로드해 테스트)와 두 워크플로 YAML(CLI 로
    `python3 scripts/check-override-floors.py` 실행, 함수 직접 호출 아님)뿐), 시그니처를 바꾼 같은
    커밋이 유일한 프로덕션 호출부(`main()`)도 함께 갱신했다. `grep -n "classify_vulnerable"
    .claude/tests/test_override_floors.py` 결과 0건 — 이 함수를 이름으로 직접 호출해 옛 2-tuple
    언패킹을 기대하는 테스트도 없어(스텁 `pnpm` 을 PATH 에 심어 스크립트를 서브프로세스로 실행하는
    통합 테스트 방식) 깨지는 호출자가 없다. 커밋 메시지의 "하네스 757건 OK" 도 이와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `run_audit()` 의 응답-형태 검증(`"actions" not in data`)이 `classify_vulnerable()` 가
  더 이상 `actions[]` 를 전혀 읽지 않는 지금도 그대로 남아 있어, 검증 대상과 실제 소비 대상이
  어긋난 상태다 — 다만 방향이 fail-closed 라 안전성 저하는 아니다.
  - 위치: `scripts/check-override-floors.py:210-217`(`run_audit()`, `if not isinstance(data, dict) or
    "actions" not in data:`), `:220-229`(`classify_vulnerable()` 새 docstring 1행 —
    "`actions[]` 는 읽지 않는다")
  - 상세: 이 커밋 이전에는 `actions` 존재 검사가 실제로 그 아래에서 소비되는 데이터(모듈명 스키마
    드리프트 검사, `suppressed` 계산)를 지키는 의미 있는 게이트였다. 이번 커밋이 그 소비 코드를
    전부 제거하면서도 `run_audit()` 자신의 검사는 손대지 않아, 지금은 "`advisories` 만 실제로
    쓰는데 존재 검사는 `actions` 키만 본다"는 내적 불일치가 남았다. 이 자체가 새 위험을 만들지는
    않는다 — pnpm 이 `actions` 키를 없애면(현재 소비하지도 않는 필드) 여전히 fail-closed(exit 2)
    로 끝나 "조용한 통과" 방향이 아니고, 반대로 `advisories` 키 자체가 통째로 사라지는 시나리오는
    `audit.get("advisories") or {}` 폴백이 이 커밋 이전부터 동일했던 기존 동작이라 이번 델타가
    새로 들인 것이 아니다(가정적 미래 pnpm 스키마 변경에 대한 잔여 위험이며, 지난 10개 라운드가
    실 registry 재현으로 검증한 두 CRITICAL 과 달리 이번 라운드에서 재현하지 못해 추측 수준으로만
    기록한다).
  - 제안: 급하지 않음. 여유가 있으면 `run_audit()` 의 검사 대상을 `classify_vulnerable()` 가 실제로
    쓰는 `"advisories"` 로 맞추거나(`"actions"` 대신/추가로), 최소한 이 존재검사가 왜 아직 `actions`
    를 보는지 주석으로 남겨 다음 라운드가 "죽은 검증"으로 오인해 지우지 않게 한다.

- **[INFO]** `scripts/check-pnpm-security-config.py` 의 `EXPECTED_IGNORED_CVES` 값이 2건(`CVE-2026-
  53550`, `CVE-2026-14257`)에서 빈 `set()` 으로 바뀌었다 — 여전히 읽기 전용으로만 쓰이고,
  `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 도 함께 비워져 2-place 규약이 지켜졌음을
  직접 대조 확인했다.
  - 위치: `scripts/check-pnpm-security-config.py:76-78`(`EXPECTED_IGNORED_CVES: set[str] = set()`)
  - 상세: 이 상수를 읽는 유일한 지점(`main()` 의 `_check_set("auditConfig.ignoreCves",
    EXPECTED_IGNORED_CVES, ...)`)은 `expected - actual`/`actual - expected` 로 매번 새 set 을
    만드는 연산이라(in-place mutation 아님) 값이 바뀌어도 참조 안전성 문제는 없다. `Read` 로
    `pnpm-workspace.yaml:86-99` 를 직접 열어 `auditConfig.ignoreCves` 항목이 실제로 비어 있고
    그 사유(두 CVE 모두 override/해소로 무효화됨)가 주석으로 남아 있음을 확인했다 — 코드
    baseline 과 설정 파일이 어긋나 config-guard 가 잘못된 이유로 fail 할 상태가 아니다(단,
    `pnpm-workspace.yaml` 자체는 이번 라운드 diff 페이로드 밖).
  - 제안: 조치 불요.

## 그 외 확인한 것 (결함 아님, 기록용)

- **파일시스템**: `scripts/check-override-floors.py` 는 `WORKSPACE_YAML.exists()`/`path.read_text()`
  로 `pnpm-workspace.yaml` 만 읽는다 — 이번 델타(축 3 제거)가 새 쓰기 경로를 들이지 않았음을
  `grep -n "open(\|write_text\|\.write(\|os\.remove\|shutil\." scripts/check-override-floors.py`
  0건으로 재확인.
- **환경 변수**: 직접 `os.environ` 접근 0건(재확인). `subprocess.run(["pnpm", "audit", ...])` 은
  `env=` 미지정으로 부모 환경을 그대로 상속하는데, 이는 이 커밋이 건드리지 않은 기존 동작이고
  직전 라운드 side_effect 리뷰가 이미 의도된 설계로 확인한 항목이다.
  `check-pnpm-security-config.py` 는 subprocess 호출 자체가 없다.
- **네트워크 호출**: `run_audit()` 의 `pnpm audit --json` 호출은 이번 델타로 변경되지 않았다(diff
  에 `run_audit()` 함수 자체가 포함되지 않음 — `git show f71be98d8` 로 확인). 새로 넓어진
  네트워크 표면 없음.
- **인터페이스/CLI 계약**: `main()` 의 반환값 계약(`0` = 재유입 없음, `1` = 침식 발견, `2` =
  판단 불가)과 `if __name__ == "__main__": sys.exit(main())` 진입점은 이번 델타로 변경되지 않았다
  — CI 워크플로(`deps-security-checks.yml:98`) 가 기대하는 exit code 계약이 깨지지 않는다.
- **이벤트/콜백**: 해당 없음(이 스크립트에 이벤트 발행·콜백 등록 메커니즘 없음, 이전 라운드들과
  동일).
- **리뷰 산출물 12개(markdown/json)**: 전부 정적 문서 — 코드 실행·상태 변경 없음. `_retry_state.json`
  의 `"routing_status": "pending"` 필드는 오케스트레이터가 라우팅 완료 전 스냅샷을 커밋한
  중간상태로 보이나, 이는 `code-review-agents` 하네스 자체의 산출물 관례이지 이번 라운드가 검토할
  프로덕션 코드의 부작용이 아니다.

## 요약

이번 라운드의 실질 코드 델타는 커밋 `f71be98d8`(축 3 철회) 하나로, `06_03_11` requirement 리뷰의
CRITICAL(`widened`/`EXPECTED_SUPPRESSED_PATHS` 가 실 registry 에서 항상 죽은 코드)을 재설계 대신
제거로 처리했다. 부작용 관점에서 이 삭제는 순수하게 축소 방향이었다 — mutable 타입 전역
(`EXPECTED_SUPPRESSED_PATHS`, 직전 라운드가 "현재는 안전, 향후 유의" 로 이미 INFO 처리했던 대상)
하나가 완전히 사라졌고, `classify_vulnerable()` 의 반환 시그니처가 2-tuple 에서 단일 dict 로
축소됐지만 이 함수는 파일 내부 전용이라 시그니처를 바꾼 같은 커밋이 유일한 호출부(`main()`)와
테스트 스위트를 함께 갱신해 깨지는 외부 호출자가 없음을 직접 확인했다(`grep` 로 재사용 지점
전수 확인). 파일시스템 쓰기·환경 변수 접근·네트워크 호출 확대·이벤트/콜백 변경은 이번 델타에
없다. 유일하게 남긴 관찰은 `run_audit()` 의 스키마 존재검사가 여전히 `actions` 키만 보는데
`classify_vulnerable()` 는 이제 `advisories` 만 쓴다는 내적 불일치다 — fail-closed 방향은
유지되고(안전성 저하 아님) 실 registry 로 재현하지도 못해 추측 수준의 INFO 로만 기록한다.
`scripts/check-pnpm-security-config.py` 의 `EXPECTED_IGNORED_CVES` 값 변경도 읽기 전용 사용이
유지되고 `pnpm-workspace.yaml` 과의 2-place 규약이 실제로 지켜졌음을 대조 확인했다. 리뷰
산출물 12개(markdown/json)는 이 리뷰 체인이 지난 10개 라운드 동안 일관되게 확인해 온 대로
실행되지 않는 정적 문서라 부작용 검토 대상이 아니다.

## 위험도

LOW — Critical/Warning 없음. INFO 4건은 전부 (a) 이월 항목의 종결 확인, (b) 파일 내부로 완전히
격리돼 외부 호출자 영향이 없음을 직접 검증한 시그니처 변경, (c) fail-closed 방향이 유지되는
내적 불일치(안전성 저하 아님, 추측 수준), (d) 읽기 전용으로 유지된 설정값 변경이며, 즉각 조치가
필요한 항목은 없다.
