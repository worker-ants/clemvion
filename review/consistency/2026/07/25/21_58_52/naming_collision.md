# 신규 식별자 충돌 검토 — naming_collision

## 전제 확인 (impl-done, scope=`spec/conventions/`, diff-base=`origin/main`)

`git -C <워킹트리> diff origin/main..HEAD --stat` 로 실측한 결과, 본 PR(`node-cancel-signal-b4d1`,
브랜치 `claude/node-cancel-signal-b4d1`, origin/main 대비 9 커밋)이 실제로 건드린 파일은:

- `codebase/backend/src/nodes/integration/{cafe24,makeshop}/*.client.ts` (+`*.spec.ts`)
- `codebase/backend/src/nodes/integration/{cafe24,makeshop}/*.handler.ts` (+`*.spec.ts`)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` (체크리스트 갱신)
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (신규 plan 문서)
- `review/code/2026/07/25/{21_02_33,21_35_11}/RESOLUTION.md`

**`spec/conventions/` 하위 파일은 이 diff 에서 단 1건도 변경되지 않았다**
(`git diff origin/main..HEAD -- spec/conventions/` 출력 0줄, `node-cancellation.md` 포함).
즉 프롬프트가 명시한 검토 scope(`spec/conventions/`)에는 신규·변경 식별자가 없다 — target 문서가
스스로 도입하는 새 spec-level 식별자(요구사항 ID·엔티티명·endpoint·이벤트명·env var·파일 경로)는
이번 변경분에 없다.

아래는 그럼에도 관점별로 실제 diff(코드 + 신규 plan 문서)에 있는 새 식별자를 확인한 결과다.

## 발견사항

- **[INFO]** 신규 필드 `signal`은 기존 spec §4 패턴의 적용이며 신규 식별자 아님
  - target 신규 식별자: `Cafe24CallOptions.signal?: AbortSignal`, `MakeshopCallOptions.signal?: AbortSignal`
    (`codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`,
    `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts`)
  - 기존 사용처: `spec/conventions/node-cancellation.md` §4 (fetch cascade 패턴, 필드명 `signal` 그대로
    예시 코드에 이미 정의돼 있음, 이번 diff 로 변경되지 않은 기존 문서) · §6 표에 "MakeShop/Cafe24 노드
    signal 전파 — 미구현(Planned)" 으로 이미 카탈로그화돼 있던 항목의 구현
  - 상세: 두 인터페이스에 `signal` 필드가 이번에 처음 추가되지만, 이는 §4 가 이미 문서화한
    "`context.abortSignal` → 자체 timeout controller cascade" 패턴을 그대로 적용한 것이다.
    `spec/conventions/cafe24-api-catalog/**`, `makeshop-api-catalog/**`, `execution-context.md` 어디에도
    `signal` 이라는 이름이 다른 의미로 쓰이는 곳이 없음을 grep 으로 확인했다(0건). 즉 다른 의미로
    이미 쓰이던 이름과 충돌하는 사례가 아니라, 기존 계약의 자연스러운 확장이다.
  - 제안: 없음 (충돌 아님, 정보성 기록).

- **[INFO]** 신규 plan 파일명은 기존 명명 컨벤션과 정확히 부합, 경로 충돌 없음
  - target 신규 식별자: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  - 기존 사용처: 없음(신규 파일). 단 동일 접두사 컨벤션 `spec-update-*.md` 가 `plan/in-progress/`
    (`spec-update-webchat-evidence-pointers.md` 등) 와 `plan/complete/`(`spec-update-c-sync-promotions.md`
    외 다수)에 이미 정착돼 있어, 이번 신규 파일은 그 컨벤션을 그대로 따른다.
  - 상세: `find plan -name "spec-update-node-cancellation-shutdown-classification.md"` 결과 1건뿐이라
    기존 파일과의 이름 충돌 없음. frontmatter 에 `id:` 필드가 없어(동류 plan 문서들과 동일 패턴)
    요구사항 ID 충돌 표면도 없다.
  - 제안: 없음.

## 요약

본 PR 의 실제 diff(`origin/main..HEAD`)는 `spec/conventions/` 하위 어떤 파일도 변경하지 않았다 —
프롬프트가 지정한 검토 scope 안에 신규 식별자 자체가 존재하지 않는다. diff 에 실재하는 유일한
"새 식별자"는 `Cafe24CallOptions`/`MakeshopCallOptions` 에 추가된 `signal?: AbortSignal` 필드인데,
이는 `spec/conventions/node-cancellation.md` §4 가 이미 예시 코드로 정의해 둔 cascade 패턴을
그대로 구현한 것이며, 동일 이름이 카탈로그(`cafe24-api-catalog/**`, `makeshop-api-catalog/**`,
`execution-context.md`) 어디에서도 다른 의미로 쓰이지 않음을 확인했다. 신규 생성된
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 도 기존 `spec-update-*`
명명 컨벤션을 그대로 따르며 경로·이름 충돌이 없다. 요구사항 ID·엔티티/타입명·API endpoint·
이벤트/메시지명·환경변수 관점 모두 이번 변경분에서 신규 도입 사례 자체가 없어 검토 대상이 없었다.

## 위험도

NONE
