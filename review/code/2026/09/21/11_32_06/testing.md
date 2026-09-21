# 테스트(Testing) 리뷰 — integration-dup-delete (재검토, 11_32_06)

이 라운드는 직전 코드 리뷰(`review/code/2026/09/21/10_54_47`)가 낸 testing WARNING #1(conflict-path
단언 vacuous)·INFO #7(대조군 broadcast 미단언)이 커밋 `74a9e714b`로 이미 조치되고, `RESOLUTION.md`에
뮤테이션 재검증(원복 완료·`git status --short` 클린)까지 기록된 상태에서 전체 diff 를 다시 본 것이다.
실제 소스(`integrations.service.ts`, `integrations.service.spec.ts`)를 `Read`로 직접 열어 그 조치가
반영돼 있음을 확인했다 — 재확인 결과 아래와 같다.

## 발견사항

- **[INFO]** conflict-path 두 테스트의 회귀 방지는 이제 올바른 목표(`delete`)를 겨냥한다 — 조치 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1176`, `:1198`
    (`expect(integrationRepo.delete).not.toHaveBeenCalled();`)
  - 상세: 이전 라운드가 뮤테이션으로 실측한 vacuous 단언(`integrationRepo.remove` 겨냥)이 `delete` 겨냥으로
    교체됐음을 `Read`로 직접 확인했다. `grep -n "integrationRepo\.remove\|integrationRepository\.remove"`
    를 서비스/스펙 두 파일에 돌리면 0건 — 죽은 API 를 더 이상 참조하지 않는다. 새로 조치할 것 없음(긍정 기록).

- **[INFO]** `beforeEach` 의 mock 객체에 이제는 어디서도 호출·단언되지 않는 `remove` 스텁이 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:131`
    (`remove: jest.fn().mockResolvedValue(undefined),`)
  - 상세: `IntegrationsService.remove()` 가 `integrationRepository.remove(entity)` 를 더 이상 호출하지
    않으므로(`integrations.service.ts:799`의 `delete({ id, workspaceId })` 로 전환 완료), 이 스텁은 파일
    전체에서 호출도 단언도 되지 않는 죽은 fixture 다. 기능적 위험은 없다 — 직전 라운드의 WARNING #1 은
    "그 mock 을 겨냥하던 **단언**"이 문제였고 그 단언은 이미 `delete` 로 옮겨져 뮤테이션으로 유효성이
    재확인됐다. 다만 스텁 자체는 정리되지 않아 다음에 이 파일을 읽는 사람이 "`remove` 도 아직 쓰이나?"
    라고 오독할 여지가 남는다. `RESOLUTION.md` 도 이 정리를 "필요하면"이라는 조건부로만 언급했다.
  - 제안: 이번 PR 을 막을 사유는 아니다. 다음 근접 편집 때 `remove: jest.fn()...` 줄을 제거해도 좋다.

- **[INFO]** 신규 e2e 는 진 쪽 응답의 **상태 코드만** 관측하고 에러 `code` 본문은 보지 않는다 — 형제
  4개 중 절반(workflow/trigger)과 같은 수준, 나머지 절반(workspace)보다는 판별력이 약하다
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts:68-76`
    (`fireDelete` 가 `(res) => res.status` 만 추출), `:103` (`expect(statuses).toEqual([204, 404]);`)
  - 상세: `workspace-delete-concurrency.e2e-spec.ts` 는 같은 자리에서 `{ status, code }` 를 함께 캡처하고
    `expect(results[1].code).toBe('WORKSPACE_NOT_FOUND')` 까지 확인하며, 그 이유를 주석으로 명시한다 —
    "코드까지 본다 — 상태만 보면 `WORKSPACE_NOT_FOUND` 가 아닌 404 로 바뀌어도 통과한다". 통합 e2e 는 그
    강화를 반영하지 않아, 만약 진 쪽 분기가 실수로 다른 404(예: 잘못된 `NotFoundException` 리터럴이나
    라우팅 오류로 인한 404)를 던지게 바뀌어도 이 e2e 는 여전히 GREEN 이다. 다만 이 정확한 코드
    (`RESOURCE_NOT_FOUND`)는 단위 테스트(`integrations.service.spec.ts:1083`)가 이미
    `toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } })` 로 고정하고 있고, 이 e2e 자체가
    새로 만든 회귀도 아니다 — `workflow-`/`trigger-delete-concurrency.e2e-spec.ts` 두 형제도 정확히 같은
    수준(status 만)이라 이번 diff 가 기존 관례보다 후퇴한 것은 아니다.
  - 제안: 이번 PR 필수 아님. 다음에 이 e2e 계열을 함께 손보는 기회가 생기면 `fireDelete` 가
    `{ status, body }` 를 함께 반환하도록 넓히고 `RESOURCE_NOT_FOUND` 단언을 추가하면 workspace 수준으로
    판별력을 맞출 수 있다.

## 그 외 확인한 사항 (문제 없음)

- **테스트 존재/커버리지**: 핵심 변경(`remove()` 를 원자적 `delete()`+`affected===0` 판정으로 교체)에
  unit 2건(진 쪽 404, `null`/`undefined` 대조군)·e2e 1건이 갖춰져 있고, `rotate()`/`findById`/`update`
  의 `throwIntegrationNotFound()` 호출부는 헬퍼 추출(`5bbdf753d`) 전부터 있던 회귀 테스트
  (`integrations.service.spec.ts:206`, `:605`, `:1047`, rotate 블록의 "행이 지워졌으면(update 0행) 404"
  류 2건)가 그대로 커버한다 — 순수 리팩터라 새 테스트가 필요하지 않다는 판단이 타당하다.
- **엣지 케이스**: `affected: 0`(진 쪽) vs `affected: undefined|null`(드라이버 미보고, 정상 삭제 취급)을
  분리한 대조군이 있고, 그 판정 로직(`=== 0` 명시 비교)을 반증하는 `!affected` 뮤턴트가 이 대조군에서
  RED 가 된다는 것이 plan/RESOLUTION 양쪽에 실측으로 기록돼 있다.
- **Mock 적절성**: `delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] })`
  (`integrations.service.spec.ts:134`)는 TypeORM `DeleteResult`(`{ raw, affected? }`) 형태를 그대로
  반영해 실제 드라이버 반환값과 괴리가 없다.
- **테스트 격리**: `beforeEach`(`:119`)가 매 테스트마다 `integrationRepo` 등 모든 mock 을 새로 만들어
  `mockResolvedValueOnce` 큐가 테스트 간에 넘어가지 않는다. e2e 도 `beforeAll`/`afterAll` 로 커넥션을
  명시 정리하고 `finally` 에서 `ROLLBACK().catch()` + `pending?.catch()` 로 실패해도 잠금이 남지 않는다.
- **공허성 가드**: e2e 가 `Promise.race` 로 "락 해제 전 두 요청 모두 미완료"를 먼저 확인한 뒤에야 본
  단언으로 넘어간다 — fixture 가 실제로 겹침을 만들었는지 스스로 검증하는 견고한 패턴이고, 형제
  4파일과 동형이다.
- **회귀 테스트**: `deletes when no usages exist`(`:1060`)는 `remove`→`delete` 단언으로 정확히 갱신됐고,
  `broadcasts cache invalidation…`(`:1111`)·`throws NotFoundException when the integration is
  absent`(`:1116`)·`reads the integration row only once`(`:1126`)는 이번 diff 로 동작이 바뀌지 않는
  경로라 그대로 유효하다.
- **테스트 용이성**: 리포지토리가 생성자 DI 로 주입돼 있어 `remove(entity)`→`delete(criteria)` 전환도
  mock 갱신만으로 대응 가능했다 — 구조적으로 테스트하기 쉬운 형태가 유지된다.
- 저장소에 어떤 파일도 쓰거나 고치지 않았다(전 과정 `Read`/`Bash grep`/`git show` 만 사용).
  `git status --short` 는 사전 상태(`review/code/2026/09/21/11_32_06/` 자신의 산출물 디렉터리)와 동일함을
  확인했다 — 병렬 리뷰어의 뮤테이션 흔적은 관측되지 않았다.

## 요약

직전 라운드가 뮤테이션으로 실측한 testing WARNING(conflict-path 단언이 죽은 `remove` mock 을 겨냥해
vacuous)은 커밋 `74a9e714b`로 정확히 조치됐고, `RESOLUTION.md`가 기록한 재검증(뮤턴트 삽입 → 두 테스트
RED → cp 원복)도 소스 상태와 일치한다. 남은 것은 기능 위험이 없는 두 가지 사소한 흠뿐이다 — (1) 더는
쓰이지 않는 `remove` mock 스텁이 정리되지 않고 남아 있음, (2) 신규 e2e 가 진 쪽 응답의 에러 `code` 는
보지 않고 상태 코드만 본다(다만 이는 형제 4개 중 절반과 동일한 기존 관례이지 이번 diff 의 후퇴가
아니고, 정확한 코드는 이미 unit 레벨에서 고정돼 있다). 둘 다 이번 PR 을 막을 사유가 아니다.

## 위험도
LOW
