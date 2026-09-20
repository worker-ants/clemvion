# 아키텍처 리뷰 — 동시 중복 DELETE 감사 (dup-delete-audit, 3라운드 종합)

## 컨텍스트

이번 diff 는 `origin/main` 대비 누적분으로, 실질 코드 변경은 파일 1~11(`CHANGELOG.md`,
`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`(+spec),
`workflows.service.ts`(+spec), `workspaces.service.ts`(+spec), 신규 e2e 2개,
`plan/in-progress/dup-delete-audit.md`)뿐이고, 나머지 40개 파일은 1·2라운드
(`review/code/2026/09/20/20_06_26`, `20_43_03`)와 `--impl-prep` consistency-check
(`review/consistency/2026/09/20/19_30_57`)가 이미 커밋한 리뷰 산출물(보고서 md/json)이다 —
코드가 아니므로 아키텍처 관점 평가 대상에서 제외했다. 핵심 소스 파일(`trigger-resource-release.ts`,
`workflows.service.ts:255-311`, `workspaces.service.ts:498-567`)은 `Read` 로 현재 상태를 직접
재확인했다(저장소 뮤테이션 없음).

이전 두 라운드가 이미 지적·해소한 이력을 요약하면: 1라운드(20_06_26)가 워크플로↔워크스페이스
삭제 경로의 "부모 부재" 처리 비대칭(워크스페이스는 403+거짓 ERROR 로그로 샐 수 있었다)을
아키텍처 CRITICAL 급 계약 불일치로 지적했고, 후속 커밋(`27f488d09`)이 이를 대칭화했다. 2라운드
(20_43_03)는 그 대칭화가 실제 코드에 반영됐음을 재확인했고, 그 수정이 **단위 mock 만으로
검증**돼 "이긴 쪽이 멤버 행까지 지운다"는 현실을 재현하지 못한다는 점을 WARNING 으로 남겼다.
이번 diff 의 마지막 커밋(`c3607d907`)이 실 DB 행 락으로 그 시나리오를 강제하는
`workspace-delete-concurrency.e2e-spec.ts` 를 추가해 그 WARNING 을 닫았다.

## 발견사항

- **[INFO]** "잠금 → 헬퍼 호출 → `parentPresence === 'absent'` 검사 → `NotFoundException` →
  `.catch` 에서 `instanceof` 로 구분해 로그 억제" 4단 패턴이 `WorkflowsService.remove()`와
  `WorkspacesService.deleteWorkspace()` 두 곳에 글자 그대로 복제돼 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `remove()`(약 262~309행,
    특히 `if (locked.parentPresence === 'absent')` 분기와 `.catch` 안
    `if (err instanceof NotFoundException) throw err;`), `codebase/backend/src/modules/workspaces/workspaces.service.ts`
    `deleteWorkspace()`(약 498~567행, 동일 형태의 두 분기).
  - 상세: 이 복제는 이번 PR 이 처음 만든 구조는 아니지만("잠금→트랜잭션→`.catch`" 골격 자체는
    기존 코드), `absent` 판정과 로그 억제 가드는 이번 PR 이 두 자리에 동시에 손으로 새겨 넣은
    것이다. 실제로 이 복제는 **이번 PR 진행 중 한 번 어긋났다** — 1라운드 리뷰 시점에는 워크플로
    쪽에만 이 가드가 있고 워크스페이스 쪽엔 없었다(사후 `27f488d09` 로 대칭화). 즉 "두 사이트가
    나란히 유지된다"는 불변식은 컴파일러나 타입 시스템이 지켜주지 않고 사람이 매 수정마다 손으로
    맞춰야 하는 상태이며, 이미 한 번 깨졌다가 리뷰로 잡힌 전례가 이 PR 자체 안에 있다. `plan/in-progress/dup-delete-audit.md`
    가 인용하는 `spec-draft-nullable-notation-followups.md` 의 "네 자리(트리거·스케줄·워크플로·
    워크스페이스) 공용 형태" 미착수 설계 항목이 정확히 이 자리를 가리키므로 새로 발견한 사실은
    아니나, 세 번째·네 번째 자리(트리거·스케줄)로 이 패턴이 번질 때 같은 실수가 반복될 위험을
    구체적으로 뒷받침하는 근거(실제 1회 재현)가 이번 PR 로 새로 쌓였다.
  - 제안: 조치 불요(이미 추적 중, 이번 PR 스코프 아님). 다만 "네 자리 공용 형태" 설계 착수 시,
    `guardAgainstConcurrentDelete(locked, () => new NotFoundException({...}))` 류의 공용 헬퍼로
    "absent 검사 → 롤백 → catch 에서 조용히 재던지기"를 한 곳에 모으면 이 클래스의 결함이 구조적으로
    재발하지 않는다. 이번 PR 이 이미 한 번 어긋났던 사례를 그 설계 우선순위의 근거로 plan/트래커에
    남겨두는 것을 권장.

- **[INFO]** `RESOURCE_NOT_FOUND` / `'Workflow not found'` 리터럴이 `WorkflowsService` 안에서
  두 번(기존 `findById`, 신규 `remove()` 의 `absent` 분기) 그대로 중복된다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `findById`(기존 조회
    실패 분기)와 `remove()` 내부 `if (locked.parentPresence === 'absent') { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' }); }`.
  - 상세: 값 자체는 완전히 동일해 즉각적 drift 위험은 낮지만, 이 저장소가 "복사된 리터럴 한 곳만
    갱신" 패턴을 반복해 겪었다는 점에서 다음 수정자가 한 곳만 고칠 여지가 남는다. 이미 1·2라운드가
    같은 지점을 지적했고 의도적으로 비차단·후속으로 남겨둔 것으로 보인다.
  - 제안: `private workflowNotFound(): never { throw new NotFoundException({...}); }` 류 헬퍼로
    묶으면 이후 두 자리를 따로 추적할 필요가 없다. 급하지 않음.

- **[정정 확인 — 발견사항 아님]** 1라운드가 MEDIUM 위험도로 지적한 아키텍처 계약 불일치(워크플로는
  "부모 부재=실패 아님" 원칙을 로그까지 반영하는데, 워크스페이스는 `assertWorkspaceDeletable` 의
  "멤버십(권한) → 존재" 판정 순서 때문에 403 오응답 + 거짓 ERROR 로그로 샐 수 있었던 것)은 후속
  커밋(`27f488d09`)으로 실제 코드에서 대칭 해소됐음을 `Read` 로 직접 재확인했다
  (`workspaces.service.ts:530-535` 의 `absent` 404 단락이 `assertWorkspaceDeletable` 재검사보다
  먼저 실행되고, `:553` 의 `NotFoundException` 재던짐 가드가 로그를 억제한다). 2라운드가 남긴
  후속 WARNING(그 대칭화가 단위 mock 으로만 검증돼 "이긴 쪽이 멤버 행까지 CASCADE 로 지운다"는
  현실을 재현하지 못한다)도 이번 diff 의 `workspace-delete-concurrency.e2e-spec.ts`(실 DB 행 락으로
  경합 강제, `[200, 404]` + `WORKSPACE_NOT_FOUND` 단언)가 닫는다.

- **[정정 확인 — 발견사항 아님]** 1라운드가 지적한 "같은 함수 안에서 파라미터 `parent: TriggerParent`
  와 반환 필드 `parent: 'present'|'absent'`가 이름이 같아 시각적으로 혼동될 수 있다"는 WARNING 은
  `parentPresence` 로 리네임되어 인터페이스(`trigger-resource-release.ts:126`)·구현
  (`trigger-resource-releaser.service.ts`)·두 호출부·세 spec 파일에 동일하게 전파됐음을 확인했다.
  잔여 `parent:` 필드 사용처는 없다.

- **[설계 양호 — 참고]** `LockedParentTriggers { parentPresence: 'present'|'absent'; triggerIds: string[] }`
  는 "부재"와 "0개"를 이름 있는 값으로 분리한 정석적 판별 유니온이며, 유일한 구현체·유일한 두
  호출자·세 spec 파일이 같은 커밋들 안에서 함께 갱신됐다. 포트(`TriggerResourceReleasePort`)가
  `EntityManager`·락 모드를 이미 JSDoc 에 노출하는 기존 설계 궤적과도 일치해 새로운 추상화 누수가
  아니다. `resolveTriggerResourceReleaser` 를 통한 `ModuleRef.get(TOKEN, { strict: false })` 지연
  해석(순환 의존 회피, `#676` 선례)도 이번 diff 로 훼손되지 않았다 — 호출부·시그니처 변경 없음.

## 요약

핵심 변경(`LockedParentTriggers` 도입, 워크플로/워크스페이스 두 삭제 경로의 대칭적 404 처리,
결정적 e2e 두 벌)은 SOLID·의존성 역전·순환 회피 관점에서 견고하다 — 포트가 이미 버리던 값을
그대로 돌려주는 최소 변경으로 감사 중복을 닫았고, 판별 유니온으로 "부재"와 "0개"를 명시적으로
갈랐으며, 두 호출부와 테스트가 함께 갱신됐다. 1라운드가 지적한 유일한 아키텍처 CRITICAL/MEDIUM 급
우려(워크플로↔워크스페이스 계약 비대칭)와 그 재검증 과정에서 2라운드가 남긴 WARNING(mock-only
검증)은 이번 diff 로 실 DB e2e 까지 포함해 해소됐음을 코드를 직접 읽어 재확인했다. 유일하게 남는
관찰은 "잠금→absent 검사→NotFoundException→catch 구분" 패턴이 두 서비스에 완전히 동일한 모양으로
복제돼 있고, 그 복제가 이번 PR 진행 중 실제로 한 번 어긋났다가(워크스페이스 쪽 최초 누락) 리뷰로
잡힌 전례가 방금 생겼다는 점이다 — 이미 별도 트래커("네 자리 공용 형태" 설계)가 추적 중이므로
이번 PR 을 막을 사유는 아니지만, 세 번째·네 번째 자리(트리거·스케줄)로 패턴이 번질 때 우선순위를
뒷받침하는 실측 근거로 남겨둘 가치가 있다. 그 외 레이어 책임·모듈 경계·순환 의존 문제는 없다.

## 위험도

LOW
