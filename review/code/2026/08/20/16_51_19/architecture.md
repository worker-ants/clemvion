STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19)

## 컨텍스트

이 changeset(`origin/main...HEAD`, `codebase/**` 23파일, `git diff --stat` 재확인)은
`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필 ·
Re-run 모달 · 에디터 히스토리 로드) 마커 가드 신설을 다룬다. 같은 diff 에 대해 이미
**여섯 라운드**(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34` → `15_59_17` →
`16_25_35`)의 아키텍처 리뷰가 순차적으로 CRITICAL 1건을 잡아 수정하며 CRITICAL 0 / LOW
로 수렴했고, 직전 라운드(`16_25_35`)는 `ISSUES=0` 으로 종결됐다. HEAD 는 그 라운드가
지적한 마지막 WARNING(재귀 깊이 상한 부재, `sed`/`Read` 로 `hasMaskedMarkerLeaf` 실물
대조 완료)까지 반영된 커밋(`6f1d4d41d`)이다.

이번 라운드는 리뷰 산출물을 그대로 신뢰하지 않고 핵심 파일 3개(`masked-markers.ts`,
`rerun-modal.tsx`, `executions.service.ts`)를 직접 열어 재검증했고, `grep -rln
masked-markers`, tracker 파일(`spec-sync-external-interaction-api-gaps.md:315,322,346-355`)
실물 대조로 이전 라운드의 결론을 독립적으로 재확인했다.

## 발견사항

없음 — 새로 지적할 CRITICAL/WARNING을 찾지 못했다. 검토한 후보와 판단 근거는 아래와 같다.

### 확인했으나 재지적하지 않은 것 (이미 트래커 등재 / 이전 라운드 확정, 실물 대조로 재검증)

- **`MASKED_MARKERS`/`MAX_MARKER_SCAN_DEPTH` 가 backend `sanitize-error-message.ts` 의
  동명 상수를 손으로 복제** — `codebase/frontend/src/lib/utils/masked-markers.ts` 는 값
  집합과 깊이 상한(10)을 backend 와 별개 리터럴로 유지한다. 이 저장소엔 정확히 이 문제
  (backend NestJS 모듈을 frontend CSR 이 직접 import 할 수 없어 값 도메인을 복제해야
  하는 제약)를 프레임워크-무관 공유 패키지로 해소해 온 선례(`codebase/packages/@workflow/*`
  — `ai-end-reason`/`node-summary`/`graph-warning-rules`)가 이미 있다. 이 방향은
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:346-355` 에 "마커 미러
  계약 테스트 … 공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로
  남긴다"로 정확히 같은 결론이 이미 등재돼 있다(실물 확인). 새로 제기하지 않는다.
- **마스킹 판정 로직이 소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)에
  이질적으로 분산** — 공유 원시 함수(`isMaskedMarker`/`hasMaskedMarkerLeaf`)는
  `lib/utils/masked-markers.ts` 한 곳으로 모였지만, 그 위의 "언제 차단하는가" 판정
  (`rerun-modal.tsx` 의 3조건 `blockedByMaskedInput`, `editor-toolbar.tsx` 의 파싱-실패
  겸용 검사)은 컴포넌트별 인라인 클로저로 각자 조립돼 있다. `spec-sync-...md:315`("마스킹
  게이트 4곳을 단일 헬퍼로 통합", `14_44_08` W4 등재)와 `16_25_35` 라운드 판단("동작
  무변경 리팩터라 diff 성격이 갈리고, 조건이 넷째로 늘어나는 순간이 착수 시점")이 이미
  이 결정을 내렸다. 이번 델타에서 조건 수는 그대로(3개)라 재지적하지 않는다.
- **`lib/utils/masked-markers.ts` 로의 승격이 고친 의존 방향** — 이전엔 `rerun-modal.tsx`/
  `editor-toolbar.tsx` 가 자신과 무관한 프레젠테이션 컴포넌트(`dynamic-form-ui.tsx`)를
  import 해 순수 유틸을 얻어야 했다(잘못된 레이어 방향: 형제 컴포넌트 → 형제 컴포넌트).
  `grep -rln masked-markers codebase/frontend/src` 재실행 결과 현재 세 소비처
  (`rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`) 전부 `lib/utils/masked-markers`
  단일 지점만 import 하고, `dynamic-form-ui.tsx` 로의 역참조는 어디에도 없다 — 결합이
  공용 유틸 레이어로 정확히 재배선됐다(leaf 모듈, 자체 의존성 0, 순환 없음).
- **`inputOverride` 가 서버 측에서 마스킹 마커 리터럴을 검증 없이 수용** —
  `executions.service.ts` `reRun` (Re-run 흐름, `resolveTriggerParameters(schema,
  dto.inputOverride ?? {})`) 은 클라이언트가 보낸 값을 스키마 타입 검증만 거쳐 그대로
  실행 입력에 편입한다. 즉 이 PR 의 방어는 전적으로 UI 레이어(프리필 스킵 + 제출 버튼
  비활성)이고, API 를 직접 호출하면 우회된다. 이는 계층 경계상 실재하는 defense-in-depth
  갭이지만 `spec-sync-...md:322`("`inputOverride` 서버측 마커 리터럴 거부", `14_44_08` W6)
  에 이미 등재돼 있고, security 리뷰가 이전 라운드에서 "§R17 이 가드 범위를 UI 정상 흐름
  으로 명시했다"는 근거로 INFO 판정·비차단 처리한 사안이다. 새로 제기하지 않는다.
- **backend 마스킹 관문이 `toResponseExecution`/`toExecutionDto`/노드 레벨 map/
  `background-runs.service.ts` 4곳 이상으로 분산** — `toResponseExecution` JSDoc 의
  "읽기 표면 목록 — 이 주석이 정본" 표(6개 표면 명시, `executions.service.ts:1037-1056`)로
  단일 문서화 관문을 유지하는 완화책이 적용돼 있다. `background-runs.service.ts:300-302`
  는 그 표를 정확히 프로즈로 가리킨다 — drift 없음. 완전 통합은 트래커 등재 별건.

## 요약

핵심 소스 3개(`masked-markers.ts`, `rerun-modal.tsx`, `executions.service.ts`)를 직접
열람하고 tracker 실물을 대조해 독립 재검증한 결과, SOLID·결합도/응집도·레이어 책임·
순환 의존·모듈 경계·확장성 어느 축에서도 새로운 구조적 결함을 발견하지 못했다.
frontend 는 마커 판별 순수 함수를 컴포넌트 밖 `lib/utils/masked-markers.ts` 로 승격해
값 검사가 먼저(off-by-one 이 fail-open 이 되는 순서 문제 방지) 오도록 하고 깊이 상한을
backend `MAX_REDACT_DEPTH` 와 동일하게 맞췄으며, 세 소비처가 서로를 몰라도 되게 하고
잘못된 컴포넌트 간 의존 방향(모달/툴바 → 폼 컴포넌트)도 제거했다. backend 는
`toResponseExecution` 을 세 컬럼(`error`/`outputData`/`inputData`) 마스킹의 단일
문서화 관문으로 유지한 채 일관되게 확장했다. 남은 구조적 부채(backend/frontend 마커
상수의 수동 미러, 마스킹 게이트 4곳의 판정 로직 분산, `inputOverride` 서버측 미검증)는
전부 근거와 함께 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 명시
등재된 의도적 지연이며, 이번 PR 을 막을 사안이 아니다.

## 위험도

LOW
