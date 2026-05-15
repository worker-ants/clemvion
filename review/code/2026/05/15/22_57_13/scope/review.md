# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 3: background-runs.service.ts

- **[WARNING]** 임포트 삭제 + 포맷팅 변경이 기능 변경과 혼재
  - 위치: `backend/src/modules/executions/background-runs/background-runs.service.ts` diff 전체
  - 상세: 이 파일의 변경은 세 종류가 섞여 있다.
    1. `BackgroundRunNodeExecutionsPageDto` 임포트 삭제 — 실제로 사용되지 않는 임포트 제거이므로 범위 내 정리라고 볼 수 있다. 단, 이 PR의 명시적 목표는 "cleanup 스크립트 운영 환경 대응" 이며 background-runs.service.ts 는 그 범위와 직접 관계가 없다.
    2. `.where(...)` 인수 줄바꿈(라인 334–340), `qb.orderBy(...)` 체인 분리(라인 363–366), `toNodeExecutionDto` 파라미터 줄바꿈(라인 374–377), `aggregateBodyStatus` 시그니처 줄바꿈(라인 385–388) — 순수 포맷팅 변경.
    3. 인라인 주석 들여쓰기 정렬(라인 348–355) — 기존 주석의 공백 1칸 차이를 수정한 포맷팅 변경.
  - 제안: background-runs.service.ts 는 이번 PR의 목적(cleanup 스크립트 src/ 이동 및 운영 환경 지원)과 무관하다. 포맷팅·임포트 정리는 별도 커밋이나 별도 PR로 분리하거나, 이 파일 전체를 이번 변경에서 제외한다.

- **[INFO]** 포맷팅 변경만 존재하는 hunk — 의미 없는 노이즈
  - 위치: 라인 347–355 (주석 들여쓰기), 라인 363–366 (`qb.orderBy` 체인 분리), 라인 374–377 (`toNodeExecutionDto` 시그니처), 라인 385–388 (`aggregateBodyStatus` 시그니처)
  - 상세: 코드 동작·의미 변경 없이 공백·줄바꿈만 바뀐 hunk 4개가 포함된다. PR diff를 오염시켜 리뷰 집중도를 떨어뜨린다.
  - 제안: prettier 자동 포맷 결과라면 `.editorconfig` 또는 `prettier` 설정을 저장소 전체에 일관 적용한 뒤 별도 "chore: format" 커밋으로 분리한다.

### 파일 7: migrate-button-ids.spec.ts

- **[WARNING]** 임포트 경로 수정 — 기능과 무관한 파일이 범위에 포함됨
  - 위치: `backend/src/scripts/migrate-button-ids.spec.ts` diff (라인 4–7)
  - 상세: `../../scripts/migrate-button-ids` → `./migrate-button-ids` 경로 수정. 이는 스크립트 파일 위치가 `backend/scripts/` → `backend/src/scripts/` 로 이동한 결과로 보이며, 이동 자체는 이번 PR의 핵심 목적과 연관된다. 그러나 diff에 `migrate-button-ids.ts` 신규 생성(파일 8)도 함께 포함되어 있는데, 이는 cleanup 스크립트 운영 지원과는 다른 별개 목적(button id backfill 마이그레이션)의 파일이다.
  - 제안: `migrate-button-ids.ts` 및 그 spec 파일이 이번 작업(cleanup-invalid-queue-jobs 운영 환경 전환)의 일환으로 함께 이동된 것이라면 커밋 메시지나 PR 설명에 명시적으로 언급해야 한다. 별개 작업이라면 분리 PR이 적절하다.

### 파일 8: migrate-button-ids.ts (신규 생성)

- **[WARNING]** cleanup 스크립트와 무관한 새 마이그레이션 스크립트 추가
  - 위치: `backend/src/scripts/migrate-button-ids.ts` (신규, 315줄)
  - 상세: 이 PR의 변경 의도는 `cleanup-invalid-queue-jobs` 스크립트를 운영 환경에서 `dist/` 로 실행 가능하도록 `backend/scripts/` → `backend/src/scripts/` 로 이동하고, 로직을 `cleanup-invalid-jobs.util.ts` 로 분리하는 것이다. `migrate-button-ids.ts` 는 button id backfill 이라는 전혀 다른 도메인의 스크립트로, 이번 PR의 명시적 목적과 관련이 없다.
  - 제안: `migrate-button-ids.ts` 와 그 spec은 별도 PR(또는 별도 커밋)으로 분리한다. 이번 PR에서 유지하려면 PR 설명에 이 파일이 포함된 이유를 명시한다.

### 전반적 범위 판단 (범위 내 변경)

아래 변경들은 이번 PR의 의도("cleanup-invalid-queue-jobs 스크립트를 운영 환경 dist/ 로 실행 가능하도록 재구성")에 부합한다:

- **파일 2** (`backend/scripts/cleanup-invalid-queue-jobs.ts` 삭제): 구 위치 제거.
- **파일 5** (`cleanup-invalid-jobs.util.ts` 신규): 스크립트 로직을 테스트 가능한 util 모듈로 분리 — 목적에 부합.
- **파일 4** (`cleanup-invalid-jobs.util.spec.ts` 신규): util 모듈 단위 테스트 — 목적에 부합.
- **파일 6** (`backend/src/scripts/cleanup-invalid-queue-jobs.ts` 신규): 신규 위치의 엔트리포인트 — 목적에 부합.
- **파일 1** (`backend/package.json`의 `cleanup:queue-jobs` 스크립트 추가): 운영 환경 npm script 추가 — 목적에 부합.

---

## 요약

이번 PR의 핵심 작업(cleanup-invalid-queue-jobs 스크립트를 `src/scripts/`로 이동, util 분리, 테스트 추가, npm script 등록)은 변경 범위에 충실하다. 그러나 세 가지 범위 이탈이 포함되어 있다. 첫째, `background-runs.service.ts`에 순수 포맷팅·임포트 정리가 혼입되어 있으며 이 파일은 이번 작업과 무관하다. 둘째, `migrate-button-ids.ts` 신규 생성과 해당 spec의 임포트 경로 수정이 포함되어 있는데, 이는 button id 마이그레이션이라는 별개 도메인의 변경이다. 이 두 영역을 분리하면 PR의 의도가 명확해지고 리뷰 부담도 줄어든다.

## 위험도

LOW
