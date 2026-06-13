# 변경 범위(Scope) 리뷰

## 발견사항

변경이 적용된 파일 7개 전체를 검토했다.

### 파일 1: telegram-client.ts
- **[INFO]** 새 인터페이스 `TelegramEditMessageReplyMarkupParams` 와 메서드 `editMessageReplyMarkup` 추가.
  - 위치: diff +35~+62
  - 상세: §5.2(3) 중복 클릭 차단을 위한 Bot API `editMessageReplyMarkup` 래퍼. 기존 메서드 패턴(toRecord + call<T>)과 일관된 구조. 코드·주석 모두 해당 기능 범위에 한정.
  - 제안: 해당 없음.

### 파일 2: telegram-message.renderer.spec.ts
- **[INFO]** `ai_message` 관련 테스트 4건의 기댓값을 typing 선행 포함 구조로 수정하고 테스트 이름 갱신.
  - 위치: diff 전 범위
  - 상세: 렌더러 변경(파일 3)에 대한 대응 수정으로 범위 내. `fail('expected text body')` 제거는 chunked 테스트에서 else 분기가 실제로 unreachable 해진 결과로 정당하다. 포맷팅 변경 없음.
  - 제안: 해당 없음.

### 파일 3: telegram-message.renderer.ts
- **[INFO]** `renderAiMessage` 내 typing 선행 삽입 로직 추가.
  - 위치: diff +781~+788
  - 상세: §5.1 요구사항에 따른 단일 로직 변경. 나머지 함수·로직은 일절 손대지 않음.
  - 제안: 해당 없음.

### 파일 4: telegram-update.parser.spec.ts
- **[INFO]** `callback_query` 에 `message_id` 가 있을 때 `messageId` 를 동봉하는 신규 테스트 1건 추가.
  - 위치: diff +1726~+1743
  - 상세: 파서 변경(파일 5)에 직접 대응하는 단위 테스트. 기존 테스트는 변경 없음.
  - 제안: 해당 없음.

### 파일 5: telegram-update.parser.ts
- **[INFO]** `callbackQuery.message` 타입에 `message_id?: number` 추가, `messageId` 조건부 spread.
  - 위치: diff +1996~+2019
  - 상세: §5.2(3) 키보드 제거를 위한 최소 타입 확장 및 전달. 기존 parse 로직·분기 미변경.
  - 제안: 해당 없음.

### 파일 6: telegram.adapter.spec.ts
- **[INFO]** mock 에 `editMessageReplyMarkup` 추가, ackInteraction 범위에 3개 테스트 케이스 추가.
  - 위치: diff +24(mock), +313~+296(테스트 블록)
  - 상세: 어댑터 변경(파일 7)을 커버하는 최소 테스트 추가. 기존 테스트 수정 없음. mock 에 메서드 추가는 타입 오류 방지상 필요.
  - 제안: 해당 없음.

### 파일 7: telegram.adapter.ts
- **[INFO]** `ackInteraction` 내부에 `editMessageReplyMarkup` best-effort 호출 블록 추가.
  - 위치: diff +2729~+2749
  - 상세: §5.2(3) 계약에 따른 단일 블록 삽입. 기존 메서드·프로퍼티 미변경. try/catch 로 best-effort 처리하며 ack 흐름 비중단이 명시적으로 설계됨.
  - 제안: 해당 없음.

---

## 요약

변경된 7개 파일 전체가 두 가지 명확히 정의된 기능 범위 내에 있다. (1) §5.1 typing indicator — `renderAiMessage` 에 typing 선행 삽입 + 대응 테스트 갱신. (2) §5.2(3) 버튼 중복 클릭 차단 — `editMessageReplyMarkup` 클라이언트 메서드 신설, 파서가 `message_id` 를 `messageId` 로 전달, 어댑터 ack 흐름에 best-effort 키보드 제거 삽입 + 대응 테스트 추가. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 변경, 사용되지 않는 임포트 추가, 설정 파일 변경은 발견되지 않았다. 모든 주석·테스트 이름 변경은 실질 기능 변경을 반영한 것으로 정당하다.

## 위험도

NONE
