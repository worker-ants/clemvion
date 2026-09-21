# 요구사항(Requirement) 리뷰 — integration-dup-delete

## 발견사항

- **[INFO]** 삭제 감사 로그 `broadcastCredentialChange` 옆 주석이 이제 근거로 삼는 API(`remove(entity)`)가 이 함수에서 사라졌다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()` 메서드 말미, `await this.broadcastCredentialChange(id);` 바로 위 두 줄 (`// 삭제된 integration 의 잔존 연결을 전 인스턴스에서 정리 (TypeORM remove 후 entity.id 는 unset 될 수 있어 param `id` 를 쓴다).`). `git blame` 상 2026-06-11 도입, 이번 diff 로는 손대지 않은 문맥 줄.
  - 상세: 이 주석은 "TypeORM `remove(entity)` 호출 후 `entity.id` 가 unset 될 수 있으므로 파라미터 `id` 를 쓴다" 는 근거를 대는데, 이번 PR 로 삭제 경로가 `remove(entity)` → `delete({ id, workspaceId })` 로 바뀌면서 그 근거가 더 이상 이 함수에 적용되지 않는다(`delete()` 는 엔티티 객체를 변형하지 않는다). 결론(파라미터 `id` 사용)은 여전히 안전하고 옳지만, 근거 문장이 stale 해져 다음 사람이 "이 함수가 여전히 `remove(entity)` 를 쓴다" 고 오독할 potential 이 있다 — 기능 결함은 아니고 순수 문서 정합성 이슈.
  - 제안: 주석을 "delete(criteria) 는 엔티티를 변형하지 않지만 명확성을 위해 파라미터 `id` 를 쓴다" 정도로 갱신하거나, 다음 이 파일을 만지는 커밋에서 함께 정리. 이번 PR 을 막을 사안은 아님.

- **[INFO]** `4-integration.md` §9.1 DELETE 행에 "동시 삭제 → 두 번째 요청 404" 서술이 없음 (spec fidelity 회색지대, 이미 트래킹됨)
  - 위치: `spec/2-navigation/4-integration.md` §9.1 (`DELETE /api/integrations/:id` 행 — "삭제 (사용처 있으면 409)"만 적혀 있고 동시 삭제 시 후행 요청의 404 는 미기재)
  - 상세: 이번 PR 이 구현한 새 관측 가능 동작(동시 DELETE 두 건 중 진 쪽이 404)이 spec 본문에 아직 반영되지 않았다. 다만 이는 신규 결함이 아니라 형제 PR(#1369~#1371)들이 이미 같은 형태로 남겨 온 문서 갭이며, 이번 PR 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` L4813 트래커 항목 스코프에 `4-integration.md §9` 를 명시적으로 추가해 등재했다(파일 5 diff, `--impl-prep review/consistency/2026/09/21/10_27_27` W3 을 그 자리에서 해소). `consistency-check` SUMMARY 도 BLOCK: NO · 이 항목을 WARNING(비차단)으로 이미 분류했다.
  - 제안: 조치 불요 — 이미 트래커에 등재되고 저심각도 비차단으로 처분됨. 본 리뷰가 별도 조치를 요구하지 않음(SPEC-DRIFT 태그를 붙이지 않는 이유: 코드가 spec 을 능동적으로 위반한 것이 아니라 spec 이 아직 이 동작을 서술하지 않는 침묵 영역이고, 처리 경로가 이미 존재).

## 점검 관점별 확인

1. **기능 완전성**: `IntegrationsService.remove()` 가 `findOne`(무락 존재 확인) → `queryUsageNodes`(사용처 409) → 원자적 `delete({id, workspaceId})` → `affected===0` 이면 404 → 아니면 감사 기록 + `broadcastCredentialChange` 순서로 완결. 형제 PR(#1369~#1371)과 동형 패턴이며 구현이 의도(동시 DELETE 진 쪽 404, 이긴 쪽만 감사 1건)를 완전히 충족.
2. **엣지 케이스**: `affected===0`(진 쪽) / `affected===1`(정상) / `affected===undefined`·`null`(드라이버 미보고, "지워짐"으로 처리) 세 갈래를 유닛 테스트가 모두 다룸(`integrations.service.spec.ts` 신규 두 테스트). e2e 는 실제 PG 락으로 겹침을 만들어 `[204, 404]` + 감사 1건을 검증. `raced` 공허성 가드(락 해제 전 두 요청이 아직 끝나지 않았음을 확인)까지 포함돼 fixture 가 실제로 경합을 만드는지 자체 검증.
3. **TODO/FIXME**: diff 전체에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 위 INFO 항목(주석 근거 stale) 외에는 함수명·주석·구현이 일치. 코드 주석이 "형제 넷과 처방이 다른 이유"(락 부재), "advisory lock 재도입이 아닌 이유"(HTTP 미개입), "remove→delete 전환이 동작을 바꾸지 않는 이유"(cascade/`@OneToMany` 부재, FK CASCADE 유지)를 모두 실측 근거와 함께 정확히 서술 — `rationale_continuity` checker 도 이 세 주장 전부 "이탈 없음"으로 확인(SUMMARY INFO#2,3,4).
5. **에러 시나리오**: 진 쪽 404(`RESOURCE_NOT_FOUND`), 사용처 있으면 409(`INTEGRATION_IN_USE`, 기존 유지), 존재 자체가 없으면 404 — 세 경로 모두 유닛/e2e 커버.
6. **데이터 유효성**: `delete({id, workspaceId})` criteria 가 workspace 격리를 유지(다른 workspace 의 동일 id 를 지우지 못함) — 기존 `findOne({where:{id, workspaceId}})` 와 동일 스코프.
7. **비즈니스 로직**: "동시 삭제 시 감사 행은 정확히 1건, 진 쪽은 404, broadcast/audit 은 이긴 쪽만" 이라는 비즈니스 규칙이 코드·유닛·e2e 세 층 모두에서 정확히 반영. `affected` 의 `0` 대 `null`/`undefined` 구분(드라이버 미보고 ≠ 미삭제)이라는 미묘한 규율도 대조군 테스트로 고정 — plan 이 스스로 지적한 형제 PR(#1371)의 뮤턴트 생존 이력(32건)에 대한 회귀 방지로 타당.
8. **반환값**: `remove(): Promise<void>` — 정상/진쪽 모두 예외 또는 `undefined` 로 귀결, 누락 경로 없음.
9. **spec fidelity**: 관련 spec은 `spec/2-navigation/4-integration.md`(§9.1 DELETE, Rationale advisory lock 기각 근거) — 코드 주석이 인용한 Rationale 문구("lock 보유 중 HTTP 요청" 기각 사유, L1494 부근 `cafe24-token-refresh` advisory lock 배제 근거)가 실제 spec 본문과 일치함을 확인했다. §9.1 DELETE 의 동시성 서술 부재는 위 INFO 항목 참고 — 이미 처리 경로가 있어 CRITICAL 대상 아님.

## 검증 뮤테이션

저장소에 어떠한 쓰기도 하지 않았고(전 과정 `Read`/`Bash cat`/`git log`/`git blame`/`git show` 만 사용), `git status --short` 로 사전 상태와 동일함을 확인함 — 원복 불필요.

## 요약

`IntegrationsService.remove()` 의 동시 DELETE 중복 감사 결함을 형제 PR(#1369~#1371)과 동형의 원자적 `delete().affected` 판정으로 정확히 closes 했다. 유닛 테스트가 `affected===0`(진 쪽 404) 과 `affected===null/undefined`(정상 삭제 유지) 두 갈래를 대조군으로 고정했고, e2e 가 실제 PG 행 락으로 경합을 재현해 `[204,404]` + 감사 1건을 검증한다. 코드 주석은 spec Rationale 인용까지 정확하다. spec 본문(`4-integration.md` §9.1)에 동시 삭제 404 서술이 아직 없는 갭은 이미 트래커에 등재·비차단 처리됐고, 발견된 유일한 흠은 인접 주석 한 곳의 stale 근거 문장(기능에는 영향 없음)이다.

## 위험도

NONE
