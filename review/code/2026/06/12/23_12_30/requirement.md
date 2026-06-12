# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] spec §3.6 CCH-NF-03 — 구현 완전히 반영됨 (이전 SPEC-DRIFT 해소)
- 위치: `spec/5-system/15-chat-channel.md` line 112
- 상세: 이전 라운드(22_49_12)에서 SPEC-DRIFT로 지적된 "미구현 (Planned)" 문구, §5.5 rate-limit 행 누락, R-CC-19 미존재 3건이 모두 해소됐다. 현재 spec은 CCH-NF-03에 per-chat fixed-window 구현 완료·R-CC-19 Rationale·§5.5 rate-limit 행·data-flow §14를 모두 포함한다. SPEC-DRIFT 없음.
- 제안: 없음.

### [INFO] enforcement 위치 — spec 과 코드 일치
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` line 271–286; spec §3.6 CCH-NF-03 구현 주석
- 상세: spec CCH-NF-03 구현 설명("parseUpdate 직후 한도 초과 시 … 단락")과 코드(`parseUpdate` 직후, `enrichInbound` 이전 블록)가 일치한다. 이전 라운드에서 지적된 "enrichInbound 이후 배치" 문제가 수정됐음을 확인.
- 제안: 없음.

### [INFO] 원자성 — INCR + EXPIRE(NX) 단일 pipeline 확인
- 위치: `chat-channel-rate-limiter.service.ts` line 63–66
- 상세: `pipeline.incr(key)` + `pipeline.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC, 'NX')` 가 동일 pipeline에 묶여 `pipeline.exec()` 1회로 실행된다. 이전 라운드에서 지적된 "INCR 후 별도 EXPIRE 호출 → 크래시 시 TTL 미설정 키 영구 잔류" race가 해소됐다.
- 제안: 없음.

### [INFO] XSS 방어 — chatChannelLastError 에 외부 입력 미포함
- 위치: `hooks.service.ts` line 864
- 상세: `markChatChannelRateLimited`의 `chatChannelLastError` 값이 `Inbound rate limit exceeded (${limitPerMinute}/min)` 형태로 `limitPerMinute`(수치 상수)만 포함하고 `conversationKey`(외부 입력)를 포함하지 않는다. 이전 라운드 보안 WARNING이 해소됐다.
- 제안: 없음.

### [INFO] limit clamp (0/음수/초과 방어) 구현 확인
- 위치: `chat-channel-rate-limiter.service.ts` line 57; 테스트 line 49–54
- 상세: `Math.max(1, Math.min(600, Math.floor(limitPerMinute) || 60))` 로 [1, 600] 범위 clamp가 `consume` 내부에서 수행된다. spec-draft 요구 범위 1–600이 코드에 반영돼 있다.
- 제안: 없음.

### [INFO] 테스트 커버리지 — 이전 라운드 WARNING 6건 모두 해소
- 위치: `chat-channel-rate-limiter.service.spec.ts` (9 케이스); `hooks.service.spec.ts` (4 rate-limit 케이스)
- 상세: 이전 라운드에서 WARNING으로 지적된 테스트 갭(exec null·빈배열 fail-open, incrErr fail-open, 이미 degraded → update 미호출, degraded DB 실패 swallow, lastError 내용 assertion, incr 키 assertion)이 모두 추가됐다. 구체적으로:
  - `exec null → fail-open(true)` (spec.ts line 61)
  - `exec 빈 배열 → fail-open(true)` (spec.ts line 67)
  - `INCR 결과 에러(incrErr non-null) → fail-open(true)` (spec.ts line 73)
  - `한도 이내 → INCR·EXPIRE 키 assertion` (spec.ts line 26)
  - `이미 degraded → update 미호출` (hooks.spec.ts line 661)
  - `DB 실패해도 ignored 반환` (hooks.spec.ts line 683)
  - `chatChannelLastError '60/min' 포함 assertion` (hooks.spec.ts line 651–657)
- 제안: 없음.

### [INFO] spec-draft worktree 슬러그 — 수정 확인
- 위치: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` frontmatter
- 상세: 이전 라운드 지적(`worktree: chat-channel-rate-limit` 슬러그 누락)이 `worktree: chat-channel-rate-limit-baa15a`로 수정됐다.
- 제안: 없음.

### [INFO] rateLimitPerMinute override 경로 — unit 테스트 미추가 (이전 INFO 잔여)
- 위치: `hooks.service.spec.ts` line 701–727 (consume 호출 검증); `spec-draft` §결정 "1–600 override"
- 상세: `config.rateLimitPerMinute`가 기본 60이 아닌 값(예: 30)으로 설정됐을 때 해당 값이 `consume`에 전달되는지 검증하는 테스트가 여전히 없다. 현재 테스트는 `consume(triggerId, 'chat-789', 60)` 만 검증한다. spec-draft가 `rateLimitPerMinute` 1–600 override를 정의하므로 이 경로가 무검증 상태다.
- 제안: `chatChannelTrigger.config.chatChannel.rateLimitPerMinute = 30`을 포함한 fixture로 `consume(triggerId, conversationKey, 30)` 호출을 검증하는 케이스 추가.

---

## 요약

CCH-NF-03 per-chat Redis fixed-window rate-limit 구현은 이전 리뷰 라운드(22_49_12)의 모든 실질 WARNING(원자성·enforcement 배치·clamp·XSS·테스트 갭 6건)과 SPEC-DRIFT 4건을 해소한 상태다. 현재 코드는 spec §3.6 CCH-NF-03 요구사항(per-chat fixed-window, 기본 60/분, skip+degraded, fail-open, 자동 비활성화 금지), §5.5 inbound 계약 표, R-CC-19 Rationale과 line-level로 일치한다. 기능 완전성·에러 시나리오(fail-open 3경로)·경계값(count===limit)·데이터 유효성(clamp)·반환값(모든 경로 boolean/void 반환)이 모두 충족된다. 잔여 관찰은 `rateLimitPerMinute` override 값에 대한 단위 테스트 미추가(INFO) 1건으로, 기능 회귀보다는 커버리지 완결성 관점의 비차단 권장 사항이다.

## 위험도

LOW

STATUS: SUCCESS
