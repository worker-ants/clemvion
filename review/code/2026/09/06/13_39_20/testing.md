# 테스트(Testing) 리뷰

## 검증 방법

저장소 파일은 수정하지 않았다(뮤테이션은 코드 읽기 + 정적 추론으로 대체, `git status --short` 로
비변경 확인). 실제로 실행한 것:

- `npx jest src/repo-guards/__tests__/user-entity-exposure.spec.ts src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts src/shared/testing/user-secret-absence.spec.ts src/modules/workflow-versions/workflow-versions.service.spec.ts` — 4 스위트 **40/40 통과**.
- `npx tsc --noEmit -p tsconfig.json` 전체 실행 후 이번 diff 대상 파일명으로 grep — 이번 PR 이
  건드린 파일에서 발생한 타입 오류 **0건**(출력에 있는 `carousel`/`chart`/`table` 노드 관련 오류는
  이 diff 와 무관한 기존 항목).
- `codebase/backend/test/{workflow-crud,workspace-rbac}.e2e-spec.ts` 의 `it('[A-Z]\. ...')` 라벨을
  `grep` 으로 전수 나열 — 두 파일 모두 라벨 중복·순서 이탈 없음(과거 라운드가 지적한 `F.` 중복은
  `H.`(workflow-crud)/`J.`(workspace-rbac)로 이미 해소된 상태를 재확인).
- `jest.config.ts` 의 `testRegex: '.*\\.spec\\.ts$'` 와 `collectTsFiles` 의 기본값
  (`includeSpec: false`)을 대조 — 신규 fixture(`*.fixture.ts`)·가드(`*-guard.ts`)가 각각
  "jest 가 테스트로 오인해 실행"·"가드 자신의 spec 을 스캔 대상에 포함해 자기 오탐"할 위험이
  구조적으로 없음을 확인.
- 직전 6차례 리뷰 라운드(`review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36,12_28_02,12_53_28}`)의
  `testing.md`/`RESOLUTION.md` 를 읽고, 그 라운드들이 지적한 검출력 결함이 이번 최종 상태의
  코드·fixture 에 실제로 반영됐는지 소스를 직접 열어 대조.

## 발견사항

- **[INFO]** (직전 라운드 `12_53_28` INFO#2, 조치 불요로 이미 처분됨 — 재확인만) `enclosingName` 의 `'<module>'` 폴백 분기가 여전히 어떤 fixture 로도 실행되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `enclosingName` 함수의 `return fallback ?? '<module>';` (마지막 줄)
  - 상세: `user-relation-load.fixture.ts` 의 위반 14건은 전부 `export async function ...()` 내부(메서드 분기) 이거나 변수 대입 경유(`violationViaIntermediateVariable`, 변수 폴백 분기)다. 메서드도 변수 선언도 없이 모듈 최상위에서 바로 `repo.findOne(...)` 을 호출하는 형태는 fixture에 없어 `'<module>'` 리터럴이 실제로 반환되는 경로가 테스트되지 않는다. 직전 라운드가 이미 이 지점을 INFO로 지적하며 "조치 불요로 판단해도 무방"이라 처분했고, 이번 라운드까지 그 상태가 그대로 유지된다 — 새로운 결함은 아니며, 프로덕션에서 모듈 최상위 side-effect 호출은 드물어 실질 위험은 낮다.
  - 제안: 여전히 조치 불요로 판단 가능. 다음에 이 가드를 만질 때 함께 채우면 분기 커버리지가 완결된다.

- **[INFO]** `findUserSecretLeaks` 가 응답 본문의 **최상위(루트)** 에 바로 금지 키가 오는 경로를 명시적으로 단언하지 않는다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.spec.ts` — `describe('findUserSecretLeaks', ...)` 블록 전체. 함수 구현은 `codebase/backend/src/shared/testing/user-secret-absence.ts:45-61`(`findUserSecretLeaks`/`walk`).
  - 상세: 8개 테스트 케이스가 전부 `{ data: { user: { ... } } }`/`{ data: { items: [...] } }` 처럼 최소 2단계 이상 중첩된 입력만 쓴다. `walk(body, '')` 호출 시 `trail`이 빈 문자열이면 `here = key`(43줄의 `trail ? ... : key` 분기)가 되어 루트 직속 키도 구조적으로는 잡히지만, `findUserSecretLeaks({ passwordHash: 'x' })` 처럼 **감싸는 봉투 없이 키가 루트에 바로 오는 형태**를 실제로 도는 테스트는 없다. 실 서비스 응답은 전부 `{ data: ... }` 봉투를 쓰므로(다른 e2e 관례와 일치) 실질 위험은 낮지만, 헬퍼 자체의 JSDoc이 "응답 본문 **어디에도**"라고 명시하는 만큼 그 "어디"의 한쪽 끝(깊이 0)이 형태 목록에서 비어 있다.
  - 제안: `expect(findUserSecretLeaks({ passwordHash: 'x' })).toEqual(['passwordHash'])` 한 줄을 기존 describe 블록에 추가해 `trail`이 빈 문자열인 분기를 명시적으로 문다.

## 회귀 테스트 확인

`workflow-versions.service.spec.ts` 상단에 신설된 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto`
스키마 대조 테스트가 두 선언이 손으로 복제되며 다시 갈리는 것(이번 브랜치 자신이 겪은 Critical의
원인)을 앞으로 잡는다. `findOne` 유닛 테스트는 옵션 전체 비교(`toHaveBeenCalledWith`)와 `creator`
투영만 보는 좁은 단언을 의도적으로 중복시켜 "무엇이 양보하면 안 되는 성질인지"를 테스트 이름에
남긴다는 설계 근거가 코드 주석에 있고, 직접 실행(4/4 스위트 통과)으로 뒷받침된다.

`user-entity-exposure.spec.ts`/`dto-jsdoc-citation.spec.ts` 는 6차례 리뷰 라운드에 걸쳐 지적된
검출력 결함 — eager 관계 원리적 미검출(`11_55_36` W1), 겉은 투영 실은 전체 노출(`11_27_53` W2),
중첩 객체 `relations`(`10_53_48` W2), `as`/`satisfies` 캐스트로 인한 술어 무력화(`12_28_02` W1),
`select` 값 쪽 `unwrap` 미검증(`12_53_28` INFO), JSDoc 인용 "날짜+시각" 형태 미검증(`12_53_28`
WARNING) — 이 전부 fixture 로 양성·음성 대조군을 갖추고 있음을 직접 코드를 열어 확인했다. 특히
`12_53_28` WARNING(날짜+시각 정규식이 fixture 로 검증되지 않아 지워도 그린)은 이번 최종 상태의
`jsdoc-citation.fixture.ts`(`avatarUrl` 필드에 `2026-09-05 23_30_01` 형태 추가)와
`dto-jsdoc-citation.spec.ts`(`findCitation`→`findCitations`로 바뀌어 형태별 매치를 전부 반환,
"세 인용 형태가 각각 최소 한 번씩 관측된다" 테스트 신설)로 실제 닫혀 있다 — 재발 없음.

신규 e2e(`workflow-crud.e2e-spec.ts` "H.", `workspace-rbac.e2e-spec.ts` "J.")는 각각 버전
0개·멤버 1명일 때 후속 단언이 vacuous 해지는 것을 막는 사전 조건(`toBeGreaterThanOrEqual(1)`,
`toHaveLength(2)`)을 갖추고, 이름 기반 부재 축(`expectNoUserSecrets`)을 계약 대조 축
(`assertMatchesContract`)보다 먼저 실행해 "계약 위반이 먼저 던져 이름 축이 실행조차 안 되는" 순서
함정을 피한다는 근거가 주석에 있으며, CHANGELOG의 "뮤테이션으로 두 축을 각각 확인했다" 절과 부합한다.
mock 은 `WorkflowVersionsService` 유닛 테스트에서만 쓰이고(표준 NestJS 리포지토리 mock, 실제
TypeORM 동작과의 괴리 없음), 새 가드 3종의 spec 은 전부 mock 없이 실제 파일 시스템(fixture)을
읽는 mock-free 구조다. 테스트 간 의존성은 없다 — 각 e2e 는 `uniqueEmail`/`uniqueName` 으로 고유
자원을 생성하고, 가드 spec 은 순수 함수 호출만 한다.

## 요약

이 PR은 이미 6차례의 `/ai-review`+`/consistency-check` 라운드를 거치며 검출력 결함을 반복적으로
찾아내고 fixture·뮤테이션으로 닫아 온 이력이 있고, 이번 최종 상태를 직접 실행·대조한 결과 그
전부가 실제로 반영돼 있음을 확인했다(대상 4개 스위트 40/40 통과, 신규 파일 tsc 오류 0건, e2e
라벨 중복 없음). 새로 찾은 것은 낮은 우선순위의 분기 커버리지 갭 2건뿐이다 — 하나는 직전 라운드가
이미 "조치 불요"로 처분한 항목의 재확인(`enclosingName`의 `'<module>'` 폴백), 다른 하나는 이번
라운드에서 처음 발견한 것으로 `findUserSecretLeaks`가 최상위(깊이 0) 키를 잡는 경로가 구조적으로는
동작하지만 어떤 테스트로도 명시적으로 관측되지 않는다는 점이다(실제 응답이 전부 봉투 구조라 실질
위험은 낮음). 두 건 다 즉시 조치를 요구할 정도는 아니다.

## 위험도

LOW
