# RESOLUTION — 22_03_15 (증분 리뷰: fix 커밋 74d312cf 범위)

리뷰 세션 `review/code/2026/06/11/22_03_15/` (range `ccb5f38f..HEAD` — resolution-applier fix + spec 반영).
위험도 **MEDIUM · Critical 0 · Warning 4 · INFO 다수**. Critical 0 이나 Warning 처분을 위해 본 RESOLUTION 으로 종결.

> 본 PR 의 리뷰 체인: `21_33_46`(전체 branch, HIGH→fix) → `74d312cf`(resolution-applier) → **`22_03_15`(증분, MEDIUM/0C/4W)**.
> 동시 `--impl-done` (`review/consistency/2026/06/11/22_04_01/`) = **BLOCK: NO**.

## Warning 처분

| # | 카테고리 | 처분 | 근거 |
| --- | --- | --- | --- |
| W1 | 요구사항 | **후속 분리** | `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts INTERNAL_CODES` 미등재 → chat-channel 어댑터에서 unknown-fallback. **단 fallback 분기도 `executionFailedInternal` 을 반환**(chat-channel-adapter §3.1 "그 외 모든 code → executionFailedInternal")하므로 **사용자 대면 동작은 정상** — 차이는 CCH-ERR-04 warn 로그 1줄뿐. spec §3.2 의 `CODE_MEMORY_LIMIT → executionFailedInternal` 계약은 (fallback 경유라도) 충족. 코드 노드 보안 전환 범위 밖의 noise-log 정리라 `code-node-isolated-vm-followups.md` 로 분리. |
| W2 | 보안 | **수용(선재)** | `$helpers.crypto.hash` 의 md5/sha1 허용은 본 PR 이전부터 존재한 `ALLOWED_HASH_ALGORITHMS` — isolated-vm 전환과 무관. spec §2.2 가 "md5/sha256 등" 으로 이미 비암호학 용도를 함의. 비암호학 용도 명시 강화는 후속. |
| W3 | 보안 | **수용(선재·spec정합)** | `exposeStack = NODE_ENV !== 'production'` 은 기존 핸들러 로직 그대로(미변경) + spec §5.3 "`NODE_ENV !== 'production'` 일 때만 노출" 과 정합. 배포 시 `NODE_ENV=production` 전제는 production-guards(별 PR) 영역. |
| W4 | 유지보수성 | **수용(후속)** | `execute()` ~160줄/다단계 — 헬퍼 분리는 선택적 리팩터(기능 무관). 후속 백로그. |

## INFO 처분 (요약)
- **INFO#6/#7 (SPEC-DRIFT, §4 래핑 패턴·라인 오프셋)**: spec §4 step2 가 outer IIFE 형태만 기술 — 실제는 inner `__user` 중첩. 본 RESOLUTION 동반 spec 미세 보정 대신 후속 plan 에 기록(코드 정확, spec 표현 추상화 수준). 일부는 `--impl-done` I4/I5 와 중복.
- **INFO#5 (W14 주석 +4 vs 실제 +3)**: wrapUserCode 헤더가 3줄이라 오프셋은 +3 이 정확 — 후속 주석 정정.
- **INFO#8 (LEGACY_TO_NORMALIZED freeze), #9(테스트명), #10(상수 위치), #17/#22(fallthrough 기본값)**: maintainability/robustness 미세 항목 — 후속 일괄.
- **INFO#13/#14/#15/#16 (테스트 보강: warn/error 캡처·null 케이스·syntaxIsolate 재생성)**: 현 단위/통합이 핵심 경로 커버. 후속 보강.
- 나머지 보안 INFO(b64 비문자열 일관성·메모리 env·알고리즘 길이 truncate): 후속.

## `--impl-done` (22_04_01) WARNING 교차 처분
- **W5 (04-security C-2 `[ ]`), W7 (0-overview §5 node:vm 잔존)**: **main-baseline FALSE POSITIVE**. 실제 파일은 이미 수정·커밋됨 — `grep` 반증: `04-security.md:41` = `[x] ✅ 사용자 결정 완료`, `0-overview.md:298` = `isolated-vm(V8 Isolate)`. checker 가 `--diff-base origin/main` 의 옛 내용을 읽은 것(reference_consistency_check_main_baseline_fp 패턴).
- **W1 (동일 classifier)**: 위 W1 과 동일 — 후속.
- **W2 (classifyError 동명 private 메서드 혼동)**: cafe24/makeshop provider 의 `private classifyError` 와 스코프 분리(모듈 export vs private) — 실제 충돌 없음. `@internal`/rename 은 후속.
- **W3/W4/W6/I* (spec 표현·타 plan stale)**: 문서 정리 수준, BLOCK 아님 — 후속 plan.

## TEST 결과 (74d312cf 기준)
- lint ✅ · unit ✅ (backend 6617) · build ✅ · e2e ✅ (188, resolution-applier 수행 — alpine isolated-vm).

## 보류·후속 (→ `plan/in-progress/code-node-isolated-vm-followups.md`)
W1(classifier 등재) · execute() 헬퍼 분리 · spec §4 래핑/오프셋 정확화 · md5/sha1 비암호학 명시 ·
b64 비문자열 일관성 · 메모리 env 추출 · per-exec dayjs snapshot 최적화 · 테스트 보강.
