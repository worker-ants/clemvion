# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공유 hook 라이브러리 파서 수정 — 이 PR 파일 범위를 넘어 저장소 전역 게이트 판정에 즉시 영향
  - 위치: `.claude/hooks/_lib/review_guard.py:600`(`_parse_frontmatter_code` 정의), `:709`(유일 호출부, `dirpath` 순회 중 모든 `spec/**/*.md` 에 적용)
  - 상세: `_parse_frontmatter_code` 는 YAML block-list 를 파싱할 때 빈 줄·`#` 주석을 만나면 `break` 하던 것을 `continue`(skip)로 바꾸고, 트레일링 주석 스트립·인용 스칼라 처리를 추가했다. 이 함수는 review_guard 안에서 호출부가 단 하나(`:709`)이고, 그 호출부는 `spec/` 트리 전체를 순회하며 모든 spec 파일의 `code:` frontmatter 를 다시 파싱한다. 즉 이 변경은 이번 PR 이 건드린 파일에 국한되지 않고, **저장소의 387개 spec 파일 전부**에 대해 다음 번 hook 실행(리뷰/커밋/push 게이트) 시점부터 즉시 적용된다 — PR 설명대로 기존에 7개 spec 파일에서 41개 entry 가 조용히 유실되고 있었다면, 그 41개가 이 커밋 하나로 즉시 "spec-linked" 판정에 편입된다. 동작 자체는 의도된 버그 수정이고 양방향 대조군(주석/빈 줄 skip vs 다음 키에서는 여전히 멈춤, 인용 부호 안 `#` 은 값으로 유지 등)까지 테스트로 걸려 있어 결함으로 보지는 않으나, "이 커밋의 diff 파일만 영향받는다"고 오독하면 다른 in-flight 작업이 갑자기 새로 게이트에 걸리는 것을 이 커밋 탓이 아닌 것으로 오판할 수 있다.
  - 제안: 조치 불요(의도된 수정, 테스트 충분). 다만 이 커밋 이후 다른 브랜치의 `--impl-done`/push 게이트가 갑자기 더 엄격해지는 사례가 보고되면 이 커밋을 원인으로 우선 검토할 것.

- **[INFO]** `TriggersService.create`/`update` — `save()` 실패 경로에 새 `.catch()` 삽입, 다른 오류는 그대로 재던짐(검증됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:426`, `:512`(두 호출부), `:1607`(`rethrowEndpointPathConflict` 정의)
  - 상세: `this.triggerRepository.save(trigger)` 뒤에 `.catch((err) => this.rethrowEndpointPathConflict(err))` 가 새로 붙었다. `(workspace_id, endpoint_path)` UNIQUE 위반(인덱스명 `idx_trigger_workspace_endpoint`)일 때만 `ConflictException({code:'RESOURCE_CONFLICT', details:{field,code}})` 로 형태를 바꿔 재던지고, 그 외 모든 오류(다른 UNIQUE 위반 포함)는 `throw err`로 원본 그대로 흘려보낸다. `triggers.service.spec.ts` 에 반대 방향 대조군("다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다", "unique 위반이 아닌 오류도 그대로 흘려보낸다")이 각 표면(`driverError`/`top`)·각 메서드(`create`/`update`)로 걸려 있어 실제로 그렇게 동작함을 확인했다. HTTP 상태 코드(409)는 종전에도 전역 예외 필터가 발행하던 것과 동일하고 이번 변경은 `details` 를 추가하는 것뿐이라 기존 클라이언트를 깨뜨리지 않는다. 감사 로그 기록은 `save()` 성공 이후에만 실행되므로(주석상 "커밋 직후 기록") 이 `.catch()` 는 감사 로그 기록 시점/조건에 영향을 주지 않는다.
  - 제안: 조치 불요. 의도된 동작이며 파악한 범위 내에서 부작용 없음.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드 — 이미 실려 있던 값을 뒤늦게 선언(런타임 행위 변경 없음)
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:93`
  - 상세: `WorkspacesService.listMembers`(`codebase/backend/src/modules/workspaces/workspaces.service.ts:223`)는 이번 PR 에서 변경되지 않았고 이전부터 `joinedAt: m.joinedAt` 를 응답 객체에 싣고 있었다 — 이번 diff 는 그 값을 DTO 클래스에 `@ApiProperty` 로 뒤늦게 선언한 것뿐이다. OpenAPI 스키마에는 필드가 추가되므로(공개 인터페이스 변경) 문서 생성 결과물은 바뀌지만, 실제 wire 응답 바이트는 이 PR 로 인해 달라지지 않는다(값은 이미 나가고 있었음).
  - 제안: 조치 불요 — additive 문서화이며 기존 소비자에 대한 파괴적 변경 아님.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입 변경 — 유일한 프로덕션 호출부는 영향 없음(확인됨)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:141`(시그니처: `Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>`)
  - 상세: `WorkflowVersionDetail` 은 `WorkflowVersion` 에서 `creator`(3필드로 좁힘)와 `workflow`(로드 안 함, 타입에서 제외)를 뺀 구조다. 프로덕션 호출부를 전수 확인한 결과 `codebase/backend/src/modules/workflows/workflows.service.ts:666`(`restoreVersion`) 한 곳뿐이며, 이 호출부는 반환값의 `.snapshot`·`.version` 만 사용한다 — 둘 다 `WorkflowVersionDetail` 에 그대로 남아 있어 컴파일·런타임 모두 영향 없음. 컨트롤러(`workflow-versions.controller.ts:81`)는 반환값을 타입 주석 없이 그대로 넘기므로 역시 영향 없음. 실제 프로덕션 동작 변화는 `select` 투영 추가로 `creator` 관계에서 `User` 전 컬럼 대신 3컬럼만 로드하는 것(의도된 보안 수정)이며, 이는 이번 리뷰의 대상인 side-effect 관점에서는 "덜 노출"하는 방향이라 위험이 아니라 개선이다.
  - 제안: 조치 불요.

- **[INFO]** 필드시스템/환경변수/네트워크 부작용 전수 grep — 이번 diff(코드베이스·`.claude/`) 전체에서 0건
  - 위치: 해당 없음(diff 전체 대상 `grep -n "writeFileSync|fs\.write|fs\.appendFile|fs\.mkdir|fs\.unlink|process\.env|subprocess|exec(|fetch(|axios|http\.request|child_process"` 실행 결과 실질적 매치 0건 — 유일한 히트는 `dto-jsdoc-citation-guard.ts` 의 정규식 `re.exec(text)` 로 오탐)
  - 상세: 신설된 repo-guard 류(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts` 등)와 테스트 픽스처(`pg-error-fixtures.ts`, `user-secret-absence.ts`)는 전부 `fs.readFileSync` 를 통한 **읽기 전용** 소스 스캔이며 저장소에 파일을 쓰거나 지우는 코드는 없다. `.claude/tests/test_review_guard.py` 의 신규 테스트는 `tempfile.mkdtemp()`(저장소 밖 시스템 임시 디렉터리, 기존 파일 내 다른 테스트들과 동일한 기존 헬퍼 `_spec()` 재사용)만 쓴다. e2e 테스트 3건(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`, `workflow-crud.e2e-spec.ts`)의 HTTP 호출은 로컬 테스트 인프라(BASE_URL)를 향한 것으로 e2e 계층에서 통상 기대되는 부작용이며 의도치 않은 외부 서비스 호출이 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `User` 엔티티 민감 컬럼 노출 방어(구조 축 + 이름 축 가드, e2e 배선), `WorkflowVersionsService.findOne` 의 실제 `User` 전체 유출 수정, `TriggersService` 의 `endpoint_path` UNIQUE 충돌을 문서화된 계약 형태(409 + `details`)로 되던지는 기능, `review_guard.py` 의 YAML frontmatter 파서 버그 수정으로 구성된다. 신설 코드(가드·fixture·테스트 유틸)는 전부 읽기 전용 정적 분석이거나 순수 함수라 파일시스템·환경변수·네트워크 부작용이 없음을 grep 과 코드 직접 열람으로 확인했다. 시그니처가 바뀐 유일한 프로덕션 함수(`WorkflowVersionsService.findOne`)는 유일한 호출부가 영향받지 않음을 확인했고, `TriggersService.save()` 의 새 `.catch()` 는 대상 외 오류를 원본 그대로 통과시키는 것을 테스트가 양방향으로 보증한다. 유일하게 "블라스트 반경"이 이번 PR 파일 목록을 넘어서는 것은 `.claude/hooks/_lib/review_guard.py` 의 파서 수정인데, 이는 공유 hook 라이브러리라 저장소 전역 spec-linked 게이트 판정에 즉시 적용되며 — 의도된 버그 수정이고 테스트가 충분하지만, 이후 다른 브랜치에서 게이트가 갑자기 더 엄격해지는 현상을 이 커밋과 연결지어 해석할 필요가 있다는 점만 기록해 둔다. 전반적으로 실질적 위험이 되는 부작용은 발견되지 않았다.

## 위험도

LOW
