# 정식 규약 준수 검토 — `spec/5-system/**` (impl-done, diff-base `origin/main`)

## 검토 범위 요약

이번 PR(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3곳)이 건드린
target(`spec/5-system/**`) 및 연동 코드를 `spec/conventions/**` 대비로 점검했다. 확인한 규약
문서: `swagger.md`(전문 포함) · `secret-store.md`(전문 포함) · `frontend-layering.md` ·
`spec-impl-evidence.md` · `i18n-userguide.md` · `data-hydration-surfaces.md` (뒤 넷은 프롬프트
번들에서 예산 초과로 생략돼 워크트리에서 직접 `Read`). 코드 근거는 모두
`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard` 워킹트리를
절대경로로 확인했다 (`git diff origin/main...HEAD` + 파일 직접 열람).

## 발견사항

- **[INFO]** DTO JSDoc 이 swagger.md §3 의 "1~2문장 요약" 권고보다 길다 — 그러나 규약이 이미 이 형태를 추인함
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData` JSDoc, diff 라인 49-63)
  - 관련 규약: `spec/conventions/swagger.md` §3 "예외 — 보안·정책 캐비엇"
  - 상세: swagger.md §3 는 "값이 저장된 값과 다를 수 있는 필드는 길이 제한의 예외이나, 상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크로 적는다" 고 규정한다. `inputData` JSDoc 은 카브아웃 폐지 이력(2026-08-20 이전/이후 비교, 세 소비처 요약)까지 담아 요약 수준을 넘는다. 다만 같은 파일의 형제 필드(`outputData`, `error`)도 동일하게 다문단 형태이고, swagger.md §3 자체가 "실측상 9곳 이상의 DTO 가 이 형태를 쓰고 있었다 … 규약이 현실을 반영하도록 고친다" 며 이 관행을 정식으로 추인한 상태라 — 신규 위반이 아니라 기존 정착 스타일의 연장이다.
  - 제안: 조치 불필요. 규약 문구("1~2문장")와 실제 관행(다문단 이력) 사이의 표현 차이는 규약 쪽을 현실에 맞게 다듬는 편이 정합적이나, 이는 이번 PR 의 책임 범위가 아니다.

## 준수 확인 항목 (위반 없음 — 근거 요약)

- **명명 규약**: 프런트 `masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 는 backend `sanitize-error-message.ts` 의 동명 상수·함수와 **의도적으로 이름을 맞춘 미러**다(주석이 근거를 명시). i18n dict 키(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)는 기존 `history.rerun.*`/`editor.*` 네임스페이스 패턴을 그대로 따른다.
- **출력 포맷 규약(Swagger/DTO)**: `ExecutionDto.inputData`/`BackgroundRunNodeExecutionDto` 의 `@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })` 는 실제로 키 집합이 트리거별로 열려 있는 필드라 swagger.md §1-4 "진짜 열린 map" 케이스에 정확히 부합한다(닫힌 union 을 뭉갠 사례 아님). `MASKED_INPUT_DATA_REASON` JSDoc 앵커 삭제 후 코드베이스 전체(grep)에 잔존 참조 없음 — 죽은 앵커 없이 깔끔히 제거됐다.
- **레이어링 규약**: 신규 `codebase/frontend/src/lib/utils/masked-markers.ts` 는 `src/lib/**`에 위치하고, 소비처(`rerun-modal.tsx`/`editor-toolbar.tsx`/`dynamic-form-ui.tsx`)는 모두 `src/components/**` → `src/lib/**` 방향으로 import한다 — `frontend-layering.md` §1/§2 의 허용 방향과 일치(원래 `dynamic-form-ui.tsx`(component) 안에 있던 걸 소비처가 셋으로 늘며 `lib/`로 승격한 이력도 §3 "위반 시 해소법"과 같은 패턴).
- **i18n 규약**: 신규 UI 문자열은 전부 `t("editor.runWithInputMasked")`/`t("history.rerun.maskedInputBlocked")` 로 dict 키를 경유했고(하드코딩 금지 Principle 1 준수), `dict/{ko,en}/{editor,history}.ts` 4파일이 한 PR 안에서 동시 갱신돼 leaf key parity(Principle 2)가 깨지지 않는다. 문체도 해요체로 기존 sibling 엔트리와 일관(Principle 6). 영향받는 유저 가이드 MDX 4개(`run-results.mdx`/`.en.mdx`, `running-a-workflow.mdx`/`.en.mdx`)도 같은 PR 에서 ko/en 쌍으로 갱신돼 Principle 7 (페이지 stale 방지) 을 충족한다.
- **spec-impl-evidence 규약**: 변경된 `spec/5-system/13-replay-rerun.md`(`status: implemented`) · `14-external-interaction-api.md`(`status: partial`) frontmatter `code:` 에 추가된 경로(`masked-markers.ts`/`rerun-modal.tsx`/`editor-toolbar.tsx`)는 워킹트리에 실존 확인됨. `14-...md` 는 여전히 `pending_plans:`(잔여 백로그 3건 — 마스킹 게이트 통합·서버측 마커 리터럴 거부·외부 소비자 확인)가 남아 `status: partial` 유지가 §3.1 전이 규칙과 일치(성급한 `implemented` 승격 없음).
- **금지 항목**: `secret-store.md`(전문 확인) 의 `SecretResolver` URI scheme·마스터키 관리 등은 이번 diff 와 무관 — 위반 표면 없음. `data-hydration-surfaces.md` 의 AI-turn 출력 필드 매트릭스는 `output.result.*` 계열 필드 전용이라 `Execution.inputData`(트리거 입력 echo)는 그 적용 범위 밖 — 매트릭스 미갱신은 위반이 아니다.

## 요약

target(`spec/5-system/**`) 변경분과 이를 뒷받침하는 backend/frontend 코드는 확인 가능한 모든
`spec/conventions/**` 규약(swagger DTO 패턴, frontend 레이어링, i18n dict 경유·parity·문체,
spec-impl-evidence frontmatter, secret-store)에 부합한다. 유일한 관찰 사항은 DTO JSDoc 길이가
swagger.md §3 의 "1~2문장" 문구를 넘는다는 점인데, 이는 그 규약 문단이 애초에 이 저장소의
기존 다문단 관행을 추인하려고 개정된 것이라 실질적 위반이 아니다(INFO). CRITICAL·WARNING 급
위반은 발견하지 못했다.

## 위험도

NONE
