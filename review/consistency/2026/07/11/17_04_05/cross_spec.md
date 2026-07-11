# Cross-Spec 일관성 Check — 결과

대상: `plan/in-progress/spec-draft-webchat-execution-residuals.md` (spec draft, `--spec` 모드)

## 발견사항

- **[WARNING]** execution-engine.md 내 "무기한 보존 + 워크플로우 정의 timeout" 불변식이 두 곳에 중복 서술 — 변경안 (3)은 한 곳만 편집
  - target 위치: 변경안 `(3) spec/5-system/4-execution-engine.md` — "§7.4 carve-out 문구를 소폭 확장"
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §4.x "waiting_for_input park" (L425~431, 특히 L431: `"노드 자체의 워크플로 정의 timeout(예: formConfig.timeout)은 엔진 자원 가드와 별개로 유지"`) — §7.4(L930)의 carve-out 서술과 **거의 동문(almost verbatim duplicate)**
  - 상세: 같은 불변식이 §4.x와 §7.4 두 곳에 독립적으로 적혀 있다. 변경안 (3)은 §7.4만 "채널이 판정하는 provably un-continuable 상태(EIA §B-2)" 카테고리로 확장하기로 했는데, §4.x는 그대로 두면 같은 문서 안에서 같은 불변식이 한 곳은 신규 예외를 언급하고 다른 한 곳은 언급하지 않는 **비대칭 서술**이 남는다. 다음에 §4.x만 읽는 독자는 B-2 backstop의 존재를 놓친다.
  - 제안: (3)에 §4.x L431 cross-ref 1줄 추가(또는 §7.4로의 단일 SoT 정리) 병기.

- **[WARNING]** 변경안 (6)이 가리키는 "auth-session.md §3.1 토큰 만료/서버 타임아웃 행"이 실제로는 auth-session.md가 아니라 widget-app.md에 있음
  - target 위치: 변경안 `(6) spec/7-channel-web-chat/3-auth-session.md` — `"§3.1 '토큰 만료/서버 타임아웃' 행(또는 §R6)"`
  - 충돌 대상: 실제 "토큰 만료/서버 타임아웃" 행은 `spec/7-channel-web-chat/1-widget-app.md` §3.1(L88, 상태표 마지막 행)에 있다. `spec/7-channel-web-chat/3-auth-session.md` §3.1은 제목이 "재로드 복원 시퀀스"이고 1~3단계 절차만 있을 뿐 그런 표/행이 존재하지 않는다.
  - 상세: 편집 대상 파일·섹션 지정이 잘못되면 실제 spec 편집 단계(체크리스트 (6))에서 존재하지 않는 행을 찾다가 혼선이 생기거나, widget-app.md L88 행(이미 변경안 (1)이 다루는 §3.1 "새 대화" 행과는 다른 행)이 누락된 채 넘어갈 수 있다. widget-app.md L88 행 자체는 현재 변경안 (1)의 편집 범위(§3.1 "새 대화" 행 + §R7 + 신규 §R9)에 명시적으로 포함돼 있지 않다.
  - 제안: (6)을 "auth-session.md §R4/§R6 근처에 B-2 cross-ref 1줄 추가"로 정정하고, widget-app.md §3.1 "토큰 만료/서버 타임아웃" 행(L88) 자체의 B-2 언급 여부를 변경안 (1)에 명시적으로 추가할지 결정.

- **[WARNING]** `spec/data-flow/` 미러 문서 2건이 변경안·spec_impact 목록에서 누락 — 기존 동종 패턴(주기 job, 상태 전이)의 canonical 카탈로그
  - target 위치: frontmatter `spec_impact` 및 변경안 (1)~(7) 전체 — `spec/data-flow/**` 파일이 하나도 없음
  - 충돌 대상 1: `spec/data-flow/15-external-interaction.md` §2.2 "Redis / BullMQ" — 기존 `terminal-revoke-reconcile`(EIA-RL-06) 같은 주기 스케줄 job을 카탈로그화하는 표가 이미 존재. B-2의 신규 주기 reaper job도 같은 성격이라 이 표에 행이 추가돼야 대칭이다.
  - 충돌 대상 2: `spec/data-flow/3-execution.md` §3.1 `execution.status` 상태 전이 다이어그램 — `waiting_for_input --> cancelled: 사용자 cancel API`(L253) 행이 이미 존재. B-2는 같은 전이(`waiting_for_input --> cancelled`)에 **두 번째 트리거**(채널 idle-wait timeout backstop)를 추가하는데, 이 diagram에는 반영되지 않는다.
  - 상세: 두 data-flow 문서 모두 이번 draft가 다루는 대상(EIA 토큰/execution 상태 전이, BullMQ 주기 job)의 기존 canonical 미러다. developer가 코드만 구현하고 이 두 문서를 갱신하지 않으면 상태 전이 카탈로그·job 카탈로그가 stale해진다(프로젝트 관행상 실제로 반복 발생해온 drift 패턴).
  - 제안: 체크리스트 (7) 앞에 `(7-a) data-flow/3-execution.md §3.1 상태 전이 행 추가` + `(7-b) data-flow/15-external-interaction.md §2.2 BullMQ job 카탈로그 행 추가`를 신설해 변경안에 명시.

- **[INFO]** execution-engine.md §7.4에 도입할 "채널이 판정하는 provably un-continuable 상태" 문구가 "채널(Chat Channel)"이라는 기존 정의된 용어와 충돌할 여지
  - target 위치: 변경안 `(3)` "§7.4 carve-out … **채널이 판정하는 provably un-continuable 상태(EIA §B-2)**"
  - 충돌 대상: `spec/5-system/15-chat-channel.md` — "Chat Channel"(Telegram 등 외부 채팅 플랫폼 어댑터, per_trigger·in-process)은 이미 이 spec 트리에서 "채널"이라는 단어의 공식 의미를 갖고 있다. 그런데 draft 본문 스스로 "chat-channel(Telegram 등)은 per_trigger·in-process 라 B-2 범위 밖"이라고 명시해 B-2가 그 "채널"과는 **다른 대상**(익명 공개 웹채팅 위젯, `auth_config_id IS NULL` + `per_execution`)임을 밝히고 있다.
  - 상세: execution-engine.md는 채널 비특정(channel-agnostic) 시스템 레벨 문서다. 거기에 한정어 없이 "채널이 판정하는"이라는 표현을 넣으면, 향후 이 원칙 예외 문구만 보는 독자가 Chat Channel(Telegram) 트리거에도 이 예외가 적용된다고 오독할 위험이 있다 — 실제로는 정반대(명시적으로 제외)다.
  - 제안: execution-engine.md 편집 시 "채널" 대신 "공개 웹채팅 위젯(EIA §B-2, `auth_config_id IS NULL` + per_execution 한정)" 등 구체적 스코프 문구를 쓰거나, 최소한 "Chat Channel(§15)과는 별개"라는 각주를 병기.

- **[INFO]** B-2의 "chat-channel-adapter 렌더 로직 변경 불요" 근거 인용이 실제 적용 메커니즘과 다소 어긋남(결론은 맞음)
  - target 위치: §B-2 범위 제약 "`error.code` 는 어댑터의 generic fallback 이 이미 커버"
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` L342 — `execution.cancelled` 이벤트는 CCH-ERR-04(`execution.failed` 용 unknown-code fallback, §3.1)가 아니라 별도의 단순 분기(`error.code`가 `RESUME_*`면 graceful, 그 외는 일반 취소 안내)로 처리된다. `CHANNEL_IDLE_TIMEOUT`은 이 "그 외" 분기로 자연스럽게 떨어지므로 결론("어댑터 변경 불요")은 맞지만, 인용한 메커니즘 이름(“generic fallback”)이 실제로 적용되는 코드경로(§3.1 실패-분류 표가 아니라 §3.4-근처 취소-이벤트 이분기)와 다르다.
  - 상세: 결론에는 영향 없는 서술 정밀도 문제.
  - 제안: 편집 시 인용을 "chat-channel-adapter.md의 `execution.cancelled` 처리(`RESUME_*` 외 전부 일반 취소 안내)로 자연 커버"로 바로잡을 것.

## 검증 완료(충돌 없음으로 확인된 항목)

- `cancelledBy: "user" | "system" | "timeout"` 닫힌 3값 union은 EIA §6.5(L646)·WS §4.1(L179)·`chat-channel-adapter.md`(L133) 세 곳 모두 동일 — draft가 4번째 값을 추가하지 않고 `'timeout'` 재사용 + 신규 `error.code`만 추가하는 설계는 세 곳 모두와 정합.
- `EIA-RL-07`은 실제로 §3.4의 다음 빈 슬롯(현재 최대 `EIA-RL-06`, L144) — ID 충돌 없음. spec 전체에 `EIA-RL-07`/`CHANNEL_IDLE_TIMEOUT` 기존 사용 0건.
- `EIA-AU-05` 앵커 `#33-인증`은 실제 §3.3 제목(L85)과 일치(§3.3.1은 하위 앵커 `#331-...`).
- widget-app.md는 실제로 `§R8`까지만 사용 중(L180) — 신규 `§R9` 추가는 번호 충돌 없음. §3.1 "새 대화" 행(L87)·§R7(L157~166) 텍스트도 draft가 인용한 그대로.
- execution-engine.md L1352("recovery loop 주기적 스캔 추가 — … 운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖")·L1597("신규 주기 스캐너 미도입" 원칙)은 draft C2 반영 근거와 문맥상 일치. B-2가 이 원칙의 "job이 존재하는 RUNNING/pending 복구" 스코프 밖(park는 애초 job 부재)이라는 구분도 §7.4 원문(L930 "waiting_for_input" 은 stuck-recovery 대상 아님)과 정합.
- auth-session.md §3 시퀀스 7(L54, 만료 30분 이내 proactive refresh)은 §3.1의 명시적 "Planned" 배너(L62, reload-401 refresh만 미구현으로 한정) 밖에 있어 draft가 "구현됨"으로 전제한 것과 상충하지 않음. EIA §5.5(L512)·§5.1(L336-348, `TOKEN_EXPIRED` guard 선차단)도 draft의 "완전 만료 JWT는 refresh 핸들러 도달 전 401" 주장과 일치.
- EIA §5.4(L482-498)의 `/cancel`은 `iext_jwt | itk_token` 모두 인증 허용 — 위젯이 자신의 `per_execution` 토큰으로 자기 execution을 cancel할 수 있다는 B-1 전제와 정합.
- RBAC/권한 모델: B-1/B-2 모두 기존 EIA 토큰 스코프·`revokeAllForExecution`(EIA-RL-06) 재사용뿐, 신규 권한 개념 도입 없음 — 충돌 없음.

## 요약

이번 draft는 이전 consistency-check 라운드(2026-07-11 16:45)에서 지적된 CRITICAL(C1: cancelledBy 4번째 값 추가, C2: 신규 주기 스캐너 원칙 위반)을 실제 spec 본문과 대조한 결과 모두 올바르게 철회·재설계했다 — `cancelledBy` 3값 union은 EIA/WS/chat-channel-adapter 세 미러 모두와 일치하고, 주기 스캐너 예외 논거도 execution-engine.md의 실제 기각 근거(§7.1/§7.4 L1352/L1597) 문맥과 부합한다. 요구사항 ID(`EIA-RL-07`)·앵커(`#33-인증`)·Rationale 번호(`§R9`)도 실측 검증 결과 충돌이 없다. 다만 변경안(편집 계획) 단계에서 새로 발견된 문제가 넷 있다: (1) execution-engine.md 안에 같은 불변식이 두 곳(§4.x·§7.4)에 중복 서술돼 있는데 편집 대상은 한 곳만 지정됨, (2) 변경안(6)이 존재하지 않는 auth-session.md §3.1 행을 편집 대상으로 잘못 지정함(실제 행은 widget-app.md에 있음), (3) `spec/data-flow/3-execution.md`(상태 전이 카탈로그)와 `spec/data-flow/15-external-interaction.md`(BullMQ job 카탈로그) 두 canonical 미러 문서가 변경안에서 완전히 누락됨. 이 셋은 편집 실행 단계에서 스코프를 좁게 잡으면 실제 spec 트리 안에 stale/비대칭 서술을 남길 수 있는 WARNING이다. 추가로 "채널" 용어 재사용이 Chat Channel(§15-chat-channel)과의 오독 위험을 낳는 INFO 1건과 인용 정밀도 INFO 1건이 있다. CRITICAL은 없다.

## 위험도

MEDIUM
