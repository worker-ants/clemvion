# 부작용(Side Effect) 리뷰

## 조사 범위와 방법

`git diff origin/main...HEAD` 로 실제 변경분을 확인했다(프롬프트의 diff 는 크기 제한으로
다수 파일이 생략되어 있어, 생략된 파일은 저장소에서 직접 `git diff`/`Read` 로 열었다). 이
브랜치는 `User` 엔티티 컬럼 노출 방어 2축 신설(`96d3856a9`)에서 시작해 이후 다수의 리뷰
라운드 fix 커밋(`bfa124920`~`a185846a5`)이 이어진 상태이며, 프롬프트에 나열된 파일 상당수
(`review/**`, `plan/**`)는 그 과정에서 쌓인 리뷰/컨시스턴시 리포트 산출물이다 — 이들은 워크플로가
의도적으로 생성하는 문서이므로 "예상치 못한 파일시스템 부작용" 대상이 아니라고 판단해 제외하고,
실행 코드·테스트·설정에 집중했다. 리뷰 중 저장소에 어떤 파일도 쓰거나 수정하지 않았다(뮤테이션
테스트 불필요 — 정적 판독만으로 충분히 결론 가능). 리뷰 종료 시 `git status --short` 로 확인한
결과 이 세션이 새로 만든 파일은 이번 리뷰 라운드 자신의 산출 디렉터리(`review/code/.../14_59_48`,
`review/consistency/.../14_59_49`)뿐이다.

## 발견사항

- **[INFO]** 공유 게이트 파서 수정의 파급 범위가 이 PR 의 직접 변경분을 넘어선다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code` 함수의 block-list 파싱 루프(빈 줄·`#` 주석 skip 로직 추가 지점)
  - 상세: 이 함수는 저장소 전체 spec 문서의 `code:` frontmatter 를 파싱해 `--impl-done`/push 게이트가 "어느 파일이 spec-linked 인가"를 판정하는 단일 SoT다. 이번 수정은 순수 함수 자체의 버그(주석·빈 줄에서 조기 `break`)를 고치는 것이지만, 그 결과 파싱되는 entry 수가 690→731(CHANGELOG 실측)로 넓어졌고, 이는 이 PR 이 손대지 않은 7개 spec 파일·41개 entry 에 걸쳐 있다. 즉 이 커밋 하나가 이 PR 과 무관한 다른 영역(예: `spec/2-navigation/9-user-profile.md`)의 게이트 판정을 동시에 바꾼다 — 실제로 이 브랜치 안에서 그 확대가 `2-trigger-list.md` 관할의 새 Critical(트리거 UNIQUE 충돌 응답 계약 갭)을 즉시 끌어냈다. 함수 자체는 부수효과 없는 순수 파싱(파일 읽기만, 전역 상태 변경 없음)이라 코드 레벨 위험은 없지만, "공유 인프라 파서 수정 → 무관 spec 영역의 게이트 스코프 확대"라는 조직적 부작용의 크기는 리뷰에서 명시적으로 짚어 둘 가치가 있다.
  - 제안: 조치 불요 — 의도된 버그 수정이며 CHANGELOG·커밋 메시지·회귀 테스트(6건, 반대 방향 대조군 포함)로 이미 투명하게 disclose 되어 있다. 다만 병합 시점에 다른 in-flight 브랜치가 이 스코프 확대로 새로 게이트에 걸릴 수 있음을 팀 공지 차원에서 인지해 둘 것.

- **[INFO]** `TriggersService` — 기존 엔드포인트의 409 응답 바디 형태가 확장된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` (신규 private 메서드) 및 `create`/`update` 메서드의 `this.triggerRepository.save(trigger).catch(...)` 배선
  - 상세: `POST /api/triggers`, `PATCH /api/triggers/:id` 가 `(workspace_id, endpoint_path)` UNIQUE 위반 시 이제 응답 봉투에 `details: { field: 'endpoint_path', subCode: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 새로 싣는다. 종전에는 전역 `GlobalExceptionFilter` 의 `isUniqueViolation` 분기가 `details` 없이 `RESOURCE_CONFLICT` 만 반환했다. 상태 코드(409)와 top-level `code`(`RESOURCE_CONFLICT`)는 그대로이고 `details` 만 추가되는 additive 변경이라 기존 클라이언트를 깨뜨릴 가능성은 낮지만, 실제 wire 응답 형태가 바뀌는 인터페이스 변경인 것은 사실이다. 다른 UNIQUE 위반(`idx_trigger_workspace_name` 등)은 이 분기를 타지 않고 그대로 흘려보내도록 인덱스 이름으로 좁혀 놓았음을 `triggers.service.spec.ts` 의 반대 방향 대조군(`다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다`)으로 확인했다.
  - 제안: 조치 불요 — CHANGELOG 에 "순수 additive"로 명시돼 있고, 단위 테스트가 대상 케이스·비대상 케이스·일반 오류 케이스 세 방향을 모두 커버한다.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입이 좁혀지는 시그니처 변경
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne(workflowId, versionId): Promise<WorkflowVersionDetail>` (기존 `Promise<WorkflowVersion>`)
  - 상세: exported 되는 injectable 서비스의 공개 메서드 반환 타입이 `Omit<WorkflowVersion, 'creator' | 'workflow'> & { creator: ProjectedCreator }` 로 좁혀졌다(DB `select` 투영을 추가해 `passwordHash` 등 `User` 전 컬럼 유출을 막는 보안 수정의 부산물). 유일한 내부 호출자인 `WorkflowsService.restoreVersion`(`workflows.service.ts:666`)은 반환값에서 `.snapshot`/`.version` 만 사용하므로 영향이 없음을 직접 확인했고, 컨트롤러(`workflow-versions.controller.ts:81`)는 값을 가공 없이 그대로 반환해 런타임 동작에 변화가 없다. 실질적 부작용은 없으나, 향후 새 호출자가 `.workflow`나 `.creator` 의 다른 필드를 기대하면 컴파일 타임에 막히는 시그니처 변경이라는 점은 기록해 둔다.
  - 제안: 조치 불요 — 좁히는 방향의 안전한 변경이며 유일 호출자·컨트롤러 소비 지점 모두 확인 완료.

## 확인했으나 문제 없음으로 판단한 항목

- 신규 가드 3종(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`)은 전부 `fs.readFileSync` 읽기 전용 순수 함수다 — 파일 쓰기·프로세스 스폰·네트워크 호출·전역 가변 상태 변경이 전혀 없다.
- `CREATOR_PROJECTION`(`Object.freeze`)·`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`·`USER_SECRET_KEYS`(`as const`)는 전부 불변 모듈 상수이며 기존 전역 상태를 변경하지 않는다.
- 신규 e2e 케이스(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`, `workflow-crud.e2e-spec.ts`)가 만드는 워크스페이스·멤버·워크플로우·버전은 테스트 DB에 대한 통상적인 e2e 셋업 부작용이며 기존 스위트와 같은 패턴(`registerAndLogin`/`createTeamWorkspace`/`inviteAndAccept`)을 재사용한다 — 새로운 종류의 부작용이 아니다.
- 환경 변수 읽기/쓰기, 이벤트 발행/콜백 배선의 신규·변경은 diff 전체에서 발견되지 않았다.
- `review/**`, `plan/**` 아래 다수 파일은 코드 리뷰/컨시스턴시 체크 워크플로가 그 라운드마다 생성하는 산출물이며, 이 저장소의 상시 관례(각 라운드 디렉터리에 `SUMMARY.md`/`meta.json`/reviewer 리포트 기록)를 그대로 따른다 — "예상치 못한 파일 생성"이 아니다.

## 요약

이번 diff 의 핵심(`User` 엔티티 컬럼 노출 검출 2축 + DTO/컨트롤러 JSDoc 인용 가드)은 전부
읽기 전용 정적 스캔이라 side effect 관점에서 실질적 위험이 없다. 이 브랜치에 함께 실린 두
독립적인 fix(리뷰 게이트 frontmatter 파서 수정, 트리거 UNIQUE 충돌 응답 계약 정정)는 각각
"공유 파서의 동작 변경이 무관 영역까지 게이트 판정을 바꾼다"·"기존 엔드포인트의 409 응답
바디가 확장된다"는 두 갈래의 인터페이스/블라스트 반경 변화를 낳지만, 둘 다 additive 하고
CHANGELOG·회귀 테스트로 이미 투명하게 disclose·검증되어 있어 조치가 필요한 결함으로 보지
않는다. `WorkflowVersionsService.findOne` 의 반환 타입 축소도 유일 호출자를 직접 추적해
영향 없음을 확인했다. Critical·WARNING 급 부작용은 발견하지 못했다.

## 위험도

LOW
