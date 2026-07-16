### 발견사항

- **[WARNING]** 무관한 모듈(backend auth webauthn)이 channel-web-chat 기능 PR 에 번들
  - 위치: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts`, `plan/in-progress/exec-intake-followups.md`
  - 상세: 이 변경셋의 핵심 작업은 channel-web-chat 의 `execution.replay_unavailable` 소비 배선(파일 2·3·6·7)과 그 김에 처리된 EventSource stub dedup 리팩터(파일 2·4)다. 반면 `webauthn-response.dto.ts` 주석 정정과 그 완료 기록(`exec-intake-followups.md`)은 완전히 다른 도메인(backend 인증 모듈)이고 출처 plan 도 다른 트랙(`exec-intake-followups.md` — exec-intake 큐 후속, spec `5-system/1-auth.md`)이다. 코드 diff 자체는 순수 주석 교체라 런타임 리스크는 없지만, 서로 무관한 두 백로그 항목(백엔드 인증 DTO 주석 vs 프런트 채널 위젯 기능)을 하나의 changeset 으로 묶으면 리뷰 포커스가 흐려지고 개별 revert/bisect 이 어려워진다.
  - 제안: 이 주석 수정은 별도 커밋(가능하면 별도 PR)로 분리 권장. 각 항목이 이미 plan 에 개별 추적/승인돼 있으므로("Follow-up(developer)" 로 명시) 기능적으로 문제될 결정은 아니나, 순수 scope 위생 관점에서는 분리가 낫다.

- **[INFO]** 세 개의 독립 추적 후속 항목이 한 changeset 으로 합류
  - 위치: `plan/in-progress/eia-context-schema-followups.md` (EventSource stub dedup), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (replay_unavailable 위젯 소비), `plan/in-progress/exec-intake-followups.md` (webauthn 주석)
  - 상세: 세 plan 문서 모두 각 항목을 "별도 후속"/"각각 독립 후속"으로 명시했음에도 실제 구현은 한 커밋(집합)으로 처리됐다. 다만 EventSource dedup(파일4)과 replay_unavailable 소비(파일6)는 **동일 파일**(`use-widget-eager-start.test.ts`)을 건드리고 새 테스트가 신설 헬퍼(`installControllableEventSource`)를 바로 사용하므로 이 둘의 결합은 자연스럽고 타당하다. webauthn 항목(위 WARNING)만 진짜 무관한 결합이다.
  - 제안: 향후 유사 배치 작업 시, 도메인이 겹치지 않는 후속 항목은 별도 커밋/PR 로 쪼개는 관행 권장.

- **[INFO]** EventSource stub 리팩터가 원 계획을 의도적으로 벗어남 — 근거 충분, scope 이탈 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, `plan/in-progress/eia-context-schema-followups.md`
  - 상세: 원래 백로그 항목은 `installControllableSse()` 로 4곳을 통합하라고 적혀 있었으나, 실제로는 fetch mock 이 3곳에서 다르다는 이유로 새 헬퍼 `installControllableEventSource()`(SSE stub 만) 를 추출하고 `installControllableSse()` 가 이를 조합하도록 재구성했다. plan 문서에 이 이탈 사유가 명시적으로 기록돼 있어 임의 확장이 아니라 근거 있는 설계 조정이다.
  - 제안: 없음(참고용 기록).

- **[INFO]** `use-widget.ts` 의 ref 홀더(`seedWaitingFromStatusRef`) 도입 — TDZ 우회를 위한 최소 침습 선택
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:120-125, 262-266`
  - 상세: `handleEiaEvent` 가 아래쪽에 정의된 `seedWaitingFromStatus` 를 참조해야 하는 TDZ 문제를 콜백 재정렬 대신 ref 로 우회했다. plan 노트에 "재정렬은 diff 를 키우고 다른 콜백 deps 사슬을 흔들 위험" 이라는 근거가 명시돼 있어 기능 확장이 아니라 구현상 트레이드오프다. 요청 범위(§3.1 소비 배선) 내의 필요 인프라로 판단됨.
  - 제안: 없음(참고용 기록).

### 요약
핵심 작업(EIA `execution.replay_unavailable` 위젯 소비 배선 + 관련 spec/plan 동기화, 그리고 같은 테스트 파일 내 EventSource stub dedup 리팩터)은 모두 사전에 plan 문서에 개별 추적되고 근거가 기록된 항목으로, over-engineering 이나 임의 확장 없이 요청 범위 안에서 처리됐다. 다만 완전히 무관한 도메인인 backend `webauthn-response.dto.ts` 주석 정정(및 대응 plan 기록)이 같은 changeset 에 함께 포함돼 있어, 순수 scope 관점에서는 혼합(bundling) 문제로 지적할 만하다 — 리스크 자체는 낮지만(순수 주석 변경, 이미 plan 승인됨) 리뷰/revert 단위를 흐린다.

### 위험도
LOW