# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
- 실제 diff (`git diff origin/main...HEAD --stat -- spec/`): 2 files changed
  - `spec/5-system/14-external-interaction-api.md` (durationMs 를 `GET /api/external/executions/:id` §5.3 응답에 추가 + Rationale 정정)
  - `spec/conventions/node-cancellation.md` (top-level 취소 종결 가드 테이블 행 + Rationale 정정 서술)
- prompt 의 conventions 번들은 컨텍스트 예산으로 다수 파일이 절단되어 있어(swagger.md/error-codes.md/redis-keys.md 등),
  해당 conventions 는 저장소에서 직접 `Read` 하여 대조했다.

## 발견사항

- **[WARNING] `§5.4 부재 표현 규약` 링크가 엉뚱한 앵커(같은 문서의 "명시적 취소")를 가리킴**
  - target 위치: `spec/5-system/14-external-interaction-api.md:625` — `### execution.cancelled 의 행동 계약` 절, "일반 user cancel 에는 `error` 키가 없다" 문장
  - 위반 규약: `spec/5-system/2-api-convention.md §5.4 부재 표현 — null vs 키 생략` (진짜 SoT). 같은 파일 안에서도 line 497 ·795 ·1390 은 이 규약을 `[API 규약 §5.4](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` 로 정확히 링크한다.
  - 상세: `625` 행의 링크는 `([§5.4 부재 표현 규약](#54-명시적-취소--post-apiexternalexecutionsexecutionidcancel))` 로, 앵커가 **로컬 문서 자신의 §5.4("5.4 명시적 취소 — POST .../cancel")** 를 가리킨다. 그 절은 취소 엔드포인트 스펙일 뿐 부재 표현과 무관하다 — 실제로 열어 보면(§5.4 명시적 취소, line ~541~556) "부재 표현" 언급이 전혀 없다. 클릭하면 독자가 엉뚱한 절로 이동해, 이 문서가 §6 도입부에서 스스로 천명한 "같은 필드를 여러 문서에 나열하면 두 번째 SoT 가 된다"는 포인터 원칙(및 §5.4 부재 표현 규약 자체의 "그 필드를 문서화하는 절에 사유를 명시")이 실제로는 깨진 상태다.
  - 이 행 자체는 이번 diff 가 만든 것이 아니다(`git log -L 625,625` 기준 커밋 `9a4d3e32b` #1166 에서 도입) — 다만 이번 diff 가 같은 "§5.4 부재 표현" 표현을 durationMs 캐비엇에도 반복 사용하고 있어(아래 INFO), 검토 중 함께 드러났다.
  - 제안: 앵커를 `./2-api-convention.md#54-부재-표현--null-vs-키-생략` 로 정정 (line 497 의 표기와 동일 패턴).

- **[INFO] 신규 `durationMs` 캐비엇의 `§5.4` 참조가 문서-로컬/외부 어느 쪽인지 모호**
  - target 위치: `spec/5-system/14-external-interaction-api.md:487` (§5.3 `GET /api/external/executions/:executionId` 응답 예시, 신규 `durationMs` 필드 주석) — `// 종결 전에는 null (키는 present — §5.4 부재 표현).`
  - 위반 규약: 직접 위반은 아니나 `2-api-convention.md §5.4` 를 가리키려는 의도로 보이는데, 같은 파일에 로컬 `§5.4 명시적 취소` 섹션이 별도로 존재해 위 WARNING 과 같은 오독 위험을 반복한다.
  - 상세: JSON 코드펜스 안이라 마크다운 링크는 못 쓰지만, 이 문서의 다른 절(line 497, 795, 1390)은 이런 경우에도 "API 규약 §5.4" 처럼 문서명을 명시해 모호성을 없앤다. 코드 쪽 구현(`execution-status-response.dto.ts` JSDoc)은 이미 "API 규약 §5.4" 로 정확히 표기하고 있어(`종결 전에는 null (키 present — API 규약 §5.4)`), spec 문서만 표기가 뒤처졌다.
  - 제안: `§5.4 부재 표현` → `API 규약 §5.4 부재 표현` 으로 문서명을 명시. 위 WARNING 수정과 함께 처리하면 두 자리 모두 정합된다.

## 준수 확인 (문제 없음 — 참고용)

- `durationMs` 필드: wire 명명(camelCase) · null-with-key-present 부재 표현(2-api-convention §5.4 "기본은 null") · DTO 선언(`execution-status-response.dto.ts` `@ApiPropertyOptional({ nullable: true })` + `durationMs?: number | null`) 모두 규약과 일치.
- DTO 파일 위치·명명: `dto/responses/execution-status-response.dto.ts` / `execution-status.literal.ts` / `interact-ack-response.dto.ts` 가 `swagger.md §5-1` 패턴(`dto/responses/*-response.dto.ts`, 공유 enum `*.literal.ts` 분리) 그대로다.
- `InteractAckDto` + `ApiAcceptedWrappedResponse(InteractAckDto)` 참조(§5.4 명시적 취소)는 `swagger.md §5-2` 공용 래퍼 헬퍼 인벤토리와 일치.
- `context` 필드의 `oneOf`(discriminator 미사용) 설계 및 그 근거는 `swagger.md §1-4` / Rationale "discriminator 는 판별자가 sound 할 때만" 과 정확히 부합(오히려 이 문서 사례가 그 규약 조항의 실증 사례로 인용되어 있다).
- 감사 액션 `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 는 `audit-actions.md §3 레지스트리`(2026-08-11 등재)에 이미 등록되어 `<resource>.<verb>` + 과거분사 규칙을 만족.
- 에러 코드(`STATE_MISMATCH`/`TOKEN_REFRESH_*`/`MESSAGE_TOO_LONG`/`TOO_MANY_CONNECTIONS` 등)는 `error-codes.md §1` UPPER_SNAKE_CASE 규칙을 만족(도메인 prefix 는 "권장"이며 강제 아님).
- `spec/conventions/node-cancellation.md` diff(신규 테이블 행 + 취소 스트라이크스루 정정 서술)는 같은 문서·같은 spec 파일 전반에서 이미 쓰이는 "정정 이력을 취소선으로 남긴다" 서술 관행과 형식이 일치하며 별도 명명·포맷 위반 없음.
- 문서 3섹션 구성(Overview/본문/Rationale): `14-external-interaction-api.md` 는 `## Overview (제품 정의)` ~ `## Rationale` 구조를 그대로 유지, 이번 diff 로 구조 변경 없음.

## 요약

이번 PR 의 실제 변경분(durationMs 필드 추가 + 두 건의 Rationale 정정)은 명명·출력 포맷·DTO 규약 어느 것도 위반하지 않는다. 검토 중 발견된 유일한 실질 이슈는 같은 문서 §6 안의 사전 존재하던 크로스레퍼런스 앵커 오류(§5.4 "부재 표현" 링크가 자기 문서의 "명시적 취소" 절로 잘못 연결) 이며, 이는 이번 diff 가 만든 결함은 아니지만 diff 가 반복한 동일 문구("§5.4 부재 표현")로 인해 같은 오독 위험이 한 곳 더 늘었다. 시스템 invariant 를 깨는 CRITICAL 급 위반은 없다.

## 위험도

LOW
