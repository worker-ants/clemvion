# Rationale 연속성 검토 결과

## 검토 대상

- 범위: `spec/5-system/` (impl-done, diff-base `origin/main`)
- 실제 diff (`git diff origin/main...HEAD -- spec/5-system/*.md`): `12-webhook.md` / `14-external-interaction-api.md` / `6-websocket-protocol.md` 3파일, 81 삽입 / 14 삭제. 대응 커밋: `1b8fd5cc7`(WS node/비종결 emit 값-마스킹) · `fe6a54c80`(읽기 표면 6곳 `inputData`/`outputData` 마스킹) · `e5a63abff`(§R17 카탈로그 갱신 + ai-review WARNING 8건 반영) · `a8b0cbfdd`(plan 종결).
- (prompt 첨부 diff 블록은 컨텍스트 예산 초과로 절단되어 있어, 위 실제 `git diff`/`git log`(worktree 절대경로 기준)를 1차 근거로 삼았다.)

## 발견사항

이번 diff 는 spec-only 이며, 세 파일 모두 기존 `## Rationale` / `§R17` 카탈로그를 직접 갱신하는 형태다. 항목별로 "기각된 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회" 네 관점에서 대조한 결과, **위반으로 분류할 발견은 없다.** 아래는 확인 과정에서 특정한 잠재 충돌 지점과 그 판정 근거다.

- **[INFO] `llmCalls` strip-only 결정과의 경계 — 위반 아님, 표기 보강 여지**
  - target 위치: `spec/5-system/6-websocket-protocol.md` `## Rationale` → `llmCalls` 외부 수신자 strip 항목의 2026-08-16 보강 blockquote(diff 신규 라인, `### llmCalls 외부 수신자 strip` 절 하단)
  - 과거 결정 출처: 같은 절의 "**기각된 대안**: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고 부분적이며 … " (기존 `strip-only` 결정, `llmCalls` 를 값-레벨 마스킹으로 **대체**하는 안을 기각)
  - 상세: 신규 diff 는 `error`/`message`/`output` 등 자유 텍스트 필드에 값-패턴 마스킹을 emit 초크포인트(`emitExecutionEvent`/`emitNodeEvent`)에 추가한다. 이는 과거 "기각된 대안"(=`llmCalls` 를 값-마스킹으로 **대체**)의 재도입처럼 보일 수 있으나, target 은 스스로 `llmCalls` 는 여전히 strip-only 이고 `WIRE_PRESERVED_FIELDS` 로 값-마스킹 대상에서 제외됨을 명시하며, "대체가 아니라 병존" 이라고 명확히 구분한다. 실제로 기각된 대안(=llmCalls 자체를 값-마스킹으로 바꾸는 것)은 이번에도 채택되지 않았다 — `llmCalls` 는 그대로 필드째 strip. 따라서 위반이 아니다.
  - 제안: 현재도 명확하지만, `## Rationale` 헤더 바로 아래(문서 최상단)에 "strip-only vs 값-패턴 마스킹" 두 레이어의 구분표를 한 줄 요약으로 옮겨두면 향후 리뷰어가 절 전체를 읽지 않고도 빠르게 오인을 피할 수 있다(선택 사항, 강제 아님).

- **[INFO] R10 "WebsocketService 단일 sink 정책" — 신규 마스킹 초크포인트 교차 참조 누락**
  - target 위치: `spec/5-system/14-external-interaction-api.md` `### R10. WebsocketService 단일 sink 정책의 확장`
  - 과거 결정 출처: 같은 R10 (엔진은 `WebsocketService.emitToExecution` 단일 sink 만 호출, NotificationDispatcher/SSE 어댑터/ChatChannelDispatcher 는 `executionEvents$` 의 "세 형제 listener")
  - 상세: 이번 diff 로 신설된 emit 시점 값-마스킹(`emitExecutionEvent`/`emitNodeEvent` 공유 초크포인트)은 R10 이 기술하는 바로 그 단일 sink 직전에 위치한다 — 즉 R10 이 나열한 세 형제 listener(NotificationFanout·SSE 어댑터·ChatChannelDispatcher) 전부가 마스킹된 payload 만 받게 된다. 이는 target 이 다른 자리(§R17 신규 불릿)에서 "boundary parity"·"내부 WS·Chat Channel 도 마스킹됨(수용된 trade-off)" 로 이미 명시적으로 다루고 있어 **모순은 아니다** — 다만 R10 자신은 이 마스킹 계층을 언급하지 않는다.
  - 제안: R10 말미에 "이 sink 직전에 §R17 값-패턴 마스킹 초크포인트가 있다" 1줄 교차 참조를 추가하면, R10 만 읽는 향후 독자가 세 listener 가 raw payload 를 받는다고 오인하는 것을 예방한다(선택 사항).

- **검증됨 — 조작·과장 없음**: 진행 중 `[실행 내역 R-5](spec/2-navigation/14-execution-history.md#r-5-...)` 인용을 원문에서 직접 대조했다. 실제로 `spec/2-navigation/14-execution-history.md:465-467` 에 동일 날짜(2026-08-16)로 "R-5 의 대상 범위는 Config 탭 config echo 한정이며, `Execution.error` 는 별개 정책(egress 마스킹, SoT=EIA §R17)이고 R-5 는 근거로 원용됐을 뿐 기존 판정이 아니다" 라는 상호 caveat 가 실제로 존재한다 — 지어낸 이력이 아니다.
- **검증됨 — ingestion-time vs egress-time 공존 서술**: `12-webhook.md §5.3` 의 "모든 read 경로가 자동 마스킹" 서술에 신규로 붙은 "스코프는 알려진 민감 헤더 key 한정" 캐비엇은, §5.3 자체가 애초 "민감 **헤더**" 로 스코프된 절이므로 원 결정(ingestion 채택 근거 (b) "단일 소스로 커버")과 충돌하지 않는다 — 헤더 표면 전체를 커버한다는 원 주장은 유지되고, 자유 텍스트(body/params)는 원래도 이 절의 대상이 아니었다는 점을 명시했을 뿐이다.
- **검증됨 — strip-only 결정 문구**: WS §Rationale 의 "이 결정은 번복되지 않았다" 자기 선언은 실측 diff 와 일치한다 (`llmCalls` 관련 코드/스펙 변경 없음, 신규 마스킹은 다른 필드 대상).
- **검증됨 — R17 잔여 항목 해소 서술**: "~~잔여 ①~~ 해소(2026-08-16)" / "~~잔여 ②~~ 해소" 표기는 이번 diff 가 실제로 구현한 두 항목(node/비종결 emit 값-마스킹, `inputData`/`outputData` 읽기 경로 마스킹)과 1:1 대응하며, 취소선 + 날짜 방식은 같은 문서의 §6.5(`durationMs` race 해소) 선례와 동형이라 문서 관행에도 부합한다.

## 요약

이번 target(`spec/5-system/12-webhook.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md`)의 변경은 모두 기존 `§R17`/`WS ## Rationale` 카탈로그를 확장하는 문서 커밋이며, 과거에 명시적으로 기각된 대안(`llmCalls` 값-마스킹 대체, REST/raw-WS 대체 등)을 재도입하지 않는다. 오히려 이번 diff 는 (1) 같은 PR 안에서 스스로 발견한 자기모순(WS §4.1 각주 vs 신규 캐비엇)을 정정하고, (2) "잔여" 로 열어뒀던 항목을 취소선+날짜로 명시적으로 닫으며, (3) ingestion-time/egress-time 두 마스킹 철학이 공존하는 이유를 새로 문서화하고, (4) 타 spec(`14-execution-history.md` R-5)에 원용 caveat 를 동시에 추가하는 등 Rationale 연속성을 능동적으로 관리하는 패턴을 보인다. CRITICAL/WARNING 급 위반은 발견되지 않았고, 위에 적은 두 건은 모두 "모순은 아니나 교차 참조를 보강하면 좋을" INFO 수준이다.

## 위험도

LOW
