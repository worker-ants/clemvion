# 유지보수성(Maintainability) 리뷰

## 스코프 메모

`review/consistency/**` 하위 산출물(파일 7~23: SUMMARY.md·`_retry_state.json`·`meta.json`·각 checker report)과
`plan/**` 문서(파일 4~6)는 자동 생성된 검토 산출물/작업 기록이며 함수·클래스·중첩 같은 코드 유지보수성 기준이
적용되지 않는다. 이 리뷰는 실제 구현 변경인 파일 1~3(`integrations.service.ts`,
`integrations.service.spec.ts`, `integration-rotate-concurrency.e2e-spec.ts`)에 집중했다.

## 발견사항

- **[WARNING]** `rotate()` 안에서 "권한 재검사"와 "머지+구조검증" 두 블록이 트랜잭션 락 전/후로 **글자 그대로 반복**된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1093`(락 전 organization/admin 검사)와
    `:1159`(락 안 재검사) — 두 `if` 블록의 조건·에러 코드·메시지 문자열이 완전히 동일하다(`entity.scope` → `fresh.scope`만
    다름). 마찬가지로 `:1104-1118`(락 전 `baseCreds`/`merged`/`errors` = merge + `validateCredentials` + 에러 처리)과
    `:1167-1182`(락 안 `freshBase`/`committed`/`freshErrors`)도 대상 행만 `entity` → `fresh`로 바뀐 동형 블록이다.
  - 상세: 두 시점(락 전 사전검증용 / 락 안 커밋용)에 같은 로직을 다시 도는 것 자체는 이 PR의 의도된 설계다
    (`plan/in-progress/rotate-lost-update.md` §B — 트랜잭션 안에서 재읽어 재검증). 문제는 그 재검증이 **복붙**으로
    구현돼, 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 생긴다는 점이다. 특히 권한 검사(FORBIDDEN 분기)는 보안에
    직결되는 코드라 이 형태의 중복이 가장 비용이 크다 — 나중에 메시지 문구나 조건(`isAdmin` 판정 등)을 바꿀 때 두 곳
    중 하나를 빠뜨리면 락 전/후 정책이 조용히 어긋난다. 참고로 같은 organization/admin 검사 패턴이 같은 파일
    `requestScopes()`(:1238)에도 이미 존재해, 이 저장소가 이 형태의 반복을 완전히 새로 도입한 것은 아니지만
    `rotate()` 내부에서 같은 함수가 자기 자신의 사전 검사를 트랜잭션 안에서 그대로 재현하는 것은 이번 PR이 새로
    만든 표면이다.
  - 제안: `private mergeAndValidateCredentials(row: Integration, body: RotateCredentialsDto): { merged: Record<string, unknown>; errors: string[] }` 와
    `private assertCanRotate(row: Integration, userRole: string | null): void` 같은 private 헬퍼로 두 시점 모두를
    통일한다. 트랜잭션 밖 사전검증(사용자에게 빠르게 400을 돌려주기 위한 fail-fast)과 트랜잭션 안 최종검증(TOCTOU
    보호) 각각의 호출부는 한 줄로 줄고, 정책이 한 곳에만 존재하게 된다.

- **[INFO]** 락 전/후로 같은 "머지 결과"를 가리키는 변수 이름이 `merged` → `committed`로 바뀐다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1107`(`const merged = { ...baseCreds, ...body.credentials }`)와
    `:1170`(`const committed = { ...freshBase, ...body.credentials }`).
  - 상세: 둘 다 "베이스 자격증명 + 요청 patch"를 머지한 같은 개념의 값인데, 하나는 연결 테스트에만 쓰이고 버려지며
    다른 하나만 실제로 저장(`committed`)된다는 것을 이름만으로는 바로 알기 어렵다. 위 WARNING의 헬퍼 추출과 함께
    처리하면 자연히 해소된다(헬퍼가 두 자리에서 같은 이름의 지역 변수를 반환).
  - 제안: 헬퍼 추출 시 반환값 이름을 통일하거나, 헬퍼를 만들지 않는다면 최소한 "락 전 값은 테스트 전송용,
    저장은 하지 않는다"는 취지를 변수명(`credsForTest` 등)에 반영해 둘의 관계를 명시한다.

- **[WARNING]** `rotate()` 메서드가 144줄(1078~1221)로 길고, 책임이 다섯 갈래(입력 검증 → 외부 I/O 연결 테스트 →
  트랜잭션 내 재인가·재머지·재검증·UPDATE·재조회 → 감사 로그 → 브로드캐스트)로 나뉜다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1078`(`async rotate(`) ~ `:1221`
  - 상세: 트랜잭션 콜백 자체가 이미 하나의 완결된 단위(재인가 → 재머지 → 재검증 → UPDATE → 재조회, ~60줄)인데
    `rotate()` 본문 안에 인라인 클로저로 박혀 있어, 메서드 하나의 순환 복잡도가 분기 8개 이상(±oauth2 체크,
    조직/관리자 체크 x2, credentials 구조 오류 체크 x2, test.success 체크, affected 체크, row null 체크)으로
    누적된다. 주석 밀도가 높아 실제 코드 줄 수보다 더 길어 보이는 효과는 있지만, 메서드가 하는 일의 개수 자체가
    많다.
  - 제안: 트랜잭션 콜백을 `private commitRotation(entity, workspaceId, userRole, body): Promise<Integration>` 같은
    이름의 private 메서드로 추출하면 `rotate()` 본문은 "사전 검증 → 연결 테스트 → 커밋 → 감사로그 → 브로드캐스트"
    5단계가 한눈에 보이는 오케스트레이션 함수로 줄어들고, 트랜잭션 내부 로직은 독립적으로 읽고 테스트 이름을 붙이기
    쉬워진다. 위 두 WARNING/INFO와 함께 처리하면 자연히 해결된다.

- **[INFO]** 테스트 파일 신규 `describe('동시 rotate (lock update)')` 블록과 e2e 스펙은 가독성이 좋다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1337-1422`,
    `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` 전체
  - 상세: `stale()`/`committedByOther()` 팩토리 이름이 각 mock 행이 나타내는 시나리오 역할을 정확히 전달하고,
    주석이 "왜 이 순서로 mock 하는가"를 설명해 유지보수 부담이 낮다. e2e 스펙의 "겹침을 우연에 맡기지 않는다" +
    `Promise.race` 공허성 가드도 다음 사람이 이 테스트를 왜 이렇게 짰는지 재구성할 필요가 없게 잘 문서화돼 있다.
    수정 제안 없음 — 참고용 긍정 기록.

## 요약

핵심 변경(`rotate()`의 락-안-재읽기 도입)은 동시성 결함을 올바른 형태(외부 호출은 락 밖, 재읽기는 락 안)로 닫았고
테스트(unit 3종 + e2e 1종)도 판별력 있게 작성돼 있다. 다만 구현 자체에서 "권한 재검사"와 "머지+구조검증" 두 블록이
락 전/후로 글자 그대로 두 번 반복돼(WARNING 2건), 보안에 직결되는 권한 체크를 포함해 향후 한쪽만 수정하고 다른
쪽을 놓치는 drift 위험을 남긴다. 또한 그 결과로 `rotate()` 메서드 자체가 144줄·다중 책임을 가진 긴 함수가 됐다.
private 헬퍼 2개(머지+검증, 권한 재확인) 또는 트랜잭션 본문 자체를 별도 메서드로 추출하면 중복·길이·네이밍
불일치 세 지적이 한 번에 해소된다. 코드 동작이나 테스트 커버리지에는 영향이 없는 리팩터링 수준의 지적이다.

## 위험도

LOW
