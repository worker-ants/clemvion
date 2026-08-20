STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19)

## 컨텍스트

이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드)은
이미 code review 6라운드(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34` → `15_59_17` →
`16_25_35`)와 consistency review 다수 라운드(`--impl-prep` 2회, `--spec` 2회, `--impl-done`
5회)를 거쳤다. 실 변경 파일은 34개(scope.md `16_25_35` 실측과 `git diff --stat
origin/main...HEAD` 재확인 일치)이고 나머지는 이 PR 이 같은 브랜치에 누적 커밋한
`review/**` 세션 산출물이라 문서화 관점의 리뷰 대상이 아니다.

앞선 라운드들이 반복 지적했던 "주제문 방치"(헤딩·토픽 문장은 옛 결론에 두고 정정은
아래 blockquote/캐비엇으로만 붙이는) 패턴이 최종 diff 상태에서 실제로 해소돼 있는지
`Read`/`git diff origin/main...HEAD -- <file>` 로 직접 재확인했다:

- `codebase/backend/src/modules/executions/executions.service.ts` — `MASKED_INPUT_DATA_REASON`
  앵커 블록 전체 삭제, `ResponseExecution` JSDoc 주제문 "세 컬럼"으로 갱신, 세 관문
  (`toResponseExecution`/`toExecutionDto`/rest-spread 경로) 주석 모두 현재형으로 정합 (fixed)
- `codebase/backend/src/modules/executions/executions.service.spec.ts` — describe 소제목이
  `outputData + inputData 마스킹 — 표면 전수 (2026-08-20 부터 두 레벨 모두)`로 갱신, JSDoc
  본문 소제목("## 두 레벨 모두 마스킹 대상이다")도 현재 결론과 일치 (fixed)
- `codebase/backend/src/modules/executions/background-runs/*.ts`(.spec 포함),
  `dto/responses/execution-response.dto.ts`, `dto/background-run-response.dto.ts` — 전부
  자매 패턴("주제문은 현재형, 옛 서술은 `>` 캐비엇") 일관 적용 확인 (fixed)
- `codebase/frontend/src/components/executions/rerun-modal.tsx` — `blockedByMaskedInput`
  JSDoc 이 두 개의 분리된 블록에서 조건-표 하나로 병합(직전 라운드 maintainability
  WARNING) (fixed)
- `codebase/frontend/src/lib/utils/masked-markers.ts` — 깊이 상한(`MAX_MARKER_SCAN_DEPTH =
  10`)이 backend `MAX_REDACT_DEPTH`(10)와 일치함을 grep 으로 실측 대조, 값-검사가
  깊이-검사보다 먼저인 이유(off-by-one=fail-open)까지 JSDoc 에 명시 (확인)
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md`
  §4.1, `spec/5-system/13-replay-rerun.md` §10.2, `spec/1-data-model.md` §2.13 — 비교표
  ("`Execution.inputData` (REST) | **함**")·"레벨이 가른다" 축 폐기·"판단 기준 2축 재정의"
  서술이 전부 최종 결론과 일치 (fixed — 이전 rationale_continuity/plan_coherence
  WARNING 이 지적했던 비교표·프레임 문장 갱신 누락도 해소돼 있음)
- `plan/in-progress/eia-inputdata-marker-guard.md` — 직전 라운드(`16_25_35`)가 지적한 리뷰
  라운드 카운트 stale 문제("3라운드"인데 실제 5~6라운드)가 마지막 커밋(`6f1d4d41d`, RESOLUTION
  `16_25_35`)에서 `/ai-review` **6라운드**·`--impl-done` **5라운드**로 정확히 갱신되어 있음
  (fixed)

이 항목들은 재지적하지 않는다. 이번 라운드는 그 위에서 아직 직접 대조되지 않았던
표면(`codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts`,
`editor-toolbar-run-input.test.tsx`/`rerun-modal.test.tsx` 신규 테스트,
`editor-toolbar.tsx`의 try/catch 재배치)까지 포함해 재검토했으나 새로운 결함을 찾지
못했다.

## 발견사항

없음 — 신규 CRITICAL/WARNING 없음.

- **[INFO]** (재확인, 조치 불요 — `14_44_08`·`16_25_35` documentation 라운드가 이미 defer)
  plan 제목과 CHANGELOG 제목의 소비처 개수 표기가 여전히 다르다
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter `title`("재제출
    소비처 **2곳**에 마커 가드 선행") vs `CHANGELOG.md:3`("재제출 소비처 **3곳**에 마커
    가드")
  - 상세: plan 은 "이 작업이 새로 세우는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳을
    세고, CHANGELOG 는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을
    센다 — 각자 내적으로는 일관되고, 두 라운드 전(`14_44_08`) 이미 "조치 불요에
    가깝다"로 명시적으로 defer 됐으며 그 다음 라운드(`16_25_35`)도 재확인 후 동일하게
    defer 했다. 실제 모순은 아니라 이번 라운드도 새 지적으로 올리지 않되, 존재만
    기록한다.
  - 제안: 없음(직전 두 라운드 판정 유지).

## 요약

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을
CHANGELOG·plan 2건·spec 7파일·backend DTO/서비스 6파일·frontend 신규 유틸·다수 테스트
파일에 걸쳐 6라운드의 code review 와 다회의 consistency-check 를 거치며 정교하게
반영했다. 이번 라운드가 `git diff origin/main...HEAD` 로 34개 실 변경 파일 전체와
9곳 이상의 이전 라운드 지적 지점을 직접 재대조한 결과, "주제문 방치"·"plan 라운드
카운트 stale"·"비교표/프레임 문장 갱신 누락" 등 앞서 반복됐던 문서화 결함 클래스가
모두 최종 diff 상태에서 실측상 해소돼 있었고, 새로 발견된 문서화 결함은 없다. 유일한
잔존 항목은 두 라운드 전 이미 조치 불요로 확정된 사소한 표기 차이(INFO, defer 유지)뿐이다.

## 위험도

NONE
