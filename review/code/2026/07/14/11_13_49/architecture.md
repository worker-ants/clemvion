# 아키텍처(Architecture) Review

> 대상 payload 는 spec 문서(`spec/5-system/15-chat-channel.md` / `4-execution-engine.md` / `6-websocket-protocol.md`) 3건뿐이었다.
> 요청받은 F-4/F-5/F-6 의 실제 구현체는 payload 에 없어, spec 이 참조하는 구현 파일(`chat-channel-config.dto.ts`,
> `language-hint-defaults.ts`, `hooks.service.ts`, `websocket.gateway.ts`, `execution-engine.service.ts`)을 직접 열어
> 레이어링을 확인했다. F-4 는 payload spec diff 에는 등장하지 않으나 `plan/in-progress/eia-command-waiting-surface-guard.md`
> 에 동일 작업 단위로 기록돼 있어 함께 점검했다.

## 발견사항

- **[WARNING]** F-5: MarkdownV2 특수문자 집합의 이중 정의 (SoT 드리프트 위험)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:170` (`MD_V2_SPECIAL_CHARS`) vs `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27` (`MD_V2_ESCAPE_REGEX`)
  - 상세: 두 상수가 텔레그램 MarkdownV2 특수문자 집합을 서로 다른 모듈(triggers DTO / chat-channel 렌더러)에 각각 리터럴로 정의한다. 동기화는 `// MarkdownV2 특수문자 집합 (telegram-message.renderer.ts MD_V2_ESCAPE_REGEX 와 동일)` 주석 한 줄에만 의존하며, 공유 상수 import 나 컴파일타임/테스트 단언이 전혀 없다. 실제 발송 경로(renderer)의 escape 문자 집합이 (텔레그램 API 변경 등으로) 바뀌는데 DTO 쪽 리터럴 갱신을 누락하면, F-5 validator 가 실제로는 안전하지 않은 override 를 통과시켜 `sendMessage` 400 거부로 안내가 조용히 유실되는, F-5 가 막으려던 바로 그 결함이 재발한다(또는 반대로 안전한 입력을 오탐 거부).
  - 제안: `MD_V2_SPECIAL_CHARS`/`MD_V2_ESCAPE_REGEX` 를 `chat-channel/shared/` 아래 공유 유틸로 단일화해 두 파일 모두 import 하거나, 최소한 "두 정의가 동일 문자 집합"임을 assert 하는 계약 테스트를 추가한다.

- **[WARNING]** F-5: provider-aware validator 의 `args.object` 의존 + raw-send 키 화이트리스트 이중 관리 (레이어 경계 흐림)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:159-219` (`TELEGRAM_RAW_SEND_HINT_KEYS`, `LanguageHintsRawSendValidator.validate` — `(args.object as { provider?: unknown }).provider`)
  - 상세: class-validator cross-field 관용구로 `args.object` 를 느슨한 타입 캐스팅해 sibling `provider` 필드를 읽는다 — 타입 시스템 보증 없이 DTO 구조(필드명 `provider` 존재)에 암묵 의존. 더 근본적으로, "렌더러를 거치지 않고 `adapter.sendMessage` 로 raw 발송되는 languageHints 키" 목록(`TELEGRAM_RAW_SEND_HINT_KEYS`, 7개)이 **Triggers 모듈**의 DTO 파일에 하드코딩돼 있는 반면, 이 지식의 실제 출처(어떤 키가 실제로 raw 발송되는가)는 **chat-channel/hooks 모듈**의 `HooksService` 개별 메서드 호출부(`hooks.service.ts` 810/900/917행 등)에 흩어져 있다. `grep` 결과 `TELEGRAM_RAW_SEND_HINT_KEYS` 는 정의한 DTO 파일 밖에서 전혀 참조되지 않아, 두 목록을 연결하는 컴파일타임/테스트 강제가 없다 — HooksService 가 향후 새 raw-send 안내를 추가하면서 이 validator 목록 갱신을 누락해도 아무 것도 실패하지 않는 silent gap 이다. 결과적으로 "텔레그램 렌더링 wire 계약"(무엇이 raw 발송되는가)이라는 어댑터 계층 지식이 Triggers 모듈의 DTO(입력 검증/프레젠테이션 계층)로 새어 들어간 상태 — SRP/레이어 분리 관점의 결합.
  - 제안: raw-send 키 목록을 실제 소비처(chat-channel/hooks 쪽)에 단일 정의하고 DTO 는 그것을 import하거나, 최소한 두 목록 간 exhaustiveness 를 검증하는 단위 테스트를 추가한다. `args.object` 캐스팅은 반복되는 곳이 2군데(`validate`/`defaultMessage`)이므로 타입가드 헬퍼로 감싸는 것을 고려한다.

- **[INFO]** F-6: WS 게이트웨이 → 실행엔진 레이어링은 양호 (참고용 — 문제 아님)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:569-637` (`handleClickButton`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4815-4832` (`continueButtonClick`), `:5281` (`resolveWaitingNodeExecutionId`)
  - 상세: WS gateway 핸들러는 `data.nodeId` 를 그대로 `expectedNodeId` 파라미터로 넘기기만 하는 얇은 transport adapter 이고, 실제 "대기 노드와 nodeId 대조" 로직은 `ExecutionEngineService.resolveWaitingNodeExecutionId` 단일 헬퍼에 있다. 이 헬퍼는 `continueButtonClick`/`continueAiConversation`/`endAiConversation` 세 continuation 경로가 공유해, gateway 핸들러마다 검증 로직을 중복 구현하지 않는다. 프레젠테이션(gateway)과 도메인(execution-engine) 책임이 깔끔히 분리된 사례.
  - 제안: 없음(현행 유지 권장, 향후 유사 continuation 명령 추가 시 동일 헬퍼 재사용 원칙 유지 권장).

- **[INFO]** F-6: `execution.click_button` 의 `nodeId?` 는 현재 생산자가 없는 필드
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (click_button 호출부는 `nodeId` 미전달) vs `websocket.gateway.ts:572` `data: { executionId; nodeId?: string; buttonId }`
  - 상세: spec 도 "frontend 는 click_button 에 nodeId 를 싣지 않아 실질 no-op" 이라 명시한다. `submit_message`/`end_conversation` 과의 payload 형태 대칭을 위해 backend 필드/forward 경로를 선제 확장한 것으로 보이며, 현재는 죽은 경로(YAGNI 여지)다. 문서화된 의도적 forward-compat 이라 결함은 아니다.
  - 제안: 별도 조치 불필요. 추후 "미사용 optional 필드" 정리 스윕 시 인벤토리에 포함 고려.

- **[INFO]** F-4: `makeLocaleResolver` factory — SRP/DRY/OCP 관점에서 양호한 리팩터링
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:29-42` (factory), `:139`/`:160`/`:188` (3개 적용처 — `resolveFormOpenLabel`/`resolveSessionExpiredMessage`/`resolveSurfaceMismatchMessage`)
  - 상세: 직전 아키텍처 리뷰(`review/code/2026/07/14/00_09_28/`)가 지적한 "3-level lookup resolver 3중 문자 단위 복제"를 고차함수 factory 로 통합했다 — 신규 control-plane 키 추가 시 함수 전체 복제 대신 `makeLocaleResolver(key, defaults)` 호출 한 줄로 확장 가능해져 OCP 개선. `sendBestEffortNotice`(`hooks.service.ts:990`) 도 3개 발송 메서드의 try/catch/warn 골격을 추출해 동일한 개선을 적용했다.
  - 제안: 없음(모범 사례로 유지 권장).

- **[INFO]** F-4: `sendExecutionStillRunningNotice` 는 factory 패턴에서 제외된 잔존 케이스 — F-5 spec 이 자인한 "잔여 갭"의 실물 증거
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1009-1024`
  - 상세: 다른 3개 control-plane 안내(`formOpenLabel`/`sessionExpired`/`surfaceMismatch`)는 `language-hint-defaults.ts` 에 default 문구가 중앙화되고 `makeLocaleResolver` 로 조회되는 반면, `executionStillRunning` 의 default(`'워크플로우가 처리 중입니다\\. 잠시만 기다려 주세요\\.'`)는 `hooks.service.ts` 안에 인라인 하드코딩돼 있고, 이미 수작업으로 escape 된 문자열(`\\.`)이 박혀 있다. 이는 spec(`15-chat-channel.md` §4.1.1 F-5 절)이 스스로 명시한 "defaults 의 telegram escape baked-in 이 slack/discord 에서 literal 로 노출되는 잔여 갭"의 구체 사례다. `executionStillRunning` 은 `TELEGRAM_RAW_SEND_HINT_KEYS` 에 포함돼 operator override 는 F-5 validator 로 검증되지만, default 문구 자체는 (a) 중앙 저장소 밖에 있고 (b) slack/discord 로 그대로 나가면 리터럴 `\.` 이 노출된다. spec 이 "기존 5 키 군이라 EN default화는 범위 밖"으로 명시적 스코프 아웃했으므로 결함은 아니나, 이번 F-4/F-5 라운드가 4개 케이스 중 3개만 통일하고 1개는 손대지 않아 "안내 default 텍스트의 SoT"가 두 위치(중앙 파일 vs 인라인)로 갈라진 상태가 그대로 유지·강화됐다.
  - 제안: 백로그로 이미 기록돼 있으므로 그대로 진행하되, 착수 시 4개 케이스 모두 동일 추상화(`language-hint-defaults.ts` + per-provider escape)로 정리할 것을 권장.

## 요약

이번 변경분(F-4/F-5/F-6)이 참조하는 실제 구현은 레이어링 면에서 대체로 견고하다. F-6(WS nodeId forwarding)은 게이트웨이(프레젠테이션)와 실행엔진(도메인)의 책임 분리가 깨끗하고, nodeId 대조 로직이 `resolveWaitingNodeExecutionId` 단일 헬퍼로 재사용되어 `/interact` REST 경로와도 대칭을 이룬다. F-4(factory 추출)는 직전 리뷰 피드백을 받아 3중 복제를 고차함수 factory 로 통합한 모범적인 DRY/OCP 개선이다. 다만 F-5(provider-aware raw-send validator)는 두 가지 구조적 리스크를 안고 있다 — (1) MarkdownV2 특수문자 집합이 Triggers DTO 와 chat-channel 렌더러에 각각 리터럴로 이중 정의되어 주석에만 의존한 수동 동기화 상태이고, (2) "raw 발송되는 languageHints 키" 화이트리스트가 실제 발송 지점(HooksService)과 연결되지 않은 채 DTO 계층에 하드코딩돼 있다. 두 경우 모두 지금 당장 동작 결함은 아니지만, 이 기능 자체가 "안내 유실을 조용히 방치하지 않는다"(CCH-ERR-04)는 목적의 안전장치이기 때문에, 두 SoT 가 드리프트하면 검증이 조용히 무력화되어 정확히 막으려던 실패 모드(400 거부로 인한 안내 유실)가 재발할 수 있다는 점에서 리스크가 실질적이다. 부수적으로 F-4/F-5 라운드가 4개 control-plane 안내 default 중 3개만 공통 저장소로 통일하고 `executionStillRunning` 은 인라인 하드코딩으로 남겨, spec 이 스스로 인정한 "escape baked-in 잔여 갭"의 실물 증거가 확인된다. F-4 관련 payload 자체는 이번 아키텍처 리뷰 대상 spec diff 3건에는 포함되지 않았음을 참고.

## 위험도

MEDIUM
