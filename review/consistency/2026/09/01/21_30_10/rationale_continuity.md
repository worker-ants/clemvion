# Rationale 연속성 검토 — `error-codes.md` §Overview 두 surface 병기 (spec draft)

## 검토 대상

- **target**: `plan/in-progress/spec-draft-error-code-two-surfaces.md` (spec draft, `--spec` 모드)
- **변경 대상 spec**: `spec/conventions/error-codes.md` §Overview "적용 범위" 문단
- **직접 근거로 Read 해 확인한 문서** (프롬프트 번들에는 누락돼 있었음 — `spec/conventions/error-codes.md` 와
  `plan/complete/exec-intake-followups.md` 둘 다 "관련 Rationale 발췌" 목록에도 "생략된 파일" 목록에도
  없었다. "여기 없다 = 관련 없다" 로 판단하지 않고 직접 열어 확인했다):
  - `spec/conventions/error-codes.md` (변경 대상 원문 + 기존 §5 Rationale)
  - `plan/complete/exec-intake-followups.md` ARCH#5 (`EngineErrorCode` 신설 이력 + ⑤ "2026-06-14 결정과의 관계" 문단)
  - `plan/in-progress/spec-conventions-engine-error-code-surface.md` (이 draft 를 planner 턴으로 지정한 driving plan)
  - `review/consistency/2026/08/31/21_34_02/rationale_continuity.md` (선행 라운드 — WARNING 1 + INFO 1)
  - `codebase/backend/src/nodes/core/error-codes.ts` (`ErrorCode`/`EngineErrorCode` 실제 JSDoc), `error-codes.spec.ts:59-60` (overlap 테스트)

## 발견사항

- **[WARNING]** driving plan 이 "이 항목의 실제 무게" 라 명시한 "판단 기준" 질문을 target 이 다루지 않음
  - target 위치: `spec-draft-error-code-two-surfaces.md` `## Rationale` "왜 자매 const 인가 (선례와의 이탈)" 문단 + `## 변경 제안`
  - 과거 결정 출처: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "## 함께 볼 것" —
    *"규약 문서에 한 줄을 쓰면 그 형태가 **규약으로 굳는다.** 그래서 병기만 하지 말고, '언제 central enum 을
    확장하고 언제 자매 const 를 만드는가' 의 판단 기준을 함께 적을지를 planner 가 결정해야 한다 — **그게 이
    항목의 실제 무게다.**"* 그리고 그 근거인 `plan/complete/exec-intake-followups.md` ARCH#5 ⑤ —
    *"이 논리는 `RETRY_*` 에도 똑같이 적용될 수 있었고 그때는 채택되지 않았다... 형태의 의식적 이탈이다...
    다음 사람이 '언제 central enum 을 확장하고 언제 자매 const 를 만드는가' 를 판단할 때, 내 근거가 선례를
    이겼다고 읽지 않도록[적어 둔다]."*
  - 상세: target 의 Rationale 은 "이 draft 는 그 결정을 **재확인**할 뿐 번복하지 않는다" 고만 적고,
    driving plan 이 명시적으로 결정을 요구한 "판단 기준을 함께 적을지" 질문 자체에는 답하지 않는다(적기로
    했는지, 안 적기로 했는지, 안 적는다면 왜인지 어디에도 없다). `spec/conventions/error-codes.md` 는 이
    저장소에서 **명명 규율의 SoT** 이고, 여기 "둘은 같은 파일의 자매 const" 라고만 등재되면 — 정작 같은
    파일(`error-codes.ts`) 안에 존재하는 반대 선례(`RETRY_*`: "레이어가 달라도 한 enum 에 넣어 SoT 하나
    유지")는 이 규약 문서 어디에도 등장하지 않으므로 — 다음 사람이 "엔진과 레이어가 다른 코드가 생기면
    자매 const 를 만드는 것이 규약" 이라고 **일반화해서 읽을 위험**이 남는다. 이는 ARCH#5 ⑤ 가 스스로
    "내 근거가 선례를 이겼다고 읽지 않도록" 이라며 경계했던 바로 그 오독이고, 지금은 plan 파일이 아니라
    **canonical 규약 문서**에 새겨지는 것이라 오독의 무게가 더 크다.
  - 참고: `review/consistency/2026/08/31/21_34_02` 의 WARNING(같은 축)은 `exec-intake-followups.md` ARCH#5
    완료 블록에 상세 서술을 추가해 이미 닫혔고, 그 라운드의 INFO("`error-codes.md` 가 `EngineErrorCode`
    존재를 모른다" · 제안: "한 줄 등재")는 정확히 이 target 이 이행 중인 항목이다 — target 이 그 INFO 를
    닫는 것 자체는 문제가 아니다. 다만 **INFO 를 닫는 김에 driving plan 이 새로 제기한 "판단 기준" 질문에는
    응답이 없다.**
  - 제안: 아래 중 하나를 택해 명시한다 —
    (a) §Overview 병기 문장에 짧은 경계 조건을 덧붙인다. 예: "`ErrorCode` 는 레이어가 달라도(`RETRY_*` 등)
    같은 enum 에 남는 것이 기본이며, `EngineErrorCode` 분리는 `ErrorCode` 의 docstring 이 스스로 범위를
    'node handlers' output.error.code' 로 못박고 있어 그 선언 범위를 넓히지 않기 위한 예외임" 한두 문장.
    (b) 굳이 규약에 판단 기준까지 못박지 않기로 결정했다면, target 의 Rationale 에 그 결정과 근거("사실
    등재만으로 충분하고 판단 기준 성문화는 별도 트랙" 등)를 명시적으로 남겨 driving plan 의 질문에
    "답했다"는 흔적을 남긴다. 둘 다 안 하면 다음 라운드가 같은 질문을 또 던지게 된다.

## 그 외 확인 — 문제 없음

- **§Overview 실측 정합**: `error-codes.md:25-27` 은 현재 정확히 target 이 서술한 대로 `ErrorCode` 하나만
  "대표 surface" 로 지목하고 있고, target 의 실측 표(`ErrorCode` L8, `EngineErrorCode` L147, 키 중첩 테스트
  `error-codes.spec.ts:59-60`)는 모두 실제 코드와 일치했다.
- **"기존 서술은 그대로 둔다"** — "프로젝트 전체 에러 코드 문자열에 적용" 이라는 넓은 서술을 좁히지 않고
  대표 surface 열거만 하나→둘로 늘리는 것은 §Overview 원문 구조와 정합한다.
- **§3/§4 비접촉 선언** — target 이 "안 건드린다" 고 선언한 §3(historical-artifact 예외 레지스트리, 이미
  `WORKER_HEARTBEAT_TIMEOUT` 을 `EngineErrorCode` 항목으로 보유)·§4(정규화 파이프라인, 별개 두 파이프라인
  서술) 둘 다 실제로 이번 변경 범위 밖이며 상충하지 않는다.
- **선례 재도입 여부** — 2026-06-14 사용자 결정(`4-execution-engine.md` §Rationale, `EXEC_*` prefix 기각)이
  기각한 것은 **값 레벨 prefix** 이고, target 은 값을 하나도 바꾸지 않는다(순수 문서 등재) — 기각된 대안을
  재도입하지 않는다.
- **process 경계**: target 자신이 "developer 자기-반증형 소정정 예외에 해당하지 않는다"(규약 서술이고
  developer 가 쓴 문장도 아님)고 정확히 판단해 planner 턴으로 넘긴 것도 `CLAUDE.md` §자기-반증형 소정정
  조건과 정합한다.

## 요약

target 은 선행 라운드(`21_34_02`)의 INFO 항목("`error-codes.md` 가 `EngineErrorCode` 존재를 모른다")을
정확히 이행하며, 기각된 대안(`EXEC_*` prefix)을 재도입하지 않고 값도 바꾸지 않아 **결정 번복은 없다**.
다만 이 draft 를 planner 턴으로 지정한 driving plan(`spec-conventions-engine-error-code-surface.md`)이
"이 항목의 실제 무게" 라고 못박은 질문 — "규약 문서에 병기하면 그 형태가 규약으로 굳는데, '언제 central
enum 을 확장하고 언제 자매 const 를 만드는가' 의 판단 기준을 함께 적을지" — 에는 target 이 답하지 않는다.
그 질문의 뿌리는 `exec-intake-followups.md` ARCH#5 ⑤ 가 스스로 남긴 경계("내 근거가 선례를 이겼다고 읽지
않도록")이고, 지금 그 사실이 최초로 **canonical 규약 문서**에 새겨지는 시점이라 오독 위험의 무게가
plan 파일에 적혀 있을 때보다 크다. CRITICAL 급 위반은 없으나, WARNING 1건은 병합 전에 짧게 반영할 가치가
있다.

## 위험도
LOW
