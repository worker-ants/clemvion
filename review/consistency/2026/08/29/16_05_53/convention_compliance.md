# 정식 규약 준수 검토 — `spec/conventions/`

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`

## 사전 확인 사항

`git diff origin/main -- spec/conventions/` 결과는 **비어 있다** — 이 브랜치(`eslint10-upgrade`)는
`spec/conventions/` 를 전혀 건드리지 않았다(변경분은 `review/code/**` 산출물뿐). 따라서 아래는
diff 기반 검토가 아니라, 번들에 포함된 `spec/conventions/**` 현재 상태에 대한 standing 감사다.
번들은 컨텍스트 예산 초과로 267개 파일(주로 `cafe24-api-catalog/**` field-level 상세 문서)의
본문이 생략됐다 — 아래 발견사항은 전문이 제공된 문서(`secret-store.md` · `spec-impl-evidence.md` ·
`swagger.md` · `audit-actions.md` · `cafe24-api-catalog/_overview.md`)에 한정된다. 생략된 267개
파일에 대해서는 "문제 없음" 을 단언하지 않는다.

## 발견사항

- **[WARNING]** `swagger.md` §2-2 의 canonical 예제가 같은 문서 §5·§6 이 명시적으로 금지한 "빈 껍데기" 인라인 스키마 패턴을 그대로 쓰고 있다
  - target 위치: `spec/conventions/swagger.md` §2) Controller 패턴 → 2-2. 엔드포인트 데코레이터
  - 위반 규약: 같은 문서의 §5 ("모든 성공 응답은 `@ApiOkResponse({ schema: ... })` 의 인라인 객체가 아닌 **응답 DTO 클래스 + 공용 래퍼 헬퍼**를 사용합니다") 및 §6 레거시 패턴 제거 ("`@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 같은 '빈 껍데기'는 반드시 DTO 기반 래퍼로 교체하세요")
  - 상세: §2-2 의 `create()` 예제는
    ```ts
    @ApiCreatedResponse({
      description: '생성된 워크플로우 정보',
      schema: { type: 'object', properties: { data: { type: 'object' } } },
    })
    ```
    를 쓴다. 데코레이터가 `@ApiOkResponse` 대신 `@ApiCreatedResponse` 라는 점만 다를 뿐, §6 이 이름을 콕 집어 금지한 "빈 껍데기" 스키마 형태(`{ type:'object', properties:{ data:{ type:'object' } } }`)와 완전히 동일하다. §5·§6 을 그대로 적용하면 이 자리는 `ApiCreatedWrappedResponse(WorkflowDto)` (§5-2 표에 정확히 이 케이스용 헬퍼가 있음) 여야 한다. 이 문서는 개발자가 그대로 복붙하는 "가이드" 문서이므로, 뒤쪽 절이 앞쪽 예제를 갱신하지 못하고 남긴 잔재가 실제로 금지 패턴을 전파할 위험이 있다.
  - 제안: §2-2 예제를 `ApiCreatedWrappedResponse(WorkflowDto)` 사용 형태로 교체하거나, §2-2 를 "레거시 예시 — §5 참고" 로 명시 표시. §5·§6 이 최근에 도입되며 §2 의 예제를 소급 갱신하지 않은 것으로 보인다(문서 자체 내 롤아웃 누락).

- **[WARNING]** `swagger.md` §2 의 canonical 예제 3건이 같은 문서 §3 이 "강제" 로 규정한 `summary`/`description` 길이·필수 규칙을 위반한다
  - target 위치: `spec/conventions/swagger.md` §2) Controller 패턴 → 2-2(생성) · 2-3(단건 조회 · 목록 조회)
  - 위반 규약: 같은 문서 §3) 주석/설명 톤 의 표 — "엔드포인트 `summary` 10~20자 **강제**", "엔드포인트 `description` 50~150자 **강제**"
  - 상세:
    - 2-2 `create()`: `summary: '워크플로우 생성'` = 8자(공백 포함) — 10~20자 하한 미달. `description` 은 "새로운 워크플로우를 생성합니다. 생성 시 초기 버전이 함께 기록됩니다." ≈ 39자 — 50~150자 하한 미달.
    - 2-3 `findOne()`: `@ApiOperation({ summary: '워크플로우 단건 조회' })` — `description` 필드 자체가 없음(강제 필드 완전 누락).
    - 2-3 `findAll()`: `@ApiOperation({ summary: '워크플로우 목록' })` = 7자(공백 포함) — 하한 미달, `description` 도 없음.
    빌드 시점에 이 규칙을 강제하는 lint/test 는 저장소에서 발견되지 않았다(수동 grep, 0건) — 즉 "강제" 는 리뷰어 재량에 의존하는데, 정작 이 규칙을 정의한 문서 자신의 예제가 위반 상태로 남아 있어 재량 기준 자체가 흔들린다.
  - 제안: §3 이 2026-08-23 에 신설된 규칙이므로 §2 의 예제 3건을 그 규칙에 맞게 갱신(길이 조정 + `description` 추가)하거나, §2 예제를 "길이 규칙 도입 이전 레거시 예시" 로 각주 처리.

- **[INFO]** `spec/conventions/*.md` 상단 제목(H1) 형식이 파일마다 제각각이다
  - target 위치: `spec/conventions/secret-store.md`(`# CONVENTION: Secret Store (...)`), `spec/conventions/spec-impl-evidence.md`(`# Convention: Spec-Impl Evidence (frontmatter)`), `spec/conventions/swagger.md`(`# Swagger 문서화 일관된 패턴 가이드` — "Convention" 단어 자체가 없음), `spec/conventions/audit-actions.md`(`# 감사 액션 명명 규약 (Conventions)`), `spec/conventions/cafe24-api-catalog/_overview.md`(`# CONVENTION: Cafe24 API Catalog — Overview`)
  - 위반 규약: 명시적으로 문서화된 규칙은 없음(`spec/conventions/` 자체의 제목 포맷을 규정하는 meta-convention 부재) — CLAUDE.md 의 "정식 규약은 `spec/conventions/<name>.md`" 항목이 암묵적으로 기대하는 "정식 규약 문서군은 일관된 형식을 갖춘다" 는 취지에 대한 사소한 이탈
  - 상세: 대문자 `CONVENTION:` 접두, 대소문자 혼용 `Convention:` 접두, 접두 없는 순수 한국어 제목, `(Conventions)` 괄호 접미 4가지 스타일이 공존. 기능적 영향은 없다(파서가 H1 텍스트를 읽지 않음 — frontmatter `id`/`status` 가 실질 식별자).
  - 제안: 우선순위 낮음. 후속 정리 시 `# CONVENTION: <Name>` 단일 포맷으로 통일 검토. 규약 갱신이 필요하면 이 표준을 `spec/conventions/` 최상위에 명문화(현재 flat reference·무-index 로 별도 진입 문서가 없음 — `spec-impl-evidence.md` R-7/§4.2 참고).

- **[INFO]** `## Overview` 섹션 유무 및 라벨이 문서마다 다르다
  - target 위치: `secret-store.md`(없음) · `swagger.md`(없음) · `audit-actions.md`(`## Overview`, 라벨 없음) · `spec-impl-evidence.md`(`## Overview (제품 정의)`) · `cafe24-api-catalog/_overview.md`(별도 섹션 없이 H1 자체에 "— Overview" 포함)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — **권장**(강제 아님)이라 명시된 항목
  - 상세: `spec-impl-evidence.md` 가 붙인 "(제품 정의)" 라벨은 CLAUDE.md 표의 "제품 정의·요구사항" 행 문구를 그대로 가져온 것인데, 이 문서는 제품 정의가 아니라 **기술 규약(frontmatter 스키마)** 문서라 라벨 의미가 정확히 들어맞지 않는다. 나머지 문서는 Overview 섹션 자체를 생략하고 도입부 산문 + `---` 구분선으로 대체 — 결과적으로 5개 문서가 5가지 방식을 쓴다.
  - 제안: 권장 사항이라 강제 조치 불요. 다만 "정식 규약" 문서군이 스스로 권장 구조를 예시하지 못하는 점은 후속 정리 후보로 기록.

## 확인했으나 위반 아님 (참고)

- `spec/conventions/cafe24-api-catalog/_overview.md` 등 `_` prefix 파일은 frontmatter(`id`/`status`) 가 없으나, 이는 `spec-impl-evidence.md` §1 의 명시적 제외 대상(`_*.md` — layout/index 성격)이라 규약 위반이 아니다.
- `spec/conventions/` 폴더 자체에 area-index 문서가 없는 것도 `spec-area-index.test.ts` 의 명시적 예외("flat reference, 무-index")로 문서화돼 있어 위반이 아니다.
- `secret-store.md` §1 의 URI 정규식(`^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$`)은 본문 예시 ref(`bot-token`, `bot-token.v2`, `inbound-signing` 등) 와 모두 일치 — 자기 정합적이다.

## 요약

전문이 제공된 5개 정식 규약 문서(`secret-store.md`·`spec-impl-evidence.md`·`swagger.md`·`audit-actions.md`·`cafe24-api-catalog/_overview.md`)는 frontmatter 스키마·제외 규칙·URI 형식 등 핵심 invariant 에서는 자기 정합적이며 CLAUDE.md 의 정보 저장 위치 규칙과도 충돌하지 않는다. 다만 `swagger.md` 는 최근(2026-08-17~08-23) 개정된 §3(summary/description 길이 강제)·§5(응답 DTO 필수)·§6(레거시 패턴 금지) 규칙이 더 오래된 §2 의 canonical 코드 예제에 소급 반영되지 않아, 문서가 스스로 금지한 패턴과 스스로 강제한 필드 요건을 자신의 "따라 쓰라"는 예제 안에서 위반하고 있다 — 개발자가 그대로 복붙할 위험이 있는 실질적 문서 결함이다. 그 외에는 제목 포맷·Overview 섹션 유무의 사소한 스타일 편차뿐이다. 컨텍스트 예산으로 생략된 267개 cafe24/makeshop field-level 카탈로그 문서는 이번 검토 범위 밖이며 별도 확인이 필요하다. 이번 브랜치는 `spec/conventions/` 를 변경하지 않았으므로 diff 기인 CRITICAL 은 없다.

## 위험도

LOW
