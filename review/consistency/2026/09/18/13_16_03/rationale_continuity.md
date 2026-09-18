# Rationale 연속성 검토 — spec/2-navigation/ (impl-done)

## 점검 범위와 실측

- `spec/2-navigation/` 자체는 이 브랜치에서 **변경 파일 0개** (`git diff origin/main...HEAD --stat -- spec/2-navigation/` 실측, 출력 없음). 따라서 "target 문서가 과거 Rationale 을 뒤집었는가" 를 직접 비교할 신규 spec 서술이 없다.
- 실제 구현 diff(6파일/157줄)는 `spec/2-navigation/2-trigger-list.md` 의 `code:` 프런트매터가 이미 소유권을 선언한 파일들이다:
  - `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (+`select: { id, type, config }` 좁히기)
  - `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` (단위 단언 갱신)
  - `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (인덱스 유효성 스키마 e2e 1건 추가)
  - `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` / `.conf` (신규 인덱스)
  - 그 외 `spec/1-data-model.md` · `spec/data-flow/10-triggers.md` · `spec/conventions/migrations.md` · `codebase/backend/migrations/README.md` — 전부 `spec/2-navigation/` 밖.
- 따라서 이번 검토는 "2-navigation 소유 코드가 2-navigation 의 Rationale 을 우회·번복하는가" 로 좁혀 실측했다.

## 대조 결과

1. **§4.3 «트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다» (2026-09-17 결정, `2-trigger-list.md`) 와 정합.**
   `releaseExternalForParent` 의 `select: { id: true, type: true, config: true }` 좁히기는 §4.3 이 이미 명시한 "워크플로·워크스페이스 삭제는 트리거 전부를 한 번에 올린다" 구조를 그대로 쓰며, 코드 JSDoc 이 그 소비처(schedule 판별=`type`, chat channel teardown=`config`, 조회/로그=`id`)를 §4.3 근거로 명시한다. 반대 방향(전체 컬럼을 읽던 이전 코드)을 좁히는 것도 §4.3 이 세운 정책의 실행일 뿐, 그 정책을 뒤집지 않는다.

2. **`triggers.service.ts` 의 기존 원칙 "왜 `select: false` 가 아닌가" 와 충돌 없음.**
   그 Rationale(스윕 잡이 은닉된 컬럼을 못 읽어 fail-silent 해진다는 이유로 **엔티티 레벨** `select: false` 를 기각)과, 이번 diff 의 **호출부 레벨** `find({ select: {...} })` 좁히기는 층이 다르다. 같은 파일 안에 이미 `select: { id: true }` 좁히기 선례가 3곳(`lockParentAndListTriggerIds` 등) 있어, 이번 변경은 새 패턴이 아니라 기존 국소 관례의 연장이다. `config` 를 남긴 이유(테어다운 소비)도 명시돼 원칙과 어긋나지 않는다.

3. **R-4/R-16 (`isActive` 편집 경로 단일 · drawer read-only) 무관·비충돌.** 이번 diff 는 PATCH/편집 경로를 건드리지 않는다 — `releaseExternalForParent` 는 삭제 계열 경로 전용이라 R-4/R-16 이 규율하는 편집 API 표면과 겹치지 않는다.

4. **인접 spec(`1-data-model.md`, `migrations.md`, 범위 밖)의 결정 번복은 근거 있는 갱신이었다(참고용, 등급 부여 안 함).**
   `migrations.md`/`migrations/README.md` 는 "인덱스 **교체**만 DROP-먼저" 규약을 "인덱스 **신규 추가**도 DROP-먼저" 로 확장했는데, 새 Rationale 절(README §5 "신규 추가에도 0) 을 둡니다", 2026-09-18)이 이전 결정(V106 이 이 스텝을 빠뜨린 사실)을 명시적으로 인용하며 왜 확장하는지 적어, "결정의 무근거 번복" 에 해당하지 않는다. `spec/2-navigation/` 소유가 아니므로 본 checker 스코프의 CRITICAL/WARNING 대상은 아니다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 로 등재할 항목을 찾지 못했다. `spec/2-navigation/` 델타가 0이고, 그 스코프가 소유한 코드 변경은 §4.3(2026-09-17)·"왜 select:false 아닌가" 두 기존 Rationale 을 그대로 따르는 좁히기 최적화이며 새 대안 도입·원칙 위반·무근거 번복·invariant 우회 중 어느 것에도 해당하지 않는다.

## 요약

이번 PR 은 `spec/2-navigation/` 문서 자체를 바꾸지 않았고, 그 스코프가 소유한 유일한 코드 변경(`trigger-resource-releaser.service.ts` 의 `select` 좁히기 + 이를 뒷받침하는 인덱스·테스트)은 `2-trigger-list.md` §4.3(2026-09-17, "삭제 경로는 트리거 자원을 정리한다")과 `triggers.service.ts` 의 기존 "select: false 대신 호출부 좁히기" 관례를 그대로 실행할 뿐 어떤 기각된 대안도 되살리지 않고 어떤 합의 원칙도 침해하지 않는다. 범위 밖(`spec/1-data-model.md`, `migrations.md`)의 인덱스 마이그레이션 관례 확장은 이전 결정(V106)을 명시적으로 인용한 근거 있는 갱신으로, Rationale 연속성 관점에서 결함으로 볼 근거가 없다.

## 위험도

NONE
