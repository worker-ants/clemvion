STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 컨텍스트

이 changeset(`origin/main...HEAD`, `codebase/**` 실측 23파일)은 `Execution.inputData` egress
마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)
마커 가드 신설을 다룬다. 같은 diff 에 대해 이미 **다섯 라운드**(`14_08_45` → `14_44_08` →
`15_10_25` → `15_32_34` → `15_59_17`)의 아키텍처 리뷰가 순차적으로 CRITICAL 1건·WARNING
다수를 지적·수정하며 CRITICAL 0 / LOW 로 수렴한 상태이고, 남은 구조적 부채 2건은 명시적
근거와 함께 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커에 등재돼
있다. 이번(6번째) 라운드는 `git diff origin/main...HEAD --stat -- codebase/` 로 재확인한
최종 코드 스코프(`executions.service.ts`/`background-runs.service.ts`/`rerun-modal.tsx`/
`editor-toolbar.tsx`/`dynamic-form-ui.tsx`/`lib/utils/masked-markers.ts` 등 23파일)를
직접 열어 대조했다.

## 발견사항

없음 — 새로 지적할 CRITICAL/WARNING 을 찾지 못했다.

이번 라운드에서 별도로 검증해 본 아키텍처 후보 하나는 이미 트래커에 선점돼 있음을 확인했다:
`lib/utils/masked-markers.ts` 의 `MASKED_MARKERS` 가 backend `sanitize-error-message.ts` 의
동명 상수를 손으로 복제하는 구조라, 이 저장소의 기존 관행(`codebase/packages/@workflow/*` —
`graph-warning-rules`/`node-summary`/`ai-end-reason` 등, "backend NestJS 모듈을 frontend CSR
이 직접 import 할 수 없다" 는 동일 제약을 프레임워크-무관 공유 패키지로 해소해 온 선례)을
적용해 마커 상수도 별도 패키지로 승격하면 수동 미러 자체를 없앨 수 있지 않은가를 검토했다.
실측 결과 이 방향은 `spec-sync-external-interaction-api-gaps.md:346-355` 에 이미 "마커 미러
계약 테스트" 항목의 후속으로 **"두 스택을 가로지르는 대조엔 공유 패키지 추출(`packages/`)이
선행돼야 값싸다 — 그래서 별건으로 남긴다"** 라고 정확히 같은 결론으로 등재돼 있다 — 새로
제기할 필요가 없다.

## 확인했으나 재지적하지 않은 것 (이미 트래커 등재 / 이전 라운드 확정)

- **`blockedByMaskedInput`/`isStructuredField` 판정이 여전히 `rerun-modal.tsx` 컴포넌트
  내부 인라인 클로저** — `15_59_17` 라운드가 WARNING 으로 지적했고, RESOLUTION 이 "동작
  무변경 리팩터라 diff 성격이 갈리고, 조건이 넷째로 늘어나는 순간이 착수 시점" 이라는 근거로
  트래커(`spec-sync-...md` 같은 파일, W3 항목)에 명시 등재·비차단 처리했다. 이번 델타에서
  조건이 늘지 않았으므로(현재도 3조건 그대로) 재지적하지 않는다.
- **backend 마스킹 관문이 `toResponseExecution`/`toExecutionDto`/노드 레벨 map/
  `background-runs.service.ts` 4곳 이상으로 분산** — `15_32_34` 라운드가 이미 지적,
  `toResponseExecution` JSDoc 의 "읽기 표면 목록 — 이 주석이 정본" 표(6개 표면 명시)로
  단일 문서화 관문을 유지하는 완화책이 이미 적용돼 있고, 완전 통합은 별건 리팩터로 트래커
  등재. `background-runs.service.ts:300-302` 는 그 표를 `{@link}` 없이도 프로즈로 정확히
  가리킨다 — drift 없음.
- **`lib/utils/masked-markers.ts` 승격이 고친 의존 방향** — 이전엔 `rerun-modal.tsx`/
  `editor-toolbar.tsx` 가 무관한 폼 컴포넌트(`dynamic-form-ui.tsx`)를 import 해야 했다.
  실측(`grep -rln masked-markers`) 결과 현재 세 소비처 모두 `lib/utils/masked-markers`
  단일 지점만 import 하고, `dynamic-form-ui.tsx` 에 대한 역참조는 어디에도 없다 — 컴포넌트
  간 결합이 공용 유틸 레이어로 정확히 재배선됐다.
- **backend `toResponseExecution` 의 copy-on-change 최적화**(세 컬럼 모두 무변화면 원본
  참조 재사용)는 `inputData` 편입 이후에도 그대로 유지된다 — 대규모 ForEach 실행에서
  불필요한 shallow-copy 를 피하는 기존 설계가 이번 확장으로 깨지지 않았다.

## 요약

이번 라운드에서 검토한 최종 코드 스코프는 SOLID·결합도/응집도·레이어 책임·순환 의존·모듈
경계 어느 축에서도 새로운 구조적 결함을 드러내지 않았다. backend 는 "읽기 표면 목록은 이
주석이 정본" 이라는 단일 문서화 관문 패턴을 유지한 채 세 컬럼(`error`/`outputData`/
`inputData`) 마스킹으로 일관되게 확장했고, frontend 는 마커 판별 순수 함수(`isMaskedMarker`/
`hasMaskedMarkerLeaf`)를 컴포넌트 밖 `lib/utils/masked-markers.ts` 로 승격해 세 소비처
(폼 프리필·Re-run 모달·에디터 히스토리 로드)가 서로를 몰라도 되게 만들고, 잘못된 의존
방향(모달/툴바 → 폼 컴포넌트)도 함께 제거했다. 다섯 라운드에 걸쳐 발견된 실질 결함(Swagger
계약 반전, 판정 우회 경로 3종, 부분-치환 잔존 문구)은 전부 수정됐고, 남은 두 구조적 부채
(마스킹 관문 4곳 이상 분산, backend/frontend 마커 미러의 수동 동기화 — 후자는 이번 라운드가
독자적으로 검토한 "@workflow/* 공유 패키지 추출" 방향과 정확히 같은 결론으로 이미 트래커에
있음)는 모두 근거를 갖춘 의도적 지연이라 이번 PR 을 막을 사안이 아니다.

## 위험도

LOW
