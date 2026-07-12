> **복구본**: 원 sub-agent disk write 유실(disk-write gap) — workflow journal.jsonl 반환값에서 복구.

### 발견사항

- **[INFO]** 입력 payload 가 관련 spec 의 Rationale 발췌 도달 전에 truncate 됨
  - target 위치: `review/consistency/2026/07/12/15_33_33/_prompts/rationale_continuity.md` 전체(1668줄, `## 관련 Rationale 발췌` 섹션이 `spec/2-navigation/4-integration.md` 에서 잘림)
  - 과거 결정 출처: 해당 없음(프로세스 관찰)
  - 상세: 이번 검토에서 실제로 충돌 여부를 확인해야 할 핵심 인접 spec(`spec/conventions/i18n-userguide.md`, `spec/conventions/conversation-thread.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/4-execution-engine.md`)의 Rationale 은 payload 에 전혀 포함되지 않았다(발췌가 `spec/0-overview.md` → `spec/1-data-model.md` → `spec/2-navigation/*` 순서로 나열되다가 파일 크기 한도로 중간에 끊김). 이번 세션은 직접 파일시스템에서 해당 문서들을 읽어 교차검증을 완료했으나, orchestrator 가 매번 이렇게 하지 않으면 이 checker 가 정작 가장 관련성 높은 spec 을 못 보고 판정할 위험이 있다.
  - 제안: `rationale_continuity` payload 생성 시 target 문서가 명시적으로 링크하는 spec(예: target 본문의 `[../5-system/14-external-interaction-api.md]` 류 상호참조)의 Rationale 을 우선 포함하도록 발췌 선정 로직을 "전체 spec 순서 나열" 대신 "target 이 참조하는 문서 우선"으로 바꿀 것을 권고.

- **[INFO]** 확인된 양호 사례 — locale/i18n 활성화가 교과서적 "명시적 번복 + 신규 Rationale" 패턴을 따름
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md §4`·`Rationale R10`, `spec/7-channel-web-chat/2-sdk.md Rationale R6`
  - 과거 결정 출처: `plan/complete/webchat-i18n-scope.md`(옵션 (c) "코드 변경 없음" 스코프상 defer, 2026-06-XX) + `spec/conventions/i18n-userguide.md §적용 범위`(2026-07-12 갱신, "이득 0 전제는 폐기됐다" 명시) + `spec/conventions/conversation-thread.md §9 서두`("결정의 번복이 아니라 적용 범위 분리" 선례)
  - 상세: target 은 v1 "Korean-only reserved" 결정을 뒤집어 EN chrome i18n 을 활성화하면서 (a) 번복임을 명시("결정의 무근거 번복" 이 아니라 "예약된 경로의 실행"으로 프레이밍), (b) `webchat-i18n-scope.md` 실제 이력을 정확히 인용(옵션 라벨 (c), "코드 변경 없음" 스코프 조건 일치), (c) `i18n-userguide.md` 자체도 같은 날짜로 동반 개정되어 "위젯 로컬 catalog vs 메인 dict" 분리를 Rationale 로 명문화, (d) `conversation-thread.md §9` 의 기존 "위젯 스코프 예외 = 번복 아닌 범위분리" 프레이밍을 정확히 계승했다고 명시 — 실제로 해당 문구가 `conversation-thread.md` 332행에 존재함을 확인. 세 문서(target·i18n-userguide·conversation-thread)의 상호 인용이 모두 실제 파일 내용과 일치했다(가공된 "기각 이력" 없음).
  - 제안: 없음 — 모범 사례로서 향후 유사 spec 개정 시 참조 템플릿으로 유지 권장.

- **[INFO]** EIA-RL-07(idle-wait reaper)과 execution-engine "신규 주기 스캐너 미도입" 원칙의 잠재 충돌이 이미 명시적으로 해소됨
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1`·`Rationale R9`(idle-wait backstop 인용)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` 1597~1598행("heartbeat → stalled-job 일원화, 신규 주기 스캐너 미도입" 원칙, job-backed RUNNING/pending 한정 스코프 명시) + `spec/5-system/14-external-interaction-api.md` R19(EIA-RL-07 결정 2026-07-11)
  - 상세: target 이 인용하는 EIA-RL-07 은 BullMQ repeatable sweep(주기 스캐너류 메커니즘)인데, execution-engine 문서는 "신규 주기 스캐너 미도입"을 반복 강조하는 원칙을 갖고 있다. 표면적으로는 criterion 4(암묵적 invariant 우회) 위반처럼 보일 수 있으나, execution-engine 문서 1598행이 이 원칙을 "BullMQ job 이 존재하는 엔진 liveness recovery" 로 명시적으로 스코프하고 `waiting_for_input`(park, job 없음)는 원칙 대상이 아니라고 별도로 carve-out 해 두었다 — EIA §R19 도 동일 논리로 "원칙의 번복/예외 신설이 아니라 원칙이 커버하지 않는 별개 계층의 작업"이라 기술한다. 양쪽 문서가 서로 정합하게 스코프를 나눠 기록해 실제 충돌은 없다.
  - 제안: 없음 — 검증 결과 이상 없음.

### 요약
`spec/7-channel-web-chat/` 는 이번 검토 대상 5개 문서(0-architecture·1-widget-app·2-sdk·3-auth-session·4-security)의 Rationale 이 매우 촘촘히 관리되어 있으며, 기각된 대안(Shadow DOM, srcdoc 자가생성, per_trigger 토큰, localStorage 세션 저장, blacklist sanitize, fail-closed/socket-IP rate-limit, Idempotency-Key coalesce 대안 등)이 본문에 재도입된 사례는 발견되지 않았다. 유일하게 실질적으로 "결정 번복"에 해당하는 변경 — 오늘 날짜(2026-07-12)로 활성화되는 위젯 chrome EN i18n(`locale` reserved → active) — 은 정확히 이 checker 가 요구하는 방식(번복임을 명시 + 새 Rationale 작성 + 과거 이력 정확 인용)으로 처리되어 있으며, `plan/complete/webchat-i18n-scope.md`·`spec/conventions/i18n-userguide.md`·`spec/conventions/conversation-thread.md` 등 인접 spec 을 실제로 열어 교차검증한 결과 인용된 과거 결정·선례가 모두 실재하고 정확했다(가공된 "기각 이력" 없음). EIA idle-wait reaper(EIA-RL-07)와 execution-engine 의 "신규 주기 스캐너 미도입" 원칙 사이의 잠재 긴장도 양쪽 문서에서 스코프 분리로 이미 해소되어 있음을 확인했다. 다만 orchestrator 가 이 checker 에 넘긴 입력 payload 자체가 가장 관련성 높은 인접 spec(Rationale 발췌)에 도달하기 전에 truncate 되어 있었다는 점은 프로세스 개선 여지로 남는다.

### 위험도
LOW
