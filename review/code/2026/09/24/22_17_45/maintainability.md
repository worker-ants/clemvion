# 유지보수성(Maintainability) 리뷰

## 리뷰 범위 확인

실제 프로덕션 코드 변경은 없다. `git diff --stat origin/main..HEAD -- codebase/` 결과
`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1개 파일, +48 줄만
바뀌었다(테스트 2건 추가). 나머지 대상은 `CHANGELOG.md`(문서), `plan/in-progress/remove-member-order-coverage.md`(신규 plan 문서), `review/consistency/2026/09/24/22_01_45/*`(직전 `/consistency-check` 실행이 산출한 리포트 파일)다. 뒤의 리뷰 산출물들은 규약상 `review/**`에 쌓이는 자동 생성 감사 자료이며 유지보수성 관점의 "소스 코드"가 아니므로 본 리뷰의 대상 밖으로 판단했다(내용 확인 결과 표/서술 형태의 정적 보고서일 뿐 코드 스멜 대상이 아님).

## 환경 관측 (PR diff 와 무관, 보고 의무)

리뷰 도중 `git status --short` 로 확인한 결과 **`codebase/backend/src/modules/workspaces/workspaces.service.ts` 가 워킹트리에서 미커밋 상태로 수정돼 있었다** (`M`, staged 아님). 그 diff 는 plan 문서(`remove-member-order-coverage.md` §B, M-a 행)가 기술한 뮤턴트 — "대상 null 검사를 admin 판정 뒤로 내리고 self 비교를 `member?.userId` 로 바꾼다" — 와 정확히 일치한다(`if (!member) this.throwMemberNotFound();` 를 admin 판정 뒤로 이동 + `member.userId === requesterId` → `member?.userId === requesterId`). 이는 이 세션이 읽은 diff/plan 이 이미 실측·원복까지 마쳤다고 기록한 바로 그 뮤턴트이므로, **병렬로 도는 다른 프로세스(다른 reviewer 또는 뮤테이션 재실행)가 같은 공유 워크트리에서 지금 이 순간에도 그 실험을 다시 대입 중**인 것으로 보인다. 본 세션은 이 파일을 직접 수정하지 않았고, 규약상 `git checkout`/`restore` 로 되돌리는 것도 금지돼 있어 그대로 두었다. 이 상태에서 다른 검사(예: 정적 분석·빌드)가 돈다면 일시적으로 `MEMBER_NOT_FOUND` 대신 `ADMIN_REQUIRED` 가 나가는 동작을 관측할 수 있으니, 이 항목을 결함으로 재조사하지 말고 통합 시점에 `git status --short` 로 재확인할 것.

## 발견사항 (PR diff 대상)

- **[INFO]** 새 테스트 2건의 주석 대 코드 비율이 매우 높다(첫 테스트는 JSDoc 14줄 대 본문 6줄, 둘째는 10줄 대 9줄).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1783-1806`(비-admin이 없는 대상을 지목하면 MEMBER_NOT_FOUND), `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1808-1829`(요청자 role 을 한 번만 조회한다)
  - 상세: 각 테스트 앞에 판정 순서의 배경·반례·설계 트레이드오프까지 담은 장문 JSDoc이 붙어 있다. 다만 이는 새로 도입된 스타일이 아니라 같은 `describe('removeMember — 동시 제거', …)` 블록의 기존 테스트들(예: `wireFindOne` 헬퍼 주석 `:1472-1482`, `진 쪽은 404 이고 감사를 남기지 않는다` 앞 주석 `:1541-1554`, `DELETE 시점에 대상이 owner 로 승격됐으면 403` 앞 주석 `:1573-1580`)이 이미 확립한 관례와 동일한 밀도다. 팀이 의도적으로 "판별력 근거를 주석에 남긴다"는 컨벤션을 쓰고 있어 일관성은 지켜졌다.
  - 제안: 조치 불필요. 다만 향후 이 블록에 테스트가 더 늘어나면 배경 설명을 파일 상단 또는 describe 블록 head 주석으로 한 번만 모으고 각 테스트에는 차이점만 남기는 리팩터링을 고려할 만하다(지금은 6개 테스트 수준이라 이르다).

- **[INFO]** 새 필터 콜백의 인라인 타입과 변수 네이밍이 기존 자매 패턴을 그대로 재사용했다 — 긍정적 일관성 확인.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1823-1827`(`requesterLookups`)
  - 상세: 동일 파일의 기존 `targetLookups` 패턴(`:1712-1715`, `(c: [{ where?: { id?: string } }]) => c[0]?.where?.id === memberId`)과 구조·네이밍(`XLookups`)·타입 형태가 완전히 대칭이다. 새 코드가 `where.userId`로 필터 축만 바꿔 재사용했다. 결함이 아니라 좋은 선례를 따른 사례로 기록해 둔다.
  - 제안: 없음.

- **[INFO]** CHANGELOG 신규 항목과 plan 문서 신규 파일 모두 리포지토리의 기존 포맷(제목 `## Unreleased — …하던 것`, `**판별력 실측**` 소제목, frontmatter 필드 `title/status/owner/worktree/spec_impact/started`)을 정확히 따른다(`plan/complete/member-auth-order.md`와 대조 확인).
  - 위치: `CHANGELOG.md:3-24`, `plan/in-progress/remove-member-order-coverage.md:1-8`
  - 상세: 별도 조치 불필요. 컨벤션 준수를 확인한 기록으로만 남긴다.

## 요약

이번 변경은 프로덕션 코드를 건드리지 않고 `workspaces.service.spec.ts`에 판정 순서의 빈 두 칸(대상 존재→admin, 요청자 role 1회 조회)을 메우는 테스트 2건만 추가한 순수 테스트 보강 PR이다. 새 테스트는 이름·주석 스타일·목(`wireFindOne`)·필터 콜백 타입까지 같은 describe 블록의 기존 관례를 정확히 재사용해 가독성·네이밍·일관성 어느 축에서도 이질감이 없고, 함수 길이·중첩·매직 넘버·중복·복잡도 문제도 발견되지 않았다. 유일하게 언급할 만한 것은 테스트당 주석 비중이 높다는 점인데, 이는 파일 전체가 이미 채택한 "판별력 근거를 주석에 남긴다"는 의도된 컨벤션과 일치하므로 감점 요인이 아니다. 별도로, 리뷰 중 공유 워크트리에서 `workspaces.service.ts`가 plan 문서의 뮤턴트(M-a)와 동일한 형태로 미커밋 수정된 상태를 관측했다 — 이 세션이 만든 변경이 아니며 PR diff 판정과는 무관하다(위 "환경 관측" 참조).

## 위험도
NONE
