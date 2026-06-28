# 변경 범위(Scope) 리뷰

리뷰 대상: 24개 파일 (코드 5개 + review 산출물 19개)
리뷰 일시: 2026-06-28

이번 변경의 선언된 의도 (RESOLUTION 17_00_25 기준):
- **W1 (Warning 해소)**: `GlobalExceptionFilter.mapHttpErrorLike` 비-413 4xx 분기 테스트 추가 (CWE-209 메시지 단언 포함)
- **I15 (Info 해소)**: 4xx http-error `logger.warn` 호출 검증 단언 추가
- **I16 (Info 해소)**: fail-open `logger.error` 1회 호출 단언 추가
- **I17 (Info 해소)**: `mapHttpErrorLike` JSDoc 에 CWE-209 명시 한 줄 추가
- **SPEC-DRIFT 해소**: `3-error-handling.md §1.3` 및 `12-webhook.md §6` spec 갱신
- **리뷰 산출물**: 이전 세션(17_00_25) RESOLUTION.md, SUMMARY.md, 각 reviewer 결과, 메타 파일

---

## 발견사항

### [INFO] `http-exception.filter.spec.ts` — 비-413 4xx 테스트 케이스 추가 (의도 내)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` diff 라인 51-68
- 상세: `{ status: 400 }` 케이스를 `catch()` 에 전달해 `body.error.message === 'The request could not be processed.'` 및 `Logger.prototype.warn` 호출을 단언하는 테스트가 추가됐다. W1·I15·I16 해소 의도와 1:1 대응하는 변경이다. 기존 413 테스트에 CWE-209 관련 단언(`not.toBe`·`toBe`) 2개도 추가됐으며 W1 의도 범위 내다.
- 제안: 해당 없음.

### [INFO] `http-exception.filter.ts` — JSDoc 한 줄 추가 + 메시지 sanitize 로직 (의도 내)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` diff 라인 90-113
- 상세: JSDoc 에 CWE-209 방지 문구 한 줄 추가(I17 해소)와 `mapHttpErrorLike` 반환 `message` 를 sanitized 고정 문구로 교체한 구현이 포함됐다. 이 구현 변경은 이전 커밋의 것이며, 이번 변경에서는 기존 구현에 대한 테스트 보강과 JSDoc 동기화만 이루어졌다. 변경이 선언된 의도(W1·I17) 범위에 국한된다.
- 제안: 해당 없음.

### [INFO] `public-webhook-throttle.guard.spec.ts` — fail-open `logger.error` 단언 추가 및 `extractClientIp` 임포트 제거 (의도 내)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` diff 전체
- 상세: I16 해소를 위해 fail-open 테스트에 `Logger.prototype.error` spy 단언이 추가됐다. `extractClientIp` 임포트 제거 및 관련 테스트 4건 삭제는 이전 커밋(extractClientIp 래퍼 제거)의 후속 정리로, 이 커밋의 RESOLUTION 범위(I7 확인·완료)에 명시된 항목이다. 이관 주석 추가도 같은 맥락에서 의도된 변경이다.
- 제안: 해당 없음.

### [INFO] `client-ip.spec.ts` — whitespace 엣지 케이스 테스트 추가 (의도 내)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` diff 라인 133-145
- 상세: 빈 문자열/공백 `cf-connecting-ip` → XFF 폴백, 공백만 있는 XFF → null 반환 테스트 2건이 추가됐다. `extractClientIp` 이관의 일환으로 이전 리뷰(17_00_25 scope 리뷰)에서 "W4 의도와 직접 대응"으로 확인된 변경이며, RESOLUTION 에 별도 언급 없이 기존 커밋 포함된 항목이다. 테스트 내용도 공유 코어 동작 검증에 한정돼 있어 범위 이탈 없음.
- 제안: 해당 없음.

### [INFO] `public-webhook-throttle.guard.ts` — `extractClientIp` 래퍼 제거 및 로그 레벨 격상 (이전 커밋, 범위 내)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` diff 전체
- 상세: 이번 변경 세트의 핵심 구현 변경(W2: `warn → error` 격상, W4: `extractClientIp` 제거)이다. 해당 변경은 커밋 메시지 및 RESOLUTION 에서 명시적으로 선언된 의도이며, 변경이 해당 메서드 내부에만 국한된다. 그 외 무관한 메서드·클래스 수정 없음.
- 제안: 해당 없음.

### [INFO] `review/code/2026/06/28/17_00_25/` 하위 산출물 파일들 — 워크플로 규약 내 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/code/2026/06/28/17_00_25/` (RESOLUTION.md, SUMMARY.md, security.md, maintainability.md, documentation.md, testing.md, requirement.md, scope.md, side_effect.md, meta.json, _retry_state.json)
- 상세: 이전 리뷰 세션(17_00_25)의 각 reviewer 산출물과 SUMMARY, RESOLUTION 이 커밋에 포함됐다. CLAUDE.md 규약상 `review/` 산출물은 커밋 대상이며 `developer SKILL` 의 pr push 전 impl-prep 검증 증거 커밋 의무에 해당한다. 모두 신규 생성(new file) 파일이며 기존 파일 무관한 수정 없음.
- 제안: 해당 없음.

### [INFO] `review/consistency/2026/06/28/16_50_18/` 하위 산출물 파일들 — 워크플로 규약 내 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/consistency/2026/06/28/16_50_18/` (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: 구현 착수 전 `--impl-prep` consistency check 결과물이며 이전 scope 리뷰(17_00_25)에서 "프로젝트 워크플로 내에서 허용"으로 확인된 패턴이다. 모두 신규 파일이며 불필요한 기존 파일 수정 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경 세트의 5개 코드 파일 변경은 전부 RESOLUTION(17_00_25)에 명시된 W1·I15·I16·I17 해소 항목 및 extractClientIp 이관(W4 완료 확인)에 1:1 대응한다. 불필요한 리팩토링, 요청하지 않은 기능 추가, 무관한 파일·영역 수정, 의미 없는 포맷팅 변경은 발견되지 않았다. 주석 추가(인라인 CWE-209 설명·이관 근거)와 임포트 정리(`extractClientIp` 제거)도 모두 선언된 의도의 직접적 후속으로 범위 내다. 리뷰 및 consistency check 산출물 포함은 프로젝트 규약(CLAUDE.md)에 의한 의무 사항이다.

## 위험도

NONE
