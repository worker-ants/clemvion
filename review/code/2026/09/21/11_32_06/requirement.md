# 요구사항(Requirement) 리뷰 — integration-dup-delete (재검증, 11_32_06)

본 세션은 직전 리뷰(`review/code/2026/09/21/10_54_47`)의 Critical 0 · WARNING 3 · INFO 10 이 모두
조치(RESOLUTION.md, commit `74a9e714b`/`5bbdf753d`/`8504d52c0`)된 이후의 **재검증**이다. 핵심 구현
(`integrations.service.ts` `remove()`, `throwIntegrationNotFound()`, 유닛 테스트, e2e, CHANGELOG,
plan)을 `Read`/`grep`/`git log`/타입 정의 대조로 독립 재확인했다. 저장소에 쓰기는 하지 않았다
(`git status --short` 사전·사후 동일, `review/code/2026/09/21/11_32_06/` 신규 세션 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `spec/2-navigation/4-integration.md` §9.1 `DELETE /api/integrations/:id` 행에 "삭제
  (사용처 있으면 409)" 만 적혀 있고 "동시 삭제 시 진 쪽 404" 서술이 없다 — 회색지대(spec 침묵).
  - 위치: `spec/2-navigation/4-integration.md:814` (§9.1 표)
  - 상세: 신규 관측 가능 동작(경합 진 쪽 204→404)이 spec 본문에 아직 반영 안 됐다. 형제 PR
    (#1369~#1371)이 남긴 동일 갭이며, 이번 PR 이 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 트래커 스코프에 `4-integration.md §9` 를 명시적으로 추가해 등재한 것을 직접 확인했다(파일
    diff, `grep` 결과 해당 라인 실재). `--impl-prep` consistency-check(`review/consistency/2026/09/21/10_27_27`)도
    Critical 0 · 이 항목을 비차단 WARNING 으로 이미 처분.
  - 제안: 조치 불요 — spec 반영은 developer 권한 밖이며 이미 정식 등재·비차단 처리됨. `project-planner`
    가 다음 spec 라운드에서 §9.1·§9.4 를 갱신할 항목으로 남는다(SPEC-DRIFT 태그는 붙이지 않음 —
    코드가 spec 을 위반한 것이 아니라 spec 이 침묵하는 영역이고 처리 경로가 이미 있음).

- **[INFO]** 유닛 테스트 mock 셋업에 `remove: jest.fn().mockResolvedValue(undefined)` (spec.ts 신규
  `delete` mock 바로 옆)이 이제 어떤 테스트에서도 참조되지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — repo mock 정의부
    (`delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] })` 추가 직전 줄)
  - 상세: `grep -n "integrationRepo\.remove\b"` 결과 0건 — `remove()` 서비스 메서드가 완전히
    `delete()` 로 전환됐으므로 이 mock 은 현재 죽은 코드다. 기능에 영향 없음(vacuous 테스트가 아니라
    단순 미사용 fixture 필드).
  - 제안: 조치 불요(이번 PR 필수 아님). 다음 근접 편집에서 제거하면 mock 표면이 실제 repo 인터페이스와
    더 가까워진다.

## 점검 관점별 확인

1. **기능 완전성**: `remove()` 흐름이 `findOne`(무락 존재 확인, 404) → `queryUsageNodes`(409) →
   원자적 `delete({id, workspaceId})` → `affected===0` 이면 404 → 아니면 감사 기록 +
   `broadcastCredentialChange` 순서로 완결됨을 소스에서 직접 확인(`integrations.service.ts:737-817`
   대역). 형제 4경로(workflow/workspace/trigger/schedule)와 동일한 결함 클래스를 판별자만 다르게
   (원자적 `delete` affected, 락 없음) 닫는다는 plan 의 설계가 코드와 일치.
2. **엣지 케이스**: `affected===0`(진 쪽, 404·감사 없음) / `affected===1`(정상) /
   `affected===undefined`·`null`(드라이버 미보고, 정상 삭제로 처리) 세 갈래를 유닛 테스트 2건이
   커버. `DeleteResult.affected` 타입이 실제로 `number | null | undefined` (TypeORM
   `.../query-builder/result/DeleteResult.d.ts` 확인)라 이 엣지케이스가 근거 있는 방어임을 타입
   정의로 재확인했다. e2e 는 `SELECT id FROM integration WHERE id = $1 FOR UPDATE` 행 락으로 실제
   PG 경합을 만들고, 락 해제 전 "raced" 공허성 가드로 fixture 유효성을 자체 검증한다.
3. **TODO/FIXME**: diff 전체(`git diff origin/main...HEAD` 대상 3개 코드 파일) TODO/FIXME/HACK/XXX
   0건.
4. **의도와 구현 간 괴리**: 없음. 코드 주석의 세 핵심 주장을 개별 재검증했다 — (a) `Integration`
   엔티티에 `@OneToMany`/`cascade: true` 없음(`entity.ts` grep 0건), (b) 저장소 전체
   `@BeforeRemove`/`@AfterRemove`/`EntitySubscriberInterface` 0건(스코프 전체 grep), (c)
   `throwIntegrationNotFound()` 가 파일 전체 정확히 7곳(findById/update/remove×2/rotate×2/
   requireEntity)에서 재사용됨(grep 라인 602/740/769/803/1191/1219/1480). 모두 주장과 일치.
5. **에러 시나리오**: 진 쪽 404(`RESOURCE_NOT_FOUND`), 사용처 존재 시 409(`INTEGRATION_IN_USE`,
   변경 없음), 대상 부재 시 404 — 세 경로 모두 유닛+e2e 커버. conflict-path 회귀 테스트 2건
   (`:1173`,`:1195` 부근)이 직전 리뷰 WARNING #1 조치로 `expect(integrationRepo.delete).not
   .toHaveBeenCalled()` 로 교체되어 이제 실제 delete 미호출을 검증한다(수정 전엔 죽은 `remove` mock
   을 봐서 vacuous 했던 자리).
6. **데이터 유효성**: `delete({id, workspaceId})` criteria 가 `findOne` 과 동일한
   `(id, workspaceId)` 스코프라 workspace 격리 유지 — 타 workspace 소유 동일 id 는 매칭되지 않음.
7. **비즈니스 로직**: "경합 시 감사 행 정확히 1건·진 쪽 404·broadcast 는 이긴 쪽만" 규칙이 코드·유닛·
   e2e 세 층에서 일관되게 반영됨. `affected===0` **명시 비교** 규율은 형제
   `rewriteTriggerConfigLocked`/`schedules.service.ts` 와 동일 패턴(직접 grep 대조 확인)이며, 대조군
   테스트(undefined·null 두 값 루프, `:1097-1109`)가 `!affected` 로의 회귀를 막는 지점까지 실측
   확인됨(로직상 `!affected` 로 되돌리면 이 대조군의 `resolves.toBeUndefined()` 단언이 reject 로
   바뀌어 RED — 별도 뮤테이션 없이 정적으로도 성립).
8. **반환값**: `remove(): Promise<void>` — 모든 경로가 예외 또는 `undefined` 로 귀결, 누락 경로 없음.
9. **spec fidelity**: 관련 spec `spec/2-navigation/4-integration.md`. 코드 주석이 인용한 "advisory
   lock 기각 근거(«lock 보유 중 HTTP 요청»)"가 실제로는 §"BullMQ `cafe24-token-refresh` 큐" Rationale
   (`:1494` 부근, token-refresh race 맥락)에서 온 문구임을 원문 대조로 확인했다 — 코드 주석은 이
   문구를 **다른 문제(삭제 경합)에 그대로 재도입하는 것이 아님**을 설명하는 데 정확히 사용하고 있어
   인용이 왜곡되지 않았다. §9.1 DELETE 행의 동시성 서술 부재는 위 INFO 항목 참고(회색지대, 이미
   트래커 처리).

## 직전 리뷰(10_54_47) 조치 재검증

RESOLUTION.md 가 주장한 3건의 코드 조치를 소스에서 직접 재확인했다 — 모두 사실과 일치:

- WARNING #1(vacuous conflict-path 단언): `.spec.ts:1173`,`:1195` 부근 두 단언이
  `expect(integrationRepo.delete).not.toHaveBeenCalled()` 로 교체됨. `integrationRepo.remove` 참조는
  이제 spec 파일 전체에서 0건(위 INFO 참고 — mock 정의 자체는 남았으나 미사용).
- WARNING #2(헬퍼 미추출): `throwIntegrationNotFound(): never` 가 도입돼 7곳에서 재사용, 리터럴
  `RESOURCE_NOT_FOUND` 는 헬퍼 정의부 1곳뿐.
- WARNING #3(CHANGELOG 누락): `CHANGELOG.md` 최상단에 형제 4건과 동일한 3단 구성(문제→판별자→고친
  것) 항목이 추가돼 있음.

## 요약

`IntegrationsService.remove()` 의 동시 DELETE 중복 감사 결함을 형제 PR(#1369~#1371)과 동형의 원자적
`delete().affected` 판정으로 정확히 닫았고, 판정 근거(`DeleteResult.affected: number|null|undefined`
타입, `@OneToMany`/`cascade`/lifecycle-hook 부재)를 코드·주석·CHANGELOG 어디서나 확인 가능한 실측으로
뒷받침한다. 직전 리뷰의 Critical 0·WARNING 3 이 전부 코드로 조치됐고 재검증에서 조치 사실과 어긋나는
지점을 찾지 못했다. 남은 두 항목은 모두 INFO 수준(spec 침묵 회색지대 — 이미 트래커 등재·비차단;
미사용 mock 필드 — 순수 정리 대상)으로, 병합을 막을 사안이 없다.

## 위험도

NONE
