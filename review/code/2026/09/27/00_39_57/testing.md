# 테스트(Testing) 리뷰 — workflow-version-creator (2R)

## 범위 확인

이번 라운드(00_39_57)의 diff 는 실제 코드 변경(파일 1~9)에 더해, **1R(`review/code/2026/09/27/00_20_58`)·`--impl-prep`
consistency check(`review/consistency/2026/09/26/23_55_27`) 산출물 전체(파일 10~30)** 를 포함한다. 후자는 harness 가
생성한 리뷰 리포트/plan 문서로 테스트 대상 코드가 아니므로 이 리뷰의 관점 밖이다 — 실측 대상은 파일 1~9(DTO ·
서비스 · 세 spec 파일 · e2e · CHANGELOG · plan)로 좁혔다. 저장소에 뮤테이션은 가하지 않았다(읽기만 수행,
`git status --short` 확인 결과 세션 디렉터리 외 변경 없음).

1R 의 유일한 WARNING(`changeSummary` null 값을 wire 로 대조하는 테스트 부재)이 `69b1afca0` 로 조치됐는지 실제
소스(`workflow-crud.e2e-spec.ts`)를 직접 Read 로 열어 확인했다 — 아래 참고.

## 발견사항

- **[INFO]** `changeSummary` 가 `null` 인 wire 응답의 계약 대조가 **목록(List) 엔드포인트에만** 있고 상세(Detail)
  엔드포인트에는 없다 — 1R WARNING 이 부분적으로만 닫혔다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 테스트 `I`(게이트 611~664행, 특히 638~646행) vs 테스트
    `H`(게이트 536~601행)
  - 상세: 테스트 `I` 는 `changeSummary` 를 생략한 버전을 **목록**(`GET .../versions`)으로 조회해
    `expect(versions[0].changeSummary).toBeNull()` 양성 단언 + `assertMatchesContract(versions[0], contractForDto(WorkflowVersionListItemDto))` 로 null 값 wire 를 실제로 검증한다(1R WARNING 조치, 정확히 의도대로 동작). 그런데
    테스트 `I` 는 복원(`restore`) 응답만 `CanvasSaveResultDto` 와 대조하고 끝나며(게이트 648~663행), **`GET
    .../versions/:versionId` 상세 엔드포인트를 그 null 버전으로 다시 호출하지 않는다.** 테스트 `H` 는 상세를
    `assertMatchesContract(..., WorkflowVersionDto)` 로 대조하지만 그때 값은 `changeSummary: 'v1'`(게이트 562행,
    non-null)뿐이다. 결과적으로 "`WorkflowVersionDto`(상세) + `changeSummary === null`" 조합은 어떤 계층도 wire
    수준에서 실행하지 않는다.
  - 완화 요인: `WorkflowVersionDto`·`WorkflowVersionListItemDto` 는 `changeSummary` 를 정확히 같은 데코레이터
    (`@ApiProperty({ type: String, nullable: true })`)로 선언하고, `workflow-version-response.dto.spec.ts` 의
    `it.each` 가 두 클래스의 선언을 동시에 고정하며, `workflow-versions.service.spec.ts` 의 신규 대칭 테스트("목록과
    상세의 select 는 snapshot 하나만 다르다")가 두 조회의 `select` 가 `changeSummary` 를 포함해 동일함을 고정한다.
    즉 선언·조회 축은 이미 이중으로 막혀 있어 실사고 위험은 낮다 — 그래서 WARNING 이 아니라 INFO 로 낮춘다.
  - 제안: 테스트 `I` 의 복원 단계 앞뒤 어디든 `GET .../versions/:versions[0].id` 상세를 한 번 더 호출해
    `assertMatchesContract(detail.body.data, await contractForDto(WorkflowVersionDto))` + `toBeNull()` 을 추가하면
    "wire 로 null 이 나가는 경로" 전체(목록 + 상세)가 닫힌다. 급하지 않음.

- **[INFO]** `changeSummary: changeSummary || undefined`(falsy 뭉개기)에 대한 새 테스트가 없다 — 1R 에서도 이미
  INFO 로 지적된 기존(pre-existing) 분기이며 이번 diff 의 결함은 아니다.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:219`
  - 상세: 빈 문자열(`''`)을 명시적으로 보내도 `undefined`(→ DB `NULL`)로 떨어진다. `changeSummary` 가 이번 PR 로
    "항상 실리고 null 일 수 있다" 는 명시적 계약으로 승격된 지금, "빈 문자열 vs null" 의 의미 차이가 서비스 계층에서
    구분되지 않는다는 사실이 더 눈에 띄지만, 이 diff 가 그 자리를 만지지 않았고 회귀도 아니므로 블로킹 사유 아님.
  - 제안: 없음(참고, 별도 이슈로 검토 가능).

## 점검 관점별 확인

1. **테스트 존재 여부** — DTO 필드 선언(파일 3)마다 대응 캐너리(파일 2), 서비스 `select` 리팩터(파일 5)마다 대칭
   단위 테스트(파일 4), 래칫 감소(파일 6)마다 e2e 계약 확장(파일 7)이 1:1 로 붙어 있다. 누락 없음.
2. **커버리지 갭** — 위 INFO 1건(상세+null 조합의 wire 미검증) 외에는 목록·상세 양쪽에서 이름 축(`expectNoUserSecrets`)과
   선언 축(`assertMatchesContract`)이 모두 실행된다.
3. **엣지 케이스** — `creator` 부재(`NotFoundException`, 파일 4 `should throw NotFoundException when missing`),
   `changeSummary` null(파일 7 테스트 I), select 리터럴이 한쪽만 갱신되는 회귀(파일 4 대칭 테스트)까지 plan 의
   뮤턴트 표(M1~M5, 전부 KILLED)로 실측되어 있다 — `plan/in-progress/workflow-version-creator.md` 게이트 58~66행.
4. **Mock 적절성** — `workflow-versions.service.spec.ts` 의 `mockRepo`(find/findOne/createQueryBuilder 등)는 실제
   TypeORM `Repository` 인터페이스의 호출 인자(`select`/`relations`)만 검증하는 용도로, 기존 파일의 패턴과 일관되고
   과대·과소 mock 이 아니다. `workflow-version-response.dto.spec.ts` 는 mock 없이 `contractForDto` 로 실제 swagger
   문서를 빌드해 검증하므로 데코레이터-스키마 간극이 생기지 않는다(실제 동작과의 괴리 없음).
5. **테스트 격리** — e2e 는 `uniqueName('wf-version-leak')`/`uniqueName('wf-restore')` 로 워크플로를 매번 새로 만들어
   교차 오염이 없다. 단위 테스트는 `beforeEach` 의 `jest.clearAllMocks()` 로 mock 상태를 매번 리셋한다(파일 4,
   게이트 87행).
6. **테스트 가독성** — 신규 테스트마다 "왜"(어떤 결함 클래스를 막는지, 어떤 순서가 필요한지)를 설명하는 JSDoc/인라인
   주석이 붙어 있다(파일 2 게이트 9~21행, 파일 4 게이트 169~174행, 파일 7 게이트 574~575·640~641행) — 의도가
   명확하다.
7. **회귀 테스트** — 기존 `findByWorkflow`/`findOne` 리터럴 select 단언(파일 4 게이트 92~134행)은 그대로 유지되고
   현재도 통과한다(새 대칭 테스트와 일부 겹치지만 plan 이 의도적으로 남긴 것 — 다른 실패 형태를 잡기 위함). 래칫
   (`swagger-dto-contract.spec.ts`)에서 제거된 4행도 실제 파일을 직접 확인한 결과 정확히 4개 항목만 빠졌고 인접
   항목(`workspace-response.dto.ts:WorkspaceInvitationDto.invitedBy` 등)은 그대로다 — 오삭제 없음.
8. **테스트 용이성** — `VERSION_METADATA_SELECT`/`CREATOR_PROJECTION` 을 모듈 레벨 상수로 분리해 두 조회가 이를
   공유하게 한 구조가 대칭 단위 테스트를 가능케 한다(리터럴을 두 번 손으로 적었다면 "자매가 같다"는 성질 자체를
   테스트로 표현하기 어려웠을 것). DI 를 통한 `Repository` mock 주입 구조도 기존 그대로 테스트 친화적이다.

## 요약

1R 에서 지적된 유일한 Testing WARNING(`changeSummary` null 값의 wire 검증 부재)은 `69b1afca0` 로 목록 엔드포인트
기준으로는 실제로 닫혔다 — `versions[0].changeSummary` 에 대한 양성 `toBeNull()` 단언과 `WorkflowVersionListItemDto`
계약 대조를 직접 Read 로 확인했다. 다만 같은 null 값이 **상세**(`WorkflowVersionDto`) 엔드포인트로 나가는 경로는
여전히 어떤 테스트도 실행하지 않는다는 잔여 갭이 있다 — DTO 선언 캐너리와 서비스 select 대칭 테스트가 이중으로
방어하고 있어 실사고 위험은 낮으므로 WARNING 이 아닌 INFO 로 남긴다. 그 외 신규 DTO 캐너리 · 서비스 대칭 단위
테스트 · 래칫 축소 · e2e 계약 확장은 각자 다른 결함 클래스(선언 후퇴, select 드리프트, 이름 기반 비밀 유출)를
겨냥하도록 설계돼 있고 plan 의 뮤턴트 표(M1~M5, 전부 KILLED)로 실측 뒷받침된다. Mock 사용은 적절하고 테스트 간
격리·가독성·회귀 유효성 모두 문제없다.

## 위험도

LOW
