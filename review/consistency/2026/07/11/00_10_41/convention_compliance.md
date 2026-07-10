# 정식 규약 준수 검토 — llm-usage 인접 문서 정합 draft (A1/A3)

대상: `plan/in-progress/spec-llm-usage-adjacent-docs.md` (draft, 미적용). 실제 target 파일:
`spec/data-flow/6-knowledge-base.md:348` · `spec/data-flow/13-agent-memory.md:231` (A1),
`spec/1-data-model.md` §2.16 직후 신설 예정 §2.16.1 (A3).

## 발견사항

- **[WARNING]** A3 크로스 문서 링크에 디렉터리 prefix 누락 위험 — build 차단 게이트 대상
  - target 위치: 플랜 "변경 세트 (draft) → A3" 단락 — "전체 컬럼/인덱스 표는 중복하지 않고
    `7-llm-usage.md §2.1(스키마)·§1.3(Caller 카탈로그)` 로 포인터"
  - 위반 규약: `spec/1-data-model.md` 자신의 기존 크로스-data-flow 링크 관례 (예: L404
    `[\`spec/data-flow/6-knowledge-base.md §2.3\`](./data-flow/6-knowledge-base.md)`, L724/L728/L876의
    `[data-flow/8-notifications.md ...](./data-flow/8-notifications.md#...)`) + build-blocking 가드
    `spec-link-integrity.test.ts` (`spec/conventions/spec-impl-evidence.md` §4.2 — "`spec/**.md` 본문
    in-repo `[..](path)` 타깃 존재 대조", `spec/data-flow/**` 도 이 가드 적용 대상이라고 명시).
  - 상세: `1-data-model.md` 는 `spec/` 루트, `7-llm-usage.md` 는 `spec/data-flow/` 하위라 상대경로는
    반드시 `./data-flow/7-llm-usage.md` 여야 한다. 플랜 프로즈가 (KB/AgentMemory 문서 내부에서 쓰는)
    동일-디렉터리 스타일 `./7-llm-usage.md` 를 그대로 1-data-model.md 에 옮기면 404 링크가 되고,
    빌드 차단 가드에 걸린다. A1 쪽(`6-knowledge-base.md`/`13-agent-memory.md` → `7-llm-usage.md`)은
    같은 `data-flow/` 디렉터리라 `./7-llm-usage.md` 그대로 맞음 — A3 쪽만 위험.
  - 제안: §2.16.1 실제 작성 시 링크를 `[\`spec/data-flow/7-llm-usage.md §2.1\`](./data-flow/7-llm-usage.md)`
    형식(L404 패턴과 동일)으로 명시. 가능하면 §2.10.1/§2.12.1/§2.21.1 이 여는 `> 관련 문서: [...]`
    블록쿼트 오프너 관례를 그대로 따라 링크를 본문 산문에 묻지 말고 섹션 최상단에 노출시킬 것.

- **[INFO]** lean 포인터 서브섹션의 "부분 필드 열거" 스타일 — 기존 두 패턴 사이의 제3 변형
  - target 위치: A3 변경 세트 — "핵심만: `workspace_id` 항상 채움 + nullable attribution FK(...) +
    `llm_config_id` + 토큰/비용"
  - 위반 규약: 직접적 위반은 아님(§2.16.1 관련 서브섹션 표 형식을 강제하는 명시 규약은
    `spec/conventions/**` 에 없음). 다만 `1-data-model.md` 자체 관례는 두 갈래로만 존재 — (a) SoT 가
    1-data-model.md 자신인 로그/자식 엔티티는 **전체** 필드 표(§2.10.1 IntegrationUsageLog,
    §2.12.1 DocumentChunk, §2.13.1 ExecutionNodeLog, §2.18.1/2.18.2, §2.21.1 SecretStore), (b) SoT 가
    타 문서(5-system/data-flow)인 엔티티는 **표 자체를 생략**하고 순수 산문 + SoT 링크만
    (§2.23 AgentMemory → `5-system/17-agent-memory.md`, 필드 나열 0개).
  - 상세: A3 는 llm_usage_log 의 SoT 가 `7-llm-usage.md §2.1` 이라고(=(b) 패턴 대상) 명시하면서도
    실제로는 컬럼 일부(workspace_id/workflow_id/execution_id/node_execution_id/llm_config_id/토큰·비용)를
    산문으로 나열하는 절충안을 취한다 — (a)도 (b)도 아닌 새 변형. `provider`/`model`/`id`(PK) 등은
    빠짐. 규약 위반은 아니지만 "부분 나열인지 전체인지" 독자가 오인할 소지가 있다.
  - 제안: (b) AgentMemory 패턴을 그대로 따라 필드 나열을 생략하고 순수 산문 + SoT 링크로 가장 lean 하게
    가거나, 나열을 유지한다면 "비전체 목록 — 전체 스키마는 §2.1" 같은 명시적 캡션을 붙여 완전성
    오인을 차단할 것.

- **[INFO]** §2.16.1 배치가 암시하는 소유 관계와 실제 FK cascade 불일치
  - target 위치: A3 — "§2.16 ModelConfig 직후(§2.17 앞)에 `### 2.16.1 LlmUsageLog` 삽입"
  - 위반 규약: 직접 위반 아님. `1-data-model.md` 다수 선례(§2.10.1 IntegrationUsageLog.integration_id
    `FK → Integration (CASCADE)`, §2.12.1 DocumentChunk.document_id `FK → Document (CASCADE)`)에서는
    "N.M.1" 배치가 실제 CASCADE 소유 부모 = N.M 을 의미하지만, `llm_usage_log.llm_config_id` 는
    (`codebase/backend/migrations/V014__llm_usage_logs.sql:10`) `REFERENCES llm_config(id)
    ON DELETE SET NULL` — nullable/SET NULL 이고, 실질 CASCADE 소유 부모는 `workspace_id UUID NOT NULL
    REFERENCES workspace(id) ON DELETE CASCADE` (동 파일 L6), 즉 Workspace 다. (단 §2.18.1/2.18.2
    RefreshToken/LoginHistory → AuditLog, §2.21.1 SecretStore → WebAuthnCredential 도 FK-무관 thematic
    배치 선례라 "N.M.1 = 반드시 FK CASCADE 자식" 이 절대 규칙은 아님.)
  - 상세: 다수 선례가 CASCADE 부모-자식이라, §2.16.1 도 그렇게 읽힐 여지가 있다. ERD 트리 쪽은 플랜이
    이미 Workspace 서브트리에 (IntegrationUsageLog 옆) 배치하기로 해 이 부분은 정확 — 산문 서브섹션
    소개 문장에서도 동일하게 명시해 두는 편이 안전하다.
  - 제안: §2.16.1 도입부에 "CASCADE 소유 부모는 Workspace, `llm_config_id` 는 nullable 참조(SET NULL)"
    를 한 문장으로 명시.

- 검토 결과 **위반 없음으로 확인**된 항목 (임무 1~4 대응, 기록용):
  - §2.16.1 헤딩 레벨(`###`, h3) — AuthConfig 의 §2.17.1~.3(`####`, h4, 동일 엔티티 내부 설명용)과
    구분되는 "별도 테이블" 전용 레벨과 일치. `llm_usage_log` 는 자체 PK/마이그레이션(V014)을 가진
    별도 테이블이므로 h3 가 맞음.
  - 제목 표기 `LlmUsageLog` (CamelCase) — IntegrationUsageLog/DocumentChunk/ExecutionNodeLog 등과
    동일한 엔티티명 표기 관례.
  - A1 테이블 셀 포맷 — `| LLM Usage | cross-ref | ... — [\`llm-usage.md\`](./7-llm-usage.md) §1.3 |`
    구조(백틱 파일명 링크 + 링크 밖 `§N.N` 접미)는 리포 전역 관례와 일치
    (`spec/data-flow/14-chat-channel.md:167,248` 등에서 동일 패턴 확인). 두 target 라인(6-knowledge-base.md:348,
    13-agent-memory.md:231) 모두 플랜이 기술한 before 텍스트와 실제 파일 내용이 정확히 일치.
  - A1 은 `data-flow/` 동일 디렉터리 내 링크라 `./7-llm-usage.md` 상대경로 그대로 유효 — 앵커/경로
    깨짐 없음.
  - §2.16.1 삽입은 순번 기반 헤딩(§2.17 이하)을 밀어내지 않으므로(하위번호 삽입) 기존
    `#217-authconfig` 등 내부 링크에 영향 없음. 새 앵커 `#2161-llmusagelog` 는 grep 결과 기존 참조가
    전무해 충돌 없음.
  - SoT 중복 금지 원칙 위반 여부(임무 3): `spec/conventions/**` 전체를 확인했으나 "§2.16.1 에 전체
    표를 넣으라"는 규약은 존재하지 않음. 오히려 CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 표 +
    §2.23 AgentMemory 선례가 타 문서 SoT 포인터화를 뒷받침 — lean 방향 자체는 정합.
  - frontmatter 영향 없음: `spec/conventions/spec-impl-evidence.md` §1 이 `1-data-model.md` 를
    `EXCLUDE_BASENAMES`(frontmatter-evidence 면제)로 명시하고, `spec/data-flow/**` 파일들은애초
    frontmatter 자체가 없는 영역이라(§1) A1/A3 모두 frontmatter `code:` 갱신 불요.
  - A1 대상 stale 문구("모든 LLM 호출은 `llm_usage_log` 적재")의 전체 스코프 재확인: repo 전체 grep 결과
    해당 문구는 지목된 두 라인 외에는 없음 — 플랜의 "genuine 범위 = A1(2건)" 결론과 일치, 누락 없음.

## 요약

draft 가 제안한 A1(두 cross-ref 행 정정)·A3(§2.16.1 lean 서브섹션 + ERD 트리 1줄)는 명명·헤딩 레벨·
테이블 셀 포맷·앵커 무결성·frontmatter 대상 여부 등 핵심 정식 규약 관점에서 전반적으로 기존
`1-data-model.md`/`data-flow/**` 관례와 정합한다. 유일하게 실무적으로 주의가 필요한 지점은 A3 의
`7-llm-usage.md` 크로스 링크를 실제 작성할 때 `1-data-model.md` 가 위치한 `spec/` 루트 기준
`./data-flow/` 디렉터리 prefix 를 빠뜨리면 build-blocking `spec-link-integrity` 가드에 걸린다는
점이며(WARNING), 나머지는 서식 일관성 제안 수준(INFO)이다. Critical 급 규약 위반은 없다.

## 위험도

LOW
