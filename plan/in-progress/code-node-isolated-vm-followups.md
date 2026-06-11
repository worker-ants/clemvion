---
worktree: (unstarted)
started: 2026-06-11
owner: developer
---

# Follow-ups — code 노드 isolated-vm 전환 후속

> 출처: `code-node-isolated-vm` PR 의 ai-review(`review/code/2026/06/11/21_33_46`, `22_03_15`) +
> `--impl-done`(`review/consistency/2026/06/11/22_04_01`) 의 Warning/INFO 중 본 P0 범위 밖으로
> 분리한 항목. 본 PR 은 0 Critical · BLOCK:NO 로 종결했고, 아래는 noise-log·문서정확화·테스트보강·
> 선택적 리팩터 수준(기능·보안 영향 없음).

## 코드

- [ ] **W1 — `CODE_MEMORY_LIMIT` classifier 등재**: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `INTERNAL_CODES` Set 에 `'CODE_MEMORY_LIMIT'` 추가 (`spec/conventions/chat-channel-adapter.md §3.2` executionFailedInternal 과 일치). 현재도 unknown-fallback 이 동일하게 `executionFailedInternal` 반환하므로 UX 정상 — 차이는 CCH-ERR-04 warn 로그 제거뿐. `§3.1` 분류 표에도 명시.
- [ ] **W2 — `classifyError` 명명/마커**: `code.handler.ts` export `classifyError` → `classifyCodeNodeError` rename(또는 `@internal` JSDoc). cafe24/makeshop provider 의 동명 private 메서드와 전역검색 혼동 완화.
- [ ] **INFO — `LEGACY_TO_NORMALIZED` fallthrough**: `?? errorCode` → `?? 'CODE_EXECUTION_FAILED'` 기본값(미상 내부코드 공개API 노출 방지). `Object.freeze`/`as const satisfies` 적용. 모듈 상수 선언을 파일 상단으로 이동. `RE_*` regex 모듈 상수화(이미 일부 적용).
- [ ] **W4 — `execute()` 헬퍼 분리**: `_buildIsolateContext()` / `_runWithTimeout()` 추출 (오케스트레이션만 남김). 기능 무관 가독성.
- [ ] **INFO — `$helpers.base64` 비문자열 일관성**: `__host_b64encode/decode` 에 `typeof !== 'string'` TypeError(hostHash 와 일관). 단 현 silent-string 은 spec §2.2 NOTE 로 문서화된 의도 — 변경 시 spec 동반.
- [ ] **INFO — 메모리 한도 env**: `ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` env(안전 상한 ≤512MB). backend-labels 메시지의 `128MB` 와 sync.
- [ ] **성능 — per-exec dayjs 재컴파일 제거**: `ivm.Isolate.createSnapshot()` 로 dayjs+부트스트랩 정적부 1회 스냅샷 → 동시 실행 다수 시 컴파일 오버헤드 제거. (plan 본문 기인지.)

## 테스트
- [ ] `classifyCodeNodeError` null/undefined 케이스, `console.warn`/`console.error` 캡처(`[warn]`/`[error]` prefix), `syntaxIsolate` disposed 재생성 경로, `$vars` copy-out 실패 fallback 직접 검증.
- [ ] 메모리 초과 통합 테스트 CI flakiness 완화(`jest.retryTimes` 또는 `@slow` 분리).

## Spec (planner)
- [x] **§4 step2/step6 정확화**: step2 래핑을 실제 2-단(outer async IIFE + inner `__user`, isolate 경계 JSON 직렬화) 으로, step6 `$vars` 동기화를 "격리 환경 최종 `$vars` 읽어 전체 교체, copy-out 실패 시 varsClone fallback" 으로. **(완료, PR spec-errcode-catalog 그룹2a)**
- [x] **런타임 에러 라인 오프셋**: §4 또는 §2 에 "런타임 에러 라인 = 래퍼 헤더 3줄 오프셋" 명시. **(완료, 그룹2a — +3 명시)**. ⚠ **code 후속(별도 code PR)**: `code.handler.ts` `wrapUserCode` 의 W14 주석이 "4-line header / offset +4 / subtract 4" 로 적혀 있으나 실제 헤더는 3줄 → 오프셋 **+3** 이 맞음. 주석 off-by-one 버그 — 그룹3(code/test) 또는 별도 code PR 에서 +3 으로 수정.
- [x] **§5.3.1/§5.3.2/§5.3.3 예시 정합**: §5.3.1 stack 예시에 "비프로덕션 한정" 보조노트, §5.3.3 `meta.durationMs` 추가. **(완료, 그룹2a)**. (§5.3.2 stack 플레이스홀더 `"..."` 는 cosmetic 으로 보류.)
- [x] **md5/sha1 비암호학 명시**: §2.2 에 "md5/sha1 은 체크섬·레거시 호환 전용, 암호학적 용도 금지" 1줄. **(완료, 그룹2a — 허용 알고리즘 목록 + ⚠ 경고)**
- [ ] **§3-error-handling §1.4 EXECUTION_TIMEOUT 계층**: 엔진 수준 표의 `EXECUTION_TIMEOUT` 을 "내부 legacyCode — public `CODE_TIMEOUT`(node-level `error` 포트)" 로 보강. `14-external-interaction-api §547` 동반. **(보류 — 엔진레벨 EXECUTION_TIMEOUT/EXECUTION_TIME_LIMIT_EXCEEDED 계층화는 별개 영역. 그룹2a 는 internal-legacy 매핑을 error-codes.md §3.1 에 등재하는 것으로 부분 충족.)**

## 타 plan/worktree 정리 (머지 후)
- [ ] `plan/in-progress/node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` "로드맵 미구현" 서술 → "구현 완료(isolated-vm PR)".
- [ ] `plan/in-progress/marketplace-and-plugin-sdk.md` 샌드박싱 항목 → "code 노드 isolated-vm 기도입, 재사용 검토".
- [ ] user-docs 충돌 주의: 타 worktree(`fix-model-configs-kind-400-*` 등)에 구버전 `data.mdx` 에러코드 잔존 — 머지 시 신규 코드로 동기화.
