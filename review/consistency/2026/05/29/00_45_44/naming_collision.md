# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-ai-error-output-fields.md`
변경 파일: `spec/4-nodes/3-ai/2-text-classifier.md` (§5.1/§5.2/§5.3), `spec/4-nodes/3-ai/3-information-extractor.md` (§5.3)

---

## 발견사항

### 1. 요구사항 ID 충돌

충돌 없음. target 은 요구사항 ID 를 새로 부여하지 않는다. C-1 / C-2 / W-1 은 plan 내부 섹션 레이블이며 spec ID 체계(NAV-*, ND-*, NF-*) 와 무관하다.

### 2. 엔티티/타입명 충돌

- **[INFO]** `output.error.details.retryable` 필드명 — 이미 정의된 이름과 의미 일치, 신규 도입 아님
  - target 신규 식별자: text-classifier §5.3 필드 표 및 JSON 예시에 `output.error.details.retryable`, `output.error.details.retryAfterSec?` 추가; information-extractor §5.3 동일
  - 기존 사용처: `spec/conventions/node-output.md` §3.2.1 (라인 128–129) 에서 두 필드가 공통 표준으로 먼저 정의됨. `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 (라인 853–854, 886–887) 에서 ai_agent 가 이미 구체 값 예시(`"retryable": true`, `"retryAfterSec": 30`)를 사용 중
  - 상세: target 이 추가하는 두 필드는 기존 정의와 동일한 이름·동일한 의미로 사용된다. 충돌이 아니라 **누락된 준수를 보강**하는 것이므로 naming 충돌 없음
  - 제안: 변경 불필요

- **[INFO]** `status: 'ended'` 필드 — 이미 정의된 값과 의미 일치
  - target 신규 식별자: text-classifier §5.1/§5.2/§5.3 의 JSON 예시 + 필드 표에 `status | 'ended' | handler return | 종결 상태` 추가
  - 기존 사용처: `spec/conventions/node-output.md` Principle 0 (라인 22: `status: 흐름 제어 상태 ('waiting_for_input', 'resumed', 'ended' 등)`), Principle 4 상태 전이도 (라인 176: `status: "ended"`). `spec/4-nodes/3-ai/3-information-extractor.md` §5.1/§5.6 에서 `"status": "ended"` 이미 사용 중
  - 상세: 값 리터럴 `'ended'` 는 기존 컨벤션에서 확립된 의미 (종결 상태) 와 동일하게 사용된다. 충돌 없음
  - 제안: 변경 불필요

### 3. API endpoint 충돌

없음. target 은 새 API endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌

없음. target 은 webhook·queue·SSE 이벤트 이름을 새로 정의하지 않는다.

### 5. 환경변수·설정키 충돌

없음. target 은 ENV var 나 config key 를 새로 도입하지 않는다.

### 6. 파일 경로 충돌

없음. target 은 새 파일을 생성하지 않고 기존 두 파일(`spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md`)의 본문만 수정한다.

---

## 요약

target 문서(spec-draft-ai-error-output-fields)가 도입하는 식별자는 모두 `spec/conventions/node-output.md §3.2.1` 과 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 에 이미 확립된 공통 표준(`retryable`, `retryAfterSec?`, `status: 'ended'`)을 text-classifier / information-extractor 에 **누락된 상태에서 보강하는 것**이다. 새로 이름을 만들거나 기존 이름을 다른 의미로 재사용하는 경우가 전혀 없으므로, 신규 식별자 충돌 관점에서 발견된 문제는 없다.

---

## 위험도

NONE
