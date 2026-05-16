# Convention Compliance Review

**대상 문서**: `spec/2-navigation/4-integration.md`
**검토 모드**: 구현 착수 전 (`--impl-prep`)
**정식 규약 참조**: `spec/conventions/` 전체

---

## 발견사항

### [INFO] 문서 구조 — Overview 섹션 명시적 표기 없음
- target 위치: 문서 최상단 (라우트 구성 §1 바로 시작)
- 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성 (Overview / 본문 / Rationale) 을 따른다. 단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다."
- 상세: `4-integration.md` 는 다중 spec 파일을 가진 `spec/2-navigation/` 영역에 속하며 `_product-overview.md` 가 별도로 존재한다. 그러므로 Overview 를 본 파일에 넣을 필요는 없다. 다만 문서 첫 헤더가 바로 `## 1. 라우트 구성` 으로 시작해 **기술 개요·범위 설명이 완전히 누락**되어 있다. 관련 문서 링크(`> 관련 문서: …`) 는 있으나 이는 Overview 를 대체하지 못한다.
- 제안: `## 0. Overview` 또는 `## 개요` 섹션을 `## 1. 라우트 구성` 앞에 추가해 "본 spec 이 다루는 화면 범위, 주요 서비스 목록, 진입점 요약"을 2~5문장으로 기술한다. 규약 자체의 명시적 강제는 "권장"이므로 CRITICAL 등급까지는 아니다.

---

### [INFO] 에러 코드 형식 혼재 — `status_reason` 값이 snake_case·UPPER_SNAKE_CASE 병행
- target 위치: §9.4 공통 응답 포맷(에러코드 목록), §10.4 에러 매핑 표, §Rationale "Cafe24 Private 앱의 callback 실패" 항
- 위반 규약: `spec/conventions/node-output.md` §Principle 0 / §Principle 2 는 노드 Output 형식을 다루며 에러 코드에 대한 직접 지시는 없다. `spec/conventions/swagger.md §2-4` 는 HTTP 응답 상태 코드 데코레이터 규칙을 정의한다. 이 spec 내에서 Rationale §(2026-05-14) 는 `status_reason` DB 저장값은 `snake_case`, API 응답 에러 코드는 `UPPER_SNAKE_CASE` 로 **의도적 분리**를 설명한다.
- 상세: 두 표기 체계의 의도적 분리는 Rationale 에 명시돼 있으나, §9.4 에러 코드 목록과 §10.4 에러 매핑 표가 **두 포맷을 같은 테이블 행에 혼용**하고 있어 독자가 어느 값이 API 응답 코드이고 어느 값이 DB 저장값인지 구분하기 어렵다. 예: §10.4 의 `status_reason='oauth_state_mismatch'` (snake_case, DB 값) 와 §9.4 의 `OAUTH_STATE_MISMATCH` (UPPER, API 코드) 가 같은 의미임이 명시적 매핑 없이 암묵적으로 연결돼 있다.
- 제안: §9.4 또는 §10.4 상단에 짧은 범례를 추가한다. 예: "아래 `code` 값은 API 응답 JSON의 `code` 필드(`UPPER_SNAKE_CASE`). DB `status_reason` 컬럼 값(`snake_case`)과의 매핑은 Rationale §(Cafe24 Private 앱 callback 실패) 참조." 이렇게 하면 규약 위반이 아니라 문서 가독성 개선으로 처리 가능하다.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md` 참조 링크 표기 통일
- target 위치: §14.2 워크플로우 에디터 본문 중 `[Spec Cafe24 API 메타데이터 §6](../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계)` 표기
- 위반 규약: `spec/conventions/*.md` 의 명명 컨벤션 규칙에서 링크 패턴은 별도로 정의되지 않는다. 그러나 동일 파일을 가리키는 다른 참조 (`spec/conventions/cafe24-api-metadata.md`) 는 `cafe24-api-metadata.md` 자체 파일 상단에 `[Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)` 처럼 정방향 역참조로 이미 맞물려 있다.
- 상세: 규약 파일(`spec/conventions/`)을 `spec/2-navigation/` 에서 참조할 때 상대 경로 `../conventions/` 를 사용하는데, 이 파일 내 다른 conventions 링크(`spec/conventions/swagger.md §2-4` — §9.4 에서 텍스트 언급만 있고 링크 없음)와 표기 일관성이 낮다.
- 제안: conventions 파일 참조 시 마크다운 하이퍼링크 형식으로 통일한다. §9.4 마지막 줄 `swagger 규약(spec/conventions/swagger.md §2-4 …)` 부분을 `[swagger 규약 §2-4](../conventions/swagger.md#2-4-상태-코드-응답-규칙)` 형식으로 변경 권장.

---

### [WARNING] `appUrl` 필드 명명 — DTO 내 camelCase vs 응답 JSON snake_case 미명시
- target 위치: §9.1 `GET /api/integrations/:id` 설명 (`IntegrationDto.appUrl: string | null`), §9.2 `POST /api/integrations/oauth/begin` 응답 (`appUrl`, `callbackUrl`), §9.2 `POST /api/integrations/:id/request-scopes` 응답 (`appUrl`, `callbackUrl`)
- 위반 규약: `spec/conventions/swagger.md §1 DTO 패턴` 은 DTO 필드 명명 컨벤션을 TypeScript camelCase 로 정의한다. 그러나 동일 spec 내에서 body 예시 (§3.2 oauth/begin body)는 `mall_id`, `app_type`, `client_id`, `client_secret` 등 **snake_case** 로 표기한다.
- 상세: 요청 body 는 snake_case(`mall_id`, `app_type`), 응답 shape 은 camelCase(`appUrl`, `callbackUrl`, `integrationId`, `scopesAdded`)로 혼재한다. 이는 NestJS의 ClassTransformer 설정(camelCase 변환 여부)에 따라 실제 wire format 이 달라지는데, spec 이 그 설정을 명시하지 않아 구현 시 혼동을 유발할 수 있다. 특히 `mall_id` / `app_type` (요청) vs `appUrl` / `callbackUrl` (응답)은 같은 Cafe24 플로우 안에 공존한다.
- 제안: §9 API 섹션 상단에 "요청 body 는 snake_case (NestJS `@Transform` 미적용 시 그대로 수신), 응답은 camelCase (`TransformInterceptor` 가 자동 변환)" 또는 그 반대임을 명확히 기술한다. 또는 요청 body 예시도 camelCase 로 통일한다. 규약(`swagger.md`)은 DTO TypeScript 클래스의 camelCase 명명을 요구하므로, wire format 과 DTO 클래스 필드 간 매핑을 spec 에서 명시하는 것이 구현 착수 전 혼란 방지에 필요하다.

---

### [INFO] `## Rationale` 섹션 위치 — 비권장 위치에 인라인 Rationale 산재
- target 위치: §3.2 (설계 배경 문단), §5.3 `bearer`·`basic` 표 (`비고` 열 없는 표 다음), §6 상태 전이 다이어그램 내 주석(`> **번복 acknowledgment** …`)
- 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "아키텍처 결정의 배경·근거(옛 ADR/memory) 는 해당 spec 문서 끝의 `## Rationale` 섹션"; `spec/<영역>/N-name.md` 패턴에서 "본문 끝에 `## Rationale` 섹션을 권장".
- 상세: 이 spec 은 문서 끝에 `## Rationale` 섹션이 존재하며(규약 준수), 주요 결정의 근거도 거기에 잘 정리되어 있다. 그러나 §3.2 의 "**설계 배경**: 서비스 선택 같은 가벼운 단계는 …" blockquote, §6 의 `> **번복 acknowledgment** …` 주석은 Rationale 에 이미 있는 내용을 인라인으로 **중복 기술**하고 있다. 이는 규약 위반 수준은 아니나 단일 진실 원칙과 긴장 관계다.
- 제안: §3.2 설계 배경 blockquote 및 §6 번복 acknowledgment 는 Rationale 섹션으로 이관하고, 본문 해당 위치에는 "설계 근거는 [Rationale §install_token_TTL_24h](#install_token-ttl-24h-2026-05-14) 참조" 형태의 짧은 앵커 링크로 대체하는 것을 권장한다. 단, 인라인 주석이 독자 이해를 크게 돕는 경우 현 상태 유지도 허용 가능(규약은 "권장" 수준).

---

### [INFO] 금지 경로 패턴 미사용 확인
- target 위치: 전체 문서
- 위반 규약: `CLAUDE.md` §명명 컨벤션 — 옛 `prd/`, `memory/`, `user_memo/` 경로 사용 금지
- 상세: 문서 내 참조 링크(`_product-overview.md`, `../4-nodes/...`, `../5-system/...`, `../conventions/...`, `../data-flow/...`)를 전수 확인했다. 금지된 `prd/`, `memory/`, `user_memo/` 경로를 참조하는 링크는 발견되지 않았다.
- 제안: 해당 없음 (준수).

---

### [INFO] 노드 Output 규약 적용 범위 확인
- target 위치: §9.4 공통 응답 포맷, §14.1 에러 코드 vocabulary
- 위반 규약: `spec/conventions/node-output.md` §Principle 0~2
- 상세: `spec/conventions/node-output.md` 는 노드 핸들러의 `NodeHandlerOutput` 5필드 규약을 정의한다. 본 spec(`4-integration.md`)은 UI/API spec 이며 노드 핸들러 출력 형식을 직접 정의하지 않는다. §14.1 에러 코드 vocabulary 는 `IntegrationError(code, message)` throw 를 기술하며, `meta.errorCode?` 필드(node-output §Principle 2 `Code` 분류) 와의 연관성이 명시되어 있지 않다. 그러나 이는 노드 spec(`spec/4-nodes/`) 의 책임 범위이므로 본 문서가 별도로 정의할 필요는 없다.
- 제안: 해당 없음 (범위 외, 노드 spec 과의 정합은 cross_spec checker 가 담당).

---

## 요약

`spec/2-navigation/4-integration.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. 금지된 옛 경로(`prd/`, `memory/`)는 사용하지 않으며, 파일명(`4-integration.md`)과 숫자 prefix 는 `spec/<영역>/N-name.md` 규약에 부합한다. 문서 끝에 `## Rationale` 섹션이 존재하고 주요 결정 근거가 잘 정리되어 있다. `spec/conventions/swagger.md` 가 정의한 HTTP 상태 코드 응답 패턴도 §9.4 에서 준수한다. 다만 요청 body(snake_case)와 응답 shape(camelCase)의 명명 혼재가 WARNING 수준의 우려 사항이며, 구현 착수 전 NestJS의 wire format 변환 설정을 spec 에 명시하는 것이 혼란 방지에 도움이 된다. 그 외 Overview 섹션 미명시, 인라인 Rationale 중복, conventions 링크 일관성은 모두 INFO 수준의 형식 개선 제안이다.

## 위험도

LOW
