# 테스트(Testing) 코드 리뷰 — workflow-duplicate-nodes-edges (consistency-check 산출물 + spec 정정, impl-done 후속 타겟 재실행)

## 검토 범위 확정

이번 라운드는 `meta.json` 상 `"routing_status": "skipped", "routing_skip_reason": "REVIEW_AGENTS explicitly set"` —
`testing`/`documentation` 2개 에이전트만 호출된 **명시적 타겟 재실행**이다. 프롬프트에 첨부된 16개 파일은:

- 파일 1~6: `review/consistency/2026/07/30/17_03_26/**` — `--impl-prep` consistency-check 리포트 6종
- 파일 7~14: `review/consistency/2026/07/30/19_03_37/**` — `--impl-done` consistency-check 리포트 6종 + `SUMMARY.md`/`_retry_state.json`
- 파일 15~16: `spec/2-navigation/1-workflow-list.md`, `spec/data-flow/11-workflow.md` — workflow duplicate 계약 정정 spec 본문

**애플리케이션 코드·테스트 코드가 diff 에 전혀 포함되어 있지 않다.** `git log`/`git diff origin/main...HEAD --stat` 로
직접 확인한 결과, 실제 구현(`codebase/backend/src/modules/workflows/{workflows.service.ts,workflows.controller.ts,
workflows.service.spec.ts}`, `codebase/backend/test/workflow-crud.e2e-spec.ts`)은 이 브랜치에 존재하지만, 이번
라운드의 changeset(`review/code/2026/07/30/19_43_05/meta.json` 의 `files` 배열)에는 들어있지 않다. 대신 그 코드는
이미 두 차례 전체 `/ai-review` 라운드(`review/code/2026/07/30/17_54_27/`, `review/code/2026/07/30/19_06_10/`)에서
testing 관점 심사를 받았음을 해당 `testing.md` 산출물을 직접 열어 확인했다.

## 발견사항

- **[INFO]** 이번 diff(16개 파일)에는 테스트 리뷰의 8개 관점을 적용할 실행 코드가 없음
  - 위치: 전체 diff(파일 1~14 — consistency-check markdown 리포트·`meta.json`·`_retry_state.json`; 파일 15~16 —
    spec 문서 본문 정정)
  - 상세: 14개 파일은 자동화된 consistency-check 도구가 생성한 분석 리포트·세션 메타데이터이고, 2개 파일은
    `POST /api/workflows/:id/duplicate` 계약을 서술하는 product spec 산문이다. 함수·분기·에러 처리·mock 대상이
    전혀 없어 "테스트 존재 여부/커버리지 갭/엣지 케이스/Mock 적절성/테스트 격리/테스트 가독성/테스트 용이성" 7개
    관점은 이 diff 자체에는 적용 대상이 없다(회귀 테스트 관점만 아래 별도로 다룸).
  - 제안: 조치 불요.

- **[INFO]** consistency-check 리포트(19_03_37 라운드)가 인용한 테스트 커버리지 주장 2건을 실제 테스트 소스와
  직접 대조 — 사실과 일치 확인
  - 위치: `review/consistency/2026/07/30/19_03_37/rationale_continuity.md:74-80` ("AI 노드 `llmConfigId` 는
    원본 값을 그대로 유지... 대응 unit 테스트에 ... 단언이 실제로 존재", "e2e 케이스가 복제 후
    `workflow_version` row 0건을 단언")
  - 상세: 프롬프트 밖 실제 저장소를 직접 Read 로 열어 두 claim 을 검증했다. `codebase/backend/src/modules/
    workflows/workflows.service.spec.ts:616-626`("import 전용 게이트를 적용하지 않는다") 테스트가 실제로
    `agent.config` 를 `{ systemPrompt: 'hi' }`(llmConfigId 없음)로 단언하고
    `mockModelConfigService.findDefault`/`mockRegistry.applyConfigDefaults` 미호출을 함께 검증한다.
    `codebase/backend/test/workflow-crud.e2e-spec.ts:327-332` 도 복제 후 `SELECT COUNT(*) FROM workflow_version`
    이 `'0'` 임을 실제로 단언한다. 두 claim 모두 지어낸 근거가 아니라 실측과 일치 — 이번 diff 에 포함된
    consistency-check 산출물의 테스트 커버리지 서술은 신뢰할 수 있다.
  - 제안: 없음(검증 목적 기록).

- **[INFO]** (참고, 이번 changeset 범위 밖) 직전 testing 라운드(19_06_10)가 지적한 회귀 단언 부재가 최신 커밋에서
  해소됐으나, 그 변경분 자체는 이번 대상 파일 목록에 없음
  - 위치: 커밋 `3af0aabbe`(HEAD)의 `codebase/backend/src/modules/workflows/workflows.service.spec.ts` +13행 —
    이번 프롬프트에 포함된 파일이 아니므로 게이트 번호 없음(커밋 해시로 특정)
  - 상세: `review/code/2026/07/30/19_06_10/testing.md` 가 남긴 INFO("`duplicate()` 의 핵심 수정(REPEATABLE READ
    isolation)을 고정하는 회귀 테스트가 없음")를 그대로 반영해
    `expect(mockDataSource.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))` 단언이
    추가됐고, 커밋 메시지에 mutation 검증(`transaction('REPEATABLE READ', cb)` → `transaction(cb)` 로 바꾸면 이
    단언만 RED, 나머지 77개는 GREEN)까지 기록돼 있다 — 직접 diff 를 읽어 vacuous 하지 않음을 확인했다. 다만 이
    13행은 이번 19_43_05 라운드의 대상 파일 목록(16개)에 없다. 직전 두 라운드(17_54_27, 19_06_10)가 이미 코드
    전체를 testing 관점으로 심사했고, 그 이후 새로 커밋된 유일한 코드성 변경이 바로 이 13행이므로, 이번 라운드가
    "직전 리뷰 이후 전체 diff" 를 의도했다면 이 파일이 빠진 것은 changeset 산출 단계의 범위 갭일 가능성이 있다.
    다만 내용 자체를 직접 대조한 결과 결함은 없다 — 오히려 직전 라운드가 요청한 정확한 형태의 보강이다.
  - 제안: 조치 불요(내용 검증 완료, 코드 결함 아님). 향후 유사한 `REVIEW_AGENTS` 타겟 재실행에서 diff-base 산출이
    "직전 리뷰 이후 신규 코드 커밋"을 누락하지 않는지는 harness 차원에서 한 번 점검해볼 가치가 있다(프로세스
    관찰이며, 이 PR 을 막을 사유는 아님).

## 요약

이번 라운드(`REVIEW_AGENTS` 명시적 타겟 재실행, `testing`+`documentation` 2개 에이전트만 호출)에 배정된 diff 16개
파일은 전부 consistency-check 산출물(markdown 리포트 6종 × 2라운드 + `meta.json`/`_retry_state.json`)과 workflow
duplicate 계약을 정정하는 spec 문서 2건으로, 실행 코드·테스트 코드가 전혀 없다. 따라서 테스트 리뷰 8개 관점
대부분은 이 diff 자체에 적용되지 않는다. 다만 이 문서들이 인용하는 테스트 커버리지 주장(llmConfigId 비주입 unit
단언, workflow_version 0건 e2e 단언)을 실제 소스로 직접 대조해 사실과 일치함을 확인했고, `git log`/`git diff
origin/main...HEAD` 로 실제 구현(`workflows.service.ts`/`workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`)이
이미 두 차례 전체 코드 리뷰(17_54_27, 19_06_10)에서 testing 관점 심사를 받았고, 지적된 항목(mock 격리 오염,
OR 가드 mutation 사각지대, RESOLUTION 수치 오기재, REPEATABLE READ 회귀 단언 부재)이 순차적으로 해소되거나
의식적으로 보류·문서화됐음도 확인했다. 이번 changeset 이후 유일하게 추가된 코드성 변경(커밋 `3af0aabbe` 의 13행
회귀 단언)은 이번 라운드 대상 목록엔 없지만 직접 검증한 결과 결함이 없다 — 오히려 직전 라운드 권고를 정확히
반영한 보강이다. 이 diff 자체를 막을 테스트 관점의 사유는 없다.

## 위험도

NONE
