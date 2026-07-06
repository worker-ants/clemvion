---
worktree: fe2-workflow-list-filters-08493f
started: 2026-06-03
owner: planner
---

# workflow-list — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현/불일치 항목 추적.
> 관련 spec: spec/2-navigation/1-workflow-list.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-workflow-list-gaps PR)**: 정렬(§2.4) 풀스택 — backend last_run subquery +
> frontend 정렬 드롭다운. 태그·폴더 필터 UI(§2.3)·빈 상태 마켓플레이스 링크(§2.7)는 추가 frontend(서버는
> ?tag=/?folderId= 이미 지원)로 별도 PR.
> **구현 진척 (2026-07-06, FE-2)**: 폴더 필터 UI(§2.3) frontend 완료. 남은 잔여 = 태그 필터 UI(§2.3, spec 멀티선택
> vs 서버 단일 `?tag=` 결정 필요)·빈 상태 마켓플레이스 링크(§2.7, 마켓플레이스 라우트 부재) — planner 트랙.
> **planner 후속(SPEC-DRIFT)**: 폴더 필터 구현으로 §2.3 폴더 필터 행 및 §3.1 "프론트엔드는 아직 소비하지 않는다"
> 류 안내문이 낡음. spec 본문 현행화 필요(코드는 정합, 문구만). ai-review requirement 리뷰어 지적(2026-07-06).

- [x] 정렬 UI (§2.4): frontend 정렬 드롭다운(`NativeSelect`, page.tsx) — 최신 생성순(기본)/최근 수정순/이름순/마지막 실행순. 기본 외 옵션에 `sort`/`order` 송신, page 리셋·resetFilters 연동, i18n(ko/en `workflows.sort.*`).
- [x] "마지막 실행순" 정렬 (§2.4): backend `findAll` 이 `last_run` 시 `execution` 테이블의 워크플로별 `MAX(started_at)` correlated subquery 로 정렬(미실행 `NULLS LAST`, 고정 문자열 — injection 안전). 테스트(last_run/기본/injection 폴백) 추가.
- [ ] 태그 필터 UI 부재 (§2.3): 서버 `?tag=` 지원, **frontend 잔여**(태그 멀티 선택 UI). 별도 PR.
- [x] 폴더 필터 UI 부재 (§2.3): frontend 폴더 `NativeSelect`(page.tsx, `foldersApi.list()`→`GET /folders`, 폴더 존재 시에만 렌더) — 선택 시 `?folderId=` 송신·page 리셋·resetFilters 연동, i18n(ko/en `workflows.folderFilter.*`). 서버는 `?folderId=`(query-workflow.dto + `w.folder_id` andWhere) 기존 지원. (FE-2, fe2-workflow-list-filters-08493f)
- [ ] 빈 상태 마켓플레이스 템플릿 추천 링크 (§2.7) — **frontend 잔여**. 별도 PR.

## 코드 버그 (구현 수정 필요)
- [x] 상태 필터 파라미터 불일치 (§2.3): — 수정 완료 확인 (page.tsx 가 `?status=active|inactive` 송신, 2026-06-10 impl-prep 검토에서 검증). spec §2.3 경고 문구도 동일 시점 현행화.

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings 참조.
- 테이블 컬럼(§2.1)·더보기 메뉴(§2.6)·ASCII 목업(§1)은 코드 현실에 맞게 spec 본문을 이미 정정함(별도 구현 불필요).
