---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# workflow-list — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현/불일치 항목 추적.
> 관련 spec: spec/2-navigation/1-workflow-list.md

## 미구현 항목
- [ ] 정렬 UI 부재 (§2.4): 클라이언트에 정렬 드롭다운/컨트롤이 없다. 클라이언트가 `sort`/`order` 를 보내지 않아 항상 서버 기본(생성일 내림차순)으로 고정된다.
- [ ] "마지막 실행순" 정렬 미지원 (§2.4): 서버 `getSortColumn` (workflows.service.ts:646-653) 에 `last_run` 매핑이 없다. created_at/updated_at/name 만 허용.
- [ ] 태그 필터 UI 부재 (§2.3): 서버는 `?tag=` 를 지원하나 클라이언트에 태그 필터 UI 가 없다 (테이블 뱃지 표시만).
- [ ] 폴더 필터 UI 부재 (§2.3): 서버는 `?folderId=` 를 지원하나 클라이언트에 폴더 필터 UI 가 없다.
- [ ] 빈 상태 마켓플레이스 템플릿 추천 링크 부재 (§2.7).

## 코드 버그 (구현 수정 필요)
- [x] 상태 필터 파라미터 불일치 (§2.3): — 수정 완료 확인 (page.tsx 가 `?status=active|inactive` 송신, 2026-06-10 impl-prep 검토에서 검증). spec §2.3 경고 문구도 동일 시점 현행화.

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings 참조.
- 테이블 컬럼(§2.1)·더보기 메뉴(§2.6)·ASCII 목업(§1)은 코드 현실에 맞게 spec 본문을 이미 정정함(별도 구현 불필요).
