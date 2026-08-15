# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md

## 검토 범위 및 방법

- 모드: `--impl-prep`, scope=`spec/5-system/`
- Target: `spec/5-system/14-external-interaction-api.md` (bundle 에 `spec/5-system/2-api-convention.md` 도 컨텍스트로 포함)
- `_prompts/convention_compliance.md` 자체는 컨텍스트 예산 초과로 `spec/conventions/**` 271개 파일 본문을 **전부 생략**하고 있었다(파일 하단 "⚠️ 컨텍스트 예산 초과로 생략된 파일" 목록에 `swagger.md`·`redis-keys.md`·`error-codes.md`·`interaction-type-registry.md`·`secret-store.md`·`conversation-thread.md` 등이 명시적으로 포함). 프롬프트 번들만으로는 규약 본문 대조가 불가능한 상태였으므로, 이번 검토는 `Read` 로 아래 규약 원문을 직접 열어 target 인용과 대조했다: `swagger.md` (§1-3·§1-4·§2-1·§2-5·§5-1·§5-2), `redis-keys.md` (전체), `error-codes.md` (§4), `interaction-type-registry.md` (§1.1), `secret-store.md` (§1).

## 발견사항

이번 검토에서는 CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다. 아래는 확인한 항목과 그 근거다 (모두 문제 없음으로 판정 — 기록 목적).

- **[INFO] Redis 키 인벤토리와 완전 일치**
  - target 위치: §8.4 Rate Limit (`eia:rl:interact:<executionId>` / `eia:rl:status:<executionId>` / `eia:notif:rl:<triggerId>`), §R8 Rationale "캐시 키 스코프" (`interaction:idempotency:<executionId>:<route>:<key>`), §3.3 (`iext:blacklist:<jti>`)
  - 대조 규약: `spec/conventions/redis-keys.md` §3 전역 인벤토리
  - 상세: 인벤토리 표의 엔트리(`interaction:idempotency:<executionId>:<route>:<key>` · `eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` · `iext:blacklist:<jti>`)와 target 의 키 표기가 문자 그대로 일치하고, redis-keys.md 자신도 "EIA 키의 상세" SoT 로 본 spec §8.4 를 직접 가리킨다(포인터 원칙 준수). §1 의 "머리 2세그먼트 고정 + 꼬리 가변" 형태도 지켜진다.
  - 제안: 조치 불필요. `plan/in-progress/eia-terminal-payload.md` 가 다루는 후속 작업(`durationMs` cancel 경로)이 새 Redis 키를 만들 경우, redis-keys.md §5 "새 키를 도입하면 등재한다" 의무만 유의.

- **[INFO] Swagger 규약(§1-4 닫힌 union, §2-5 응답 wrapping, §5 응답 DTO)과 정합**
  - target 위치: §5.3 `context` oneOf 블록, §5.1/§5.4 `InteractAckDto`/`@ApiAcceptedWrappedResponse`, §10.1, §4.1/§5 전송 봉투 설명
  - 대조 규약: `spec/conventions/swagger.md` §1-4(discriminator 는 sound 할 때만), §2-5(`'data' in data` pass-through), §5-2(공용 래퍼 헬퍼 인벤토리)
  - 상세: target §5.3 은 "`context` 는 판별자 없는 닫힌 2-variant union… OpenAPI 스키마는 `discriminator` 없이 `oneOf`" 라고 명시하는데, 이는 swagger.md §1-4 의 "판별 필드가 variant 간 값을 공유하면 discriminator 생략" 규칙과 정확히 일치(buttons 가 두 변형 모두에 등장 = unsound 판별자). §5.4 의 `@ApiAcceptedWrappedResponse(InteractAckDto)` 표기도 swagger.md §5-2 헬퍼 인벤토리(`ApiAcceptedWrappedResponse(Dto)` → `{ data: <Dto> }`, 202 Accepted)와 정확히 일치. §10.1 의 `interaction-token` Bearer scheme 분리·`@ApiSecurity({})` 미사용 설명도 §2-1 규칙과 일치.
  - 제안: 조치 불필요.

- **[INFO] error-codes.md·interaction-type-registry.md·secret-store.md 교차 참조 정합**
  - target 위치: §6.4 (`EXECUTION_TIMEOUT` 레이어 주석), §5.3/§6.2 (`interactionType: form|buttons|ai_conversation`), §7.1 (`secret://triggers/{triggerId}/notification-signing`)
  - 대조 규약: `error-codes.md` §4 "레이어 주의 — `EXECUTION_TIMEOUT` 동명 코드" (target §6.4 를 명시적으로 cross-ref), `interaction-type-registry.md` §1.1 "내부 4값 ↔ EIA 외부 3값 매핑" (target §6.2 를 SoT 로 명시), `secret-store.md` §1 URI Scheme 예시 표 (target 의 `notification-signing` ref 를 EIA-NX-12 항목으로 이미 등재)
  - 상세: 세 규약 모두 target 문서를 **양방향으로 인용**하고 있어(규약 쪽에서도 target 을 SoT/사례로 가리킴) 두 문서가 이미 동기화된 상태임을 확인. 새로 추가된 불일치 없음.
  - 제안: 조치 불필요.

- **[INFO] 문서 구조 3섹션 준수, 단 "Overview" 헤더 표기는 영역 내에서도 혼재(target 특이사항 아님)**
  - target 위치: 문서 전체 구조 (`## Overview (제품 정의)` → `## 3~12` 본문 → `## Rationale`)
  - 대조 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
  - 상세: target 은 3섹션 구조를 지킨다. 다만 `## Overview (제품 정의)` 표기는 `12-webhook.md`·`15-chat-channel.md` 는 동일하게 괄호를 붙이는 반면 `4-execution-engine.md`·`1-auth.md` 는 `## Overview` 만 쓴다 — `spec/5-system/` 영역 전체에 걸친 기존 비일관이며 이번 target 이 새로 만든 편차가 아니다. 규약 위반이라기보다 영역 전체의 사소한 표기 비일관.
  - 제안: 이번 target 단독 수정 불필요. 영역 전체 표기 통일이 필요하면 별도 planner 턴에서 `spec/5-system/**` 전수 조사.

## 요약

`spec/5-system/14-external-interaction-api.md` 는 이미 다수의 consistency-check/ai-review 라운드(git 이력상 #1145~#1170대)를 거치며 `spec/conventions/redis-keys.md`·`swagger.md`·`error-codes.md`·`interaction-type-registry.md`·`secret-store.md` 등 정식 규약과 정밀하게 동기화되어 있고, 이번 브랜치의 실제 diff(`origin/main` 대비)도 Re-run API 경로의 `/v1/` 세그먼트 오기 정정 1줄뿐이라 신규 규약 위반 표면이 없다. 프롬프트 번들 자체가 컨텍스트 예산 초과로 `spec/conventions/**` 본문을 전부 생략하고 있었지만, 해당 파일들을 직접 열어 target 의 인용(Redis 키 인벤토리, Swagger DTO/래퍼 패턴, 에러 코드 레이어 구분, interactionType 4→3 매핑, secret URI scheme)을 원문과 대조한 결과 전부 일치했다. CRITICAL/WARNING 없음.

## 위험도

NONE
