# 테스트(Testing) 리뷰 — entity nullable 배치 3

## 개요

`nullable: true` DB 컬럼인데 TS 타입이 non-null 이던 잔여 8필드(`audit_log.ip_address`,
`auth_config.ipWhitelist`/`lastUsedAt`, `edge.condition`, `folder.parentId`/`parent`,
`workflow_version.changeSummary`, `workspace_member.joinedAt`)를 `| null` 로 넓히고,
그로 인해 불필요해진 캐스트 2건(`folders.controller.ts` 의 `dto as Partial<Folder>`,
`folders.service.spec.ts` 의 `null as unknown as string`)을 제거한 변경. 회귀 가드
(`nullable-type-lie-cast.spec.ts`)와 typecheck ratchet baseline 갱신이 동반된다.

## 발견사항

- **[INFO]** 회귀 가드(`nullable-type-lie-cast.spec.ts`)의 격리·대조군 설계가 우수함
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (`withFixture` 헬퍼, `describe('[대조군] 술어가 실제로 무는가')`)
  - 상세: 저장소 소스 파일을 직접 변형(`writeFileSync`)했다가 복원하는 이전 방식의 실패 사례
    (복원 실패 시 서비스 파일 변조 잔존, `eslint --fix` 로 인한 무효 뮤턴트)를 스스로 문서화하고,
    OS tmp 디렉터리(`fs.mkdtempSync` + `finally` 블록의 `rmSync`)로 격리하는 방식으로 교체했다.
    `folder.parentId`/`@JoinColumn` 면제 경계(같은 컬럼명이면 면제, 다르면 면제 안 됨)를 양방향
    fixture 로 정확히 이 PR 의 실제 케이스와 동일한 형태로 검증한다. 이 세션이 리뷰 프롬프트에서
    금지한 "저장소 트리 뮤테이션"의 위험을 이미 스스로 인지·회피한 선례로서 참고할 만하다.
  - 제안: 없음 (긍정 소견).

- **[INFO]** 가드는 "증상"(이중 캐스트 재등장, `type:` 누락) 기반이라 "타입 재축소" 자체는 직접 못 잡는 구조적 한계
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`findCastOffenders`, `findUntypedNullableColumns`)
  - 상세: 예를 들어 향후 누군가 `edge.condition: Record<string, unknown> | null` 을 다시
    `Record<string, unknown>` 으로 좁히더라도, 소비 코드(`workflows.service.ts` 의
    `e.condition ?? null`)가 이미 `??` 로 방어하고 있어 캐스트가 필요 없다면 `findCastOffenders`
    도 `findUntypedNullableColumns` 도 이 회귀를 잡지 못한다(둘 다 "넓혀진 뒤"의 증상만 스캔한다).
    현재 diff 는 이 한계와 무관하게 올바르지만, 이 가드가 "이 클래스는 이제 스스로 닫힌다"(plan
    §회귀 가드)고 서술한 것은 정확히는 **이중 캐스트/미타입 증상 재발**에 한정된 보장이지
    "타입이 다시 좁아지는 것" 자체를 막는 보장은 아니다.
  - 제안: 이번 PR 범위는 아니지만, 후속으로 DB 스키마(migration)·엔티티 nullable 선언·TS 타입
    3자 대조 가드를 별도 축으로 고려할 수 있음을 plan 후속 항목에 남겨 둘 가치가 있음.

- **[INFO]** `folders.controller.ts` 의 캐스트 제거는 순수 컴파일타임 정리로 런타임 동작 변화 없음 — 별도 컨트롤러 단위 테스트 불필요
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:114` (`update()` 핸들러, `dto as Partial<Folder>` → `dto`)
  - 상세: `Folder.parentId` 가 `string | null` 로 넓혀지며 `UpdateFolderDto.parentId?: string | null`
    (`codebase/backend/src/modules/folders/dto/update-folder.dto.ts:33`)과 구조적으로 정확히
    일치하게 되어 캐스트가 `no-unnecessary-type-assertion` 로 걸린 것(커밋 메시지 확인). 값 변환이
    없는 타입 단언 제거이므로 런타임 인자는 이전과 동일 — 새 단위/e2e 테스트가 필요한 변경은 아님.
    다만 `folders.controller.spec.ts` 는 `@Roles` 메타데이터만 검증하고 `update()` 핸들러가
    `foldersService.update(id, workspaceId, dto)` 를 그대로 호출하는지(인자 변형 없음)를 직접
    단언하는 테스트는 없다 — 이는 이 PR 이 만든 갭이 아니라 **선재 갭**이며, 캐스트 제거로 인해
    "미래에 실수로 다시 변환 로직이 들어와도 못 잡는다"는 리스크가 근소하게 커진 정도다.
  - 제안: 낮은 우선순위. 필요 시 `foldersService.update` 를 mock 하고 controller 가 `dto` 를
    그대로 전달하는지 확인하는 테스트를 추가할 수 있으나, 이번 PR 의 스코프를 넘어선다.

- **[INFO]** null 소비 경로(`condition ?? null`, `ipWhitelist?.length`)에 대한 회귀 테스트는 이미 존재 — 이번 PR 이 새로 필요로 하는 커버리지는 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:499,733` (`condition: null` fixture, `expect(dataEdge.condition).toBeNull()`), `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:417-429`(`ipWhitelist` 미설정 시 통과 경로 — 암묵적으로 `?.length` falsy 분기 실행)
  - 상세: 엔티티 타입만 넓어졌을 뿐 이 소비처들은 이미 `null`/`undefined` 를 다루고 있었고, 그
    경로가 기존 테스트로 커버되어 있음을 확인했다(신규 테스트 없이도 회귀 위험 낮음). typecheck
    ratchet 이 `198/37 → 197/36` 으로 **감소**한 것도 이 8필드 확장이 다른 스펙 파일에 새 타입
    오류를 만들지 않았음을 뒷받침한다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `folders.service.spec.ts` 캐스트 제거의 "무의미하지 않음" 주장이 대조군으로 뒷받침됨
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:14`
  - 상세: plan/커밋 메시지가 "엔티티를 `string` 으로 되돌리면 그 파일에 오류 2건이 난다"는
    대조군 확인을 명시하고 있고, ratchet baseline diff(`scripts/backend-typecheck-baseline.json`)
    에서 `folders.service.spec.ts` 항목(과거 1건)이 완전히 제거되어 total 이 198→197 로 감소한
    것과 일치한다. 뮤테이션 검증이 문서 주장에 그치지 않고 기계적 증거(ratchet 수치)로 뒷받침됨.
  - 제안: 없음 — 확인 목적의 기록.

## 요약

이 변경은 8개 엔티티 필드의 TS 타입을 실제 DB nullable 과 일치시키는 순수 타입 정정이며, 런타임
동작 변화가 있는 지점(TypeORM `design:type` → `Object` 방출로 인한 부팅 실패 클래스)은 전용 회귀
가드(`nullable-type-lie-cast.spec.ts`)로 기계적으로 막혀 있고, 이 가드 자체의 테스트 격리·대조군
설계도 양호하다(scratch tmp dir 사용, 저장소 트리 미변형). `folders.controller.ts`/
`folders.service.spec.ts` 의 캐스트 제거 2건은 값 변환이 없는 순수 정리이며, 각각 lint 규칙
검출과 ratchet 수치 감소라는 기계적 증거로 뒷받침된다. 커밋 메시지 기준 unit 9,250·e2e 292(부팅
확인)·lint·build·`tsc`·가드 12/12 가 모두 통과했다고 기록되어 있다. 발견된 항목은 모두 INFO
수준으로, "타입 재축소" 자체를 직접 막지 못하는 가드의 구조적 한계와 `folders.controller.spec.ts`
가 핸들러 인자 위임을 직접 단언하지 않는 선재 갭 정도이며 둘 다 이번 PR 이 새로 만든 리스크가
아니다.

## 위험도

LOW
