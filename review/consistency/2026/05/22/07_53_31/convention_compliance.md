# Convention Compliance Review

검토 대상 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-spec-fix-5fc137`
검토 기준: `spec/conventions/**` 정식 규약
검토 일시: 2026-05-22

변경 파일 (HEAD 대비 working tree diff):
- `spec/5-system/15-chat-channel.md` — CCH-CV-03 확장, CCH-SE-03 v1 예외 표기, §4.1 주석, §5.4 Bot Token Rotation API, Rationale R8
- `spec/5-system/14-external-interaction-api.md` — EIA-AU-08 행 갱신, §3.3.1 Implementation Note 신설
- `spec/conventions/chat-channel-adapter.md` — §1.1 표 행 확장, §2.3 주석 갱신, §4 step 3 갱신, Changelog 행 추가
- `spec/4-nodes/7-trigger/providers/telegram.md` — §5.3 phone 행 확장

---

## 발견사항

### [INFO] CCH-CV-03 행 길이 — 테이블 가독성 저하
- target 위치: `spec/5-system/15-chat-channel.md` §3.2, CCH-CV-03 행
- 위반 규약: `spec/conventions/chat-channel-adapter.md` §1.1 — 테이블 행 길이 가이드라인 (기존 행과의 형식 일관성)
- 상세: 변경 후 CCH-CV-03 셀이 "(a) ... (b) ... (c) ..." 의 3분기를 한 셀에 담아 400자 이상이 됨. 기존 인접 행(CCH-CV-01 ~ CCH-CV-02, CCH-CV-04 ~ CCH-CV-05)은 한 문장 수준 (40~80자)으로 일관됨. 정식 금지 규약은 없으나 표 행 가독성 기준(§6 가이드)과 거리가 있음.
- 제안: (b) `running` 분기를 별도 CCH-CV-03b 행으로 분리하거나, 각 분기의 상세 설명을 각주/하단 산문으로 이동하고 표 셀에는 분기 요약만 남길 것. 또는 규약 자체에 "요구사항 표 셀 최대 길이 권고" 조항을 추가.

### [INFO] CCH-SE-03 행 우선순위 열 값 비표준 표기
- target 위치: `spec/5-system/15-chat-channel.md` §3.4, CCH-SE-03 행, 우선순위 열
- 위반 규약: `spec/5-system/15-chat-channel.md` 내 기존 다른 행의 우선순위 표기 패턴 — 모두 `필수` 또는 `권장` 단일 어휘
- 상세: 변경 후 우선순위 열 값이 `필수 (v2; v1 은 §4.1 plaintext stub)` 로 괄호 보충 설명을 포함함. 동일 문서 내 다른 행(CCH-MP-04 의 `필수 (단계적)` 는 선례로 존재하지만, 이는 이전 변경에서 이미 도입된 비표준 표기임)과의 일관성 여부를 확인해야 함. `필수 (단계적)` 보다 더 긴 설명구를 우선순위 열에 넣은 것은 형식 확장임.
- 제안: 우선순위 열은 `필수` 또는 `권장` 으로 한정하고, v1/v2 단계 구분 설명은 요구사항 본문 셀에 이미 서술되어 있으므로 우선순위 열의 괄호 설명을 제거하거나 `필수*` 등 별표 방식으로 단축 후 각주 처리를 권고.

### [INFO] telegram.md §5.3 phone 행 길이 — 표 가독성 저하
- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` §5.3, phone 행
- 위반 규약: 동일 표 내 다른 행 길이와의 일관성 (CCH-CV-03과 동일 맥락)
- 상세: phone 행이 200자 이상의 장문 주석을 첫 번째 셀에 포함함. 기존 행(`text`, `number`, `date`, `file` 등)은 30~50자 내외. 특히 `spec-fix-form-phone-validation` plan 참조와 상세 regex 를 표 셀에 포함하는 것은 형식 일관성 위반.
- 제안: 표 첫 번째 셀은 `(특수) phone — Form spec type Enum 미존재, v1 stub` 수준으로 요약하고, regex 및 plan 참조는 표 하단 참고 산문 또는 별도 Note 박스로 이동.

### [INFO] §5.3 phone 행의 `W-4` 참조 식별자
- target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` §5.3, phone 행 마지막 셀 `Form spec 의 type Enum 자체는 미변경 (W-4)`
- 위반 규약: 요구사항 ID 명명 규약 — 이 파일의 다른 cross-reference는 `CCH-*`, `EIA-*`, `WH-*` 패턴. `W-4` 는 어느 spec 파일에도 정의된 ID 패턴이 아님.
- 상세: `W-4` 가 무엇을 지시하는지 불명확. 기존 파일의 변경 전 행에도 `(W-4)` 가 존재하므로 이번 변경이 도입한 것은 아니지만, 행을 확장하면서 이 비정상 ID 를 그대로 유지한 점은 검토 대상. 규약상 `CCH-*` / `EIA-*` / `WH-*` 이 아닌 `W-*` prefix 는 어느 spec 에도 등장하지 않음.
- 제안: `W-4` 참조를 제거하거나, 해당 요구사항이 있는 정식 spec ID(있다면)로 교체. 없다면 단순 서술문으로 전환.

### [WARNING] §5.4 성공 응답 포맷 — `data` 래퍼 누락
- target 위치: `spec/5-system/15-chat-channel.md` §5.4 성공 응답 (200 OK) jsonc 블록
- 위반 규약: `spec/5-system/2-api-convention.md §5.1` — 단일 리소스 응답은 `{ "data": { ... } }` 형식. `spec/conventions/swagger.md §5-2` — `TransformInterceptor` 가 모든 성공 응답을 `{ data: ... }` 로 wrap
- 상세: 현재 spec 의 성공 응답은:
  ```jsonc
  {
    "triggerId": "<trigger-id>",
    "rotatedAt": "<ISO8601>",
    "chatChannelHealth": "healthy",
    "botIdentity": { ... }
  }
  ```
  `data` 키로 감싸지 않고 최상위에 직접 필드를 나열함. 동일 파일의 EIA webhook 호출 응답(§4.1)도 `data` 래퍼 없이 직접 필드를 나열하는 선례가 있으나, 이는 기존 webhook 응답 확장이라는 legacy 맥락. `rotate-bot-token` 은 신규 `/api/triggers/:id/...` endpoint 이므로 표준 규약 적용 대상.
- 제안: 성공 응답을 `{ "data": { "triggerId": "...", "rotatedAt": "...", "chatChannelHealth": "...", "botIdentity": { ... } } }` 로 수정. 또는 이 endpoint 가 `TransformInterceptor` 적용 대상이 아닌 명시적 이유를 Rationale 에 추가.

### [INFO] Rationale 항목 ID 혼용 — R8 + R-K 패턴
- target 위치: `spec/5-system/15-chat-channel.md` Rationale 섹션
- 위반 규약: 동일 문서 내 Rationale 번호 패턴 일관성
- 상세: 기존 항목은 R1~R7 숫자 시퀀스, 이번 변경으로 R8 신설. R8 이 추가된 위치는 R7 다음, R-K 이전으로 시퀀스상 올바름. 다만 R-K 는 알파벳 suffix 패턴으로 R1~R8 의 숫자 패턴과 혼용됨. R-K 는 이전 변경(HEAD commit)에서 이미 도입된 것이므로 이번 변경의 직접 위반은 아니지만, R8 추가 시 R-K 의 비일관성이 더 두드러짐.
- 제안: R-K 를 R9 로 번호화하거나, R-K 가 특별 분류(컬럼 명명 관련 별도 카테고리)임을 주석으로 명시. 향후 신설 Rationale 은 숫자 시퀀스(R9, R10...) 로 통일할 것을 권고.

### [INFO] Changelog 날짜 집계 — 2026-05-22 행 2개 병존
- target 위치: `spec/conventions/chat-channel-adapter.md` Changelog 테이블
- 위반 규약: 동 파일의 Changelog 형식 (날짜 / 내용 2열)
- 상세: 이번 변경으로 `2026-05-22` 날짜의 Changelog 행이 2개가 됨. 기존 행 (`EiaEvent union 의 execution.cancelled 주석...`) 과 신규 행 (`parseUpdate 의 null 반환 의미...`) 이 별도 행으로 분리됨. 날짜 중복 자체를 금지하는 규약은 없으나, 동일 날짜 변경은 한 행으로 합치는 것이 이 파일의 관례(`2026-05-21` 단일 행에 여러 내용 서술)와 일치함.
- 제안: 두 개의 `2026-05-22` 행을 하나로 합치거나, 두 번째 변경이 별개 PR/세션 결과임을 명시적으로 구분 표기(예: `2026-05-22 (2)`).

### [INFO] §3.3.1 헤더 명명 — Implementation Note 표현
- target 위치: `spec/5-system/14-external-interaction-api.md` §3.3.1 헤더
- 위반 규약: 문서 구조 규약상 명시적 금지는 없으나, CLAUDE.md 의 3섹션 구조(Overview / 본문 / Rationale) 와의 정합성
- 상세: `#### 3.3.1 EIA-AU-08 Implementation Note (scope 플래그 외부 오염 방지)` 는 요구사항 ID(EIA-AU-08)를 헤더에 직접 포함하는 새로운 패턴임. 기존 동일 파일의 소섹션 헤더는 `### 3.3 인증`, `### 3.4 신뢰성·일관성` 처럼 기능 명칭만 사용함. EIA-AU-08 ID 를 헤더에 포함하면 요구사항 ID 변경 시 헤더도 갱신해야 하는 결합 발생.
- 제안: 헤더를 `#### 3.3.1 Implementation Note: in-process trusted caller 오염 방지` 로 변경해 요구사항 ID 직접 결합 제거. EIA-AU-08 참조는 본문에 서술.

---

## 요약

이번 변경(워킹트리 HEAD 대비 4개 파일 수정)은 정식 규약의 직접 위반(CRITICAL)을 포함하지 않는다. 가장 주의해야 할 항목은 **[WARNING] §5.4 성공 응답의 `data` 래퍼 누락**으로, `spec/5-system/2-api-convention.md §5.1` 및 `spec/conventions/swagger.md §5-2(TransformInterceptor)` 규약과 어긋난다. 이 endpoint 가 신규 `/api/triggers/:id/chat-channel/rotate-bot-token` 이므로 legacy 예외 근거가 없어 규약 보정 또는 예외 사유 명기가 필요하다. 나머지 발견사항은 INFO 수준으로, 요구사항 표 셀의 장문화(CCH-CV-03, telegram §5.3 phone 행), `W-4` 미정의 ID 잔존, Changelog 행 분리, Rationale 번호 혼용(R8 + R-K), 소섹션 헤더의 요구사항 ID 직접 결합 등 형식 일관성 제안이다. 명명 규약(CCH-* / EIA-* prefix, SCREAMING_SNAKE 에러 코드, RPC 스타일 endpoint)은 모두 정합하며, 3섹션 구조(Overview / 본문 / Rationale)도 유지되고 있다.

---

## 위험도

LOW

STATUS: WARNING
