# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** allowlist 확장 범위가 계획 초안(위젯 4키) 대비 실제로는 8키(위젯 4 + chat-channel 4)로 두 배가 됐다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:77~88` (`'payload'`·`'title'`·`'rendered'`·`'nodeType'` 추가분)
  - 상세: `plan/in-progress/sse-nodeoutput-allowlist.md` 본문이 스스로 밝히듯, 이 4키는 착수 후 실측(chat-channel 렌더러가 `nodeOutput.payload`/`.title`/`.rendered`/`.nodeType` 를 top-level flat legacy shape 으로 읽음)으로 드러난 것이며, 넣지 않으면 "allowlist 를 좁혔더니 Discord/Telegram/Slack 메시지가 조용히 빈다"는 기능 파손이 발생한다. 즉 기능 확장(over-engineering)이 아니라 **본래 변경("REST 와 SSE 방어 강도를 맞춘다")의 정합성을 지키기 위한 필수 보정**이다. 근거(사용 횟수 실측, `it.each` 캐너리, 리터럴 테스트, JSDoc·spec 표 3그룹 동기화)가 모두 갖춰져 있어 범위 이탈로 보기 어렵다. 참고용으로만 기록.
  - 제안: 조치 불요 — 정상적인 범위 내 발견.

- **[INFO]** `codebase/backend/src/shared/utils/node-output-allowlist.ts` 상단 주석의 "소비처도 `getStatus` 한 곳이다" 문구를 "소비처는 둘이다"로 수정
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:8~12`
  - 상세: 이번 PR 자체가 `websocket.service.ts` 를 두 번째 소비처로 추가하므로, 그 파일의 소비처 개수를 서술하는 헤더 주석이 즉시 낡는다. 같은 파일·같은 변경으로 인해 발생한 직접적 부작용을 그 자리에서 고친 것이라 무관한 리팩토링이 아니라 변경과 결합된 필수 수정이다.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/08/23/22_26_33/**` 8개 파일과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`·`plan/in-progress/sse-nodeoutput-allowlist.md` 갱신이 diff 에 포함
  - 위치: 파일 5~14 전체
  - 상세: 이들은 CLAUDE.md 워크플로가 강제하는 `/consistency-check --impl-prep` 산출물과 plan 트래커 체크리스트 반영(`plan/**` 은 developer 쓰기 허용 영역)이다. 코드 변경과 무관한 임의 문서 작업이 아니라 이 프로젝트의 필수 절차 단계이므로 범위 이탈이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 변경 포함
  - 위치: 파일 15~16
  - 상세: 두 spec 변경은 plan 체크리스트의 "(planner 턴) §R17 표의 SSE 행 flip + '강도가 다르다' 서술 제거 + WS §4.4 단서" 항목과 정확히 일치하며, 이번 작업의 핵심 산출물(REST·SSE 방어 강도를 문서에도 반영)이다. 무관한 spec 영역 수정이 아니다. (역할 분리 준수 여부 — 실제로 project-planner 턴에서 수행됐는지 — 는 이 리뷰의 관점 밖이므로 별도 확인 필요 시 프로세스 감사로 다룰 것.)
  - 제안: 조치 불요.

포맷팅(공백·줄바꿈)만의 변경, 불필요한 import 정리, 관련 없는 리팩토링, 의도 밖 설정 파일 변경은 발견되지 않았다. 신규 함수 `allowlistFanoutNodeOutput` 는 단일 chokepoint(`toFanoutEnvelope`) 안에서만 호출되고, 기존 strip 로직의 순서(strip → allowlist → routing 첨부)를 유지한 채 삽입돼 있어 과도한 설계 확장 없이 최소 배선으로 구현됐다.

## 요약

16개 변경 파일 전부가 "SSE/fanout `nodeOutput` 을 REST 와 동일한 fail-closed allowlist 로 닫는다"는 단일 목표에 직접 연결된다. 핵심 로직 변경(`websocket.service.ts`의 `allowlistFanoutNodeOutput` 신설 및 `toFanoutEnvelope` 배선, `node-output-allowlist.ts`의 chat-channel 4키 추가)은 계획서(`plan/in-progress/sse-nodeoutput-allowlist.md`)의 작업 목록과 1:1 대응하고, 테스트 추가(캐너리·리터럴 테스트)도 검증 기준에 명시된 범위 안에 있다. 8키로 늘어난 allowlist는 계획 초안보다 넓어 보이지만 착수 후 실측으로 드러난 기능 파손(chat-channel 렌더 유실)을 막기 위한 필수 보정이지 요청 밖의 기능 확장이 아니다. plan 트래커·spec 문서 갱신, consistency-check 산출물 커밋은 이 저장소의 표준 워크플로 산출물이며 무관한 파일 수정이 아니다. 포맷팅 전용 변경, 불필요한 임포트, drive-by 리팩토링, 관련 없는 주석 변경은 관찰되지 않았다.

## 위험도

NONE
