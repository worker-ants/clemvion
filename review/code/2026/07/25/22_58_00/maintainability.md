# 유지보수성(Maintainability) 리뷰

## 검토 범위에 대한 선행 메모

이번 페이로드에 포함된 26개 파일은 전부 `review/consistency/2026/07/25/{19_13_33,21_35_11,21_58_52,22_28_51}/**` 하위의 **consistency-check 하네스 산출물**(`meta.json`, `_retry_state.json`, 5개 checker 의 마크다운 리포트)이다. 실제 이번 PR 의 손으로 작성된 애플리케이션 로직(`codebase/backend/src/nodes/integration/{cafe24,makeshop}/*.client.ts`, `*.handler.ts` 및 spec)은 이번 maintainability 리뷰 페이로드에 포함되어 있지 않다(별도 라운드에서 이미 검토된 것으로 보인다 — `review/code/2026/07/25/{21_35_11,22_43_37}/maintainability.md` 참고).

따라서 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 같은 전통적 유지보수성 기준은 이번 대상(생성된 JSON 상태 파일 + LLM 리뷰 리포트 텍스트)에 적용할 실체가 없다. 아래는 그럼에도 적용 가능한 관점(가독성·네이밍·중복·일관성)에서 발견한 사항이다. 전부 INFO 수준이며 developer 가 당장 조치할 코드 결함은 아니다.

## 발견사항

- **[INFO]** 같은 세션 안에서 리포트 헤딩 레벨이 유독 한 파일만 다름
  - 위치: `review/consistency/2026/07/25/22_28_51/naming_collision.md:1,19,22` (`### 발견사항` / `### 요약` / `### 위험도` — level 3)
  - 상세: 같은 세션(`22_28_51`)의 다른 4개 checker 리포트(`convention_compliance.md`, `cross_spec.md`, `plan_coherence.md`, `rationale_continuity.md`)는 모두 `## 발견사항` / `## 요약` / `## 위험도`(level 2)를 쓴다. 또한 같은 `naming_collision` checker 의 이전 두 세션 산출물(`19_13_33/naming_collision.md`, `21_58_52/naming_collision.md`)도 전부 `##` 를 쓴다 — 즉 `22_28_51` 회차 한 건만 헤딩 레벨이 어긋난다. 기능적 영향은 없으나(둘 다 마크다운 렌더링은 되므로) 같은 통합 SUMMARY 가 여러 리포트를 이어붙여 참조할 때 목차 구조가 흔들릴 수 있다.
  - 제안: 소소한 사안. 향후 checker 출력 후처리(lint) 단계가 있다면 `##` 로 정규화하는 정도면 충분.

- **[INFO]** 일부 리포트의 "상세" 항목이 지나치게 긴 단일 문단으로 여러 주장을 압축해 가독성이 낮음
  - 위치: `review/consistency/2026/07/25/21_58_52/cross_spec.md:30-54` (CRITICAL 항목의 "상세" 불릿 하나가 25줄 분량, 여러 개의 독립된 사실(재throw 구현 확인 / mapClientErrorToOutput 분기 부재 / 엔진 도달 불가 / 대조군 파일 인용)을 줄바꿈 없이 한 문단에 압축)
  - 상세: 이 리포트들은 향후 project-planner·다른 리뷰어가 다시 읽고 행동해야 하는 참조 문서인데, 하나의 불릿에 "무엇이 문제인지 / 왜인지 / 증거 / 대조군" 이 구분 없이 이어져 있어 핵심 결론을 훑어보기 어렵다. 같은 패턴이 `plan_coherence.md`(`19_13_33`)의 CRITICAL 항목("상세" 4개 sub-bullet은 오히려 잘 구조화됨 — 참고용 대조)에는 없어, checker 마다 산출 스타일 편차가 있다.
  - 제안: (하네스/프롬프트 템플릿 개선 시) "상세" 항목을 사실 1개당 sub-bullet 로 쪼개도록 권장하면 향후 리포트의 스캔 가능성이 개선된다. 이번 diff 자체를 되돌릴 사안은 아님.

- **[INFO]** `meta.json` / `_retry_state.json` 보일러플레이트가 세션마다 거의 동일하게 반복됨 (구조적 중복, 결함 아님)
  - 위치: `review/consistency/2026/07/25/{19_13_33,21_35_11,21_58_52,22_28_51}/_retry_state.json` 전체(각 52줄, `session_dir` 절대경로만 상이) 및 같은 4개 디렉토리의 `meta.json`(각 12줄, `timestamp`/`mode` 만 상이)
  - 상세: DRY 관점에서만 보면 동일 구조가 4회 반복되지만, 이는 손으로 작성한 코드가 아니라 harness 가 매 consistency-check 세션마다 생성하는 상태 스냅샷이다(`subagent-call-contract.md` 규약에 따른 재시도 상태 기록). 세션별로 독립된 파일이어야 하므로 "공통 함수로 추출"할 대상이 아니다 — 오탐 방지를 위해 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 세션 `21_35_11` 은 `_retry_state.json`/`meta.json` 만 존재하고 5개 checker 리포트가 diff 에 없음
  - 위치: `review/consistency/2026/07/25/21_35_11/_retry_state.json`, `review/consistency/2026/07/25/21_35_11/meta.json`
  - 상세: 다른 3개 세션(`19_13_33`, `21_58_52`, `22_28_51`)은 `SUMMARY.md`(또는 개별 checker `.md`)까지 커밋됐지만 이 세션은 시작 상태 파일만 남아 있다 — 재시도/중단된 실행으로 보인다. 코드 품질 결함은 아니지만, 리뷰 아카이브에 "미완료 세션"의 부분 산출물이 섞여 있으면 이후 이 디렉토리를 훑는 사람이 완료된 라운드로 오인할 여지가 있다.
  - 제안: 조치 불요(harness 동작의 정상 잔여물). 필요시 plan-lifecycle 정리 시점에 참고.

## 요약

이번 maintainability 리뷰 페이로드는 전부 consistency-check 하네스가 생성한 리뷰 산출물(JSON 상태 파일 + 마크다운 리포트)이며, 사람이 직접 작성한 애플리케이션 로직은 포함되어 있지 않다. 그 결과 함수 길이·중첩·매직 넘버·순환 복잡도 같은 핵심 기준은 적용할 대상이 없고, 실제로 지적할 만한 사항은 리포트 텍스트 자체의 가독성(과도하게 긴 단일 문단 "상세" 항목)과 극히 사소한 헤딩 레벨 불일치(세션 `22_28_51` 의 `naming_collision.md` 한 건) 정도다. `_retry_state.json`/`meta.json` 의 세션 간 반복 구조는 DRY 위반처럼 보이나 harness 가 세션마다 독립적으로 생성하는 상태 스냅샷이라 결함이 아니다. 이번 diff 로 인해 새로 만들어진 유지보수성 리스크는 없다.

## 위험도
NONE
