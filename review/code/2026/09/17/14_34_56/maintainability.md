# 유지보수성(Maintainability) 리뷰 — `trigger-cascade-window-probe` (3라운드)

## 범위 요약

`git diff origin/main..HEAD` 는 46개 파일, 대부분(39개)이 1·2라운드(`review/code/2026/09/17/13_44_39`,
`review/code/2026/09/17/14_11_48`)의 산출물 및 `review/consistency/2026/09/17/13_04_39/**` 가 이번에
committed 되어 diff 에 실린 것이다 — 과거 리뷰 기록물이라 신규 애플리케이션 코드가 아니며, 이번
라운드의 유지보수성 재검토 대상이 아니다(선례: `14_11_48/maintainability.md` 범위 요약과 동일 판단).

실제 코드/문서 변경은 7개 파일이고, 그중 프로덕션 로직(`triggers.service.ts`)은 **1·2라운드 리뷰
시점 그대로**다 — 이번 라운드(커밋 `d60cc65aa`)의 실질 diff 는 `CHANGELOG.md`·
`trigger-transaction-mock.ts` JSDoc·`plan/in-progress/trigger-save-partial-patch.md` 세 곳의
**문서·주석 수정뿐**이며, `triggers.service.ts`·`triggers.service.spec.ts`·신규
`test/trigger-update-save-window.e2e-spec.ts`·`jest.config.ts` 는 2라운드 이후 손대지 않았다
(`git show d60cc65aa --stat` 로 확인).

`triggers.service.ts` 의 `update()` 전체(551~769행, 219줄)와 `trigger-transaction-mock.ts` 전체를
직접 `Read` 했다. 저장소 트리에는 아무것도 쓰지 않았다 — 순수 읽기 검증만 수행(`git status --short`
확인 결과 `review/code/2026/09/17/14_34_56/` 외 변경 없음, 뮤테이션 없음).

## 발견사항

- **[POSITIVE 관측 — WARNING 아님]** 이번 라운드의 유일한 실질 diff가 "재현 불가능한 매직 넘버"라는
  유지보수성 결함 자체를 없앤다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62`~`69`
  - 상세: 2라운드에서 mock JSDoc의 "60 RED" 실측치를 리뷰어가 재현했더니 64·68이 나와(뮤턴트가
    콜백 대신 무엇을 반환하느냐에 따라 값이 갈림) 불일치가 지적됐다. 이번 커밋은 그 구체적 숫자를
    지우고 "**정확한 수는 여기 적지 않는다** … 형태를 고정하지 않은 숫자는 다음 사람이 재현하지
    못한다"는 규칙 문장으로 대체했다(13 → 53 → 60 → 64/68로 네 번 바뀐 이력을 스스로 기록). 이
    저장소가 반복적으로 지적해 온 "PR이 닫히는 시점의 값으로 다시 재라" 패턴의 근본 원인(뮤턴트
    형태 미고정)을 짚어 **다음 편집자가 같은 함정에 빠지지 않도록 만드는 방향**이다. `CHANGELOG.md`
    의 `workspace` CASCADE 서술도 같은 방식으로 "실측"과 "동일할 것으로 보되 따로 재지 않음"을
    구분해 정정했다(`CHANGELOG.md:24`~`27`).
  - 제안: 없음. 문서 신뢰도를 낮추지 않으면서 유지보수 부담(재측정 의무)을 줄인 선례로 참고할 만하다.

- **[INFO — 1·2라운드에서 이미 추적됨, 신규 아님]** `TriggersService.update()` 가 여전히 길고 여러
  책임을 한 메서드에 담고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 전체
    (551행~769행, 219줄)
  - 상세: schedule 타입 필드 화이트리스트 검증·notification/chatChannel 안전성 검증·
    `inboundSigningRef` 보존·`authConfigId` 검증·advisory lock 획득/재읽기/`config` 병합·부분 객체
    `save` + 응답 재구성·감사 로그·schedule 역동기화·secret 정규화·chatChannel setup 10가지 책임이
    한 메서드에 섞여 있고, 엔티티류 로컬 변수도 `trigger`·`fresh`·`target`·`patch`·`written`·`saved`·
    `result` 7개다. 이번 라운드는 이 메서드의 로직을 전혀 바꾸지 않았으므로 크기 자체는 2라운드
    대비 변화 없음(2라운드 INFO, 1라운드 SUMMARY INFO#6에서 이미 비차단 처분됨).
  - 제안: 처분 그대로 — 지금 쪼갤 필요는 없다. 다음에 이 메서드를 다시 손댈 일이 생기면
    `buildTriggerUpdatePatch()`/`applyWrittenTimestamp()` 류 헬퍼 추출을 검토.

- **[INFO — 1·2라운드에서 이미 추적됨, 신규 아님]** Postgres SQLSTATE 매직 스트링이 e2e 파일에 두 번
  리터럴로 등장
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:135`, `149`
    (`expect(caught?.code ?? caught?.driverError?.code).toBe('23503')` / `'23502'`)
  - 상세: 저장소에 이 코드들을 이름으로 감싼 기존 유틸이 없다. 이번 라운드에서도 그대로 남아 있고
    변경되지 않았다 — 신규 문제 아님.
  - 제안: 처분 그대로 유지. 우선순위 낮음.

- **[INFO — 1·2라운드에서 이미 추적됨, 신규 아님]** `if (written.updatedAt) target.updatedAt = written.updatedAt;` 방어 분기의 존재 근거가 실측("항상 채워진다")과 다르게 코드로는 "없을 수도 있다"로 읽힌다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:713`~`716`
  - 상세: 바로 위 주석(698~709행)이 실측으로 "실값은 `updatedAt` 뿐이다"라고 단정하는데, 코드는
    `if`로 그 전제를 방어적으로 다시 검사한다. 이미 1라운드에서 근거 주석(714~715행, "가드는 단위
    대역이 넘긴 객체를 그대로 돌려줄 때 재읽은 값을 `undefined`로 지우지 않으려는 것")이 보강됐고,
    이번 라운드도 이 자리를 바꾸지 않았다. 기능상 해는 없다.
  - 제안: 여유 있을 때 `written.updatedAt`을 non-null로 단언하거나 가드 사유를 한 줄 더 명시.

## 요약

이번 라운드(3라운드)에서 프로덕션 코드(`triggers.service.ts`, 부분 객체 `save`)는 2라운드 이후
전혀 바뀌지 않았고, 2라운드 maintainability 리뷰가 이미 LOW로 확정한 판단(핵심 변경은 작고
국소적, payload 중복은 `const patch`로 해소됨, 잔여 항목은 메서드 길이·매직 SQLSTATE·방어 분기
근거 셋뿐이며 전부 비차단)이 그대로 유효하다. 이번 라운드의 유일한 실질 diff는 2라운드에서 지적된
"재현되지 않는 뮤턴트 카운트"라는 문서 결함 자체를 근본적으로 없애는 방향(숫자 삭제 → 재현 규칙
명시)이라 유지보수성을 오히려 개선했다. 새로 발견된 WARNING/CRITICAL 급 유지보수성 결함은 없다.

## 위험도
LOW
