# 정식 규약 준수 검토 — `plan/in-progress/workflow-duplicate-nodes-edges.md`

## 검토 범위 참고

prompt_file 에 첨부된 "정식 규약 모음" 은 `spec/conventions/audit-actions.md` 와
`spec/conventions/cafe24-api-catalog/**` (application 계열 일부 + category.md 진입부)로
끊겨 있었고, target 문서(워크플로우 duplicate 의 nodes/edges 복사 계약)와 의미상 관련이
없는 영역이었다(알파벳 순 파일 나열이 중간에 잘린 것으로 추정 — 오케스트레이터 번들링
이슈이며 target 문서 자체의 결함은 아니다). 이를 보완하기 위해 저장소의
`spec/conventions/*.md` 를 직접 열어 target 과 실질적으로 관련 있는 항목
(`spec-impl-evidence.md`, `migrations.md`, `error-codes.md`, `swagger.md`,
`audit-actions.md`)과, target 이 수정하는 실제 spec 원문
(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`,
`spec/1-data-model.md`)을 직접 대조했다.

## 발견사항

- **[INFO]** Swagger 엔드포인트 설명(`@ApiOperation.description`) 갱신이 구현 체크리스트에 없음
  - target 위치: `## 2. 구현 계획` 체크리스트 (라인 124-134)
  - 관련 규약: `spec/conventions/swagger.md §3` ("가능하면 '무엇을 하는지 + 제약/부수효과'를 담습니다")
  - 상세: `codebase/backend/src/modules/workflows/workflows.controller.ts:209-223` 의
    `POST :id/duplicate` 는 현재 `@ApiOperation({ description: '기존 워크플로우를
    비활성(inactive) 상태의 새 워크플로우로 복제합니다. 이름은 "(Copy)"가 추가됩니다.' })`
    로, node/edge 복사 여부를 언급하지 않는다. 이번 fix 로 실제 부수효과(캔버스 전체 복제 +
    UUID 재매핑)가 새로 생기는데, target 의 구현 체크리스트(§2)에는 spec 3곳 반영 항목은
    있어도 Swagger description 갱신 항목이 없다. 기존 문구가 "복제 안 함"을 명시적으로
    주장한 것은 아니라 정면 위반은 아니지만, §3 이 요구하는 "부수효과 포함 설명" 기준에는
    미달한다.
  - 제안: `developer` 구현 체크리스트에 `@ApiOperation` description 을 "노드·엣지를 포함한
    캔버스 전체를 복제합니다" 등으로 보강하는 항목을 추가.

- **[INFO]** §1.3 항목이 §1.1/§1.2 와 형식이 다름 (정확한 AS-IS/TO-BE 텍스트 부재)
  - target 위치: `## 1. Spec 변경안 §1.3` (라인 106-108)
  - 관련 규약: 직접적인 `spec/conventions/**` 항목은 없음 — CLAUDE.md/체커 관점 3 "문서 구조
    규약" 의 형식 일관성 차원의 제안
  - 상세: §1.1·§1.2 는 정확한 **AS-IS**/**TO-BE** 인용문을 제공하는 반면, §1.3(`§2.1 Postgres
    표 — 복제 흐름 행 추가`)은 "표에 명시(INSERT 컬럼 집합은 '추가' 행과 동일하되 참조
    재매핑을 비고)" 라는 지시문으로만 기술되어 실제 표 행 초안이 없다. 규약 위반은 아니지만
    같은 섹션 내 세 항목 간 정밀도가 고르지 않다.
  - 제안: `developer`/`planner` 착수 시 §2.1 표에 추가할 정확한 행 문구를 미리 초안해 두면
    구현 단계에서 해석 편차를 줄일 수 있다. 필수 아님.

## 검증해 확인한 준수 사항 (참고 — 위반 아님)

다음은 위반이 발견되지 않았음을 뒷받침하는 근거로, 특히 꼼꼼히 대조한 항목이다.

- **plan frontmatter 스키마** (`.claude/docs/plan-lifecycle.md §4`, CLAUDE.md 명명 컨벤션): `worktree`/
  `started`(ISO)/`owner` 필수 3필드 모두 존재. `spec_impact` 는 완료 시점 의무(Gate C)이지만
  target 은 진행 중임에도 미리 **리스트 형식**(bare string 아님)으로 정확히 선언 —
  `spec/conventions/spec-impl-evidence.md §R-8` / 메모리 `feedback_spec_impact_gate_c_list` 가
  지적하는 흔한 실패형(bare string·빈 배열)을 피해 있다.
- **문서 3섹션 구조**: `## Overview` / `## 1~2 본문` / `## Rationale` 구성이 CLAUDE.md 의 권장
  구조와 일치. `spec/data-flow/11-workflow.md` 의 기존 `## Rationale` 섹션(`### <제목>` 하위
  소제목 패턴)에 target §1.4 가 제안하는 신규 소제목("duplicate 는 왜 export/import 와
  별 경로인가", "왜 버전 이력을 승계하지 않는가")이 기존 패턴과 형식이 일치한다.
- **frontmatter-evidence 적용 범위** (`spec-impl-evidence.md §1`): target 이 건드리는
  `spec/data-flow/11-workflow.md` 는 이 컨벤션의 명시적 **제외 대상**(data-flow 문서는
  frontmatter lifecycle 추적 대상 아님)이라 frontmatter 미변경이 정당. 반면
  `spec/2-navigation/1-workflow-list.md` 는 적용 대상이나 target 은 본문 표 행만 바꾸고
  기존 frontmatter(`id/status/code/pending_plans`)를 그대로 두는데, 이 변경이 "부분 구현→
  완성" 류가 아니라 버그 수정(설명 텍스트 정정)이라 frontmatter 변경 불요 — 위반 아님.
- **명명 규약(DB 컬럼 vs API/JSONB 필드)**: target 이 쓰는 `container_id`/`tool_owner_id`
  (스네이크케이스 DB 컬럼)와 `llmConfigId`(camelCase, `node.config` JSONB 내부 필드)는
  `spec/1-data-model.md:159-169, 601` 의 기존 표기와 정확히 일치. 대소문자 표기가 컬럼과
  JSONB 필드 사이에서 다른 것은 이 저장소의 기존 관례(코드/스펙 전반)이지 target 이 새로
  만든 불일치가 아니다.
- **문서 간 상호링크 anchor**: target TO-BE 텍스트가 신설한
  `../data-flow/11-workflow.md#15-복제--내보내기--가져오기` 앵커를
  `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 의 slugify 테스트
  케이스(`"### 3.4 신뢰성 / 보안" → "34-신뢰성--보안"`, 구두점 삭제 후 남은 공백이 각각
  개별 `-` 로 치환)로 직접 재현한 결과, `### 1.5 복제 · 내보내기 · 가져오기` 헤딩(원문
  `11-workflow.md:133`)의 실제 슬러그와 **정확히 일치**한다(가운뎃점 `·` 양옆 공백이 각각
  살아남아 이중 하이픈이 되는 패턴까지 재현). `spec-link-integrity` 빌드 가드를 통과할
  것으로 판단된다.
- **API 경로/HTTP 메서드**: `POST /api/workflows/:id/duplicate` 는 기존 엔드포인트를 그대로
  재사용(신규 명명 없음). export/import 경로와 분리하는 설계는 Rationale 에 명문화되어
  있고 임의 명명이 아니다.
- **migrations.md**: target 은 신규 스키마/컬럼을 요구하지 않아(기존 `node`/`edge` 테이블
  재사용) 마이그레이션 명명·V번호 규약이 적용될 여지가 없다 — 해당 없음, 위반 아님.
- **error-codes.md**: 신규 에러 코드 도입 없음(기존 `saveCanvas` 의 "Manual Trigger 정확히
  1개" 400 만 배경 설명으로 인용) — §1 의미 기반 명명·§2 rename 안정성 정책에 저촉되는
  변경 없음.
- **audit-actions.md**: `workflow` 리소스의 CRUD 액션(`created`/`updated`/`deleted`/
  `executed`)이 레지스트리상 아직 **미구현**이므로, target 이 duplicate 에 감사 로그
  기록을 추가하지 않는 것은 현재 규약 위반이 아니다.

## 요약

target 문서는 명명(DB 컬럼 vs JSONB 필드 표기 일치)·plan frontmatter 스키마(Gate C 리스트
형식 선준수)·3섹션 문서 구조(Overview/본문/Rationale, 기존 Rationale 소제목 패턴과의
정합)·신규 cross-reference anchor(github-slugger 파이프라인 재현 검증 통과) 등 검증 가능한
모든 축에서 `spec/conventions/**` 및 CLAUDE.md 명명 컨벤션과 정합했다. 신규 마이그레이션·
에러 코드·DTO/응답 포맷 변경이 없어 `migrations.md`/`error-codes.md`/`swagger.md` 의
핵심 조항이 저촉될 지점 자체가 없었고, `spec/data-flow/**` 가 frontmatter-evidence 제외
대상이라는 점도 정확히 반영되어 있다. 발견된 두 건은 모두 INFO 등급의 완전성 제안
(Swagger 설명 갱신 누락, §1.3 표 행 초안 미제공)으로 규약을 어긴 것이 아니라 구현
체크리스트를 조금 더 촘촘히 할 수 있는 지점이다. prompt 에 첨부된 "정식 규약 모음"
자체가 target 도메인과 무관한 부분 번들이었던 점은 별도로 기록해 둔다(오케스트레이터
번들링 이슈, target 결함 아님) — 이를 보완하기 위해 저장소의 관련 conventions 파일을
직접 열어 대조했다.

## 위험도

LOW
