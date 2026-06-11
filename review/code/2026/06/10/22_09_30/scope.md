# 변경 범위(Scope) 리뷰 결과

## 발견사항

변경 의도: 보안 fix 2건 — (V-03) audit-logs Admin+ 가드 누락 + (C3) notification secret rotation 무효.

### 파일 1: audit-logs.controller.ts

**[INFO]** `@Roles('admin')` 추가 + `@ApiOperation` summary/description 갱신
- 위치: diff 전체
- 상세: `@Roles('admin')` 추가는 V-03 fix 의 핵심. 설명 문자열도 spec 반영("Admin+", userId 필터 언급)으로 갱신했다. 기능 추가 수준이 아니라 보안 갭 해소와 직접 연결된 문서 갱신이다.
- 제안: 없음. 범위 내.

### 파일 2: audit-logs.service.ts

**[INFO]** `userId` 쿼리 조건 추가
- 위치: `findAll` — `userId` destructuring + `andWhere` 분기
- 상세: spec §4.2 "기간, 사용자, 액션 유형으로 필터링" 중 미구현이었던 userId 필터 구현. plan 에 명시된 V-03 범위.
- 제안: 없음.

### 파일 3: audit-logs.spec.ts (신규)

**[INFO]** 신규 단위 테스트 파일 추가
- 위치: 전체 파일
- 상세: `@Roles('admin')` 메타데이터 확인 1케이스 + `userId` 필터 2케이스. 모두 본 작업 범위. `AuditLogsController` 테스트는 불필요한 의존성 없이 최소화.
- 제안: 없음.

### 파일 4: query-audit-log.dto.ts

**[INFO]** `IsUUID` import 추가 + `userId?` 필드 추가
- 위치: import 라인 + `userId` 프로퍼티
- 상세: 기존 import 목록에 `IsUUID` 추가(사용됨), userId 필드 신설. 범위 내 최소 변경.
- 제안: 없음.

### 파일 5: triggers.service.spec.ts

**[INFO]** 기존 테스트 1건 기대값 수정 + 신규 describe 블록 추가
- 위치: 기존 describe 블록 내 기대값 변경 (line 687~) + 신규 describe 블록 (line 1719~)
- 상세: 기존 `secret: 'wsk_new'` → `secretRef: <canonical ref>` + `secret` 부재 검증으로 C3 fix 에 맞게 계약 갱신. 신규 블록은 secret store 경유 승격의 세 시나리오(secretRef 보유·legacy 평문·notification 부재) 커버. 모두 C3 fix 직접 검증.
- 제안: 없음.

### 파일 6: triggers.service.ts

**[INFO]** `promoteRotatedNotificationSecrets` 로직 교체
- 위치: diff 전체
- 상세: v2 평문을 `signing.secret`에 쓰던 로직을 `secrets.rotate(canonical ref, v2)` + `signing.secretRef = ref` + `delete updatedSigning.secret`으로 교체. C3 fix 의 핵심. `normalizeNotificationSecretRef`와 동일 ref 규약 사용. JSDoc 갱신도 동반 — 변경된 동작 설명이므로 적절.
- 제안: 없음.

### 파일 7: audit-logs.e2e-spec.ts (신규)

**[INFO]** 신규 e2e 테스트 파일 추가
- 위치: 전체 파일
- 상세: V-03 시나리오 5케이스(admin 200, viewer 403, editor 403, 비멤버 위조 403, userId 필터). 직접 DB INSERT로 시드하는 방식은 테스트 독립성을 높이며 범위 일탈이 아니다.
- 제안: 없음.

### 파일 8: plan/in-progress/security-fixes-audit-guard-secret-rotation.md (신규)

**[INFO]** 작업 추적 plan 파일 신설
- 위치: 전체 파일
- 상세: CLAUDE.md 규약에 따른 `plan/in-progress/` 신설. 작업 범위·설계·체크리스트가 정확히 기술되어 있다.
- 제안: 없음.

### 파일 9: spec/1-data-model.md

**[WARNING]** spec/1-data-model.md — User 테이블 필드 대량 추가 (10개 행)
- 위치: `## 2.1 User` 테이블 diff
- 상세: `password_hash` nullable 주석 변경 외에 `email_verified`, `email_verify_token`, `email_verify_expires_at`, `password_reset_token`, `password_reset_expires_at`, `login_attempts`, `locked_until`, `oauth_provider`, `oauth_provider_id`, `notification_preferences` 10개 필드가 추가됐다. 이 필드들은 V-03·C3 fix 와 직접 관련이 없다.
- 배경: plan 체크리스트에 "consistency-check BLOCK 해소 — User 필드 누락 3건·초대 토큰 정책 병치 1건" 이 있다. 즉 `--impl-prep` 게이트를 통과하기 위해 drift 해소를 선행했고, 이는 worktree 규약("구현 착수 직전 consistency-check --impl-prep 의무, Critical 발견 시 차단") 준수다.
- 평가: `--impl-prep` Critical 해소는 CLAUDE.md 규약상 차단 해제 요건이므로 작업 흐름에 포함된 필수 선행 변경이다. 그러나 본 범위 관점에서 보면 이는 V-03/C3 fix 와 논리적으로 무관한 spec drift 수정이 포함됐다는 점은 주목해야 한다. 별도 커밋으로 분리했다면 더 명확하나, 게이트 통과 목적으로 동일 worktree 에 포함된 것은 규약 내 허용 범위다.
- 제안: 향후 consistency-check drift 수정은 가능하면 독립 커밋으로 분리해 scope traceability를 높인다.

### 파일 10: spec/5-system/1-auth.md

**[INFO]** Rate Limit 값 확정 + Rationale 1.5.D 추가
- 위치: §1.5.1 Rate Limit 행 + Rationale 말미
- 상세: "구현 시 결정" → "분당 10건(`INVITATION_THROTTLE`)" 확정값으로 갱신. Rationale 1.5.D(초대 토큰 raw 저장 근거)는 신규 추가. 파일 9와 동일하게 `--impl-prep` Critical 해소(초대 토큰 정책 병치) 와 연동된 변경. V-03/C3와 직접 연관은 없으나 같은 게이트 통과 요건이다.
- 제안: 없음(게이트 해소 의무 범위).

### 파일 11: spec/data-flow/1-audit.md

**[INFO]** §2.1 권한·필터 기술 갱신
- 위치: §2.1 필터 행 + 권한 행
- 상세: userId 필터 추가 반영 + `@Roles('admin')` 구현 갭 → 해소 플립. V-03 fix 의 spec 사후 동기화. plan에 명시된 "spec 갭 기술 플립" 체크리스트 항목.
- 제안: 없음.

### 파일 12: spec/data-flow/15-external-interaction.md

**[INFO]** §1.5 승격 경로 기술 갱신
- 위치: §1.5 blockquote 교체
- 상세: "구현 갭 주의" 블록을 "승격 경로 (C3 갭 해소)" 로 교체. C3 fix 의 spec 사후 동기화. plan 체크리스트 항목.
- 제안: 없음.

---

## 요약

본 변경은 크게 두 축(V-03: audit-logs Admin+ 가드 + userId 필터, C3: notification secret rotation 무효 수정)으로 구성되며, 각 축의 구현·테스트·spec 동기화 파일들이 모두 해당 목적에 직결된다. 주의할 지점은 `spec/1-data-model.md`와 `spec/5-system/1-auth.md`에 V-03/C3와 직접 연관 없는 User 필드 추가·Rate Limit 확정·Rationale 신설이 포함됐다는 점인데, 이는 CLAUDE.md 규약(`--impl-prep` Critical 차단 해소 의무)에 따른 선행 처리로 동일 worktree에 포함된 것이 규약 위반은 아니다. 전체적으로 의도된 보안 수정 범위를 벗어나는 기능 확장이나 무관 리팩토링은 발견되지 않는다.

---

## 위험도

LOW
