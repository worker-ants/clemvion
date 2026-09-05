# 요구사항(Requirement) Review — §5.4 응답 계약 검증기 재귀 서술 + audit-logs 유출 수정 (후속 라운드)

## 검증 방법

이번 diff 는 이전 라운드(`review/code/2026/09/05/13_49_54`)의 CRITICAL(§5.4 검증기가 중첩을
안 봐서 `AuditLogDto.user` 유출을 놓침) 을 그 라운드의 `RESOLUTION.md` 가 "고쳤다" 고 보고한
바로 그 코드다. 재현 없이 그 주장을 받지 않고, 실제 파일(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts`,
`codebase/backend/src/shared/testing/response-contract.ts`)을 직접 `Read` 해 diff 가 아니라
**현재 파일 전체**를 대조했고, `response-contract.ts` 의 재귀·순환 참조 처리 로직은 저장소 밖
scratch 디렉터리에서 `ts-node`(`--transpile-only`, `--compiler-options` 오버라이드)로 실제 실행해
검증했다. 저장소 트리에는 어떤 파일도 쓰지 않았다(`git status --short` 로 확인 — untracked 는
본 리뷰 세션 산출물 디렉터리 하나뿐).

## 발견사항

- **[CRITICAL]** `findContractViolations` 의 순환 참조 가드가 **최상위 DTO 자기 자신을 가리키는
  첫 번째(유일할 수도 있는) 중첩 참조를 아예 검증하지 않고 통과시킨다** — "중첩 DTO 까지
  내려간다"는 이번 diff 의 headline 기능(바로 이전 라운드 CRITICAL 을 닫은 그 기능)이 자기
  참조/역참조 케이스에서 조용히 무력화된다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:256`
    (`function findContractViolations`, `visit(payload, contract.schema, '', walk, [contract.name]);`)
    — 순환 방지 로직 자체는 `:141-163`(`descend`)와 `:165-219`(`visit`)
  - 재현(저장소 무변경, scratch 사본으로 실행): `CycleDto`(파일 3 `response-contract.spec.ts`
    의 fixture, `id` required + `self?: CycleDto | null`)와 동형인 손으로 만든 `DtoContract` 로
    `findContractViolations({ id: 'a', self: { leak: 1 } }, contract)` 를 호출하면 —
    - **실제 반환값: `[]`** (마치 `self.id`(required) 누락도, `self.leak`(undeclared) 도 없는
      것처럼 보고한다)
    - `seen` 초기값만 `[contract.name]` → `[]` 로 바꾼 scratch 사본으로 같은 입력을 돌리면
      `[{"property":"self.id","kind":"missing",...},{"property":"self.leak","kind":"undeclared",...}]`
      을 정확히 낸다 — 즉 **로직 결함이지 스키마 문제가 아님**을 직접 대조로 확인했다.
  - 상세: `findContractViolations` 는 최상위 스키마를 `visit(..., [contract.name])` 로 호출해
    **자기 자신의 이름을 처음부터 `seen` 에 미리 넣어 둔다.** `descend` 는 `seen.includes(name)`
    이면 그 즉시 return 해 그 프로퍼티의 **내용을 전혀 검사하지 않는다.** 그런데 어떤 필드가
    `$ref`/`allOf` 로 **최상위 DTO 와 같은 이름**을 가리키면(직접 자기참조: `A.self: A`,
    또는 자매 DTO 를 거친 역참조), 그 참조는 실제로는 **아직 한 번도 내려간 적이 없는 첫
    발생**인데도 `seen` 에 이미 그 이름이 있어 즉시 차단된다 — "이미 밟았으니 두 번 안 밟는다"
    가 아니라 "밟기도 전에 이미 밟은 것으로 친다." 그 결과 해당 프로퍼티 값 내부의
    required-누락·null-위반·undeclared-키가 **전부 조용히 통과**한다(에러도, 경고도 없이 빈
    배열을 반환).
    같은 파일의 전제 테스트("[전제] 스키마가 여섯 축을 실제로 담고 있다")가 스키마가 비어
    있는 것과 실제 검사가 도는 것을 구분해 vacuous-test 를 스스로 경계하는 것과 대조적으로,
    바로 이 순환 참조 시나리오의 회귀 테스트(`response-contract.spec.ts` "순환 참조에서
    무한히 내려가지 않는다")는 **완전히 올바른 payload 하나만** 대조해 `toEqual([])` 를
    기대한다 — 그 단언은 재귀가 실제로 실행되든, 이 버그처럼 첫 단계부터 통째로 스킵되든
    **양쪽 다 통과**하므로 이 결함을 전혀 잡지 못하는 vacuous 캐너리다.
  - 왜 이게 중요한가: 이번 diff 의 존재 이유 자체가 "최상위 키만 보면 가장 위험한 형태를
    통째로 놓친다"(`response-contract.ts:50` JSDoc)이고, 실제로 `AuditLogDto.user` 유출을
    그렇게 놓쳤던 것을 재귀 서술로 고친 것이 바로 이 PR 이다. 그런데 그 재귀 서술 자체가
    "최상위 DTO 와 이름이 같은 참조"라는 한 형태 앞에서 **똑같은 방식으로(최상위만 보고
    통과)** 다시 뚫린다 — 고쳤다고 주장하는 결함과 **같은 클래스의 결함**이 재귀 로직 안에
    새로 생긴 것이다. 오늘 배선된 4개 DTO(`AuditLogDto`/`SessionDto`/`WorkflowDto`/
    `ExecutionDto`) 중 이 경로를 실제로 밟는 것은 없다(각 DTO 자신의 스키마 안에 자기 자신을
    가리키는 필드가 없음 — 직접 확인함). 다만 `WorkflowDto` 를 `type: () => WorkflowDto` 로
    참조하는 자매 DTO(`workflow-response.dto.ts:71` `CanvasSaveResultDto.workflow`)가 **이미
    존재**하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이 검증기를
    나머지 응답 DTO 56곳으로 "기계적으로" 넓히는 것을 다음 작업으로 명시해 두었다 — 그 스윕이
    `CanvasSaveResultDto` 를 배선하는 순간(또는 장차 트리형 DTO — 폴더/댓글 등 self-reference
    구조 — 를 배선하는 순간) 이 버그가 **조용히 재발**한다: `assertMatchesContract` 는 통과
    보고를 내지만 실제로는 그 자리의 엔티티 패스스루 노출을 하나도 못 잡는다.
  - 제안: `findContractViolations` 의 초기 호출을 `visit(payload, contract.schema, '', walk, [])`
    로 바꾼다(즉 `seen` 을 **빈 배열로 시작**). `descend` 는 실제로 한 스키마를 밟을 때만
    `seen` 에 이름을 추가하므로(`[...seen, name]`), 이렇게 고치면 최상위 이름과 같은 참조도
    **첫 번째 발생은 정상 검증**하고 그 다음 재귀(두 번째 발생)부터 순환 차단이 걸린다 — scratch
    패치로 이미 확인함(`valid`/`deep valid` 케이스는 여전히 `[]`, `broken` 케이스는 정확한
    위반 2건을 낸다). 함께, "순환 참조에서 무한히 내려가지 않는다" 테스트 옆에 **자기 참조
    첫 단계에 실제 위반을 주입하는** 대조군 케이스(예: `{ id: 'a', self: { leak: 1 } }` →
    `['self.id:missing', 'self.leak:undeclared']` 기대)를 추가해 이 vacuous 갭을 회귀
    방지선으로 고정할 것.

- **[INFO]** "키 생략형 + `nullable`" 조합에 대한 관대함이 §5.4 의 "응답 DTO 선언 형태" 규칙
  (요청 전용 tri-state 를 응답에 허용하지 않음)과 문언상 어긋나 보이지만, 실질적으로는 spec
  의 소급 비적용 조항과 이 검증기의 명시된 스코프(선언-형태 자체의 적합성이 아니라 "응답이
  선언과 맞는가")로 설명 가능해 결함으로 보지 않는다 — 참고로만 기록
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:42`(JSDoc 표 3행) 및
    `:179,195`(`nullable` 가드) 대 `spec/5-system/2-api-convention.md` §5.4 "DTO 선언 형태"
    항(`요청 DTO 에서는 ... 조합이 정당하다` / `키를 생략하는 필드 → ... | null 금지`)
  - 상세: spec 원문은 "키 생략(optional) + `| null`" 조합을 **요청 DTO 의 tri-state 전용**으로
    한정하고 응답 DTO 에는 명시적으로 금지한다(`| null` 금지). 그런데 이번 diff 의
    `response-contract.ts` 는 그 조합이 응답 DTO(`ExecutionDto` 10필드·`AuditLogDto.user`·
    `WorkflowDto.description`/`folderId` 등, 전부 이 diff 밖의 기존 파일)에 실제로 광범위하게
    쓰이고 있으므로, `nullable: true` 가 함께 선언돼 있으면 그 조합을 허용하도록 **런타임
    검사에서만** 관대하게 짰다. 이는 (a) spec 의 "소급 적용 대상 아님" 조항(표현 선택·DTO
    선언 형태 규칙 모두 **앞으로 도입·변경되는 필드**에만 적용, 기존 필드는 소급 요구 안 함)과
    (b) 이 도구가 "선언 형태 자체가 §5.4 형태 규칙을 지키는가"가 아니라 "실제 응답이 **선언된
    스키마**와 맞는가"만 검사한다고 명시(JSDoc 이 그 축만 다룬다고 스스로 고지)하는 점을
    감안하면 방어 가능한 설계다. 다만 그 결과 이 조합은 **앞으로 신규 도입되는 응답 필드**가
    같은 (spec 이 금지하는) 형태를 써도 이 도구가 잡지 못한다 — 그 형태의 신규 도입 자체를
    막는 것은 별도의 정적 검사(`swagger-dto-contract-guard.ts`, decorator-vs-TS-type 축)의
    역할인데, 그 가드도 "decorator 와 TS 타입이 서로 일치하는가"만 보지 "그 조합이 응답에
    허용되는 형태인가"는 보지 않는다(직접 확인함) — 즉 이 특정 sub-rule(응답에서 optional+
    nullable 금지)은 두 도구 어디에도 걸리지 않는 갭으로 남아 있다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이 78곳 drift 전체를
    별도 트랙으로 추적 중이라 이번 PR 범위에서 조치를 요구하지 않는다.
  - 제안: 조치 불요(이미 다른 트랙에서 추적). 다음 nullable-notation 스윕에서 "응답 DTO 가
    optional+nullable 을 새로 선언하면 막는" 정적 규칙을 어느 가드가 맡을지만 명시해 두면
    이 갭이 문서화된다.

## 확인 완료 (문제 없음 — 재확인)

- `audit-logs.service.ts` 의 수정(`leftJoinAndSelect` → `leftJoin` + `addSelect(['user.id',
  'user.name','user.email'])`)은 `AuditLogUserDto`(id/name/email 3필드)와 정확히 일치한다.
  `User` 엔티티 필드는 전부 타입 선언뿐(클래스 필드 initializer 없음)이라 TypeORM 이 선택 안 된
  컬럼에 기본값을 채워 넣어 재유출시킬 위험도 없다(엔티티 정의 직접 확인).
- `audit-logs.spec.ts` 신규 유닛 테스트는 `qb.leftJoin`/`addSelect` 인자와
  `leftJoinAndSelect` 키 부재를 함께 단언해, "복귀 편집"(`leftJoinAndSelect` 로 되돌림) 시
  `leftJoinAndSelect is not a function` 로 즉시 깨지도록 판별력 있게 짜여 있다.
  `audit-logs.e2e-spec.ts` 의 `Object.keys(user).sort()` 단언도 검증기 로직 자체의 결함(위
  CRITICAL 같은 것)에 기대지 않는 독립 캐너리로 적절하다.
  다만 이 e2e 는 `user_id` 가 항상 존재하는 시드만 쓰므로 "탈퇴 사용자(관계 null)" 분기는
  여전히 밟지 않는다(이전 라운드 `testing.md` 가 이미 INFO 로 지적한 잔여 갭, 새로 발견한
  것 아님 — 재등재하지 않음).
- `assertMatchesContract`/`contractForDto`/`DtoContract` API 는 4개 e2e 파일
  (`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`) 전부에서 일관되게
  쓰이고(`dtoName` 문자열 재입력 없음), 4곳 모두 `beforeAll` 캐싱으로 통일돼 있다 — 이전
  라운드가 지적한 "DTO 이름 이중 표현"·"캐싱 불일치" WARNING/INFO 둘 다 실제로 해소됐다.
- `response-contract.ts` JSDoc 판정 규칙 표의 "키 생략형" 행이 이제 "단 스키마가 `nullable`
  도 함께 선언했으면 `null` 을 허용한다"는 예외를 명시해 구현(`:179,195` 의 `!nullable` 가드)과
  line-level 로 일치한다 — 이전 라운드 `api_contract.md` WARNING(#5, JSDoc-구현 불일치)이
  실제로 정정됐다.
- `ContractViolationKind` 에 `'invalid-payload'` 가 신설돼 필드-누락(`'missing'`)과 payload
  형태 오류가 더 이상 같은 kind 값을 공유하지 않는다(`response-contract.spec.ts:266-271` 이
  `kind` 값을 직접 단언) — 이전 라운드 `maintainability.md` WARNING(#1) 이 해소됐다.
- `response-contract.spec.ts` 의 "위반은 property 알파벳순으로 나온다" 테스트는 결과를
  재정렬하지 않고 그대로 비교해(`findContractViolations` 의 `.sort()` 를 실제로 물게 짜여
  있음), 이전 라운드 `testing.md` 가 지적한 "정렬 로직 미검증" 갭도 해소됐다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`·
  `spec-conventions-engine-error-code-surface.md` 의 갱신 내용은 인용하는 커밋/실측 수치와
  대조한 결과 일치하며, TODO/FIXME/HACK/XXX 성 미완성 주석은 신규 코드(파일 1~8)에 없음
  (grep 확인).

## 요약

이번 diff 는 이전 라운드가 지적한 라이브 보안 결함(`GET /api/audit-logs` 의 `user` 필드를 통한
`passwordHash`·2FA 복구 코드 등 26개 키 노출)을 정확한 select 축소로 닫았고, 그 결함을 처음
놓쳤던 §5.4 검증기(`response-contract.ts`)에 중첩 `$ref` 재귀 서술을 추가해 같은 클래스의 유출을
구조적으로 잡도록 확장했다 — e2e 뮤테이션(`payload → {}`)으로 4개 배선 지점 전부 이 라운드에서도
재확인됐고, 이전 라운드가 지적한 6개 WARNING/INFO(캐싱 불일치·`dtoName` 이중 표현·`missing` kind
재사용·JSDoc-구현 불일치·정렬 미검증) 는 전부 실제로 해소됐다. 다만 그 신규 재귀 서술 자체에
**새로운 결함**이 남아 있다 — 순환 참조 가드가 최상위 DTO 자기 자신을 가리키는 참조를 "이미 밟은
것"으로 처음부터 취급해, 그 참조의 첫 번째(그리고 유일할 수도 있는) 발생 내용을 전혀 검증하지
않고 통과시킨다(scratch 환경에서 직접 실행해 확인 — 수정된 `seen` 초기값으로는 정확히 위반을
잡는 것도 함께 확인). 오늘 배선된 4개 DTO 는 이 경로를 밟지 않아 즉각적인 프로덕션 유출은
없지만, 이 정확히 같은 클래스의 결함을 고치는 것이 이 PR 의 목적이었고, 다음 계획된 스윕(응답 DTO
56곳, 이미 자기참조형 `CanvasSaveResultDto.workflow: WorkflowDto` 존재)이 이 경로를 밟는 순간
"검증 통과"가 거짓 신호가 된다. 전용 회귀 테스트가 완전-유효 payload 하나만 대조해 vacuous 하다는
점까지 더하면, 한 줄 수정(`seen` 초기값을 `[]` 로)과 판별력 있는 대조군 테스트 추가가 이번 라운드
안에 필요하다고 판단해 CRITICAL 로 등재한다.

## 위험도

CRITICAL
