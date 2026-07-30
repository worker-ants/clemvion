# Rationale 연속성 검토 — spec/data-flow/ (impl-prep)

## 검증 방법

target 은 `spec/data-flow/` 스코프 번들(9개 파일: 0-overview·1-audit·10-triggers·11-workflow·12-workspace·
13-agent-memory·14-chat-channel·15-external-interaction·2-auth)이지만, `git diff origin/main...HEAD` 로
실제 내용 변경은 `spec/data-flow/11-workflow.md`(§1.5 duplicate 계약 정정 + `## Rationale` 4개 절 신설)와
`spec/2-navigation/1-workflow-list.md`(더보기 메뉴·API 표 문구 보강) 두 파일로 확인했다. 이는 planner 가
이미 `--spec` 모드로 1차 검토(`review/consistency/2026/07/30/16_45_59/rationale_continuity.md`, INFO 2건,
BLOCK:NO)를 마치고 spec 을 커밋(`f71839fe6`)한 뒤의 **동일 변경에 대한 impl-prep 재검토**다.

이번 라운드에서는 (a) 1차 라운드가 남긴 INFO 2건이 실제 커밋된 spec 본문에 반영됐는지 실측 대조, (b) 새
Rationale 이 인용하는 사실 관계(`db496a3c2`/`8ff4e8564` 커밋, `NAV-WF-04`, `workflow-list §2.6`,
`3-execution.md:753`)를 `git show`/`grep`/직접 Read 로 재검증, (c) 프롬프트에 포함되지 않은 52개 생략
파일 중 target 이 인용하는 파일(`spec/3-workflow-editor/3-execution.md`)을 리포지토리에서 직접 열어
대조, (d) `spec/` 전체에서 "복제"/"duplicate" 키워드를 재검색해 번들 밖에 숨은 상충 Rationale 이 있는지
확인했다.

## 발견사항

- **[INFO]** "워크플로우 에디터 §7 Rationale" 인용의 섹션 번호 오류
  - target 위치: `spec/data-flow/11-workflow.md` `## Rationale` > "duplicate 는 캔버스 전체를 복제한다
    (메타-only 였던 서술의 철회)" 절, "(보조 정황으로 [워크플로우 에디터 §7 Rationale]
    (../3-workflow-editor/3-execution.md) 이 테스트 데이터셋 clone 을 설계하며 duplicate 를 선례로
    인용하지만 …)" 문장
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md` — 인용된 내용은 실제로 `## 2. Mock Input
    (테스트 입력)` 아래 `### R-2.2 테스트 데이터셋 저장 — 권한·소유 모델 (2026-06-14)` 다. 문서의 실제
    `§7` 은 `## 7. 실행 히스토리 (인-에디터)` 로 완전히 다른 내용(테스트 데이터셋과 무관)이다. 같은
    저장소 안에 정확한 인용 선례가 이미 있다 — `spec/1-data-model.md:522`
    `"권한·소유 모델 SoT: [워크플로우 실행 §2.2 / R-2.2](./3-workflow-editor/3-execution.md#r-22-테스트-
    데이터셋-저장--권한소유-모델-2026-06-14)"`.
  - 상세: 인용 대상 파일·문장 자체는 정확하고( `db496a3c2`/`3-execution.md:753` 실측 모두 사실 —
    1차 라운드에서 이미 검증, 본 라운드에서 재확인) "소유권 패턴 선례일 뿐 노드 내용 복사를 직접
    진술하지 않는다" 는 결론도 유효하다. 다만 section 라벨("§7")이 실제 위치(§2.2/R-2.2)와 어긋나
    독자가 링크를 눌러 문서 최상단에서 "§7" 을 찾으면 엉뚱한 절(실행 히스토리)에 도달한다 — 결정의
    실질을 바꾸는 문제는 아니지만 Rationale 출처 추적성(traceability)을 해친다.
  - 제안: `[워크플로우 에디터 §7 Rationale]` → `[워크플로우 실행 §2.2 / R-2.2]` 로 라벨 정정하고, 링크에
    `spec/1-data-model.md:522` 와 동일한 앵커(`#r-22-테스트-데이터셋-저장--권한소유-모델-2026-06-14`)를
    추가할 것.

## 확인됨 (발견사항 아님 — 참고용 검증 결과)

- `spec/data-flow/11-workflow.md:137`(구) "nodes/edges 는 복제하지 않는다" 는 `git show db496a3c2 --
  spec/data-flow/11-workflow.md` 로 대조한 결과 신규 추가(`+`) 라인이며, 그 커밋 메시지도
  "spec↔code 전수 상호 감사 — 역방향 커버리지 + drift 동기화" 다. `git log --follow` 로 그 이전 이력에
  duplicate 서술 자체가 존재하지 않았음도 확인했다 — target 의 "제품 결정이 아니라 drift 동기화
  산출물" 이라는 핵심 전제는 사실과 일치한다(criterion 3 "결정의 무근거 번복" 미해당 — 새 Rationale 을
  명시적으로 작성했다).
- `WorkflowsService.duplicate()` 는 `git log -p --follow -- workflows.service.ts` 로 대조한 결과
  초기 골격 커밋 `8ff4e8564` 이후 실제로 한 번도 수정되지 않았다 — "미완성 방치" 서술도 실측과 일치.
- `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`, "워크플로우 생성/복제/삭제 기능", 필수 ✅)와
  `spec/2-navigation/1-workflow-list.md` 의 기존 "복사본" 문구는 target 의 counter-reference 로서 실측
  확인됐다.
- `기각한 대안 — 복제본에 Manual Trigger 자동 생성`은 같은 문서 §1.1 의 기존 불변식("Manual Trigger
  정확히 1개, 위반 시 400")과 정확히 부합한다 — criterion 2("합의된 원칙 위반") 미해당, 오히려 기존
  invariant 를 근거로 대안을 기각한 정공법.
- `node`/`edge` 복제 시 label 유니크·`applyConfigDefaults`·기본 LLM 주입 게이트를 재사용하지 않는 설계는
  DB 레벨 UNIQUE 제약이 아니라 app 레벨 검증(`DUPLICATE_NODE_LABEL` — DB 스키마에 UNIQUE 없음, grep 으로
  재확인)이며, 원본이 이미 같은 워크플로우 내부에서 그 검증을 통과한 그래프를 그대로 복사하는 구조라
  재검증 생략이 새 invariant 위반을 만들지 않는다.
- `spec/2-navigation/1-workflow-list.md` 자체 `## Rationale` 4항목(공유 워크플로우 정의·import permissive
  config·폴더 계층 무결성·태그 필터 하향) 중 target 변경과 상충하는 항목 없음.
- 번들에 포함된 `spec/0-overview.md`·`spec/1-data-model.md`·`spec/2-navigation/{0,1,10,11,13,14,15,16,2,
  3,4,5,6}-*.md` 의 `## Rationale` 전체를 훑었으나 workflow duplicate 범위(nodes/edges 전체 복제·
  export/import 미재사용·버전 이력/트리거/데이터셋 비승계)와 충돌하는 기존 결정·invariant 는 없다.
  `spec/data-flow/1-audit.md` 의 "workflow.\* 액션은 audit 미구현(커버리지 갭)" 서술은 이미 알려진
  pre-existing 상태이며 target 이 새로 만들거나 악화시키는 것이 아니다.
- `spec/` 전체 `복제|duplicate` grep 재검색 결과 번들 밖에서 이번 변경과 충돌하는 별도 Rationale·기각된
  대안 문서는 발견되지 않았다.
- 1차 라운드(`16_45_59`)가 남긴 INFO 2건은 커밋된 spec 본문에서 모두 반영 확인됨 — (a) "기각한 대안"
  포함 `## Rationale` 전체가 plan 에서 spec 으로 이관됐고, (b) `3-execution.md` 인용이 "소유권 패턴
  선례일 뿐" 이라고 스코프를 한정하는 문장이 실제로 추가됐다.

## 요약

target(`spec/data-flow/11-workflow.md` §1.5 + `## Rationale` 4절, `spec/2-navigation/1-workflow-list.md`)은
"메타-only 복제"라는 기존 문구를 뒤집으면서 그 문구가 합의된 trade-off 결정이 아니라 감사 시점 drift
동기화 산출물이었음을 `db496a3c2`/`8ff4e8564` 커밋 실측으로 뒷받침하고, `NAV-WF-04`·workflow-list §2.6 이라는
정확한 counter-reference 를 들어 뒤집는 근거를 새 `## Rationale` 4개 절(철회 근거·export/import 미재사용
근거·비승계 범위 근거·기각한 대안)로 명시적으로 남겼다 — Rationale 연속성 관점에서 요구되는 정공법을
정확히 따른 사례다. 1차 `--spec` 라운드가 지적한 INFO 2건도 커밋된 본문에서 모두 반영됐음을 확인했다.
본 라운드에서 새로 발견한 것은 새 Rationale 문단 안의 인용 하나가 대상 문서의 실제 섹션 번호(§2.2/R-2.2)
대신 잘못된 번호(§7)를 달고 있는 것뿐이며, 이는 인용 문구·결론의 실질적 타당성에는 영향이 없는 표기
오류다(같은 저장소 `spec/1-data-model.md:522` 가 올바른 인용 패턴을 이미 보여준다). 그 외 기각된 대안의
재도입, 합의된 원칙 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다.

## 위험도

LOW
