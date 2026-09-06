# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TriggersService.create`/`update` — `save()` 실패 경로에 새 `.catch()` 훅이 추가되어 트리거 409 오류 응답의 형태가 바뀐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create` 내 `const saved = await this.triggerRepository.save(trigger).catch(...)`(약 424~426번째 줄), `update` 내 동일 패턴(약 510~512번째 줄), 신설 `rethrowEndpointPathConflict` 프라이빗 메서드
  - 상세: `(workspace_id, endpoint_path)` UNIQUE 위반(`idx_trigger_workspace_endpoint`)일 때만 `ConflictException({ code: 'RESOURCE_CONFLICT', details: { field, code } })` 로 감싸 던지고, 그 외 모든 오류(다른 UNIQUE 인덱스 위반 포함)는 원본 그대로 rethrow 한다 — `triggers.service.spec.ts` 의 반대 방향 대조군 두 세트(`다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다`, `unique 위반이 아닌 오류도 그대로 흘려보낸다`)로 직접 확인했다. 전역 `GlobalExceptionFilter`(이 diff 에서 미변경 확인)와 별개로 서비스 레이어가 이 한 케이스만 좁혀 가로채는 것이라, `POST/PATCH /api/triggers` 의 409 응답 바디에 `details` 키가 새로 실리는 컨슈머 관측 가능한 변화다. spec(`2-trigger-list.md §3`)이 요구하던 형태를 실제로 맞추는 의도된 수정이고 방향 검증(맞는 인덱스/다른 인덱스/비-unique 오류 3갈래)이 다 되어 있어 위험도는 낮지만, "에러 응답 바디 형태 변경"이라는 인터페이스 변화 자체는 side-effect 관점에서 기록해 둔다.
  - 제안: 조치 불요 — 의도된 계약 정합화이고 양방향 테스트로 뮤테이션 검증됨. 프런트엔드가 이 409 를 파싱하는 자리가 있다면 `details` 신규 키 추가와 호환되는지만 확인.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입·런타임 형태 변경(`Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>`) — 유일한 내부 호출자만 확인됨
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 시그니처(약 141~144번째 줄)와 신설 `select` 객체(약 145~166번째 줄), 소비처 `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts:81`(`return this.workflowVersionsService.findOne(wfId, versionId);`, 반환 타입 미고정이라 컴파일 영향 없음)
  - 상세: 이전에는 `relations: ['creator']` 로 `User` 관계를 투영 없이 통째로 로드해 컨트롤러가 그대로 반환 — 즉 `passwordHash` 등 `User` 전 컬럼이 wire 로 나갔다(CHANGELOG·RESOLUTION 이 명시하는 실제 유출). 이번 diff 는 `select` 로 `creator` 를 3필드(`id/name/email`)로 좁히고 반환 타입도 그에 맞춰 좁혔다. `WorkflowVersion` 엔티티의 non-relation 컬럼(`id/workflowId/version/changeSummary/snapshot/createdBy/createdAt` 7개)과 `select` 목록이 정확히 일치함을 엔티티 파일로 직접 대조해 확인했으므로, 의도치 않게 다른 컬럼이 함께 빠지는 회귀는 없다. 이 서비스 메서드를 호출하는 곳은 컨트롤러 한 곳뿐이고 그 메서드는 반환 타입을 명시하지 않아 컴파일이 깨지지 않는다. 프런트엔드의 손-미러 타입(`codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail`)은 이미 `creator` 를 옵셔널·더 넓은 형태로 선언해 두고 있어 이번 narrowing 과 충돌하지 않는다(diff 자체가 그 사실을 JSDoc 으로 명시). 의도된 보안 수정이며 unit(`workflow-versions.service.spec.ts`)·e2e(`workflow-crud.e2e-spec.ts` "H." 케이스) 양쪽에서 새 형태를 검증한다.
  - 제안: 조치 불요 — 시그니처 변경의 유일한 영향 범위(컨트롤러 1곳)를 확인했고 프런트 미러 타입과도 충돌 없음.

- **[INFO]** `pg-error.ts` 의 비공개 `PgLikeError` 인터페이스에 `constraint`/`driverError.constraint` 필드 추가
  - 위치: `codebase/backend/src/common/db/pg-error.ts` — `interface PgLikeError`(비-export)
  - 상세: 이 인터페이스는 모듈 밖으로 export 되지 않고 `unknown` 값을 캐스팅하는 내부 용도로만 쓰인다. 필드 추가는 순수 widening 이라 기존 호출부(`pgErrorCode`/`isPostgresUniqueViolation`) 동작에 영향 없음을 확인. 새로 추가된 `pgErrorConstraint` export 도 신규 함수라 기존 시그니처 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 Swagger 스키마 전용 — 런타임/컴파일 영향 없음 확인
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81`(`joinedAt: string | null;`), 소비처 `codebase/backend/src/modules/workspaces/workspaces.controller.ts:284`(`@ApiOkWrappedArrayResponse(WorkspaceMemberDto, ...)`)
  - 상세: `WorkspaceMemberDto` 는 컨트롤러에서 데코레이터 인자(Swagger 문서 생성용)로만 참조되고, 실제 반환값의 TS 타입으로는 강제되지 않는다(`grep` 결과 다른 참조 없음) — 따라서 필드 추가가 기존 빌드를 깨뜨릴 자리가 없다. `WorkspacesService.listMembers` 는 이 diff 이전에도 이미 `joinedAt` 을 런타임에 채우고 있었음(`workspaces.service.spec.ts` 신규 단위 테스트로 확인) — 이번 변경은 실제 동작을 뒤늦게 선언한 것이지 새 동작을 만든 것이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/hooks/_lib/review_guard.py` `_parse_frontmatter_code` 파서 로직 변경 — 순수 함수, fs 읽기만 유지, 새 부작용 없음
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code`/신설 `_strip_comment` 헬퍼
  - 상세: YAML 블록 리스트에서 빈 줄·줄 주석을 건너뛰고, 트레일링 주석(인용부호 유무 갈라 처리)을 잘라내도록 고쳤다. 함수는 여전히 대상 spec 파일을 읽기만 하고(`open(path, ...)`) 쓰기·삭제·네트워크 호출은 없다. 이 함수의 산출물은 harness 내부의 spec-linked 게이팅 판정에만 쓰이므로, 파싱 결과가 바뀌면(전보다 더 많은 glob 을 정확히 인식) 그 게이트가 이전보다 **더 엄격하게** 물 수 있다는 점만 참고 — 이는 이번 PR 이 명시적으로 의도한 버그 수정(41개 entry 유실 복구)이며 신규 테스트(`test_review_guard.py`)로 여러 형태를 개별 검증했다.
  - 제안: 조치 불요.

## 부작용 없음 확인 (체크리스트 대조)

- **전역 변수**: 이번 diff 가 새로 도입한 모듈 레벨 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `CREATOR_PROJECTION`(Object.freeze), `USER_SECRET_KEYS`/`FORBIDDEN`(Set))는 전부 초기화 후 재할당되지 않는 읽기 전용 상수다. 기존 전역 상태를 수정하는 코드는 없음.
- **파일시스템 부작용**: 신설 static-analysis 가드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)는 `fs.readFileSync` 만 쓰고 쓰기·삭제 API 호출이 없음을 직접 열어 확인. `git diff` 전체에서 `writeFileSync`/`fs.write`/`fs.mkdir`/`fs.unlink`/`fs.rm`/`child_process`/`exec(`/`spawn(` 패턴을 grep 했으나 신규 도입 0건(정규식 리터럴 오탐 1건 제외).
- **환경 변수**: 전체 diff 에서 `process.env` 신규 참조 0건.
- **네트워크 호출**: 전체 diff 에서 `fetch(`/`axios`/`http(s).request` 신규 참조 0건. e2e 테스트가 로컬 테스트 인프라(DB·API 서버)에 호출하는 것은 기존 e2e 관례 그대로.
- **이벤트/콜백**: 신규 이벤트 발행·구독 없음. `triggers.service.ts` 의 `.catch()` 는 promise 체인 안에서 처리되고 `await` 로 이어지므로 unhandled rejection 위험 없음.

## 요약

이번 diff 는 `User` 엔티티 컬럼 노출 방어(검출 3축: 구조 가드·이름 가드·인용 가드) 신설과, 그 과정에서 실측으로 드러난 두 개의 실제 데이터 계약 버그(`WorkflowVersionsService.findOne` 의 `User` 전체 노출, `2-trigger-list.md §3` 이 문서화했지만 구현되지 않았던 409 `details`)를 수정한다. 두 수정 모두 반환 형태·에러 응답 형태를 바꾸는 **의도된** 인터페이스 변경이며, 각각 유일한 호출자·양방향 뮤테이션 테스트로 영향 범위가 좁게 확인되어 있다. 전역 변수 도입, 예상치 못한 파일시스템 쓰기, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 diff 전체에서 발견되지 않았다. `.claude/hooks/_lib/review_guard.py` 의 YAML 파서 수정도 순수 읽기 함수로 harness 내부 게이팅에만 영향을 준다. Critical/Warning 급 부작용은 없다.

## 위험도

LOW
