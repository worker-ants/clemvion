# Resolution — trigger endpoint_path UUID 강제(W1) + 만료 초대 pruner(W7) (review 21_37_31)

**원 리뷰**: RISK=MEDIUM, Critical=0, Warning=8, SPEC-DRIFT=1, INFO=15. MEDIUM 은 W1 의 **의도된**
breaking change(endpoint_path UUID 강제) 때문이며 결함이 아니다. 아래대로 처리.

## SPEC-DRIFT

### SD-1 — 12-workspace.md §3.1 stale (pruner 미구현 서술) → ✅ FIXED
- §1.2 는 갱신했으나 §3.1 "Expired 의 실제 수명" 문단이 "프로덕션 호출자 없어 영구 잔존 / 정리 job 미구현" 으로 잔존.
- 조치: §3.1 을 `WorkspaceInvitationsPrunerService`(04:00 KST, BullMQ)가 주기 삭제하는 것으로 갱신.

## WARNING

### W1 — API Breaking Change (endpoint_path UUID 강제) → ⚠ ACCEPTED (의도된 본 변경의 목적)
- 본 PR 의 핵심 목적(W1 보안 fix) 자체다. 영향: (a) **frontend 는 이미 `crypto.randomUUID()` 사용**
  (triggers/page.tsx·use-web-chat.ts — 검증함) → 정상 경로 무영향. (b) **기존 DB row 는 재검증되지 않음**
  (DTO 는 신규 create/update 요청만 검증) → 기존 트리거 동작 유지. 따라서 마이그레이션 불요.
- e2e 의 HTTP-POST 생성기(webhook-trigger·chat-channel-trigger-create)를 v4 UUID 로 정합화해 CI 회귀 방지.

### W2 — 클라이언트 UUID 엔트로피 미검증 → ✅ FIXED (spec 강화)
- 서버는 v4 형식만 강제하고 RNG 품질은 검증 불가. 단, endpoint_path 는 워크스페이스 무관 전역 UNIQUE 라
  저엔트로피 제출은 **자기 webhook 비밀성만 약화**(타 테넌트 영향 없음).
- 조치: `12-webhook.md` WH-SC-01 에 "반드시 CSPRNG(`crypto.randomUUID()`) 로 발급, 약한 RNG·고정값 금지" 명문화.

### W3 — UpdateTriggerDto Leaky Abstraction (endpointPath 수락하나 service 거부) → ⚠ ACCEPTED (pre-existing, deferred)
- 본 변경 이전부터 존재한 구조(나는 검증만 `@IsUUID('4')` 로 강화). DTO description 에 "생성 후 변경은 service
  가 거부" 명시돼 있음. 리뷰도 "minor 버전 사이클 처리 권장" → 본 PR 범위(W1 형식 강제) 밖. 필드 제거/명시적
  예외코드는 후속 트랙.

### W4 — Redis 장애 시 부팅 차단(onModuleInit throw) → ⚠ ACCEPTED (established pattern)
- `login-history-pruner` 와 **동일한 의도된 fail-fast** (그 서비스의 spec 도 "Redis 장애 시 부팅 거부" 를
  테스트로 고정). 일관성 위해 동일 채택. soft-fail 전환은 두 pruner 공통 정책 변경이라 별도 결정 사항.

### W5 — UpdateTriggerDto 유효 UUID 통과 케이스 부재 → ✅ FIXED
- `trigger-dto-validation.spec.ts` 에 "UpdateTriggerDto — 유효한 v4 UUID 통과" 회귀 가드 추가.

### W6 — upsertJobScheduler opts(removeOnComplete/Fail) 미검증 → ✅ FIXED
- pruner spec 의 onModuleInit 테스트에 `opts.removeOnComplete/removeOnFail` retention 검증 추가.

### W7 / W8 — 테스트 중복 상수(baseCreate↔baseTrigger, VALIDATE_OPTIONS↔VALIDATE_OPTS) → ⚠ ACCEPTED (pre-existing)
- 둘 다 본 변경 이전부터 존재한 `trigger-dto-validation.spec.ts` 의 중복. 본 PR(W1/W7) 범위 밖 정리이며
  대규모 기존 테스트 파일 리팩토링은 별도 위생 트랙. 기능 영향 없음.

## INFO (선별 처리)
- **#12** (pruner process()/prune() JSDoc 부재) → ✅ FIXED: 두 메서드에 JSDoc 추가.
- 나머지 INFO(트리거 타입 SOT 상수화 / DB CHECK constraint / audit 보존 / 스케줄 시각 spec 명기 /
  v5 UUID 거부 케이스 / e2e 400 케이스 / 시간 상수 공유화 / languageHints XSS(기존) 등)은 **백로그/선택**
  으로 본 PR 미적용 — 기능·보안 회귀 없음. languageHints XSS(INFO#1)는 본 변경과 무관한 pre-existing.

## 검증 (fix 후)
- backend unit: trigger-dto-validation + workspace-invitations-pruner 71 pass, triggers/hooks/workspaces 16 suites 316 pass.
- eslint·build green. e2e 는 DB/Redis infra 부재로 본 샌드박스 미실행(endpoint_path 생성기 UUID 정합화로 CI 회귀 방지).
- fix 커버 fresh `/ai-review` 1회 추가 수행(stale-review push BLOCK 회피).
