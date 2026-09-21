# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `throwIntegrationNotFound()` 헬퍼 추출이 이번 결함(동시 DELETE 감사 중복, `remove()`)과
  무관한 4개 메서드(`findById`/`update`/`rotate` 두 판정/`requireEntity`)까지 건드림
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:602`(`findById`),
    `:613`(헬퍼 정의), `:740`(`update`), `:1191`·`:1219`(`rotate` 두 판정), `:1480`(`requireEntity`).
    버그 수정 자체는 `:799`-`:803`(`remove()`)에 국한.
  - 상세: `remove()` 의 원자적 `delete`+`affected===0` 판정만이 이번 PR 의 본 목적(동시 DELETE 중복 감사)이다.
    나머지 6곳의 `if (!x) throw NotFoundException({...})` → `if (!x) this.throwIntegrationNotFound()`
    치환은 그 버그와 관련이 없다. 다만 이는 우연한 drive-by 리팩터가 아니라 **직전 리뷰 라운드**
    (`review/code/2026/09/21/10_54_47/SUMMARY.md` WARNING #2, maintainability)가 명시적으로 지적한
    항목을 별도 커밋(`5bbdf753d`)으로 조치한 것이며, `RESOLUTION.md` 에 조치 근거·범위가 기록돼 있다.
    `git diff` 로 각 치환 지점을 대조한 결과 전부 동일한 `NotFoundException({ code: 'RESOURCE_NOT_FOUND',
    message: 'Integration not found' })` 리터럴의 기계적 1:1 치환이며, 로직·조건·에러 코드 변경은 없다 —
    본 프로젝트의 "구현 완료 후 Critical/Warning 은 같은 턴에 fix" 상시 승인 의무(CLAUDE.md)에 부합하는
    범위 확장이라 스코프 위반으로 보기 어렵다.
  - 제안: 조치 불요. 다만 향후 유사 사례에서 "버그 수정 커밋"과 "리뷰 지적 리팩터 커밋"을 이번처럼
    분리 커밋(`707e89dec` vs `5bbdf753d`)으로 유지하는 관례가 스코프 감사를 쉽게 만든다 — 계속 지킬 것.

- **[INFO]** `plan/`·`review/` 하위 28개 신규 파일(리뷰 산출물·consistency-check 산출물·plan 문서)이
  diff 에 포함됨
  - 위치: `review/code/2026/09/21/10_54_47/*`(18개), `review/consistency/2026/09/21/10_27_27/*`(7개),
    `plan/in-progress/integration-dup-delete.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목 갱신)
  - 상세: 코드 변경(4개 파일)과 별개로 리뷰·consistency-check 산출물이 대량으로 커밋에 포함돼 있으나,
    이는 프로젝트 컨벤션(`review/code/**`, `review/consistency/**` 는 gitignore 대상 아님, 커밋 대상)과
    developer 워크플로(구현 → impl-prep → ai-review → RESOLUTION 기록)의 정상 산출물이다. 실제 코드
    스코프를 벗어나는 내용은 없다 — 각 파일이 이번 작업(통합 동시 DELETE 수정)에 대한 리뷰 결과만 담는다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신은 공유 트래커 문서의
  한 항목(라인 4802~4820 부근)에 국한
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4803`(신규 6번째 자리 등재),
    `:4819`-`:4820`(기존 문서-갭 항목에 `4-integration.md §9` 추가)
  - 상세: 55KB 짜리 대형 공유 트래커 파일에서 이번 작업과 직접 관련된 두 항목만 수정됐고, 다른 백로그
    항목·서식은 건드리지 않았다. 스코프 이탈 없음.
  - 제안: 조치 불요.

- **[INFO]** `broadcastCredentialChange` 직전 주석 갱신은 이번 diff 가 유발한 stale 근거를 즉시 정정한 것
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:815`-`816`
  - 상세: `remove(entity)` → `delete(criteria)` 전환으로 인해 "TypeORM remove 후 entity.id 가 unset 될 수
    있다"는 기존 주석 근거가 더 이상 성립하지 않게 됐고, 그 자리에서 바로 정정했다. 이번 코드 변경과
    직접 인접·연동된 주석이므로 무관한 주석 편집이 아니다.
  - 제안: 조치 불요.

포맷팅·불필요한 공백 변경, 사용하지 않는 임포트 추가/정리, 설정 파일 변경, 요청 밖 기능 확장은
발견되지 않았다. `git diff --ignore-all-space` 대조 결과 코드 3개 파일의 diff 크기가 공백 무시 후에도
유사하게 유지되어(82→76줄) 의미 없는 재포맷팅이 실질 변경에 섞여 있지 않음을 확인했다. import 목록도
변경 전후 동일(신규/삭제 없음, `grep '^import'` 대조).

## 요약

핵심 코드 변경(`integrations.service.ts`, 그 spec, 신규 e2e)은 "동시 DELETE 두 건이 `integration.deleted`
감사를 두 번 남기는" 결함 하나에 정확히 국한돼 있고, `remove()` 를 원자적 `delete`+`affected===0` 판정으로
바꾸는 것이 유일한 동작 변경이다. `throwIntegrationNotFound()` 헬퍼 추출이 버그와 무관한 4개 메서드까지
건드리지만, 이는 직전 리뷰 라운드의 명시적 WARNING 을 별도 커밋으로 조치한 문서화된 후속 조치이지 우연한
drive-by 리팩터가 아니며, 프로젝트가 상시 승인한 "리뷰 후 같은 턴 fix" 의무에 해당한다. 대량의
`review/`·`plan/` 산출물 커밋도 프로젝트 컨벤션에 따른 정상 워크플로 산출물이다. 포맷팅·임포트·주석·설정
관점에서 무관한 변경은 발견되지 않았다.

## 위험도

NONE
