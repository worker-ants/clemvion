# 문서화(Documentation) 리뷰 — `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정 (재리뷰, 이전 리뷰 `12_57_05` 조치 반영 후)

## 검토 방법

`origin/main...HEAD` 전체 diff(28개 파일: `codebase/` 3 + `plan/` 2 + `review/code/2026/09/21/12_57_05/**` 15 +
`review/consistency/2026/09/21/12_23_48/**` 8)를 프롬프트 번들 + `Read`/`Bash`(`grep -n`, `sed -n`)로 워킹트리
원본과 대조했다. 이전 문서화 리뷰(`review/code/2026/09/21/12_57_05/documentation.md`)가 이미 핵심 3개 코드
파일을 상세히 검토했고, 그 리뷰의 WARNING/INFO는 `RESOLUTION.md`에 따라 이번 diff에서 조치됐다
(`throwMemberNotFound()` 추출·`getAudit()` 통합·`ADMIN_REQUIRED` 테스트 추가·`removeMember()` JSDoc 한 문장
추가). 이번 리뷰는 (1) 그 조치들이 실제로 정확한지 재확인하고, (2) 조치 이후에도 남아 있는 새 문서화 갭을 찾는다.

## 발견사항

- **[WARNING]** 이번 PR이 추가한 신규 e2e 파일이, 이미 등재된 "다섯 `*-delete-concurrency.e2e-spec.ts`가 spec
  frontmatter에 없다"는 트래커 항목의 열거를 갱신하지 않아 그 항목이 착수 즉시 stale해졌다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4927`
    (`- [ ] **다섯 `*-delete-concurrency.e2e-spec.ts` 가 어느 spec 의 `code:` frontmatter 에도 없다**`)
  - 상세: 이 항목은 `workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency.e2e-spec.ts`
    다섯 개를 이름까지 명시해 "형제 넷을 만들 때마다 같은 누락이 반복됐다"고 적는다. 이번 PR이 새로 추가한
    `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`도 같은 성질(동시 삭제 결함 클래스의 e2e,
    어떤 spec의 `code:` frontmatter에도 등재되지 않음 — `grep -rl member-remove-concurrency spec/` 결과 0건으로
    확인)을 그대로 갖는데, 이 항목의 열거·개수·설명이 갱신되지 않았다. 게다가 새 파일명은 그 항목이 쓴 글롭
    패턴(`*-delete-concurrency.e2e-spec.ts`, "명사-`delete`-concurrency" 어순)과 문자 그대로도 어긋난다
    (`member-remove-concurrency`, "명사-`remove`-concurrency" 어순) — 그 글롭으로 향후 검색해도 이 파일은
    걸리지 않는다. 아이러니하게도 이 정확한 실수 패턴("경로 수를 세지 말라"는 것도 잊고 좁게 세는 것)을 바로
    이 diff 자신이 §A와 followups.md의 다른 항목(4816~4926행, `2-api-convention.md §3` 각주 항목)에서 두 차례
    명시적으로 경계하고 고쳤다 — 그런데 정작 인접한 이 항목은 같은 세션에서 건드리지 않고 지나쳤다.
  - 제안: 이 항목을 "다섯" → "여섯"으로 갱신하고 `member-remove-concurrency.e2e-spec.ts`를 목록에 추가하거나,
    이번 diff가 다른 유사 항목에서 이미 채택한 방식대로("경로 수를 세지 말라") 개수를 명시하지 않는 서술로
    바꾼다. `low` 우선순위 항목이라 이번 PR을 막을 사유는 아니지만, 같은 세션에서 이미 두 번 적용한 교훈을
    바로 옆 항목에는 적용하지 않은 누락이라 기록해 둔다.

## 확인한 항목 (문제 없음 — 이전 리뷰 조치 검증)

- **`throwMemberNotFound()` JSDoc**(`workspaces.service.ts:332-341`): "`updateMemberRole` · `removeMember`
  (두 판정)까지 세 곳에 복제돼 있었다"는 서술을 실제 호출부(`:310`, `:803`, `:830` 상당)와 대조 — 정확하다.
  `transferOwnership()`의 별도 메시지를 재사용하지 않는다는 설명도 실제 코드(`transferOwnership` 내
  "대상 멤버를 찾을 수 없습니다.")와 일치한다.
- **`removeMember()` JSDoc의 동시성 보장 문장** (신규 추가, `:789-793`): "잠글 행이 없어 동시 제거 두 건이
  모두 검사를 통과할 수 있지만, 단일 원자적 `DELETE`가 승자만 갈라 감사 로그 중복을 막는다"는 실제 구현
  (무락 `findOne` → `delete({id, workspaceId})` → `affected===0` 판정)과 정확히 일치한다. 형제 메서드
  (`transferOwnership`) 수준의 문서화 밀도를 요구했던 이전 리뷰 INFO가 정확히 해소됐다.
- **`getAudit()` 헬퍼 통합**(`workspaces.service.spec.ts:32-40`): 새 JSDoc이 "종전엔 형제 `describe` 블록
  (`audit logging (결정4=B)` · `removeMember — 동시 제거`) 둘이 바이트 단위로 동일한 지역 함수를 각자
  갖고 있었다"고 과거형으로 서술 — 실제로 지역 정의 두 곳이 제거되고 최상위 스코프 정의 하나만 남은 현재
  상태와 일치한다(중복 재발 없음, `grep -n "function getAudit"` 결과 1건).
  - `WS`/`MEMBER_ID`/`REQUESTER` 로컬 상수도 실제로 `workspaceId`/`memberId`/`requesterId` camelCase로
    바뀌어 파일 전역 컨벤션과 통일됐다(이전 리뷰 INFO 8 조치 확인).
- **`ADMIN_REQUIRED` 회귀 테스트**(`workspaces.service.spec.ts:1559-1576`): 신규 JSDoc이 "검사 순서에
  결합하지 않는다"고 선언하고 실제로 `wireFindOne`의 두 번째 인자(요청자 멤버십)만 `role: 'editor'`로
  바꿔 "`ADMIN_REQUIRED`로 거부되고 `delete`가 호출되지 않는다"는 불변만 단언한다 — 서술과 구현이 정확히
  일치한다. `wireFindOne` 자체의 JSDoc("`findOne`을 두 번 부른다 — 대상 멤버(`where.id`)와 `assertAdmin`이
  부르는 요청자 멤버십(`where.userId`)")도 `assertAdmin` → `getMemberRole` → `findOne({where:{workspaceId,
  userId}})` 호출 경로와 대조해 정확하다.
- **`RESOLUTION.md`/`_resolution_log.md`/`_resolution_state.json` 상호 정합성**: 세 파일이 기록하는
  SUMMARY 항목 번호·조치 커밋(`f022ae9fd`, `65b082596`)·escalation 사유가 서로 어긋나지 않는다. 뮤테이션
  검증 절 "대상: … `await this.assertAdmin(…)` 호출(:815, 파일 내 유일 컨텍스트로 확인)"도 실제 파일에서
  `assertAdmin` 호출이 정확히 그 줄(`:815`)에 있고 파일 내 다른 4곳(`:257,306,355,389`)과 컨텍스트로
  구분됨을 확인했다.
- **stale 주석 제거**: 삭제된 `remove(member)` 호출 위에 있던 주석(`// remove() 는 in-memory id 를
  지우므로…`)이 새 `delete()` 경로에 맞지 않아 diff에서 함께 제거됐다 — 옛 주석이 새 코드와 불일치한 채로
  남지 않았다.
- **API 문서(Swagger) 갱신 불요 확인**: `workspaces.controller.ts`의 `removeMember` 엔드포인트는
  `@Delete`에 `@HttpCode`가 없어 Nest 기본값 200을 반환하고(`@Delete` 데코레이터 default), 실제로
  `{data:{ok:true}}`를 리턴한다 — e2e 테스트·plan 문서의 "200 아니라 204가 아니다" 서술과 일치. 다만
  `@ApiOperation.description`이 동시 요청 패자의 404는 언급하지 않는데, 이는 이미 별도 WARNING(spec 문서
  미반영, `9-user-profile.md §6.1`·`data-flow/12-workspace.md §1.6`)으로 트래킹 중인 사안과 동일 계열이라
  중복 등재하지 않는다.
- **README/CHANGELOG**: 새 환경변수·설정 옵션·공개 시그니처 변경 없음(에러 코드·응답 shape·엔드포인트
  전부 기존 재사용). 갱신 불요 — 본 저장소는 `plan/complete/`를 이력으로 쓰는 관례이고 이번 plan이 그
  역할을 충분히 수행한다(이전 리뷰와 동일 결론, 변경 없음).
- **`review/code/2026/09/21/12_57_05/**`·`review/consistency/2026/09/21/12_23_48/**` 신규 파일 18건**:
  developer/consistency-check 워크플로의 표준 산출 아티팩트이며 `CLAUDE.md` 정보 저장 위치 표(`review/code/`,
  `review/consistency/`)를 그대로 따른다. 이 파일들 자체는 특정 시점의 리뷰 스냅샷이라 이후 코드가 바뀌면서
  일부 인용 줄 번호가 현재 파일과 어긋나는 것은(예: `requirement.md`가 인용한 `:797-799`가 현재는
  `throwMemberNotFound()` 삽입으로 몇 줄 밀렸을 수 있음) 통상적이며, 이 저장소가 이런 아티팩트를 "영구
  갱신되는 문서"가 아니라 "타임스탬프 찍힌 이력"으로 취급하는 기존 관례(과거 5개 형제 PR 전부 동일)와
  일치한다 — 별도 결함으로 보지 않는다.

## 요약

핵심 코드 변경(`removeMember()`의 원자적 `DELETE` + `affected===0` 판정 전환)은 이전 리뷰(`12_57_05`)가 지적한
문서화 WARNING·INFO(`throwMemberNotFound()` 중복, `getAudit()` 중복 정의, `ADMIN_REQUIRED` 테스트 부재,
`removeMember()` JSDoc 동시성 계약 누락)가 모두 정확하게 조치됐음을 코드 대조로 확인했다 — 새 JSDoc·주석은
실제 구현과 문구 단위로 일치한다. 새로 발견한 유일한 갭은 이번 PR이 추가한 6번째 유사 e2e 파일
(`member-remove-concurrency.e2e-spec.ts`)이 spec `code:` frontmatter 미등재 상태인데, 정확히 같은 성질의
5개 형제 파일을 열거해 둔 기존 백로그 항목(`spec-draft-nullable-notation-followups.md:4927`)이 개수·이름·
글롭 패턴 모두 갱신되지 않아 착수 즉시 stale해졌다는 점이다 — 이 diff 자신이 다른 자리에서 두 번이나 "개수를
세지 말라"는 교훈을 실천했음에도 이 항목만 놓쳤다. 우선순위는 낮고 병합을 막을 사유는 아니다. API 계약 변경
(동시 DELETE 패자 404)이 소유 spec 문서(`9-user-profile.md`·`data-flow/12-workspace.md`)에 아직 반영되지
않은 것은 이미 트래커에 등재돼 후속 planner 턴으로 명시적으로 넘겨진 재확인 사안이라 신규 발견이 아니다.

## 위험도

LOW
