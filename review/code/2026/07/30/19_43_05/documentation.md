# 문서화(Documentation) 코드 리뷰 — workflow duplicate 계약 정정 (consistency-check 2라운드 산출물 + spec 반영분)

## 검토 범위 확정

이번 리뷰 대상 16개 파일 중 14개(`review/consistency/2026/07/30/17_03_26/**`,
`review/consistency/2026/07/30/19_03_37/**` — SUMMARY/meta.json/`_retry_state.json`/5개 checker 리포트 ×2라운드)는
이전 두 consistency-check 라운드(impl-prep, impl-done)의 자동 생성 감사 산출물이고, 실질적인 "문서" 변경은
나머지 2개 파일 — `spec/2-navigation/1-workflow-list.md`, `spec/data-flow/11-workflow.md` — 뿐이다. 이 두 파일이
`POST /api/workflows/:id/duplicate` 의 계약 서술을 "메타 row 만 복제"에서 "노드·엣지 포함 캔버스 전체 복제"로
바로잡는 실제 API 문서·spec 정정분이다. `codebase/backend/src/modules/workflows/*.ts` 자체의 JSDoc/인라인 주석은
선행 코드 리뷰 라운드(`review/code/2026/07/30/19_06_10/documentation.md`)에서 이미 별도로 검증되어(WARNING 1건
— RESOLUTION.md 테스트 수치 오기재 — 은 최신 커밋 `3af0aabbe` 로 해소 확인) 이번 diff 의 범위 밖이라 재검증하지
않았다.

검증 방법: 프롬프트가 제공한 diff 게이트 숫자를 그대로 인용하되, 실제 저장소 파일을 `Read`/`grep` 으로 직접
열어 (1) 헤딩·앵커 슬러그 실재 여부, (2) Swagger `@ApiOperation.description` 과 spec 서술의 일치 여부, (3) 새
Rationale 이 인용하는 데이터가 실제 코드(`buildSnapshot()`)와 일치하는지, (4) 옛 "메타 row 만" 문구가 저장소
어딘가에 미정정 상태로 남아있는지를 독립적으로 재확인했다.

## 발견사항

- **[WARNING]** `spec/data-flow/11-workflow.md` 가 서술하는 `workflow_version.snapshot` 구성이 데이터 모델
  SoT 문서(`spec/1-data-model.md` §2.15)와 여전히 정면으로 상충 — 이번 diff 의 정정이 SoT 문서까지
  전파되지 않음
  - 위치: `spec/data-flow/11-workflow.md:61`, `:234-235` ("`workflow_version.snapshot` 은 name + description +
    nodes + edges 의 스냅샷을 단일 JSONB 로 저장한다 (`workflow.settings` 는 포함하지 않는다 …)") — 이
    문장 자체는 이번 diff 이전부터 있던 pre-existing 서술이나, 바로 이어지는 신설 Rationale "duplicate 는
    캔버스 전체를 복제한다"(gate 240)와 같은 `## Rationale` 섹션 안에 있어 이번 diff 가 손대는 문서의
    직접 인접 컨텍스트다.
  - 상세: `spec/1-data-model.md:572`(§2.15 WorkflowVersion 표, 이번 diff 밖 파일)를 직접 Read 로 대조한 결과
    `| snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |` — `settings` 포함을 명시하고
    `name`/`description` 은 언급하지 않아 `11-workflow.md` 서술과 정반대다. 실제 코드
    (`codebase/backend/src/modules/workflows/workflows.service.ts` `buildSnapshot()`, 622-634행)를 직접 확인한
    결과 `{ name, description, nodes: [...], edges: [...] }` 만 구성하고 `settings` 는 넣지 않는다 — 즉
    `11-workflow.md` 쪽이 코드와 일치하고 `1-data-model.md` §2.15 쪽이 stale 하다. 이 불일치는 이번 diff 가
    만든 것이 아니라 `origin/main` 시점부터 있던 pre-existing 상태이며, 동일 changeset 의 cross-spec
    checker 가 두 라운드에서 이미 정확히 같은 지점을 WARNING 으로 잡았고
    (`review/consistency/2026/07/30/17_03_26/cross_spec.md`, `review/consistency/2026/07/30/19_03_37/cross_spec.md`),
    그 결과가 이번 diff 에 포함된 `review/consistency/2026/07/30/19_03_37/SUMMARY.md` WARNING #1 에도 이미
    올라가 있다. 문서화 관점에서도 같은 결론에 도달했다 — `11-workflow.md` 자신은 이번 diff 로 정확해졌지만,
    같은 컬럼을 설명하는 또 다른 SoT 문서(`1-data-model.md`)에는 정정이 전파되지 않아, 두 문서를 나란히
    읽는 개발자에게는 여전히 상호 모순된 문서가 남는다. 이미 다른 checker 가 잡은 사안을 중복 보고하는
    이유는 이번 documentation 리뷰의 대상 파일(`11-workflow.md`) 자체의 문서 정확성 문제이기 때문이며,
    code-review 트랙과 consistency-check 트랙의 산출물이 서로 다른 위치에 보관되므로 어느 한쪽만 봐도
    이 항목이 누락되지 않게 하려는 목적이다.
  - 제안: `spec/1-data-model.md` §2.15 `snapshot` 필드 설명을 "워크플로우 캔버스 스냅샷 (name, description,
    nodes, edges — `workflow.settings` 는 제외)" 로 정정하는 경량 spec-only 후속 정정. 이번 PR 을 막을
    사유는 아님(이미 cross-spec checker 2라운드 + 본 리뷰가 동일하게 "비차단·후속 처리" 로 결론).

## 검증했으나 문제 없음 (직접 확인)

- **anchor/슬러그 실재성**: 신설 Rationale 이 쓰는 `#r-22-테스트-데이터셋-저장--권한소유-모델-2026-06-14`
  앵커는 `spec/3-workflow-editor/3-execution.md:747` `### R-2.2 테스트 데이터셋 저장 — 권한·소유 모델
  (2026-06-14)` 헤딩과 정확히 대응하고, 동일 슬러그가 `spec/1-data-model.md:522` 에서 이미 같은 형태로
  쓰이고 있어(pre-existing, 검증된 패턴) 신규 리스크가 없음을 직접 확인. `#15-복제--내보내기--가져오기`
  앵커도 `spec/data-flow/11-workflow.md:133` `### 1.5 복제 · 내보내기 · 가져오기` 헤딩과 일치.
- **Swagger 문서 동기화**: `codebase/backend/src/modules/workflows/workflows.controller.ts:212-216` 의
  `@ApiOperation.description` ("노드·엣지를 포함한 캔버스 전체를 한 트랜잭션으로 함께 복사합니다 …")을
  직접 Read 로 대조한 결과 이번 spec 정정 문구와 정확히 일치.
  API 응답 계약(`WorkflowDto`)도 변경 없음.
- **CHANGELOG**: `CHANGELOG.md` 최상단 "## Unreleased — 워크플로우 복제가 nodes/edges 를 복사하지 않던
  결함 수정" 항목(이번 diff 범위 밖, 선행 커밋 `8783c63d8`)이 기존 포맷(`## Unreleased — <제목>` → 번호
  목록 → `SoT:`/`추적:` 각주)을 따르고, `SoT:` 가 정확히 이번에 정정된 두 spec 절(`11-workflow.md` §1.5,
  `1-workflow-list.md` §2.6)을 가리켜 새로 확인이 필요한 gap 없음.
  사용자 가이드(`ui-tour.mdx`/`.en.mdx`)도 별도 선행 커밋(`e66bbb9c1`)에서 ko/en 동시 갱신 완료 상태로,
  이번 diff 가 추가로 건드릴 필요 없음.
- **잔존 stale 문구 없음**: 저장소 전체(`spec/**`, `codebase/backend/src/modules/workflows/**`)에서
  "메타 row 만"/"meta row only" 재검색 결과, `spec/data-flow/11-workflow.md:242` 안에서 "본 문서 §1.5 는
  한때 …로 기술했다" 라는 **철회 대상으로만 인용**되는 1건 외에는 잔존처가 없음 — 정정이 전체 저장소에
  일관되게 반영됨.
- **review 산출물 위치·형식**: 14개 consistency-check 리포트 모두 CLAUDE.md 의
  `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 위치 규약을 그대로 따르고, 5개 checker × 2
  라운드가 `발견사항`/`요약`/`위험도` 형식을 일관되게 유지 — 문서 형식상 문제 없음.

## 요약

이번 diff 의 실질적인 문서 변경은 `spec/2-navigation/1-workflow-list.md`·`spec/data-flow/11-workflow.md` 두
파일이 `POST /api/workflows/:id/duplicate` 의 오래된 오설명("메타 row 만 복제")을 실제 의도·구현과 일치하는
서술("노드·엣지 포함 캔버스 전체 복제")로 바로잡고, 그 결정을 뒷받침하는 3개의 새 `## Rationale` 절(철회
근거·export/import 미재사용 근거·비승계 범위 근거 + 기각한 대안 2건)을 덧붙인 것이다. 직접 검증한 결과
Swagger 설명·CHANGELOG·ko/en 사용자 가이드가 전부 이 정정과 동기화돼 있고, 새 Rationale 이 쓰는 앵커·절
번호도 모두 실재 헤딩과 정확히 대응하며, 옛 오설명 문구는 "철회 대상" 인용 1건을 제외하고 저장소 전체에서
말끔히 제거됐다 — 문서 정정 자체는 모범적으로 수행됐다. 유일하게 남는 문서화 이슈는 이번 diff 가 만든
것이 아니라 이미 알려진 pre-existing 문제로, `spec/1-data-model.md` §2.15 가 여전히 `workflow_version.snapshot`
에 `settings` 가 포함된다고 서술해(실제로는 제외) 이번에 정정된 `11-workflow.md` 및 실제 코드
(`buildSnapshot()`)와 상충한다 — 동일 changeset 의 cross-spec checker 가 이미 WARNING 으로 잡아 별도
경량 후속 PR 을 권고해 두었고, 본 리뷰도 동일 결론에 독립적으로 도달했다. 나머지 14개 리뷰 산출물
파일은 자동 생성 감사 기록으로서 저장 위치·형식 규약을 정확히 따르고 있어 문서화 관점의 지적사항이
없다.

## 위험도

LOW
