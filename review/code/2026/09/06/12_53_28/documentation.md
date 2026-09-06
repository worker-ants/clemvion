# 문서화(Documentation) 리뷰

## 개요

이 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출을 잡는 검출 2축(구조 축
`user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`) 신설과, 이미 5차례의
`/ai-review`+`/consistency-check` 라운드(`10_13_22`→`10_53_48`→`11_27_53`→`11_55_36`→
`12_28_02`)를 거쳐 처분된 Critical 1건·다수의 WARNING 이 누적 반영된 최종 상태, 그리고
가장 최근 커밋(`4529812c6`)이 추가한 세 번째 축 `dto-jsdoc-citation-guard.ts` 로 구성된다.

과거 라운드가 지적한 문서화 결함들(JSDoc orphan 블록, `CREATOR_PROJECTION` 4곳 손 복제,
e2e 라벨 중복(`F.`/`F.`)·순서 역전, 테스트 제목의 stale count, `joinedAt` 필드 JSDoc 의
공개 OpenAPI 노출 위반, eager 축이 상위 문서 3곳에서 누락된 것)이 전부 실제 코드·문서에
반영돼 있음을 직접 코드를 열어 재확인했다 — 재발 없음. `workflow-crud.e2e-spec.ts` 는
`H.`, `workspace-rbac.e2e-spec.ts` 는 `J.` 로 라벨이 유일하고 순서대로다. `CHANGELOG.md` 는
최신 커밋(`dto-jsdoc-citation-guard.ts` 신설)까지 반영돼 있다. `workspace-member.entity.ts`
의 `joinedAt: Date | null` 이 nullable 인 이유(마이그레이션 `V001__initial_schema.sql:57`
의 `joined_at TIMESTAMPTZ`, NOT NULL 없음)와 실제 코드가 4자리에서 항상 채운다는 주석의
수치(`workspaces.service.ts` 3곳 + `workspace-invitations.service.ts` 1곳)도 직접 세어
정확함을 확인했다. `dto-jsdoc-citation-guard.ts` 의 `isResponseDtoFile` 이 "`swagger-dto-
contract-guard` 와 같은 판정" 이라는 주석도 두 파일을 대조해 문자 그대로 동일함을 확인했다.

새로 찾은 것은 아래 한 건(INFO, 렌더링에는 영향 없음)뿐이다.

## 발견사항

- **[INFO]** plan 완료 노트의 번호 매김 목록이 원문 순서상 1 → 3 → 2 로 어긋나 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:343`(`> 1.
    user-entity-exposure-guard.ts`), `:354`(`> 3. dto-jsdoc-citation-guard.ts`),
    `:357`(`> 2. user-secret-absence.ts`)
  - 상세: `## 완료 (2026-09-06)` 절의 `**택한 것**` 목록이 blockquote 안에서 번호를
    `1.`·`3.`·`2.` 순으로 매겼다. CommonMark 렌더러(GitHub 등)는 첫 번째 명시 번호(`1`)
    이후를 등장 순서대로 다시 매기므로 **렌더된 화면에서는** 1·2·3 으로 정상 표시되고
    `CHANGELOG.md` 의 대응 불릿 순서(exposure-guard → dto-jsdoc-citation-guard →
    secret-absence)와도 일치한다 — 즉 의미나 렌더링 결과가 틀린 것은 아니다. 다만 이
    저장소의 `plan/` 문서는 사람·다른 에이전트가 **원문 텍스트**를 직접 열어 읽는 경우가
    많고, 원문만 보면 "3번 항목이 2번보다 먼저 적혀 있다" 는 인상을 줘 목록이 나중에
    삽입 편집으로 재배치됐다는 오해를 살 수 있다(실제로 `dto-jsdoc-citation-guard.ts` 는
    최신 커밋 `4529812c6` 이 가장 나중에 추가한 축이므로, 번호만 보면 순서 관계가
    헷갈린다).
  - 제안: 세 항목의 번호를 등장 순서대로 `1.`·`2.`·`3.` 으로 고친다(내용은 그대로 두고
    번호만 정정).

## 요약

이번 diff 는 4차례 이상의 리뷰·컨시스턴시 라운드를 거치며 지적된 문서화 결함(오래된 JSDoc
위치, 보안 경계 리터럴 손 복제, e2e 라벨 충돌·순서, stale count, 필드 JSDoc 공개 노출
위반, 검출 축 서술 누락)을 전부 실제로 해소한 상태이며, 이번 라운드에서 코드·주석·수치를
직접 대조해 재확인한 결과 새로운 재발은 없다. `CHANGELOG.md`·`plan` 완료 노트·가드 파일
헤더 JSDoc 은 실측 수치(19곳·46곳·4곳 등)를 실제 코드와 일치시켜 서술하고 있고, 새 가드
3종(`user-entity-exposure-guard.ts`·`user-secret-absence.ts`·`dto-jsdoc-citation-guard.ts`)
모두 "왜 이 방식인가"·"왜 다른 대안을 기각했는가"를 실측과 함께 남겼다. 새로 찾은 유일한
항목은 plan 문서의 번호 목록이 원문 순서상 1·3·2 로 어긋난 것인데, 렌더링 결과나 의미에는
영향이 없는 사소한 표기 문제라 INFO 로 판단한다.

## 위험도

LOW
