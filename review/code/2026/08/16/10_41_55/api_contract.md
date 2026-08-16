# API 계약(API Contract) 코드 리뷰

## 리뷰 범위

이번 라운드(`10_41_55`)의 diff(44개 파일)는 대부분 이전 두 리뷰 라운드(`09_51_00`, `10_19_30`)와 두 consistency-check 라운드(`09_25_29`, `10_19_31`)의 산출물(`review/code/**`, `review/consistency/**`, 이미 위 라운드에서 각각 커밋된 신규 파일)이며, 실질 코드/계약 변경은 4개 파일로 좁다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `toTerminalErrorPayload`(EIA §6.4 `execution.failed` 의 `error` 를 wire 형태로 정규화하는 함수)의 4개 반환 경로 전부에 신설 `redactTerminalError()`(`message`/`details` 에 `deepRedactSecrets` 적용)를 씌움
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 신규
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만, 런타임 로직 무변경
- `CHANGELOG.md` — wire 변화 고지 `## Unreleased` 항목 신설 + 기존(#1174) 항목의 인용 오류 정정

이 payload 는 WS(`execution:<id>` 채널)·SSE 스트림(§5.2)·EIA outbound webhook(§3.1, 외부 제3자)으로 동일하게 fanout 된다. 직전 라운드(`10_19_30/api_contract.md`)가 이미 이 변경을 API 계약 관점에서 상세 검토했으므로, 본 라운드는 (a) 그 라운드 이후 실제로 반영된 변화를 소스 직접 대조로 재확인하고, (b) 남아 있는 계약 문서화 갭의 현재 상태(트래킹 여부)를 직접 확인하는 데 집중했다.

## 발견사항

- **[INFO]** 직전 라운드(`10_19_30` documentation WARNING)가 지적한 "EIA outbound webhook" 절 번호 오인용(§3.3→§3.1)이 이번 diff 에서 정정된 것을 확인
  - 위치: `CHANGELOG.md:45`(파일 1 게이트) — `-⚠️ ... EIA outbound webhook(§3.3 EIA-NX-02 화이트리스트)과` → `+⚠️ ... EIA outbound webhook(§3.1 EIA-NX-02 화이트리스트)과`. 신규 항목(`CHANGELOG.md:6`, 파일 1 게이트)도 처음부터 `§3.1` 로 정확히 적었다.
  - 상세: `spec/5-system/14-external-interaction-api.md` 를 직접 열어 대조 — `§3.1`(EIA-NX-02, 이벤트 화이트리스트 포함 Outbound Notification 요구사항)이 맞고 `§3.3`(EIA-AU-01~08)은 인증 절이라 무관하다는 이전 지적이 정확했고, 이번 diff 에서 실제로 정정됐다. 하위 호환성 서술의 근거 절이 정확해졌으므로 이 자체는 문제가 아니라 개선 확인이다.
  - 제안: 조치 불요 (확인용).

- **[WARNING]** 이번 값-마스킹이 API 정본 계약 문서(§6.4)·마스킹 카탈로그(R17)에 여전히 반영되지 않음 — 단, 이미 트래킹은 존재
  - 위치: `spec/5-system/14-external-interaction-api.md:770-806`(§6.4 `execution.failed` 페이로드 절, `error.message`/`error.details` 필드 정의) 및 `:1414-1457`(R17 "표면 제약(보안)" 마스킹 카탈로그 4개 불릿)
  - 상세: 직접 `Read` 로 재확인 — 이번 diff(`git diff origin/main...HEAD -- spec/`)는 `spec/**` 를 0줄 변경했고, §6.4 필드 표·설명 어디에도 `error.message`/`error.details` 가 secret 패턴 마스킹을 거친다는 캐비엇이 없다. R17 "표면 제약(보안)" 불릿도 여전히 4개(`conversationThread`·`ai_message`·`nodeOutput.conversationConfig`+terminal `result`/`error`·`nodeOutput` 일반 키)뿐이고, 이번에 새로 강제된 `execution.failed`/`cancelled`/chat-channel 종결 `error.message`·`details` 마스킹(호출부 5곳)이 5번째 항목으로 등재돼 있지 않다. §6.4 는 이 API 의 외부 통합사가 참조하는 정본 계약이므로, `CHANGELOG.md`(저장소 내부 문서)에만 있는 고지는 "정본 계약이 실제 동작을 규정한다"는 원칙에 못 미친다.
    다만 이 항목은 이미 두 consistency-check 라운드(`09_25_29` rationale_continuity WARNING, `10_19_31` plan_coherence WARNING·cross_spec INFO)와 직전 코드 리뷰 라운드(`10_19_30` api_contract WARNING W1/W2)가 동일하게 지적했고, `plan/in-progress/eia-terminal-error-sanitize.md:153-159`(직접 확인)에 "planner 턴 — EIA §R17 마스킹 카탈로그에 5번째 항목 등재 + §6.4 필드 표 캐비엇" 으로 명시적으로 등재돼 있다. `spec/` 은 developer 쓰기 권한 밖이라 이번 PR 에서 직접 고칠 수 없는 항목이고, 그 판단(`10_19_30` RESOLUTION.md "W1·W2 — planner 후속")도 타당하다.
  - 제안: 이번 PR 에서 추가 조치는 불요 — 이미 등재된 planner 턴 후속 항목으로 처리한다. 다만 push 게이트 통과 전 `plan/in-progress/eia-terminal-error-sanitize.md` 체크리스트의 "planner 턴" 항목이 실제로 project-planner 세션에서 처리되는지 추적할 것(§6.4 필드 표 캐비엇 + R17 5번째 불릿 동시 반영).

## 정상 확인된 사항 (재확인, 문제 없음)

- **스키마/응답 형식 불변**: `TerminalErrorPayload` 인터페이스(`{code, message, nodeId, details?}`, `terminal-error-payload.ts:40-45`)는 변경되지 않았다. `redactTerminalError`(`:107-115`)는 값만 치환하고 `details` optional-key 생략 관용구(`toTerminalErrorPayload:159-160`)를 그대로 보존 — §6.4 계약 위반 없음.
- **하위 호환성**: 구조적(structural) breaking change 없음. 값(value) 차원의 변화이며 secret 패턴이 실제로 검출됐을 때만 바이트가 바뀐다(`redactSecretsInJsonString` 의 `red === parsed ? raw : JSON.stringify(red)` 동작, 이전 라운드가 코드 대조로 확인 완료) — 변경 방향이 노출을 좁히는 쪽이라 리스크는 낮다.
- **버전 관리**: 이 이벤트/webhook API 에는 애초에 버전 필드/스킴이 없다(선존 상태, 이번 diff 가 만든 갭 아님).
- **에러 응답/HTTP 상태 코드, 요청 검증, URL/경로 설계, 페이지네이션, 인증/인가**: 이번 diff 범위(WS/SSE/webhook payload 값 마스킹 유틸)와 무관 — 해당 관점의 변경 없음.
- `code`/`nodeId`(닫힌 값 공간)는 마스킹 대상에서 제외돼 그 값으로 분기하는 기존 소비자 로직에 영향 없음 — `redactTerminalError` 본문 직접 대조로 재확인.

## 요약

이번 라운드의 실질 계약 변경은 직전 라운드(`10_19_30`)에서 이미 검토된 것과 동일하다 — `TerminalErrorPayload` wire 스키마는 불변이고, `message`/`details` 값에 대한 egress 시점 secret 마스킹만 추가됐다. 이번 diff 에서 새로 확인된 변화는 이전 라운드가 지적한 CHANGELOG 의 EIA 섹션 인용 오류(§3.3→§3.1)가 실제로 정정됐다는 점이다(INFO). 유일하게 남은 계약 관점 이슈는 §6.4/R17 이 이 값-마스킹을 여전히 문서화하지 않는다는 것인데(WARNING), 이는 developer 쓰기 권한 밖인 `spec/` 변경이 필요해 이미 `plan/in-progress/eia-terminal-error-sanitize.md` 에 planner 턴 후속 항목으로 명시적으로 등재돼 있다 — 이번 PR 을 막을 사유는 아니며 추가 개발 조치도 불요하다.

## 위험도
LOW
