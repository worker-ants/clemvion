# 보안(Security) 코드 리뷰

## 범위 요약

이번 changeset(37개 파일, 앞선 라운드 `18_30_55` 산출물 커밋 포함)에서 실행 코드에 실질적 손이 간 곳은 소수다.

- **harness 내부 도구** (`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` + `.claude/tests/test_consistency_scope_census.py`): `--impl-done` 프롬프트 조립용 순수 함수 `_count_diff_files`/`_scope_delta_census` 신설. 인자(`root`, `scope_rel`, `diff_text`)를 f-string 으로 조립해 마크다운 텍스트를 반환할 뿐, `subprocess`/`os.system`/`eval` 호출이나 파일 쓰기가 없다. 값의 출처는 로컬 git 저장소(개발자가 실행하는 CLI 인자·`git diff` 결과)라 원격 공격자 입력 표면이 아니다 — 인젝션 벡터 없음.
- **주석/JSDoc-only 변경** (`chat-channel.dispatcher.ts`, `chat-channel.dispatcher.spec.ts`, `chat-channel/types.ts`): 썩은 줄 번호 인용(`line 536`, `line 89`) 제거, 앵커·§번호는 유지. 실행 경로·타입·검증 로직 변화 없음.
- **Swagger 문서화 추가** (`workflow-assistant.controller.ts` 7곳 `@ApiUnauthorizedResponse` + 신규 `workflow-assistant.controller.swagger.spec.ts`): 실제 코드를 직접 열어 확인 — `@ApiBearerAuth('access-token')`(클래스 레벨) · `@WorkspaceId()` · `@Roles('editor')` · `ParseUUIDPipe` 등 인증/인가/입력검증 데코레이터는 전부 그대로이고, 이번 diff 는 OpenAPI 문서 애노테이션만 추가한다. 인가 로직 변경 없음 — 오히려 401 미문서화 갭(`swagger.md §2-4` 위반)을 메우는 긍정적 변경이며 회귀 테스트(라우트 수 공허 방지 전제 포함)가 동반된다.
- **WS/EIA/notifications 절번호 재배치·앵커 정정** (`spec/5-system/6-websocket-protocol.md`, `14-external-interaction-api.md`, `data-flow/8-notifications.md`, `websocket-events.types.ts`, `websocket.service.ts`, `websocket.service.spec.ts`): 순수 문서/주석 참조 정정. `14-external-interaction-api.md` §8.2 의 outbound webhook HMAC 알고리즘 화이트리스트 문구가 `hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 로 정정됐는데, 코드(`notification-signature.util.ts:11` `SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'`, `notification-config.dto.ts:46` `@IsIn(['hmac-sha256','hmac-sha512'])`)와 대조하면 **이미 구현된 동작을 spec 문구가 뒤늦게 따라간 것**이지 실제 서명 검증 화이트리스트가 넓어지는 것이 아니다(양쪽 다 sha256/sha512 두 값만 timing-safe 비교). 검증 로직 자체(`Webhook §4.2` 의 timing-safe 비교, ±5분 window)는 diff 대상이 아니다.
- **나머지 대부분**은 `plan/**` 마크다운(진행상황·실측 기록) 및 앞선 리뷰 라운드(`18_30_55`)의 산출물 파일 자체(`SUMMARY.md`, `security.md` 등) 커밋 — 실행되는 코드가 아니다.

## 발견사항

- **[INFO]** WebSocket 세션이 핸드셰이크 이후 토큰을 재검증하지 않는다는 기존 갭이 이번 diff 로 plan 문서에 실측 기록됨 (코드 변경 아님)
  - 위치: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (신설 블록, `auth.token_expired` 항목 하단 — `jwtService.verify 호출부 | websocket.gateway.ts:156 단 1곳` 표)
  - 상세: 이 diff 자체는 코드를 바꾸지 않고 기존 갭을 문서로만 등재했다. 다만 기록된 내용 자체는 보안적으로 유의미하다 — `jwtService.verify` 호출이 `handleConnection` 1곳뿐이고 gateway 에 `exp` 참조·재검증 타이머·guard 가 없어, **토큰이 만료되거나 폐기돼도 이미 연결된 WS 소켓은 계속 인가된 채로 살아 있다.** 문서 스스로 착수 전 제품 결정(만료 시 disconnect 여부)이 필요하다고 명시하며 구현을 보류했다 — 이번 PR 이 만든 결함이 아니라 사전 존재하는 갭의 문서화다.
  - 제안: 이 PR 범위에서 조치 불요(코드 변경 없음). 다만 계정 잠금·강제 로그아웃·토큰 폐기 기능이 실재한다면 이 WS 경로가 그 보장을 무력화할 수 있으므로, 보안 우선순위 트리아지에서 별도 승격을 권고한다.

- **[INFO]** Cafe24 install 엔드포인트의 rate limit Layer 1(`@nestjs/throttler`)이 여전히 in-memory(프로세스-로컬)라는 사실이 실측 기록됨 (코드 변경 아님, 기존 defer 결정의 재확인)
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` (신설 블록, `ThrottlerModule.forRoot`/storage 설정 표)
  - 상세: Layer 2(`Cafe24InstallRateLimitService`, Redis 기반 IP lockout, 임계치 10/10분)가 이미 존재해 install token oracle enumeration 을 cross-pod 로 방어한다. Layer 1 은 멀티 인스턴스 환경에서 인스턴스당 quota 가 별도로 리필되는 알려진 한계이며, 이 diff 는 그 사실과 "새 의존성 도입이 필요하다"는 규모를 재확인·기록했을 뿐 코드는 바뀌지 않았다.
  - 제안: 조치 불요(기존 defer 결정 유지, 이 PR 범위 아님).

- **[INFO]** `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse` 7곳 추가는 순수 OpenAPI 문서 애노테이션이며 실제 가드 변경이 없음을 코드 직접 대조로 확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` (`list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage` 각 핸들러 데코레이터 블록)
  - 상세: 클래스 레벨 `@ApiBearerAuth('access-token')`, 메서드별 `@WorkspaceId()`/`@Roles('editor')`/`ParseUUIDPipe` 등 실제 인증·인가·입력검증 데코레이터는 diff 대상이 아니고 그대로 유지된다. 신설 `workflow-assistant.controller.swagger.spec.ts` 가 401 문서화를 회귀 테스트로 고정한다(라우트 수 7개 공허 방지 전제 포함).
  - 제안: 조치 불요 — 결함이 아니라 `swagger.md §2-4` 규약 준수 개선.

- **[INFO]** `14-external-interaction-api.md` §8.2 의 outbound webhook HMAC 알고리즘 화이트리스트 문구 정정(`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512`)이 실제 구현과 일치함을 코드 직접 대조로 확인
  - 위치: `spec/5-system/14-external-interaction-api.md:948-950`, 대조 코드 `notification-signature.util.ts:11`, `notification-config.dto.ts:46`
  - 상세: spec 문구가 실제 코드 뒤늦게 따라간 순수 문서 정정이라 서명 검증 로직·화이트리스트 범위에 실질 변화가 없다. timing-safe 비교·±5분 window 등 검증 메커니즘 자체는 diff 밖이다.
  - 제안: 조치 불요.

## 요약

이번 changeset 은 실질적으로 (1) 내부 harness 도구의 프롬프트 조립 헬퍼 신설(순수 함수, 외부 입력 표면 없음), (2) 주석/문서 내 썩은 줄 번호·절 번호 인용 정정, (3) 이미 인가된 엔드포인트에 대한 Swagger 401 문서화 추가(가드 변경 없는 순수 additive), (4) HMAC 화이트리스트 spec 문구를 기존 구현에 맞춰 정정, (5) 방대한 `plan/`·`spec/` 문서 정리(절 번호 재배치, 앵커 수정, 실측 기록, 앞선 리뷰 라운드 산출물 커밋)로 구성된다. 애플리케이션의 인증·인가·인젝션·암호화·에러 처리 경로에 실질적 코드 변경은 없으며, 확인한 유일한 인가 관련 코드 변경(`workflow-assistant.controller.ts`)은 기존 가드를 그대로 둔 채 문서만 보강한 것으로 직접 코드 대조를 통해 확인했다. 하드코딩된 시크릿, 인젝션 벡터(SQL/XSS/커맨드/경로 탐색), 안전하지 않은 암호화·해시 사용, 알려진 취약점이 있는 신규 의존성은 발견되지 않았다(package.json 변경 없음). plan 문서 안에 WS 토큰 재검증 부재라는 기존 보안 관련 갭이 재확인·기록됐으나 이는 이 PR 이 만든 것이 아니라 이미 추적 중인 사전 존재 이슈이며, 이 PR 은 코드가 아니라 그 사실을 문서화했을 뿐이다. 저장소 뮤테이션 없이 `Read`/`Grep`/`git status --short` 로만 검증했으며 작업 트리는 clean(세션 산출물 디렉터리 외 변경 없음)했다.

## 위험도

NONE
