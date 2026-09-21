# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 전 reviewer(11명, forced 7명 전원 포함) 결과 확보 완료. 발견사항은 전부 INFO 수준(주석 정밀도·테스트 보강 여지·기존 관례 재확인)이며 이번 PR을 막을 결함은 없음.

> **병합 전 확인 필요 (security 리뷰 관측)**: 이번 리뷰 세션 도중 워킹트리에 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 의 **미커밋 뮤테이션**(`if (affected === 0) ...` → `if (!affected) ...`, 본 PR 이 고치는 결함을 정확히 되돌리는 형태)이 떠 있는 것이 관측됐다. 이 세션이 만든 변경이 아니며(diff 는 `affected === 0` 정상 코드 기준으로 평가), 병렬 세션의 뮤테이션 테스트 잔재로 추정된다. **병합 직전 반드시 `git status`/`git diff` 로 이 파일이 의도한 `affected === 0` 상태로 커밋돼 있는지 재확인할 것** — 그렇지 않으면 이번 PR 이 고치려는 이중 감사 로그 결함이 그대로 살아남는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `remove()` 주석·CHANGELOG가 "저장소 전체 ORM lifecycle hook 0건"이라 서술하나 문자 그대로는 부정확(무관한 `User` 엔티티에 `@BeforeInsert` 존재). 전환 안전성 근거로 실제 필요한 remove 계열 훅은 검증대로 0건이라 결론엔 영향 없음 | `auth-configs.service.ts:319-320`, `CHANGELOG.md` | 조치 불요. 여유 있으면 "AuthConfig 관련 remove/soft-remove 훅·subscriber 0건"으로 표현 좁히기 |
| 2 | Scope | `CHANGELOG.md`에 이번 PR과 무관한 별도 PR(#1373)의 문서 부채 backfill 항목이 포함됨(출처는 항목 제목·RESOLUTION.md에 명시적으로 disclosed) | `CHANGELOG.md:46-90` | 조치 불요 — 출처 공개 관행 유지 |
| 3 | Side Effect / Testing | 유닛 테스트 mock `delete()`가 `workspaceId`를 무시하고 `id`만으로 삭제를 시뮬레이션 — cross-tenant negative 테스트는 이 모듈 전체(`create`/`findById`/`update`/`remove`)에 부재. 호출 인자 형태는 단언되나 실제 격리 동작은 mock으로 검증 불가 | `auth-configs.service.spec.ts:48-51` | 조치 불요(직전 라운드 유보 확정). 여유 있으면 모듈 전체 단위로 cross-tenant negative 테스트 1건 추가 검토 |
| 4 | Maintainability | 동시-삭제 e2e 스펙 계열이 7번째 인스턴스로 늘며 구조적 보일러플레이트(DB 커넥션 관리·race 헬퍼·공허성 가드·정렬 판정)가 계속 반복됨 | `auth-config-delete-concurrency.e2e-spec.ts` 전체 | 8·9번째(model-config/webauthn) 시점에 `test/helpers/concurrency.ts` 류 공용 헬퍼 추출 권장 |
| 5 | Maintainability / API Contract | 신규 `throwAuthConfigNotFound()`(404 `RESOURCE_NOT_FOUND`)와 `triggers.service.ts`의 `AUTH_CONFIG_NOT_FOUND`(400)가 이름이 근접 — JSDoc으로 이미 명시적으로 구분·완화됨 | `auth-configs.service.ts` `throwAuthConfigNotFound` 정의부 | 조치 불요 — 이미 완화됨 |
| 6 | Documentation | 코드에 영구히 남는 주석이 세션-스코프 리뷰 발견 번호("리뷰 INFO 1")를 인용 — 세션 식별자 없이는 다음 세션도 같은 번호를 재사용하므로 시간이 지나면 참조가 모호해짐 | `auth-configs.service.ts:302` | 세션 참조 없이 근거 자체만 남기거나 plan 체크리스트로 인용 이전 권장(차단 아님) |
| 7 | Documentation | `_resolution_log.md`의 타임스탬프가 파일 내 등장 순서와 어긋남(lint/unit/build, e2e 시작 줄이 앞뒤보다 이른 시각) — 결론 수치는 정확해 실질 오도는 없음 | `review/code/2026/09/21/15_18_16/_resolution_log.md` (7~11번째 줄) | 하네스 로그 포맷 개선 시 타임스탬프 정렬 고려(차단 아님) |
| 8 | Database / Concurrency | 뒤이은 `delete()`의 `affected === 0` 판정만으로 이미 404 처리가 가능해, 선행 `findById` SELECT가 기능적으로 겹치며 왕복 쿼리 1회를 추가함 — 의도된 fail-fast 계약("대상 없으면 DELETE 미시도")이며 회귀 테스트로 고정됨 | `auth-configs.service.ts:306`(findById), `:323-327`(delete+판정) | 조치 불요 — 의도된 트레이드오프 |
| 9 | Database | `DELETE` 실행과 `recordAudit` 기록이 단일 트랜잭션으로 묶이지 않음 — 이 저장소의 기존 best-effort 감사 계약(형제 PR #1369~#1373과 동일)이며 신규 리스크 아님 | `auth-configs.service.ts:323-334` | 현행 계약 유지, 조치 불요 |
| 10 | Concurrency / Testing | e2e 공허성 가드(`Promise.race`)의 `setTimeout(() => resolve('pending'), 1_500)` 핸들이 `clearTimeout`되지 않음 — 판정 결과엔 영향 없고 `--detectOpenHandles` 노이즈 수준 | `auth-config-delete-concurrency.e2e-spec.ts:88-93` | 우선순위 낮음, 다음 e2e 계열 정리 시 함께 처리 |
| 11 | Maintainability | `CHANGELOG.md` 서사(항목당 40~90줄)와 `plan/in-progress/authconfig-dup-delete.md`가 상당 부분 중복 — 향후 한쪽만 갱신되면 서술이 갈라질 여지 | `CHANGELOG.md`(3~101행), `plan/in-progress/authconfig-dup-delete.md` | 형제 PR 4건과 동일 컨벤션, 조치 불요. 여유 있으면 CHANGELOG를 plan 요약 인용 형태로 통일 검토 |
| 12 | Side Effect | `remove(entity)` → `delete(criteria)` 전환이 TypeORM 라이프사이클 훅/구독자를 우회 — 현재 `AuthConfig`엔티티·저장소 전체에 해당 훅 0건임을 재검증해 무해하나, 향후 훅 추가 시 조용히 우회되는 잠재 드리프트 | `auth-configs.service.ts:323`(delete 호출) | 조치 불요(주석으로 이미 문서화). 향후 훅 추가 시 이 delete() 호출부 동반 재검토 권장 |
| 13 | Security | 신규 추가된 리뷰/consistency-check 산출물(markdown·JSON 다수)에 하드코딩 시크릿·자격증명·PII 없음(패턴 검색 결과 실값 매칭 0건) | `review/code/2026/09/21/15_18_16/**`, `review/consistency/2026/09/21/14_41_01/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 로직 변경 없음(1차 라운드 이후 문서/주석/mock/e2e 필터만); 워크스페이스 스코프·`affected===0`·에러메시지·파라미터화 전부 정상. 워킹트리 미커밋 뮤테이션 관측(상단 경고 참고) |
| requirement | NONE | spec fidelity(404 코드·204·FK cascade·§1.11 등) 전부 line-level 일치; 직전 라운드 WARNING1+INFO5 전건 반영 확인. ORM hook 서술 스코프만 근소 부정확(#1) |
| scope | LOW | 핵심 코드 변경은 목표에 정확히 대응; CHANGELOG #1373 backfill(#2)만 스코프 경계 근접이나 disclosed |
| side_effect | LOW | 공개 시그니처·전역상태·FS·env·네트워크 부작용 없음; lifecycle hook 우회(#12)·mock workspaceId 미검증(#3)은 INFO |
| maintainability | LOW | 형제 PR과 형태 일치, 직전 라운드 지적 실제 정리 확인; 주석밀도/e2e 반복/이름근접/CHANGELOG-plan 중복은 전부 INFO(#4,#5,#11) |
| testing | LOW | 회귀 4건+뮤턴트 2종 직접 재현 검증(대조군 2건 RED·진쪽 1건 RED); mock workspaceId(#3)·setTimeout(#10)만 잔존 INFO |
| documentation | LOW | 직전 WARNING1+INFO5 전건 정확 반영 확인; 세션-로컬 번호 인용(#6)·resolution log 순서(#7)만 INFO |
| database | LOW | 원자적 DELETE, PK/인덱스 활용, 파라미터화, cascade/hook 무영향 전부 확인; 선행 SELECT 왕복(#8)·비트랜잭션 감사(#9)는 기존 계약 |
| concurrency | LOW | TOCTOU 수정 검증(Postgres 행 락 직렬화), 데드락 없음, async/await 정상; 선행 findById(#8 중복)·setTimeout(#10 중복)만 INFO |
| api_contract | NONE | URL/상태코드/응답스키마/인가 조건 하위호환 유지, 오히려 workspaceId 명시로 격리 강화; 이름근접(#5 중복)만 재확인 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

- **user_guide_sync** — 매칭 trigger 0건, 유저 가이드 동반 갱신 의무 없음(해당 없음)

## 권장 조치사항

1. **병합 직전** `git status`/`git diff`로 `auth-configs.service.ts`가 의도한 `affected === 0` 상태로 커밋돼 있는지 재확인(워킹트리에 관측된 미커밋 뮤테이션이 실수로 반영되지 않도록)
2. (선택) `remove()` 주석·CHANGELOG의 "저장소 전체 ORM lifecycle hook 0건" 표현을 "AuthConfig 관련 remove/soft-remove 훅·subscriber 0건"으로 좁혀 정확히 하기
3. (백로그) 8·9번째 동시성 e2e 스펙(model-config/webauthn) 작성 시 공용 헬퍼(`raceTwoRequests`+공허성 가드+`clearTimeout`) 추출
4. (백로그) auth-configs 모듈 전체 단위로 cross-tenant negative 테스트(다른 workspaceId로 조회/삭제 불가) 최소 1건 추가 검토

## 라우터 결정

`routing_status=done` (router 가 선별):

- **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
- **제외**: 아래 표 (3명)
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단(사유 미제공) — backend 단건 삭제 경로, 성능 민감 변경 아님으로 추정 |
| architecture | 라우터 판단(사유 미제공) — 기존 서비스 내부 구현 교체, 구조적 변경 아님으로 추정 |
| dependency | 라우터 판단(사유 미제공) — 신규 의존성 추가 없음으로 추정 |
