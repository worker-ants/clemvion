# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-spec-fact-orm-defaults.md`

## 검토 개요

target 은 `spec/0-overview.md`(ORM 명칭: Prisma → TypeORM 정정) · `spec/1-data-model.md`(DB 기본값 두 곳 보강)를 향한 순수 **사실 정정** draft 다. 신규 명명 규칙·API 응답 포맷·문서 신설이 없어 `spec/conventions/**` 표면과의 접점이 좁다. 아래는 접점이 있는 규약 각각을 대조한 결과다.

## 대조 결과

### 1. `spec/conventions/spec-impl-evidence.md` — frontmatter 의무 대상 여부
- §1 "제외" 목록: basename `0-overview.md`, `1-data-model.md` 는 frontmatter-evidence 가드 대상에서 명시적으로 제외된다.
- target 은 두 파일 모두 frontmatter(`id`/`status`/`code`)를 건드리지 않는다 — 규약과 정합. 위반 없음.

### 2. `spec/conventions/migrations.md` — Flyway 명명·append-only 원칙
- 인용된 `V088__model_config_rename_kind.sql`·`V019__workflow_assistant.sql` 는 실제 저장소에 존재하는 기존 파일이며(`ls codebase/backend/migrations/` 확인), draft 는 이 파일들을 **수정하지 않고** spec 문서에 이미 있는 DEFAULT 값을 설명 칸에 옮겨 적을 뿐이다. §3 append-only 원칙에 저촉되지 않는다.

### 3. 문서 구조·표기 관례 (내부 precedent, `spec/conventions` 외부지만 인접)
- §2.16 `kind`(1-data-model.md:643)·§2.20 `last_interaction_at`(1-data-model.md:802) 앵커가 draft 가 지목한 위치와 정확히 일치한다.
- `default=\`값\`` 표기는 같은 문서 §2.19 `notification_health`/`chat_channel_health`(1-data-model.md:255, 259)에 이미 쓰인 패턴이며, draft 의 `default=\`chat\`(V088)` / `default=\`now()\`` 는 이를 그대로 따른다 — 신규 표기 창안이 아니다.
- 정정 블록 `> **정정 (2026-09-19)**: ...` 형식은 `spec/conventions/spec-impl-evidence.md` R-1(`> **정정 (2026-09-06)**: ...`)·`review-citations.md` Rationale(같은 형식)에 이미 쓰인 precedent 를 재사용한다.

### 4. API 문서·출력 포맷·금지 항목 (관점 2·4·5)
- target 변경은 API 응답 스키마, 이벤트 페이로드, 에러 코드, OpenAPI 데코레이터/DTO 명명과 무관하다 — 해당 관점에서 검토할 표면 자체가 없다.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

- **[INFO]** "정정 (YYYY-MM-DD)" 블록 표기는 아직 정식 규약 문서화가 안 된 반복 precedent
  - target 위치: `## 변경 A` 절 끝의 정정 블록 지시문
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` R-1(정정 표기 최초 사례), `spec/conventions/review-citations.md`(같은 패턴 재사용)
  - 상세: 두 문서가 독립적으로 같은 "취소선 대신 절 끝 정정 블록" 패턴을 쓰고 있는데, 이 표기 자체를 규정하는 전용 conventions 문서는 없다. 지금은 CLAUDE.md §자기-반증형 소정정 조건 4("원문은 취소선으로 남기고")와 살짝 다른 변형(취소선 없이 정정 블록만 추가)이라, 두 표기가 언제 갈리는지 판단 기준이 산문으로 흩어져 있다.
  - 제안: 위반은 아니므로 이번 draft 를 막을 사유는 아니다. 다만 이 패턴이 세 번째로 반복되면(`audit-actions.md` 의 시제 taxonomy 통합 사례처럼) 별도 conventions 화를 고려할 만하다 — 지금은 정보성 제안일 뿐.

## 요약

target 은 명명·출력 포맷·문서 구조·API 데코레이터 규약 어디에도 새 표면을 만들지 않는 좁은 사실 정정이며, 인용한 파일 경로(migrations)·앵커(§2.16/§2.20)·표기 패턴(`default=\`…\``, 정정 블록)이 모두 기존 spec/conventions 및 문서 내 precedent 와 정확히 일치한다. frontmatter 의무 대상 판정(spec-impl-evidence.md §1 제외 목록)도 올바르게 반영됐다. 정식 규약 준수 관점에서 차단 사유가 없다.

## 위험도

NONE
