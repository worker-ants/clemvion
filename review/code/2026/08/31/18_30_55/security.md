# 보안(Security) 코드 리뷰

## 범위 요약

본 changeset 은 22개 파일로 구성되나, 실질 코드 변경은 소수다:

- **harness 내부 도구** (`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` +
  `.claude/tests/test_consistency_scope_census.py`): review 프롬프트 조립용 신규 헬퍼
  `_count_diff_files`/`_scope_delta_census` — 저장소 내부 개발 tooling, 외부 공격 표면 없음.
- **주석/JSDoc-only 변경** (`chat-channel.dispatcher.ts`, `chat-channel.dispatcher.spec.ts`,
  `chat-channel/types.ts`): 썩은 줄 번호 인용(`line 536`, `line 89`)을 절 번호/앵커로 교체. 실행
  경로 변화 없음.
- **Swagger 문서화 추가** (`workflow-assistant.controller.ts` +7군데
  `@ApiUnauthorizedResponse`, 신규 `workflow-assistant.controller.swagger.spec.ts`): 실제 가드
  (`@ApiBearerAuth`, `@WorkspaceId()`, `@Roles('editor')`)는 그대로이고 OpenAPI 문서 애노테이션만
  추가됐다. 확인 결과 인가/인증 로직 변경 없음 — 순수 문서화 갭 해소로, 보안 관점에서 오히려
  긍정적(401 미문서화 컨트롤러가 이제 규약을 지킨다)이며 회귀를 잠그는 테스트도 동반한다.
- **나머지 대부분**은 `plan/**`·`spec/**` 마크다운 편집(줄 번호 인용 정정, 절 번호 재배치, 앵커
  수정, 진행상황 기록) — 실행되는 코드가 아니다.

## 발견사항

- **[INFO]** WebSocket 세션이 핸드셰이크 이후 토큰을 재검증하지 않는다는 기존 갭이 plan 문서에
  실측 기록됨 (세션/인증 관리 이슈, 코드 변경 아님)
  - 위치: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (diff 게이트 25~52줄, 신설
    블록 — 예: `> | jwtService.verify 호출부 | websocket.gateway.ts:156 단 1곳 |`)
  - 상세: 이 diff 자체는 코드를 바꾸지 않고 기존 갭을 **문서로 등재**한 것뿐이다. 다만 내용 자체는
    보안적으로 유의미하다 — `jwtService.verify` 호출이 `handleConnection` 1곳뿐이고 gateway 에
    `exp` 참조·타이머·재검증 guard 가 없어, **토큰이 만료돼도 이미 연결된 WS 소켓은 계속
    인가된 채로 살아 있다**(세션 고정/토큰 폐기 무력화 성격의 gap). 이미 `[ ]` 미착수 항목으로
    추적 중이며 착수 전 제품 결정(disconnect 여부)이 필요하다고 스스로 명시했다.
  - 제안: 이 PR 범위에서 조치할 필요는 없다(코드 변경이 없으므로). 다만 이 관측이 다른 백로그에
    묻히지 않도록, 보안 우선순위 트리아지에서 이 항목(토큰 만료 후에도 WS 세션이 살아있는 문제)을
    조기 승격하는 것을 권고한다 — 계정 잠금·강제 로그아웃·토큰 폐기 기능이 있다면 WS 경로가
    이를 무력화할 수 있다.

- **[INFO]** Cafe24 install 엔드포인트의 rate limit 이 여전히 in-memory(단일 인스턴스) 라는 사실이
  실측 기록됨 (코드 변경 아님, 기존 결정의 재확인)
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` (diff 게이트 20~32줄)
  - 상세: `Cafe24InstallRateLimitService` (Layer 2, Redis 기반 IP lockout)는 이미 존재해 token
    oracle enumeration 을 cross-pod 로 방어한다. 다만 `@nestjs/throttler` 의 IP 기반 Layer 1
    throttle 은 여전히 프로세스-로컬 in-memory 라, 멀티 인스턴스 환경에서 인스턴스당 quota 가
    별도로 리필된다. 이 diff 는 이 사실을 재확인/기록만 했고 Layer 2 가 이미 핵심 방어를 완수한다는
    기존 결정도 재확인됐다.
  - 제안: 별도 조치 불요(기존에 defer 결정됨, 이 PR 범위 아님). 참고로만 남긴다.

- **[INFO]** `workflow-assistant.controller.ts` 401 문서화 추가는 순수 Swagger 애노테이션이며 실제
  가드 변경이 없음을 확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`
    (diff 게이트 28·59·80·97·111·126·142·164줄)
  - 상세: `@ApiBearerAuth('access-token')`(클래스 레벨), `@WorkspaceId()`, `@Roles('editor')` 등
    실제 인가 데코레이터는 diff 대상이 아니고 그대로 유지된다. 추가된 것은
    `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 뿐 — OpenAPI 스펙
    문서에만 영향. 신설 `workflow-assistant.controller.swagger.spec.ts` 가 전 7개 라우트에 대해
    이 문서화를 회귀 테스트로 고정한다(공허 방지 라우트 수 `[전제]` 케이스 포함).
  - 제안: 조치 불요 — 결함이 아니라 규약(`swagger.md §2-4`) 준수 개선이다.

## 요약

이번 changeset 은 실질적으로 (1) 내부 harness 도구의 프롬프트 조립 헬퍼 신설, (2) 주석/문서 내
줄 번호 인용 정정, (3) 이미 인가된 엔드포인트에 대한 Swagger 401 문서화 추가, (4) 방대한
`plan/`·`spec/` 문서 정리(절 번호 재배치, 앵커 수정, 실측 기록)로 구성된다. 애플리케이션의 인증·
인가·인젝션·암호화·에러 처리 경로에 실질적 코드 변경은 없으며, 확인한 유일한 인가 관련 코드
변경(`workflow-assistant.controller.ts`)은 기존 가드를 그대로 둔 채 문서만 보강한 것으로 확인됐다.
하드코딩된 시크릿, 인젝션 벡터, 안전하지 않은 암호화·해시 사용은 발견되지 않았다. plan 문서 안에
WS 토큰 재검증 부재라는 기존 보안 관련 갭이 재확인·기록됐으나 이는 이 PR 이 만든 것이 아니라
이미 추적 중인 사전 존재 이슈이며, 이 PR 은 코드가 아니라 그 사실을 문서화했을 뿐이다.

## 위험도

NONE
