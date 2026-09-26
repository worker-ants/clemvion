# 정식 규약 준수 검토 — canvas-save-typed

## 검토 범위 및 방법

- prompt 의 target 은 `spec/2-navigation/` 이나 이 브랜치의 spec 델타는 0개(정상 — 코드 전용 PR).
- 번들의 `<git diff origin/main...HEAD -- code_areas>` 는 예산 절단으로 본문이 생략되어, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/canvas-save-typed`)를 절대경로로 직접 열어
  실제 구현 diff(3파일 / 165줄)를 확인했다:
  - `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (13줄 변경)
  - `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` (신규 30줄)
  - `codebase/backend/test/workflow-crud.e2e-spec.ts` (57줄 추가)
  - 부수: `CHANGELOG.md`, `plan/in-progress/canvas-save-typed.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`
- 대조 규약: `spec/conventions/swagger.md` (DTO·응답·명명 규약의 SoT), `spec/conventions/spec-impl-evidence.md`·
  `CLAUDE.md`(plan frontmatter 스키마).

## 변경 내용 요약

`CanvasSaveResultDto.nodes`/`.edges`(캔버스 저장·버전 복원 응답, `POST /workflows/:id/save` ·
`POST /workflows/:id/versions/:versionId/restore`)를 `@ApiProperty({ type: 'array', items: { type: 'object' } })`
(타입 없는 객체 배열)에서 `@ApiProperty({ type: () => [NodeDto] })` / `[EdgeDto]` 로 교체 — 기존
`workflows/nodes`·`workflows/edges` 모듈의 응답 DTO 를 재사용한다. 신규 클래스 선언은 없다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `NodeDto`/`EdgeDto` 참조가 §1-4(nested object 패턴)의 명시 예시(`type: () => NestedDto`)를
  배열로 확장한 형태(`type: () => [NestedDto]`)를 쓰는데, swagger.md 본문에는 배열 nested 참조의 예시가
  없다.
  - target 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:80,84`
  - 위반 규약: 해당 없음 — `spec/conventions/swagger.md` §1-4 는 nested object 단수형만 예시로 든다.
  - 상세: 실제로는 위반이 아니다. 저장소 전역 grep 결과 `type: () => [XxxDto]` 패턴이 `save-canvas.dto.ts`·
    `import-workflow.dto.ts`·`assistant-message-request.dto.ts`·`assistant-session-response.dto.ts`·
    `background-run-response.dto.ts` 등 최소 6개 기존 파일에서 동일하게 쓰이고 있어, 이 변경은 저장소의 확립된
    관행을 그대로 따른 것이다. 다만 swagger.md §1-4 문서 자체에는 "배열 nested" 예시가 없어, 다음에 같은 패턴을
    쓰려는 사람이 문서만 보고는 확신하기 어렵다.
  - 제안: 이 PR 을 막을 사유는 아니다. 여유가 있을 때 swagger.md §1-4 에 `type: () => [NestedDto]` 배열형
    한 줄 예시를 추가하면(문서 갱신) 문서-실무 간극이 줄어든다.

## 규약 준수 확인 (양성 근거)

1. **명명 규약** — `NodeDto`/`EdgeDto` 는 변경 이전부터 존재하던 클래스(각각 `nodes`/`edges` 모듈의
   `dto/responses/*-response.dto.ts`)를 재사용했을 뿐 신규 선언이 없다. 저장소 전체에서 동명 클래스 중복
   없음을 확인(`grep -rn "^export class NodeDto"` / `EdgeDto` 각 1건). §5-1 "클래스명 저장소 전체 유일" 요건과
   충돌 없음.
2. **출력 포맷 규약** — 변경 전 `items: { type: 'object' }` 는 응답 계약 검증자(`response-contract.ts`)가
   원소 안으로 내려가지 않는 "빈 껍데기"였다. 변경 후 `$ref` 참조로 바뀌어 §6 "레거시 패턴 제거"(빈 껍데기
   스키마 금지)의 취지와 §1-4 "닫힌 집합은 타입을 특정" 원칙에 정확히 부합한다. JSDoc(`/** 저장 후 노드 배열 */`)은
   그대로 유지하고, 설계 배경(왜 참조로 바꿨는지)은 그 위 `//` 주석에 분리해 §3 "JSDoc 은 공개 OpenAPI 로
   나간다 — 내부 서사를 담지 않는다"(2026-09-05 규약화)를 정확히 지켰다.
3. **API 문서 규약** — 컨트롤러의 `@ApiOkWrappedResponse(CanvasSaveResultDto, …)` 데코레이터는 이 diff 로
   변경되지 않았고(§5-2 공용 래퍼 계속 사용), `type: () => [Dto]` 배열 참조 패턴은 저장소 6개 이상 기존
   파일과 동형이라 일관성 있음.
4. **문서 구조·plan 규약** — 신규 `plan/in-progress/canvas-save-typed.md` 는 frontmatter 에 `worktree:
   canvas-save-typed`·`owner: developer`·`spec_impact: none`(bare, 리스트 아님 — Gate C 요건 충족)을
   갖췄고, 실측 근거(§2.5·서비스 코드 경로)를 본문에 적어 "spec 미변경 사유"를 뒷받침한다. 조사 중 발견한
   `ExportWorkflowDto.nodes`/`.edges` 동형 결함은 별도 트래커 항목으로 등재(재사용 불가 사유까지 명시)해
   scope 밖 이슈를 이 plan 에 끌어들이지 않았다.
5. **금지 항목** — swagger.md §6 이 금지하는 "빈 껍데기 스키마"를 정확히 해소하는 방향의 변경이라 금지
   패턴 재도입 없음. `--impl-prep`(`review/consistency/2026/09/26/21_38_44`) 이 지적한 W1(트리거 이력
   상한 미표기)은 이 plan 범위 밖 기존 이슈로 트래커 확인 후 재등재하지 않은 처분도 타당하다.

## 요약

이번 변경은 `CanvasSaveResultDto.nodes`/`.edges` 의 응답 스키마를 타입 없는 객체 배열에서 저장소에 이미
존재하는 `NodeDto[]`/`EdgeDto[]` 참조로 교체하는 좁은 범위의 리팩터로, 신규 식별자·신규 엔드포인트·신규
에러 코드가 없어 명명·API 문서 규약과 충돌할 표면이 애초에 작다. 확인 결과 swagger.md 의 DTO 패턴(§1-4
nested 타입 특정, §3 JSDoc/내부 주석 분리, §5-1 클래스명 유일성, §5-2 응답 래퍼, §6 빈 껍데기 금지)을 모두
준수하며, 저장소에 이미 정착된 `type: () => [Dto]` 배열 참조 관행과도 일치한다. plan frontmatter·CHANGELOG·
트래커 등재도 CLAUDE.md/관련 컨벤션이 요구하는 형식을 충족한다. CRITICAL·WARNING 은 발견되지 않았고, 유일한
INFO 는 문서(swagger.md) 예시 보강을 제안하는 사소한 개선 사항이다.

## 위험도

NONE
