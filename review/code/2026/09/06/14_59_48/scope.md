# 변경 범위(Scope) 리뷰

## 개요

이 브랜치(`claude/user-entity-column-defense`, `origin/main...HEAD`, 커밋 `bfa124920`~
`a185846a5` 총 10개)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
등재 항목("`User` 엔티티에 컬럼 수준 방어를 둘지 결정")에서 출발했다. `git diff --stat`
기준 222개 파일·20,150줄 삽입 중 약 200개 파일은 `review/code/**`·`review/consistency/**`
리뷰 라운드 산출물(10회 코드 리뷰 + 다수 consistency 라운드)이며, 저장소 관례상 이는 정상
워크플로 부산물이다. 실제 애플리케이션/하네스 코드는 약 17개 파일이다.

**이 라운드 이전에 이미 `review/code/2026/09/06/14_25_40/scope.md` 가 같은 브랜치를 상세히
검토해**, 원래 목표(User 컬럼 방어: `user-entity-exposure-guard.ts`/`user-secret-absence.ts`
2축 + 소비 e2e, `WorkspaceMemberDto.joinedAt` 계약 정정, `WorkflowVersionsService.findOne`
실유출 수정) 밖으로 연쇄 확장된 3개 층 — (1) `dto-jsdoc-citation-guard.ts`(별개 관심사:
JSDoc 리뷰-인용 유출) (2) 그 등재 과정에서 드러난 `review_guard.py` frontmatter 파서 버그
수정 (3) 그 하네스 수정이 반증한 `spec/conventions/review-citations.md`·
`spec-impl-evidence.md` 문서 정정 — 을 WARNING/INFO 로 기록하고 LOW 위험으로 종결했다.

**이번 라운드의 핵심은 그 확장이 최신 커밋(`a185846a5`, 14:59:37)에서 4단계로 더 이어졌다는
것**이다 — (3)의 파서 수정이 `workspace-response.dto.ts` 를 처음 spec-linked 로 만들며
`--impl-done` 게이트 범위가 `spec/2-navigation/` 까지 넓어졌고, 그 라운드가 **완전히
무관한 트리거 도메인의 기존 부채**(`2-trigger-list.md §3` 이 약속한
`TRIGGER_ENDPOINT_PATH_CONFLICT` 가 코드에 0건)를 찾아냈다. developer 는 이를 **이번 같은
브랜치 안에서 즉시 구현**했다.

## 발견사항

- **[WARNING]** 최신 커밋이 "User 엔티티 컬럼 방어"와 무관한 신규 프로덕션 동작(트리거
  endpoint-path 충돌 시 세부 에러 코드)을 이 브랜치에 추가했다 — 4단계 연쇄 확장의 최신 층
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `isEndpointPathUniqueViolation`(신규 함수, `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 포함) 및 `rethrowEndpointPathConflict`(신규 private 메서드), `create`/`update` 양쪽에 `.catch(...)` 배선. 커밋 `a185846a5`.
  - 상세: 이 변경은 `2-trigger-list.md §3` 이 문서화한 `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드가 실제로는 전역 예외 필터의 `RESOURCE_CONFLICT` 로만 나가고 있었다는, `User` 컬럼 노출과 전혀 다른 도메인(트리거 endpoint 유일성)의 기존 계약 갭이다. 커밋 메시지가 밝히듯 이 결함은 "이 PR 이 만든 것이 아니라" 직전 커밋(harness 파서 수정)이 `--impl-done` 게이트 범위를 넓혀 우연히 드러난 것이고, `14_25_40/scope.md` 가 이미 지적한 "JSDoc 가드 → 하네스 파서 → spec 문서" 3단 연쇄에 "→ 무관 도메인 프로덕션 기능 구현"이 4번째 층으로 이어졌다. 뮤테이션 검증(인덱스명 제거 2 RED, `details.subCode` 제거 2 RED)까지 갖춘 견실한 구현이고 상태 코드를 바꾸지 않는 순수 additive 라 기능적 결함은 없지만, 이전 세 층(검출 가드·테스트·문서 정정)과 달리 이번 층은 **실제 API 응답 바디의 새 필드(`details.subCode`)를 추가하는 프로덕션 동작 변경**이라는 점에서 앞선 층들보다 성격이 무겁다.
  - 제안: 기능·테스트 품질은 충분하므로 되돌릴 필요는 없으나, 머지/릴리스 노트 작성 시 "User 컬럼 방어 PR" 이 아니라 "User 컬럼 방어 + JSDoc 인용 가드 + harness 파서 수정 + 트리거 endpoint 충돌 세부화, 서로 다른 4개 관심사가 한 커밋 계열에 있다"는 전제로 다뤄야 한다. 다음에 유사한 연쇄가 시작되면(게이트가 넓어져 무관 부채가 드러나는 패턴) 해당 항목만 별도 브랜치/PR 로 분리하는 편이 리뷰 단위를 좁힌다 — 이 패턴이 벌써 두 번(JSDoc 가드 유발, 이번 트리거 유발) 반복됐다.

- **[INFO]** 하네스 파서 수정(`review_guard.py`)이 이번 라운드에서 추가로 확장됨 — 이미 WARNING 으로 기록된 항목의 연속
  - 위치: `.claude/hooks/_lib/review_guard.py`(`_strip_comment` 를 `_clean`/`rest` 두 지점에 적용), `.claude/tests/test_review_guard.py`(신규 테스트 4건). 커밋 `a185846a5`.
  - 상세: `14_25_40/scope.md` 가 이미 이 파일의 이전 수정(`8b67300b5`)을 "애플리케이션 기능 브랜치에 섞인 하네스 인프라 버그 수정"으로 WARNING 처리했다. 이번 커밋은 같은 파일의 같은 함수(`_parse_frontmatter_code`)를 트레일링 주석 케이스까지 추가로 고친 것으로, 새로운 관심사는 아니고 기존 WARNING 의 자연스러운 연속이다. 회귀 테스트·저장소 전수 재확인(731 대 731)을 갖춰 품질은 충분하다.
  - 제안: 조치 불요 — 기존 WARNING 판단이 그대로 적용된다.

- **[INFO]** 이전 라운드가 지적한 e2e 라벨 충돌(`F.` 중복)이 이번 diff 상태에서 해소되어 있음을 확인
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 현재 라벨 시퀀스는 `A, S, B, C, D, E, F, G, H, I, J` 로 신규 `GET /:id/members` 케이스가 `J.` 로 명명되어 중복이 없다(직접 grep 으로 확인).
  - 상세: `review/code/2026/09/06/10_13_22/maintainability.md`·`scope.md` 가 지적한 "신규 `F.` 케이스가 기존 `F. sole owner …` 와 충돌" 문제가, 이후 라운드에서 새 미사용 문자(`J`)로 재명명되어 해소됐다. 재발 없음.
  - 제안: 조치 불요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가(곁가지)는 이전 라운드 판정 그대로 유지 — 신규 이슈 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 이번 diff 에서 이 항목은 이전 라운드(`review/code/2026/09/06/10_13_22/scope.md` INFO)에서 이미 "핵심 목표 밖 곁가지지만 CHANGELOG·DTO 주석·plan 노트 세 군데에서 투명하게 disclose 됨"으로 판정됐고, 이번 diff 에서 그 상태가 변하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 편집은 이전 라운드가 이미 절차 준수를 확인한 항목 — 신규 발견 없음
  - 위치: `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`
  - 상세: `14_25_40/scope.md` INFO 항목이 "자기증명형 소정정 예외의 부적용을 스스로 판정하고 planner 턴을 열었다"는 절차 준수를 이미 확인했다. 이번 라운드에서 추가 변경이나 새로운 위반은 관측되지 않았다.
  - 제안: 조치 불요.

## 요약

브랜치 핵심 산출물(User 컬럼 방어 2축 가드 + 소비 e2e, `WorkspaceMemberDto.joinedAt` 정정,
`WorkflowVersionsService.findOne` 실유출 수정)은 여전히 원래 목표에 정확히 대응한다. 이전
라운드(`14_25_40`)가 지적한 3단 연쇄 확장(JSDoc 인용 가드 → harness 파서 수정 → spec 규약
문서 정정)에 더해, 이번 라운드에서 확인된 **4번째 층**(harness 게이트가 넓어지며 드러난
무관 도메인 — 트리거 endpoint-path 충돌 — 의 프로덕션 코드 구현)이 새로 추가됐다. 각 층은
실측·뮤테이션 테스트·커밋 메시지 근거를 모두 갖췄고 은폐는 없으나, 이번 4번째 층은 검출용
가드/테스트/문서 정정에 그쳤던 앞선 세 층과 달리 **API 응답 바디에 새 필드를 추가하는
프로덕션 동작 변경**이라 성격이 더 무겁다. 이전 라운드가 지적한 e2e 라벨 충돌은 이번 diff
에서 이미 해소된 상태로 확인됐다. 무관한 포맷팅·주석 정리·불필요한 임포트 변경 등 전형적인
"저지레" 형태의 스코프 이탈은 이번 라운드에서도 발견되지 않았다.

## 위험도

MEDIUM
