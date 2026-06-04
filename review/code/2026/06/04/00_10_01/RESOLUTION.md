# Resolution — KB quality ai-review 재실행 (올바른 base, 2026-06-04 00:10:01)

첫 리뷰(2026-06-03 23:42)가 base 발산(로컬 main < 전진한 origin/main)으로 false Critical 을 낸 뒤, 올바른 base(`merge-base e79956ad..HEAD`, 90파일 +1927/-153)로 재실행.

## 결과: RISK=LOW, CRITICAL=0, WARNING=9

base artifact 삭제 없음 — 첫 리뷰 Critical 3건이 base 오류였음을 확정.

## WARNING 처리

| # | 발견 | 조치 |
|---|---|---|
| 1 | Gate C `enforced` 배열 비어 vacuous pass 가능 | **수정** — `isGateCEnforced`/`hasValidSpecImpact` 순수 함수 추출 + 합성 데이터 enforcement 로직 테스트 추가(cutoff 전후·none/없음·실존/dangling/empty path). 실제 plan 0건이어도 로직 검증됨 |
| 2 | `findBrokenLinks` silent 0-return 위험 | **커버됨** — sanity 테스트가 `spec/` 존재 + `files.length>100` + `0-overview.md` 포함 + catalog 면제 비자명성을 별도 `it` 으로 단언. spec 미checkout 시 그 테스트가 실패하므로 false-green 불가 |
| 3 | area-index vacuous | **수정** — `spec/5-system` area 의 siblings>10 단언 추가 |
| 4 | plan-frontmatter sanity 약함 | **수정** — 알려진 plan(`knowledge-base-quality-improvements.md`) 존재 단언 추가 |
| 5 | catalog 면제 정규식 단위 테스트 부재 | **수정** — catalog 디렉터리 실재 + 면제 결과(`-api-catalog/` 미포함) 단언 테스트 추가 |
| 6 | `2-trigger-list.md` `#7-데이터-모델` 앵커 의미 불일치 | **수정** — §7 이 "시크릿 회전"→"데이터 모델" 로 retopic 된 케이스. 번호매칭 fix(내 item1) 가 의미 부정확했음. rotate-secret/grace → §7.1 Trigger 엔티티 확장(rotation 컬럼·24h grace), revoke-token → §7.3 InteractionToken 으로 정밀 repoint + 표시텍스트 §7.1/§7.3 정합 |
| 7 | `node-cancellation.md` `../../spec/5-system/` 경로 | **범위 외** — pre-existing, 경로는 실제 resolve 됨(repo-root 기준 정합). 비관용적이나 깨지지 않음. 별도 작업 |
| 8 | `15-chat-channel.md` 중복 `3.1` heading | **범위 외** — 기능적으로 앵커 정확(첫 occurrence). heading 번호 정리는 planner 영역 |
| 9 | spec-impl-evidence §4 "5건" vs Gate D advisory 모호 | **수정** — §4 제목 "(5건, 모두 build 차단)" + §4.0 "위 5건과 별개" 명시, Gate D "advisory — build 차단 아님" 강조 |

## 재검증

- docs 테스트 17파일 **1796 tests green** (Gate C 로직 + catalog 면제 테스트 추가).
- eslint 변경 파일 0 error.
