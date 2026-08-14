# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)

## 스코프 메모

prompt 조립이 컨텍스트 예산 초과로 `6-websocket-protocol.md` · `12-webhook.md` ·
`15-chat-channel.md` · `4-execution-engine.md` · `1-auth.md` · **`git diff` 본문** 을 포함한
111개 파일을 절단했다(§경고 블록 확인). 판정에 필요한 파일은 워크트리에서 절대경로로 직접
`Read`/`git diff`/`grep` 해 실측했다 — 아래 발견사항은 전부 그 직접 대조 결과다.

`git diff origin/main...HEAD` 실측 결과, 이번 PR 의 실질 변경은:
- spec: `spec/5-system/14-external-interaction-api.md` 2개 표 행(§6 필드 집합의 `error`/`durationMs`) + §6.4 blockquote 보강 (2줄→10줄)
- 코드: 신설 `terminal-error-payload.ts`(`toTerminalErrorPayload`) + 4개 emit 호출부 통일(`execution-engine.service.ts` 3곳, `retry-turn.service.ts` 1곳) + `chat-channel/{dispatcher,types}.ts` 정합 + frontend `use-execution-events.ts` 소비자 수정
- 문서: `CHANGELOG.md` breaking-change 고지, `plan/in-progress/{eia-terminal-payload.md, spec-sync-external-interaction-api-gaps.md}` 갱신

직전 두 라운드(`22_29_16` cross_spec, `22_55_51` code review)의 CRITICAL/WARNING 은 이번 커밋에
전부 조치됐음을 `RESOLUTION.md` 및 실제 diff 로 확인했다(프런트엔드 WS 소비자 crash fix 포함).
아래는 그 위에서 **다른 spec 영역과의 신규 충돌 여부**만 재검토한 결과다.

---

## 발견사항

이번 diff 가 다른 `spec/5-system/**` · `spec/1-data-model.md` · `spec/7-channel-web-chat/**` 영역과
새로 충돌시키는 지점은 찾지 못했다. 직접 대조한 근거:

- **데이터 모델**: `terminal-error-payload.ts` 의 `TerminalErrorPayload { code, message, nodeId, details? }`
  는 `spec/1-data-model.md` §2.14 "Execution.error ↔ NodeExecution.error 관계" 표의 구조
  (`{ nodeId: "uuid"|null, code: "ERROR_CODE"|null, message, details?: {...} }`, `nodeId` 는
  노드-없는 인프라 실패에서, `code` 는 일반 `catch` 에서 `null`)와 필드·nullable 의미가 정확히
  일치한다. `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`(§8 admission)/
  `WEBCHAT_IDLE_TIMEOUT` 코드 목록도 §2.13/§2.14 및 target §6.4 개정 blockquote 양쪽에서 동일하게
  등장한다.
- **API 계약 (WS)**: `spec/5-system/6-websocket-protocol.md:178-204` 는 `execution.failed` 의
  payload 를 "`{ executionId, …필드 집합, seq, timestamp }`" 로 정의하고 그 "필드 집합" 을
  target `14-external-interaction-api.md#종결-이벤트의-필드-집합-normative` 로 **포인터**한다
  (WS 자신이 필드를 다시 나열하지 않음 — 이중 SoT 방지 설계). 즉 WS 채널은 target 의 이번 개정을
  자동으로 상속하므로 별도 갱신 불요 — 실제로 WS 문서에는 diff 가 없고, 이는 설계대로다.
  frontend `use-execution-events.ts` 의 수정(`typeof payload.error === "string" ? payload.error :
  payload.error?.message`)은 이 flat 필드 집합 계약과 정합한다.
- **API 계약 (chat-channel)**: `spec/5-system/15-chat-channel.md` CCH-ERR-02("`error.code`
  (EIA §6.4 enum) … 2 필드만 분류 입력")·CCH-ERR-04("`error.code === null` 는
  `executionFailedInternal` 로 fallback")를 직접 grep 대조했다. `chat-channel.dispatcher.ts` 의
  신규 `code: null`(레거시 string 흡수 경로) 은 CCH-ERR-04 의 명시적 `null` 분기와 그대로
  일치하고, 종전의 지어낸 `'INTERNAL_ERROR'`(분류기 미등재 값)보다 오히려 spec 정합도가
  높아졌다.
- **API 계약 (channel-web-chat 위젯)**: `codebase/channel-web-chat/src` 를 grep 한 결과
  `execution.failed` 는 `TERMINAL_EVENTS`(`use-widget.ts`)로만 소비되어 세션 종료 트리거로만
  쓰이고, `error` 필드 내용을 직접 렌더하는 지점이 없다(사용자 노출 문구는 고정
  `GENERIC_ERROR_MESSAGE` catalog 값). 따라서 string→object 전환이 이 소비자를 깨지 않는다 —
  `spec/7-channel-web-chat/*` 와도 충돌 없음.
- **비기능(버저닝)**: `CHANGELOG.md` 의 "URL 버전 세그먼트를 쓰지 않는다" 주장은
  `2-api-convention.md §2.1/§2.2` 의 URL 패턴(`{base_url}/api/{resource}[...]`, 버전 세그먼트
  없음)과 대조해 정확하다.

## 참고 (INFO) — 이번 diff 밖, 이미 추적됨

target 파일 전체를 스캔하는 과정에서 직전 라운드(`22_29_16`)가 WARNING 으로 등재했던 두 건의
**pre-existing** drift(이번 diff 대상 라인 아님)를 재확인했다. `plan/in-progress/
spec-sync-external-interaction-api-gaps.md`(2026-08-14 갱신분, 이번 diff 에 포함)에 체크리스트로
이미 등재돼 있어 유실 위험은 없다 — 재차단 목적이 아니라 연속성 확인 차 기록한다.

- `EIA-NX-03`/`R12` 가 V066 로 제거된 `hmacAlgorithm` 필드(구 Trigger config)를 현재형으로
  인용 — 실제 소유자는 `AuthConfig.config.algorithm`(`12-webhook.md:167`). target §7.1 스키마
  자신과도 모순.
- §11 WS↔외부 명령 매핑 표의 `execution.stop` 행이 `6-websocket-protocol.md §4.6` "권위 표"의
  `_(WS 명령 §4.2 won't-do)_` 주석을 누락 — 두 "권위 표"가 비대칭.
- (보안 인접, 참고) `toTerminalErrorPayload` 의 `message`/`details` 가 REST `getStatus` 의
  값-패턴 마스킹(`stripAndRedact`)과 달리 WS/SSE fanout 에서 키-이름 마스킹만 거친다 — 채널간
  보안 계약 비대칭. `22_55_51` security WARNING 으로 이미 발견·defer 됐고 같은 backlog 에
  등재됨(선존 갭, 이번 diff 로 노출면이 넓어지지 않음).

이 세 항목 모두 **이번 커밋의 diff 라인이 아니며**, 단일 관심사 원칙에 따라 이번 PR 스코프
밖으로 의도적으로 분리됐다는 근거가 plan 문서에 남아 있다. 따라서 본 라운드에서는 BLOCK 사유로
격상하지 않는다.

---

## 요약

이번 PR(`eia-terminal-payload` — 종결 `error` 를 string→object(`toTerminalErrorPayload`)로
일원화)이 다른 `spec/5-system/**` 영역과 새로 충돌하는 지점은 없다. `1-data-model.md` §2.14 의
Execution/NodeExecution 에러 구조, `6-websocket-protocol.md` 의 "필드 집합은 target 을
포인터"하는 설계, `15-chat-channel.md` CCH-ERR-02/04 의 code-nullable 분류 계약, 그리고
`channel-web-chat` 위젯의 실제 소비 코드(에러 내용 미렌더) 를 직접 대조한 결과 모두 정합했다 —
오히려 종전에 존재하던 "일부 경로는 string" drift 와 지어낸 `'INTERNAL_ERROR'` 값을 없애 정합도가
개선됐다. target spec 자체의 §6 diff(2개 표 행)도 실측(코드 SoT)과 일치한다. 직전 라운드가 발견한
두 건의 stale 인용(`hmacAlgorithm`, WS §11 won't-do 주석 누락)과 REST/WS 마스킹 비대칭은 이번
diff 범위 밖이며 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 추적
중이라 INFO 로만 남긴다.

## 위험도

LOW
