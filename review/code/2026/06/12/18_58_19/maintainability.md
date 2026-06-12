# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `CHAT_CHANNEL_CODES` 배열이 테스트 파일 두 위치에 분산
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — `LOCALIZED_ERROR_CODES` 내부 (라인 85–95) + `CHAT_CHANNEL_CODES` 상수 (라인 107–115)
  - 상세: chat-channel 에러 코드 7종이 `LOCALIZED_ERROR_CODES` 배열 항목으로 한 번, `CHAT_CHANNEL_CODES` 상수로 다시 한 번 열거된다. 두 목록은 `WORKSPACE_ID_REQUIRED` 유무로만 다른데, 별도 상수로 분리되어 있어 향후 코드 추가 시 양쪽을 모두 갱신해야 함을 알기 어렵다. `LOCALIZED_ERROR_CODES` 주석에 `CHAT_CHANNEL_CODES` 와의 관계를 명시하거나, `CHAT_CHANNEL_CODES` 를 `LOCALIZED_ERROR_CODES` 로부터 filter/slice 해 도출하면 중복이 제거된다.
  - 제안: `CHAT_CHANNEL_CODES` 를 독립 상수로 유지하되 `LOCALIZED_ERROR_CODES` 에 포함될 항목을 `CHAT_CHANNEL_CODES.concat(["WORKSPACE_ID_REQUIRED"])` 형태로 재사용, 또는 최소한 양측에 상호 참조 주석을 추가

- **[INFO]** `backend-labels.ts` 의 에러 코드 블록 주석이 파일 내 다른 섹션과 스타일 불일치
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` 라인 160–177
  - 상세: 기존 코드의 에러 코드 항목들은 대부분 인라인 주석이 없거나 짧은 한 줄 주석을 쓰는 패턴인데, 신규 추가된 chat-channel 블록은 2–3줄짜리 설명 주석 + spec 경로 참조를 포함한다. 스타일 자체는 좋으나 기존 패턴과 일관성이 없다. 프로젝트 전반에 이 수준의 주석 패턴을 적용하거나, 신규 블록도 최소 수준으로 맞추는 것이 일관성 측면에서 낫다.
  - 제안: 주석 수준을 기존 파일 전반 패턴과 맞추거나, 파일 수준 JSDoc/블록 주석 가이드를 CONTRIBUTING 에 기술

- **[INFO]** `INVALID_BOT_TOKEN` 과 `BOT_TOKEN_INVALID` 두 코드가 의미상 유사하나 별도 항목으로 병렬 열거
  - 위치: `backend-labels.ts` 라인 162–174, `backend-labels.test.ts` `CHAT_CHANNEL_CODES` 배열
  - 상세: `INVALID_BOT_TOKEN` ("봇 토큰이 올바르지 않아요") 과 `BOT_TOKEN_INVALID` ("봇 토큰이 유효하지 않아요 — 401/403") 은 사용자 입장에서 구별이 어렵다. 코드 자체는 spec-driven이므로 변경 불가능하지만, 주석에 각각이 발생하는 흐름(설정 시 vs setupChannel 401/403)을 명확히 구분해 두지 않으면 향후 유지보수 시 잘못된 코드로 메시지를 라우팅할 위험이 있다.
  - 제안: 각 코드의 발생 흐름(진입점)을 코드 인라인 주석에 한 줄씩 명기 — 이미 `_generator.py` 기준 주석이 일부 있으나 frontend 매핑 파일에도 기입

## 요약

이번 변경 set은 전반적으로 유지보수성이 양호하다. `backend-labels.ts` 에 신규 chat-channel 에러 코드 7종이 명확한 한국어 메시지와 spec 참조 주석과 함께 추가되었고, 테스트에서도 ko/en 동작을 루프 기반으로 검증하는 구조는 가독성이 좋다. 주요 주의점은 `CHAT_CHANNEL_CODES` 와 `LOCALIZED_ERROR_CODES` 가 중복 열거로 인한 수동 동기화 부담, 그리고 `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID` 두 유사 코드 간 의미 구분의 명시성 부족이다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서는 특이사항이 없다.

## 위험도

NONE
