# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

## 방법론 메모 (검토 자체의 신뢰도에 관한 사항)

Orchestrator 가 조립한 `_prompts/cross_spec.md` 페이로드는 target(`14-external-interaction-api.md`, 약 1845줄)을
제외한 **관련 spec 111개 파일 전체의 본문이 컨텍스트 예산 초과로 절단(elided)** 되어 있었다 (`5-system/` 17개 +
그 외 94개 — `spec/conventions/node-output.md`, `4-execution-engine.md`, `6-websocket-protocol.md`,
`12-webhook.md`, `15-chat-channel.md`, `1-data-model.md`, `data-flow/15-external-interaction.md`,
`7-channel-web-chat/*`, `conventions/swagger.md`, `conventions/egress-masking.md`,
`conventions/conversation-thread.md` 포함). 페이로드 자체가 "여기 없다는 사실을 '해당 내용이 없다' 의 근거로
삼지 말고 Read 로 직접 열라" 고 명시했으므로, target 이 인용한 항목 중 리스크가 가장 큰 9곳을 실제 저장소 파일에서
직접 `Read`/`grep` 으로 대조했다:

| target 인용 | 대조 파일 | 결과 |
|---|---|---|
| `NodeHandlerOutput` 공개 키 = `config·output·meta·port·status` (R17 allowlist 표) | `spec/conventions/node-output.md` Principle 0 | 일치 (5필드 + `_resumeState`/`_resumeCheckpoint`/`_retryState` 는 "internal 허용 예외"로 명시 — allowlist 가 이 셋을 제외한 것과 정합) |
| `NodeHandlerOutput.config` echo 정책·credential 제외 | `spec/conventions/node-output.md` Principle 7 | 일치 |
| EIA-RL-07 idle-wait sweep이 execution-engine 의 "waiting_for_input → cancelled 타임아웃" 예약 사유의 구현 | `spec/5-system/4-execution-engine.md` §1.1 전이표, §7.4 | 일치 — execution-engine.md 가 EIA §R19/EIA-RL-07 을 직접 역참조 |
| EIA `STATE_MISMATCH`(409) ↔ engine `INVALID_EXECUTION_STATE`/REST `INVALID_STATE`(422) 매핑, nodeId·표면 매트릭스 커버리지 | `spec/5-system/4-execution-engine.md` §7.5.1 | 일치 (양방향 상호 인용 확인) |
| `Execution.error` = "최초 failed NodeExecution 복사" + egress 마스킹 SoT는 EIA §R17 | `spec/1-data-model.md` §2.14 (line 473, 561, 564) | 일치 — data-model.md 도 "표면 목록·개수를 여기 다시 적지 않는다, SoT는 EIA §R17" 로 명시 |
| `execution.node.completed` firehose를 chat-channel adapter만 별도 픽업(CCH-AD-07), EIA `execution.message` 와 중복 발화 없음 | `spec/5-system/15-chat-channel.md` (CCH-AD-07, CCH-MP-06) | 일치 |
| webhook 이 legacy `statusCode/errors` shape 을 버리고 `{error:{code,message,...}}` 로 통일(#754, 2026-06-28) | `spec/5-system/12-webhook.md` line 295 | 일치 — 현재 동일 봉투 사용 확인 |
| WS `messages[].source` 마커 누락 시 'live' 폴백은 WS §4.4.6 소관, conversation-thread §5.1 은 매핑 표만 | `spec/5-system/6-websocket-protocol.md` §4.4.6, `spec/conventions/conversation-thread.md` §5.1 | 일치 — 정확히 target 의 구분대로 폴백 문장은 WS 문서에만 존재 |
| `getStatus.context` 는 판별자 없는 `oneOf`(discriminator 미부여) — `interactionType` 은 unsound 판별자 | `spec/conventions/swagger.md` §Rationale "discriminator 는 판별자가 sound 할 때만" | 일치 — 이 문서가 EIA `getStatus.context` 를 반례 예시로 직접 사용 |
| `TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH` 매핑 SoT | `spec/data-flow/15-external-interaction.md` line 286 | 일치 |
| widget eager-start(§R6)·best-effort cancel(§R9)·EIA-RL-07 backstop 3중 방어 체인 | `spec/7-channel-web-chat/1-widget-app.md`, `3-auth-session.md` §R4/§R6 | 일치 (양방향 상호 인용, "모두 구현됨" 상태 확인) |

9개 항목 모두에서 **모순 없음** — target 의 cross-file 인용은 정확했고, 다수는 인용 대상 문서 쪽에서도 target 을
역참조하는 양방향 동기화가 확인됐다. 다만 이 방법론은 표본 검사이며, 미검증 잔여 영역(예:
`conventions/egress-masking.md` 의 깊이 상한 세부, `7-channel-web-chat/2-sdk.md`/`4-security.md`,
`conventions/redis-keys.md`)은 시간 예산상 직접 대조하지 못했다.

---

## 발견사항

### [WARNING] Cross-spec 검토 페이로드가 비교 대상 111개 파일을 전량 절단 — 구조적 커버리지 갭

- **target 위치**: 해당 없음 (target 문서 자체의 결함이 아니라 orchestrator 의 payload 조립 문제)
- **충돌 대상**: `review/consistency/.../_prompts/cross_spec.md` 조립 로직 (context 예산)
- **상세**: `--impl-prep` 모드의 cross_spec 페이로드가 target(`14-external-interaction-api.md`) 만 전문 포함하고, 실제 비교 기준이 되어야 할 `spec/5-system/` 나머지 17개 + `spec/` 전역 94개 파일(총 111개) 은 본문이 전부 "컨텍스트 예산 초과로 생략" 처리됐다. target 이 이 문서들의 특정 절(§1.1, §7.5.1, §4.4.6, Principle 7 등)을 정밀 인용하며 정합성을 주장하는데, 그 주장을 검증할 근거 자체가 페이로드에 없었다. 이번 검토는 페이로드 자체 안내("Read 로 직접 열어라")를 따라 최고 위험도 9개 인용을 저장소 원본에서 직접 대조해 보완했고 전부 일치를 확인했지만, 이는 시간 예산 내 표본 검사이지 전수 검증이 아니다. 이 실패 형태는 기존에 `--spec` 모드에서도 관측된 바 있다(conventions 전체 낙루) — `--impl-prep` 모드도 동일 취약점을 갖는다는 것이 이번에 재확인됐다.
- **제안**: orchestrator 의 cross_spec 페이로드 조립 시 (a) target 이 명시적으로 링크하는 절(anchor)만이라도 우선 포함하는 선택적 번들링을 고려하거나, (b) 페이로드가 절단될 경우 checker 가 고인용 파일 상위 N개를 자동으로 `Read` 하도록 checker 프롬프트에 명시적 의무를 추가. 최소한 이번처럼 수동 표본 검사를 매 라운드 반복하지 않도록 절차화 필요.

### [INFO] 표본 검사 밖의 잔여 인용은 미검증 상태로 남음

- **target 위치**: R17 하위 마스킹 캐스케이드 전반 (`conventions/egress-masking.md` 참조), §7-channel-web-chat SDK/security 참조
- **충돌 대상**: `spec/conventions/egress-masking.md`, `spec/7-channel-web-chat/2-sdk.md`, `spec/7-channel-web-chat/4-security.md`, `spec/conventions/redis-keys.md`
- **상세**: 위 방법론 표에 없는 인용들(마스커·스캐너 깊이 상한 세부, SDK/security 문서와의 위젯 CORS·allowlist 정합)은 이번 라운드에서 직접 대조하지 못했다. target 문서 자체의 자기 서술 밀도(날짜·커밋 해시·PR 번호가 딸린 이력 각주)로 미루어 볼 때 리스크는 낮게 평가되나, 확정적 근거는 아니다.
- **제안**: 다음 라운드 또는 `--spec` 정밀 재검토 시 위 4개 파일을 우선순위로 직접 대조 권장. Critical 판정 근거로 쓰지 않음(정보성).

## 요약

target(`spec/5-system/14-external-interaction-api.md`)은 이번 diff 의 핵심인 `nodeOutput` 키 fail-closed allowlist(R17 결론부) 및 관련 마스킹 캐스케이드를 포함해, 표(NodeHandlerOutput 5필드), 상태 전이(EIA-RL-07 ↔ execution-engine §1.1/§7.4), API 에러 코드 매핑(STATE_MISMATCH ↔ INVALID_EXECUTION_STATE), 데이터 모델(`Execution.error` 복사 관계), 이벤트 라우팅(CCH-AD-07 중복 방지), OpenAPI union 표현(discriminator 배제 근거) 등 9개 고위험 cross-file 주장을 저장소 원본과 직접 대조한 결과 전부 정합했다. 다수는 대상 문서 쪽에서도 target 을 역참조하는 양방향 동기화가 확인돼, 이 spec 영역의 cross-file 정합 유지 관행이 실제로 작동하고 있음을 보여준다. 유일한 구조적 문제는 target 자체가 아니라 이번 검토에 주어진 페이로드가 비교 대상 111개 파일 본문을 전량 누락했다는 점이며, 이는 검토 프로세스의 신뢰도 리스크로 별도 관리가 필요하다(WARNING). Content 자체에서는 CRITICAL/WARNING 급 실제 모순을 발견하지 못했다.

## 위험도

LOW
