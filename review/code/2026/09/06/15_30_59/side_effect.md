# 부작용(Side Effect) 리뷰

## 검토 방법 메모

프롬프트 번들(180+ 파일)의 대부분은 이전 리뷰/컨시스턴시 라운드가 산출한 `review/**` 마크다운(과거 라운드 기록)으로, 이번 diff 의 실질 코드 변경이 아니다. `git diff --stat origin/main...HEAD -- codebase/ .claude/` 로 실제 코드/harness 변경 22개 파일을 추출해 그 원본을 직접 열어 대조했다. 각 신규 가드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`)는 `fs.writeFile`/`process.env`/`execSync`/`fetch`/`http` 호출이 없는지 grep 으로 전수 확인했다 — 전부 0건(읽기 전용 정적 분석).

## 발견사항

- **[INFO]** `TriggersService.create`/`update` 의 `save()` 실패 경로에 새 `.catch()` 핸들러가 추가되어 예외 형태가 바뀐다 — 호출자 영향 확인, 문제 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create()` 의 `this.triggerRepository.save(trigger).catch(...)` 및 `update()` 의 동일 패턴(신규 `rethrowEndpointPathConflict` private 메서드가 이를 처리)
  - 상세: `(workspace_id, endpoint_path)` UNIQUE 위반일 때만 `ConflictException`(409, `details.field/code`)으로 변환하고, 그 외 모든 에러(다른 UNIQUE 위반 포함)는 `throw err`로 원본 그대로 재던진다. 반환 타입은 `never`라 `saved` 변수의 타입 추론에는 영향이 없다. `.save()` 실패 시 이후 코드(감사 로그 기록, secret store 마이그레이션, chatChannel setup 등)가 실행되지 않는 것은 변경 전과 동일 — 에러가 나는 시점·전파 경로 자체는 안 바뀌고 "무엇을 던지는가"만 좁혀졌다. 인덱스 이름(`idx_trigger_workspace_endpoint`)이 `V002__indexes.sql`의 실제 이름과 일치함을 grep 으로 확인했고, 이름이 어긋나는 경우(안전한 방향인 "그대로 흘려보냄")도 테스트로 고정돼 있다. 신규 export `isEndpointPathUniqueViolation`는 추가적 공개 표면이며 기존 export 와 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입 변경(`Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>`) — 유일 호출자(컨트롤러)에 명시적 반환 타입 주석이 없어 컴파일 영향 없음, wire 형태는 오히려 좁아짐(민감 컬럼 제거)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne` 시그니처), 호출부 `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts:81`
  - 상세: `findOne`이 이제 `select` 절로 `creator`를 3필드(`id`/`name`/`email`)로 투영한다. 이전에는 `relations: ['creator']`만 지정해 `User` 전 컬럼(`passwordHash` 등)이 로드되고 컨트롤러가 가공 없이 그대로 반환했다(실측: 이번 PR 자체가 이를 Critical로 지목·수정). 컨트롤러 메서드에 반환 타입 애너테이션이 없어 타입 시그니처 변경이 컴파일 에러를 일으키지 않음을 직접 확인했다. `WorkflowVersionListItem`/`WorkflowVersionDetail`도 `creator`를 `ProjectedCreator`로, `workflow`(미로드 관계)를 타입에서 제외해 타입-런타임 간극을 좁혔다 — 이는 축소 방향의 시그니처 변경이라 기존 소비자가 더 넓은 필드에 의존하고 있었다면(그런 코드는 발견되지 않음) 컴파일 타임에 드러난다.
  - 제안: 조치 불요. 다만 프런트엔드 `codebase/frontend/src/lib/api/workflows.ts`의 동명 `WorkflowVersionDetail` 타입은 이 PR이 손대지 않은 손-미러(같은 이름, 다른 선언)이므로, 백엔드 wire 를 3필드로 좁힌 이번 변경이 프런트 타입엔 반영되지 않은 채 남아 있다 — 이미 코드 주석·plan에 명시돼 후속 추적 중이라 여기서는 재-flag 하지 않는다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 Swagger 공개 스키마를 넓히는 **추가적(additive)** 변경 — 기존 소비자에게 파괴적이지 않음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto` 클래스, `joinedAt: string | null` 필드)
  - 상세: `WorkspacesService.listMembers`(변경되지 않음, 기존 코드가 이미 `joinedAt: m.joinedAt`을 반환)가 실제로 이미 내보내던 필드에 뒤늦게 DTO 선언·OpenAPI 문서를 맞춘 것 — 런타임 응답 바디는 이 diff로 바뀌지 않는다(신규 필드가 wire 에 새로 나타나는 것이 아니라, 이미 나가던 값에 스키마 선언이 따라붙는 것). 서비스 로직 자체는 diff 대상이 아님을 `git diff --stat`로 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/hooks/_lib/review_guard.py`의 `_parse_frontmatter_code` 블록-리스트 파싱 변경은 push-게이트(`--impl-done` SPEC-CONSISTENCY)가 "무는 파일 집합"을 넓히는 **의도된 행동 변화** — 전역 공유 함수의 판정 결과가 바뀌므로 side-effect 관점에서 언급
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code()` 내부 block-list 루프(주석/빈 줄에서 `break` 하던 것을 `continue`로, 트레일링 `# comment`/따옴표 스칼라 트레일링 주석을 잘라내는 `_strip_comment` 신설)
  - 상세: 이 함수는 spec 문서 `code:` frontmatter를 파싱해 "이 코드 파일이 spec-linked 인가"를 판정하는 데 쓰이며, 그 결과가 push 차단 게이트(SPEC-CONSISTENCY)의 판정 집합에 직접 영향을 준다. 이번 변경으로 이전엔 "YAML 주석/빈 줄 뒤 항목이 조용히 유실"되던 7개 spec 파일·41개 entry가 새로 spec-linked 판정에 편입된다(커밋 메시지·테스트 docstring의 실측치). 이는 저장소 전역 harness 동작을 바꾸는 것이므로, 이 PR 이후 최초로 그 spec 파일들이 걸린 코드를 건드리는 세션은 이전에 안 걸리던 게이트에 새로 걸릴 수 있다 — 기능적으로는 "숨은 결함 복구"이자 문서화된 의도이며, 새 단위 테스트(`test_review_guard.py`)가 양방향(주석/빈 줄 스킵 vs 다음 키에서는 여전히 정지)을 모두 문다. 부작용이라기보다 의도된 동작 변경이지만, "게이트가 갑자기 더 깐깐해진다"는 관측 가능한 행동 변화이므로 기록한다.
  - 제안: 조치 불요 — 이미 실측·테스트·문서화가 갖춰져 있다.

- **[INFO]** 신규 가드 3종(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`) 및 부속 spec/fixture 는 전부 파일시스템 읽기 전용 정적 분석/문자열 스캔이며, 새 전역 변수·환경 변수 읽기·네트워크 호출이 없음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `.../dto-jsdoc-citation-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` 및 각 `.spec.ts`/fixture 전체
  - 상세: `grep -n "writeFile\|process.env\|execSync\|fetch(\|http\.\|https\.\|child_process"` 를 이 6개 파일에 대해 실행해 0건을 확인했다. `SRC_ROOT`/`FORBIDDEN` 등 모듈 최상위 `const`는 모두 불변(`Object.freeze` 또는 재할당 없는 `const`)이며 테스트 간 공유 뮤터블 상태가 아니다.
  - 제안: 조치 불요(양성 확인 기록).

## 요약

이번 diff(원격 대비 22개 실질 코드/harness 파일)에서 우려할 만한 부작용은 발견되지 않았다. `TriggersService`의 `save().catch()` 추가는 특정 UNIQUE 위반만 좁혀 변환하고 나머지는 원본 그대로 재던지는 안전한 설계이며, `WorkflowVersionsService.findOne`의 반환 타입 축소는 유일 호출자에 컴파일 영향이 없고 오히려 민감 컬럼 노출을 줄이는 방향이다. `WorkspaceMemberDto.joinedAt` 추가는 이미 나가던 값에 뒤늦게 스키마를 붙인 추가적 변경이다. 신규 검출 가드 3종은 전부 읽기 전용 정적 분석으로 파일시스템 쓰기·환경 변수·네트워크 호출이 전혀 없다. 유일하게 "행동이 바뀐다"고 부를 만한 것은 `review_guard.py`의 frontmatter 파서 수정인데, 이는 harness 의 spec-link 판정 범위를 의도적으로 넓히는 문서화된 수정이며 양방향 테스트로 보강돼 있다. 전반적으로 위험도는 낮다.

## 위험도

LOW
