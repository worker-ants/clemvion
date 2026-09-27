# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `FolderDto.parentId` 의 OpenAPI 계약이 optional→required(+nullable) 로 좁아진다 — 생성된 API 클라이언트에 영향 가능
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts:18-21`
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true }) parentId?: string | null;` 이
    `@ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null;` 로 바뀌었다.
    이는 노출되는 OpenAPI 스키마(공개 인터페이스)를 "키가 없을 수도 있음" 에서 "키가 항상 존재함(값만 null 일 수
    있음)" 으로 좁힌다. plan(`plan/in-progress/folders-contract-e2e.md` "실측" 절, e2e 뮤턴트 M1)의 실측에 따르면
    런타임 응답은 원래도 항상 이 키를 실었으므로 **동작 변경은 아니고 선언을 실측에 맞춘 정정**이다. 다만 이
    DTO 로 생성된 OpenAPI 문서를 코드-생성(codegen)으로 소비하는 외부 클라이언트가 있다면, 재생성 시 필드가
    optional→required 로 바뀌어 해당 클라이언트 타입이 변경될 수 있다.
  - 제안: 실측대로 실제 위험은 낮음(문서만 실제 계약을 뒤늦게 반영). 별도 조치 불요 — 참고용 기록.

- **[INFO]** `FoldersService.update()` 의 병합 동작이 바뀐다 — `undefined` 필드가 더는 로드된 값을 덮지 않음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:71-80` (`update()`)
  - 상세: `Object.assign(folder, data)` 가 `Object.assign(folder, defined)`(`defined` = `data` 에서
    `v !== undefined` 인 항목만 남긴 객체)로 바뀌었다. 시그니처(`update(id, workspaceId, data: Partial<Folder>): Promise<Folder>`)
    자체는 변경이 없어 호출자 코드는 그대로 컴파일·동작하지만, **의미론(semantics)**은 바뀐다 — 이전에는 DTO
    인스턴스의 `undefined` own-property 가 로드된 값을 지워 PATCH 응답이 틀렸다(결함, plan 이 e2e C·E 로 실측).
    지금은 `data.parentId === null` 처럼 **명시적** null 은 여전히 반영되고(`null !== undefined`), `undefined` 인
    필드만 걸러진다 — "루트로 이동"(`parentId: null`) 케이스는 `folders.service.spec.ts` "allows moving to root"
    로 회귀 확인됨. 의도된 버그 수정이고 단위·e2e·뮤턴트 표(M5)로 뒷받침된다.
  - 제안: 조치 불요 — 의도된 수정이며 검증이 충분하다. 같은 형태(`Object.assign(엔티티, DTO)`)가 남은
    `workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts` 의 `update()` 는 이번 diff 밖이며
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 항목으로 이미 등재돼 있다(중복 지적 불필요).

- **[INFO]** 신설 e2e(`folder-crud.e2e-spec.ts`)가 환경변수를 읽고 외부(테스트) 서비스로 네트워크 호출·DB 커넥션을 연다
  - 위치: `codebase/backend/test/folder-crud.e2e-spec.ts:28` (`process.env.E2E_BASE_URL`), `:42-47`
    (`createDbClient()`/`db.connect()`, `registerAndLogin`, `createTeamWorkspace`)
  - 상세: `E2E_BASE_URL` 환경변수 읽기와 `http://backend-e2e:3011` 기본값으로의 HTTP 호출, Postgres 커넥션 개설은
    이 저장소의 기존 형제 e2e 스펙(`workflow-crud.e2e-spec.ts` 등)과 동일한 관행이며 `.e2e-spec.ts` 명명으로
    일반 unit 테스트 실행 경로에는 섞이지 않는다. 새로운 프로덕션 코드 경로의 부작용이 아니라 테스트 하네스
    범위 내의 기대된 I/O 다.
  - 제안: 조치 불요.

- **[INFO]** 일관성 검토 산출물(`review/consistency/2026/09/27/10_39_26/**`, `_retry_state.json` 포함)이 이번
  diff 에 커밋됨
  - 위치: `review/consistency/2026/09/27/10_39_26/meta.json`, `_retry_state.json`, `SUMMARY.md`, 각 checker `.md`
  - 상세: 프로젝트 규약상 `review/` 는 gitignore 대상이 아니고 검토 산출물은 그대로 보관하는 관례라(`CLAUDE.md`
    저장 위치 표) 이 파일들의 존재 자체는 저장소 관례에 부합한다. orchestrator 내부 상태 파일(`_retry_state.json`)
    까지 커밋에 포함된 점만 참고로 기록한다 — 재현·재실행에 필요한 진행 상태 스냅샷이라 문제로 보지 않는다.
  - 제안: 조치 불요.

## 부작용 재현/뮤테이션 관련 고지

이번 리뷰에서는 저장소 파일을 수정하지 않았다(정적 diff 검토만 수행). 프롬프트가 안내한 대로 뮤턴트 표는
`plan/in-progress/folders-contract-e2e.md` §뮤턴트 에 이미 실측돼 있어 별도 재현을 시도하지 않았고, 그 표의
결론(M1 POST 전제 반증, M5 update() undefined 덮어쓰기 결함 실측)을 그대로 신뢰해 위 항목 근거로 인용했다.
`git status --short` 확인 결과 이 세션이 저장소에 남긴 변경은 없다(리뷰 산출물 파일 작성 제외).

## 요약

이번 변경 셋(폴더 `FolderDto.parentId` 선언 정정, `FoldersService.update()` 의 `undefined`-필드 필터링, 관련
래칫·e2e·단위 테스트·CHANGELOG·plan 문서)은 전형적인 "의도치 않은" 부작용 — 숨은 전역 상태 변경, 예상 밖 파일
시스템 쓰기, 콜백/이벤트 변경, 무단 네트워크 호출 — 을 일으키지 않는다. 유일하게 부작용 렌즈로 볼 만한 두
지점은 (1) `FolderDto.parentId` 가 OpenAPI 계약상 optional→required 로 좁아진 것(런타임 동작은 실측상 불변)과
(2) `update()` 의 병합 semantics 변경(의도된 버그 수정, 명시적 `null` 은 보존됨)이며, 둘 다 plan 의 실측·뮤턴트
표·신규 테스트로 뒷받침되어 있어 CRITICAL/WARNING 급 위험으로 보지 않는다. 신설 e2e 의 환경변수 읽기·네트워크
호출은 기존 형제 e2e 스펙과 동일한 테스트 하네스 관행이다.

## 위험도

LOW
