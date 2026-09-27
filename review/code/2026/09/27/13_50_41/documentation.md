# 문서화(Documentation) 리뷰 — patch-omit-undefined

## 발견사항

- **[INFO]** `omit-undefined.ts` JSDoc — 신규 두 증상(응답 오염 · JSONB 저장값 소실) 서술이 정확하고 실제 사용처와 일치
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:4`~`16`
  - 상세: JSDoc 이 "컬럼에 병합하면 응답이 틀린다"(트리거·폴더 선례) / "JSONB 값 안으로 펼치면 DB 에서 지워진다"(워크플로 `settings`) 둘로 명확히 분리해 적었고, 둘 다 이번 diff 의 실제 호출부(`workflows.service.ts` `omitUndefined(rest)` · `omitUndefined(settings)`, `nodes.service.ts`, `auth-configs.service.ts`)와 정확히 대응한다. `NotArray<T>` 타입에도 한 줄 독스트링이 있고 왜 배열을 막는지(구현이 배열을 인덱스 키 객체로 무너뜨림) 근거를 적었다 — 헬퍼 함수 JSDoc 모범 사례.
  - 제안: 없음 (양성 확인).

- **[INFO]** 서비스 세 곳(`workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts`)의 신규 인라인 주석이 "무엇을·왜·어떤 테스트가 고정하는지" 를 모두 담아 정확
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `update()` (`Object.assign(workflow, omitUndefined(rest))` 앞 주석 및 `settings` 병합 앞 주석), `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` (`Object.assign(node, omitUndefined(dto))` 및 `workflow` 제거 앞 주석), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `update()` (`Object.assign(config, omitUndefined(rest))` 앞 주석)
  - 상세: 세 주석 모두 "이유는 `omitUndefined` JSDoc" 으로 위임하고 자리 고유 증상(구체적으로 어떤 필드가 null/키 부재가 됐는지)과 `test/patch-partial-body.e2e-spec.ts` 를 인용한다. `Read` 로 실제 파일을 열어 대조한 결과 인용된 파일명·증상이 실제 e2e 케이스(A/C/D) 및 CHANGELOG 서술과 모두 일치했다. `nodes.service.ts` 의 `workflow` 제거 주석("`NodeDto` 가 선언하지 않는데 부모 워크플로 행이 통째로 실렸다")도 컨트롤러의 `@ApiOkWrappedResponse(NodeDto, …)` 선언과 대조해 정확함을 확인했다(`nodes.controller.ts:128`).
  - 제안: 없음 (양성 확인).

- **[INFO]** `folders.service.spec.ts` 주석 정정 — 오래된 e2e 케이스 문자 인용을 파일명으로 교체, 실물 대조 완료
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:116`
  - 상세: `"폴더 e2e C · E 가…"` → `` "`test/folder-crud.e2e-spec.ts` 가…" `` 로 변경. `codebase/backend/test/folder-crud.e2e-spec.ts` 를 직접 열어 `sortOrder`/`parentId` 케이스(E)가 실제로 그 파일에 있음을 확인했다 — 정확한 정정이며 plan 이 예고한 손질(항목 8) 그대로 이행됐다.
  - 제안: 없음 (양성 확인).

- **[INFO]** 신규 e2e 파일(`patch-partial-body.e2e-spec.ts`) 상단 JSDoc — 결함 원인·단언 순서 근거를 모두 명시
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts:15`~`25`
  - 상세: 파일 상단 docblock 이 (1) 결함 원인(`useDefineForClassFields`), (2) 증상 두 형태, (3) 단언 순서(저장값→응답 값→응답 계약)가 판정에 필요한 이유(§5.4 optional+nullable 필드는 계약 대조만으로 거짓 null/키 부재를 못 잡음)까지 설명한다. `pick()` 헬퍼에도 "키가 없으면 `undefined` 로 남아 `toStrictEqual` 이 차이를 보인다" 는 한 줄 독스트링이 있어 왜 이 헬퍼가 필요한지 드러난다. naming_collision 컨시스턴시 체커가 지적한 "형제 명명 컨벤션 이탈(결함 클래스 축 파일명)" 에 대한 근거도 이 JSDoc 이 이미 담고 있어 별도 조치 불요.
  - 제안: 없음 (양성 확인).

- **[INFO]** CHANGELOG 신규 항목 — 형식·인접 항목(폴더 PR)과의 스타일 일치, 기준 충족
  - 위치: `CHANGELOG.md:26`~`41` (`## Unreleased — 워크플로 · 노드 · 인증 설정 수정이 보내지 않은 필드를 잃지 않는다`)
  - 상세: `CHANGELOG.md` 상단 기준(제품 동작·API 응답 계약 변화 → 항목화)에 정확히 해당하는 변경(PATCH 응답 필드 오염 + 워크플로 `settings` DB 값 소실)이고, 바로 아래 있는 선행 폴더 PR 항목과 문체·구조(증상 나열 → 소비처 영향 → 고친 결과 → 부가 스키마 변경)가 동일해 일관성이 높다. `PATCH /nodes/:id` 응답에서 `workflow` 키를 더 이상 싣지 않는다는 사실도 별도 문단으로 명시했다. `Read` 로 실제 파일을 열어 대조한 결과 diff 그대로 반영돼 있다.
  - 제안: 없음 (양성 확인).

- **[INFO]** plan 트래커(`spec-draft-nullable-notation-followups.md`) 동기화 — 헬퍼 호출부 확장(2→5곳)이 이미 이 PR 안에서 반영됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6) 보강 문단, 항목 «`Object.assign(엔티티, DTO)`…» 완료 표시(체크박스 `[x]`)
  - 상세: 같은 세션의 `--impl-prep` consistency check(WARNING #4, plan_coherence)가 지적한 "헬퍼 호출부가 2곳에서 5곳으로 늘었는데 트래커 미반영" 문제가 이 diff 안에서 이미 해소돼 있다(항목 (6)에 확장분 추가, 완료 항목에 `plan/complete/patch-omit-undefined.md` 참조 및 실측 요약 추가). 문서-코드 정합 관점에서 후속 조치 불요.
  - 제안: 없음 (양성 확인, 중복 지적 방지 목적으로만 기록).

- **[INFO]** API 문서(OpenAPI) 갱신 불필요성 확인 — `NodeDto` 는 애초에 `workflow` 를 선언하지 않았음
  - 위치: `codebase/backend/src/modules/nodes/nodes.controller.ts:128` (`@ApiOkWrappedResponse(NodeDto, …)`), `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` 반환 타입 `Promise<Omit<Node, 'workflow'>>`
  - 상세: 이번 fix 는 실제 응답을 기존에 이미 선언돼 있던 `NodeDto` 스키마에 맞추는 방향이라, OpenAPI 스키마 자체를 고칠 필요가 없다(선언이 넓어지거나 좁아지지 않았다 — 실제 응답이 선언을 따라잡았다). 반환 타입 변경(`Omit<Node, 'workflow'>`)도 실제 구현(`workflow` 구조분해 제거)과 정확히 일치한다.
  - 제안: 없음 (양성 확인).

- **[INFO]** spec 본문 갱신(§5.4 tri-state 문서화 불균일) — 이번 code-only PR 의 범위 밖이며 이미 planner 인계 완료
  - 위치: `spec/2-navigation/1-workflow-list.md` §3.2, `spec/2-navigation/6-config.md` — PATCH "키 생략=값 불변" tri-state 계약이 `2-trigger-list.md` 에만 명시
  - 상세: 문서화 관점에서는 이 PR 이 고치는 동작(빈 `settings`/일부 필드만 보낸 PATCH 가 기존 값을 보존)이 정확히 이 tri-state 계약인데, 그 계약이 워크플로·인증설정 spec 본문에는 아직 문장으로 없다. 다만 이는 이미 같은 세션의 cross_spec consistency check(WARNING #2)가 잡아 `spec-draft-nullable-notation-followups.md` 에 planner 항목으로 인계됐고(`spec_impact: none` 인 code-only PR 이 spec 을 직접 못 고치는 것은 프로젝트 권한 구조상 정상), 코드 커밋 자체는 이 문서 격차와 무관하게 진행 가능하다는 점도 그 항목에 적혀 있다. 새로 지적할 필요 없이 기존 인계가 유효함만 확인.
  - 제안: 없음 (planner 턴 대기 중, 이미 추적됨).

## 요약

이번 diff 는 문서화 품질이 전반적으로 높다 — 핵심 헬퍼(`omitUndefined`)의 JSDoc 이 새 실패 형태(JSONB 저장값 소실)를 정확히 반영하도록 갱신됐고, 세 서비스의 신규 인라인 주석은 "무엇이·왜·어느 테스트가 고정하는지" 를 모두 담아 실물 코드·테스트와 대조해도 어긋남이 없었다. `folders.service.spec.ts` 의 낡은 e2e 케이스 문자 인용도 파일명으로 정확히 정정됐고, 신규 e2e 파일의 상단 JSDoc 은 결함 원인과 단언 순서의 근거까지 설명해 다음 사람이 "왜 값까지 단언하는가" 를 다시 묻지 않게 한다. CHANGELOG 항목은 프로젝트 기준과 인접 항목 스타일에 정확히 부합하며 실제 diff 와 대조해도 누락이 없다. 코드 변경이 OpenAPI 선언을 벗어나지 않아(`NodeDto` 가 애초에 `workflow` 를 선언하지 않음) API 문서 갱신도 불필요하다. 유일하게 남는 문서 격차(PATCH tri-state 계약이 워크플로·인증설정 spec 본문에 미기재)는 이 PR 의 범위(code-only, `spec_impact: none`) 밖이며 이미 같은 세션의 consistency check 가 planner 인계 항목으로 트래커에 기록해 두었으므로 중복 지적하지 않는다. CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
