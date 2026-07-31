# 정식 규약 준수 검토 — `spec/data-flow/` (--impl-done, workflow-duplicate-nodes-edges)

## 검토 범위 확정

`git diff origin/main..HEAD --stat` 로 실 변경분을 확인한 결과, `spec/data-flow/` 안에서 이번 라운드에
실제로 수정된 파일은 `spec/data-flow/11-workflow.md` 1개뿐이다(§1.5 표 행 정정, §2.1 Postgres 표에
`workflow`/`node`/`edge` "복제 (§1.5)" 행 3개 추가, `## Rationale` 신규 절 3개). 같은 plan
(`plan/in-progress/workflow-duplicate-nodes-edges.md`)이 함께 건드리는 `spec/2-navigation/1-workflow-list.md`
도 동일 계약을 서술하므로 함께 대조했다. 나머지 `spec/data-flow/*.md` 14개(프롬프트 예산 초과로 7개
생략 고지)는 diff 밖 — 순수 컨텍스트로만 참고했다.

이번은 **--impl-done** 라운드이므로, 동일 target 에 대한 직전 두 라운드
(`review/consistency/2026/07/30/16_45_59/convention_compliance.md` --spec,
`review/consistency/2026/07/30/17_03_26/convention_compliance.md` --impl-prep)가 남긴 지적사항이
실제로 반영됐는지, 그리고 **완료된 코드**(`workflows.service.ts`/`workflows.controller.ts`)가 spec 이
서술하는 output 포맷·swagger 패턴과 일치하는지를 절대경로로 직접 열어 재검증하는 데 집중했다. prompt에
포함되지 않은 관련 conventions(`error-codes.md`/`swagger.md`/`migrations.md`/`spec-impl-evidence.md`)도
저장소에서 직접 Read 했다.

## 발견사항

CRITICAL/WARNING/INFO 없음.

직전 라운드가 남긴 지적 3건은 모두 이번 impl-done 시점 기준으로 해소를 확인했다:

1. **(WARNING, 17:03:26 라운드)** `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:`
   에 `workflow-duplicate-nodes-edges.md` 미등재 — 현재 frontmatter(라인 11-13)에
   `plan/in-progress/workflow-duplicate-nodes-edges.md` 가 추가되어 있음을 직접 확인. 해소.
2. **(INFO, 17:03:26 라운드)** "§7 Rationale" 절 번호 오기(R-2.2 를 가리켜야 함) — 현재
   `11-workflow.md:252, 277` 모두 "[워크플로우 실행 §2.2 / R-2.2]" 로 정정되어 있고, 대상 헤딩
   `spec/3-workflow-editor/3-execution.md:747` `### R-2.2 테스트 데이터셋 저장 — 권한·소유 모델
   (2026-06-14)` 및 그 상위 `### 2.2 기능`(라인 85) 과 정확히 일치. 해소.
3. **(INFO, 17:03:26 라운드)** "기각한 대안" 2건 중 1건만 명시적 라벨 — 현재
   `11-workflow.md:257` 에 "기각한 대안 — **spec 을 코드에 맞춰 "메타만 복제" 로 하향 확정**: …"
   형식으로 두 번째 대안도 명시 라벨이 붙어 있음. 해소.
4. **(INFO, 16:45:59 라운드)** Swagger `@ApiOperation.description` 이 node/edge 복사를 언급하지
   않음 — 현재 `workflows.controller.ts:214-216` 의 description 이 "**노드·엣지를 포함한 캔버스
   전체**를 한 트랜잭션으로 함께 복사합니다 — 노드는 새 UUID 로 재발급되고 …" 로 갱신되어
   `swagger.md §3`("무엇을 하는지 + 제약/부수효과") 및 spec 서술과 정확히 합치. 응답도
   `@ApiCreatedWrappedResponse(WorkflowDto, …)` 로 `swagger.md §5-2` 공용 래퍼 헬퍼를 사용 —
   "빈 껍데기 schema" 레거시 패턴(§6) 아님. 해소.

이번 라운드에서 새로 검증해 위반이 없음을 확인한 항목:

- **명명 규약**: 신설 텍스트가 쓰는 식별자(`container_id`/`tool_owner_id`/`llmConfigId`/
  `current_version`/`workflow_version`/`workflow_test_dataset`)는 전부 `spec/1-data-model.md`
  (라인 122, 159-169) 의 기존 표기와 정확히 일치. DB 컬럼 snake_case ↔ JSONB/API 필드 camelCase
  구분도 기존 관례 그대로.
- **에러 코드 명명**(`error-codes.md §1`): 언급된 코드(`GRAPH_VALIDATION_FAILED`,
  `INVALID_TRIGGER_PARAMETERS`, `CONTAINER_INVALID_CHILD`, `CONTAINER_CYCLE`,
  `DUPLICATE_NODE_LABEL`, `INVALID_VERSION_SNAPSHOT`)는 전부 기존 코드 재인용, `UPPER_SNAKE_CASE`
  준수, 신규 코드 도입 없음(§2 rename 안정성 정책 저촉 없음).
- **migrations.md**: 신규 컬럼/테이블 없음 — `node`/`edge` 테이블 재사용 확인
  (`git diff --stat -- codebase/backend/migrations/` 결과 0건).
- **spec-impl-evidence.md §1 제외 목록**: `spec/data-flow/**` 는 frontmatter(`id`/`status`/`code`)
  의무 대상이 아님을 본문(§1 각주)에서 재확인 — `11-workflow.md` 가 frontmatter 없이 유지되는
  것은 정상.
- **문서 구조(3섹션)**: `## Overview` → `### System role` / 1~4 본문 / `## Rationale` 구조가
  `0-overview.md §3` 자체 정의 "5요소"(System role·Source→Sink·Schema 매핑·상태 전이·외부 의존)와
  일치하며 diff 로 훼손되지 않음. 신설 Rationale 소제목 3개도 기존 소제목 패턴(`### <제목>`)과
  형식 일치.
- **Rationale 근거의 사실성**: Rationale 이 인용하는 커밋 `db496a3c2`("spec↔code 전수 상호 감사 —
  … data-flow 재구성")·`8ff4e8564`("phase 1·stage 3 — NestJS 모듈/엔티티/마이그레이션 초기 골격")를
  `git log` 로 직접 조회해 실존과 설명 내용이 일치함을 확인 — 지어낸 이력 아님.
  `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`) 요구사항 ID 도 실존.
- **Cross-reference anchor**: `#r-22-테스트-데이터셋-저장--권한소유-모델-2026-06-14` 앵커는
  `spec/1-data-model.md:522` 에 이미 동일 형태로 쓰이고 있어 slug 형식이 기존에 검증된 패턴 재사용임을
  확인(신규 slug 계산 리스크 없음).
- **코드-spec 값 일치**: `Workflow` 엔티티(`workflow.entity.ts:48`)의 `@Column({ name:
  'current_version', default: 1 })` 이 spec 의 "사본은 `current_version=1` 로 새로 시작" 서술과
  정확히 일치. `duplicate()` 구현이 `applyConfigDefaults`/기본 LLM 주입을 호출하지 않는 것도 spec
  의 "AI 노드 llmConfigId 는 원본 값을 그대로 유지" 서술과 일치.
- **금지 항목**: 신규 audit 액션 인라인 문자열, config/output 중복 echo, 열린 union 남용 등
  `spec/conventions/*.md` 가 명시 금지하는 패턴에 해당하는 신규 서술 없음.

## 요약

이번 impl-done 라운드에서 실제로 갱신된 `spec/data-flow/11-workflow.md`(및 동일 plan 이 함께 다루는
`spec/2-navigation/1-workflow-list.md`)는 직전 두 라운드(--spec, --impl-prep)가 남긴 WARNING 1건·INFO
3건을 모두 해소한 상태로 확인됐다 — `pending_plans` 등재, Rationale 절 번호 정정, "기각한 대안" 라벨
명시, Swagger description 및 응답 래퍼 갱신까지 전부 반영되어 있다. 완료된 코드(`workflows.service.ts`
`duplicate()`, `workflows.controller.ts`)를 직접 열어 대조한 결과 명명 규약(DB 컬럼/JSONB 필드
표기)·에러 코드(UPPER_SNAKE_CASE)·swagger 데코레이터·DTO 응답 래퍼 패턴·마이그레이션 정책 어디에서도
`spec/conventions/**` 저촉 지점이 없었고, Rationale 이 인용하는 커밋 해시·요구사항 ID·상호 anchor 도
모두 실존을 확인했다. 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 전혀 도입하지 않아
`naming_collision`/`plan_coherence` 두 자매 체커의 이번 라운드 NONE 결론과도 합치한다.

## 위험도

NONE
