# 변경 범위(Scope) 리뷰 — changelog-criteria

## 검토 대상 요약

13개 파일 diff를 확인했다. 실제 편집은 5건(`CHANGELOG.md`, `plan/in-progress/changelog-criteria.md`(신규),
`plan/in-progress/spec-draft-nullable-notation-followups.md`, `.claude/agents/documentation-reviewer.md`,
`.claude/skills/code-review-agents/lib/role_instructions.py`)이고, 나머지 8건은 `review/consistency/2026/09/25/12_52_34/**`
아래 자동 생성된 consistency-check 산출물(신규 파일, `--plan` 모드 실행 결과)이다. 후자는 plan 문서 §C 검증
체크리스트가 참조하는 사전 검토 증거이며 CLAUDE.md 의 "완료된 검토 산출물 보존" 관례와 일치해 손으로 끼워
넣은 무관 파일이 아니다 — 스코프 위반으로 보지 않는다.

## 발견사항

- **[INFO]** 한 PR에 "기준 성문화"·"과거 이력 백필"·"기존 결함(헤딩 접두 누락) 수정" 세 가지 성격이 다른
  변경이 섞여 있다
  - 위치: `CHANGELOG.md:3`(기준 블록 추가) / `CHANGELOG.md:24`(V110~V130 백필 항목, 표는 `:29`-`:35`) /
    `CHANGELOG.md:2189`(`## 부수 —` → `## Unreleased — (부수)` 헤딩 수정)
  - 상세: plan 제목은 "CHANGELOG 에 무엇이 들어가는지 성문 기준을 적는다"이다. 실제 diff는 (a) 상단
    기준 블록 추가, (b) 그 기준을 근거로 과거에 누락된 인덱스 마이그레이션 21개(V110~V130)를 새 `## Unreleased`
    항목으로 소급 기록, (c) 기존 `## 부수 —` 헤딩의 접두 누락을 `## Unreleased — (부수)`로 정정 — 세 가지를
    포함한다. (b)·(c)는 "기준을 적는다"는 원 목표와 인과적으로 연결돼 있고(같은 전수조사 과정에서 발견),
    `plan/in-progress/changelog-criteria.md` §B·§A-1에 각각 근거와 결정이 명시돼 은닉된 확장은 아니다. 다만
    엄밀한 "한 PR = 한 관심사" 기준으로는 (b)는 실질적인 이력 데이터 변경(PR 번호·수치 인용을 포함하는
    콘텐츠 커밋)이라 별도 커밋/PR로 분리할 수도 있었던 항목이다.
  - 제안: 현재 근거 문서화 수준(plan §B "왜 이 PR에서 백필하는가", §A-1 "이탈 1건")이 충분히 명시적이므로
    조치 불필요. 다만 리뷰 시 (b)를 "기준 성문화"와 동일한 신뢰도로 검증할 것 — 특히 표의 실측치(ms
    단위 성능 수치, PR 번호)는 이 PR의 핵심 목표(기준 정의) 검증과는 별도로 사실 확인이 필요하다.

- **[INFO]** "정식 규약"에 해당할 수 있는 판정 기준이 `spec/conventions/`가 아니라 `CHANGELOG.md` 본문에
  직접 신설됨
  - 위치: `CHANGELOG.md:3`-`:22` (새 blockquote 블록 전체)
  - 상세: CLAUDE.md §정보 저장 위치는 "정식 규약 → `spec/conventions/<name>.md`"로 명시한다. 이 기준
    블록은 사실상 저장소 운영 규약(어떤 변경이 CHANGELOG 항목이 되는가)이며 `spec/**`는 project-planner
    전용 쓰기 영역이다. `plan/in-progress/changelog-criteria.md`가 이 편차를 스스로 인지하고 위치 선택
    근거를 남겼고(§B "왜 `spec/conventions/`가 아니라 `CHANGELOG.md` 상단인가"), 동석 consistency-check
    (`review/consistency/2026/09/25/12_52_34/SUMMARY.md` WARNING #1)도 이미 BLOCK:NO로 동일 지점을
    지적해 두 경로 중 하나를 선택하라고 제안했다. 새로 발견한 스코프 위반이라기보다는 "developer가
    본래 project-planner 영역에 준하는 결정을 codebase 인접 파일에서 내렸다"는 역할 경계 이슈로,
    이미 트래킹 중이다.
  - 제안: 별도 조치 불필요(중복 지적 방지). 다만 이 판단이 향후 `spec/conventions/`로 이관될 가능성을
    plan 트래커에 이미 열어 둔 대로 유지할 것.

- **[INFO]** `.claude/agents/documentation-reviewer.md`와
  `.claude/skills/code-review-agents/lib/role_instructions.py`의 두 사본을 동일 문구로 함께 수정 — 의도된
  동반 갱신이며 스코프 이탈 아님
  - 위치: `.claude/agents/documentation-reviewer.md:21`, `.claude/skills/code-review-agents/lib/role_instructions.py:141`
  - 상세: 두 파일은 byte 단위로 동일한 문장("6. **변경 이력**: CHANGELOG 항목이 필요한 변경인지 —
    기준은 `CHANGELOG.md` 상단 «무엇이 항목을 만드는가»...")으로 갱신됐다. `role_instructions.py`가 SSOT이고
    `.md`는 그 렌더링 사본이라는 관계가 plan 문서에 명시돼 있고, 두 곳 모두 이번 diff에 포함돼 drift가
    남지 않는다. `.claude/agents/**` 편집이 developer 소관인지 CLAUDE.md 표에 명문화돼 있지 않다는 점은
    consistency-check(INFO #4)가 이미 별도 planner 턴 검토 대상으로 등재했다 — 이 PR 자체의 스코프
    위반은 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 대한 변경은 체크박스 갱신 +
  신규 재판정 후보 목록 1건 추가로 국한
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5159`(체크 완료),
    `plan/in-progress/spec-draft-nullable-notation-followups.md:5183`-`:5199`(종결 메모 + 신규 항목)
  - 상세: `plan/in-progress/changelog-criteria.md` §C 체크리스트가 "트래커 항목 닫기 + 재판정 후보 등재"를
    명시적으로 예고했고, 실제 diff가 정확히 그 두 가지(원 항목 체크 + 후보 12건 목록화)만 수행한다. 후보
    PR들의 실제 수정은 이 PR에 포함되지 않는다(§B "나머지 미동반 후보는 이 PR에서 백필하지 않는다").
  - 제안: 조치 불필요.

- **[INFO]** `review/consistency/2026/09/25/12_52_34/**` 8개 신규 파일은 자동 생성된 사전 검토 증거로,
  수동 편집이 섞이지 않음
  - 위치: `review/consistency/2026/09/25/12_52_34/SUMMARY.md` 외 7개 파일(전부 `new file mode`)
  - 상세: 모두 `--plan` 모드 consistency-check 실행 산출물이며 `plan/in-progress/changelog-criteria.md`
    §C "사전 일관성 검토" 체크박스가 이 세션 경로를 직접 인용한다. 기존 파일 수정이 아니라 신규 생성이고
    본문 내용도 자동화 도구의 출력 그대로다 — 무관한 파일 혼입이 아니다.
  - 제안: 조치 불필요.

## 요약

이 변경은 표면적으로 5개 실편집 파일 + 8개 자동생성 증거 파일로 구성되지만, 모든 편집이
`plan/in-progress/changelog-criteria.md`의 명시적 계획(§A 전수조사 → §B 처방 → §C 검증)에 1:1로
대응하며 은닉된 추가 수정·불필요한 리팩터링·기능 확장·포맷팅 잡음·미사용 임포트·설정 변경은 발견되지
않았다. 다만 "기준 성문화"라는 단일 제목 아래 (1) 기준 문서 추가, (2) 과거 이력 데이터 백필, (3) 기존
헤딩 결함 수정이라는 성격이 다른 세 변경이 한 커밋에 묶여 있고, "정식 규약"에 준하는 결정을
`spec/conventions/` 대신 `CHANGELOG.md`에 직접 둔 역할 경계 편차가 있다 — 둘 다 plan 문서와 동봉된
consistency-check(WARNING #1, BLOCK:NO)가 이미 인지하고 근거를 남긴 상태라 신규 발견이라기보다는
확인 및 재확인 수준이다.

## 위험도
LOW
