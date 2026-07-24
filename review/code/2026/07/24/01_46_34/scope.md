# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** §L(닫는 따옴표에 다른 문자가 붙는 값 미탐지) — 이번 작업이 명시한 목적(§J-후속 회귀 수정) 밖의 새 백로그 항목·캐너리 테스트·공유 픽스처 확장을 동반 도입
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `KnownFalseNegativeTest` 클래스(신규, 약 38줄), `.claude/tests/_harness.py:66-69`(`ENV_VALUE_SHAPES` 에 §L 전용 값 형태 `'"a b"c'`, `"'a b'c"`, `'x"a b"'` 3건 추가), `plan/in-progress/harness-guard-followups.md` 신규 `## L.` 섹션(495-511행)
  - 상세: 이번 diff 가 스스로 밝히는 작업 범위는 "§J 수정이 되레 FN 을 들여왔다"(`## J-후속.` 섹션, 464-492행)는 단일 회귀의 수정이다. 그런데 그 과정에서 완전히 별개의, **이번 회귀와 무관하게 원래부터 있던(pre-existing)** 버그 클래스(`A="a b"c git push` 형태)를 새로 발견·명명(§L)하고, 이를 위한 전용 캐너리 테스트 클래스, plan 백로그 신규 섹션(17줄), 공유 값-형태 상수에 대한 3건 추가까지 같은 diff 에 실었다. 실제 코드 동작 변경은 없고("고치지 않는다"는 사실 자체를 캐너리로 고정) `test_the_gap_predates_the_j_fix` 로 "§J 이전부터 있던 갭"임을 스스로 명시하고 있어 이번 작업의 성격과는 다른 항목이다. diff 표면 자체는 늘어났다(새 테스트 클래스 + plan 신규 섹션 + 공유 상수 오염).
  - 제안: 기능적 영향은 없고(동작 불변, 명시적으로 "이번 범위 밖"이라 disclosed, "발견한 버그를 캐너리 테스트로 고정"하는 이 프로젝트의 기존 컨벤션과 일치) 이미 `RESOLUTION.md`(§L 은 이번 범위 밖으로 명시)와 직전 리뷰 세션(01_25_14, INFO#3)에서 검토·수용된 트레이드오프이므로 지금 되돌릴 필요는 없다. 다만 향후 유사 상황에서는 "회귀 수정" 커밋과 "새로 발견한 별개 갭의 캐너리 등록" 커밋을 분리하면 diff 가 더 좁고 리뷰하기 쉬워진다는 점은 기록해 둘 가치가 있다.

- **[INFO]** SoR 문서 경로 오탈자 정정이 핵심 수정과 무관한 2개 파일에 걸쳐 포함된 drive-by
  - 위치: `.claude/hooks/guard_review_before_push.py:91`, `.claude/tests/test_push_guard_allowlist.py:4`
  - 상세: `plan/in-progress/harness-push-guard-subcommand-detection.md` → `plan/complete/harness-push-guard-subcommand-detection.md` 로 SoR 참조 경로를 정정. 실제로 해당 plan 파일은 `plan/complete/` 에 있고 `plan/in-progress/` 에는 없음을 확인했으므로 정정 자체는 사실에 부합한다. 다만 이는 §J-후속 회귀 수정(후행 `\S+` 폴백 복원)과는 무관한 별개의 문서 정확성 수정으로, 핵심 diff 에 곁다리로 얹혔다. 직전 리뷰(01_25_14)에서도 INFO#5로 동일하게 지적되어 "조치 불요(disclosed minor)"로 처리된 바 있다.
  - 제안: 사실관계가 맞고 규모가 극히 작으며(2줄) 이미 disclosed 되었으므로 되돌릴 필요는 없다. 향후에는 이런 무관 경로 수정을 별도 커밋으로 분리하는 편이 더 순수한 diff 를 유지한다.

- **[INFO]** 정규식 인접 인라인 주석 블록이 이번 diff 에서 상당히 증가(파일 1: +11줄, 파일 2: +9줄) — 실질 코드 변경은 정규식 alternation 한 곳뿐
  - 위치: `.claude/hooks/guard_default_branch_bash.py:87-101`(주석), 108-112행(코드 변경 지점 자체는 111행 한 줄), `.claude/hooks/guard_review_before_push.py:106-117`(주석), 118-119행(코드 변경 지점은 119행 한 줄)
  - 상세: 실제 동작을 바꾸는 코드 변경은 두 파일 모두 정규식 alternation 하나(`[^\s'"]\S*` → `\S+`)뿐인데, 그 근거·이력을 설명하는 인라인 주석이 나란히 크게 늘었다. 다만 이는 이 저장소가 이미 채택한 컨벤션("확신에 찬 주석이 이후 라운드에 반증된 전례" 때문에 근거를 코드 옆에 직접 남김 — 같은 파일의 직전 §C 주석도 동일 패턴)과 일치하고, 실질 코드 변경과 뒤섞여 불명확해지지도 않았다(주석 줄과 코드 줄이 diff 상 명확히 구분됨). 유지보수성 리뷰어도 같은 관찰을 이미 INFO(비차단)로 남긴 바 있다.
  - 제안: 조치 불요 — 스코프 이탈이 아니라 이 프로젝트 특유의 정당화된 문서화 스타일. 장기적으로 주석:코드 비율 추적은 유지보수성 리뷰 소관.

- **[INFO]** 이번 diff 에 이전 리뷰 세션(`review/code/2026/07/24/01_25_14/`) 산출물 11개 파일 전체가 신규 파일로 포함됨
  - 위치: `review/code/2026/07/24/01_25_14/{RESOLUTION.md,SUMMARY.md,meta.json,_retry_state.json,documentation.md,maintainability.md,requirement.md,scope.md,security.md,side_effect.md,testing.md}`
  - 상세: 이는 이번 작업자가 임의로 추가한 스코프 확장이 아니라, diff 기준선이 `origin/main` 이기 때문에 자연히 포함된 이력이다. 이 저장소는 `review/` 를 gitignore 하지 않고, `/ai-review` → Warning fix(`RESOLUTION.md`, developer 쓰기 권한) → fresh review 재검토가 표준 워크플로다. 코드/훅/테스트/plan 변경(파일 1~7)과 이 산출물들(파일 8~18) 사이에 내용 불일치는 없음을 대조 확인했다(RESOLUTION.md 의 W1~W4 서술이 파일 1·4·5·6 의 실제 diff 와 일치).
  - 제안: 조치 불요 — 워크플로 상 정상이며 스코프 위반 아님.

## 요약

핵심 수정(§J-후속: 세 곳의 env-value 정규식에서 빠진 `\S+` 트레일링 폴백 복원 + 회귀 방지를 위한 생성 기반 테스트 3종 + 관련 주석/plan 갱신)은 스스로 밝힌 목적과 정확히 일치하며, 임포트·포맷팅·설정 변경 중 스코프를 벗어난 것은 없다. 다만 (1) 무관한 SoR 경로 오탈자 정정 2줄과 (2) 완전히 별개의 선재 버그(§L)에 대한 캐너리 테스트·plan 신규 섹션·공유 픽스처 확장이 같은 diff 에 함께 실렸다 — 둘 다 기능적 영향은 없고 이미 disclosed·검토·수용된 트레이드오프이지만, "회귀 수정" 이라는 명시된 작업 범위만 놓고 보면 diff 표면이 그보다 넓다. 이전 리뷰 세션(01_25_14) 산출물 11개 파일이 diff 에 함께 나타나는 것은 워크플로상 정상이며 스코프 이슈가 아니다.

## 위험도
LOW
