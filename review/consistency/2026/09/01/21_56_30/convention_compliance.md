# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 검토 범위 및 사전 확인

prompt 번들에 담긴 target 스냅샷은 5차(`21_49_21`) 라운드 시점의 것이었으나, 로컬 파일시스템의
현재본(152줄)은 그 이후 이미 한 차례 더 갱신돼 있었다(5차 `cross_spec` W1 대응 — 목적지 필드
위임 문장을 통째로 삭제). 아래 검토는 **로컬 디스크의 최신본**(실제로 다음 사람이 보게 될
파일)을 대상으로 했다. 대조한 정식 규약: `spec/conventions/error-codes.md`(전문 확인),
`spec/conventions/audit-actions.md`(참고), `.claude/skills/project-planner/SKILL.md`,
`.claude/docs/plan-lifecycle.md` §4, CLAUDE.md "정보 저장 위치"/"Skill 체계".

## 이전 라운드 지적 사항의 해소 상태 확인

- **[확인 — 해소됨]** 4차/5차 라운드가 지적한 "층(layer)" 프레이밍(WARNING, `21_46_05`·`21_49_21`)
  은 현재본 `## 변경 제안`에 더 이상 존재하지 않는다. `grep 층 target` 결과 3건 모두
  `### 세 번 고쳤다` 절(과거 시도를 서술하는 narrative)에만 남아 있고, 실제 patch 문안(39~44행)
  에는 등장하지 않는다.
- **[확인 — 해소됨]** 2차 라운드(`21_36_28`)가 지적한 "§Overview 가 위임해 둔 카탈로그·분류
  사실(목적지 필드)을 재선언"하는 문제와, 5차 `cross_spec` W1(`21_49_21`)이 지적한 "위임
  포인터가 실제로는 착지하지 않는 SoT(`3-error-handling.md §1`)를 가리킨다"는 문제 — 현재본은
  목적지 필드 서술 자체를 **완전히 제거**했다(46~51행: "목적지 필드는 **아무 말도 하지
  않는다**"). 재선언 위험도, 잘못된 SoT 포인터 위험도 동시에 사라졌다 — `error-codes.md` 의
  "본 문서는 재선언하지 않는다" 원칙과 가장 안전하게 정합하는 형태다.
- **[확인 — 해소됨]** 4차 라운드(`21_46_05`) INFO — `## Rationale` 뒤에 동급(`##`) 섹션이
  이어지던 문제. 현재본은 `### 판단 기준은 이번에 안 쓴다` 가 `## Rationale`(104행) 의 하위
  `###` 섹션(122행)으로 들어가 있어, `project-planner` SKILL §3 "본문 끝에 `## Rationale`" 요건을
  충족한다(`## Rationale` 이 최상위 섹션 중 마지막).

## 신규 실측 검증 (이번 라운드에 추가된 서술)

- `## 변경 제안` 3번째 불릿("경계는 **비대칭**이다 — `EngineErrorCode` 는 **엔진만** 발행")을
  코드로 재확인: `EngineErrorCode.*` 를 참조하는 비-테스트 파일은
  `modules/execution-engine/execution-engine.service.ts` ·
  `modules/execution-engine/shutdown/shutdown-state.service.ts` 둘뿐이며 둘 다
  `execution-engine` 모듈 소속 — "엔진만 발행" 서술과 일치.
  `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `error-codes.ts:73` 로 `ErrorCode` 소속이고
  `execution-engine.service.ts:8270` 이 이를 `Execution.error.code` 로 싣는다 — "`ErrorCode` 는
  노드 핸들러가 주로 쓰되 엔진도 쓴다"는 서술과 일치. 날조 없음.
- 새로 인용된 SoT 좌표 `1-data-model.md:557-563`("Execution.error ↔ NodeExecution.error 관계"
  표)를 직접 열어 대조 — 정확히 그 위치에 그 표가 존재한다.

## 발견사항

- **[INFO]** `## 변경 제안` 3번째 불릿(비대칭 경계 서술)이 같은 절 도입부·`## Rationale`
  "존재한다는 사실만 적는다" 원칙과 문면상 다소 긴장한다
  - target 위치: `## 변경 제안` 도입부(37행 "두 surface 가 **존재한다는 사실만** 적는다") 및
    3번째 불릿(42~44행 "경계는 **비대칭**이다…") vs `## Rationale` "왜 자매 const 인가"
    절(119~120행 "이 병기는 그 형태를 규약으로 굳히는 서술을 쓰지 않는다 — 두 surface 가
    **존재한다**는 사실만 적는다") 및 `### 세 번 고쳤다` 절(81~83행 "최종판은 분류를 **아예
    하지 않는다** — 존재·자매 관계·키 disjoint 만 적고")
  - 위반 규약: 직접적인 `spec/conventions/**` 위반은 아니다 — 이 draft 자신이 `## Rationale`
    에서 선언한 자체 원칙과의 정합성 문제이며, `error-codes.md` §1 의 "구현 세부·전이적 맥락을
    박지 않는다"는 정밀성 원칙과 인접한 영역이다. 4차 라운드가 정확히 이 유형(변경 제안 vs
    Rationale 자체 원칙 불일치)을 convention_compliance WARNING 으로 다룬 선례가 있다.
  - 상세: "존재·자매 관계·키 disjoint" 세 가지만 적겠다고 명시했는데, 실제 불릿 3은 "누가
    발행하는가"(엔진만 / 노드 핸들러 주 + 엔진 예외)라는 **경계 성격의 서술**을 추가한다.
    다만 4차가 지적했던 "층(layer)" 프레이밍(아키텍처적 이분법 신설)과 달리, 이번 서술은
    예외(`EXECUTION_TIME_LIMIT_EXCEEDED`)를 명시적으로 포함해 깔끔한 이분법을 만들지 않고,
    "1:1 대응하지 않는다"는 한정도 유지한다 — 5차 라운드(`21_49_21`)도 이와 사실상 동일한
    이전 버전 불릿("경계는 누가 발행하는가이며…")을 이미 검토했으나 별도 WARNING 을 내지
    않았다. 따라서 CRITICAL/WARNING 재상정 근거는 약하고, "존재한다는 사실만" 이라는 도입부
    문구와 실제 불릿 사이의 **표현 수위 차이**를 기록하는 수준의 INFO 로 남긴다.
  - 제안: 병합을 막을 사안은 아니다. 다음 중 하나로 표현만 다듬으면 자기 정합성이 더 깔끔해진다
    — (a) 도입부 "존재한다는 사실만 적는다" 를 "존재·관계·경계 성격만 적는다" 정도로 완화하거나,
    (b) 불릿 3 을 "누가 주로 쓰는가" 수준으로 더 축약. 실질 내용 변경은 불필요.

- **[INFO]** 이전 라운드가 지적한 SoT 표기 스타일 불일치(5차 INFO)는 해당 문장 자체가
  삭제되며 자동 해소됨 — 별도 조치 불요, 확인용 기록만 남긴다.
  - target 위치: (해당 문장 삭제됨 — 과거 46~48행 근방)
  - 상세: 5차(`21_49_21`) INFO 가 지적했던 "카탈로그 SoT([링크])에 맡긴다" 불릿이 이번 개정에서
    통째로 제거됐다. §Overview "책임 경계" 목록의 "링크 + (SoT)" 표기 스타일과의 불일치 문제도
    함께 사라졌다.

## 정식 규약 준수 확인 (5개 관점, 위반 없음)

- **명명 규약**: 신규 파일·식별자·API endpoint 없음. `ErrorCode`/`EngineErrorCode` 언급은 기존
  선언 재인용뿐 — 명명 원칙(§1) 대상 아님.
- **출력 포맷 규약**: API 응답·이벤트 페이로드·에러 코드 값 자체를 정의/변경하지 않는다. 오히려
  목적지 필드(출력 위치) 언급을 완전히 제거해 `3-error-handling.md`/`1-data-model.md` 의 SoT
  경계를 침범할 여지를 없앴다 — 가장 보수적인 형태.
  결론적으로 이번 라운드 편집은 "출력 포맷을 재선언하지 않는다"는 원칙을 더 강하게 만족한다.
- **문서 구조 규약**: `## Overview` → `## 실측` → `## 변경 제안`(+`###` 하위 두 절) →
  `## Rationale`(+`###` 하위 한 절) 순서로, Overview/본문/Rationale 3섹션 + "본문 끝에
  `## Rationale`" 요건을 모두 만족. frontmatter 3필수 필드(`worktree`/`started`/`owner`) 존재,
  `spec_impact` 는 YAML 리스트(주석 포함, 파싱 영향 없음)로 Gate C 형식 충족.
  `plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 강제 스코프(`plan/in-progress/*.md`
  최상위) 안에 있고 형식 위반 없음.
- **API 문서 규약**: 해당 없음 — swagger/OpenAPI 데코레이터·DTO 를 다루지 않는다.
- **금지 항목**: `error-codes.md` §1(구현 세부·전이적 맥락 이름에 박지 않기)·§2(가독성만을 위한
  rename 금지)·`audit-actions.md` §1(dot-prefix 없는 표기 금지) 등 명시적 금지 패턴을 이 draft
  가 답습하지 않는다 — 코드 값·이름 변경을 제안하지 않고 기존 값을 그대로 인용만 한다.

## 요약

이번 라운드에서 확인한 최신 diskstate(152줄)는 지금까지의 다섯 라운드가 지적한 CRITICAL/WARNING
급 문제(목적지-필드 오분류, SoT 재선언, 착지하지 않는 위임 포인터, "층" 신조어 프레이밍, Rationale
뒤 동급 섹션)를 **전부 해소**했다 — 특히 5차 `cross_spec` W1(잘못된 SoT 를 가리키는 위임 문장)
은 문장 자체를 삭제하는 가장 안전한 방식으로 대응했고, 새로 추가된 서술(엔진만 발행하는 비대칭
경계, `1-data-model.md:557-563` 인용)은 코드베이스 실측과 정확히 일치한다. 유일하게 남은 것은
"존재한다는 사실만 적는다"는 draft 자신의 도입부 문구와 실제 불릿 3(비대칭 경계 서술)의 표현
수위가 미세하게 어긋나는 self-consistency 성격의 INFO 1건이며, 병합을 막을 사안은 아니다. 다섯
관점(명명/출력 포맷/문서 구조/API 문서/금지 항목) 모두에서 `spec/conventions/**` 직접 위반은
발견되지 않았다.

## 위험도

LOW
