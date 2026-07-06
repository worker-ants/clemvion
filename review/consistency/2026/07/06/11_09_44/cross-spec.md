# Cross-Spec 일관성 검토 — spec/2-navigation/1-workflow-list.md (태그 필터 하향 + 폴더/§3.1 현행화)

- 대상: `spec/2-navigation/1-workflow-list.md` §1 안내문 / §2.3 태그·폴더 행 / §3.1 note / Rationale §4 신설
- 검토 범위: `spec/5-system/2-api-convention.md`(목록 응답·필터 파라미터 규약), `spec/1-data-model.md`(Workflow.tags, Folder), `spec/data-flow/11-workflow.md`, `spec/7-channel-web-chat/**`, `spec/2-navigation/_product-overview.md`(NAV-WF 요구사항 ID), `spec/2-navigation/{0-dashboard,14-execution-history}.md`(상호 참조), 실제 코드(`query-workflow.dto.ts`, `folders.controller.ts`, `workflows/page.tsx`)

## 발견사항

검토 결과 **직접 모순 없음**. 아래는 확인한 대조 지점과 근거.

- **[INFO]** `?tag=` 단일 계약, 타 spec 과 정합
  - target 위치: §2.3 태그 행, §3(API 표), Rationale §4
  - 대조 대상: `spec/5-system/2-api-convention.md` §4.2 "필터 파라미터" 예시 — `GET /api/workflows?status=active&tag=marketing`
  - 상세: api-convention.md 의 예시 자체가 이미 `?tag=` **단일 값** 형태다. 멀티 선택(예: `?tag=a,b` 또는 반복 파라미터)을 암시하는 서술은 api-convention.md 를 포함해 검색한 전 spec 어디에도 없었다. 실제 백엔드 `query-workflow.dto.ts` 도 `tag?: string`(단일, `IsString`)으로 target 서술과 정확히 일치한다. "다른 곳에서 멀티로 서술한 데가 있는지" 확인했으나 발견되지 않았다.
  - 제안: 없음 (정합 확인 완료).

- **[INFO]** NAV-WF-06 요구사항 표현과의 관계
  - target 위치: §2.3 태그 행, Rationale §4
  - 대조 대상: `spec/2-navigation/_product-overview.md` NAV-WF-06 "폴더/태그 기반 워크플로우 정리" (권장, ✅)
  - 상세: NAV-WF-06 은 멀티/단일 여부를 특정하지 않는 상위 수준 요구사항이라, 이번 단일 텍스트 입력 하향은 이 요구사항과 문언상 모순되지 않는다(여전히 "태그 기반 정리" 수단으로 성립). ID 재사용·의미 충돌도 없다 — 순수 정보성 확인.
  - 제안: 없음. 다만 향후 PRD 원문에 멀티 태그를 명시적으로 요구하는 문구가 발견되면(현재는 없음) 그때 재검토.

- **[INFO]** 데이터 모델 `Workflow.tags` 타입과 필터 의미 정합
  - target 위치: §2.3 태그 행 ("`tags` 배열에 포함한 워크플로우만 조회")
  - 대조 대상: `spec/1-data-model.md` §2.4 `tags | String[]`
  - 상세: `tags` 가 배열 컬럼이라는 데이터 모델 정의와 `= ANY(tags)` 매칭 서술이 일치한다. 모순 없음.
  - 제안: 없음.

- **[INFO]** 폴더 §3.1 note 현행화와 RBAC 정합
  - target 위치: §3.1 note ("폴더 필터가 GET /api/folders 소비")
  - 대조 대상: `codebase/backend/src/modules/folders/folders.controller.ts` — `GET /api/folders`, `GET /api/folders/:id` 에는 `@Roles` 데코레이터 없음(인증된 모든 역할 접근), POST/PATCH/DELETE 만 `@Roles('editor')`
  - 상세: target 문서는 "폴더 관리 UI(생성·수정·삭제)는 아직 없음 — 필터 옵션 조회 전용" 이라고 정확히 GET 만 프론트가 소비함을 명시했고, 이는 기존 §3.1 표의 RBAC 서술(POST/PATCH/DELETE = editor+)과 어긋나지 않는다. 실제 프론트(`workflows/page.tsx`)도 `foldersApi.list()` GET 만 호출한다.
  - 제안: 없음.

- **[INFO]** channel-web-chat·data-flow 등 인접 영역에는 워크플로우 목록 태그/폴더 필터에 대한 서술 자체가 없음
  - target 위치: 전체
  - 대조 대상: `spec/7-channel-web-chat/**`(태그 언급 없음 확인), `spec/data-flow/11-workflow.md`(태그는 생성/duplicate/export 시 필드 승계 맥락에만 등장, 필터 계약과 무관)
  - 상세: 충돌 소지가 될 만한 별도 서술이 없어 검토 대상에서 제외.
  - 제안: 없음.

## 요약

target 변경은 서버 `?tag=` 단일 필터 계약(`query-workflow.dto.ts` 의 `tag?: string`)에 프론트 UI 서술을 맞추는 정합화이며, `spec/5-system/2-api-convention.md` §4.2 의 기존 예시(`?tag=marketing`, 단일값)와 이미 일치했던 계약을 문서화한 것이다. `spec/1-data-model.md` 의 `tags: String[]` 필드 정의, 폴더 엔티티/RBAC 서술과도 모순이 없고, `spec/data-flow/11-workflow.md`·`spec/7-channel-web-chat/**` 등 인접 영역에는 이 필터를 멀티로 서술한 대목이 존재하지 않는다. NAV-WF-06 요구사항 ID 도 멀티/단일을 특정하지 않아 재해석 충돌이 없다. Cross-Spec 관점에서 결함이 발견되지 않았다.

## 위험도

NONE — 결함 없음, BLOCK 사유 없음.
