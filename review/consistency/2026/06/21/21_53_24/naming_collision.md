# 신규 식별자 충돌 검토

검토 대상: `spec/data-flow/2-auth.md` diff (email-change-followup 브랜치)  
검토 모드: --impl-done, scope=spec/5-system/, diff-base=origin/main

---

## 발견사항

### **[WARNING]** `SessionsService.verifyReauth` vs `SessionsService.reauthenticate` — 공개 메서드명 불일치

- **target 신규 식별자**: `SessionsService.reauthenticate`
  - `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` 라인 238
- **기존 사용처**: `SessionsService.verifyReauth`
  - `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` 라인 76, 508 (Rationale 1.1.B-4)
- **상세**: `spec/5-system/1-auth.md` Rationale 1.1.B-4 는 이메일 변경 재인증 구현 메서드를 `SessionsService.verifyReauth` 로 명시한다. 그러나 `verifyReauth` 는 `sessions.service.ts` 의 **private** 헬퍼이며, 외부에서 호출 가능한 공개 메서드는 `reauthenticate` 이다. target diff 에서 `SessionsService.reauthenticate` 를 사용한 것이 코드 사실과는 맞지만, 기존 auth spec 과 명칭이 다르다. 독자가 두 문서를 교차 참조 시 혼동할 수 있다.
- **제안**: `spec/5-system/1-auth.md` 의 Rationale 1.1.B-4 에서 `SessionsService.verifyReauth` → `SessionsService.reauthenticate` (공개 API) 로 정정하거나, 괄호로 `(내부적으로 verifyReauth 헬퍼 위임)` 를 추가해 두 이름이 같은 재인증 경로를 가리킴을 명시한다. 어느 쪽이든 두 spec 문서가 동일 메서드명을 사용하도록 통일 필요.

---

### **[INFO]** `clearPendingEmailChange` — spec 첫 등장, 기존 충돌 없음

- **target 신규 식별자**: `clearPendingEmailChange` (private 메서드, `auth.service.ts`)
  - `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` 라인 240
- **기존 사용처**: 없음 (spec 전체 grep 결과 0건)
- **상세**: 내부 롤백 헬퍼 이름이 data-flow spec 에 최초 등장한다. 코드(`auth.service.ts` 라인 977)와 일치하며 다른 spec 영역의 동명 식별자와 충돌 없음.
- **제안**: 충돌 없음. 필요 시 `spec/5-system/1-auth.md §1.1.B` 본문에도 "(롤백: `clearPendingEmailChange`)" 를 언급해 두 문서 간 일관성을 높일 수 있으나, data-flow spec 특성상 구현 세부 참조가 자연스러우므로 현재 수준에서도 무방하다.

---

### **[INFO]** `emailTakenByOther` + `LOWER(email)` (V101) — spec 첫 등장, 기존 충돌 없음

- **target 신규 식별자**: `emailTakenByOther` (method, `users.service.ts`), `LOWER(email)` 표현식 인덱스, 마이그레이션 `V101`
  - `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` 라인 269
- **기존 사용처**: spec 전역 grep 결과 0건. 코드에서 `users.service.ts` 에만 존재.
- **상세**: 세 식별자 모두 신규이며 기존 spec 내 동명 항목과 충돌 없음. V101 마이그레이션 파일은 워크트리 내에만 존재하고 main 브랜치의 최신 마이그레이션은 V100(`V100__add_email_change_fields.sql`)으로, 번호 연속성이 올바르다.
- **제안**: 충돌 없음. `spec/1-data-model.md` User 테이블 섹션에 `LOWER(email)` 인덱스 존재를 constraints/index 메모로 추가하면 data-model spec 의 완성도가 높아진다(현재 data-flow spec 에만 V101 언급).

---

### **[INFO]** 섹션 ID `§1.7.1` 신설 — 기존 충돌 없음

- **target 신규 식별자**: `#### 1.7.1 이메일 변경 ...` 섹션
  - `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` 라인 232
- **기존 사용처**: main 브랜치 `spec/data-flow/2-auth.md` 에 `### 1.7` 만 존재하고 `1.7.1` 은 없음. 다른 spec 파일도 `data-flow/2-auth.md§1.7.1` 을 cross-reference 하는 곳 없음.
- **상세**: 새 하위 섹션 번호가 기존 체계(1.1~1.7)와 충돌 없음.
- **제안**: 충돌 없음.

---

### **[INFO]** `pending_email`, `email_change_token`, `email_change_expires_at` — 기존 spec 과 일치

- **target 신규 식별자**: Schema 매핑 표에 추가된 DB 컬럼명 세 개
  - `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/spec/data-flow/2-auth.md` 라인 269
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md` 라인 65–67 에 동일 snake_case 명칭으로 이미 정의됨
- **상세**: data-flow spec 이 data-model spec 의 기존 컬럼명을 그대로 참조하므로 충돌 없음. (`spec/5-system/1-auth.md` 가 camelCase `emailChangeToken` 로 쓰는 것은 논리 토큰명 표기 관례이고 DB 컬럼명과 다른 레이어이므로 충돌 아님.)
- **제안**: 충돌 없음.

---

## 요약

target 변경(`spec/data-flow/2-auth.md` §1.7.1 추가)이 도입하는 신규 식별자 중 실질적인 의미 충돌은 없다. 단, `SessionsService.reauthenticate`(target data-flow 표기)와 `SessionsService.verifyReauth`(기존 `spec/5-system/1-auth.md` Rationale 1.1.B-4 표기)가 동일 재인증 흐름을 다른 메서드명으로 지칭하는 **명칭 불일치**가 WARNING 수준으로 존재한다. 코드 실체는 `reauthenticate`(public) / `verifyReauth`(private helper) 로 구분되어 있으며, auth spec 이 private 헬퍼명을 그대로 노출한 것이 혼동의 원인이다. `spec/5-system/1-auth.md` 를 수정해 공개 메서드명 `reauthenticate` 로 통일하거나, 두 이름의 관계를 명시하는 것이 적절하다.

## 위험도

LOW
