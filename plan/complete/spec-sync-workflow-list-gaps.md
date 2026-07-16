---
worktree: fe-tag-filter-283723
started: 2026-06-03
owner: planner
---

# workflow-list — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현/불일치 항목 추적.
> 관련 spec: spec/2-navigation/1-workflow-list.md
>
> **종결 (2026-07-17 grooming)**: audit 등재 5건 중 4건 구현 완료(정렬 UI·마지막 실행순 정렬·태그 필터·폴더 필터) + 코드 버그 1건 수정 완료. 마지막 1건(§2.7 빈 상태 마켓플레이스 링크)은 **마켓플레이스 로드맵 종속**이라 본 plan 이 닫을 수 없어 [`marketplace-and-plugin-sdk.md` Phase A](../in-progress/marketplace-and-plugin-sdk.md) 로 **소유권 이관** → 잔여 0. `1-workflow-list.md` 의 `pending_plans` 도 그 plan 으로 재배선(`status: partial` 유지).
>
> **⚠ 발견 — 본 plan scope 밖의 고아 Planned 표면 2건**: `1-workflow-list.md` 에는 본 plan 이 추적하지 **않는** 미구현 표면이 더 있다 — **L61**(별도 "트리거 요약" 컬럼 · "노드 수" 컬럼 · "마지막 *실행*" 시각 컬럼), **L152**(export/import `formatVersion` 포맷 버전 협상 — DTO 는 선언하나 구현이 emit·수용 안 함). 전수 grep 결과 **이 2건을 추적하는 plan 이 존재하지 않는다**(고아). 본 plan 은 2026-06-03 audit 이 잡은 항목만 다뤘고 이 둘은 그 대상이 아니었으므로 여기서 처분하지 않는다. 다만 `1-workflow-list.md` 가 `implemented` 로 승격되면 **거짓**이 되므로, `pending_plans` 재배선으로 `partial` 을 유지하는 것이 이 2건에 대해서도 정직하다. 이 고아 2건은 사용자 판단 필요(별 plan 신설 vs won't-do vs 방치).

## 미구현 항목

> **구현 진척 (2026-06-14, impl-workflow-list-gaps PR)**: 정렬(§2.4) 풀스택 — backend last_run subquery +
> frontend 정렬 드롭다운. 태그·폴더 필터 UI(§2.3)·빈 상태 마켓플레이스 링크(§2.7)는 추가 frontend(서버는
> ?tag=/?folderId= 이미 지원)로 별도 PR.
> **구현 진척 (2026-07-06, FE-2)**: 폴더 필터 UI(§2.3) frontend 완료. 남은 잔여 = 태그 필터 UI(§2.3, spec 멀티선택
> vs 서버 단일 `?tag=` 결정 필요)·빈 상태 마켓플레이스 링크(§2.7, 마켓플레이스 라우트 부재) — planner 트랙.
> **구현 진척 (2026-07-06, FE 태그필터)**: 태그 필터 UI(§2.3)를 **단일 free-text** 로 확정·구현(사용자 결정: 멀티 대신 downscope).
> spec §2.3 태그 행 하향(멀티→단일)+Rationale §4 신설, §2.3 폴더 행·§3.1 SPEC-DRIFT 동시 현행화(아래 planner 후속 해소).
> 남은 잔여 = 빈 상태 마켓플레이스 링크(§2.7, 마켓플레이스 라우트 부재) — planner 트랙.
> **planner 후속(SPEC-DRIFT) — 해소됨(2026-07-06)**: 폴더 필터 구현으로 낡았던 §2.3 폴더 행·§3.1 안내문을
> 태그 필터 PR 에서 함께 현행화함.

- [x] 정렬 UI (§2.4): frontend 정렬 드롭다운(`NativeSelect`, page.tsx) — 최신 생성순(기본)/최근 수정순/이름순/마지막 실행순. 기본 외 옵션에 `sort`/`order` 송신, page 리셋·resetFilters 연동, i18n(ko/en `workflows.sort.*`).
- [x] "마지막 실행순" 정렬 (§2.4): backend `findAll` 이 `last_run` 시 `execution` 테이블의 워크플로별 `MAX(started_at)` correlated subquery 로 정렬(미실행 `NULLS LAST`, 고정 문자열 — injection 안전). 테스트(last_run/기본/injection 폴백) 추가.
- [x] 태그 필터 UI 부재 (§2.3): frontend 단일 태그 free-text 입력(page.tsx, 검색과 동일 debounce·page 리셋·resetFilters 연동, i18n `workflows.tagFilter.*`). 입력 시 `?tag=` 단일값 송신, 서버 `= ANY(tags)` 매칭 기존 지원. spec §2.3 멀티→단일 하향(Rationale §4). (fe-tag-filter-283723)
- [x] 폴더 필터 UI 부재 (§2.3): frontend 폴더 `NativeSelect`(page.tsx, `foldersApi.list()`→`GET /folders`, 폴더 존재 시에만 렌더) — 선택 시 `?folderId=` 송신·page 리셋·resetFilters 연동, i18n(ko/en `workflows.folderFilter.*`). 서버는 `?folderId=`(query-workflow.dto + `w.folder_id` andWhere) 기존 지원. (FE-2, fe2-workflow-list-filters-08493f)
- [x] 빈 상태 마켓플레이스 템플릿 추천 링크 (§2.7) — ~~**frontend 잔여**. 별도 PR.~~ **이관 완료 (2026-07-17)** → [`marketplace-and-plugin-sdk.md` Phase A](../in-progress/marketplace-and-plugin-sdk.md). 본 항목은 **마켓플레이스 로드맵에 100% 종속**이라 본 plan 이 독립적으로 닫을 수 없다 — 실측: `/marketplace` 라우트(frontend), marketplace 모듈(backend) 모두 **부재**이므로 링크할 대상 자체가 없다. 소유권을 실제 책임 plan 으로 옮기고 본 plan 은 종결한다(이중 추적 해소).

## 코드 버그 (구현 수정 필요)
- [x] 상태 필터 파라미터 불일치 (§2.3): — 수정 완료 확인 (page.tsx 가 `?status=active|inactive` 송신, 2026-06-10 impl-prep 검토에서 검증). spec §2.3 경고 문구도 동일 시점 현행화.

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings 참조.
- 테이블 컬럼(§2.1)·더보기 메뉴(§2.6)·ASCII 목업(§1)은 코드 현실에 맞게 spec 본문을 이미 정정함(별도 구현 불필요).
