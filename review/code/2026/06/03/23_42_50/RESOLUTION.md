# Resolution — KB quality ai-review (2026-06-03 23:42:50 세션)

## 요약

첫 리뷰는 **잘못된 diff base**(`--branch main`, 로컬 `main`=e79956ad 이 `origin/main`=1161775f 보다 뒤처짐)로 실행돼, origin/main 이 이미 삭제한 파일들을 "본 브랜치의 삭제"로 오인했다. 본 브랜치의 **실제 codebase 변경은 신규 테스트 5파일(+640줄, 삭제 0)** 뿐이다(`git diff $(git merge-base origin/main HEAD)..HEAD -- 'codebase/**'`).

## Critical 3건 — 전부 FALSE POSITIVE (base 발산 artifact)

| # | 리뷰 주장 | 판정 |
|---|---|---|
| 1 | `text-chunker.spec.ts` baseMetadata 테스트 삭제 | FP — 해당 파일은 본 워크트리에 **존재하지 않음**(origin/main 에서 이미 제거됨). 본 브랜치 무관 |
| 2 | `md.parser.spec.ts`/`pdf.parser.spec.ts` 삭제 | FP — 동일. origin/main 의 변경을 base 오류로 오귀속 |
| 3 | `embedding.service.spec.ts` multi-segment 테스트 삭제 | FP — 동일 |

→ 삭제로 표시된 파일들을 **복원하지 않는다**(본 브랜치가 삭제한 게 아니며, origin/main 의 정당한 상태). resolution-applier 자동 fix 미적용 — 수동 triage.

WARNING #3·#4·#5(expression/summaryTemplate/NodeSettingsPanel 테스트 삭제)도 동일 base-artifact FP.

## WARNING — 진짜 발견, 수정 완료

| # | 발견 | 조치 |
|---|---|---|
| 2 (req) | `14-external-interaction-api.md` R-CC-16 앵커에서 `render_` 언더스코어 누락 (`render-` ≠ 실제 `render_-`) | **본 PR 이 도입한 regression**. item1 anchor 수정 스크립트의 hand-rolled slugger 가 `render_*` 의 lone `_`(+구두점)를 잘못 제거. 앵커 복구 + slugger 교체(아래) |
| 1 (req) | `15-chat-channel.md` CCH-SE-01 표시텍스트 `§3.4.2` (앵커는 §4.2 정확) | 표시텍스트 `§4.2` 로 수정 |
| 6 (test) | 신규 4 테스트 FS 의존 — repoRoot 오해소 시 vacuous pass | 각 테스트에 `spec/`·`plan/` 디렉터리 존재 단언 + 파일수 하한 상향 |

### 근본 수정 — slugger 교체

hand-rolled slug 정규식이 실제 렌더러(`rehype-slug` = remark/mdast + github-slugger)와 `render_*` 같은 edge case 에서 어긋났다. 가드와 수정 스크립트가 **같은 버그를 공유**해 self-consistent 하게 통과(가드 green 이지만 실제 렌더러에서 깨짐). `spec-links.ts` 의 slug 계산을 **실제 라이브러리**(`mdast-util-from-markdown` → `mdast-util-to-string` → `github-slugger`)로 교체 → 렌더러와 1:1 동등. 교체 후 전체 spec 재스윕: 깨진 앵커 **1건(R-CC-16)만** 잔존 → 수정 완료, 그 외 모든 앵커(§4.4 `executionwaiting_for_input` 11건 포함)는 실제 기준으로 정합 확인.

## 기타 (INFO / 범위 외)

- INFO·Maintainability 제안(앵커 수동관리 CI, slug 길이, plan rename 체크리스트)은 본 PR 이 이미 도입한 `spec-link-integrity.test.ts` 가드가 핵심을 충족. 잔여는 후속.
- Presentation 노드 6→5 / Integration 3종 등 Documentation INFO 는 origin/main 변경(base artifact) 관련 — 본 브랜치 무관.

## 재검증

- docs 테스트 17파일 **1791 tests green**.
- 실제 base(`origin/main..HEAD`) 재리뷰 수행.
