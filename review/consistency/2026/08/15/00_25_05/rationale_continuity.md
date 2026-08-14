STATUS=success rationale_continuity review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** 직전 라운드(`23_18_06`)가 지적한 §6.4 blockquote 자기모순은 이번 HEAD 에서 이미 해소됨 — 회귀 감시만 남김
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 (`execution.failed` 페이로드) 블록쿼트, 라인 792-798 (`> **\`failed\` 의 \`error\` 는 이제 전 경로 object 다**...`)
  - 과거 결정 출처: 같은 문서 §6 "종결 이벤트의 필드 집합 (normative)" 표의 `error` 행(라인 572) + 직전 rationale_continuity 라운드(`review/consistency/2026/08/14/23_18_06/rationale_continuity.md`)가 등재한 WARNING("§6.4 stale caveat 이 §6 필드표의 방금 정정된 결론과 모순")
  - 상세: 이전 라운드가 지적한 시점에는 §6 필드표(라인 572)는 "failed 는 전 경로 object" 로 정정됐는데 §6.4 블록쿼트(당시 라인 792-793)는 "현행 일부 경로에서 string" · "당분간 양쪽을 방어해야 한다" 는 stale 문구를 그대로 남겨 같은 문서 안에서 서로 반대되는 두 문장이 공존했다. 이번 HEAD 를 직접 읽으면 그 블록쿼트가 "`failed` 의 `error` 는 이제 전 경로 object 다(2026-08-14, `toTerminalErrorPayload` 로 emit 4곳 일원화). 종전의 '일부 경로는 string' 캐비엇은 해소됐다. 다만 배포 경계에서 재생되는 레거시 이벤트는 여전히 string 을 실을 수 있어, chat-channel dispatcher 와 에디터 프런트엔드가 문자열을 흡수하는 분기를 의도적으로 유지한다 — 그 분기는 제거 대상이 아니다." 로 갱신돼 있어(`git diff origin/main...HEAD` 로 재확인), 필드표 결론·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`("wrap 과 union 을 함께 제거한다는 원래 계획을 절반만 집행했다 — 의도적이다")·`CHANGELOG.md`·`terminal-error-payload.ts`·`chat-channel.dispatcher.ts` 주석이 모두 같은 결론("전 경로 object + 레거시 string 흡수는 의도적 잔존")을 말하고 있다. 자기모순은 더 이상 없다.
  - 제안: 조치 불요. 이후 라운드에서 이 블록쿼트를 다시 손댈 때는 §6 필드표(라인 572)·`CHANGELOG.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 세 곳을 같은 편집 단위로 유지해 재-drift 를 방지할 것.

### 요약
target diff(`spec/5-system/14-external-interaction-api.md` §6 필드표·§6.4 블록쿼트, `spec/conventions/chat-channel-adapter.md` §1.2 union 타입, 대응 구현 `terminal-error-payload.ts`(신규)·`execution-engine.service.ts`·`retry-turn.service.ts`·`chat-channel.dispatcher.ts`/`types.ts`·프런트 `use-execution-events.ts`)는 `## Rationale` 의 어느 항목(R1~R19, R-outbound-flood, R-replay-unavailable)도 기각·재도입하거나 무근거로 번복하지 않는다. 검토한 관련 불변식·원칙 — (1) `code`/`nodeId` 명시적 `null` 원칙([API 규약 §5.4](../../../spec/5-system/2-api-convention.md) "기본은 null") 과 정합, (2) `chat-channel-adapter.md` 의 R3("EiaEvent 는 EIA spec 위임")·R-CCA-5(에러 분류 helper 위치) 와 충돌 없음, (3) R10 단일 sink/facade 원칙 무변경(이번 diff 는 emit payload 정규화이며 sink 구조는 손대지 않음), (4) EIA §6 "삭제된 약속"(finalNodeId/finalPort) 을 `types.ts` 가 뒤늦게 반영해 문서-코드 정합을 좁힘, (5) 코드에서 지어낸 비-카탈로그 sentinel `'INTERNAL_ERROR'` 제거는 오히려 R8 류 "닫힌 목록을 그대로 조건에 옮긴다" 정신과 같은 방향 — 모두 일치한다. 유일한 이전 WARNING(§6.4 블록쿼트 stale 캐비엇으로 인한 문서 내부 자기모순)은 이번 HEAD 에서 이미 수정 완료돼 재확인 결과 남은 문제가 없다. 병행 발견된 out-of-scope 항목(HMAC `hmacAlgorithm` 현재형 인용 drift, `error.message` 값-패턴 마스킹 비대칭)은 스스로 "한 PR = 한 관심사" 원칙을 지키기 위해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 등재돼 있어 결정 회피가 아니라 의도적 범위 통제로 판단된다.

### 위험도
NONE
