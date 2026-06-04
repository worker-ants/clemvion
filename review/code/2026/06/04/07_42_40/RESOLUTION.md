# Resolution — KB quality 최종 ai-review (current HEAD, 2026-06-04 07:42:40)

PR 직전 현재 HEAD 전체(merge-base `e79956ad..HEAD`)에 대한 3차(최종) 리뷰. **CRITICAL=0, WARNING=6.** 1차 false-Critical(base 발산) 재발 없음.

## WARNING 처리

| # | 발견 | 조치 |
|---|---|---|
| 1 | `node-cancellation.md §5.1` WS 앵커가 `execution.node.cancelled`(실제 §4.1 정의)가 아니라 §4.4(waiting_for_input)를 가리킴 | **수정 (doc)** — §7/R-CC-16 과 동일 "번호 보존·retopic" 함정. node.cancelled 는 WS §4.1 실행 이벤트 표(line 174)에 정의 → `#41-실행-이벤트-server--client` 로 교정. (다른 §4.4 fix 10건은 ai_message/user_message 상세라 §4.4 가 정타 — 유지) |
| 2 | spec-impl-evidence §4 "5건" vs §4.0 카운트 경계 모호 | **수정 (doc)** — 제목 "frontmatter-evidence 5건" + 경계 명시 blockquote 추가 |
| 6 | trigger-list §7.1/§7.3 링크 텍스트가 섹션 내용 미노출 | **수정 (doc)** — `[Spec EIA §7.1 (Trigger 엔티티 확장)]`·`[§7.3 (InteractionToken)]` 병기 |
| 3 | Gate C `enforced` 빈 배열 vacuous | **이미 완화** — `isGateCEnforced`/`hasValidSpecImpact` 합성 단위 테스트 11건이 로직을 직접 검증(리뷰 INFO#7 인정). `enforced.length>0` 단언은 현재 정당하게 0 이라 추가 불가; 실 plan 픽스처를 `complete/` 에 심는 것은 실제 plan 디렉터리 오염이라 지양. 미래 cutoff 이후 완료 plan 부터 per-plan 경로 활성 |
| 4 | `findBrokenLinks` silent 0-return | **이미 커버** — sanity `it` 이 `spec/` 존재 + `files.length>100` + `0-overview.md` 포함을 별도 단언. 0개면 그 테스트가 실패하므로 false-green 불가. 내부 throw-guard 는 중복이라 보류 |
| 5 | area-index `spec/conventions` 면제 미검증 | **수용(optional)** — 면제는 실증적으로 동작(conventions 17개 파일 미flag). 명시 assertion 은 저가치 hardening — 후속 |

## INFO (조치 불요/범위 외)
- 앵커 30여 건 전수 정합, 상대경로·영역맵 정확 (INFO 1·2·3·5·6·7) — 확인됨.
- 2-navigation 맵 `0-dashboard.md` 미포함: `0-` index 문서라 sibling 아님 → 정상 제외.
- `node-cancellation.md` L106 `../../spec/5-system/`: pre-existing, 실제 resolve 됨(repo-root 기준). 비관용적이나 미파손 — 별도 작업.
- `inGeneratedCatalog` 단위 테스트(INFO#8): catalog 면제 통합 테스트(`spec-link-integrity` excludes 단언)로 간접 커버. 파라미터 단위 테스트는 후속 optional.

## 재검증
- 본 RESOLUTION 의 수정은 **spec/ 문서 한정**(codebase 무변경) → 07_42_40 리뷰(CRITICAL=0)가 전 codebase 변경을 계속 커버.
- link-integrity·area-index 36 tests green (신규 §4.1 앵커 resolve 확인).
