# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[WARNING]** `alert_rule` 엔티티 표가 `1-data-model.md` 의 확립된 엔티티 표 형식과 다르다
  - target 위치: draft `## ② alert_rule(V016) 이 데이터 모델 SoT 에 없다 → ### 처방` 의 컬럼 표 (`| 컬럼 | 타입·제약 |` 헤더, `id`~`created_at·updated_at` 행)
  - 위반 규약: `spec/conventions/**` 에 이 표 형식을 명시한 정식 규약 파일은 없다 (`spec-frontmatter-parse.ts`·`spec-link-integrity.test.ts` 등 어떤 가드도 `1-data-model.md` 표 내부 컬럼 스키마를 파싱·검증하지 않음 — 실측: `grep -rn "필드.*타입.*설명" codebase/frontend/src/lib/docs/__tests__/*.ts` 0건). 다만 `spec/1-data-model.md` 자체가 `### 2.1`~`### 2.24` **24개 엔티티 전부**에서 **예외 없이** `| 필드 | 타입 | 설명 |` 3컬럼 형식을 쓰고 있어(실측: `sed -n` 으로 User/Workspace/Trigger/Notification/AuditLog 등 확인), 이 문서 안에서는 사실상 강제 규약처럼 기능한다.
  - 상세: draft 가 제시한 표는 `UUID NOT NULL → workspace **CASCADE**`, `VARCHAR(32) CHECK ...`, `BOOLEAN NOT NULL DEFAULT true`, `TIMESTAMPTZ` 처럼 **원본 DDL 을 거의 그대로** 옮긴 2컬럼 표다. 기존 24개 엔티티는 모두 이렇게 쓰지 않는다:
    - FK 는 `설명` 칸에 `FK → Workspace (CASCADE)` 처럼 **PascalCase 엔티티 클래스명**으로 적는다(`workspace_id | UUID | FK → Workspace` — Trigger §2.8, Schedule §2.9 등). draft 는 소문자 테이블명(`workspace`, `user`)을 그대로 쓴다.
    - CHECK 제약 문자열 컬럼은 `타입=Enum`, 허용값은 `설명` 칸에 나열한다(Trigger.type: `Enum | webhook / schedule / manual`, Notification.channel: `Enum | in_app / email / both`). draft 는 `VARCHAR(32) CHECK failure_rate / duration / llm_cost` 로 raw SQL 을 그대로 옮겼다.
    - `BOOLEAN` → `Boolean`(예: `is_active | Boolean | 활성 상태`), `TIMESTAMPTZ` → `Timestamp`/`Timestamp?`(nullable), `created_at`/`updated_at` 은 항상 **별도 두 행**으로 적는다. draft 는 `created_at · updated_at` 를 한 행에 합쳤고, nullable 인 `last_triggered_at` 에 `?` 표기가 빠졌다.
    - 인덱스는 표 안이 아니라 표 아래 별도 `**인덱스**: ...` 단락으로 뺀다(IntegrationUsageLog §2.10.1, DocumentChunk §2.12.1 등). draft 는 인덱스를 별도 문장(`인덱스: (workspace_id) · (enabled) WHERE enabled = true`)으로 뒀지만 표 바로 뒤 프리텍스트일 뿐, 컬럼 목록에 딸린 것도 아니라 애매하다.
    - `설명` 칸(비즈니스 의미·관련 spec 링크)이 아예 없다 — 다른 23개 엔티티는 전부 이 칸을 채운다.
  - 제안: draft 의 표를 `필드 | 타입 | 설명` 3컬럼으로 다시 써서 developer 가 복붙해도 `1-data-model.md` 의 기존 패턴이 깨지지 않게 한다. raw DDL 은 참고용으로 남기고 싶다면 표 밑에 각주로 두는 편이 낫다.

- **[INFO]** 신설 섹션의 정확한 heading 번호가 draft 에 없다
  - target 위치: draft `## ② ... → ### 처방`: "`1-data-model.md` §2 에 엔티티 섹션 신설"
  - 위반 규약: 명시적 `spec/conventions/*.md` 는 없음 — `1-data-model.md` 자체 내부에 기록된 넘버링 원칙(§2.24 LlmUsageLog 항목의 "넘버링 주의" 주석, `1-data-model.md:833`)이 근거다: CASCADE 로 실제 소유하는 부모가 **NOT NULL** 인 쪽 기준으로 번호를 매기고, top-level 엔티티(Workspace)가 그 부모면 최상위 번호(`§2.N`)를 쓰지 nullable FK 대상(Workflow) 아래 하위번호로 넣지 않는다.
  - 상세: `alert_rule` 은 `workspace_id UUID NOT NULL ... CASCADE`(실제 소유 부모=Workspace) + `workflow_id UUID ... CASCADE`(nullable, 워크스페이스 전역 규칙 허용)다. LlmUsageLog(§2.24) 선례를 따르면 `alert_rule` 도 **top-level** 신규 번호(예: `§2.25`, 현재 최댓값 `§2.24` 다음)를 받아야 하고, `### 2.4.x`(Workflow 하위)로 잘못 배치되지 않아야 한다. draft 가 "§2 에 신설"이라고만 하고 정확한 번호·근거를 안 적어서, 구현자가 이 넘버링 원칙을 놓치고 Workflow 하위에 끼워 넣을 여지가 있다.
  - 제안: draft 또는 실제 반영 커밋에서 `### 2.25 AlertRule` 로 명시하고, `§2.24` Rationale 이 세운 넘버링 원칙(CASCADE 실소유 부모 기준)을 한 줄로 인용해 둔다.

- **[INFO]** "끊어진 링크" 서술이 실제 가드가 잡는 범위보다 강하다
  - target 위치: draft `## ② → ### 실측`: "**없는 절을 가리키는 링크**다. 단순 부재가 아니라 **끊어진 상호참조**"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 — `spec-link-integrity.test.ts` 는 `[..](path)` 의 **파일 타깃 존재** + (있는 경우) `#anchor` heading slug 를 검증한다.
  - 상세: `data-flow/9-observability.md:3` 의 링크는 `[데이터 모델 §2 (alert_rule V016)](../1-data-model.md)` — **`#anchor` fragment 가 없다**. 파일(`1-data-model.md`)은 실재하므로 이 링크는 `spec-link-integrity.test.ts` 기준으로는 **지금도 통과**한다(즉 build 를 깨는 "끊어진 링크"가 아니라, anchor 없이 파일 전체를 가리키는 **의미상 부정확한** 링크다). draft 의 처방(섹션 신설) 자체는 맞지만, "끊어진 상호참조"라는 표현은 이 저장소의 링크 가드가 실제로 잡아내는 것보다 강하게 들린다.
  - 제안: 섹션 신설과 함께 링크에 구체 anchor(`../1-data-model.md#225-alertrule` 등, 실제 slug 는 heading 확정 후 확인)를 붙이면 ① 서술이 정확해지고 ② 이후 `spec-link-integrity.test.ts` 의 anchor 검증이 이 상호참조를 실제로 보호하기 시작한다(현재는 anchor 가 없어 가드의 보호 범위 밖).

## 요약

이 draft 가 다루는 두 항목의 **판단(무엇을 고칠지)** 자체는 정식 규약과 충돌하지 않는다 — ① `5-system/1-auth.md` 의 "이메일 알림" 문구 제거는 순수 텍스트 삭제로 규약 위반 소지가 없고, `1-data-model.md`·`spec/data-flow/**` 는 `spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`/제외 목록에 따라 frontmatter lifecycle 의무 대상도 아니라서 그 경로로도 문제없다. 다만 ② 항목이 제시한 **`alert_rule` 신설 표의 구체적 형식**이 `1-data-model.md` 가 24개 엔티티 전부에서 예외 없이 지켜 온 `필드/타입/설명` 3컬럼 패턴(FK 는 엔티티 PascalCase 명, CHECK 제약은 Enum 표기, 인덱스는 표 밖 별도 줄)과 다르다 — 이 표는 developer 가 그대로 복붙할 공산이 크므로 반영 전에 정리해 두는 편이 안전하다. 이 표 형식은 어떤 `spec/conventions/*.md` 파일에도 성문화돼 있지 않고 자동 가드도 없어 CRITICAL 로 올리지는 않았다. 나머지 두 건(heading 번호 미지정, "끊어진 링크" 서술의 정밀도)은 실행에 지장은 없는 INFO 성 지적이다.

## 위험도
LOW
