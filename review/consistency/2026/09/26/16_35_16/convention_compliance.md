# 정식 규약 준수 검토 — assistant-e2e-contract-gaps (--impl-prep)

대상: `spec/3-workflow-editor/4-ai-assistant.md` (impl-prep 번들에 함께 묶인 `spec/5-system/2-api-convention.md` ·
`spec/conventions/swagger.md` 를 대조군으로 사용). 본 작업(`plan/in-progress/assistant-e2e-contract-gaps.md`)은
`spec_impact: none` — e2e 테스트 3칸만 추가하며 spec·제품 코드는 건드리지 않는다. 따라서 아래 발견사항은
**이번 diff 가 만든 위반이 아니라, 이번 작업이 참조한 context 문서에 이미 있던 기존 갭**이다. 어느 것도
`sessions/latest` · 테스트 F · 테스트 H 세 e2e 작업 자체를 막지 않는다(BLOCK 대상 아님) — 후속 spec 정비
항목으로 남긴다.

## 발견사항

- **[WARNING] §6 REST API 표에 구현된 `GET /sessions/latest` 가 없다**
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 "REST API (세션/메시지 관리)" 표(전체 5행) ·
    §Rationale "채팅 히스토리 서버 영속화 구성" 항목 2 "REST API 5개"
  - 위반 규약: CLAUDE.md 정보 저장 위치 표 — "기술 명세 → `spec/<영역>/*.md` 본문"(spec 이 구현 surface 의
    단일 진실). 실행 규약 상으로는 `spec/conventions/spec-impl-evidence.md` 의 취지("spec 가 약속한 surface
    와 구현 사이의 정적 증거")의 **거울상**(구현됐지만 spec 본문에 미등재)에 해당 — 다만 이 문서의 자동
    가드(frontmatter `code:` glob ≥1 매치)는 body 레벨 완전성을 보지 않으므로 **하드 게이트 위반은 아니다**.
  - 상세: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:88` 에
    `@Get('sessions/latest')` 가 실존하고 `ApiOkWrappedNullableResponse(AssistantSessionDto)` 로 swagger.md
    §5-2 관례를 정확히 따라 구현돼 있다(코드 자체는 규약 위반 없음). 그런데 `4-ai-assistant.md` §6 표는
    `GET/POST/PATCH/DELETE /sessions`, `GET /sessions/{id}` 5개만 나열하고 `sessions/latest` 가 빠져 있으며,
    §Rationale 도 "REST API 5개" 로 명시해 실제 6개와 어긋난다. 이번 작업의 `plan/in-progress/
    assistant-e2e-contract-gaps.md` "실측" 절이 이 엔드포인트의 동작(`findLatestActive`, 없으면
    `{ data: null }`)을 spec 이 아니라 **코드를 직접 읽어** 재구성한 것 자체가 이 갭의 실증이다.
  - 제안: 별도 spec 후속 PR(`project-planner`)에서 §6 표에 `GET /api/workflow-assistant/sessions/latest`
    행 추가 + §Rationale "REST API 5개" → "6개" 정정. 본 작업(`developer`, e2e-only)의 범위는 아니다.

- **[WARNING] §4.4 Shadow 검증 규칙 표에 실제 활성 에러코드 `PORT_NOT_FOUND` 가 없다**
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.4 "Shadow 검증 규칙" 표
  - 위반 규약: `spec/conventions/error-codes.md` §1(에러 코드는 의미로 카탈로그화되어야 클라이언트가 안전하게
    분기) 의 취지 — 같은 문서 안에서 에러 코드 카탈로그 역할을 하는 표가 실제 발행 코드를 누락하면 그 표를
    유일한 근거로 읽는 소비자가 존재를 놓친다.
  - 상세: §4.4 표는 `add_edge` 의 source/target 부재를 `NODE_NOT_FOUND` 로만 설명한다. 그러나 같은 문서
    §3.2("재시도 후 성공 축약"), §Rationale(라인 987: "`ShadowWorkflow.addEdge` 가 `portResolver` 로
    source/target **포트** 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로
    reject"), 라인 1492·1501·1503·1519·1531 이 `PORT_NOT_FOUND` 를 `NODE_NOT_FOUND` 와 나란한 독립
    shadow 에러코드로 반복 참조하며 `tool-call-badge.test.ts` 로 고정돼 있다고 명시한다. 즉 실제로는
    "노드 존재" 검증과 "포트 존재" 검증이 분리된 두 규칙인데, §4.4 는 후자를 규칙 행으로 올리지 않았다.
  - 제안: §4.4 표에 "`add_edge` 의 `source_port`/`target_port` 가 대상 노드의 유효 포트여야 함 →
    `{ok:false, error:'PORT_NOT_FOUND', portInfo:{knownPorts}}`" 행 추가.

- **[WARNING] §7 "(계획) 미구현 에러코드" 가 "두 코드" 라 명시하지만 §12.2 에 세 번째가 있다**
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §7 블록쿼트("다음 두 코드는 spec 이 정의했으나
    현재 코드에 없다") vs §12.2 "실행/디버깅" 두 번째 불릿
  - 위반 규약: 위와 동일한 취지(error-codes.md §1) — "spec 이 정의했으나 코드에 없는 에러코드" 목록은
    같은 문서 안에서 하나의 완전한 카탈로그로 수렴해야 한다.
  - 상세: §7 은 이 범주를 정확히 "① `ASSISTANT_LLM_CONFIG_INVALID` ② `ASSISTANT_STREAMING_UNSUPPORTED`"
    두 개로 못 박는다. 그런데 §12.2 는 "**(계획)** 실행 중 편집 도구를 shadow 단계에서
    `ASSISTANT_WORKFLOW_RUNNING` 에러로 거부하는 가드는 아직 미구현이다 — 현재 코드에는 해당 에러코드·
    차단 로직이 없다" 고 적어, 정의는 §7 의 "다음 두 코드는"과 동일한 술어("spec 정의 + 코드 부재")를
    만족하는 세 번째 사례를 제시한다. §7 의 "두 코드" 라는 전칭이 §12.2 시점에는 이미 거짓이다.
  - 제안: §7 블록쿼트에 `ASSISTANT_WORKFLOW_RUNNING` (§12.2 참조) 을 ③ 항목으로 추가하거나, "다음 두
    코드는" 문구를 "다음 코드들은" 으로 낮추고 §12.2 를 상호 참조.

## 준수 확인 (참고 — 위반 아님)

- 문서 구조: `## 1. 개요` 로 시작해 `## Rationale` 로 종결(라인 812) — 3섹션 권장 준수. Overview 는
  `_product-overview.md`(다중 spec 파일 영역) 로 위임돼 있어 CLAUDE.md/§project-planner SKILL 규칙과 일치.
- Frontmatter: `id: ai-assistant` — 파일 접두 숫자를 뺀 basename 관례(`spec-impl-evidence.md` §2.1) 준수.
  `status: implemented` + `code:` glob 이 실 파일에 매치(자동 가드 대상, 직접 위반 미발견).
- 에러 코드 표기: `ASSISTANT_*` 도메인 prefix + UPPER_SNAKE_CASE, `NODE_NOT_FOUND`/`LABEL_CONFLICT` 등
  공용 shadow 코드도 UPPER_SNAKE_CASE — `error-codes.md` §1 명명 규칙과 일치.
- Swagger/DTO: `workflow-assistant.controller.ts` 가 `ApiOkWrappedNullableResponse`·`ApiOkWrappedArrayResponse`·
  `FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole` 공용 헬퍼를 정확히 사용(swagger.md §5-2·§5-4). 응답 DTO
  (`AssistantSessionDto` 등)는 `dto/responses/*-response.dto.ts` 에 위치(§5-1), `UpdateAssistantSessionDto`
  는 top-level 요청 바디 접두 규칙(§1-7)을 따름.
- i18n: §13 표의 실제 사용자 노출 문자열(`연결선 추가`·`연결선 삭제` 등)은 글로서리 금지어("엣지"→"연결선")를
  올바르게 지켰다. 본문 §1·§2.3 의 "엣지"는 `i18n-userguide.md` Principle 6 범위(사용자 가이드 본문·UI
  노출 문자열)가 아닌 내부 기술 spec 산문의 도메인 용어라 위반 아님(같은 영역의 `2-edge.md` 파일명과 동일
  어휘 계열). i18n 키 표의 한국어 문자열은 해요체 일관(`~해요`/`~할게요`) — Principle 6 준수.
- URL 명명: `sessions/latest` 는 `api-convention.md` §2.2 에 명문화된 패턴은 아니나, 저장소 선례
  `/users/me`(리터럴 세그먼트가 동적 `:id` 라우트보다 먼저 선언)와 동형이라 관례 위반으로 보지 않음.

## 요약

이번 작업(e2e 테스트 3칸 추가, `spec_impact: none`)이 직접 만든 정식 규약 위반은 없다 — 대조에 사용한
`spec/conventions/swagger.md` · `error-codes.md` · `i18n-userguide.md` 의 핵심 축(명명·응답 wrapping·
DTO 배치·에러코드 표기·i18n parity)은 실제 코드와 spec 본문 모두에서 준수되고 있었다. 다만 impl-prep
번들을 정독하는 과정에서 `4-ai-assistant.md` 자체의 **기존** 문서 완전성 갭 세 건(§6 REST API 표의
`sessions/latest` 누락, §4.4 Shadow 규칙 표의 `PORT_NOT_FOUND` 누락, §7 "두 코드" 전칭이 §12.2 의 세
번째 사례로 반증됨)을 발견했다 — 모두 WARNING 등급이며 이번 e2e 작업의 착수를 막을 이유는 아니지만,
다음 spec 정비 시 `project-planner` 가 반영해야 할 항목이다.

## 위험도

LOW
