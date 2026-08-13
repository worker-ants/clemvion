# Security Review — chat-channel dispatcher / execution-engine / executions.service

## 발견사항

없음.

본 변경 세트는 실질적으로 5개 파일, +231/-1 줄이며 대부분 테스트 추가다:

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` — `handle()` 을 통해
  `toChatChannelEvent` null 반환 시 debug/warn 로그 레벨 분기를 양방향으로 고정하는 테스트 추가.
  프로덕션 코드 변경 없음.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — admission 쿼리가
  배열이 아닌 값을 반환했을 때 예외 대신 defer 로 fail-closed 하는지 고정하는 테스트 추가.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — admission 로직에
  `Array.isArray(rows)` 런타임 가드 추가. 가드 미충족 시 `return false`(= not admitted = defer) 로
  떨어진다 — **fail-closed 방향**이 유지된다(cap 우회로 이어지는 fail-open 아님). 로그 메시지
  (`typeof rows`, `executionId`)에 PII/시크릿 없음.
- `codebase/backend/src/modules/executions/executions.service.spec.ts` — `snapshotCache` 256건 상한
  및 LRU eviction 방향(가장 오래된 키가 밀려나는지)을 고정하는 테스트 추가.
- `codebase/backend/src/modules/executions/executions.service.ts` — 기존 `private` 상수
  `SNAPSHOT_CACHE_MAX_ENTRIES` 에 `export` 키워드만 추가(테스트에서 심볼로 참조하기 위함). 캐시
  키 구조·eviction 로직·workspace 격리 경계는 변경 없음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 체크리스트 항목 2건을 완료로 표시하는
  문서 변경.

### 점검한 보안 관점 (해당 없음 확인)

- **인젝션**: 신규 SQL/커맨드/경로 문자열 조합 없음. `computeChainDepth` 의 재귀 CTE 는 파라미터
  바인딩(`$1`, `$2`)만 사용하며 이번 diff 대상이 아니다.
- **하드코딩 시크릿**: `chat-channel.dispatcher.spec.ts` 의 `'SECRET SYSTEM PROMPT'` 리터럴은 테스트
  픽스처로, "이 값이 outbound `EiaAiMessageEvent` 에 새어나가지 않는지" 를 검증하는 회귀 테스트용
  더미 값이다(실제 시크릿 아님, 오히려 유출 방지를 확인하는 양성 테스트).
- **인증/인가**: `ExecutionsService.findById` 의 캐시(`snapshotCache`)는 execution ID(전역 고유
  UUID)로만 키잉되며, workspace 경계 검증은 모든 컨트롤러 호출부에서 `verifyOwnership(id,
  workspaceId)` 를 캐시 조회 이전에 별도로 강제한다(`executions.controller.ts` 확인) — 이번 diff 는
  이 구조를 변경하지 않았고 export 키워드 추가만으로는 IDOR/캐시 오염 표면이 늘지 않는다.
- **입력 검증**: `Array.isArray(rows)` 가드는 오히려 입력(드라이버 반환값) 검증을 강화하는 방향의
  변경.
- **암호화/평문 전송**: 해당 없음.
- **에러 처리**: 신규 `logger.warn` 메시지는 `typeof rows`, `executionId` 만 포함하며 민감정보 노출
  없음.
- **의존성 보안**: 신규/변경 의존성 없음.

## 요약

이번 diff 는 테스트 커버리지 강화(로그 레벨 분기 양방향 고정, LRU 캐시 상한/방향 고정, fail-closed
admission 가드 회귀 테스트)와 그에 필요한 최소 프로덕션 변경(상수 export, `Array.isArray` 런타임
가드)으로 구성되어 있다. 신규 인젝션·인증/인가 우회·시크릿 노출·안전하지 않은 암호화·민감정보
에러 노출 등 보안 결함은 발견되지 않았다. `Array.isArray` 가드는 admission 실패 방향을
명시적으로 fail-closed(defer) 로 고정해 오히려 견고성을 높인다.

## 위험도

NONE
