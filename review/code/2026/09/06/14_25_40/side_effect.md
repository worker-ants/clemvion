# 부작용(Side Effect) 리뷰

## 검토 방법 메모

리뷰 대상 diff(`origin/main...HEAD`)는 198개 변경 파일 중 대다수(`review/**`, `plan/**`)가
이전 리뷰·컨시스턴시 라운드의 산출물(마크다운 보고서·`meta.json`·`_retry_state.json`)이라
부작용 관점의 실질 코드가 아니다. 실제 런타임/도구 코드 변경은 다음 22개 파일로 좁혀
`git diff origin/main...HEAD --stat -- codebase/ .claude/`로 직접 확인 후 하나씩 열어
검토했다: `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py`,
`workflow-versions.service.ts`(+`.spec.ts`), `workspace-response.dto.ts`,
`dto-jsdoc-citation-guard.ts`(+`.spec.ts`+fixture), `user-entity-exposure-guard.ts`
(+`.spec.ts`+2 fixtures), `user-secret-absence.ts`(+`.spec.ts`), 3개 e2e 스펙,
`CHANGELOG.md`, `plan/in-progress/*.md`.

## 발견사항

- **[INFO]** `_parse_frontmatter_code` 의 동작 변경이 **이 PR 자신의 파일 범위를 넘어
  저장소 전체의 spec 파싱 결과에** 영향을 준다
  - 위치: `.claude/hooks/_lib/review_guard.py:637`~`658` (`_parse_frontmatter_code` 블록
    리스트 파싱 루프)
  - 상세: 이 함수는 `_spec_code_patterns()`(`review_guard.py:663`)를 통해 `spec/**/*.md`
    **전체**를 순회하며 호출된다 — 이번 diff 가 고치는 것은 이 PR 이 새로 추가한 spec
    파일이 아니라, YAML 블록 리스트 중간에 빈 줄·`#` 주석이 낀 **기존** 7개 spec 파일의
    파싱 결과다. 코드 자체는 순수 함수(파일 읽기만, 전역 상태 없음)이고 변경 의도·근거는
    주석과 신규 테스트 3건(`.claude/tests/test_review_guard.py:329`~`374`)에 명시돼 있어
    버그가 아니라 의도된 수정이지만, **부작용 관점에서 주목할 점은 "블라스트 반경"이다**:
    이 함수가 되돌리는 glob 집합이 넓어지면서, 이 PR 이 건드리지 않은 다른 7개 spec 문서
    아래의 `code:` 등재 파일들이 이제부터 "spec-linked" 로 판정되어, **이후 그 파일들을
    건드리는 무관한 미래 PR 들의 `--impl-done`/consistency 게이트 동작이 이 커밋을 기점으로
    바뀐다**. 실측(주석 인용): spec 387개 중 7개 파일에서 41개 entry 가 이 커밋으로 새로
    포착된다. 되돌리는 방향(게이트가 더 엄격해짐)이라 보안적으로는 개선이고, 회귀
    테스트(주석 뒤 항목 보존/빈 줄 보존/다음 키에서는 여전히 정지)도 갖춰져 있어 위험도는
    낮다고 판단하지만, "이 PR 의 diff 범위 밖 파일들의 게이트 판정이 이 PR 하나로 조용히
    바뀐다"는 사실 자체는 side effect 로 기록해 둔다.
  - 제안: 조치 불요(의도된 수정, 테스트 완비). 다만 이후 라운드에서 "이 PR 과 무관한 spec
    파일이 갑자기 spec-linked 로 걸린다"는 보고가 나오면 이 커밋을 원인으로 먼저 의심할 것.

- **[INFO]** `WorkflowVersionsService.findOne` 의 반환 타입 시그니처 변경 — 호출자 영향 없음을 직접 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`findOne` 메서드 선언부, `Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>`로
    변경 + `relations: ['creator']` → `relations: { creator: true }` + 명시적 `select` 추가)
  - 상세: 공개 서비스 메서드의 반환 타입이 좁아졌다. 유일한 호출자
    `WorkflowVersionsController.findOne`(`workflow-versions.controller.ts:81`)이 값을
    가공 없이 그대로 반환하는 것을 확인했고, 저장소 전체에서 `.creator.<id|name|email
    이외의 필드>`나 `WorkflowVersion(.Detail)?.workflow` 를 참조하는 코드가 0건임을
    `grep` 으로 확인했다(주석이 언급하는 것 외 실사용 없음). `WorkflowVersion.workflow`
    관계는 애초에 `eager` 가 아니고 종전 코드도 `relations` 에 넣지 않았으므로 런타임에는
    이전부터 항상 `undefined` 였다 — 타입만 좁아졌을 뿐 실제로 값이 사라지는 필드는 없다.
    프런트엔드의 손-미러 타입(`codebase/frontend/src/lib/api/workflows.ts` 의 동명
    `WorkflowVersionDetail`)은 `creator` 를 옵셔널 상위집합으로 선언하고 있어 백엔드가
    3필드를 항상 채우는 이번 변경과 호환된다(주석에도 이 사실이 명시돼 있다). 결론적으로
    시그니처는 바뀌었으나 실질적인 호출자 영향은 없음을 확인했다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `WorkspaceMemberDto` 에 필수 필드 `joinedAt` 추가 — 실제로는 계약을 실측에
  맞춘 것이라 wire 동작 변화 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto` 클래스, `joinedAt: string | null` 필드)
  - 상세: DTO 에 새 필드가 추가되면 일반적으로 "인터페이스 확장"의 부작용을 의심해야
    하지만, 이 필드는 이미 `WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 으로
    무조건 실어 보내고 있던 값이다(서비스 코드로 직접 확인) — 즉 wire 상의 실제 응답
    바이트는 이 diff 전후로 동일하고, DTO 선언이 실제 응답을 뒤늦게 따라잡은 것뿐이다.
    class-transformer 의 `excludeExtraneousValues` 계열 직렬화가 이 경로에 걸려 있지
    않음(전역 `ClassSerializerInterceptor` 0건, 이 컨트롤러도 수동 매핑 객체를 그대로
    반환)도 확인했으므로, 데코레이터 누락으로 필드가 조용히 잘려나가는 side effect 도
    없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 가드/헬퍼 파일들은 전부 read-only 스캔이며 예상 밖 파일시스템·네트워크·
  환경변수 부작용이 없음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 상세: 세 파일 모두 `fs.readFileSync` 로 소스를 읽어 AST 를 순회하는 순수 함수만
    export 한다(파일 쓰기·삭제·프로세스 실행·네트워크 호출·`process.env` 접근 0건 —
    `grep -rn "process\.env|writeFile|execSync|spawn|http\.|https\.|fetch\(|axios"` 로
    전수 확인). 신규 e2e 스펙 3개가 참조하는 `process.env.E2E_BASE_URL` 은 이 diff 가
    아니라 종전부터 있던 파일 상단 상수(`const BASE_URL = ...`)로, 이번 변경이 새로
    도입한 환경변수 읽기가 아님을 diff 로 확인했다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 실질 코드 변경은 `User` 엔티티 전체 노출을 검출하는 신규 가드 2~3종(구조 축
`user-entity-exposure-guard`, 값 축 `user-secret-absence`, JSDoc 인용 축
`dto-jsdoc-citation-guard`)과 `WorkflowVersionsService.findOne` 의 실유출 수정,
`WorkspaceMemberDto.joinedAt` 선언 보정, 그리고 `review_guard.py` 의 YAML 블록 리스트
파싱 버그 수정으로 구성된다. 신규 가드 코드는 모두 파일 읽기만 하는 순수 스캔 로직이라
예상 밖의 전역 상태 변경·파일 쓰기·네트워크 호출·환경변수 조작이 없고, 유일한 공개
시그니처 변경(`findOne` 반환 타입)은 저장소 전체를 뒤져 호출자 영향이 없음을 직접
확인했다. 가장 눈여겨볼 부분은 `review_guard.py` 의 파서 수정으로, 이 PR 이 건드리지
않은 다른 7개 spec 문서의 `code:` 판정 결과를 넓혀 향후 무관한 PR 들의 게이트 동작에
영향을 준다는 점이다 — 의도되고 테스트된 수정이라 위험도는 낮지만 "diff 범위 밖에
영향이 번지는 공유 함수 변경"이라는 side effect 의 성격은 명확하므로 INFO 로 기록한다.
Critical·Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
