# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep, `eia-secret-pattern-token-family`)

검토 대상(전문 확보): `spec/5-system/2-api-convention.md` · `spec/5-system/14-external-interaction-api.md`
(부수 확인: `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md` · `spec/1-data-model.md` §2.14/§2.17 ·
`spec/conventions/{secret-store,swagger,error-codes,redis-keys,migrations,interaction-type-registry}.md`).
컨텍스트 예산 초과로 프롬프트에서 생략된 나머지 `5-system/*`·`conventions/**` 파일은 실제 저장소 경로에서
`Read` 로 직접 열어 대조했다.

이 작업(`plan/in-progress/eia-secret-pattern-token-family.md`)은 코드 레벨 `token` 계열 값-패턴 마스킹
확장 + spec 저비용 문서 3건을 목표로 한다. spec 본문에 새 정책을 추가하지 않고 기존
`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 을 SoT 로 재사용하는 설계라 신규 conventions 위반
표면은 만들지 않는다. 아래는 착수 전 시점 target 문서 자체의 정식 규약 준수 상태다.

## 발견사항

- **[WARNING] `2-api-convention.md §2.2` 가 `/api/external/*` 인증-family prefix 패턴을 다루지 않는다**
  - target 위치: `spec/5-system/2-api-convention.md` §2.2 "명명 규칙" 표 (기본 패턴 3종 + RPC-style
    sub-channel 예외 1종만 나열)
  - 위반 규약: 같은 문서 §2.2 자신이 정의하는 "명명 규칙" 표 — 실제 구현·다른 절이 쓰는 URL 형태를
    포괄하지 못함
  - 상세: §2.2 는 URL 형태를 (1) `/api/{resource}`, `/api/{resource}/{id}`,
    `/api/{resource}/{id}/{sub-resource}` 세 기본 패턴과 (2) `/api/{resource}/{id}/{channel}/{action}`
    형태의 "RPC-style sub-channel action"(`rotate-*`/`revoke-*`/`disable-*`/`switch` 한정) 예외로만
    한정한다. 그러나 `14-external-interaction-api.md` §5 의 실제 엔드포인트
    (`POST /api/external/executions/:id/interact`·`/cancel`·`/refresh-token`,
    `GET /api/external/executions/:id/stream`)는 이 두 패턴 어디에도 안 맞는다 — "external" 이
    resource 가 아니라 인증-family 를 구분하는 prefix 이고(R11 근거), 뒤따르는 `interact`/`cancel`/
    `refresh-token`/`stream` 은 예외 표가 요구하는 channel 세그먼트나 `rotate-*` 류 동사 어휘가 없는
    일반 액션 동사다. 같은 문서의 §11(Webhook)은 자기 URL family(`/api/hooks/{endpoint_path}`)를
    §11.1 에서 직접 서술하는데, External Interaction API 의 URL family 는 §2.2 본문에 대응하는
    서술이 전혀 없고 §7 Rate-limit 표·§5.4 Rationale 안의 부수 언급으로만 존재한다 — 같은 문서
    안에서 도메인 URL family 서술 깊이가 비대칭이다.
    이 문서(`2-api-convention.md`)는 실제로 `/api/external/*` 를 §7(Rate Limiting)·§5.4
    (Rationale)에서 **참조는 하면서** §2.2(명명 규칙 자체)에는 등재하지 않아, §2.2 만 읽는
    독자는 이 family 가 규약 준수인지 판단할 근거가 없다.
  - 제안: 이 항목은 이미 `plan/in-progress/eia-secret-pattern-token-family.md` "저비용 문서 3건"의
    세 번째 항목("`2-api-convention.md §2.2` — 별도 인증 family 임을 명시")으로 계획돼 있다 —
    착수 전 재확인 결과 실체가 있는 갭임을 확인. §2.2 에 `/api/external/*` 를 별도 인증 family
    prefix 로 명시하고, 필요하면 RPC 예외 행의 동사 어휘 제약(`rotate-*`/`revoke-*`/`disable-*`/
    `switch`)을 일반 액션 동사까지 포괄하도록 확장하거나 별도 행을 신설한다.

- **[INFO] `hmacAlgorithm` 출처 인용 drift — 정식 규약(conventions) 위반은 아니고 문서-내 사실 정정 성격**
  - target 위치: `14-external-interaction-api.md` EIA-NX-03(§3.1, 실제 라인 ~64)·R12(§Rationale)
  - 상세: EIA-NX-03 은 "`hmacAlgorithm: 'sha256'` 를 trigger config 에 보관하되"라고 현재형으로
    서술하지만, 같은 문서 §7.1 은 `authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm`
    inline 필드가 폐지되고 `V066` cleanup migration 으로 제거됐다고 명시한다(현행 소유자는
    `AuthConfig.config.algorithm`). 이는 `spec/conventions/**` 의 특정 항목을 직접 위반하는 것이
    아니라 문서 내부 사실이 최신 구현과 어긋난 사례이며, `plan/in-progress/eia-secret-pattern-token-family.md`
    가 이미 저비용 문서 항목 1번으로 지목·실측 완료했다. `spec/conventions/secret-store.md`·
    `spec/conventions/migrations.md` 어느 쪽도 이 필드의 SoT 를 선언하지 않으므로 본 리뷰(정식
    규약 준수) 범위 밖으로 판단해 WARNING 이 아닌 INFO 로 낮춘다 — 다만 `cross_spec`/내부 정합성
    리뷰가 놓치지 않도록 기록해 둔다.
  - 제안: 계획대로 §3.1 인용만 "폐지·V066 로 제거, 현행 소유자 `AuthConfig.config.algorithm`" 으로
    정정하고 R12 의 inbound/outbound 분리 결론 자체는 유지.

- **[INFO] §11(WS↔외부 명령 매핑) 두 "권위 표"의 `execution.stop` 각주 비대칭 — conventions 범위 밖**
  - target 위치: `14-external-interaction-api.md` §5.1 표(라인 ~300, won't-do 각주 있음) vs §11 표
    (라인 ~1124, 각주 없음)
  - 상세: 같은 문서가 "5.1 의 표가 §11 권위 표와 정합해야 한다"고 스스로 요구하는데(§11 서문),
    §11 행에는 `execution.stop` 이 §4.2 에서 won't-do 라는 사실이 빠져 있다. `spec/conventions/**`
    의 특정 항목을 위반하는 것이 아니라 문서 내부 두 권위 표 사이의 drift이므로 본 리뷰 범위(정식
    규약 준수) 밖으로 분류하고 `cross_spec` 리뷰 소관으로 넘긴다. `plan/in-progress/eia-secret-pattern-token-family.md`
    저비용 문서 항목 2번이 이미 이 갭을 지목·수정 예정이다.
  - 제안: 계획대로 §11 행에도 동일 각주("WS 명령은 §4.2 won't-do — REST cancel 로 처리, 외부에서는
    `force` 옵션 미지원")를 추가.

## 확인했으나 위반이 아닌 항목 (참고)

- **문서 구조 3섹션**: `2-api-convention.md`(본문+`## Rationale`, 다중-파일 영역이라 Overview 는
  공유 `_product-overview.md` 가 담당 — `.claude/skills/project-planner/SKILL.md` §단일 진실 원칙과
  합치)·`14-external-interaction-api.md`(자체 `## Overview (제품 정의)` + `## Rationale` 모두 보유)
  둘 다 준수.
- **Swagger 규약**: `14-external-interaction-api.md` §10.1 이 인용하는 `swagger.md §2-1/§5/§5-1/§5-2/
  §5-4/§5-5` 섹션 번호·내용이 실제 `spec/conventions/swagger.md` 와 일치. `dto/responses/*-response.dto.ts`
  파일명 패턴, `*.literal.ts` 분리(`execution-status.literal.ts` 실재 확인), `writeOnly`/`readOnly`
  의무 대상 없음(EIA DTO 는 secret plaintext 입력 필드가 없음) 모두 위반 없음.
- **Secret Store 규약**: §7.1 의 `notification.signing.secretRef` 는 `secret://triggers/{id}/
  notification-signing` 형식으로 `secret-store.md §1` URI scheme 을 정확히 따르고,
  `interaction.triggerToken` 평문 보관은 `secret-store.md` 가 2026-08-16 자로 이미 등재한 "명시적
  비대상 예외"와 문구까지 일치 — 위반 없음.
- **Redis 키 명명**: EIA 가 쓰는 `iext:blacklist:<jti>`·`interaction:idempotency:*`·
  `eia:rl:interact:*`·`eia:rl:status:*`·`eia:notif:rl:*` 전부 `redis-keys.md §3` 인벤토리에 등재돼
  있고 소유 모듈(`modules/external-interaction`)도 일치.
- **에러 코드 표기**: EIA 전용 코드(`TOKEN_INVALID`/`TOKEN_REVOKED`/`TOO_MANY_CONNECTIONS`/
  `STATE_MISMATCH` 등) 전부 `UPPER_SNAKE_CASE`(`error-codes.md`/`node-output.md §3.2` 표기 규칙
  준수). 워크스페이스 JWT 계층과 같은 이름(`TOKEN_INVALID`/`TOKEN_EXPIRED`)을 재사용하는 부분도
  "코드 네임스페이스 주석"으로 레이어 구분을 문서 안에서 명시해 `error-codes.md §1` "의미 기반
  명명" 원칙과 상충하지 않음.
- **AuthConfig 마스킹(`***<last4>`) vs EIA egress 마스킹(`***`) 형태 차이**: `spec/1-data-model.md
  §2.17.2`(AuthConfig, last4 보존)와 `14-external-interaction-api.md §R17`(EIA, 완전 치환)의
  마스킹 출력 형태가 다르지만, 이는 두 문서가 서로 다른 SoT·용도(정적 자격증명 표시용 vs 자유
  텍스트 egress 방어)를 가진 의도된 분리이며 plan 이 이미 "마스킹 형태도 다르다" 로 명시 인지하고
  있음 — 혼용·중복 SoT 위반 아님.

## 요약

이번 작업이 spec_impact 로 지정한 `spec/5-system/{2-api-convention.md,14-external-interaction-api.md}`
는 Swagger/DTO 명명, Secret Store URI scheme, Redis 키 명명, 에러 코드 표기 등 핵심 정식 규약을
전반적으로 준수하고 있다. 유일하게 실체 있는 규약 문서화 갭은 `2-api-convention.md §2.2` 가
`/api/external/*` 인증-family URL 패턴을 명명 규칙 표 자체에 등재하지 않은 것으로, 이는 이미 이번
plan 의 "저비용 문서 3건" 세 번째 항목으로 계획돼 있어 착수 전 검토가 그 필요성을 재확인한 결과다.
`hmacAlgorithm` 인용 정정과 §11 표 각주 동기화는 conventions 위반이라기보다 문서 내부 사실 정합성
문제로, 본 리뷰(정식 규약 준수) 범위 밖이라 INFO 로 낮춰 기록했다(각각 `cross_spec` 리뷰·이미
plan 항목 1·2번이 커버). 코드 레벨 `token` 계열 마스킹 확장 자체는 기존 `SECRET_LEAK_PATTERNS`/
`CREDENTIAL_KEY_PATTERN` SoT 를 그대로 재사용하는 설계라 신규 conventions 위반 표면을 만들지 않는다.

## 위험도

LOW
