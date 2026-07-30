# 정식 규약 준수 검토 — `spec/data-flow/` (--impl-prep, workflow-duplicate-nodes-edges)

## 검토 범위 확정

prompt 에 첨부된 "정식 규약 모음"은 `spec/conventions/audit-actions.md` 와
`spec/conventions/cafe24-api-catalog/**` 일부에서 끊겨 있었고(258개 파일 생략 고지), target 도메인과
직접 관련된 `swagger.md`/`error-codes.md`/`migrations.md`/`spec-impl-evidence.md` 는 모두 생략분에
포함돼 있었다. 이를 보완하기 위해 저장소의 해당 파일을 직접 Read 로 열어 대조했다.

`git diff origin/main...HEAD --stat` 로 실제 변경분을 확인한 결과, `Target 문서 경로: spec/data-flow/`
로 선언된 이번 라운드에서도 실질적으로 수정된 파일은 `spec/data-flow/11-workflow.md` 1개와, 같은
plan(`plan/in-progress/workflow-duplicate-nodes-edges.md`)이 함께 건드리는 연동 파일
`spec/2-navigation/1-workflow-list.md` 뿐이다(스코프 선언 밖이지만 동일 diff·동일 plan 소속이라 함께
대조했다 — 이번 라운드 `naming_collision.md` 도 동일하게 범위를 확정함). prompt 예산상 생략된
`spec/data-flow/{3,4,5,6,7,8,9}.md` 는 diff 에 전혀 등장하지 않아(위 `--stat` 확인) 생략이 이번 판정에
영향을 주지 않는다. 코드 측도 `codebase/backend/src/modules/workflows/workflows.service.ts` 의
`duplicate()`(라인 216-233)를 직접 Read 해 "아직 메타 row 만 INSERT"임을 실측했다.

직전 라운드(`review/consistency/2026/07/30/16_45_59/convention_compliance.md`, `--spec` 모드)가 남긴
INFO 2건(§1.3 표 행 정밀화, Swagger description 갱신 체크리스트 누락)은 이번 반영분에서 모두
해소·계획됨을 확인했다(§1.3 → `workflow`/`node`/`edge` 세 테이블 모두 "복제" 행 대칭 반영 완료;
swagger → 구현 체크리스트에 항목 명시적으로 추가, 코드 반영은 impl 단계로 정상 이연).

## 발견사항

- **[WARNING]** `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 가 이번 diff 로
  새로 명문화된 미구현 약속의 책임 plan 을 누락
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter (라인 2-13) —
    `status: partial`, `pending_plans: [plan/in-progress/marketplace-and-plugin-sdk.md]` 뿐
  - 위반 규약: [`spec/conventions/spec-impl-evidence.md §2.1`](../../../../../spec/conventions/spec-impl-evidence.md)
    — `pending_plans` 필드는 `status: partial` 시 "✓ 의무", 의미는 "미구현 surface 를 책임지는 plan
    경로"(§3 lifecycle 표에도 동일 의무 표기)
  - 상세: 이번 diff 가 §2.6 더보기 메뉴·§3 API 표에 새로 못박은 계약 — "복제 = 노드·엣지 포함 캔버스
    전체 복사"(`spec/data-flow/11-workflow.md §1.5` 와 동일 서술) — 는 **현재 코드에 구현돼 있지
    않다**. `codebase/backend/src/modules/workflows/workflows.service.ts:216-233` 의 `duplicate()`
    를 직접 확인한 결과 여전히 `workflow` 메타 row 만 `INSERT`하고 `node`/`edge` 는 전혀 건드리지
    않는다(이 diff 로 변경된 바 없음 — plan 의 구현 체크리스트도 전부 미체크). 이 gap 을 닫을 책임
    plan 은 바로 이 문서 diff 를 만든 `plan/in-progress/workflow-duplicate-nodes-edges.md` 인데,
    frontmatter `pending_plans:` 목록에는 등재돼 있지 않다 — 남아 있는 유일한 항목
    `marketplace-and-plugin-sdk.md` 는 전혀 다른 미구현 표면(§2.7 "마켓플레이스 템플릿 추천 링크")을
    책임진다. `spec/` 전체를 `grep -rn workflow-duplicate-nodes-edges` 한 결과 0건 — 어떤 spec
    frontmatter 도 이 plan 을 역참조하지 않는다. (참고: `spec/data-flow/11-workflow.md` 자신은
    `spec-impl-evidence.md §1` 의 명시적 제외 대상 — basename 이 아니라 경로
    `spec/data-flow/**` 통째로 frontmatter 의무 밖 — 이라 이 의무는 `1-workflow-list.md` 에만
    해당한다.)
  - 파급: `spec-pending-plan-existence.test.ts` 는 리스트에 있는 경로의 **실존 여부**만 검증하므로
    이 "빠짐" 자체는 build 를 깨지 않는다. 그러나 `spec-status-lifecycle.test.ts (c)` 는 "`partial`
    의 `pending_plans` 가 모두 `complete/` 로 이동했는데 status 가 안 올라가면 build fail" 규칙으로
    **등재된 목록만** 기준 삼는다 — `marketplace-and-plugin-sdk.md` 가 먼저 완료돼 `plan/complete/`
    로 옮겨지면, `workflow-duplicate-nodes-edges.md` 가 여전히 진행 중이어도 이 문서를
    `implemented` 로 승격하라는 build 압력이 걸릴 수 있다. `spec-impl-evidence.md §R-5` 가 명시한
    "역방향 링크 없어 영구 누락" 위험(텔레그램 chat-channel 선례)과 같은 계열의 gap 이다.
  - 제안: `1-workflow-list.md` frontmatter `pending_plans:` 에
    `plan/in-progress/workflow-duplicate-nodes-edges.md` 를 추가. plan 이 `plan/complete/` 로
    이동하면 경로도 함께 갱신.

- **[INFO]** 신규 Rationale 인용 "워크플로우 에디터 §7 Rationale" 이 실제로는 §2.2(R-2.2) 를 가리켜야
  함 — 섹션 번호 오기
  - target 위치: `spec/data-flow/11-workflow.md` §Rationale "duplicate 는 캔버스 전체를 복제한다"
    문단, 라인 252
  - 관련 규약: `spec/conventions/**` 에 인용 형식을 직접 규정한 항목은 없음 — 엄밀히는
    rationale-continuity 검토 영역과 겹치는 경계 사안이나, CLAUDE.md 관점 3 "문서 구조 규약"(Rationale
    이 SoT 여야 한다는 원칙)의 인용 신뢰성 측면에서 함께 보고
  - 상세: "(보조 정황으로 [워크플로우 에디터 §7 Rationale](../3-workflow-editor/3-execution.md) 이
    테스트 데이터셋 clone 을 설계하며 duplicate 를 선례로 인용하지만…)" 라고 쓰여 있으나,
    `3-workflow-editor/3-execution.md` 의 `## 7. 실행 히스토리 (인-에디터)`(라인 250) 와 그 Rationale
    `### R-7 인-에디터 실행 히스토리 — frontend-only`(라인 727)에는 duplicate·clone 언급이 전혀 없다.
    실제로 "타 구성원은 clone 으로 수정 … (workflows 의 duplicate 선례와 동일한 '복제 후 자기 소유'
    패턴.)" 문장은 `## 2. Mock Input` 하위 `### R-2.2 테스트 데이터셋 저장 — 권한·소유 모델`(라인
    747-756, 특히 753)에 있다. 같은 문단의 다른 인용들 — `[워크플로우 목록 §2.6]`(앵커
    `#26-더보기-메뉴-액션`, 실측 검증됨) · 바로 다음 문단의 `[워크플로우 에디터 §2.2]`(라인 274, 이건
    맞는 절 번호) — 은 정확한데 이 인용만 절 번호가 어긋나 있다.
  - 제안: "§7 Rationale" → "§2.2 (R-2.2)" 로 정정.

- **[INFO]** plan 이 선언한 "기각한 대안 2건 이관 완료"와 실제 spec 반영 사이 완전성 격차
  - target 위치: `spec/data-flow/11-workflow.md` §Rationale "복제가 버전 이력·트리거·데이터셋을
    승계하지 않는 이유" 절, 라인 266-278
  - 관련 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
    / `.claude/skills/project-planner/SKILL.md` "## Rationale = 결정 배경·근거·**폐기된 대안**"
  - 상세: `plan/in-progress/workflow-duplicate-nodes-edges.md` §1.4 와 하단 `## Rationale` 은 "기각한
    대안 2건(Manual Trigger 자동생성 / spec 하향 확정)"을 spec 으로 전량 이관했다고 명시한다
    (`grep 기각` 결과 plan 에는 이 표현이 2곳에 등장). 그런데 실제 `11-workflow.md` 에는 "기각한 대안
    — **복제본에도 Manual Trigger 를 자동 생성** …"(라인 276) 1건만 그 라벨로 명시돼 있고, "spec
    하향 확정" 기각은 별도 "기각한 대안" 표기 없이 "철회" 절 말미 한 문장("두 서술이 충돌할 때 사용자
    가치를 기술한 쪽이 이기므로, spec 을 코드에 맞추는 대신 코드를 고치고 §1.5 를 정정했다", 라인
    254-255)으로 축약돼 있다. 내용 자체는 실질적으로 존재하지만, plan 이 자기 완료 선언에서 약속한
    형식(명시적 "기각한 대안" 라벨 + "정합성 악화" 근거)과는 비대칭이다 — 직전 라운드
    `rationale_continuity` 가 "§1.4 지시문이 기각한 대안 이관을 명시하지 않는다"고 지적했던 위험이
    부분적으로 재현된 형태다.
  - 제안: 두 번째 기각 대안도 "기각한 대안 — **spec 을 코드에 맞춰 하향 확정**: …" 형식으로 명시하면
    plan 의 "이관 완료" 선언과 spec 실물이 정확히 대칭된다. 필수는 아님(내용은 이미 존재).

## 검증해 확인한 사항 (참고 — 위반 아님)

- **Swagger/DTO 규약**: 이번 diff 는 신규 엔드포인트·DTO·응답 스키마를 도입하지 않는다(기존
  `POST /:id/duplicate` 의 부수효과 서술 정정뿐). `swagger.md` §1~§5 의 어떤 조항도 저촉 지점이 없다.
  실제 `@ApiOperation.description` 갱신은 코드 변경 사안으로 plan 구현 체크리스트에 명시적으로
  등재돼 있어 impl-prep 단계에서는 정상.
- **error-codes.md**: `DUPLICATE_NODE_LABEL` 등 언급된 코드는 전부 기존 코드 재인용이며 신규 코드
  도입 없음 — §1 의미 기반 명명·§2 rename 정책 저촉 없음.
- **migrations.md**: 신규 컬럼/테이블 없음(기존 `node`/`edge` 재사용) — 해당 없음.
- **spec-impl-evidence.md §1 제외 목록**: `spec/data-flow/**` 는 frontmatter 의무 자체가 없음을
  본문에서 재확인 — `11-workflow.md` 프론트매터 부재는 정상.
- **spec-link-integrity 앵커**: 신규/변경 앵커
  `../data-flow/11-workflow.md#15-복제--내보내기--가져오기` (양쪽 파일에서 재사용)는 대상 헤딩
  `### 1.5 복제 · 내보내기 · 가져오기` 와 github-slugger 규칙상 정확히 일치 — 직전 라운드 검증을
  재확인.
- **명명 규약**: `container_id`/`tool_owner_id`(DB 컬럼, snake_case) vs `llmConfigId`(JSONB 필드,
  camelCase) 표기가 `1-data-model.md` 기존 표기와 일치. 신규 식별자(엔티티/엔드포인트/이벤트/env
  var) 도입 없음 — 이번 라운드 `naming_collision.md` 결론과 합치.
- **문서 구조**: `Overview`/본문/`Rationale` 3섹션 구조 유지. 신설 Rationale 소제목들이 기존 소제목
  (`### 노드 배치 두 축의 mutual exclusion` 등)과 형식 일치.

## 요약

이번 라운드에서 실제로 갱신된 두 파일(`spec/data-flow/11-workflow.md`, 및 동일 plan 이 함께 건드리는
`spec/2-navigation/1-workflow-list.md`)은 신규 엔드포인트·DTO·에러 코드·마이그레이션·식별자를 전혀
도입하지 않는 순수 계약 정정이라 `swagger.md`/`error-codes.md`/`migrations.md`/명명 규약 전반에서
저촉 지점이 없었고, 직전 `--spec` 라운드가 남긴 INFO 2건도 모두 반영·계획됐다. 다만 새로 발견한
1건은 등급을 올려 보고할 만하다 — `1-workflow-list.md` 가 `status: partial` 인 채로 아직 코드가
못 따라간 새 약속(캔버스 전체 복제)을 본문에 명문화했는데, 그 gap 을 메울 책임 plan
(`workflow-duplicate-nodes-edges.md`)이 `spec-impl-evidence.md §2.1` 이 의무화하는
`pending_plans:` 에 빠져 있다 — build 는 당장 깨지지 않지만 `spec-status-lifecycle.test.ts` 의
자동 승격 가드가 이 문서의 실제 완료 여부를 오판할 수 있는 잠재 위험이다. 나머지 2건은 이번에 새로
작성된 Rationale 산문의 완결성 문제(절 번호 오기 1건, "기각한 대안" 2건 중 1건만 명시적 라벨)로
INFO 수준이다.

## 위험도

LOW
