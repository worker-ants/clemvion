# 문서화(Documentation) 리뷰 — push-guard-worktree-scope (01_02_21)

## 검증 방법

이번 라운드의 diff 는 애플리케이션 코드 변경이 아니라, 직전 리뷰 라운드
(`review/code/2026/07/24/00_34_09/`)가 산출한 12개 감사 문서(RESOLUTION.md, SUMMARY.md,
`_retry_state.json`, meta.json, 그리고 8개 개별 reviewer 보고서)를 신규 커밋으로 추가하는
것뿐이다(CLAUDE.md 관례 — `review/`는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋 대상).
따라서 독스트링/README/API 문서/설정 문서/예제 코드 등 통상 체크리스트 대부분은 대상이 없고,
"이 감사 문서들 자체가 내적으로 정확·일관된가"가 유일하게 적용 가능한 문서화 관점이다. 12개
파일 전문을 상호 대조했다.

## 발견사항

- **[WARNING]** RESOLUTION.md 섹션 헤더가 "전량 반영"이라 단언하지만 문서 자신의 표·결론과 모순
  - 위치: `review/code/2026/07/24/00_34_09/RESOLUTION.md:6`(헤더 `## WARNING 7건 — 전량 반영`),
    대비 `:12`(항목 #3 `**미조치 (근거 있음)**`), `:42`(정확한 결론
    `WARNING 7 중 6건 반영 + 1건(#3) 근거 있는 미조치`)
  - 상세: 같은 문서 안에서 헤더는 "7건 전부 반영(적용)됐다"고 주장하지만, 바로 아래 표의 항목
    #3(`_run_gates` REVIEW/PLAN 골격 중복)은 명시적으로 "미조치"라고 적혀 있고, 문서 맨 아래
    "## 수렴 판정" 절은 이를 정확히 "6건 반영 + 1건 근거 있는 미조치"로 바로잡아 서술한다. 즉
    헤더만 스스로와 모순되고, 문서 하단은 정확하다. 프로젝트 관례를 확인하기 위해 다른
    RESOLUTION.md 예시(`review/code/2026/07/23/18_06_41/RESOLUTION.md:7` 등)를 대조한 결과
    "(전량 반영)"이라는 표현은 이 저장소에서 문자 그대로 "표에 오른 항목 전부가 실제로
    적용됐다"는 뜻으로 쓰인다 — 부분 미조치가 있는데도 같은 문구를 쓴 것은 이번이 처음이다.
    이 감사 문서는 향후 라운드·사람이 "무엇이 실제로 고쳐졌는가"를 판단하는 1차 자료이므로,
    헤더만 훑어보면 항목 #3(REVIEW/PLAN 골격 중복, 3번째 게이트 추가 시 위험 증가)이 이미
    해소됐다고 오독할 수 있다. 이는 이 코드베이스 자신이 반복 강조하는 "커버된다는 주장은
    실측(그리고 문서 간 정합)이어야 한다"는 원칙과 같은 종류의 결함이다.
  - 제안: 헤더를 `## WARNING 7건 — 6건 반영, 1건 근거 있는 미조치`처럼 실제 결론과 일치시킬 것.

- **[WARNING]** SUMMARY.md WARNING 표가 maintainability 의 심각도 분류를 실제와 다르게 인용 —
  같은 문서 내부에서도 서로 다른 두 절이 서로 모순
  - 위치: `review/code/2026/07/24/00_34_09/SUMMARY.md:17`(WARNING 표 4번째 행,
    카테고리 열에 `Documentation/Testing/Requirement/Maintainability` 로 4개 reviewer 를 공동
    출처로 표기), 대비 `review/code/2026/07/24/00_34_09/maintainability.md:37`(같은 발견사항을
    `**[INFO]**` 로 분류: "신규 테스트 docstring 이 병합으로 사라진 함수명 `_run_gate` 를 여전히
    인용"), 그리고 SUMMARY.md 자신의 "에이전트별 위험도 요약" 표 중 maintainability 행
    (`SUMMARY.md:47`: `_run_gates` REVIEW/PLAN 골격 중복 재발(WARNING) 만 언급, `_run_gate` 이름
    drift 는 전혀 언급되지 않음)
  - 상세: SUMMARY.md 의 "## 경고 (WARNING)" 표 4번째 행은 `_run_gate` 이름 drift 발견을
    documentation·testing·requirement·maintainability 4개 reviewer 가 공동으로 WARNING 으로
    제기한 것처럼 적었다. 그러나 실제로 maintainability.md 는 이 발견을 `**[INFO]**` 로만 분류했고
    ("기능 영향 없음, 급하지 않음"), SUMMARY.md 자신의 "에이전트별 위험도 요약" 표에서도
    maintainability 항목은 이 발견을 언급하지 않고 REVIEW/PLAN 골격 중복 WARNING 1건만 인용한다
    — 즉 SUMMARY.md 내부의 WARNING 표와 "에이전트별 위험도 요약" 표가 서로 다른 사실을
    말하고 있다. "## 권장 조치사항" 5번(`SUMMARY.md:62`)도 같은 오귀속을
    "(documentation+testing+requirement+maintainability 공통)"으로 반복한다. 실제로 이
    발견을 WARNING 으로 낸 것은 documentation·testing·requirement 3곳뿐이다. 이는 SUMMARY.md
    가 개별 reviewer 산출물을 취합하는 과정에서 생긴 카테고리 오귀속으로, 향후 이 라운드를
    감사하는 사람이 "maintainability 리뷰가 이 항목을 WARNING 으로 봤다"고 잘못 신뢰할 수 있다.
  - 제안: SUMMARY.md WARNING 표 4번째 행의 카테고리 열에서 `Maintainability` 를 제거하거나,
    "(maintainability 는 INFO 로 분류)"라고 명시해 원본 reviewer 산출물과 일치시킬 것.

- **[INFO]** `_retry_state.json` 이 라운드 완료 후에도 시작 시점 상태(`"routing_status": "pending"`,
  `"agents_success": []`, `"agents_fatal": []`, `"agent_history": {}`)로 커밋되어, 같은 라운드의
  SUMMARY.md/RESOLUTION.md 가 서술하는 "완료됨" 상태와 표면적으로 어긋나 보임
  - 위치: `review/code/2026/07/24/00_34_09/_retry_state.json:8`(`"routing_status": "pending"`),
    `:145-147`(`agents_success`/`agents_fatal`/`agent_history` 모두 비어 있음), 대비
    `review/code/2026/07/24/00_34_09/SUMMARY.md:68`(`- routing_status=done (router 가 선별):`)
  - 상세: 같은 라운드 디렉터리 안에서 `_retry_state.json` 은 "아직 아무 것도 실행되지 않은" 초기
    스냅샷을 담고 있는데, SUMMARY.md·RESOLUTION.md·나머지 8개 reviewer 산출물은 모두 8명 전원이
    성공적으로 결과를 냈다고 서술한다. harness 설계상 `_retry_state.json` 이 실행 완료 후에도
    갱신·재기록되지 않는 의도된 동작(최종 상태의 SoT 는 meta.json/SUMMARY.md)일 가능성이 높아
    보이지만, 이 파일 자체가 `review/` 아래 감사 기록으로 커밋되는 이상 이것만 단독으로 읽는
    사람에게는 "라운드가 중단됐다"는 오인을 줄 수 있다. 코드 결함이 아니라 문서-보증
    관점의 잠재적 혼동 요소로만 기록.
  - 제안: 조치 불요 — 의도된 harness 동작이면 그대로 두되, 확실치 않다면
    harness 오케스트레이터 문서에 "`_retry_state.json` 은 실행 완료 후 갱신되지 않는
    ephemeral pre-run 스냅샷이며 최종 상태는 meta.json/SUMMARY.md 가 SoT"라는 한 줄을
    남기는 것을 고려.

## 검증한 항목 (문제 없음)

- 8개 개별 reviewer 산출물(architecture/documentation/maintainability/requirement/scope/
  security/side_effect/testing)이 다루는 핵심 발견사항 — `_run_gate → _evaluate_over_targets`
  개명 drift, 모듈 docstring cross-worktree 요약 유실, bare push false-ALLOW 잔여 갭,
  `_push_targets` 실패 미관측, `result is None` 미검증 분기, 테스트 `sys.path` 무가드 삽입 —
  은 위 두 WARNING(카테고리 오귀속·헤더 모순)을 제외하면 SUMMARY.md 의 WARNING 표·"에이전트별
  위험도 요약" 표·RESOLUTION.md 조치 표 사이에서 항목 순서·위치·상세 내용이 1:1 로 정확히
  대응함을 확인했다.
- RESOLUTION.md 의 CRITICAL=0/WARNING=7/INFO=12 카운트는 SUMMARY.md 의 실제 표 행 수(WARNING 7,
  INFO 12)와 정확히 일치.
- meta.json 의 `files` 목록(50개 파일 스냅샷, `.claude/hooks/guard_review_before_push.py` 등
  핵심 파일 + `review/code/2026/07/23/**` 4라운드분 산출물)은 scope.md 가 서술하는 "50개 파일"
  주장과 일치.
- security.md 가 스스로 지적한 bare-push 잔여 갭(WARNING)은 requirement.md 가 독립적으로
  재확인한 동일 지점과 근거·위치가 서로 모순 없이 정확히 겹친다("독립 발견"이라는 두 문서의
  자기서술이 사실과 부합).

## 요약

이번 라운드의 diff 는 애플리케이션 코드가 아니라 직전 라운드(00_34_09)의 리뷰 감사 문서
12건을 신규 커밋으로 추가하는 것뿐이라, README/API/설정 문서 등 통상 체크리스트는 대상이
없다. 유일하게 적용 가능한 관점(감사 문서 자체의 내적 정합성)에서 두 건의 WARNING 을
발견했다: (1) RESOLUTION.md 의 "전량 반영" 헤더가 같은 문서의 표(항목 #3 미조치)·결론과
모순되어 향후 독자가 미해결 항목을 이미 해소된 것으로 오독할 수 있고, (2) SUMMARY.md 의
WARNING 표가 maintainability 의 분류(원본은 INFO)를 WARNING 으로 잘못 인용해 SUMMARY.md
자신의 다른 절(에이전트별 위험도 요약)과도 내부 모순을 일으킨다. 두 항목 모두 코드 동작에는
영향이 없고 감사 기록의 정확성 문제이지만, 이 프로젝트가 반복적으로 강조해 온 "실측·정합
없이 커버 주장을 하지 않는다"는 원칙과 같은 종류의 결함이므로 WARNING 으로 기록한다. 그
외 8개 reviewer 산출물 상호 간, 그리고 SUMMARY/RESOLUTION/meta.json 사이의 나머지 교차
참조는 모두 정확히 일치함을 확인했다.

## 위험도

LOW
