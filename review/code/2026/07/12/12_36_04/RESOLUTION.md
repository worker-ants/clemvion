# RESOLUTION — embed-config Cache-Control TTL 문서 단일 진실화

리뷰 세션: `review/code/2026/07/12/12_36_04` · base: `origin/main` · impl commit: `0d47e3b3f`

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 | 위치 |
|---|---|---|---|---|
| WARNING 1 | documentation | 인라인 주석 `짧게(5분)` 리터럴 잔존 → 드리프트 | 주석을 `EMBED_CONFIG_CACHE_SEC 초` 상수 지목으로 교체(리터럴 제거) | `hooks.controller.ts:89` |
| WARNING 2 | maintainability | `EMBED_CONFIG_CACHE_MAX_MIN` 네이밍 모호(`_MIN`=minimum 컨벤션 충돌) | `EMBED_CONFIG_CACHE_MAX_MINUTES` 로 개명(3개 사용처 일괄) | `hooks.controller.ts:44,62,79` |
| INFO (testing) | testing | 헤더 단언이 `stringContaining('max-age')` 로 느슨 — SoT 회귀 미포착 | 정확값 `'public, max-age=300'` 단언으로 강화 | `hooks.controller.spec.ts:56` |

> 조치는 본 REVIEW WORKFLOW 커밋(`refactor(hooks): ai-review WARNING 반영`)에 포함.
> 그 외 INFO(security NONE·scope·side_effect·문자열 결합 스타일)는 조치 불필요로 판단(SUMMARY 참조).

### disk-write gap 복구 기록

workflow 반환 시 `security`/`maintainability`/`testing` output 파일이 디스크에 없어(PR #901 패턴)
최초 요약이 4/7 리뷰어·WARNING=1 로 오집계됨. `journal.jsonl`(wf_62c80b6c-072)에서 3개 리뷰어 전문을
복원 → 세션 dir 에 `security.md`/`maintainability.md`/`testing.md` 재작성, SUMMARY.md 를 7/7·WARNING=2 로
정정. 재실행 없이 저널 복구로 커버리지 확보(maintainability WARNING 이 이 복구로 드러남).

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | 통과 (prettier 줄바꿈 1건 fix 후) — 잔존 warning 109건은 선존재(`migrate-node-output-refs.ts` 등), 본 변경 무관 |
| unit | 통과 (backend 33 · 강화된 헤더 단언 포함) |
| build | 통과 |
| e2e | 통과 (backend 253 passed) — 최초 실행은 Docker VM 디스크 부족(`initdb: No space left`)으로 인프라 실패 → `docker builder prune -af`(44GB 회수) 후 재실행 통과 |

## 보류·후속 항목

없음. Swagger 문자열 자체를 `SwaggerModule.createDocument()` 로 렌더 검증하는 테스트 부재는
기존 코드베이스 관행(PR #904 에서도 DTO 스키마에 동일 갭 지적)의 연장이며 본 변경이 신규 도입한 리스크 아님 — INFO 로 남김.
