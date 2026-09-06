# 문서화(Documentation) 리뷰

## 개요

이 diff(`origin/main...HEAD`, 9개 커밋 — `96d3856a9`~`a185846a5`)는 `User` 엔티티 컬럼
노출을 검출하는 3축 가드(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts`
이름 축, `dto-jsdoc-citation-guard.ts` JSDoc 인용 축), `WorkflowVersionsService.findOne` 의
실유출 수정(`CREATOR_PROJECTION`/`ProjectedCreator`), `WorkspaceMemberDto.joinedAt` 필드
추가, `review_guard._parse_frontmatter_code` 파서 결함 2건 수정(줄 전체 주석·빈 줄 →
트레일링 같은-줄 주석), 그리고 `TriggersService` 의 엔드포인트 경로 충돌 응답 계약 이행으로
구성된다. 이미 8차례의 `/ai-review`+`/consistency-check` 라운드(`10_13_22`→`14_25_40`)를
거쳤고, 이번 최종 라운드에서 실제 코드·CHANGELOG·plan 완료 노트·spec Rationale·테스트를
직접 열어 대조했다.

과거 라운드가 지적한 문서화 결함 — JSDoc orphan 블록(`findEagerUserRelations` 위에
`collectUserRelationNames` 설명이 얹혀 있던 것), e2e 라벨 중복(`F.`), `UserRelationLoad.line`
미사용 필드, `dto-jsdoc-citation.spec.ts` fixture 경로 3곳 인라인 중복, plan 완료 노트의
번호 목록 순서(1·3·2), `_parse_frontmatter_code` docstring 이 새 skip 동작을 요약하지 않던
것 — 은 전부 실제로 해소돼 있음을 코드를 직접 열어 재확인했다(재발 없음).

새로 찾은 것은 아래 한 건(WARNING)뿐이다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 최종 커밋의 두 축 중 하나(트레일링 같은-줄 주석 파서 결함)를
  누락했다 — 같은 커밋의 다른 축(트리거 엔드포인트 충돌)은 실었다
  - 위치: `CHANGELOG.md` — `## Unreleased — \`User\` 엔티티에 마지막 방어선을 세운다 (검출
    3축)` 절 전체(파일 상단부, `### 넓어진 게이트가 곧바로 부채 하나를 물었다` 소절 직후에서
    끝남). 비교 대상: 커밋 `a185846a5`의 커밋 본문 `## 파서 수정이 또 한 칸 좁았다` 절
    (`git show a185846a5`).
  - 상세: 커밋 `a185846a5`(이 브랜치의 마지막 커밋)는 서로 독립된 두 개의 `##` 레벨
    안건을 담고 있다 — (1) 트리거 `endpoint_path` UNIQUE 충돌의 `details` 계약 이행, (2)
    `review_guard._parse_frontmatter_code` 의 **트레일링 같은-줄 주석**(`- a.ts  # 비고`)이
    "값의 일부로 남아 어떤 파일과도 매치되지 않는 죽은 glob 이 되는" 결함 수정
    (maintainability·testing 두 reviewer 가 정규식을 직접 실행해 독립 재현,
    `review/code/2026/09/06/14_25_40` W1). 같은 커밋이 `CHANGELOG.md` 에 26줄을 추가했는데,
    그 추가분은 (1)만 담고 (2)는 전혀 언급하지 않는다 — `git show a185846a5 -- CHANGELOG.md`
    로 확인. 반면 (2)는 커밋 메시지 자체·`.claude/hooks/_lib/review_guard.py` 의 docstring
    (`_strip_comment` 관련 문단)·`.claude/tests/test_review_guard.py` 의 신규 테스트 4건·
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(437행
    "`code:` 파서 두 벌을 golden fixture 코퍼스로 묶는다" 항목, "이번에 닫은 것은 그중 두
    형태(줄 전체 주석·빈 줄, **트레일링 주석**)뿐이다" 로 명시)에는 전부 남아 있다. 이
    저장소의 CHANGELOG 관례(같은 절 안에서 이미 "빈 줄·주석 skip" 파서 결함 1건을 690→731
    표와 함께 상세히 서술한 선례)에 비춰 보면, 같은 파서의 **두 번째 결함**(첫 수정이 "한 칸
    좁았던" 결과)이 같은 절에 이어지지 않고 통째로 빠진 것은 이 문서를 감사 기록(audit
    trail)으로 신뢰하는 다음 독자에게 "파서 결함은 하나였고 다 닫혔다" 는 불완전한 인상을
    준다. 실질적 피해(731 대 731 수치 자체는 두 수정 후에도 여전히 정확 — 현재 저장소에
    트레일링 주석이 실제로 붙은 `code:` 항목은 없음을 grep 으로 확인)는 없지만, 이 프로젝트가
    CHANGELOG 를 "왜 이렇게 됐는가" 의 1차 SoT 로 쓰는 관례(같은 파일의 다른 모든 절이 이
    수준의 서사를 담는다)에 비춰 완결성 갭이다.
  - 제안: `CHANGELOG.md` 의 `### 그 등재가 게이트를 껐다 — 그리고 그것이 이미 꺼져 있었다`
    절 뒤(또는 새 소절)에 트레일링 같은-줄 주석 결함과 그 수정(테스트 4건, 731 대 731
    재확인)을 한 단락으로 추가한다 — 이미 커밋 메시지에 있는 서사를 그대로 옮기면 된다.

## 요약

이번 diff의 문서화 품질은 이례적으로 높다. `CREATOR_PROJECTION`/`ProjectedCreator`/
`UnloadedRelations`/`USER_SECRET_KEYS`/`findEagerUserRelations`/`collectUserRelationNames`/
`isEndpointPathUniqueViolation` 등 신규 공개 함수·타입·상수 전부가 "왜 이 방식인가"·"왜
다른 대안을 기각했는가"를 실측 수치(19곳·46곳·4곳·19/16·731 대 731 등)와 함께 남기고, 그
수치를 실제 코드(`workspaces.service.ts` 3곳 + `workspace-invitations.service.ts` 1곳의
`joinedAt: new Date()`, `V001__initial_schema.sql:57` 의 `joined_at TIMESTAMPTZ`)와 대조해
정확함을 확인했다. `spec/conventions/review-citations.md`·`spec-impl-evidence.md` 의 자기
반증형 소정정 두 건은 CLAUDE.md 규약(취소선 보존 + 축 단위 정정 + `git blame` 으로 조건 1
확인 불가 시 planner 턴 개방)을 모범적으로 따랐다. e2e 라벨(`H.`/`J.`)·plan 체크박스·
`workspace-rbac.e2e-spec.ts` 헤더의 spec 절 인용(`§1.3`→`§3`) 등 과거 라운드 지적 사항은
전부 재확인 결과 재발이 없었다. 유일하게 새로 찾은 것은 최종 커밋이 담은 두 안건 중 하나
(트레일링 같은-줄 YAML 주석 파서 결함)가 커밋 메시지·plan·코드 docstring·테스트에는
서술돼 있으나 `CHANGELOG.md` 에는 반영되지 않은 완결성 갭으로, 렌더링·판정 결과에는 영향이
없는 WARNING 이다.

## 위험도

LOW
