# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 이번 배치의 두 실질 변경(B-3 SoT 통합, B-4 방어 강화)을 기록하지 않았다
  - 위치: `CHANGELOG.md` (파일 최상단) — 신규 항목 없음. 관련 소스: `codebase/backend/src/common/filters/http-exception.filter.ts`(B-3), `codebase/backend/src/modules/workspaces/workspaces.service.ts` L216-231(B-4)
  - 상세: 이 저장소의 `CHANGELOG.md`는 "개발 노트가 아니라 보안 공지"(`CHANGELOG.md` 자기 서술, `## CHANGELOG 는 개발 노트가 아니라 보안 공지다` 섹션)로 취급되며, 직전 두 커밋(`08fbf133d`, `bfa124920`)은 각각 176줄·120줄 분량의 상세 `## Unreleased` 항목을 CHANGELOG 에 추가했다. 이번 배치(커밋 `03f665c63`)는 `CHANGELOG.md`를 전혀 건드리지 않았다(`git show --stat 03f665c63`에 해당 파일 없음). 그런데 포함된 두 변경은 정확히 그 전례가 다루던 성격이다: (1) B-3 은 `pg-error.ts`를 SoT로 세운 취지와 어긋나던 전역 예외 필터의 raw-surface(`err.code`) 분기 누락을 고쳐 23505 unique violation 이 500 대신 409 로 가도록 했다(동작 변경) — 바로 직전 CHANGELOG 항목의 제목이 이 정확한 SoT-vs-국소분기 패턴("가장 넓은 fallback 이 가장 좁았다", 커밋 메시지 B-3 제목)이다. (2) B-4 는 CHANGELOG 최상단 항목이 명시적으로 "검출이지 강제가 아니다"라고 지목한 바로 그 자리(`listMembers`)를 DB 레벨 `select` 투영으로 옮겨 강제로 전환했다 — 직전 항목의 "곁가지" 절이 이 미해결 갭을 그대로 남겨두고 있었다.
  - 제안: 이 저장소의 확립된 관례를 따라 `CHANGELOG.md`에 이번 배치용 `## Unreleased` 항목을 추가한다. 최소한 B-3(raw 표면 23505 → 409 로 정정, 이전엔 500) 과 B-4(`listMembers` 검출→강제 전환, 직전 항목이 남긴 갭을 닫음)를 다루면 된다. B-1/B-2(harness 전용)·B-5(중복 제거)·B-6/B-7(테스트 추가)·B-8(타입 개명)은 전례상 CHANGELOG 항목 없이도 넘어간 유형(순수 내부 리팩터/테스트)과 결이 같아 필수는 아니다.

- **[INFO]** `production-build-devdep.spec.ts` 상단 describe 블록 JSDoc의 "3번째 자리" 서술은 정확하나, 파일 헤더의 "왜 이 스위트가 필요한가" 총괄 설명이 이제 세 번째 회귀 사례까지 다루고 있어 제목 수준에서 "세 번째"임을 반영할지 검토할 여지
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` 함수/블록: 새 `it('\`__test-utils__\` 는 빌드 대상이 아니다', …)` 바로 위 JSDoc
  - 상세: 새로 추가된 테스트 자체의 JSDoc은 "같은 이유의 세 번째 자리 (2026-09-08)"라고 정확히 표기했고, `tsconfig.build.json`의 병렬 주석("같은 이유의 세 번째 자리")과도 서로 일치한다(cross-check 완료, 대조 불일치 없음). 다만 파일 최상단(describe 레벨) JSDoc은 이 스위트의 최초 동기(`04_20_10` testing W1, `masked-reject-callers-guard`)만 설명하고 이후 두 차례 추가된 exclude 패턴(`shared/testing`, `__test-utils__`)이 같은 파일에 누적되고 있다는 사실을 요약하지 않는다 — 다음 사람이 파일 헤더만 읽으면 이 스위트가 반복적으로 같은 형태의 회귀를 잡아 온 이력을 놓칠 수 있다.
  - 제안: 필수 수정은 아님(각 개별 테스트 JSDoc이 이미 자기 완결적으로 정확하다). 다음에 이 파일을 편집할 기회에 파일 헤더에 "지금까지 3회 반복된 패턴"이라는 한 줄을 더하면 누적 이력이 한눈에 보인다.

## 요약

이번 배치(B-1~B-8)는 이 저장소의 매우 높은 문서화 밀도 관례를 그대로 유지한다 — 새로 추가된 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture), 타입 개명(`WorkflowVersionDetailProjection`), DB 투영 전환(`listMembers`), `pg-error.ts` SoT 통합 등 모든 변경에 "왜"를 설명하는 JSDoc/인라인 주석이 동반되었고, 교차 참조(백엔드↔프런트엔드 타입 코멘트, `data-model.md §2.1.1`·`## Rationale` 링크, 형제 가드 `hasProjectionFor` 인용)를 직접 열어 대조한 결과 전부 정확했다. `PROJECT.md`와 `.claude/test-stages.sh`의 새 `_cmd_typecheck_ratchets()` 관련 문서도 서로 일치하고 CI 워크플로(`backend-checks.yml`/`frontend-checks.yml`) 실측과도 어긋나지 않는다. 유일한 실질적 공백은 `CHANGELOG.md` 미갱신이다 — 이 저장소는 직전 두 커밋 모두 유사한 성격(SoT 통합 버그 수정·User 노출 방어 강화)의 변경에 상세한 CHANGELOG 항목을 남기는 강한 관례를 보이는데, 이번 배치는 그 관례를 깨고 건드리지 않았다. README·API 문서·설정 문서·예제 코드 관점에서는 새 환경변수·신규 공개 API 표면 변경이 없어 추가 갱신 필요성이 없다.

## 위험도

LOW
