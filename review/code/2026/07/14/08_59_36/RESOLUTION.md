# RESOLUTION — @nestjs/swagger 핀 제거 (§2) 리뷰 처분

세션: `review/code/2026/07/14/08_59_36` (ai-review, 4 reviewer) + `review/consistency/2026/07/14/09_01_06` (--impl-done, 5 checker)
구현 커밋: `3f1df0dcd` · 0 Critical / 1 Warning / consistency BLOCK: NO

## 조치 항목

| # | 출처 | 등급 | 처분 |
|---|---|---|---|
| 1 | dependency | WARNING | 커밋 메시지 "lockfile churn=swagger 뿐" 부정확 → **기록 정정**. 동반된 js-yaml/nanoid/picomatch/postcss/@napi-rs 등 patch bump 은 pnpm 이 lockfile 재생성 시 overrides(picomatch·next>postcss)를 latest-satisfying 으로 재평가하는 불가피한 특성이며 benign(신규 top-level·major 없음, 253 e2e 통과, origin/main 미포함분). swagger-only 는 수동 lockfile 편집 없인 불가 → 테스트된 lockfile(`3f1df0dcd`) 유지. plan §2·본 RESOLUTION·리뷰 SUMMARY 에 정확히 재기술. **base 2 commit behind → PR 전 rebase 시 lockfile 정합 재확인.** |
| 2 | plan_coherence | INFO | plan §2 본문 완료 주석 미반영 → **갱신 완료**(2026-07-14 완료 블록). |
| 3 | dependency | INFO | `type SchemaObject` shim 3파일 중복 → 테스트 파일 self-contained 관례상 **수용**(export/import 시 상대경로 fragility 대비 이득 낮음). |
| 4 | dependency | INFO | `gray-matter → js-yaml@3.14.2` moderate CVE 잔존(본 diff 무관, 프런트 전이) → plan §4 "js-yaml 추적" 백로그에 이미 포함. |
| 5 | convention_compliance / documentation | INFO | swagger.md 에 deep-import 회피 원칙 명문화 → 선택(코드 JSDoc 이미 사유 기록, eslint no-restricted-imports 가 더 효과적) → **미조치**. |

code fix 없음(핵심 변경은 검증 완료·건전). WARNING 은 사실 기록 정정으로 처분, 나머지 INFO 는 수용/백로그/선택.

## TEST 결과

- **lint**: 통과
- **unit**: 통과 (14 suites)
- **build**: 통과 (docker 위생 스모크 포함)
- **e2e**: 통과 (253/253, 44 suites — swagger 11.4.5 runtime). DTO 스키마 회귀 가드 3 suites/28 tests 별도 통과(createDocument 출력 불변). 리뷰 후 lockfile·코드 변경 없음 → 재수행 불요.

## consistency (--impl-done)

**BLOCK: NO** — 5 checker(cross_spec·rationale_continuity·convention_compliance·plan_coherence·naming_collision) 전부 Critical 0. spec 연결 코드(external-interaction DTO spec·common/swagger)가 spec 본문·conventions·Rationale·plan 과 충돌 없음. SUMMARY: `review/consistency/2026/07/14/09_01_06/SUMMARY.md`.

## 보류·후속 항목

- **PR 전 origin/main rebase**(base 2 commit behind) — rebase 후 lockfile 정합/충돌 재확인.
- gray-matter js-yaml CVE·의존성 거버넌스 CI 가드 — plan §4 백로그.
