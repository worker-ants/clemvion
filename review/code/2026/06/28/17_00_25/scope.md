# 변경 범위(Scope) 리뷰

리뷰 대상 커밋: `d7eacd0c5` — `refactor(hooks): webhook 하드닝 후속 — extractClientIp 모듈경계·fail-open 알람·4xx 메시지 sanitize`

커밋 메시지에 명시된 의도:
- **W4**: `extractClientIp` export 제거 → 공유 코어 `extractClientIpFromHeaders` 직접 호출 + 테스트 이관
- **W2**: Guard DB 장애 fail-open 로그 `warn→error` 격상
- **W1**: `GlobalExceptionFilter.mapHttpErrorLike` 4xx 메시지 echo 제거 (CWE-209)

---

## 발견사항

### [INFO] `client-ip.spec.ts` — 신규 테스트 케이스 추가 (의도 내)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts`, 추가 라인 39–369
- **상세**: 2개의 테스트 케이스(`empty/whitespace cf-connecting-ip → falls back to XFF`, `whitespace-only XFF → null`)가 추가됨. W4 의도("헤더 추출 엣지 케이스 테스트는 client-ip.spec 으로 이관")와 직접 대응하며, `public-webhook-throttle.guard.spec.ts` 에서 삭제된 `extractClientIp` 엣지 케이스 테스트 4건 중 2건이 이관된 것. 나머지 2건(`XFF 다중 IP 첫 번째`, `헤더 모두 없음 → undefined`)은 공유 코어의 기존 테스트가 이미 커버하므로 비중복 이관이 맞다.
- **제안**: 해당 없음.

### [INFO] `http-exception.filter.spec.ts` — 테스트 강화 (의도 내)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts`, diff 라인 36–40
- **상세**: 기존 단언 `expect(bodyOf(json).error.code).toBe('PAYLOAD_TOO_LARGE')` 에 CWE-209 관련 단언 2개가 추가됨(`message` 가 원본 메시지를 echo 하지 않는다). W1 구현의 검증 코드로 범위 내.
- **제안**: 해당 없음.

### [INFO] `review/consistency/...` 디렉터리 파일 다수 포함
- **위치**: `review/consistency/2026/06/28/16_50_18/` 하위 8개 파일
- **상세**: consistency check 결과물(SUMMARY.md, 5종 checker 산출, `_retry_state.json`, `meta.json`)이 커밋에 포함됨. CLAUDE.md 규약 상 리뷰 산출물은 `review/` 하위에 커밋됨이 정책이며, 커밋 메시지에서 "impl-prep BLOCK:NO" 를 기록·증거로 남기는 것은 developer SKILL 의무 사항(pr push 전 impl-prep 검증 증거 커밋). 내용은 현재 PR 대상 코드와 무관한 `spec/5-system/` 검토이나, 이는 구현 착수 직전 consistency-check 의무 수행 결과물이므로 동일 커밋에 포함됨이 프로젝트 워크플로 내에서 허용된다.
- **제안**: 해당 없음.

---

## 요약

5개 코드 파일 변경은 커밋 메시지에 명시된 W1·W2·W4 세 항목 모두와 1:1 대응하며, 각 변경이 선언된 의도(CWE-209 메시지 sanitize, fail-open 로그 레벨 격상, extractClientIp export 제거·공유 코어 직접 호출)에 정확히 국한된다. 불필요한 리팩토링, 기능 추가, 무관한 파일 수정, 포맷팅 노이즈는 없다. 테스트 이관은 삭제-대응-추가로 대칭 처리됐으며, `review/consistency/` 파일 포함은 프로젝트 규약상 impl-prep 검증 증거 커밋으로 의도된 패턴이다.

## 위험도

NONE
