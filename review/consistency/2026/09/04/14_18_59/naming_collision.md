# 신규 식별자 충돌 검토 — `spec-draft-scope-and-anchor-drift.md`

## 검토 범위

target: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` (`--spec` 모드).
`spec_impact` 5개 파일(`5-system/2-api-convention.md` · `2-navigation/3-schedule.md` ·
`3-workflow-editor/3-execution.md` · `1-data-model.md` · `5-system/3-error-handling.md`)에
반영될 예정인 4개 변경안(①~④)이 새로 도입하는 문자열·용어·행 레이블을 대상으로,
기존 `spec/`·`plan/in-progress/` 코퍼스에 같은 이름이 다른 뜻으로 이미 쓰이고 있는지
grep 대조했다.

이 target 은 신규 엔티티·DTO·API endpoint·이벤트명·ENV var 를 발명하지 않는다 — 전부
**이미 구현·문서화된 대상을 재서술/보강**하는 draft 다. 따라서 실제로 "새로 만드는
식별자"는 (a) §5.4 서두에 추가하는 스코프 문단의 용어 `tri-state`, (b) §2.2 에 추가하는
신규 표 행 레이블 `자원 액션`, (c) `1-data-model.md`/`3-error-handling.md` 에 추가하는
`앵커` 열 헤더, 세 가지로 좁혀진다. 각각 대조한 결과는 아래와 같다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

### 참고 (충돌 아님, 확인 근거만 기록)

- **`앵커` 열 헤더** — target `④` 가 `1-data-model.md:474` 부근과 `3-error-handling.md`
  §1.4 에 신설하는 `앵커` 열은 `spec/`·`spec/1-data-model.md`·`spec/5-system/3-error-handling.md`
  본문에 기존 용례가 없어(grep 0건) 새로 도입되는 자리다. 다만 **자매 진행 중 plan**
  `plan/in-progress/spec-conventions-engine-error-code-surface.md:58` 이 이미 "앵커: …"
  표현으로 "코드가 등록된 자리(const/enum/파라미터 유니온)" 라는 같은 의미로 이 단어를
  쓰고 있어 — **의미가 일치**하는 재사용이지 충돌이 아니다. `spec/` 다른 곳(`2-edge.md`,
  `13-user-guide.md`, `4-integration.md`, `data-flow/0-overview.md`)의 "앵커"는 전혀
  다른 도메인(UI 드래그 핸들·URL fragment 딥링크)이라 문서 스코프가 겹치지 않아 오독
  가능성이 낮다.
- **`자원 액션` 행 레이블** — `spec/`·`plan/` 전체에 grep 하면 이 target 자신을 제외하고
  0건. §2.2 기존 두 특례 행은 전부 `**예외 — <이름>**` 형태로 시작하는데, 새 행은
  `**자원 액션**: …` 로 "예외" 접두를 의도적으로 뺐다(target 본문 Rationale "③ 을
  '예외' 가 아니라 '형태' 로 적는 이유" 에서 자체 정당화). 이름 충돌은 아니지만 §2.2
  표 안에서 특례 행의 시각적 명명 패턴이 셋 중 하나만 다른 접두를 쓰게 되는 점은
  참고용으로 남긴다(등급 미부여 — 이미 근거가 있는 의도적 설계 선택).
- **`tri-state`** — `spec/` 전체에 영문 `tri-state`·한글 표기(트라이스테이트/삼중상태)
  기존 용례 0건. §5.4 신규 스코프 문단이 처음 도입하는 용어이고, 인용하는 선례
  (`UpdateAssistantSessionDto.llmConfigId` 의 "Allow explicit null to clear the pinned
  config" 주석)도 실제 코드에 이미 존재하는 대상이라 신규 식별자가 아니다.
- **예시로 나열된 endpoint** (`/executions/:id/stop`, `/schedules/:id/run-now`,
  `/workflows/:id/nodes/:nodeId/execute`) — 모두 `spec/2-navigation/3-schedule.md:135`
  등 기존 문서에 이미 등재된 실제 구현 경로이며 target 이 새로 발급하는 endpoint 가
  아니다. 신규 §2.2 규칙 행에 예시로만 인용된다.
- **요구사항 ID** — target 은 새 ID(`R-x.x`, `WH-*`, `EIA-*`, `NAV-*` 류)를 발급하지
  않는다. `R-1.3` 등은 기존 문서를 인용만 한다.
- **plan 파일 경로** — `plan/in-progress/spec-draft-scope-and-anchor-drift.md` 는
  `plan/in-progress/` 내 기존 파일명과 겹치지 않는다(`ls | grep` 대조 완료).

## 요약

target 은 새 식별자를 발명하는 문서가 아니라, §5.4/§2.2/`3-schedule.md`/에러 코드 표에
**스코프·출처 주석을 보강**하는 draft 다. 새로 도입되는 표현은 `tri-state`, `자원 액션`
행 레이블, `앵커` 열 헤더 세 가지뿐이며, 세 가지 모두 `spec/`·`plan/in-progress/`
전체 grep 대조 결과 기존 사용처와 겹치지 않았다. `앵커` 는 오히려 자매 plan
(`spec-conventions-engine-error-code-surface.md`)의 기존 용례와 의미가 일치해 일관성이
높아지는 방향이다. `자원 액션` 행이 기존 두 "예외 —" 행과 접두 패턴이 다른 점은
target 이 이미 Rationale 로 정당화한 의도적 선택이라 등급을 매기지 않았다. CRITICAL/
WARNING 대상 없음.

## 위험도

NONE
