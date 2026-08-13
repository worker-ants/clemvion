# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 사전 확인

`git diff origin/main...HEAD --stat -- 'spec/**'` = **0건**. `spec/5-system/` 를 포함해
`spec/` 전체에 이번 diff 구간(4 커밋, origin/main 대비)의 변경이 전혀 없다. `git fetch origin
main` 재확인 후에도 동일 (`origin/main` HEAD = `9a4d3e32b`, 로컬 HEAD = `6570ca3bb`, 그 사이
4 커밋 전부 `codebase/backend/**` + `plan/`·`review/` 산출물).

즉 이번 라운드의 target(`spec/5-system/`) 은 **신규로 도입한 요구사항 ID·엔티티·endpoint·이벤트
명·ENV var·파일 경로가 없다** — 검토 대상 자체가 비어 있다. (`plan/in-progress/
backend-lint-gate-broken-on-main.md` 의 diff 는 앞선 라운드에서 이미 종결된 EIA r8 캐시/알림
작업의 완료 기록일 뿐, 이번 diff 구간에 새 spec 서술을 추가하지 않는다.)

실제 변경분(코드)은 다음 4개 파일이다:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — admission UPDATE
  결과 shape 가드(`Array.isArray(rows)` 아니면 throw). 새 식별자 없음, 기존 로직 강화.
- `codebase/backend/src/modules/executions/executions.service.ts` — 기존 module-private
  상수 `SNAPSHOT_CACHE_MAX_ENTRIES` 에 `export` 부착 (가시성 변경, 신규 식별자 아님).
- 대응 `*.spec.ts` 2개 — 테스트 전용 추가.

## 발견사항

### `SNAPSHOT_CACHE_MAX_ENTRIES` export 가시성 변경 — 충돌 없음 확인

- **[INFO]** 기존 상수의 신규 export
  - target 신규 식별자: `SNAPSHOT_CACHE_MAX_ENTRIES` (신규 도입 아님 — 기존 module-private
    상수에 `export` 키워드만 추가됨, `codebase/backend/src/modules/executions/
    executions.service.ts:63`)
  - 기존 사용처: 프로젝트 전체에 동일 이름의 다른 export 없음
    (`git grep -n "SNAPSHOT_CACHE_MAX_ENTRIES" -- codebase/` → `executions.service.ts` 정의부
    1건 + 사용부 1건 + `executions.service.spec.ts` import/사용 3건, 전부 동일 개체를 가리킴)
  - 상세: export 전환은 신규 테스트(`executions.service.spec.ts`)가 캐시 상한(256)·LRU
    방향을 심볼로 단언하기 위한 것. 다른 모듈·다른 도메인에 동명의 상수·타입이 없어 의미
    충돌 없음.
  - 제안: 조치 불필요.

## 요약

이번 검토 구간(`origin/main`..`HEAD`, 4 커밋)은 `spec/5-system/` 을 포함해 `spec/` 전체에
diff 가 없어 target 문서가 새로 도입하는 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
ENV/설정키·spec 파일 경로가 존재하지 않는다. 함께 바뀐 코드 4파일 중 유일한 식별자 가시성
변경(`SNAPSHOT_CACHE_MAX_ENTRIES` export)도 동명 충돌이 없음을 확인했다. 신규 식별자 충돌
관점에서 이번 라운드는 실질적으로 검토 대상이 없는 상태(scope 공백)이며, 이는 결함이 아니라
선행 라운드에서 EIA r8 캐시/알림 관련 spec 변경이 이미 `origin/main` 에 병합 완료된 결과로
보인다.

## 위험도
NONE
